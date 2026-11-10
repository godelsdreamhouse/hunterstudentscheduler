import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduleCalendar } from "../calendarExport";
import {
  PLANNER_STORAGE_KEY,
  createPlannerSchedule,
  importGeneratedSchedules,
  readPlannerSchedules,
  writePlannerSchedules,
} from "../plannerSchedules";
import { section } from "./fixtures";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  get length() { return this.values.size; }
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));

describe("browser-local schedule saving", () => {
  it("round-trips a saved schedule", () => {
    const saved = createPlannerSchedule(undefined, "Tuesday plan");
    saved.sections = [section({ class_num: 1001, course_id: "csci-127", course_code: "CSCI 127" })];
    const state = { activeId: saved.id, schedules: [saved] };
    writePlannerSchedules(state);
    expect(readPlannerSchedules()).toEqual(state);
  });

  it("recovers from malformed browser data", () => {
    localStorage.setItem(PLANNER_STORAGE_KEY, "not-json");
    const state = readPlannerSchedules();
    expect(state.schedules).toHaveLength(1);
    expect(state.activeId).toBe(state.schedules[0].id);
  });

  it("appends a generated schedule and preserves its scheduler details", () => {
    const manual = createPlannerSchedule(
      { term_season: "FALL", term_year: 2026 },
      "Manual plan",
      { source: "manual" },
    );
    manual.sections = [section({ class_num: 1001, course_id: "csci-127", course_code: "CSCI 127" })];
    writePlannerSchedules({ activeId: manual.id, schedules: [manual] });

    const state = importGeneratedSchedules([{
      score: 42,
      credits: 3,
      optimization_codes: ["LESS_DAYS"],
      optimization_details: { days: 1 },
      sections: [{
        class_num: 43210,
        section_code: "01A",
        instruction_modality: "Hybrid",
        instructor: "Grace Hopper",
        enrollment_total: 18,
        class_capacity: 25,
        major_elective: true,
        attributes: ["Writing Intensive"],
        course: {
          subject_area: "CSCI",
          catalog_number: 335,
          course_title: "Software Analysis and Design III",
          department: "Computer Science",
          academic_career: "Undergraduate",
          credits: 3,
          description: "Advanced software design.",
          tags: ["Major Elective"],
          prereqs: [{ subject_area: "CSCI", catalog_number: 235 }],
        },
        meetings: [{ day: "MONDAY", start_time: 600, end_time: 675 }],
      }],
    }], { term_season: "SPRING", term_year: 2027 });

    expect(state.schedules).toHaveLength(2);
    expect(state.schedules[0]).toEqual(manual);
    const generated = state.schedules[1];
    expect(state.activeId).toBe(generated.id);
    expect(generated).toMatchObject({
      name: "Smart Option 1",
      source: "degreeworks",
      score: 42,
      term: { term_season: "SPRING", term_year: 2027 },
    });
    expect(generated.sections).toEqual([{
      class_num: 43210,
      term_season: "SPRING",
      term_year: 2027,
      section_number: "01A",
      section_component: null,
      group_code: null,
      instructor: "Grace Hopper",
      instruction_mode: "hybrid",
      max_enrollment: 25,
      enrollment: 18,
      waitlist_max_enrollment: null,
      waitlist_count: null,
      enrollment_status: null,
      notes: null,
      course_id: "smart-csci-335",
      course_code: "CSCI 335",
      course_name: "Software Analysis and Design III",
      dep_code: "Computer Science",
      course_description: "Advanced software design.",
      credits: 3,
      prerequisites: ["CSCI 235"],
      corequisites: [],
      // These are source metadata, not a claim that either requirement is fulfilled.
      catalog_attributes: ["Major Elective", "Writing Intensive"],
      meetings: [{
        days: ["Monday"],
        start_time: "10:00:00",
        end_time: "11:15:00",
        location: null,
      }],
    }]);
    expect(readPlannerSchedules()).toEqual(state);

    const editedState = {
      activeId: generated.id,
      schedules: [manual, { ...generated, sections: [] }],
    };
    writePlannerSchedules(editedState);

    const reloaded = readPlannerSchedules();
    expect(reloaded).toEqual(editedState);
    expect(reloaded.schedules[0]).toEqual(manual);
    expect(reloaded.schedules[1].sections).toEqual([]);
  });
});

describe("calendar export", () => {
  it("creates a recurring Spring 2027 calendar with section details", () => {
    const calendar = createScheduleCalendar("My plan", { term_season: "SPRING", term_year: 2027 }, [
      section({ class_num: 1001, course_id: "csci-127", course_code: "CSCI 127" }),
    ]);
    const unfolded = calendar.replaceAll("\r\n ", "");
    expect(calendar).toContain("BEGIN:VCALENDAR");
    expect(calendar).toContain("SUMMARY:CSCI 127");
    expect(calendar).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
    expect(unfolded).toContain("Instructor: Test Instructor");
    expect(calendar).toContain("END:VCALENDAR");
  });

  it("rejects a term whose academic calendar is not encoded", () => {
    expect(() => createScheduleCalendar("Fall", { term_season: "FALL", term_year: 2027 }, []))
      .toThrow("Calendar export is currently available for Spring 2027 schedules.");
  });
});
