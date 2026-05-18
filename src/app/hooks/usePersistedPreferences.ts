import { useState, useEffect } from "react";
import { DEFAULT_CREDIT_RANGE, getDefaultSemester } from "../constants/preferences";

const STORAGE_KEY = "watchtower_preferences";

export interface ElectiveCourse {
  id: string;
  code: string;
  name: string;
}

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
  specificCoursesList: ElectiveCourse[];
  electiveCourses: ElectiveCourse[];
}

const DEFAULTS: PersistedState = {
  semester: getDefaultSemester(),
  creditRange: [...DEFAULT_CREDIT_RANGE],
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
  specificCoursesList: [],
  electiveCourses: [],
};

function read(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) as PersistedState };
  } catch {}
  return DEFAULTS;
}

export function readPersistedPreferences(): PersistedState {
  return read();
}

export function clearPersistedPreferences(): void {
  localStorage.removeItem(STORAGE_KEY);
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
  const [specificCoursesList, setSpecificCoursesList] = useState<ElectiveCourse[]>(saved.specificCoursesList);
  const [electiveCourses, setElectiveCourses] = useState<ElectiveCourse[]>(saved.electiveCourses);

  useEffect(() => {
    const serializable: PersistedState = {
      semester,
      creditRange,
      blockedTimes: Object.fromEntries(Object.entries(blockedTimes).map(([k, v]) => [k, [...v]])),
      preferences,
      preferredDepartments,
      specificCoursesList,
      electiveCourses,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }, [semester, creditRange, blockedTimes, preferences, preferredDepartments, specificCoursesList, electiveCourses]);

  return {
    semester, setSemester,
    creditRange, setCreditRange,
    blockedTimes, setBlockedTimes,
    preferences, setPreferences,
    preferredDepartments, setPreferredDepartments,
    specificCoursesList, setSpecificCoursesList,
    electiveCourses, setElectiveCourses,
  };
}
