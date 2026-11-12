import { describe, expect, it } from "vitest";
import {
  MAX_PLANNER_BACKUP_BYTES,
  createPlannerBackup,
  parsePlannerBackup,
} from "../plannerBackup";
import { createPlannerSchedule } from "../plannerSchedules";
import { section } from "./fixtures";

function savedState() {
  const first = createPlannerSchedule(undefined, "Weekend plan", { source: "manual" });
  first.sections = [section({ class_num: 1001, course_id: "csci-127", course_code: "CSCI 127" })];
  const second = createPlannerSchedule(undefined, "Smart option", { source: "degreeworks", score: 42 });
  second.sections = [section({ class_num: 2002, course_id: "math-150", course_code: "MATH 150" })];
  return { activeId: second.id, schedules: [first, second] };
}

describe("schedule backups", () => {
  it("round-trips only the versioned saved-schedule state", () => {
    const state = savedState();
    const contents = createPlannerBackup(state, new Date("2027-01-02T03:04:05.000Z"));

    expect(JSON.parse(contents)).toEqual({
      format: "hunter-schedule-backup",
      version: 1,
      exportedAt: "2027-01-02T03:04:05.000Z",
      state,
    });
    expect(contents).not.toContain("degreeworks-audit");
    expect(contents).not.toContain("watchtower_preferences");
    expect(parsePlannerBackup(contents)).toEqual(state);
  });

  it.each([
    ["malformed JSON", "not-json"],
    ["wrong format", JSON.stringify({ format: "other", version: 1, exportedAt: "2027-01-02T03:04:05.000Z", state: savedState() })],
    ["future version", JSON.stringify({ format: "hunter-schedule-backup", version: 2, exportedAt: "2027-01-02T03:04:05.000Z", state: savedState() })],
    ["invalid timestamp", JSON.stringify({ format: "hunter-schedule-backup", version: 1, exportedAt: "someday", state: savedState() })],
    ["impossible timestamp", JSON.stringify({ format: "hunter-schedule-backup", version: 1, exportedAt: "2027-02-31T03:04:05.000Z", state: savedState() })],
  ])("rejects %s", (_label, contents) => {
    expect(() => parsePlannerBackup(contents)).toThrow("not a valid Hunter Schedule Builder backup");
  });

  it("rejects an active schedule that is absent without mutating the input", () => {
    const state = savedState();
    const contents = createPlannerBackup(state);
    const backup = JSON.parse(contents);
    backup.state.activeId = "missing";

    expect(() => parsePlannerBackup(JSON.stringify(backup))).toThrow("not a valid Hunter Schedule Builder backup");
    expect(state.activeId).not.toBe("missing");
  });

  it("rejects invalid nested catalog data", () => {
    const backup = JSON.parse(createPlannerBackup(savedState()));
    backup.state.schedules[0].sections[0].meetings[0].days = ["Funday"];

    expect(() => parsePlannerBackup(JSON.stringify(backup))).toThrow("not a valid Hunter Schedule Builder backup");
  });

  it("rejects duplicate class identities that the planner cannot edit independently", () => {
    const backup = JSON.parse(createPlannerBackup(savedState()));
    backup.state.schedules[0].sections.push({ ...backup.state.schedules[0].sections[0] });

    expect(() => parsePlannerBackup(JSON.stringify(backup))).toThrow("not a valid Hunter Schedule Builder backup");
  });

  it("keeps pre-limit schedule counts and names recoverable within a bounded compatibility window", () => {
    const longName = savedState();
    longName.schedules[0].name = "x".repeat(101);
    expect(parsePlannerBackup(createPlannerBackup(longName))).toEqual(longName);

    const tooMany = savedState();
    tooMany.schedules = Array.from({ length: 51 }, (_, index) => ({
      ...tooMany.schedules[0],
      id: `schedule-${index}`,
      sections: [],
    }));
    tooMany.activeId = tooMany.schedules[0].id;
    expect(parsePlannerBackup(createPlannerBackup(tooMany))).toEqual(tooMany);
  });

  it("refuses to create a backup that cannot fit the import size limit", () => {
    const state = savedState();
    const largeSection = {
      ...state.schedules[0].sections[0],
      notes: "n".repeat(5_000),
      course_description: "d".repeat(10_000),
      prerequisites: Array.from({ length: 100 }, () => "p".repeat(500)),
      corequisites: Array.from({ length: 100 }, () => "c".repeat(500)),
      catalog_attributes: Array.from({ length: 100 }, () => "a".repeat(500)),
    };
    state.schedules[0].sections = Array.from({ length: 13 }, (_, index) => ({
      ...largeSection,
      class_num: index + 1,
      course_id: `large-${index}`,
    }));

    expect(() => createPlannerBackup(state)).toThrow("larger than the 2 MB backup limit");
  });

  it("rejects zero-length meetings even when time precision differs", () => {
    const backup = JSON.parse(createPlannerBackup(savedState()));
    backup.state.schedules[0].sections[0].meetings[0].start_time = "10:00";
    backup.state.schedules[0].sections[0].meetings[0].end_time = "10:00:00";

    expect(() => parsePlannerBackup(JSON.stringify(backup))).toThrow("not a valid Hunter Schedule Builder backup");
  });

  it("strips unknown fields instead of persisting hidden data", () => {
    const backup = JSON.parse(createPlannerBackup(savedState()));
    backup.state.secretAudit = "private";
    backup.state.schedules[0].secretAudit = "private";
    backup.state.schedules[0].sections[0].secretAudit = "private";

    const restored = parsePlannerBackup(JSON.stringify(backup)) as unknown as Record<string, unknown>;
    expect(restored).not.toHaveProperty("secretAudit");
    expect(restored.schedules).not.toEqual(expect.arrayContaining([expect.objectContaining({ secretAudit: "private" })]));
  });

  it("rejects files over the import size limit", () => {
    expect(() => parsePlannerBackup(" ".repeat(MAX_PLANNER_BACKUP_BYTES + 1)))
      .toThrow("larger than the 2 MB import limit");
  });
});
