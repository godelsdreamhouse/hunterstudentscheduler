export const DEFAULT_CREDIT_RANGE = [3, 18] as const;

export function getUpcomingSemesters(count = 2): { value: string; label: string }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Spring=Jan(0), Summer=Jun(5), Fall=Sep(8)
  const schedule = [
    { name: "Spring", startMonth: 0 },
    { name: "Summer", startMonth: 5 },
    { name: "Fall", startMonth: 8 },
  ];

  const results: { value: string; label: string }[] = [];
  let y = year;

  while (results.length < count) {
    for (const sem of schedule) {
      if (results.length >= count) break;
      if (y > year || sem.startMonth > month) {
        results.push({ value: `${sem.name.toLowerCase()}-${y}`, label: `${sem.name} ${y}` });
      }
    }
    y++;
  }

  return results;
}

export function getDefaultSemester(): string {
  return getUpcomingSemesters(1)[0]?.value ?? "fall-2026";
}
