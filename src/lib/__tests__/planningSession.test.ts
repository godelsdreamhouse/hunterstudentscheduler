import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPlanningSessionId,
  PLANNING_SESSION_ID_STORAGE_KEY,
} from "../../app/utils/planningSession";
import { ACTIVE_USER_STORAGE_KEY } from "../../app/utils/userScopedStorage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }

  clear() { this.values.clear(); }

  getItem(key: string) { return this.values.get(key) ?? null; }

  key(index: number) { return [...this.values.keys()][index] ?? null; }

  removeItem(key: string) { this.values.delete(key); }

  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("browser-local planning session identifier", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reuses a valid browser-local identifier without reading account state", () => {
    const storage = new MemoryStorage();
    storage.setItem(PLANNING_SESSION_ID_STORAGE_KEY, "24681357");
    storage.setItem(ACTIVE_USER_STORAGE_KEY, "12345678");
    vi.stubGlobal("localStorage", storage);
    const randomValues = vi.fn();
    vi.stubGlobal("crypto", { getRandomValues: randomValues });

    expect(getPlanningSessionId()).toBe(24_681_357);
    expect(randomValues).not.toHaveBeenCalled();
  });

  it("generates and persists an eight-digit opaque value when none exists", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("crypto", {
      getRandomValues(values: Uint32Array) {
        values[0] = 42;
        return values;
      },
    });

    expect(getPlanningSessionId()).toBe(10_000_042);
    expect(storage.getItem(PLANNING_SESSION_ID_STORAGE_KEY)).toBe("10000042");
  });

  it("replaces malformed stored state instead of forwarding it", () => {
    const storage = new MemoryStorage();
    storage.setItem(PLANNING_SESSION_ID_STORAGE_KEY, "student-id");
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("crypto", {
      getRandomValues(values: Uint32Array) {
        values[0] = 90_000_001;
        return values;
      },
    });

    const identifier = getPlanningSessionId();

    expect(identifier).toBeGreaterThanOrEqual(10_000_000);
    expect(identifier).toBeLessThanOrEqual(99_999_999);
    expect(storage.getItem(PLANNING_SESSION_ID_STORAGE_KEY)).toBe(String(identifier));
  });
});
