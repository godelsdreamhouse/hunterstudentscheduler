
export interface CourseIdPayload {
  subject_area: string;
  catalog_number: number;
}

export interface RequirementPayload {
  name: string;
  attribute: string;
  credits_needed: number;
  fulfilled_by: CourseIdPayload[];
}

export interface ParserPayload {
  majors: string[];
  classes_taken: CourseIdPayload[];
  requirements_needed: RequirementPayload[];
  major_elective_credits: number;
  general_elective_credits: number;
}

export interface MeetingPayload {
  day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  start_time: number;
  end_time: number;
}

export interface UiPayload {
  emplid: number;
  credit_lower_bound: number;
  credit_upper_bound: number;
  unavailable: MeetingPayload[];
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  less_gaps: boolean;
  less_days: boolean;
  in_person: boolean;
  remote: boolean;
  major_electives_needed: CourseIdPayload[];
  general_electives_needed: CourseIdPayload[];
  specific_courses: CourseIdPayload[];
  departmental: string[];
}

export interface ScheduleRequest {
  parser_payload: ParserPayload;
  ui_payload: UiPayload;
  term_season: "FALL" | "SPRING" | "SUMMER" | "WINTER";
  term_year: number;
}

export interface SectionMeeting {
  day: string;
  start_time: number;
  end_time: number;
}

export interface SectionCourse {
  subject_area: string;
  catalog_number: number;
  course_title: string;
  department: string;
  academic_career: string;
  credits: number;
  description: string;
  tags: string[];
  prereqs: CourseIdPayload[];
}

export interface ScheduleSection {
  class_num: number;
  section_code: string;
  instruction_modality: string;
  instructor: string;
  enrollment_total: number;
  class_capacity: number;
  major_elective: boolean;
  attributes: string[];
  course: SectionCourse;
  meetings: SectionMeeting[];
}

export interface ScheduleResponse {
  score: number;
  credits: number;
  sections: ScheduleSection[];
  error_code: string | null;
  error_message: string | null;
  error_details: Record<string, unknown>;
  optimization_codes: string[];
  optimization_details: Record<string, unknown>;
}

// strip degree suffixes so parser majors match scheduler major codes
const MAJOR_CODE_MAP: Record<string, string> = {
  "computer science": "CS",
  "mathematics": "MATH",
  "political science": "POLISCI",
};

/**
 * Converts a parser-provided major name into the scheduler's supported major
 * identifier.
 *
 * @param name - Major name parsed from the DegreeWorks audit.
 * @returns A scheduler-compatible major code when a mapping exists, or the
 * cleaned major name when no mapping is defined.
 */
export function normalizeMajorName(name: string): string {
  const stripped = name
    .replace(/^[A-Z]+-/, "")
    .replace(/\s+(B\.A\.|B\.S\.|B\.F\.A\.|B\.E\.|M\.A\.|M\.S\.|Ph\.D\.)\s*$/i, "")
    .replace(/\s+(Major|Minor|Program|Concentration|Track)\s*$/i, "")
    .trim();
  return MAJOR_CODE_MAP[stripped.toLowerCase()] ?? stripped;
}

function parseCourseId(courseCode: string): CourseIdPayload | null {
  const match = (courseCode ?? "").trim().match(/^([A-Z]+)\s+(\d+)$/);
  if (!match) return null;
  return { subject_area: match[1], catalog_number: parseInt(match[2], 10) };
}

function parseParserCourse(course: any): CourseIdPayload | null {
  // convert parser course objects into the scheduler course id shape
  const code = `${course?.departmentCode ?? ""} ${(course?.courseID ?? "").replace("@", "")}`.trim();
  return parseCourseId(code);
}

function collectCompleted(block: any): CourseIdPayload[] {
  const results: CourseIdPayload[] = [];
  for (const req of (block?.Completed ?? [])) {
    for (const course of (req.courses ?? [])) {
      if (course.grade) {
        const id = parseParserCourse(course);
        if (id) results.push(id);
      }
    }
  }
  return results;
}

function collectRequirements(block: any, attribute: string): RequirementPayload[] {
  return (block?.["Still Needed"] ?? []).map((req: any) => ({
    name: req.name ?? "",
    attribute,
    credits_needed: req.credits ?? 0,
    fulfilled_by: (req.courses ?? [])
      .map(parseParserCourse)
      .filter(Boolean) as CourseIdPayload[],
  }));
}

/**
 * Converts the parser response into the normalized academic payload expected
 * by the scheduler API.
 *
 * @param data - Raw response returned by the DegreeWorks audit parser.
 * @returns Completed classes, remaining requirements, normalized majors, and
 * elective-credit values in scheduler request format.
 */
export function buildParserPayload(data: any): ParserPayload {
  const takenMap = new Map<string, CourseIdPayload>();
  const addCourse = (id: CourseIdPayload) => takenMap.set(`${id.subject_area}-${id.catalog_number}`, id);

  // support the parser's flat completed and still needed response shape
  if (Array.isArray(data?.Completed) || Array.isArray(data?.["Still Needed"])) {
    for (const req of (data.Completed ?? [])) {
      for (const course of (req.courses ?? [])) {
        if (course.grade) {
          const id = parseParserCourse(course);
          if (id) addCourse(id);
        }
      }
    }

    const requirementsNeeded = (data["Still Needed"] ?? []).map((req: any) => ({
      name: req.name ?? "",
      attribute: req.tag ?? "",
      credits_needed: req.credits ?? 0,
      fulfilled_by: (req.courses ?? []).map(parseParserCourse).filter(Boolean) as CourseIdPayload[],
    }));

    return {
      majors: (data.Major ?? []).map(normalizeMajorName),
      classes_taken: Array.from(takenMap.values()),
      requirements_needed: requirementsNeeded,
      major_elective_credits: 0,
      general_elective_credits: 0,
    };
  }

  for (const section of ["CUNY Core", "Hunter Focus", "Writing Requirement"]) {
    collectCompleted(data[section]).forEach(addCourse);
  }

  for (const majorName of (data.Major ?? [])) {
    const majorData = data[majorName];
    if (!majorData) continue;
    for (const [key, val] of Object.entries(majorData)) {
      if (key === "Major Credits") continue;
      for (const req of ((val as any).taken ?? [])) {
        for (const course of (req.courses ?? [])) {
          if (course.grade) {
            const id = parseParserCourse(course) ?? parseCourseId(course.courseID ?? "");
            if (id) addCourse(id);
          }
        }
      }
    }
  }

  const requirementsNeeded: RequirementPayload[] = [
    ...collectRequirements(data["CUNY Core"], "CUNY Core"),
    ...collectRequirements(data["Hunter Focus"], "Hunter Focus"),
    ...collectRequirements(data["Writing Requirement"], "Writing Requirement"),
  ];

  for (const majorName of (data.Major ?? [])) {
    const majorData = data[majorName];
    if (!majorData) continue;
    for (const [key, val] of Object.entries(majorData)) {
      if (key === "Major Credits") continue;
      for (const name of ((val as any)["Still Needed"] ?? [])) {
        requirementsNeeded.push({
          name: String(name),
          attribute: `${majorName} - ${key}`,
          credits_needed: 0,
          fulfilled_by: [],
        });
      }
    }
  }

  return {
    majors: (data.Major ?? []).map(normalizeMajorName),
    classes_taken: Array.from(takenMap.values()),
    requirements_needed: requirementsNeeded,
    major_elective_credits: 0,
    general_elective_credits: 0,
  };
}

const DAY_MAP: Record<string, MeetingPayload["day"]> = {
  Monday: "MONDAY",
  Tuesday: "TUESDAY",
  Wednesday: "WEDNESDAY",
  Thursday: "THURSDAY",
  Friday: "FRIDAY",
  Saturday: "SATURDAY",
  Sunday: "SUNDAY",
};

/**
 * Converts a human-readable hourly time slot into minutes after midnight.
 *
 * @param slot - Time string such as `"2:00 PM"`.
 * @returns Minutes after midnight, or `0` when the time cannot be parsed.
 */
export function timeSlotToMinutes(slot: string): number {
  const match = slot.match(/^(\d+):(\d+)\s+(AM|PM)$/);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  if (match[3] === "PM" && hours !== 12) hours += 12;
  if (match[3] === "AM" && hours === 12) hours = 0;
  return hours * 60 + mins;
}

/**
 * Creates the preference portion of a schedule-generation request from saved
 * UI state.
 *
 * @param emplid - Authenticated student's EMPLID.
 * @param creditRange - Minimum and maximum desired credits.
 * @param blockedTimes - Weekly unavailable time slots.
 * @param preferences - Time-of-day and instruction-format preferences.
 * @param majorElectives - Selected major elective courses.
 * @param specificCourses - Courses the student explicitly requested.
 * @param departmental - Preferred academic departments.
 * @returns Scheduler-ready preference data.
 */
export function buildUiPayload(
  emplid: number,
  creditRange: number[],
  blockedTimes: Record<string, string[] | Set<string>>,
  preferences: {
    backToBack: boolean;
    morningClasses: boolean;
    midDayClasses: boolean;
    eveningClasses: boolean;
    minimizeDays: boolean;
    preferInPerson: boolean;
    preferRemote: boolean;
  },
  majorElectives: Array<{ code: string }>,
  specificCourses: Array<{ code: string }>,
  departmental: string[],
): UiPayload {
  const unavailable: MeetingPayload[] = [];
  for (const [day, slots] of Object.entries(blockedTimes)) {
    const dayKey = DAY_MAP[day];
    if (!dayKey) continue;
    const slotArr = slots instanceof Set ? [...slots] : slots;
    for (const slot of slotArr) {
      const start = timeSlotToMinutes(slot);
      unavailable.push({ day: dayKey, start_time: start, end_time: start + 60 });
    }
  }

  const toCourseIds = (arr: Array<{ code: string }> | null | undefined) =>
    (arr ?? []).map((e) => parseCourseId(e.code)).filter(Boolean) as CourseIdPayload[];

  return {
    emplid,
    credit_lower_bound: creditRange[0] ?? 12,
    credit_upper_bound: creditRange[1] ?? 16,
    unavailable,
    morning: preferences.morningClasses,
    afternoon: preferences.midDayClasses,
    evening: preferences.eveningClasses,
    less_gaps: preferences.backToBack,
    less_days: preferences.minimizeDays,
    in_person: preferences.preferInPerson,
    remote: preferences.preferRemote,
    major_electives_needed: toCourseIds(majorElectives),
    general_electives_needed: [],
    specific_courses: toCourseIds(specificCourses),
    departmental,
  };
}

/**
 * Parses a selected semester into the term representation required by the
 * scheduler API.
 *
 * @param semester - Stored semester value such as `"fall-2026"`.
 * @returns Uppercase term season and numeric year.
 */
export function parseSemester(semester: string): { season: ScheduleRequest["term_season"]; year: number } {
  const [seasonRaw, yearStr] = semester.split("-");
  const year = parseInt(yearStr, 10);
  const seasonMap: Record<string, ScheduleRequest["term_season"]> = {
    fall: "FALL", spring: "SPRING", summer: "SUMMER", winter: "WINTER",
  };
  return { season: seasonMap[seasonRaw] ?? "FALL", year: isNaN(year) ? new Date().getFullYear() : year };
}

/**
 * Formats minutes after midnight for schedule display.
 *
 * @param minutes - Number of minutes after midnight.
 * @returns A 12-hour time label such as `"2:30 PM"`.
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${mins.toString().padStart(2, "0")} ${ampm}`;
}
