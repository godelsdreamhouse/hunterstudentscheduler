import type { PrototypeCourse } from "./courseFirstPrototype";

export interface SavedPrototypeSchedule {
  id: string;
  name: string;
  selectedCourseIds: string[];
  pins: string[];
}

export interface PrototypeState {
  activeId: string;
  schedules: SavedPrototypeSchedule[];
}

export function nextPrototypeScheduleNumber(schedules: SavedPrototypeSchedule[]) {
  const highest = schedules.reduce((maximum, schedule) => {
    const match = /^Prototype schedule (\d+)$/.exec(schedule.name.trim());
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return highest + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sanitizePrototypeState(value: unknown, courses: PrototypeCourse[]): PrototypeState | null {
  if (!isRecord(value) || !Array.isArray(value.schedules)) return null;

  const knownCourses = new Map(courses.map((course) => [course.id, course]));
  const seenScheduleIds = new Set<string>();
  const schedules: SavedPrototypeSchedule[] = [];

  for (const raw of value.schedules) {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim() || seenScheduleIds.has(raw.id)) continue;
    if (typeof raw.name !== "string" || !Array.isArray(raw.selectedCourseIds) || !Array.isArray(raw.pins)) continue;

    const selectedCourseIds = [...new Set(raw.selectedCourseIds.filter(
      (courseId): courseId is string => typeof courseId === "string" && knownCourses.has(courseId),
    ))];
    const selectedSet = new Set(selectedCourseIds);
    const validPins = new Set<string>();

    for (const pin of raw.pins) {
      if (typeof pin !== "string") continue;
      const courseId = selectedCourseIds.find((id) => pin.startsWith(`${id}:`));
      if (!courseId || !selectedSet.has(courseId)) continue;
      const sourceSectionId = pin.slice(courseId.length + 1);
      const validSourceIds = knownCourses.get(courseId)?.combinations.flatMap((combination) => combination.sections.map((section) => section.sourceSectionId)) ?? [];
      if (sourceSectionId && validSourceIds.includes(sourceSectionId)) validPins.add(`${courseId}:${sourceSectionId}`);
    }

    seenScheduleIds.add(raw.id);
    schedules.push({
      id: raw.id,
      name: raw.name.trim().slice(0, 100) || "Untitled prototype schedule",
      selectedCourseIds,
      pins: [...validPins],
    });
  }

  if (schedules.length === 0) return null;
  const requestedActiveId = typeof value.activeId === "string" ? value.activeId : "";
  return {
    activeId: schedules.some((schedule) => schedule.id === requestedActiveId) ? requestedActiveId : schedules[0].id,
    schedules,
  };
}
