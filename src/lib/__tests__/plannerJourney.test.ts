import { describe, expect, it } from "vitest";
import { addSectionToSchedule, filterPlannerSections, meetingsOverlap, removeSectionFromSchedule } from "../plannerJourney";
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

  it("filters by status, mode, days, and conflicts", () => {
    const closed = section({ class_num: 2001, course_id: "engl-120", course_code: "ENGL 120", enrollment_status: "closed" });
    const remote = section({
      class_num: 3001, course_id: "hist-151", course_code: "HIST 151", instruction_mode: "remote",
      meetings: [{ days: ["Tuesday", "Thursday"], start_time: "12:00:00", end_time: "13:15:00", location: null }],
    });
    const conflict = section({ class_num: 4001, course_id: "phil-101", course_code: "PHIL 101" });
    expect(filterPlannerSections([csci, closed, remote, conflict], [csci], {
      openOnly: true, mode: "remote", days: ["Tuesday", "Thursday"], showConflicts: false,
    })).toEqual([remote]);
  });
});
