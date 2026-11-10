import type { CatalogSection, CatalogTerm, Weekday } from "./catalog";

const TIME_ZONE = "America/New_York";
const SPRING_2027_START = "2027-01-28";
const SPRING_2027_END_UTC = "20270521T035959Z";

const DAY_NUMBER: Record<Weekday, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const BY_DAY: Record<Weekday, string> = {
  Sunday: "SU",
  Monday: "MO",
  Tuesday: "TU",
  Wednesday: "WE",
  Thursday: "TH",
  Friday: "FR",
  Saturday: "SA",
};

// Hunter's published Spring 2027 calendar. Substitution days are handled below.
// https://www.hunter.cuny.edu/students/registration/academic-calendar/
const NO_CLASS_DATES = [
  "2027-02-06",
  "2027-02-12",
  "2027-02-15",
  "2027-03-10",
  "2027-03-11",
  "2027-03-28",
  "2027-03-30",
  "2027-04-21",
  "2027-04-22",
  "2027-04-23",
  "2027-04-24",
  "2027-04-25",
  "2027-04-26",
  "2027-04-27",
  "2027-04-28",
  "2027-04-29",
  "2027-05-17",
] as const;

const MAKEUP_DATES: Partial<Record<Weekday, string[]>> = {
  Wednesday: ["2027-03-11"],
  Monday: ["2027-03-30"],
};

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function compactDate(date: string) {
  return date.replaceAll("-", "");
}

function compactDateTime(date: string, time: string) {
  return `${compactDate(date)}T${time.replaceAll(":", "").slice(0, 6)}`;
}

function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function firstOccurrence(day: Weekday) {
  const offset = (DAY_NUMBER[day] - weekdayOf(SPRING_2027_START) + 7) % 7;
  return addDays(SPRING_2027_START, offset);
}

function foldLine(line: string) {
  if (line.length <= 73) return [line];
  const chunks: string[] = [line.slice(0, 73)];
  for (let index = 73; index < line.length; index += 72) chunks.push(` ${line.slice(index, index + 72)}`);
  return chunks;
}

function eventLines(section: CatalogSection, generatedAt: string) {
  if (!section.meetings.length) {
    return [
      "BEGIN:VEVENT",
      `UID:${section.class_num}-tba@hunter-scheduler`,
      `DTSTAMP:${generatedAt}`,
      `DTSTART;VALUE=DATE:${compactDate(SPRING_2027_START)}`,
      `SUMMARY:${escapeIcs(`${section.course_code} — Online / TBA`)}`,
      `DESCRIPTION:${escapeIcs(`${section.course_name}. Class #${section.class_num}. This section has no scheduled meeting time.`)}`,
      "END:VEVENT",
    ];
  }

  return section.meetings.flatMap((meeting, meetingIndex) => meeting.days.flatMap((day) => {
    const firstDate = firstOccurrence(day);
    const excluded = NO_CLASS_DATES
      .filter((date) => weekdayOf(date) === DAY_NUMBER[day])
      .map((date) => compactDateTime(date, meeting.start_time));
    const makeup = (MAKEUP_DATES[day] ?? []).map((date) => compactDateTime(date, meeting.start_time));
    const description = [
      section.course_name,
      `Section ${section.section_number} · Class #${section.class_num}`,
      section.instructor ? `Instructor: ${section.instructor}` : null,
      "Planning aid only—confirm details in CUNYfirst.",
    ].filter(Boolean).join("\n");

    return [
      "BEGIN:VEVENT",
      `UID:${section.class_num}-${meetingIndex}-${BY_DAY[day]}@hunter-scheduler`,
      `DTSTAMP:${generatedAt}`,
      `DTSTART;TZID=${TIME_ZONE}:${compactDateTime(firstDate, meeting.start_time)}`,
      `DTEND;TZID=${TIME_ZONE}:${compactDateTime(firstDate, meeting.end_time)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BY_DAY[day]};UNTIL=${SPRING_2027_END_UTC}`,
      ...(excluded.length ? [`EXDATE;TZID=${TIME_ZONE}:${excluded.join(",")}`] : []),
      ...(makeup.length ? [`RDATE;TZID=${TIME_ZONE}:${makeup.join(",")}`] : []),
      `SUMMARY:${escapeIcs(section.course_code)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      ...(meeting.location ? [`LOCATION:${escapeIcs(meeting.location)}`] : []),
      "END:VEVENT",
    ];
  }));
}

export function createScheduleCalendar(name: string, term: CatalogTerm, sections: CatalogSection[]) {
  if (term.term_season !== "SPRING" || term.term_year !== 2027) {
    throw new Error("Calendar export is currently available for Spring 2027 schedules.");
  }

  const generatedAt = new Date().toISOString().replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hunter Student Scheduler//Schedule Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(`${name} — Spring 2027`)}`,
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    ...sections.flatMap((section) => eventLines(section, generatedAt)),
    "END:VCALENDAR",
  ];

  return `${lines.flatMap(foldLine).join("\r\n")}\r\n`;
}

export function downloadScheduleCalendar(name: string, term: CatalogTerm, sections: CatalogSection[]) {
  const calendar = createScheduleCalendar(name, term, sections);
  const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "hunter-schedule"}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}
