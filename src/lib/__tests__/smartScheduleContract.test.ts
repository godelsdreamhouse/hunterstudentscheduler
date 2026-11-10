import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParserPayload } from "../schedulePayload";
import {
	buildScheduleRequest,
	classifyScheduleApiResponse,
	toScheduleImportPlan,
} from "../smartScheduleContract";
import {
	PLANNER_STORAGE_KEY,
	createPlannerSchedule,
	importGeneratedSchedules,
	readPlannerSchedules,
	writePlannerSchedules,
} from "../plannerSchedules";
import {
	PREFERENCES_STORAGE_KEY,
	readStoredPreferencesForScheduling,
} from "../../app/hooks/usePersistedPreferences";

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

function validRequestInput(rawMajor = "Computer Science B.S.") {
	return {
		parserPayload: parserPayload(rawMajor),
		planningSessionId: 90210,
		semester: "spring-2027",
		creditRange: [12, 15],
		blockedTimes: {},
		preferences: basePreferences,
		electiveCourses: [],
		specificCourses: [],
		preferredDepartments: [],
	};
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));

describe("Smart Scheduler request contract", () => {
	it.each(majorFixtures)(
		"normalizes $rawMajor and preserves realistic five-digit course identifiers",
		({ rawMajor, expectedMajor, course }) => {
			const [subject, catalog] = course.split(" ");
			const result = buildScheduleRequest({
				...validRequestInput(rawMajor),
				specificCourses: [{ code: course }],
				preferredDepartments: [subject],
			});
			expect(result.kind).toBe("success");
			if (result.kind === "error") throw new Error(result.message);
			const request = result.request;

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
		const result = buildScheduleRequest({
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
		expect(result.kind).toBe("success");
		if (result.kind === "error") throw new Error(result.message);
		const request = result.request;

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

	it("sends only allowlisted academic fields from untrusted browser storage", () => {
		const storedPayload = {
			...parserPayload(),
			student_name: "Jane Student",
			emplid: "12345678",
			classes_taken: [{
				subject_area: "ENGL",
				catalog_number: 12000,
				grade: "A",
			}],
			requirements_needed: [{
				name: "Major requirement",
				attribute: "Major",
				credits_needed: 3,
				private_note: "advisor-only",
				fulfilled_by: [{
					subject_area: "CSCI",
					catalog_number: 12700,
					student_marker: true,
				}],
			}],
		};

		const result = buildScheduleRequest({
			...validRequestInput(),
			parserPayload: storedPayload,
		});

		expect(result.kind).toBe("success");
		if (result.kind === "error") throw new Error(result.message);
		expect(result.request.parser_payload).toEqual(parserPayload("CS"));
		expect(JSON.stringify(result.request)).not.toContain("Jane Student");
		expect(JSON.stringify(result.request)).not.toContain("12345678");
		expect(JSON.stringify(result.request)).not.toContain("advisor-only");
	});

	it.each([
		["null input", null],
		["null parser payload", { ...validRequestInput(), parserPayload: null }],
		["malformed nested parser payload", {
			...validRequestInput(),
			parserPayload: { ...parserPayload(), requirements_needed: null },
		}],
		["null preferences", { ...validRequestInput(), preferences: null }],
		["null nested blocked-time list", {
			...validRequestInput(),
			blockedTimes: { Monday: null },
		}],
		["malformed nested blocked time", {
			...validRequestInput(),
			blockedTimes: { Monday: ["tomorrow morning"] },
		}],
		["zero credit range", { ...validRequestInput(), creditRange: [0, 0] }],
		["credit range above the product maximum", {
			...validRequestInput(),
			creditRange: [12, 999],
		}],
		["non-half-credit increments", {
			...validRequestInput(),
			creditRange: [12.1, 16.3],
		}],
		["extra credit range entry", {
			...validRequestInput(),
			creditRange: [12, 16, 18],
		}],
	])("returns a recoverable error for %s before fetch", (_label, input) => {
		expect(buildScheduleRequest(input)).toEqual({
			kind: "error",
			message: "Your saved audit or schedule preferences are incomplete or invalid. Review them and try again.",
		});
	});

	it.each(["Biology B.S.", "", "not a real major"])(
		"rejects unsupported or corrupt major %j before fetch",
		(rawMajor) => {
			expect(buildScheduleRequest(validRequestInput(rawMajor))).toEqual({
				kind: "error",
				message: "Your saved audit or schedule preferences are incomplete or invalid. Review them and try again.",
			});
		},
	);

	it("keeps missing, malformed, and partial stored preferences invalid", () => {
		expect(readStoredPreferencesForScheduling()).toBeNull();

		localStorage.setItem(PREFERENCES_STORAGE_KEY, "not-json");
		expect(readStoredPreferencesForScheduling()).toBeNull();

		localStorage.setItem(
			PREFERENCES_STORAGE_KEY,
			JSON.stringify({ semester: "spring-2027" }),
		);
		const partial = readStoredPreferencesForScheduling();
		expect(buildScheduleRequest({
			parserPayload: parserPayload(),
			planningSessionId: 90210,
			semester: partial?.semester,
			creditRange: partial?.creditRange,
			blockedTimes: partial?.blockedTimes,
			preferences: partial?.preferences,
			electiveCourses: partial?.electiveCourses,
			specificCourses: partial?.specificCoursesList,
			preferredDepartments: partial?.preferredDepartments,
		})).toMatchObject({ kind: "error" });
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

	it("falls back to the validated top-level schedule when options are empty", () => {
		const response = successResponse();
		response.schedules = [];

		const result = classifyScheduleApiResponse(200, response);

		expect(result.kind).toBe("success");
		if (result.kind === "success") {
			expect(result.options).toHaveLength(1);
			expect(result.options[0].sections[0].class_num).toBe(43210);
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

	it("sanitizes FastAPI detail validation messages", () => {
		const result = classifyScheduleApiResponse(422, {
			detail: [
				{ loc: ["body", "term_year"], msg: "Input should be a valid integer", type: "int_parsing" },
				{ loc: ["body", "parser_payload"], msg: "Field required", type: "missing" },
			],
		});

		expect(result).toEqual({
			kind: "error",
			message: "The scheduler could not use your saved setup. Review your audit and preferences and try again.",
		});
	});

	it("does not display unknown service or scheduler error text", () => {
		expect(classifyScheduleApiResponse(500, {
			error_message: "student 12345678 database connection details",
		})).toEqual({
			kind: "error",
			message: "The scheduler is temporarily unavailable. Please try again.",
		});
		expect(classifyScheduleApiResponse(200, {
			...successResponse(),
			error_code: "UNKNOWN_INTERNAL_FAILURE",
			error_message: "secret traceback",
		})).toEqual({
			kind: "error",
			message: "No schedule could be generated. Review your preferences and try again.",
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
		["unknown instruction modality", {
			...successResponse(),
			schedules: [option(validSection({ instruction_modality: "TELEPATHIC" }))],
		}],
		["unknown academic career", {
			...successResponse(),
			schedules: [option(validSection({
				course: { ...validSection().course, academic_career: "ALIEN" },
			}))],
		}],
		["unknown meeting day", {
			...successResponse(),
			schedules: [option(validSection({ meetings: [{ day: "FUNDAY", start_time: 600, end_time: 675 }] }))],
		}],
		["negative meeting time", {
			...successResponse(),
			schedules: [option(validSection({ meetings: [{ day: "MONDAY", start_time: -1, end_time: 675 }] }))],
		}],
		["meeting past the day boundary", {
			...successResponse(),
			schedules: [option(validSection({ meetings: [{ day: "MONDAY", start_time: 1380, end_time: 1500 }] }))],
		}],
		["zero-duration meeting", {
			...successResponse(),
			schedules: [option(validSection({ meetings: [{ day: "MONDAY", start_time: 600, end_time: 600 }] }))],
		}],
	])("rejects %s before it can be imported", (_label, response) => {
		const result = classifyScheduleApiResponse(200, response);
		expect(result).toMatchObject({ kind: "error" });
	});

	it("imports every validated option after an existing manual schedule", () => {
		const manual = createPlannerSchedule(
			{ term_season: "SPRING", term_year: 2027 },
			"My manual schedule",
			{ source: "manual" },
		);
		writePlannerSchedules({ activeId: manual.id, schedules: [manual] });
		const response = successResponse();
		response.schedules = [
			option(validSection(), 7),
			option(validSection({ class_num: 54321, section_code: "02B" }), 11),
		];
		const plan = toScheduleImportPlan(
			classifyScheduleApiResponse(200, response),
			{ term_season: "SPRING", term_year: 2027 },
		);
		expect(plan).not.toBeNull();
		if (!plan) throw new Error("Expected a validated import plan");

		importGeneratedSchedules(plan.options, plan.term);

		const stored = readPlannerSchedules();
		expect(stored.schedules).toHaveLength(3);
		expect(stored.schedules[0]).toEqual(manual);
		expect(stored.schedules.slice(1).map((schedule) => schedule.name)).toEqual([
			"Smart Option 1",
			"Smart Option 2",
		]);
	});

	it("never calls the importer or mutates storage for a classified failure", () => {
		const manual = createPlannerSchedule(
			{ term_season: "SPRING", term_year: 2027 },
			"My manual schedule",
			{ source: "manual" },
		);
		writePlannerSchedules({ activeId: manual.id, schedules: [manual] });
		const before = localStorage.getItem(PLANNER_STORAGE_KEY);
		const importer = vi.fn(importGeneratedSchedules);

		const result = classifyScheduleApiResponse(200, {
			...successResponse(),
			schedules: [option(validSection({ meetings: null }))],
		});
		const plan = toScheduleImportPlan(result, { term_season: "SPRING", term_year: 2027 });
		if (plan) importer(plan.options, plan.term);

		expect(result.kind).toBe("error");
		expect(plan).toBeNull();
		expect(importer).not.toHaveBeenCalled();
		expect(localStorage.getItem(PLANNER_STORAGE_KEY)).toBe(before);
		expect(readPlannerSchedules()).toEqual({ activeId: manual.id, schedules: [manual] });
	});
});
