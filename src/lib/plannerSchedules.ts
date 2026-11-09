import type { CatalogSection, CatalogTerm, Weekday } from "./catalog";
import type { ScheduleOption, ScheduleSection } from "./schedulePayload";

export const PLANNER_STORAGE_KEY = "hunter-schedules-v2";
export const LEGACY_PLANNER_STORAGE_KEY = "watchtower-planning-session-v1";
const DEFAULT_TERM: CatalogTerm = { term_season: "SPRING", term_year: 2027 };

export type PlannerSchedule = {
  id: string;
  name: string;
  term: CatalogTerm;
  sections: CatalogSection[];
  source?: "manual" | "degreeworks";
  score?: number;
};

export type PlannerScheduleState = {
  activeId: string;
  schedules: PlannerSchedule[];
};

export function createPlannerSchedule(
  term = DEFAULT_TERM,
  name = "My Schedule",
  details: Pick<PlannerSchedule, "source" | "score"> = {},
): PlannerSchedule {
  return { id: crypto.randomUUID(), name, term, sections: [], ...details };
}

export function readPlannerSchedules(): PlannerScheduleState {
  try {
    const stored = JSON.parse(localStorage.getItem(PLANNER_STORAGE_KEY) ?? "null") as PlannerScheduleState | null;
    if (stored?.schedules?.length) return stored;

    const legacy = JSON.parse(localStorage.getItem(LEGACY_PLANNER_STORAGE_KEY) ?? "{}") as Record<string, CatalogSection[]>;
    const migrated = Object.entries(legacy).flatMap(([key, sections]) => {
      const [season, year] = key.split("-");
      if (!season || !year || !sections.length) return [];
      return [{
        ...createPlannerSchedule({ term_season: season as CatalogTerm["term_season"], term_year: Number(year) }),
        sections,
      }];
    });
    if (migrated.length) return { activeId: migrated[0].id, schedules: migrated };
  } catch {
    // Start clean when browser-local data is unavailable or malformed.
  }

  const schedule = createPlannerSchedule();
  return { activeId: schedule.id, schedules: [schedule] };
}

export function writePlannerSchedules(state: PlannerScheduleState) {
  localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(state));
}

function clockTime(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function catalogDay(day: string): Weekday {
  const normalized = day.toLowerCase();
  return `${normalized[0].toUpperCase()}${normalized.slice(1)}` as Weekday;
}

function instructionMode(value: string): CatalogSection["instruction_mode"] {
  const normalized = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized.includes("async")) return "asynchronous";
  if (normalized.includes("hybrid")) return "hybrid";
  if (normalized.includes("remote") || normalized.includes("online")) return "remote";
  return "in_person";
}

export function generatedSectionToCatalog(section: ScheduleSection, term: CatalogTerm): CatalogSection {
  const courseCode = `${section.course.subject_area} ${section.course.catalog_number}`;
  return {
    class_num: section.class_num,
    term_season: term.term_season,
    term_year: term.term_year,
    section_number: section.section_code,
    section_component: null,
    group_code: null,
    instructor: section.instructor && section.instructor !== "NULL" ? section.instructor : null,
    instruction_mode: instructionMode(section.instruction_modality),
    max_enrollment: section.class_capacity,
    enrollment: section.enrollment_total,
    waitlist_max_enrollment: null,
    waitlist_count: null,
    enrollment_status: null,
    notes: null,
    course_id: `smart-${section.course.subject_area}-${section.course.catalog_number}`.toLowerCase(),
    course_code: courseCode,
    course_name: section.course.course_title,
    dep_code: section.course.department || section.course.subject_area,
    course_description: section.course.description || null,
    credits: section.course.credits,
    prerequisites: section.course.prereqs.map((course) => `${course.subject_area} ${course.catalog_number}`),
    corequisites: [],
    catalog_attributes: [...section.course.tags, ...section.attributes],
    meetings: section.meetings.map((meeting) => ({
      days: [catalogDay(meeting.day)],
      start_time: clockTime(meeting.start_time),
      end_time: clockTime(meeting.end_time),
      location: null,
    })),
  };
}

export function importGeneratedSchedules(options: ScheduleOption[], term: CatalogTerm) {
  const current = readPlannerSchedules();
  const imported = options.map((option, index) => ({
    ...createPlannerSchedule(term, `Smart Option ${index + 1}`, {
      source: "degreeworks",
      score: option.score,
    }),
    sections: option.sections.map((section) => generatedSectionToCatalog(section, term)),
  }));
  if (!imported.length) return current;

  const next = {
    activeId: imported[0].id,
    schedules: [...current.schedules, ...imported],
  };
  writePlannerSchedules(next);
  return next;
}
