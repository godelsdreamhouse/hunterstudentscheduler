import { describe, expect, it } from "vitest";
import { addSectionToSchedule, filterPlannerSections, isSectionFull, meetingsOverlap, removeSectionFromSchedule } from "../plannerJourney";
import { section } from "./fixtures";

describe("manual planner journey rules", () => {
  const csci = section({ class_num: 1001, course_id: "csci-127", course_code: "CSCI 127" });

  it("adds and removes a section", () => {
    const added = addSectionToSchedule([], csci);
    expect(added).toEqual({ sections: [csci] });
    expect(removeSectionFromSchedule(added.sections, csci.class_num)).toEqual([]);
  });

  it("does not add the same class or another section of the same course", () => {
    expect(addSectionToSchedule([csci], csci).reason).toBe("already-selected");
    const other = section({ class_num: 1002, course_id: csci.course_id, course_code: csci.course_code, section_number: "02" });
    expect(addSectionToSchedule([csci], other).reason).toBe("duplicate-course");
  });

  it("reports a conflicting course without changing the schedule", () => {
    const math = section({
      class_num: 2001, course_id: "math-150", course_code: "MATH 150",
      meetings: [{ days: ["Monday"], start_time: "11:00:00", end_time: "12:15:00", location: "HN 1001" }],
    });
    const result = addSectionToSchedule([csci], math);
    expect(result.sections).toEqual([csci]);
    expect(result.reason).toBe("time-conflict");
    expect(result.conflictingCourseCode).toBe("CSCI 127");
  });

  it("treats back-to-back meetings as non-conflicting", () => {
    expect(meetingsOverlap(csci.meetings[0], {
      days: ["Monday"], start_time: "11:15:00", end_time: "12:30:00", location: null,
    })).toBe(false);
  });

  it("filters by capacity, mode, days, and conflicts", () => {
    const full = section({ class_num: 2001, course_id: "engl-120", course_code: "ENGL 120", enrollment: 30, max_enrollment: 30 });
    const remote = section({
      class_num: 3001, course_id: "hist-151", course_code: "HIST 151", instruction_mode: "remote",
      meetings: [{ days: ["Tuesday", "Thursday"], start_time: "12:00:00", end_time: "13:15:00", location: null }],
    });
    const conflict = section({ class_num: 4001, course_id: "phil-101", course_code: "PHIL 101" });
    expect(filterPlannerSections([csci, full, remote, conflict], [csci], {
      hideFull: true, mode: "remote", days: ["Tuesday", "Thursday"], showConflicts: false,
    })).toEqual([remote]);
  });

  it("only treats known enrollment at or above positive capacity as full", () => {
    expect(isSectionFull(section({ class_num: 2001, course_id: "equal", course_code: "TEST 1", enrollment: 25, max_enrollment: 25 }))).toBe(true);
    expect(isSectionFull(section({ class_num: 2002, course_id: "over", course_code: "TEST 2", enrollment: 26, max_enrollment: 25 }))).toBe(true);
    expect(isSectionFull(section({ class_num: 2003, course_id: "under", course_code: "TEST 3", enrollment: 24, max_enrollment: 25 }))).toBe(false);
    expect(isSectionFull(section({ class_num: 2004, course_id: "unknown-enrollment", course_code: "TEST 4", enrollment: null, max_enrollment: 25 }))).toBe(false);
    expect(isSectionFull(section({ class_num: 2005, course_id: "unknown-capacity", course_code: "TEST 5", enrollment: 25, max_enrollment: null }))).toBe(false);
    expect(isSectionFull(section({ class_num: 2006, course_id: "zero-capacity", course_code: "TEST 6", enrollment: 25, max_enrollment: 0 }))).toBe(false);
  });

  it("keeps a closed but under-capacity section when hiding full sections", () => {
    const closedWithRoom = section({
      class_num: 2007, course_id: "closed-with-room", course_code: "TEST 7",
      enrollment: 18, max_enrollment: 25, enrollment_status: "closed",
    });
    expect(filterPlannerSections([closedWithRoom], [], {
      hideFull: true, mode: "all", days: [], showConflicts: true,
    })).toEqual([closedWithRoom]);
  });

  it("keeps full sections when the hide-full filter is off", () => {
    const full = section({
      class_num: 2008, course_id: "full", course_code: "TEST 8",
      enrollment: 25, max_enrollment: 25,
    });
    expect(filterPlannerSections([full], [], {
      hideFull: false, mode: "all", days: [], showConflicts: true,
    })).toEqual([full]);
  });
});
