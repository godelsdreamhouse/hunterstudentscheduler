import { useState, useEffect } from "react";

const STORAGE_KEY = "watchtower_preferences";

interface SchedulePreferences {
  backToBack: boolean;
  morningClasses: boolean;
  midDayClasses: boolean;
  eveningClasses: boolean;
  minimizeDays: boolean;
  preferInPerson: boolean;
  preferRemote: boolean;
}

interface PersistedState {
  semester: string;
  creditRange: number[];
  blockedTimes: Record<string, string[]>;
  preferences: SchedulePreferences;
  preferredDepartments: string[];
  specificCourses: string;
}

const DEFAULTS: PersistedState = {
  // TODO: hardcoded - replace with upcoming semester derived from current date
  semester: "fall-2026",
  // TODO: hardcoded - replace with default credit range from app config
  creditRange: [12, 15],
  blockedTimes: {},
  preferences: {
    backToBack: false,
    morningClasses: false,
    midDayClasses: false,
    eveningClasses: false,
    minimizeDays: false,
    preferInPerson: false,
    preferRemote: false,
  },
  preferredDepartments: [],
  specificCourses: "",
};

function read(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) as PersistedState };
  } catch {}
  return DEFAULTS;
}

export function usePersistedPreferences() {
  const saved = read();

  const [semester, setSemester] = useState(saved.semester);
  const [creditRange, setCreditRange] = useState(saved.creditRange);
  const [blockedTimes, setBlockedTimes] = useState<Record<string, Set<string>>>(
    () => Object.fromEntries(Object.entries(saved.blockedTimes).map(([k, v]) => [k, new Set(v)]))
  );
  const [preferences, setPreferences] = useState<SchedulePreferences>(saved.preferences);
  const [preferredDepartments, setPreferredDepartments] = useState(saved.preferredDepartments);
  const [specificCourses, setSpecificCourses] = useState(saved.specificCourses);

  useEffect(() => {
    const serializable: PersistedState = {
      semester,
      creditRange,
      blockedTimes: Object.fromEntries(Object.entries(blockedTimes).map(([k, v]) => [k, [...v]])),
      preferences,
      preferredDepartments,
      specificCourses,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }, [semester, creditRange, blockedTimes, preferences, preferredDepartments, specificCourses]);

  return {
    semester, setSemester,
    creditRange, setCreditRange,
    blockedTimes, setBlockedTimes,
    preferences, setPreferences,
    preferredDepartments, setPreferredDepartments,
    specificCourses, setSpecificCourses,
  };
}
