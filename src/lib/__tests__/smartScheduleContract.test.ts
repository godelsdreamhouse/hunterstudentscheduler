import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParserPayload } from "../schedulePayload";
import {
	buildScheduleRequest,
	classifyScheduleApiResponse,
} from "../smartScheduleContract";
import {
	PLANNER_STORAGE_KEY,
	createPlannerSchedule,
	readPlannerSchedules,
	writePlannerSchedules,
} from "../plannerSchedules";

class MemoryStorage {
	private values = new Map<string, string>();
	getItem(key: string) { return this.values.get(key) ?? null; }
	setItem(key: string, value: string) { this.values.set(key, value); }
	removeItem(key: string) { this.values.delete(key); }
	clear() { this.values.clear(); }
	key(index: number) { return [...this.values.keys()][index] ?? null; }
	get length() { return this.values.size; }
}

const basePreferences = {
	backToBack: true,
	morningClasses: false,
	midDayClasses: true,
	eveningClasses: false,
	minimizeDays: true,
	preferInPerson: true,
	preferRemote: false,
};

const majorFixtures: Array<{ rawMajor: string; expectedMajor: string; course: string }> = [
	{ rawMajor: "Computer Science B.S.", expectedMajor: "CS", course: "CSCI 12700" },
	{ rawMajor: "Mathematics B.A.", expectedMajor: "MATH", course: "MATH 15000" },
	{ rawMajor: "Political Science B.A.", expectedMajor: "POLISCI", course: "POLSC 11000" },
];

function parserPayload(rawMajor = "Computer Science B.S."): ParserPayload {
	return {
		majors: [rawMajor],
		classes_taken: [{ subject_area: "ENGL", catalog_number: 12000 }],
		requirements_needed: [{
			name: "Major requirement",
			attribute: "Major",
			credits_needed: 3,
			fulfilled_by: [{ subject_area: "CSCI", catalog_number: 12700 }],
		}],
		major_elective_credits: 0,
		general_elective_credits: 0,
	};
}

function validSection(overrides: Record<string, unknown> = {}) {
	return {
		class_num: 43210,
		section_code: "01A",
		instruction_modality: "INPERSON",
		instructor: "Ada Lovelace",
		enrollment_total: 18,
		class_capacity: 25,
		major_elective: false,
		attributes: ["WRIC"],
		course: {
			subject_area: "CSCI",
			catalog_number: 12700,
			course_title: "Introduction to Computer Science",
			department: "Computer Science",
			academic_career: "UNDERGRADUATE",
			credits: 3,
			description: "Programming fundamentals.",
			// Catalog/scheduler metadata only; it is not a degree-allocation claim.
			tags: ["CS major candidate"],
			prereqs: [{ subject_area: "MATH", catalog_number: 10100 }],
		},
		meetings: [{ day: "MONDAY", start_time: 600, end_time: 675 }],
		...overrides,
	};
}

function option(section = validSection(), score = 7) {
	return {
		score,
		credits: 3,
		sections: [section],
		optimization_codes: ["OPT_MINIMIZE_DAYS_ACTIVE"],
		optimization_details: { days: 1 },
	};
}

function successResponse() {
	const first = option();
	return {
		...first,
		error_code: null,
		error_message: null,
		error_details: {},
		schedules: [first],
	};
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));

describe("Smart Scheduler request contract", () => {
	it.each(majorFixtures)(
		"normalizes $rawMajor and preserves realistic five-digit course identifiers",
		({ rawMajor, expectedMajor, course }) => {
			const [subject, catalog] = course.split(" ");
			const request = buildScheduleRequest({
				parserPayload: parserPayload(rawMajor),
				planningSessionId: 90210,
				semester: "spring-2027",
				creditRange: [12, 15],
				blockedTimes: {},
				preferences: basePreferences,
				electiveCourses: [],
				specificCourses: [{ code: course }],
				preferredDepartments: [subject],
			});

			expect(request.parser_payload.majors).toEqual([expectedMajor]);
			expect(request.parser_payload.classes_taken[0].catalog_number).toBe(12000);
			expect(request.ui_payload.specific_courses).toEqual([
				{ subject_area: subject, catalog_number: Number(catalog) },
			]);
			expect(request.term_season).toBe("SPRING");
			expect(request.term_year).toBe(2027);
		},
	);

	it("serializes blocked times and pinned-course preferences without weakening them", () => {
		const request = buildScheduleRequest({
			parserPayload: parserPayload(),
			planningSessionId: 13579,
			semester: "fall-2027",
			creditRange: [9, 12],
			blockedTimes: { Monday: ["9:00 AM", "10:00 AM"], Friday: ["2:00 PM"] },
			preferences: basePreferences,
			electiveCourses: [{ code: "CSCI 49900" }],
			specificCourses: [{ code: "MATH 15000" }],
			preferredDepartments: ["CSCI", "MATH"],
		});

		expect(request.ui_payload).toMatchObject({
			emplid: 13579,
			credit_lower_bound: 9,
			credit_upper_bound: 12,
			less_gaps: true,
			less_days: true,
			in_person: true,
			major_electives_needed: [{ subject_area: "CSCI", catalog_number: 49900 }],
			specific_courses: [{ subject_area: "MATH", catalog_number: 15000 }],
			departmental: ["CSCI", "MATH"],
		});
		expect(request.ui_payload.unavailable).toEqual([
			{ day: "MONDAY", start_time: 540, end_time: 600 },
			{ day: "MONDAY", start_time: 600, end_time: 660 },
			{ day: "FRIDAY", start_time: 840, end_time: 900 },
		]);
	});
});

describe("Smart Scheduler response contract", () => {
	it("accepts and returns every independently validated schedule option", () => {
		const response = successResponse();
		response.schedules = [
			option(validSection(), 7),
			option(validSection({ class_num: 54321, section_code: "02B" }), 11),
		];

		const result = classifyScheduleApiResponse(200, response);

		expect(result.kind).toBe("success");
		if (result.kind === "success") {
			expect(result.options).toHaveLength(2);
			expect(result.options.map((item) => item.sections[0].class_num)).toEqual([43210, 54321]);
		}
	});

	it("preserves raw course tags strictly as response metadata", () => {
		const response = successResponse();
		response.schedules[0].sections[0].course.tags = ["Pluralism C", "Major candidate"];
		response.sections[0].course.tags = ["Pluralism C", "Major candidate"];

		const result = classifyScheduleApiResponse(200, response);

		expect(result.kind).toBe("success");
		if (result.kind === "success") {
			expect(result.options[0].sections[0].course.tags).toEqual([
				"Pluralism C",
				"Major candidate",
			]);
			expect(result.options[0].sections[0].course).not.toHaveProperty("fulfilled_requirement");
		}
	});

	it("classifies a scheduler-coded error even when HTTP status is successful", () => {
		const result = classifyScheduleApiResponse(200, {
			score: 0,
			credits: 0,
			sections: [],
			error_code: "ALL_CANDIDATES_IN_BLOCKED_TIME",
			error_message: "raw internal wording",
			error_details: {},
			optimization_codes: [],
			optimization_details: {},
		});

		expect(result).toEqual({
			kind: "error",
			message: "All matching classes conflict with your unavailable time settings.",
		});
	});

	it("surfaces FastAPI detail validation messages", () => {
		const result = classifyScheduleApiResponse(422, {
			detail: [
				{ loc: ["body", "term_year"], msg: "Input should be a valid integer", type: "int_parsing" },
				{ loc: ["body", "parser_payload"], msg: "Field required", type: "missing" },
			],
		});

		expect(result).toEqual({
			kind: "error",
			message: "Input should be a valid integer; Field required",
		});
	});

	it.each([
		["empty top-level sections", { ...successResponse(), sections: [] }],
		["empty nested option", { ...successResponse(), schedules: [{ ...option(), sections: [] }] }],
		["malformed nested course", {
			...successResponse(),
			schedules: [option(validSection({ course: { subject_area: "CSCI" } }))],
		}],
		["malformed nested meeting", {
			...successResponse(),
			schedules: [option(validSection({ meetings: [{ day: "MONDAY", start_time: "10:00", end_time: 675 }] }))],
		}],
	])("rejects %s before it can be imported", (_label, response) => {
		const result = classifyScheduleApiResponse(200, response);
		expect(result).toMatchObject({ kind: "error" });
	});

	it("does not mutate existing manual schedules when validation fails", () => {
		const manual = createPlannerSchedule(
			{ term_season: "SPRING", term_year: 2027 },
			"My manual schedule",
			{ source: "manual" },
		);
		writePlannerSchedules({ activeId: manual.id, schedules: [manual] });
		const before = localStorage.getItem(PLANNER_STORAGE_KEY);

		const result = classifyScheduleApiResponse(200, {
			...successResponse(),
			schedules: [option(validSection({ meetings: null }))],
		});

		expect(result.kind).toBe("error");
		expect(localStorage.getItem(PLANNER_STORAGE_KEY)).toBe(before);
		expect(readPlannerSchedules()).toEqual({ activeId: manual.id, schedules: [manual] });
	});
});
