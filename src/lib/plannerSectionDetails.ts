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

function formatWaitlist(section: CatalogSection) {
  const published = section.waitlist_count != null && (
    section.waitlist_count > 0
    || (section.waitlist_max_enrollment != null && section.waitlist_max_enrollment > 0)
  );
  return published
    ? `Waitlist ${section.waitlist_count}${section.waitlist_max_enrollment != null && section.waitlist_max_enrollment > 0 ? `/${section.waitlist_max_enrollment}` : ""}`
    : null;
}

export function formatSelectedEnrollment(section: CatalogSection) {
  const capacityPublished = section.max_enrollment != null && section.max_enrollment > 0;
  const status = section.enrollment_status
    ? section.enrollment_status.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : null;
  const waitlist = formatWaitlist(section);

  if (section.enrollment == null && !capacityPublished && !status && !waitlist) {
    return "Not available";
  }
  const enrollment = capacityPublished
    ? `${section.enrollment ?? "?"}/${section.max_enrollment}`
    : `${section.enrollment != null ? `${section.enrollment} enrolled · ` : ""}Capacity not published`;
  return [enrollment, status, waitlist].filter(Boolean).join(" · ");
}

export function formatSearchEnrollment(section: CatalogSection) {
  const capacityPublished = section.max_enrollment != null && section.max_enrollment > 0;
  const enrollment = capacityPublished
    ? `${section.enrollment ?? "?"}/${section.max_enrollment} seats filled`
    : `${section.enrollment != null ? `${section.enrollment} enrolled · ` : ""}Capacity not published`;
  return [enrollment, formatWaitlist(section)].filter(Boolean).join(" · ");
}
