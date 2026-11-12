import type { CatalogMeeting, CatalogSection, CatalogTerm, TermSeason, Weekday } from "./catalog";
import {
  MAX_PLANNER_SCHEDULE_NAME_LENGTH,
  MAX_PLANNER_SCHEDULES,
  type PlannerSchedule,
  type PlannerScheduleState,
} from "./plannerSchedules";

export const PLANNER_BACKUP_FORMAT = "hunter-schedule-backup";
export const PLANNER_BACKUP_VERSION = 1;
export const MAX_PLANNER_BACKUP_BYTES = 2_000_000;

// Backups accept a wider, still bounded compatibility window so schedules
// saved before the UI limits existed remain recoverable.
const MAX_BACKUP_SCHEDULES = MAX_PLANNER_SCHEDULES * 10;
const MAX_BACKUP_SCHEDULE_NAME_LENGTH = MAX_PLANNER_SCHEDULE_NAME_LENGTH * 100;

const MAX_SECTIONS_PER_SCHEDULE = 100;
const MAX_MEETINGS_PER_SECTION = 20;
const MAX_ARRAY_VALUES = 100;
const SEASONS = new Set<TermSeason>(["SPRING", "SUMMER", "FALL", "WINTER"]);
const DAYS = new Set<Weekday>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
const INSTRUCTION_MODES = new Set<CatalogSection["instruction_mode"]>(["in_person", "hybrid", "asynchronous", "remote"]);
const ENROLLMENT_STATUSES = new Set<NonNullable<CatalogSection["enrollment_status"]>>(["open", "closed", "waitlist"]);
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

type JsonRecord = Record<string, unknown>;

export type PlannerBackup = {
  format: typeof PLANNER_BACKUP_FORMAT;
  version: typeof PLANNER_BACKUP_VERSION;
  exportedAt: string;
  state: PlannerScheduleState;
};

function invalid(): never {
  throw new Error("This file is not a valid Hunter Schedule Builder backup.");
}

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as JsonRecord;
}

function text(value: unknown, maximum = 500, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > maximum || (!allowEmpty && !value.trim())) invalid();
  return value;
}

function nullableText(value: unknown, maximum = 2_000): string | null {
  return value === null ? null : text(value, maximum, true);
}

function finiteNumber(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) invalid();
  return value;
}

function integer(value: unknown, minimum: number, maximum: number): number {
  const parsed = finiteNumber(value, minimum, maximum);
  if (!Number.isInteger(parsed)) invalid();
  return parsed;
}

function nullableInteger(value: unknown, maximum = 1_000_000): number | null {
  return value === null ? null : integer(value, 0, maximum);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > MAX_ARRAY_VALUES) invalid();
  return value.map((item) => text(item, 500, true));
}

function parseTerm(value: unknown): CatalogTerm {
  const source = record(value);
  const termSeason = text(source.term_season, 10) as TermSeason;
  if (!SEASONS.has(termSeason)) invalid();
  return {
    term_season: termSeason,
    term_year: integer(source.term_year, 2000, 2100),
  };
}

function parseMeeting(value: unknown): CatalogMeeting {
  const source = record(value);
  if (!Array.isArray(source.days) || source.days.length > 7) invalid();
  const days = source.days.map((day) => {
    const parsed = text(day, 9) as Weekday;
    if (!DAYS.has(parsed)) invalid();
    return parsed;
  });
  if (new Set(days).size !== days.length) invalid();
  const startTime = text(source.start_time, 8);
  const endTime = text(source.end_time, 8);
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) invalid();
  const seconds = (time: string) => {
    const [hour, minute, second = 0] = time.split(":").map(Number);
    return hour * 3_600 + minute * 60 + second;
  };
  if (seconds(endTime) <= seconds(startTime)) invalid();
  return {
    days,
    start_time: startTime,
    end_time: endTime,
    location: nullableText(source.location, 500),
  };
}

function parseSection(value: unknown, term: CatalogTerm): CatalogSection {
  const source = record(value);
  const sectionTerm = parseTerm(source);
  if (sectionTerm.term_season !== term.term_season || sectionTerm.term_year !== term.term_year) invalid();
  const instructionMode = text(source.instruction_mode, 20) as CatalogSection["instruction_mode"];
  if (!INSTRUCTION_MODES.has(instructionMode)) invalid();
  const enrollmentStatus = source.enrollment_status === null
    ? null
    : text(source.enrollment_status, 10) as NonNullable<CatalogSection["enrollment_status"]>;
  if (enrollmentStatus !== null && !ENROLLMENT_STATUSES.has(enrollmentStatus)) invalid();
  if (!Array.isArray(source.meetings) || source.meetings.length > MAX_MEETINGS_PER_SECTION) invalid();

  return {
    class_num: integer(source.class_num, 1, 100_000_000),
    ...sectionTerm,
    section_number: text(source.section_number, 100),
    section_component: nullableText(source.section_component, 100),
    group_code: nullableText(source.group_code, 100),
    instructor: nullableText(source.instructor, 500),
    instruction_mode: instructionMode,
    max_enrollment: nullableInteger(source.max_enrollment),
    enrollment: nullableInteger(source.enrollment),
    waitlist_max_enrollment: nullableInteger(source.waitlist_max_enrollment),
    waitlist_count: nullableInteger(source.waitlist_count),
    enrollment_status: enrollmentStatus,
    notes: nullableText(source.notes, 5_000),
    course_id: text(source.course_id, 500),
    course_code: text(source.course_code, 100),
    course_name: text(source.course_name, 500),
    dep_code: text(source.dep_code, 500),
    course_description: nullableText(source.course_description, 10_000),
    credits: finiteNumber(source.credits, 0, 30),
    prerequisites: stringArray(source.prerequisites),
    corequisites: stringArray(source.corequisites),
    catalog_attributes: stringArray(source.catalog_attributes),
    meetings: source.meetings.map(parseMeeting),
  };
}

function parseSchedule(value: unknown): PlannerSchedule {
  const source = record(value);
  const term = parseTerm(source.term);
  if (!Array.isArray(source.sections) || source.sections.length > MAX_SECTIONS_PER_SCHEDULE) invalid();
  const parsed: PlannerSchedule = {
    id: text(source.id, 128),
    name: text(source.name, MAX_BACKUP_SCHEDULE_NAME_LENGTH),
    term,
    sections: source.sections.map((section) => parseSection(section, term)),
  };
  const classNumbers = parsed.sections.map((section) => section.class_num);
  if (new Set(classNumbers).size !== classNumbers.length) invalid();
  if (source.source !== undefined) {
    if (source.source !== "manual" && source.source !== "degreeworks") invalid();
    parsed.source = source.source;
  }
  if (source.score !== undefined) parsed.score = finiteNumber(source.score, -1_000_000_000, 1_000_000_000);
  return parsed;
}

function parseState(value: unknown): PlannerScheduleState {
  const source = record(value);
  if (!Array.isArray(source.schedules) || source.schedules.length < 1 || source.schedules.length > MAX_BACKUP_SCHEDULES) invalid();
  const schedules = source.schedules.map(parseSchedule);
  const ids = schedules.map((schedule) => schedule.id);
  if (new Set(ids).size !== ids.length) invalid();
  const activeId = text(source.activeId, 128);
  if (!ids.includes(activeId)) invalid();
  return { activeId, schedules };
}

export function createPlannerBackup(state: PlannerScheduleState, now = new Date()): string {
  const backup: PlannerBackup = {
    format: PLANNER_BACKUP_FORMAT,
    version: PLANNER_BACKUP_VERSION,
    exportedAt: now.toISOString(),
    state: parseState(state),
  };
  const contents = `${JSON.stringify(backup, null, 2)}\n`;
  if (new Blob([contents]).size > MAX_PLANNER_BACKUP_BYTES) {
    throw new Error("Your saved schedules are larger than the 2 MB backup limit.");
  }
  return contents;
}

export function parsePlannerBackup(contents: string): PlannerScheduleState {
  if (new Blob([contents]).size > MAX_PLANNER_BACKUP_BYTES) {
    throw new Error("This backup is larger than the 2 MB import limit.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    invalid();
  }
  const backup = record(parsed);
  if (backup.format !== PLANNER_BACKUP_FORMAT || backup.version !== PLANNER_BACKUP_VERSION) invalid();
  const exportedAt = text(backup.exportedAt, 50);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(exportedAt)
    || Number.isNaN(Date.parse(exportedAt))
    || new Date(exportedAt).toISOString() !== exportedAt) invalid();
  return parseState(backup.state);
}

export function downloadPlannerBackup(state: PlannerScheduleState) {
  const blob = new Blob([createPlannerBackup(state)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `hunter-schedules-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
