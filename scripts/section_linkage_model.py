#!/usr/bin/env python3
"""Executable, non-production contract for Coursedog section linkage.

This module deliberately has no database or scheduler integration.  It turns a
synthetic/full Coursedog section payload into lossless normalized records and
association groups so the proposed contract can be tested before production
models or scheduling logic change.
"""

from __future__ import annotations

import copy
import hashlib
import itertools
import json
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence


OBSERVED_COMPONENT_CODES = frozenset(
    {"CLN", "DIS", "FLD", "IND", "INT", "LAB", "LEC", "MSG", "PRA", "REC", "RSC", "SEM", "THE", "TUT"}
)
REGISTRATION_MODES = frozenset({"Enrollment Section", "Non-Enrollment Section"})
AVAILABLE_SOURCE_STATUSES = frozenset({"Active"})
AVAILABILITY_POLICY_ID = "source-status-active-only-v1"
MAX_CANDIDATE_COMBINATIONS_PER_GROUP = 10_000
SECTION_TYPE_COMPONENT_CODES = {
    "Clinical": "CLN",
    "Discussion": "DIS",
    "Field Studies": "FLD",
    "Independent Study": "IND",
    "Internship": "INT",
    "Laboratory": "LAB",
    "Lecture": "LEC",
    "Message": "MSG",
    "Practicum": "PRA",
    "Recitation": "REC",
    "Research": "RSC",
    "Seminar": "SEM",
    "Thesis Research": "THE",
    "Tutorial": "TUT",
}


class LinkageValidationError(ValueError):
    """The source payload cannot be grouped without guessing."""


@dataclass(frozen=True, order=True)
class AssociationKey:
    course_id: str
    term_id: str
    session_code: str
    associated_class: str


@dataclass(frozen=True)
class ComponentRequirement:
    component_code: str
    optional: bool
    auto_create: bool
    contact_hours: str | None
    final_exam: str | None
    workload_hours: str | None
    source_declaration: Mapping[str, Any]


@dataclass(frozen=True)
class NormalizedSection:
    source_section_id: str
    section_number: str
    key: AssociationKey
    component_code: str
    section_type: str
    association_component_code: str
    registration_mode: str
    source_status: str
    required_components: tuple[ComponentRequirement, ...]
    auto_enroll_section_numbers: tuple[str, ...]
    primary_instruction_section: str | None
    source_payload: Mapping[str, Any]


@dataclass(frozen=True)
class AssociationGroup:
    key: AssociationKey
    required_components: tuple[ComponentRequirement, ...]
    sections: tuple[NormalizedSection, ...]


@dataclass(frozen=True)
class QuarantinedAssociation:
    key: AssociationKey | None
    source_section_ids: tuple[str, ...]
    reason: str
    source_payloads: tuple[Mapping[str, Any], ...]


@dataclass(frozen=True)
class NormalizationResult:
    groups: tuple[AssociationGroup, ...]
    quarantined: tuple[QuarantinedAssociation, ...]

    def require_clean(self) -> tuple[AssociationGroup, ...]:
        """Return groups or raise the first quarantine diagnostic for strict callers."""
        if self.quarantined:
            raise LinkageValidationError(self.quarantined[0].reason)
        return self.groups


@dataclass(frozen=True)
class CombinationMember:
    source_section_id: str
    section_number: str
    component_code: str
    enrollment_role: str


@dataclass(frozen=True)
class CombinationEvidence:
    association_key: AssociationKey
    required_component_declarations: tuple[Mapping[str, Any], ...]
    source_section_ids: tuple[str, ...]
    source_payloads: tuple[Mapping[str, Any], ...]
    explicit_auto_enroll_links: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class EnrollmentCombination:
    combination_id: str
    availability_policy: str
    members: tuple[CombinationMember, ...]
    evidence: CombinationEvidence


def _non_empty_text(value: Any, field: str) -> str:
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        raise LinkageValidationError(f"{field} must be a string or integer")
    text = str(value).strip()
    if not text:
        raise LinkageValidationError(f"{field} must not be empty")
    return text


def _optional_text(value: Any, field: str) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int)) and not isinstance(value, bool):
        text = str(value).strip()
        return text or None
    return _non_empty_text(value, field)


def _source_text(value: Any, field: str) -> str:
    if not isinstance(value, dict):
        raise LinkageValidationError(f"{field} must be an object with _text")
    return _non_empty_text(value.get("_text"), f"{field}._text")


def _optional_source_text(value: Any, field: str) -> str | None:
    if value is None:
        return None
    return _source_text(value, field)


def _yes_no(value: Any, field: str) -> bool:
    text = _source_text(value, field)
    if text == "Y":
        return True
    if text == "N":
        return False
    raise LinkageValidationError(f"{field} must be Y or N")


def _component_declarations(association: Mapping[str, Any]) -> tuple[Mapping[str, Any], ...]:
    value = association.get("CLASS_COMPONENT")
    if isinstance(value, dict):
        declarations: Sequence[Any] = [value]
    elif isinstance(value, list) and value:
        declarations = value
    else:
        raise LinkageValidationError(
            "CLASS_COMPONENT must be an object or a non-empty list of objects"
        )
    if any(not isinstance(item, dict) for item in declarations):
        raise LinkageValidationError("CLASS_COMPONENT entries must be objects")
    return tuple(declarations)


def _component_requirement(raw: Mapping[str, Any], index: int) -> ComponentRequirement:
    prefix = f"CLASS_COMPONENT[{index}]"
    code = _source_text(raw.get("SSR_COMPONENT"), f"{prefix}.SSR_COMPONENT").upper()
    if code not in OBSERVED_COMPONENT_CODES:
        raise LinkageValidationError(f"{prefix} has unsupported component code {code}")
    return ComponentRequirement(
        component_code=code,
        optional=_yes_no(raw.get("OPTIONAL_SECTION"), f"{prefix}.OPTIONAL_SECTION"),
        auto_create=_yes_no(raw.get("AUTO_CREATE_CMPNT"), f"{prefix}.AUTO_CREATE_CMPNT"),
        contact_hours=_optional_source_text(raw.get("CONTACT_HOURS"), f"{prefix}.CONTACT_HOURS"),
        final_exam=_optional_source_text(raw.get("FINAL_EXAM"), f"{prefix}.FINAL_EXAM"),
        workload_hours=_optional_source_text(
            raw.get("WEEK_WORKLOAD_HRS"), f"{prefix}.WEEK_WORKLOAD_HRS"
        ),
        source_declaration=copy.deepcopy(raw),
    )


def normalize_section(
    raw: Mapping[str, Any], *, expected_course_id: str, expected_term_id: str
) -> NormalizedSection:
    """Normalize one section or reject it when linkage evidence is incomplete."""
    source_section_id = _source_section_id(raw)
    course_id = _non_empty_text(raw.get("courseId"), "courseId")
    if course_id != expected_course_id:
        raise LinkageValidationError(
            f"section {source_section_id} belongs to course {course_id}, not {expected_course_id}"
        )

    custom_fields = raw.get("customFields")
    if not isinstance(custom_fields, dict):
        raise LinkageValidationError("customFields must be an object")
    associated_class = _non_empty_text(
        custom_fields.get("associatedClass"), "associatedClass"
    )
    association = custom_fields.get("_classAssociation")
    if not isinstance(association, dict):
        raise LinkageValidationError("_classAssociation must be an object")
    term_id = _source_text(association.get("STRM"), "STRM")
    if term_id != expected_term_id:
        raise LinkageValidationError(
            f"section {source_section_id} belongs to term {term_id}, not {expected_term_id}"
        )
    session_code = _source_text(association.get("SESSION_CODE"), "SESSION_CODE")
    declared_associated_class = _source_text(
        association.get("ASSOCIATED_CLASS"), "ASSOCIATED_CLASS"
    )
    if declared_associated_class != associated_class:
        raise LinkageValidationError(
            "customFields.associatedClass disagrees with _classAssociation.ASSOCIATED_CLASS"
        )

    association_component_code = _source_text(
        association.get("SSR_COMPONENT"), "SSR_COMPONENT"
    ).upper()
    if association_component_code not in OBSERVED_COMPONENT_CODES:
        raise LinkageValidationError(
            f"unsupported association component code {association_component_code}"
        )
    section_type = _non_empty_text(raw.get("sectionType"), "sectionType")
    component_code = SECTION_TYPE_COMPONENT_CODES.get(section_type)
    if component_code is None:
        raise LinkageValidationError(f"unsupported sectionType {section_type}")
    requirements = tuple(
        _component_requirement(item, index)
        for index, item in enumerate(_component_declarations(association))
    )
    if len({item.component_code for item in requirements}) != len(requirements):
        raise LinkageValidationError("CLASS_COMPONENT repeats a component code")
    requirement_codes = {item.component_code for item in requirements}
    if association_component_code not in requirement_codes:
        raise LinkageValidationError(
            f"association component {association_component_code} is absent from CLASS_COMPONENT"
        )
    if component_code not in requirement_codes:
        raise LinkageValidationError(
            f"section component {component_code} is absent from CLASS_COMPONENT"
        )

    registration_mode = _non_empty_text(raw.get("registrationMode"), "registrationMode")
    if registration_mode not in REGISTRATION_MODES:
        raise LinkageValidationError(f"unsupported registrationMode {registration_mode}")
    source_status = _non_empty_text(raw.get("status"), "status")
    if source_status not in AVAILABLE_SOURCE_STATUSES:
        raise LinkageValidationError(
            f"source status {source_status} is unavailable under {AVAILABILITY_POLICY_ID}"
        )

    auto_enroll = tuple(
        value
        for value in (
            _optional_text(custom_fields.get("autoEnrollSect1"), "autoEnrollSect1"),
            _optional_text(custom_fields.get("autoEnrollSect2"), "autoEnrollSect2"),
        )
        if value is not None
    )
    if len(set(auto_enroll)) != len(auto_enroll):
        raise LinkageValidationError("auto-enroll targets must be distinct")

    return NormalizedSection(
        source_section_id=source_section_id,
        section_number=_non_empty_text(raw.get("sectionNumber"), "sectionNumber"),
        key=AssociationKey(course_id, term_id, session_code, associated_class),
        component_code=component_code,
        section_type=section_type,
        association_component_code=association_component_code,
        registration_mode=registration_mode,
        source_status=source_status,
        required_components=requirements,
        auto_enroll_section_numbers=auto_enroll,
        primary_instruction_section=_optional_text(
            custom_fields.get("primInstrSect"), "primInstrSect"
        ),
        source_payload=copy.deepcopy(raw),
    )


def _source_section_id(raw: Mapping[str, Any]) -> str:
    """Return the canonical source ID only when aliases provide consistent evidence."""
    source_id = _optional_text(raw.get("id"), "id")
    mongo_id = _optional_text(raw.get("_id"), "_id")
    if source_id is None and mongo_id is None:
        raise LinkageValidationError("section id is required")
    if source_id is not None and mongo_id is not None and source_id != mongo_id:
        raise LinkageValidationError("id and _id must agree when both are present")
    if source_id is not None:
        return source_id
    assert mongo_id is not None
    return mongo_id


def _source_section_ids_for_diagnostic(raw: Mapping[str, Any]) -> tuple[str, ...]:
    """Expose every usable alias so contradictory evidence cannot conceal a collision."""
    aliases: list[str] = []
    for field in ("id", "_id"):
        try:
            value = _optional_text(raw.get(field), field)
        except LinkageValidationError:
            value = None
        if value is not None:
            aliases.append(value)
    return tuple(dict.fromkeys(aliases)) or ("<unknown>",)


def _source_section_id_for_diagnostic(raw: Mapping[str, Any]) -> str:
    return " / ".join(_source_section_ids_for_diagnostic(raw))


def _quarantine_keys(
    raw: Mapping[str, Any], *, expected_course_id: str, expected_term_id: str
) -> tuple[AssociationKey, ...]:
    """Recover every plausible identity for quarantine; never accept it as data."""
    try:
        course_id = _non_empty_text(raw.get("courseId"), "courseId")
        if course_id != expected_course_id:
            return ()
        custom_fields = raw.get("customFields")
        if not isinstance(custom_fields, dict):
            return ()
        association = custom_fields.get("_classAssociation")
        if not isinstance(association, dict):
            return ()
        term_id = expected_term_id
        if association.get("STRM") is not None:
            term_id = _source_text(association.get("STRM"), "STRM")
        session_code = _source_text(association.get("SESSION_CODE"), "SESSION_CODE")
    except LinkageValidationError:
        return ()

    associated_classes: set[str] = set()
    try:
        custom_associated_class = _optional_text(
            custom_fields.get("associatedClass"), "associatedClass"
        )
        if custom_associated_class is not None:
            associated_classes.add(custom_associated_class)
    except LinkageValidationError:
        pass
    try:
        declared_associated_class = _optional_source_text(
            association.get("ASSOCIATED_CLASS"), "ASSOCIATED_CLASS"
        )
        if declared_associated_class is not None:
            associated_classes.add(declared_associated_class)
    except LinkageValidationError:
        pass
    return tuple(
        AssociationKey(course_id, term_id, session_code, associated_class)
        for associated_class in sorted(associated_classes)
    )


def _section_number_key_for_diagnostic(
    raw: Mapping[str, Any], *, expected_course_id: str, expected_term_id: str
) -> tuple[str, str | None, str] | None:
    """Recover even a partial term/session/number identity for collision checks."""
    try:
        section_number = _non_empty_text(raw.get("sectionNumber"), "sectionNumber")
    except LinkageValidationError:
        return None

    raw_course_id = raw.get("courseId")
    if raw_course_id is not None:
        try:
            if _non_empty_text(raw_course_id, "courseId") != expected_course_id:
                return None
        except LinkageValidationError:
            # The enclosing course response remains the only usable course identity.
            pass

    term_id = expected_term_id
    session_code = None
    try:
        custom_fields = raw.get("customFields")
        if not isinstance(custom_fields, dict):
            return term_id, session_code, section_number
        association = custom_fields.get("_classAssociation")
        if not isinstance(association, dict):
            return term_id, session_code, section_number
        if association.get("STRM") is not None:
            term_id = _source_text(association.get("STRM"), "STRM")
        if association.get("SESSION_CODE") is not None:
            session_code = _source_text(
                association.get("SESSION_CODE"), "SESSION_CODE"
            )
        return term_id, session_code, section_number
    except LinkageValidationError:
        return expected_term_id, None, section_number


def _validated_group(
    key: AssociationKey,
    raw_members: Sequence[NormalizedSection],
    sections_by_number: Mapping[tuple[str, str], NormalizedSection],
) -> AssociationGroup:
    members = sorted(raw_members, key=lambda item: item.source_section_id)
    association_components = {
        member.association_component_code for member in members
    }
    if len(association_components) != 1:
        raise LinkageValidationError(
            f"association group {key} has inconsistent association components"
        )
    signature = frozenset(
        (
            item.component_code,
            item.optional,
            item.auto_create,
            item.contact_hours,
            item.final_exam,
            item.workload_hours,
        )
        for item in members[0].required_components
    )
    for member in members[1:]:
        candidate = frozenset(
            (
                item.component_code,
                item.optional,
                item.auto_create,
                item.contact_hours,
                item.final_exam,
                item.workload_hours,
            )
            for item in member.required_components
        )
        if candidate != signature:
            raise LinkageValidationError(
                f"association group {key} has inconsistent requirements"
            )
    available = {member.component_code for member in members}
    missing = [
        item.component_code
        for item in members[0].required_components
        if not item.optional and item.component_code not in available
    ]
    if missing:
        raise LinkageValidationError(
            f"association group {key} is missing required components: {', '.join(missing)}"
        )
    if not any(member.registration_mode == "Enrollment Section" for member in members):
        raise LinkageValidationError(f"association group {key} has no enrollment section")
    for member in members:
        auto_targets = []
        unresolved = []
        wrong_group = []
        for target_number in member.auto_enroll_section_numbers:
            target = sections_by_number.get((member.key.session_code, target_number))
            if target is None:
                unresolved.append(target_number)
            elif target.key != member.key:
                wrong_group.append(target_number)
            elif target.section_number == member.section_number:
                raise LinkageValidationError(
                    f"section {member.section_number} cannot auto-enroll itself"
                )
            elif target.component_code == member.component_code:
                raise LinkageValidationError(
                    f"section {member.section_number} cannot auto-enroll another "
                    f"{member.component_code} section"
                )
            else:
                auto_targets.append(target)
        if unresolved:
            raise LinkageValidationError(
                f"section {member.section_number} has unresolved auto-enroll targets: "
                + ", ".join(sorted(unresolved))
            )
        if wrong_group:
            raise LinkageValidationError(
                f"section {member.section_number} has auto-enroll targets outside its association group: "
                + ", ".join(sorted(wrong_group))
            )
        target_components = [target.component_code for target in auto_targets]
        if len(set(target_components)) != len(target_components):
            raise LinkageValidationError(
                f"section {member.section_number} auto-enrolls mutually exclusive alternatives"
            )

        primary_number = member.primary_instruction_section
        if primary_number is not None:
            primary = sections_by_number.get((member.key.session_code, primary_number))
            if primary is None:
                raise LinkageValidationError(
                    f"section {member.section_number} has unresolved primary instruction section "
                    f"{primary_number}"
                )
            if primary.key != member.key:
                raise LinkageValidationError(
                    f"section {member.section_number} has a primary instruction section "
                    "outside its association group"
                )

    group = AssociationGroup(key, members[0].required_components, tuple(members))
    if not valid_component_combinations(group):
        raise LinkageValidationError(
            f"association group {key} has no viable component combination"
        )
    return group


def normalize_groups(
    raw_sections: Iterable[Any], *, expected_course_id: str, expected_term_id: str
) -> NormalizationResult:
    """Return valid groups plus explicit quarantines without dropping unrelated groups."""
    sections: list[NormalizedSection] = []
    quarantined: list[QuarantinedAssociation] = []
    invalid_keys: dict[AssociationKey, list[tuple[str, str]]] = {}
    raw_payloads: list[Mapping[str, Any]] = []
    for index, raw in enumerate(raw_sections):
        copied = copy.deepcopy(raw)
        if not isinstance(copied, Mapping):
            quarantined.append(
                QuarantinedAssociation(
                    None,
                    ("<unknown>",),
                    f"section entry at index {index} must be an object",
                    ({"malformed_section": copied},),
                )
            )
            continue
        raw_payloads.append(copied)
    source_id_counts: dict[str, int] = {}
    section_number_counts: dict[tuple[str, str, str], int] = {}
    ambiguous_section_numbers: set[tuple[str, str]] = set()
    raw_payloads_by_key: dict[AssociationKey, list[Mapping[str, Any]]] = {}
    for raw in raw_payloads:
        for source_id in _source_section_ids_for_diagnostic(raw):
            source_id_counts[source_id] = source_id_counts.get(source_id, 0) + 1
        number_key = _section_number_key_for_diagnostic(
            raw,
            expected_course_id=expected_course_id,
            expected_term_id=expected_term_id,
        )
        if number_key is not None:
            term_id, session_code, section_number = number_key
            if session_code is None:
                ambiguous_section_numbers.add((term_id, section_number))
            else:
                exact_key = (term_id, session_code, section_number)
                section_number_counts[exact_key] = section_number_counts.get(exact_key, 0) + 1
        keys = _quarantine_keys(
            raw,
            expected_course_id=expected_course_id,
            expected_term_id=expected_term_id,
        )
        for key in keys:
            raw_payloads_by_key.setdefault(key, []).append(raw)

    for raw in raw_payloads:
        source_id = _source_section_id_for_diagnostic(raw)
        try:
            sections.append(
                normalize_section(
                    raw,
                    expected_course_id=expected_course_id,
                    expected_term_id=expected_term_id,
                )
            )
        except LinkageValidationError as error:
            keys = _quarantine_keys(
                raw,
                expected_course_id=expected_course_id,
                expected_term_id=expected_term_id,
            )
            if not keys:
                quarantined.append(
                    QuarantinedAssociation(
                        None, (source_id,), str(error), (copy.deepcopy(raw),)
                    )
                )
            else:
                for key in keys:
                    invalid_keys.setdefault(key, []).append((source_id, str(error)))

    by_key: dict[AssociationKey, list[NormalizedSection]] = {}
    for section in sections:
        by_key.setdefault(section.key, []).append(section)

    by_section_number: dict[tuple[str, str, str], list[NormalizedSection]] = {}
    for section in sections:
        if source_id_counts[section.source_section_id] > 1:
            invalid_keys.setdefault(section.key, []).append(
                (section.source_section_id, "source section IDs must be unique")
            )
        number_key = (
            section.key.term_id,
            section.key.session_code,
            section.section_number,
        )
        if section_number_counts[number_key] > 1:
            invalid_keys.setdefault(section.key, []).append(
                (
                    section.source_section_id,
                    "section numbers must be unique within one course, term, and session",
                )
            )
        if (section.key.term_id, section.section_number) in ambiguous_section_numbers:
            invalid_keys.setdefault(section.key, []).append(
                (
                    section.source_section_id,
                    "section number is ambiguous because a raw record is missing session identity",
                )
            )
        by_section_number.setdefault(
            number_key, []
        ).append(section)

    sections_by_number = {
        (number_key[1], number_key[2]): candidates[0]
        for number_key, candidates in by_section_number.items()
        if section_number_counts[number_key] == 1
        and (number_key[0], number_key[2]) not in ambiguous_section_numbers
    }
    groups: list[AssociationGroup] = []
    for key in sorted(set(by_key) | set(invalid_keys)):
        members = by_key.get(key, [])
        source_ids = {member.source_section_id for member in members}
        if key in invalid_keys:
            details = invalid_keys[key]
            payloads = raw_payloads_by_key.get(key, [])
            source_ids.update(
                _source_section_id_for_diagnostic(payload) for payload in payloads
            )
            reason = "; ".join(dict.fromkeys(reason for _source_id, reason in details))
            quarantined.append(
                QuarantinedAssociation(
                    key,
                    tuple(sorted(source_ids)),
                    reason,
                    tuple(copy.deepcopy(payload) for payload in payloads),
                )
            )
            continue
        try:
            groups.append(_validated_group(key, members, sections_by_number))
        except LinkageValidationError as error:
            quarantined.append(
                QuarantinedAssociation(
                    key,
                    tuple(sorted(source_ids)),
                    str(error),
                    tuple(
                        copy.deepcopy(payload)
                        for payload in raw_payloads_by_key.get(key, [])
                    ),
                )
            )
    return NormalizationResult(tuple(groups), tuple(quarantined))


def _combination_section_numbers(group: AssociationGroup) -> tuple[tuple[str, ...], ...]:
    """Enumerate a bounded set of viable combinations under the source evidence."""
    alternatives: list[tuple[str | None, ...]] = []
    candidate_count = 1
    for requirement in group.required_components:
        choices = tuple(
            member.section_number
            for member in group.sections
            if member.component_code == requirement.component_code
        )
        options = (None, *choices) if requirement.optional else choices
        alternatives.append(options)
        candidate_count *= len(options)
        if candidate_count > MAX_CANDIDATE_COMBINATIONS_PER_GROUP:
            raise LinkageValidationError(
                f"association group {group.key} would produce {candidate_count} candidate "
                f"combinations, above the research limit of "
                f"{MAX_CANDIDATE_COMBINATIONS_PER_GROUP}"
            )
    by_number = {member.section_number: member for member in group.sections}
    valid: list[tuple[str, ...]] = []
    for raw_combination in itertools.product(*alternatives):
        combination = tuple(
            section_number
            for section_number in raw_combination
            if section_number is not None
        )
        if any(
            by_number[section_number].registration_mode == "Enrollment Section"
            for section_number in combination
        ) and all(
            set(by_number[section_number].auto_enroll_section_numbers).issubset(
                combination
            )
            for section_number in combination
        ):
            valid.append(combination)
    return tuple(valid)


def _combination_id(key: AssociationKey, source_section_ids: Sequence[str]) -> str:
    identity = {
        "association": {
            "course_id": key.course_id,
            "term_id": key.term_id,
            "session_code": key.session_code,
            "associated_class": key.associated_class,
        },
        "source_section_ids": sorted(source_section_ids),
        "version": 1,
    }
    digest = hashlib.sha256(
        json.dumps(identity, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"linked-v1-{digest[:24]}"


def enrollment_combinations(group: AssociationGroup) -> tuple[EnrollmentCombination, ...]:
    """Return deterministic, evidence-bearing combinations for one valid group."""
    by_number = {member.section_number: member for member in group.sections}
    combinations: list[EnrollmentCombination] = []
    identities_by_id: dict[str, tuple[str, ...]] = {}
    for section_numbers in _combination_section_numbers(group):
        selected = tuple(by_number[number] for number in section_numbers)
        source_ids = tuple(sorted(member.source_section_id for member in selected))
        combination_id = _combination_id(group.key, source_ids)
        existing_identity = identities_by_id.get(combination_id)
        if existing_identity is not None and existing_identity != source_ids:
            raise LinkageValidationError(
                f"combination ID collision under {combination_id}"
            )
        identities_by_id[combination_id] = source_ids
        selected_numbers = frozenset(section_numbers)
        explicit_links = tuple(
            sorted(
                (member.source_section_id, by_number[target].source_section_id)
                for member in selected
                for target in member.auto_enroll_section_numbers
                if target in selected_numbers
            )
        )
        members = tuple(
            CombinationMember(
                source_section_id=member.source_section_id,
                section_number=member.section_number,
                component_code=member.component_code,
                enrollment_role=(
                    "enrollment-entry"
                    if member.registration_mode == "Enrollment Section"
                    else "implicit-member"
                ),
            )
            for member in sorted(selected, key=lambda item: item.source_section_id)
        )
        combinations.append(
            EnrollmentCombination(
                combination_id=combination_id,
                availability_policy=AVAILABILITY_POLICY_ID,
                members=members,
                evidence=CombinationEvidence(
                    association_key=group.key,
                    required_component_declarations=tuple(
                        copy.deepcopy(item.source_declaration)
                        for item in group.required_components
                    ),
                    source_section_ids=source_ids,
                    source_payloads=tuple(
                        copy.deepcopy(member.source_payload)
                        for member in sorted(
                            selected, key=lambda item: item.source_section_id
                        )
                    ),
                    explicit_auto_enroll_links=explicit_links,
                ),
            )
        )
    return tuple(sorted(combinations, key=lambda item: item.combination_id))


def valid_component_combinations(group: AssociationGroup) -> tuple[tuple[str, ...], ...]:
    """Compatibility view of evidence-bearing combinations as section numbers."""
    return _combination_section_numbers(group)
