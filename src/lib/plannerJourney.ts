import type { CatalogMeeting, CatalogSection, Weekday } from "./catalog";

function minutes(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function meetingsOverlap(a: CatalogMeeting, b: CatalogMeeting) {
  return a.days.some((day) => b.days.includes(day))
    && minutes(a.start_time) < minutes(b.end_time)
    && minutes(b.start_time) < minutes(a.end_time);
}

export function conflictingSection(section: CatalogSection, selected: CatalogSection[]) {
  return selected.find((candidate) => candidate.meetings.some(
    (a) => section.meetings.some((b) => meetingsOverlap(a, b)),
  ));
}

export function conflictsWith(section: CatalogSection, selected: CatalogSection[]) {
  return conflictingSection(section, selected) !== undefined;
}

export function alreadyHasCourse(section: CatalogSection, selected: CatalogSection[]) {
  return selected.some((candidate) => (
    candidate.course_id === section.course_id && candidate.class_num !== section.class_num
  ));
}

export type AddSectionResult = {
  sections: CatalogSection[];
  reason?: "already-selected" | "duplicate-course" | "time-conflict";
  conflictingCourseCode?: string;
};

export function addSectionToSchedule(
  selected: CatalogSection[],
  section: CatalogSection,
): AddSectionResult {
  if (selected.some((item) => item.class_num === section.class_num)) {
    return { sections: selected, reason: "already-selected" };
  }
  if (alreadyHasCourse(section, selected)) {
    return { sections: selected, reason: "duplicate-course" };
  }
  const conflict = conflictingSection(section, selected);
  if (conflict) {
    return {
      sections: selected,
      reason: "time-conflict",
      conflictingCourseCode: conflict.course_code,
    };
  }
  return { sections: [...selected, section] };
}

export function removeSectionFromSchedule(selected: CatalogSection[], classNumber: number) {
  return selected.filter((section) => section.class_num !== classNumber);
}

export function isSectionOpen(section: CatalogSection) {
  if (section.enrollment_status != null) return section.enrollment_status === "open";
  return section.enrollment != null
    && section.max_enrollment != null
    && section.enrollment < section.max_enrollment;
}

type PlannerFilters = {
  openOnly: boolean;
  mode: "all" | CatalogSection["instruction_mode"];
  days: Weekday[];
  showConflicts: boolean;
};

export function filterPlannerSections(
  sections: CatalogSection[],
  selected: CatalogSection[],
  filters: PlannerFilters,
) {
  return sections.filter((section) => {
    if (filters.openOnly && !isSectionOpen(section)) return false;
    if (filters.mode !== "all" && section.instruction_mode !== filters.mode) return false;
    if (filters.days.length && !filters.days.every((day) => (
      section.meetings.some((meeting) => meeting.days.includes(day))
    ))) return false;
    if (!filters.showConflicts && conflictsWith(section, selected)) return false;
    return true;
  });
}
