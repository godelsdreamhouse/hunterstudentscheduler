import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduleCalendar } from "../calendarExport";
import { PLANNER_STORAGE_KEY, createPlannerSchedule, readPlannerSchedules, writePlannerSchedules } from "../plannerSchedules";
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
