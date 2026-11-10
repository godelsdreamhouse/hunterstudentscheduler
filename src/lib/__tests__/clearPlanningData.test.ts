import { describe, expect, it, vi } from "vitest";
import { AUDIT_STORAGE_KEY } from "../../app/hooks/useAuditData";
import { PREFERENCES_STORAGE_KEY } from "../../app/hooks/usePersistedPreferences";
import { SETUP_PROGRESS_STORAGE_KEY } from "../../app/hooks/useSetupProgress";
import { clearPlanningData } from "../../app/utils/clearPlanningData";
import { PLANNING_SESSION_ID_STORAGE_KEY } from "../../app/utils/planningSession";
import { ACTIVE_USER_STORAGE_KEY } from "../../app/utils/userScopedStorage";
import {
  LEGACY_PLANNER_STORAGE_KEY,
  PLANNER_STORAGE_KEY,
} from "../plannerSchedules";
import { schedulePlannerSearchFocus } from "../plannerReset";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }

  clear() { this.values.clear(); }

  getItem(key: string) { return this.values.get(key) ?? null; }

  key(index: number) { return [...this.values.keys()][index] ?? null; }

  removeItem(key: string) { this.values.delete(key); }

  setItem(key: string, value: string) { this.values.set(key, value); }
}

class ThrowingStorage extends MemoryStorage {
  override removeItem(_key: string) {
    throw new Error("Storage is unavailable");
  }
}

describe("clear planning data", () => {
  it("removes current and legacy planning state, including user-scoped variants", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const planningKeys = [
      PLANNER_STORAGE_KEY,
      LEGACY_PLANNER_STORAGE_KEY,
      PLANNING_SESSION_ID_STORAGE_KEY,
      ACTIVE_USER_STORAGE_KEY,
      PREFERENCES_STORAGE_KEY,
      `${PREFERENCES_STORAGE_KEY}:12345678`,
      `${PREFERENCES_STORAGE_KEY}:87654321`,
      SETUP_PROGRESS_STORAGE_KEY,
      `${SETUP_PROGRESS_STORAGE_KEY}:12345678`,
      AUDIT_STORAGE_KEY,
      `${AUDIT_STORAGE_KEY}:legacy-user`,
    ];
    planningKeys.forEach((key) => local.setItem(key, "saved"));
    session.setItem(AUDIT_STORAGE_KEY, "audit");
    session.setItem(`${AUDIT_STORAGE_KEY}:legacy-user`, "audit");

    expect(clearPlanningData({ confirmed: true, local, session })).toBe(true);

    planningKeys.forEach((key) => expect(local.getItem(key)).toBeNull());
    expect(session.getItem(AUDIT_STORAGE_KEY)).toBeNull();
    expect(session.getItem(`${AUDIT_STORAGE_KEY}:legacy-user`)).toBeNull();
  });

  it("preserves visual theme and unrelated origin storage", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    local.setItem(PLANNER_STORAGE_KEY, "schedule");
    local.setItem("hunter-planner-theme", "dark");
    local.setItem("another-app-data", "keep");
    session.setItem(AUDIT_STORAGE_KEY, "audit");
    session.setItem("unrelated-session-data", "keep");

    clearPlanningData({ confirmed: true, local, session });

    expect(local.getItem("hunter-planner-theme")).toBe("dark");
    expect(local.getItem("another-app-data")).toBe("keep");
    expect(session.getItem("unrelated-session-data")).toBe("keep");
  });

  it("is a no-op when confirmation is cancelled", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    const afterClear = vi.fn();
    local.setItem(PLANNER_STORAGE_KEY, "schedule");
    session.setItem(AUDIT_STORAGE_KEY, "audit");

    expect(clearPlanningData({ confirmed: false, local, session, afterClear })).toBe(false);
    expect(local.getItem(PLANNER_STORAGE_KEY)).toBe("schedule");
    expect(session.getItem(AUDIT_STORAGE_KEY)).toBe("audit");
    expect(afterClear).not.toHaveBeenCalled();
  });

  it("runs the caller's live-state reset and fresh-start navigation only after clearing", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    let selectedClassNumbers = [12345];
    let currentPath = "/planner?imported=1";

    clearPlanningData({
      confirmed: true,
      local,
      session,
      afterClear: () => {
        selectedClassNumbers = [];
        currentPath = "/planner";
      },
    });

    expect(selectedClassNumbers).toEqual([]);
    expect(currentPath).toBe("/planner");
  });

  it("does not run reset/navigation when browser storage rejects deletion", () => {
    const afterClear = vi.fn();
    const local = new ThrowingStorage();
    local.setItem(PLANNER_STORAGE_KEY, "schedule");

    expect(() => clearPlanningData({
      confirmed: true,
      local,
      session: new MemoryStorage(),
      afterClear,
    })).toThrowError(/Storage is unavailable/);
    expect(afterClear).not.toHaveBeenCalled();
  });

  it("defers focus to the visible planner search control", () => {
    const focus = vi.fn();
    const callbacks: Array<() => void> = [];

    schedulePlannerSearchFocus({ focus }, (callback) => callbacks.push(callback));

    expect(focus).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(1);
    callbacks[0]();
    expect(focus).toHaveBeenCalledOnce();
  });
});
