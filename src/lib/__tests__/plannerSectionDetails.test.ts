import { describe, expect, it } from "vitest";
import {
  formatSectionComponent,
  formatSearchEnrollment,
  formatSelectedEnrollment,
  formatSelectedMeetings,
} from "../plannerSectionDetails";
import { section } from "./fixtures";

describe("selected section details", () => {
  it("marks unavailable imported component and meeting data as unknown", () => {
    const imported = section({
      class_num: 12001,
      course_id: "smart-csci-127",
      course_code: "CSCI 127",
      section_component: null,
      meetings: [],
    });

    expect(formatSectionComponent(imported.section_component)).toBe("Component TBA");
    expect(formatSelectedMeetings(imported)).toEqual(["Meeting TBA"]);
  });

  it("preserves authoritative manual component and enrollment values", () => {
    const manual = section({
      class_num: 12004,
      course_id: "chem-102-lab",
      course_code: "CHEM 102",
      section_component: "laboratory",
    });

    expect(formatSectionComponent(manual.section_component)).toBe("Laboratory");
    expect(formatSelectedEnrollment(manual)).toBe("10/30 · Open");
  });

  it("formats every meeting and labels unavailable locations", () => {
    const selected = section({
      class_num: 12002,
      course_id: "csci-127",
      course_code: "CSCI 127",
      meetings: [
        { days: ["Monday", "Wednesday"], start_time: "09:00:00", end_time: "10:15:00", location: "HN 1001" },
        { days: ["Friday"], start_time: "13:00:00", end_time: "13:50:00", location: null },
      ],
    });

    expect(formatSelectedMeetings(selected)).toEqual([
      "Mon/Wed · 9:00 AM–10:15 AM · HN 1001",
      "Fri · 1:00 PM–1:50 PM · Location TBA",
    ]);
  });

  it("does not invent enrollment status when only partial counts are available", () => {
    const selected = section({
      class_num: 12003,
      course_id: "csci-127",
      course_code: "CSCI 127",
      enrollment: 18,
      max_enrollment: null,
      enrollment_status: null,
    });

    expect(formatSelectedEnrollment(selected)).toBe("18 enrolled · Capacity not published");
  });

  it("treats zero capacity as unpublished and surfaces a positive waitlist", () => {
    const selected = section({
      class_num: 12005,
      course_id: "synthetic-12005",
      course_code: "SYN 120",
      enrollment: 18,
      max_enrollment: 0,
      enrollment_status: null,
      waitlist_count: 4,
      waitlist_max_enrollment: 10,
    });

    expect(formatSelectedEnrollment(selected))
      .toBe("18 enrolled · Capacity not published · Waitlist 4/10");
    expect(formatSearchEnrollment(selected))
      .toBe("18 enrolled · Capacity not published · Waitlist 4/10");
  });

  it("formats known capacity and waitlist counts for catalog search", () => {
    const selected = section({
      class_num: 12006,
      course_id: "synthetic-12006",
      course_code: "SYN 121",
      enrollment: 25,
      max_enrollment: 25,
      waitlist_count: 3,
      waitlist_max_enrollment: 10,
    });

    expect(formatSearchEnrollment(selected))
      .toBe("25/25 seats filled · Waitlist 3/10");
  });

  it("shows a published waitlist when its current count is zero", () => {
    const selected = section({
      class_num: 12007,
      course_id: "synthetic-12007",
      course_code: "SYN 122",
      enrollment: 25,
      max_enrollment: 25,
      waitlist_count: 0,
      waitlist_max_enrollment: 10,
    });

    expect(formatSelectedEnrollment(selected))
      .toBe("25/25 · Open · Waitlist 0/10");
    expect(formatSearchEnrollment(selected))
      .toBe("25/25 seats filled · Waitlist 0/10");
  });
});
