type FocusTarget = Pick<HTMLElement, "focus">;
type FocusScheduler = (callback: () => void) => unknown;

/** Focuses the visible course-search control after the schedule pane is reset. */
export function schedulePlannerSearchFocus(
  target: FocusTarget | null,
  schedule: FocusScheduler = (callback) => window.requestAnimationFrame(callback),
): void {
  if (!target) return;
  schedule(() => target.focus());
}
