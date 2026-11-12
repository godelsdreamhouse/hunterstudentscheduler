import { describe, expect, it } from "vitest";
import { enumerateSchedulePage, meetingsConflict, searchPrototypeCourses } from "../courseFirstPrototype";
import { PROTOTYPE_COURSES } from "../courseFirstPrototypeFixtures";

describe("course-first prototype combination generation", () => {
  it("returns only complete evidence-bearing combinations and includes mandatory components", () => {
    const page = enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127", "biol-100"], new Set(), 0, 10);
    expect(page.options.length).toBeGreaterThan(0);
    for (const option of page.options) {
      expect(option.combinations).toHaveLength(2);
      expect(option.combinations.every((item) => item.associationIdentity && item.sourceRecordIds.length > 0)).toBe(true);
      expect(option.combinations.find((item) => item.courseId === "csci-127")?.sections.map((item) => item.component)).toContain("lab");
      expect(option.combinations.find((item) => item.courseId === "biol-100")?.sections.map((item) => item.component)).toContain("discussion");
    }
  });

  it("prunes overlapping meetings but permits adjacent meetings", () => {
    expect(meetingsConflict(
      { days: ["Monday"], startTime: "09:00", endTime: "10:00", location: "A" },
      { days: ["Monday"], startTime: "09:30", endTime: "10:30", location: "B" },
    )).toBe(true);
    expect(meetingsConflict(
      { days: ["Monday"], startTime: "09:00", endTime: "10:00", location: "A" },
      { days: ["Monday"], startTime: "10:00", endTime: "11:00", location: "B" },
    )).toBe(false);
  });

  it("honors pins without inventing new associations", () => {
    const pins = new Set(["csci-127:csci-127-lab-2a"]);
    const page = enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127", "biol-100"], pins, 0, 10);
    expect(page.options.length).toBeGreaterThan(0);
    expect(page.options.every((option) => option.sections.some((section) => section.sourceSectionId === "csci-127-lab-2a"))).toBe(true);
  });

  it("explains impossible pins and time conflicts", () => {
    const impossiblePins = new Set(["csci-127:csci-127-lab-1a", "csci-127:csci-127-lab-2a"]);
    expect(enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127"], impossiblePins, 0, 5).explanation).toMatch(/every pinned section/i);
    const conflictPins = new Set(["csci-127:csci-127-lab-3a"]);
    expect(enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127", "artla-201"], conflictPins, 0, 5).explanation).toMatch(/overlap in time/i);
  });

  it("supports incremental pages and course-level search", () => {
    const first = enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127", "biol-100"], new Set(), 0, 2);
    const second = enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127", "biol-100"], new Set(), 2, 2);
    expect(first.hasMore).toBe(true);
    expect(new Set([...first.options, ...second.options].map((item) => item.id)).size).toBe(first.options.length + second.options.length);
    expect(searchPrototypeCourses(PROTOTYPE_COURSES, "calculus").map((course) => course.code)).toEqual(["MATH 150"]);
  });
});
