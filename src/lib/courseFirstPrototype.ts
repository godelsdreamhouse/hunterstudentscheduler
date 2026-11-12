export const PROTOTYPE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type PrototypeDay = (typeof PROTOTYPE_DAYS)[number];
export type PrototypeComponent = "lecture" | "lab" | "recitation" | "discussion";

export interface PrototypeMeeting {
  days: PrototypeDay[];
  startTime: string;
  endTime: string;
  location: string;
}

export interface PrototypeSection {
  sourceSectionId: string;
  classNumber: string;
  sectionNumber: string;
  component: PrototypeComponent;
  instructor: string;
  meetings: PrototypeMeeting[];
}

export interface EnrollmentCombination {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  term: string;
  session: string;
  associationIdentity: string;
  sourceRecordIds: string[];
  sections: PrototypeSection[];
}

export interface PrototypeCourse {
  id: string;
  code: string;
  title: string;
  description: string;
  combinations: EnrollmentCombination[];
}

export interface PrototypeScheduleOption {
  id: string;
  combinations: EnrollmentCombination[];
  sections: PrototypeSection[];
}

export interface SchedulePage {
  options: PrototypeScheduleOption[];
  hasMore: boolean;
  explanation: string | null;
}

function minuteValue(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function meetingsConflict(left: PrototypeMeeting, right: PrototypeMeeting) {
  const sharesDay = left.days.some((day) => right.days.includes(day));
  return sharesDay && minuteValue(left.startTime) < minuteValue(right.endTime) && minuteValue(right.startTime) < minuteValue(left.endTime);
}

export function sectionsConflict(left: PrototypeSection, right: PrototypeSection) {
  return left.meetings.some((leftMeeting) => right.meetings.some((rightMeeting) => meetingsConflict(leftMeeting, rightMeeting)));
}

function optionMatchesPins(combination: EnrollmentCombination, pins: ReadonlySet<string>) {
  const coursePins = [...pins].filter((pin) => pin.startsWith(`${combination.courseId}:`));
  return coursePins.every((pin) => combination.sections.some((section) => `${combination.courseId}:${section.sourceSectionId}` === pin));
}

export function enumerateSchedulePage(
  courses: PrototypeCourse[],
  selectedCourseIds: string[],
  pins: ReadonlySet<string>,
  offset: number,
  limit: number,
): SchedulePage {
  if (selectedCourseIds.length === 0) {
    return { options: [], hasMore: false, explanation: "Select at least one course to explore complete enrollment options." };
  }

  const selected = selectedCourseIds.map((id) => courses.find((course) => course.id === id)).filter((course): course is PrototypeCourse => Boolean(course));
  if (selected.length !== selectedCourseIds.length) {
    return { options: [], hasMore: false, explanation: "One selected synthetic course is no longer available. Remove it and try again." };
  }

  const candidates = selected.map((course) => course.combinations.filter((combination) => optionMatchesPins(combination, pins)));
  const blockedIndex = candidates.findIndex((combinations) => combinations.length === 0);
  if (blockedIndex >= 0) {
    return {
      options: [],
      hasMore: false,
      explanation: `No enrollment combination for ${selected[blockedIndex].code} contains every pinned section. Unpin a section to continue.`,
    };
  }

  const wanted = Math.max(1, offset + limit + 1);
  const found: PrototypeScheduleOption[] = [];

  function visit(courseIndex: number, chosen: EnrollmentCombination[], sections: PrototypeSection[]) {
    if (found.length >= wanted) return;
    if (courseIndex === candidates.length) {
      found.push({
        id: chosen.map((combination) => combination.id).join("+"),
        combinations: [...chosen],
        sections: [...sections],
      });
      return;
    }

    for (const combination of candidates[courseIndex]) {
      const conflicts = combination.sections.some((section) => sections.some((existing) => sectionsConflict(section, existing)));
      if (!conflicts) visit(courseIndex + 1, [...chosen, combination], [...sections, ...combination.sections]);
      if (found.length >= wanted) return;
    }
  }

  visit(0, [], []);
  const page = found.slice(offset, offset + limit);
  return {
    options: page,
    hasMore: found.length > offset + limit,
    explanation: page.length === 0
      ? "No complete conflict-free option exists for these courses and pins. Their supplied enrollment combinations overlap in time; change a course or unpin a section."
      : null,
  };
}

export function searchPrototypeCourses(courses: PrototypeCourse[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return courses;
  return courses.filter((course) => `${course.code} ${course.title} ${course.description}`.toLowerCase().includes(normalized));
}
