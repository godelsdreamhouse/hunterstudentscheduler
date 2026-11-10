import { describe, expect, it } from "vitest";
import { resolvePlannerTheme } from "../plannerTheme";

describe("planner theme", () => {
  it("preserves an explicitly selected theme across routes", () => {
    expect(resolvePlannerTheme("dark", false)).toBe("dark");
    expect(resolvePlannerTheme("light", true)).toBe("light");
  });

  it("uses the system preference only before a theme is selected", () => {
    expect(resolvePlannerTheme(null, true)).toBe("dark");
    expect(resolvePlannerTheme(null, false)).toBe("light");
  });

  it("ignores corrupted stored values", () => {
    expect(resolvePlannerTheme("unexpected", true)).toBe("dark");
  });
});

