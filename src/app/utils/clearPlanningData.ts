import { AUDIT_STORAGE_KEY } from "../hooks/useAuditData";
import { PREFERENCES_STORAGE_KEY } from "../hooks/usePersistedPreferences";
import { SETUP_PROGRESS_STORAGE_KEY } from "../hooks/useSetupProgress";
import {
  LEGACY_PLANNER_STORAGE_KEY,
  PLANNER_STORAGE_KEY,
} from "../../lib/plannerSchedules";
import { PLANNING_SESSION_ID_STORAGE_KEY } from "./planningSession";
import { ACTIVE_USER_STORAGE_KEY } from "./userScopedStorage";

const LOCAL_EXACT_KEYS = new Set([
  PLANNER_STORAGE_KEY,
  LEGACY_PLANNER_STORAGE_KEY,
  PLANNING_SESSION_ID_STORAGE_KEY,
  ACTIVE_USER_STORAGE_KEY,
]);

const LOCAL_SCOPED_KEY_PREFIXES = [
  AUDIT_STORAGE_KEY,
  PREFERENCES_STORAGE_KEY,
  SETUP_PROGRESS_STORAGE_KEY,
];

export interface ClearPlanningDataOptions {
  confirmed: boolean;
  local?: Storage;
  session?: Storage;
  afterClear?: () => void;
}

function isKeyOrScopedVariant(key: string, baseKey: string): boolean {
  return key === baseKey || key.startsWith(`${baseKey}:`);
}

function removeMatchingKeys(storage: Storage, matches: (key: string) => boolean): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key && matches(key)) storage.removeItem(key);
  }
}

/**
 * Removes only Watchtower's browser-local academic and planning state.
 * The explicit confirmation flag keeps non-confirmed callers as a no-op.
 */
export function clearPlanningData({
  confirmed,
  local = window.localStorage,
  session = window.sessionStorage,
  afterClear,
}: ClearPlanningDataOptions): boolean {
  if (!confirmed) return false;

  removeMatchingKeys(local, (key) => (
    LOCAL_EXACT_KEYS.has(key)
    || LOCAL_SCOPED_KEY_PREFIXES.some((baseKey) => isKeyOrScopedVariant(key, baseKey))
  ));
  removeMatchingKeys(session, (key) => isKeyOrScopedVariant(key, AUDIT_STORAGE_KEY));

  afterClear?.();
  return true;
}
