import type { CatalogSection } from "../catalog";

export function section(
  overrides: Partial<CatalogSection> & Pick<CatalogSection, "class_num" | "course_id" | "course_code">,
): CatalogSection {
  return {
    term_season: "SPRING", term_year: 2027, section_number: "01", section_component: "lecture",
    group_code: null, instructor: "Test Instructor", instruction_mode: "in_person",
    max_enrollment: 30, enrollment: 10, waitlist_max_enrollment: 0, waitlist_count: 0,
    enrollment_status: "open", notes: null, course_name: "Test Course", dep_code: "TEST",
    course_description: null, credits: 3, prerequisites: [], corequisites: [], catalog_attributes: [],
    meetings: [{ days: ["Monday"], start_time: "10:00:00", end_time: "11:15:00", location: "HN 1000" }],
    ...overrides,
  };
}
