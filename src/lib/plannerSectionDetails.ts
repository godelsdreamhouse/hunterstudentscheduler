import type { CatalogSection } from "./catalog";

function minutes(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function displayTime(time: string) {
  const value = minutes(time);
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export function formatSectionComponent(component: string | null) {
  return component?.trim()
    ? component.replace(/[_-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Component TBA";
}

export function formatSelectedMeetings(section: CatalogSection) {
  if (!section.meetings.length) return ["Meeting TBA"];

  return section.meetings.map((meeting) => {
    const meetingDays = meeting.days.length
      ? meeting.days.map((day) => day.slice(0, 3)).join("/")
      : "Days TBA";
    const meetingTime = meeting.start_time && meeting.end_time
      ? `${displayTime(meeting.start_time)}–${displayTime(meeting.end_time)}`
      : "Time TBA";
    return `${meetingDays} · ${meetingTime} · ${meeting.location || "Location TBA"}`;
  });
}

export function formatSelectedEnrollment(section: CatalogSection) {
  const enrollment = section.enrollment ?? "?";
  const capacity = section.max_enrollment ?? "?";
  const status = section.enrollment_status
    ? section.enrollment_status.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;

  if (section.enrollment == null && section.max_enrollment == null && !status) {
    return "Not available";
  }
  return `${enrollment}/${capacity}${status ? ` · ${status}` : ""}`;
}
