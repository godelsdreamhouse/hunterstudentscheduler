const ACTIVE_USER_KEY = "watchtower_active_user_id";

export function setActiveUserStorageId(emplid: number | string | null | undefined): void {
  const value = String(emplid ?? "").trim();
  if (value && value !== "0") {
    localStorage.setItem(ACTIVE_USER_KEY, value);
  } else {
    localStorage.removeItem(ACTIVE_USER_KEY);
  }
}

export function getUserScopedStorageKey(baseKey: string): string {
  const activeUserId = localStorage.getItem(ACTIVE_USER_KEY);
  return activeUserId ? `${baseKey}:${activeUserId}` : baseKey;
}
