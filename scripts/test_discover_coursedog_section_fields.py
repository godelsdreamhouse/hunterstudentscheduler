"""Offline regression tests for the read-only Coursedog discovery tool."""

from __future__ import annotations

import importlib.util
import io
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).with_name("discover-coursedog-section-fields.py")
SPEC = importlib.util.spec_from_file_location("coursedog_discovery", SCRIPT)
assert SPEC and SPEC.loader
discovery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(discovery)


def component(text: str) -> dict[str, object]:
    return {"SSR_COMPONENT": {"_text": text}, "OPTIONAL_SECTION": {"_text": "N"}}


def section(
    *,
    course_id: str = "course-1",
    term_id: str = "1269",
    components: object = None,
    include_session: bool = True,
) -> dict[str, object]:
    association: dict[str, object] = {
        "STRM": {"_text": term_id},
    }
    if include_session:
        association["SESSION_CODE"] = {"_text": "1"}
    if components is not None:
        association["CLASS_COMPONENT"] = components
    return {
        "id": "section-1",
        "courseId": course_id,
        "customFields": {
            "associatedClass": "10",
            "_classAssociation": association,
        },
    }


def capture_record(*, sections: list[dict[str, object]] | None = None) -> dict[str, object]:
    return {
        "termId": "1269",
        "courseGroupId": "course-1",
        "code": "TEST 100",
        "payload": {"sections": sections or []},
    }


class FakeResponse(io.BytesIO):
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


class PayloadValidationTests(unittest.TestCase):
    def test_class_components_normalize_object_and_array(self) -> None:
        single = section(components=component("LEC"))
        multiple = section(components=[component("LEC"), component("LAB")])

        self.assertEqual(discovery.normalize_class_components(single), [component("LEC")])
        self.assertEqual(
            discovery.normalize_class_components(multiple),
            [component("LEC"), component("LAB")],
        )

    def test_class_components_fail_closed_when_declaration_or_session_missing(self) -> None:
        with self.assertRaises(discovery.PayloadValidationError):
            discovery.normalize_class_components(section())
        with self.assertRaises(discovery.PayloadValidationError):
            discovery.normalize_class_components(
                section(components=component("LEC"), include_session=False)
            )

    def test_section_payload_rejects_envelope_wrong_course_and_wrong_term(self) -> None:
        cases = [
            {"error": "temporary"},
            {"sections": [section(course_id="other")]},
            {"sections": [section(term_id="1268")]},
            {"sections": "not-a-list"},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                with self.assertRaises(discovery.PayloadValidationError):
                    discovery.validate_sections_payload(
                        payload,
                        expected_course_id="course-1",
                        expected_term_id="1269",
                    )

    def test_invalid_successful_response_is_retried(self) -> None:
        responses = [
            FakeResponse(json.dumps({"error": "temporary"}).encode()),
            FakeResponse(json.dumps({"sections": []}).encode()),
        ]

        def validator(payload: object) -> object:
            return discovery.validate_sections_payload(
                payload,
                expected_course_id="course-1",
                expected_term_id="1269",
            )

        with mock.patch.object(
            discovery.urllib.request,
            "urlopen",
            side_effect=responses,
        ) as urlopen, mock.patch.object(discovery.time, "sleep"):
            result = discovery.request_json(
                "https://example.invalid",
                limiter=discovery.RateLimiter(1000),
                attempts=2,
                validator=validator,
            )

        self.assertEqual(result, {"sections": []})
        self.assertEqual(urlopen.call_count, 2)


class CoursePaginationTests(unittest.TestCase):
    def test_active_courses_paginates_to_reported_total(self) -> None:
        pages = [
            {
                "data": [
                    {"courseGroupId": "1", "code": "A 100"},
                    {"courseGroupId": "2", "code": "A 200"},
                ],
                "skip": 0,
                "limit": discovery.COURSE_PAGE_SIZE,
                "listLength": 3,
            },
            {
                "data": [{"courseGroupId": "3", "code": "A 300"}],
                "skip": 2,
                "limit": discovery.COURSE_PAGE_SIZE,
                "listLength": 3,
            },
        ]

        def request(_url: str, **kwargs: object) -> object:
            payload = pages.pop(0)
            return kwargs["validator"](payload)  # type: ignore[index,operator]

        with mock.patch.object(discovery, "request_json", side_effect=request):
            courses = discovery.active_courses(discovery.RateLimiter(1000))

        self.assertEqual([course["courseGroupId"] for course in courses], ["1", "2", "3"])
        self.assertFalse(pages)

    def test_empty_course_listing_fails_closed_unless_explicitly_allowed(self) -> None:
        payload = {
            "data": [],
            "skip": 0,
            "limit": discovery.COURSE_PAGE_SIZE,
            "listLength": 0,
        }

        def request(_url: str, **kwargs: object) -> object:
            return kwargs["validator"](payload)  # type: ignore[index,operator]

        with mock.patch.object(discovery, "request_json", side_effect=request):
            with self.assertRaisesRegex(
                discovery.PayloadValidationError,
                "active undergraduate course listing was empty",
            ):
                discovery.active_courses(discovery.RateLimiter(1000))
            self.assertEqual(
                discovery.active_courses(
                    discovery.RateLimiter(1000),
                    allow_empty=True,
                ),
                [],
            )

    def test_course_page_rejects_duplicates_wrong_total_and_truncation(self) -> None:
        valid_first = {
            "data": [{"courseGroupId": "1", "code": "A 100"}],
            "skip": 0,
            "limit": discovery.COURSE_PAGE_SIZE,
            "listLength": 2,
        }
        page, total = discovery.validate_course_page(
            valid_first,
            expected_skip=0,
            expected_limit=discovery.COURSE_PAGE_SIZE,
            expected_total=None,
            seen_ids=set(),
        )
        self.assertEqual(total, 2)
        self.assertEqual(len(page), 1)

        invalid_pages = [
            {"error": "temporary"},
            {
                "data": {"courseGroupId": "2", "code": "A 200"},
                "skip": 1,
                "limit": discovery.COURSE_PAGE_SIZE,
                "listLength": 2,
            },
            {
                "data": [{"courseGroupId": "1", "code": "A 100"}],
                "skip": 1,
                "limit": discovery.COURSE_PAGE_SIZE,
                "listLength": 2,
            },
            {
                "data": [],
                "skip": 1,
                "limit": discovery.COURSE_PAGE_SIZE,
                "listLength": 2,
            },
            {
                "data": [{"courseGroupId": "2", "code": "A 200"}],
                "skip": 1,
                "limit": discovery.COURSE_PAGE_SIZE,
                "listLength": 3,
            },
        ]
        for payload in invalid_pages:
            with self.subTest(payload=payload):
                with self.assertRaises(discovery.PayloadValidationError):
                    discovery.validate_course_page(
                        payload,
                        expected_skip=1,
                        expected_limit=discovery.COURSE_PAGE_SIZE,
                        expected_total=2,
                        seen_ids={"1"},
                    )


class ResumeIntegrityTests(unittest.TestCase):
    def test_truncated_final_line_is_quarantined_before_resume(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw-section-responses.jsonl"
            quarantine = root / "raw-section-responses.truncated-tail"
            valid = json.dumps(capture_record()).encode()
            raw.write_bytes(valid + b"\n" + b'{"termId":"1269"')

            discovery.prepare_capture_for_append(raw, quarantine)

            self.assertEqual(raw.read_bytes(), valid + b"\n")
            self.assertIn(b'{"termId":"1269"', quarantine.read_bytes())
            self.assertEqual(
                discovery.completed_keys(raw),
                {("1269", "course-1")},
            )

    def test_valid_final_record_without_newline_is_repaired(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw-section-responses.jsonl"
            raw.write_text(json.dumps(capture_record()), encoding="utf-8")

            discovery.prepare_capture_for_append(raw, root / "quarantine")

            self.assertTrue(raw.read_bytes().endswith(b"\n"))
            self.assertEqual(len(list(discovery.iter_capture_records(raw))), 1)

    def test_invalid_middle_line_is_rejected_by_resume_and_inventory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw-section-responses.jsonl"
            raw.write_text(
                json.dumps(capture_record()) + "\nnot-json\n" + json.dumps(capture_record()) + "\n",
                encoding="utf-8",
            )

            with self.assertRaises(discovery.CaptureIntegrityError):
                discovery.prepare_capture_for_append(raw, root / "quarantine")
            with self.assertRaises(discovery.CaptureIntegrityError):
                discovery.completed_keys(raw)
            with self.assertRaises(discovery.CaptureIntegrityError):
                discovery.build_inventory(raw, root / "inventory.json")

    def test_duplicate_stored_key_is_rejected_everywhere(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw-section-responses.jsonl"
            line = json.dumps(capture_record()) + "\n"
            raw.write_text(line + line, encoding="utf-8")

            for operation in (
                lambda: discovery.prepare_capture_for_append(
                    raw,
                    root / "quarantine",
                ),
                lambda: discovery.completed_keys(raw),
                lambda: discovery.build_inventory(raw, root / "inventory.json"),
            ):
                with self.subTest(operation=operation):
                    with self.assertRaisesRegex(
                        discovery.CaptureIntegrityError,
                        "duplicate capture key",
                    ):
                        operation()


class RetryAfterTests(unittest.TestCase):
    def test_delta_seconds_and_http_date_are_bounded(self) -> None:
        now = datetime(2026, 11, 9, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(
            discovery.retry_after_seconds("12", now=now, fallback=1),
            12,
        )
        self.assertEqual(
            discovery.retry_after_seconds(
                "Sun, 09 Nov 2026 12:00:20 GMT",
                now=now,
                fallback=1,
            ),
            20,
        )
        self.assertEqual(
            discovery.retry_after_seconds("120", now=now, fallback=1),
            discovery.MAX_RETRY_DELAY_SECONDS,
        )
        self.assertEqual(
            discovery.retry_after_seconds("not-a-date", now=now, fallback=3),
            3,
        )


class CliTests(unittest.TestCase):
    def test_repeatable_term_ids_are_deduplicated_in_stable_order(self) -> None:
        argv = [
            str(SCRIPT),
            "--output-dir",
            "/tmp/discovery-test",
            "--term-id",
            "1269",
            "--term-id",
            "1268",
            "--term-id",
            "1269",
        ]
        with mock.patch.object(sys, "argv", argv):
            args = discovery.parse_args()

        self.assertEqual(
            discovery.stable_unique(args.term_id),
            ["1269", "1268"],
        )


if __name__ == "__main__":
    unittest.main()
