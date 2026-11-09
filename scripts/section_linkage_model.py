#!/usr/bin/env python3
"""Executable, non-production contract for Coursedog section linkage.

This module deliberately has no database or scheduler integration.  It turns a
synthetic/full Coursedog section payload into lossless normalized records and
association groups so the proposed contract can be tested before production
models or scheduling logic change.
"""

from __future__ import annotations

import copy
import itertools
from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence


OBSERVED_COMPONENT_CODES = frozenset(
    {"CLN", "DIS", "FLD", "IND", "INT", "LAB", "LEC", "MSG", "PRA", "REC", "RSC", "SEM", "THE", "TUT"}
)
REGISTRATION_MODES = frozenset({"Enrollment Section", "Non-Enrollment Section"})
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
    source_section_id = _non_empty_text(raw.get("id") or raw.get("_id"), "section id")
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
        required_components=requirements,
        auto_enroll_section_numbers=auto_enroll,
        primary_instruction_section=_optional_text(
            custom_fields.get("primInstrSect"), "primInstrSect"
        ),
        source_payload=copy.deepcopy(raw),
    )


def _source_section_id_for_diagnostic(raw: Mapping[str, Any]) -> str:
    value = raw.get("id") or raw.get("_id") or "<unknown>"
    return str(value).strip() or "<unknown>"


def _quarantine_key(
    raw: Mapping[str, Any], *, expected_course_id: str, expected_term_id: str
) -> AssociationKey | None:
    """Recover only enough identity to quarantine; never use it as accepted data."""
    try:
        course_id = _non_empty_text(raw.get("courseId"), "courseId")
        if course_id != expected_course_id:
            return None
        custom_fields = raw.get("customFields")
        if not isinstance(custom_fields, dict):
            return None
        association = custom_fields.get("_classAssociation")
        if not isinstance(association, dict):
            return None
        term_id = expected_term_id
        if association.get("STRM") is not None:
            term_id = _source_text(association.get("STRM"), "STRM")
        session_code = _source_text(association.get("SESSION_CODE"), "SESSION_CODE")
        associated_class = custom_fields.get("associatedClass")
        if associated_class is None:
            associated_class = _source_text(
                association.get("ASSOCIATED_CLASS"), "ASSOCIATED_CLASS"
            )
        associated_class = _non_empty_text(associated_class, "associatedClass")
        return AssociationKey(course_id, term_id, session_code, associated_class)
    except LinkageValidationError:
        return None


def _section_number_key_for_diagnostic(
    raw: Mapping[str, Any], *, expected_course_id: str, expected_term_id: str
) -> tuple[str, str, str] | None:
    """Recover term/session/number for collision checks, never for acceptance."""
    try:
        if _non_empty_text(raw.get("courseId"), "courseId") != expected_course_id:
            return None
        custom_fields = raw.get("customFields")
        if not isinstance(custom_fields, dict):
            return None
        association = custom_fields.get("_classAssociation")
        if not isinstance(association, dict):
            return None
        term_id = expected_term_id
        if association.get("STRM") is not None:
            term_id = _source_text(association.get("STRM"), "STRM")
        session_code = _source_text(association.get("SESSION_CODE"), "SESSION_CODE")
        section_number = _non_empty_text(raw.get("sectionNumber"), "sectionNumber")
        return term_id, session_code, section_number
    except LinkageValidationError:
        return None


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
    raw_sections: Iterable[Mapping[str, Any]], *, expected_course_id: str, expected_term_id: str
) -> NormalizationResult:
    """Return valid groups plus explicit quarantines without dropping unrelated groups."""
    sections: list[NormalizedSection] = []
    quarantined: list[QuarantinedAssociation] = []
    invalid_keys: dict[AssociationKey, list[tuple[str, str]]] = {}
    raw_payloads = [copy.deepcopy(raw) for raw in raw_sections]
    source_id_counts: dict[str, int] = {}
    section_number_counts: dict[tuple[str, str, str], int] = {}
    raw_payloads_by_key: dict[AssociationKey, list[Mapping[str, Any]]] = {}
    for raw in raw_payloads:
        source_id = _source_section_id_for_diagnostic(raw)
        source_id_counts[source_id] = source_id_counts.get(source_id, 0) + 1
        number_key = _section_number_key_for_diagnostic(
            raw,
            expected_course_id=expected_course_id,
            expected_term_id=expected_term_id,
        )
        if number_key is not None:
            section_number_counts[number_key] = section_number_counts.get(number_key, 0) + 1
        key = _quarantine_key(
            raw,
            expected_course_id=expected_course_id,
            expected_term_id=expected_term_id,
        )
        if key is not None:
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
            key = _quarantine_key(
                raw,
                expected_course_id=expected_course_id,
                expected_term_id=expected_term_id,
            )
            if key is None:
                quarantined.append(
                    QuarantinedAssociation(
                        None, (source_id,), str(error), (copy.deepcopy(raw),)
                    )
                )
            else:
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
        by_section_number.setdefault(
            number_key, []
        ).append(section)

    sections_by_number = {
        (number_key[1], number_key[2]): candidates[0]
        for number_key, candidates in by_section_number.items()
        if section_number_counts[number_key] == 1
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


def valid_component_combinations(group: AssociationGroup) -> tuple[tuple[str, ...], ...]:
    """Enumerate one choice for every required component and zero/one optional choice."""
    alternatives: list[tuple[str | None, ...]] = []
    for requirement in group.required_components:
        choices = tuple(
            member.section_number
            for member in group.sections
            if member.component_code == requirement.component_code
        )
        alternatives.append((None, *choices) if requirement.optional else choices)
    candidates = tuple(
        tuple(section_number for section_number in combination if section_number is not None)
        for combination in itertools.product(*alternatives)
    )
    by_number = {member.section_number: member for member in group.sections}
    return tuple(
        combination
        for combination in candidates
        if any(
            by_number[section_number].registration_mode == "Enrollment Section"
            for section_number in combination
        )
        and all(
            set(by_number[section_number].auto_enroll_section_numbers).issubset(
                combination
            )
            for section_number in combination
        )
    )
