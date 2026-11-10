import { describe, expect, it } from "vitest";
import type { ScheduleSection } from "../schedulePayload";
import { generatedSectionToCatalog } from "../plannerSchedules";

const generatedSection: ScheduleSection = {
  class_num: 12001,
  section_code: "01",
  instruction_modality: "In Person",
  instructor: "Ada Lovelace",
  enrollment_total: 18,
  class_capacity: 25,
  major_elective: false,
  attributes: [],
  course: {
    subject_area: "CSCI",
    catalog_number: 127,
    course_title: "Introduction to Computer Science",
    department: "Computer Science",
    academic_career: "Undergraduate",
    credits: 3,
    description: "",
    tags: [],
    prereqs: [],
  },
  meetings: [{ day: "MONDAY", start_time: 600, end_time: 675 }],
};

describe("generated schedule conversion", () => {
  it("preserves unavailable catalog-only facts as unknown", () => {
    const converted = generatedSectionToCatalog(generatedSection, {
      term_season: "SPRING",
      term_year: 2027,
    });

    expect(converted.section_component).toBeNull();
    expect(converted.enrollment_status).toBeNull();
    expect(converted.meetings).toEqual([{
      days: ["Monday"],
      start_time: "10:00:00",
      end_time: "11:15:00",
      location: null,
    }]);
    expect(converted.enrollment).toBe(18);
    expect(converted.max_enrollment).toBe(25);
  });
});
