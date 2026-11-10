export const PLANNER_THEME_STORAGE_KEY = "hunter-planner-theme";

export type PlannerTheme = "light" | "dark";

export function resolvePlannerTheme(
  storedTheme: string | null,
  prefersDark: boolean,
): PlannerTheme {
  if (storedTheme === "dark" || storedTheme === "light") return storedTheme;
  return prefersDark ? "dark" : "light";
}
