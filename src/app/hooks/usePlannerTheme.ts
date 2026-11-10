import { useEffect, useState } from "react";
import {
  PLANNER_THEME_STORAGE_KEY,
  resolvePlannerTheme,
  type PlannerTheme,
} from "../../lib/plannerTheme";

function readTheme(): PlannerTheme {
  try {
    return resolvePlannerTheme(
      window.localStorage.getItem(PLANNER_THEME_STORAGE_KEY),
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    );
  } catch {
    return "light";
  }
}

export function usePlannerTheme() {
  const [theme, setTheme] = useState<PlannerTheme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.plannerTheme = theme;
    try {
      window.localStorage.setItem(PLANNER_THEME_STORAGE_KEY, theme);
    } catch {
      // A blocked storage write should not prevent the selected theme from applying.
    }
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.key !== PLANNER_THEME_STORAGE_KEY) return;
      setTheme(resolvePlannerTheme(event.newValue, false));
    };
    window.addEventListener("storage", syncTheme);
    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  return {
    darkMode: theme === "dark",
    setDarkMode: (darkMode: boolean) => setTheme(darkMode ? "dark" : "light"),
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
  };
}

