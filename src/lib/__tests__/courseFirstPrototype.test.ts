import { describe, expect, it } from "vitest";
import { enumerateSchedulePage, meetingsConflict, searchPrototypeCourses, type PrototypeCourse } from "../courseFirstPrototype";
import { PROTOTYPE_COURSES } from "../courseFirstPrototypeFixtures";
import { nextPrototypeScheduleNumber, sanitizePrototypeState } from "../courseFirstPrototypeState";

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

  it("rejects a supplied combination whose own linked sections overlap", () => {
    const base = PROTOTYPE_COURSES[0].combinations[0];
    const internallyConflicting: PrototypeCourse = {
      id: "broken-course",
      code: "BROKEN 100",
      title: "Contradictory source association",
      description: "Synthetic regression fixture",
      combinations: [{
        ...base,
        id: "broken-combination",
        courseId: "broken-course",
        courseCode: "BROKEN 100",
        sections: [
          { ...base.sections[0], sourceSectionId: "broken-lecture" },
          { ...base.sections[1], sourceSectionId: "broken-lab", meetings: base.sections[0].meetings },
        ],
      }],
    };

    const result = enumerateSchedulePage([internallyConflicting], ["broken-course"], new Set(), 0, 5);
    expect(result.options).toEqual([]);
    expect(result.explanation).toMatch(/linked sections that overlap.*source associations need review/i);
  });

  it("supports incremental pages and course-level search", () => {
    const first = enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127", "biol-100"], new Set(), 0, 2);
    const second = enumerateSchedulePage(PROTOTYPE_COURSES, ["csci-127", "biol-100"], new Set(), 2, 2);
    expect(first.hasMore).toBe(true);
    expect(new Set([...first.options, ...second.options].map((item) => item.id)).size).toBe(first.options.length + second.options.length);
    expect(searchPrototypeCourses(PROTOTYPE_COURSES, "calculus").map((course) => course.code)).toEqual(["MATH 150"]);
  });

  it("returns only a bounded page when skipping a deep prefix", () => {
    const base = PROTOTYPE_COURSES[2].combinations[0];
    const manyOptions: PrototypeCourse = {
      id: "many-options",
      code: "TEST 200",
      title: "Large synthetic option set",
      description: "Resource-bound regression fixture",
      combinations: Array.from({ length: 2_005 }, (_, index) => ({
        ...base,
        id: `many-${index}`,
        courseId: "many-options",
        courseCode: "TEST 200",
        sourceRecordIds: [`source-${index}`],
        sections: base.sections.map((section) => ({ ...section, sourceSectionId: `${section.sourceSectionId}-${index}` })),
      })),
    };

    const deepPage = enumerateSchedulePage([manyOptions], ["many-options"], new Set(), 2_000, 3);
    expect(deepPage.options).toHaveLength(3);
    expect(deepPage.options.map((option) => option.id)).toEqual(["many-2000", "many-2001", "many-2002"]);
    expect(deepPage.hasMore).toBe(true);
  });

  it("distinguishes an exhausted deep page from a scheduling conflict", () => {
    const exhausted = enumerateSchedulePage(PROTOTYPE_COURSES, ["artla-201"], new Set(), 10, 3);
    expect(exhausted.options).toEqual([]);
    expect(exhausted.explanation).toMatch(/no more alternatives.*previous page/i);
    expect(exhausted.explanation).not.toMatch(/conflict|overlap/i);
  });
});

describe("course-first prototype persisted state", () => {
  it("sanitizes string arrays, unknown courses, invalid pins, duplicates, and active ID", () => {
    const sanitized = sanitizePrototypeState({
      activeId: "missing-schedule",
      schedules: [
        {
          id: "kept",
          name: "  My plan  ",
          selectedCourseIds: ["csci-127", "csci-127", "unknown", 17],
          pins: [
            "csci-127:csci-127-lab-1a",
            "csci-127:csci-127-lab-1a",
            "csci-127:not-a-section",
            "math-150:math-150-lec-01",
            42,
          ],
        },
        { id: "kept", name: "duplicate ID", selectedCourseIds: [], pins: [] },
        { id: 99, name: "wrong types", selectedCourseIds: [], pins: [] },
      ],
    }, PROTOTYPE_COURSES);

    expect(sanitized).toEqual({
      activeId: "kept",
      schedules: [{
        id: "kept",
        name: "My plan",
        selectedCourseIds: ["csci-127"],
        pins: ["csci-127:csci-127-lab-1a"],
      }],
    });
  });

  it("rejects persisted values without a valid schedule", () => {
    expect(sanitizePrototypeState({ activeId: "x", schedules: [{ id: 1 }] }, PROTOTYPE_COURSES)).toBeNull();
    expect(sanitizePrototypeState(null, PROTOTYPE_COURSES)).toBeNull();
  });

  it("chooses a unique default schedule number after deletions", () => {
    expect(nextPrototypeScheduleNumber([
      { id: "a", name: "Prototype schedule 1", selectedCourseIds: [], pins: [] },
      { id: "c", name: "Prototype schedule 3", selectedCourseIds: [], pins: [] },
      { id: "custom", name: "My own name", selectedCourseIds: [], pins: [] },
    ])).toBe(4);
  });
});
