import {
	buildUiPayload,
	normalizeMajorName,
	parseSemester,
	type ParserPayload,
	type ScheduleOption,
	type ScheduleRequest,
	type ScheduleResponse,
} from "./schedulePayload";

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

/** Build the scheduler request from the two browser-local setup records. */
export function buildScheduleRequest(input: ScheduleRequestInput): ScheduleRequest {
	const { season, year } = parseSemester(input.semester);
	return {
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
	};
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

function isCourseId(value: unknown): boolean {
	return isRecord(value) &&
		typeof value.subject_area === "string" &&
		value.subject_area.length > 0 &&
		isInteger(value.catalog_number) &&
		value.catalog_number >= 0;
}

function isMeeting(value: unknown): boolean {
	return isRecord(value) &&
		typeof value.day === "string" &&
		value.day.length > 0 &&
		isInteger(value.start_time) &&
		isInteger(value.end_time) &&
		value.start_time >= 0 &&
		value.end_time > value.start_time;
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
			value.schedules.length > 0 &&
			value.schedules.every(isScheduleOption)
		));
}

function responseMessage(data: unknown): string | undefined {
	if (!isRecord(data)) return undefined;
	const code = typeof data.error_code === "string" ? data.error_code : undefined;
	if (code && SCHEDULER_ERROR_MESSAGES[code]) return SCHEDULER_ERROR_MESSAGES[code];
	if (typeof data.error_message === "string" && data.error_message) return data.error_message;

	if (typeof data.detail === "string") return data.detail;
	if (Array.isArray(data.detail)) {
		const details = data.detail.map((item) => {
			if (isRecord(item) && "msg" in item) return String(item.msg);
			return String(item);
		});
		if (details.length > 0) return details.join("; ");
	}

	const message = data.message ?? data.error;
	return typeof message === "string" && message ? message : undefined;
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
			message: responseMessage(data) ?? `Server returned ${status}`,
		};
	}

	if (isRecord(data) && typeof data.error_code === "string" && data.error_code) {
		return {
			kind: "error",
			message: responseMessage(data) ?? "No schedule could be generated.",
		};
	}

	if (!isScheduleResponse(data)) {
		return {
			kind: "error",
			message: responseMessage(data) ??
				"Schedule response had an unexpected shape. Check the scheduler logs for the matching request.",
		};
	}

	return {
		kind: "success",
		response: data,
		options: data.schedules ?? [{
			score: data.score,
			credits: data.credits,
			sections: data.sections,
			optimization_codes: data.optimization_codes,
			optimization_details: data.optimization_details,
		}],
	};
}
