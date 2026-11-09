export const PLANNING_SESSION_ID_STORAGE_KEY = "watchtower_planning_session_id";

/**
 * Returns a stable, browser-local eight-digit identifier for the scheduler
 * payload. It is not an account, credential, or Hunter EMPLID.
 */
export function getPlanningSessionId(): number {
	const existing = Number.parseInt(
		localStorage.getItem(PLANNING_SESSION_ID_STORAGE_KEY) ?? "",
		10,
	);
	if (existing >= 10_000_000 && existing <= 99_999_999) return existing;

	const randomValue = new Uint32Array(1);
	crypto.getRandomValues(randomValue);
	const sessionId = 10_000_000 + (randomValue[0] % 90_000_000);
	localStorage.setItem(PLANNING_SESSION_ID_STORAGE_KEY, String(sessionId));
	return sessionId;
}
