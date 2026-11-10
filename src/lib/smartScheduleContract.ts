import {
	buildUiPayload,
	normalizeMajorName,
	parseSemester,
	type ParserPayload,
	type ScheduleOption,
	type ScheduleRequest,
	type ScheduleResponse,
} from "./schedulePayload";
import { validateCreditRange } from "./creditRange";

const SCHEDULER_ERROR_MESSAGES: Record<string, string> = {
	NO_CANDIDATE_SECTIONS:
		"No matching classes were found for your current requirements and term.",
	ALL_CANDIDATES_FAIL_PREREQS:
		"We found classes, but prerequisites are not satisfied for all of them.",
	ALL_CANDIDATES_IN_BLOCKED_TIME:
		"All matching classes conflict with your unavailable time settings.",
	NO_ELIGIBLE_CANDIDATES:
		"No classes remain after applying your eligibility and time filters.",
	UNSAT_HARD_CONSTRAINTS:
		"No valid schedule satisfies all required constraints. Try relaxing filters.",
	NO_CANDIDATES_FOUND:
		"No candidate sections were found for the requested schedule.",
	UNSATISFIABLE_CONSTRAINTS:
		"The requested schedule constraints cannot be satisfied.",
	DATABASE_CONNECTION_FAILED:
		"The scheduler could not connect to its database. Please try again shortly.",
	INVALID_PAYLOAD:
		"The schedule request was malformed. Please re-upload your audit and try again.",
	SOLVER_FAILED:
		"The scheduler encountered an internal error. Please try again.",
	SOLVER_TIMEOUT:
		"Schedule generation took too long. Try relaxing your constraints or removing a pinned course.",
	SPECIFIC_COURSE_NO_ELIGIBLE_SECTIONS:
		"One or more pinned courses has no eligible sections for this term.",
};

type UiPayloadArguments = Parameters<typeof buildUiPayload>;

const REQUEST_ERROR_MESSAGE =
	"Your saved audit or schedule preferences are incomplete or invalid. Review them and try again.";
const VALID_DAYS = new Set([
	"MONDAY",
	"TUESDAY",
	"WEDNESDAY",
	"THURSDAY",
	"FRIDAY",
	"SATURDAY",
	"SUNDAY",
]);
const VALID_MODALITIES = new Set([
	"INPERSON",
	"HYBRID",
	"REMOTE",
	"ASYNCHRONOUS",
]);
const VALID_ACADEMIC_CAREERS = new Set(["UNDERGRADUATE", "GRADUATE"]);
const SUPPORTED_MAJOR_CODES = new Set(["CS", "MATH", "POLISCI"]);
const STORED_DAYS = new Set([
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
]);

export interface ScheduleRequestInput {
	parserPayload: ParserPayload;
	planningSessionId: number;
	semester: string;
	creditRange: UiPayloadArguments[1];
	blockedTimes: UiPayloadArguments[2];
	preferences: UiPayloadArguments[3];
	electiveCourses: UiPayloadArguments[4];
	specificCourses: UiPayloadArguments[5];
	preferredDepartments: UiPayloadArguments[6];
}

export type ScheduleApiResult =
	| {
		kind: "success";
		response: ScheduleResponse;
		options: ScheduleOption[];
	}
	| { kind: "error"; message: string };

export type ScheduleRequestResult =
	| { kind: "success"; request: ScheduleRequest }
	| { kind: "error"; message: string };

export interface ScheduleImportPlan {
	options: ScheduleOption[];
	term: Pick<ScheduleRequest, "term_season" | "term_year">;
}

/** Build a request only after validating both browser-local setup records. */
export function buildScheduleRequest(input: unknown): ScheduleRequestResult {
	if (!isScheduleRequestInput(input)) {
		return { kind: "error", message: REQUEST_ERROR_MESSAGE };
	}
	const { season, year } = parseSemester(input.semester);
	return { kind: "success", request: {
		parser_payload: {
			...input.parserPayload,
			majors: input.parserPayload.majors.map(normalizeMajorName),
		},
		ui_payload: buildUiPayload(
			input.planningSessionId,
			input.creditRange,
			input.blockedTimes,
			input.preferences,
			input.electiveCourses,
			input.specificCourses,
			input.preferredDepartments,
		),
		term_season: season,
		term_year: year,
	} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
	return isFiniteNumber(value) && Number.isInteger(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCourseId(value: unknown): value is { subject_area: string; catalog_number: number } {
	return isRecord(value) &&
		typeof value.subject_area === "string" &&
		value.subject_area.length > 0 &&
		isInteger(value.catalog_number) &&
		value.catalog_number >= 0;
}

function isRequirement(value: unknown): boolean {
	return isRecord(value) &&
		typeof value.name === "string" &&
		typeof value.attribute === "string" &&
		isFiniteNumber(value.credits_needed) &&
		value.credits_needed >= 0 &&
		Array.isArray(value.fulfilled_by) &&
		value.fulfilled_by.every(isCourseId);
}

function isParserPayload(value: unknown): value is ParserPayload {
	return isRecord(value) &&
		isStringArray(value.majors) &&
		value.majors.length > 0 &&
		value.majors.every((major) =>
			major.trim().length > 0 && SUPPORTED_MAJOR_CODES.has(normalizeMajorName(major))
		) &&
		Array.isArray(value.classes_taken) &&
		value.classes_taken.every(isCourseId) &&
		Array.isArray(value.requirements_needed) &&
		value.requirements_needed.every(isRequirement) &&
		isFiniteNumber(value.major_elective_credits) &&
		value.major_elective_credits >= 0 &&
		isFiniteNumber(value.general_elective_credits) &&
		value.general_elective_credits >= 0;
}

function isPreferenceFlags(value: unknown): value is ScheduleRequestInput["preferences"] {
	if (!isRecord(value)) return false;
	return [
		"backToBack",
		"morningClasses",
		"midDayClasses",
		"eveningClasses",
		"minimizeDays",
		"preferInPerson",
		"preferRemote",
	].every((key) => typeof value[key] === "boolean");
}

function isCourseSelections(value: unknown): value is Array<{ code: string }> {
	return Array.isArray(value) && value.every((item) =>
		isRecord(item) &&
		typeof item.code === "string" &&
		/^[A-Z]+\s+\d+$/.test(item.code.trim()),
	);
}

function isBlockedTime(value: unknown): boolean {
	if (typeof value !== "string") return false;
	const match = value.match(/^(\d{1,2}):(\d{2})\s+(AM|PM)$/);
	if (!match) return false;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	return hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59;
}

function isBlockedTimes(value: unknown): value is ScheduleRequestInput["blockedTimes"] {
	if (!isRecord(value)) return false;
	return Object.entries(value).every(([day, slots]) => {
		if (!STORED_DAYS.has(day)) return false;
		const values = Array.isArray(slots)
			? slots
			: slots instanceof Set
				? [...slots]
				: null;
		return values !== null && values.every(isBlockedTime);
	});
}

function isScheduleRequestInput(value: unknown): value is ScheduleRequestInput {
	if (!isRecord(value)) return false;
	return isParserPayload(value.parserPayload) &&
		isInteger(value.planningSessionId) &&
		value.planningSessionId > 0 &&
		typeof value.semester === "string" &&
		/^(fall|spring|summer|winter)-\d{4}$/.test(value.semester) &&
		Array.isArray(value.creditRange) &&
		value.creditRange.length === 2 &&
		isFiniteNumber(value.creditRange[0]) &&
		isFiniteNumber(value.creditRange[1]) &&
		validateCreditRange(value.creditRange[0], value.creditRange[1]) === null &&
		isBlockedTimes(value.blockedTimes) &&
		isPreferenceFlags(value.preferences) &&
		isCourseSelections(value.electiveCourses) &&
		isCourseSelections(value.specificCourses) &&
		isStringArray(value.preferredDepartments);
}

function isMeeting(value: unknown): boolean {
	return isRecord(value) &&
		typeof value.day === "string" &&
		VALID_DAYS.has(value.day) &&
		isInteger(value.start_time) &&
		isInteger(value.end_time) &&
		value.start_time >= 0 &&
		value.end_time > value.start_time &&
		value.end_time <= 1440;
}

function isCourse(value: unknown): boolean {
	if (!isRecord(value)) return false;
	return typeof value.subject_area === "string" &&
		value.subject_area.length > 0 &&
		isInteger(value.catalog_number) &&
		value.catalog_number >= 0 &&
		typeof value.course_title === "string" &&
		typeof value.department === "string" &&
		typeof value.academic_career === "string" &&
		VALID_ACADEMIC_CAREERS.has(value.academic_career) &&
		isFiniteNumber(value.credits) &&
		value.credits >= 0 &&
		typeof value.description === "string" &&
		// Tags cross the seam as source metadata, not fulfilled-degree claims.
		isStringArray(value.tags) &&
		Array.isArray(value.prereqs) &&
		value.prereqs.every(isCourseId);
}

function isSection(value: unknown): boolean {
	if (!isRecord(value)) return false;
	return isInteger(value.class_num) &&
		value.class_num >= 0 &&
		typeof value.section_code === "string" &&
		typeof value.instruction_modality === "string" &&
		VALID_MODALITIES.has(value.instruction_modality) &&
		typeof value.instructor === "string" &&
		isInteger(value.enrollment_total) &&
		value.enrollment_total >= 0 &&
		isInteger(value.class_capacity) &&
		value.class_capacity >= 0 &&
		typeof value.major_elective === "boolean" &&
		isStringArray(value.attributes) &&
		isCourse(value.course) &&
		Array.isArray(value.meetings) &&
		value.meetings.every(isMeeting);
}

function isScheduleOption(value: unknown): value is ScheduleOption {
	if (!isRecord(value)) return false;
	return isFiniteNumber(value.score) &&
		isFiniteNumber(value.credits) &&
		value.credits >= 0 &&
		Array.isArray(value.sections) &&
		value.sections.length > 0 &&
		value.sections.every(isSection) &&
		isStringArray(value.optimization_codes) &&
		isRecord(value.optimization_details);
}

function isScheduleResponse(value: unknown): value is ScheduleResponse {
	if (!isRecord(value)) return false;
	return isScheduleOption(value) &&
		(value.error_code === null || typeof value.error_code === "string") &&
		(value.error_message === null || typeof value.error_message === "string") &&
		isRecord(value.error_details) &&
		(value.schedules === undefined || (
			Array.isArray(value.schedules) &&
			value.schedules.every(isScheduleOption)
		));
}

function schedulerErrorCode(data: unknown): string | undefined {
	if (!isRecord(data)) return undefined;
	const code = typeof data.error_code === "string" ? data.error_code : undefined;
	return code && SCHEDULER_ERROR_MESSAGES[code] ? code : undefined;
}

function safeServiceError(status: number, data: unknown): string {
	const code = schedulerErrorCode(data);
	if (code) return SCHEDULER_ERROR_MESSAGES[code];
	if (status === 422) {
		return "The scheduler could not use your saved setup. Review your audit and preferences and try again.";
	}
	if (status >= 500) {
		return "The scheduler is temporarily unavailable. Please try again.";
	}
	return "The scheduler could not complete this request. Review your preferences and try again.";
}

/**
 * Classify an already-decoded scheduler response before any planner-storage
 * mutation. A success is returned only after every importable nested option,
 * section, course, and meeting has been validated.
 */
export function classifyScheduleApiResponse(status: number, data: unknown): ScheduleApiResult {
	const statusOk = status >= 200 && status < 300;
	if (!statusOk) {
		return {
			kind: "error",
			message: safeServiceError(status, data),
		};
	}

	if (isRecord(data) && typeof data.error_code === "string" && data.error_code) {
		const code = schedulerErrorCode(data);
		return {
			kind: "error",
			message: code
				? SCHEDULER_ERROR_MESSAGES[code]
				: "No schedule could be generated. Review your preferences and try again.",
		};
	}

	if (!isScheduleResponse(data)) {
		return {
			kind: "error",
			message: "The scheduler returned an unusable schedule. Please try again.",
		};
	}

	return {
		kind: "success",
		response: data,
		options: data.schedules?.length ? data.schedules : [{
			score: data.score,
			credits: data.credits,
			sections: data.sections,
			optimization_codes: data.optimization_codes,
			optimization_details: data.optimization_details,
		}],
	};
}

/** Convert only a validated response into the arguments accepted by planner import. */
export function toScheduleImportPlan(
	result: Extract<ScheduleApiResult, { kind: "success" }>,
	term: Pick<ScheduleRequest, "term_season" | "term_year">,
): ScheduleImportPlan;
export function toScheduleImportPlan(
	result: ScheduleApiResult,
	term: Pick<ScheduleRequest, "term_season" | "term_year">,
): ScheduleImportPlan | null;
export function toScheduleImportPlan(
	result: ScheduleApiResult,
	term: Pick<ScheduleRequest, "term_season" | "term_year">,
): ScheduleImportPlan | null {
	if (result.kind === "error") return null;
	return { options: result.options, term };
}
