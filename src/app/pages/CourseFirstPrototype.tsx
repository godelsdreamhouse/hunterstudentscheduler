import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, FlaskConical, Pin, Plus, Search, Trash2 } from "lucide-react";
import {
  PROTOTYPE_DAYS,
  enumerateSchedulePage,
  searchPrototypeCourses,
  type PrototypeCourse,
  type PrototypeSection,
} from "../../lib/courseFirstPrototype";
import { PROTOTYPE_COURSES } from "../../lib/courseFirstPrototypeFixtures";
import styles from "./CourseFirstPrototype.module.css";

interface SavedPrototypeSchedule {
  id: string;
  name: string;
  selectedCourseIds: string[];
  pins: string[];
}

interface PrototypeState {
  activeId: string;
  schedules: SavedPrototypeSchedule[];
}

const STORAGE_KEY = "satisfi-course-first-prototype-v1";
const PAGE_SIZE = 6;
const START_HOUR = 8;
const END_HOUR = 22;
const HOUR_HEIGHT = 44;
const COLORS = ["#7bd99a", "#f2af72", "#8ec5f5", "#d5a2ee"];

function freshSchedule(number = 1): SavedPrototypeSchedule {
  return { id: crypto.randomUUID(), name: `Prototype schedule ${number}`, selectedCourseIds: [], pins: [] };
}

function readState(): PrototypeState {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PrototypeState> | null;
    if (parsed?.activeId && Array.isArray(parsed.schedules) && parsed.schedules.length > 0) {
      const schedules = parsed.schedules.filter((item): item is SavedPrototypeSchedule =>
        Boolean(item && typeof item.id === "string" && typeof item.name === "string" && Array.isArray(item.selectedCourseIds) && Array.isArray(item.pins)),
      );
      if (schedules.length > 0) return { activeId: schedules.some((item) => item.id === parsed.activeId) ? parsed.activeId : schedules[0].id, schedules };
    }
  } catch {
    // Invalid prototype-only data is replaced without touching production planner storage.
  }
  const initial = freshSchedule();
  return { activeId: initial.id, schedules: [initial] };
}

function minutes(time: string) {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function displayTime(time: string) {
  const total = minutes(time);
  const hour = Math.floor(total / 60);
  return `${hour % 12 || 12}:${String(total % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function sectionLabel(section: PrototypeSection) {
  return `${section.component} ${section.sectionNumber} · class ${section.classNumber}`;
}

function uniqueSections(course: PrototypeCourse) {
  return [...new Map(course.combinations.flatMap((combination) => combination.sections).map((section) => [section.sourceSectionId, section])).values()];
}

export function CourseFirstPrototype() {
  const [state, setState] = useState<PrototypeState>(readState);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [alternativeIndex, setAlternativeIndex] = useState(0);
  const active = state.schedules.find((schedule) => schedule.id === state.activeId) ?? state.schedules[0];
  const pins = useMemo(() => new Set(active.pins), [active.pins]);
  const generated = useMemo(
    () => enumerateSchedulePage(PROTOTYPE_COURSES, active.selectedCourseIds, pins, 0, visibleCount),
    [active.selectedCourseIds, pins, visibleCount],
  );
  const option = generated.options[alternativeIndex] ?? generated.options[0];
  const results = useMemo(() => searchPrototypeCourses(PROTOTYPE_COURSES, query), [query]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    setAlternativeIndex(0);
    setVisibleCount(PAGE_SIZE);
  }, [active.id, active.pins, active.selectedCourseIds]);

  function updateActive(update: (schedule: SavedPrototypeSchedule) => SavedPrototypeSchedule) {
    setState((current) => ({
      ...current,
      schedules: current.schedules.map((schedule) => schedule.id === current.activeId ? update(schedule) : schedule),
    }));
  }

  function toggleCourse(courseId: string) {
    updateActive((schedule) => {
      const selected = schedule.selectedCourseIds.includes(courseId);
      return {
        ...schedule,
        selectedCourseIds: selected ? schedule.selectedCourseIds.filter((id) => id !== courseId) : [...schedule.selectedCourseIds, courseId],
        pins: selected ? schedule.pins.filter((pin) => !pin.startsWith(`${courseId}:`)) : schedule.pins,
      };
    });
  }

  function togglePin(courseId: string, sourceSectionId: string) {
    const key = `${courseId}:${sourceSectionId}`;
    updateActive((schedule) => ({ ...schedule, pins: schedule.pins.includes(key) ? schedule.pins.filter((pin) => pin !== key) : [...schedule.pins, key] }));
  }

  function addSchedule() {
    const next = freshSchedule(state.schedules.length + 1);
    setState((current) => ({ activeId: next.id, schedules: [...current.schedules, next] }));
  }

  function deleteSchedule() {
    if (state.schedules.length === 1) {
      const replacement = freshSchedule();
      setState({ activeId: replacement.id, schedules: [replacement] });
      return;
    }
    const remaining = state.schedules.filter((schedule) => schedule.id !== active.id);
    setState({ activeId: remaining[0].id, schedules: remaining });
  }

  function nextAlternative() {
    if (alternativeIndex + 1 < generated.options.length) {
      setAlternativeIndex((index) => index + 1);
    } else if (generated.hasMore) {
      setVisibleCount((count) => count + PAGE_SIZE);
      setAlternativeIndex((index) => index + 1);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}><FlaskConical aria-hidden="true" /> Research prototype</div>
          <h1>Course-first schedule explorer</h1>
          <p>Synthetic data only. This prototype is not connected to Hunter’s live catalog and must not be used to enroll.</p>
        </div>
        <a href="/planner">Return to production planner</a>
      </header>

      <section className={styles.workspace}>
        <aside className={styles.coursePane} aria-label="Choose synthetic courses">
          <div className={styles.scheduleTools}>
            <label>
              Saved prototype schedule
              <select value={state.activeId} onChange={(event) => setState((current) => ({ ...current, activeId: event.target.value }))}>
                {state.schedules.map((schedule) => <option value={schedule.id} key={schedule.id}>{schedule.name}</option>)}
              </select>
            </label>
            <div className={styles.toolButtons}>
              <button type="button" onClick={addSchedule}><Plus aria-hidden="true" /> New</button>
              <button type="button" onClick={deleteSchedule}><Trash2 aria-hidden="true" /> Delete</button>
            </div>
            <label>
              Schedule name
              <input value={active.name} onChange={(event) => updateActive((schedule) => ({ ...schedule, name: event.target.value }))} />
            </label>
            <p>Saved only in this browser under a prototype-specific key.</p>
          </div>

          <label className={styles.search}>
            <Search aria-hidden="true" />
            <span className={styles.srOnly}>Search courses</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses, not sections" />
          </label>

          <div className={styles.results}>
            <p className={styles.resultCount}>{results.length} course{results.length === 1 ? "" : "s"}</p>
            {results.map((course) => {
              const selected = active.selectedCourseIds.includes(course.id);
              return (
                <article className={styles.courseCard} key={course.id}>
                  <div>
                    <h2>{course.code}</h2>
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                    <small>{course.combinations.length} supplied complete combination{course.combinations.length === 1 ? "" : "s"}</small>
                  </div>
                  <button type="button" aria-pressed={selected} onClick={() => toggleCourse(course.id)}>
                    {selected ? "Remove course" : "Select course"}
                  </button>
                </article>
              );
            })}
          </div>
        </aside>

        <section className={styles.explorer} aria-label="Schedule alternatives">
          <div className={styles.selectionSummary}>
            <div>
              <span>Selected courses</span>
              <strong>{active.selectedCourseIds.length}</strong>
            </div>
            <div>
              <span>Pinned sections</span>
              <strong>{active.pins.length}</strong>
            </div>
            <div>
              <span>Loaded alternatives</span>
              <strong>{generated.options.length}{generated.hasMore ? "+" : ""}</strong>
            </div>
          </div>

          {active.selectedCourseIds.length > 0 && (
            <details className={styles.pins}>
              <summary>Pin preferred sections</summary>
              <p>Pins constrain supplied combinations. Pinning sections from different associations may intentionally produce no result.</p>
              {active.selectedCourseIds.map((courseId) => {
                const course = PROTOTYPE_COURSES.find((item) => item.id === courseId);
                if (!course) return null;
                return (
                  <fieldset key={course.id}>
                    <legend>{course.code}</legend>
                    {uniqueSections(course).map((section) => {
                      const key = `${course.id}:${section.sourceSectionId}`;
                      return (
                        <label key={key}>
                          <input type="checkbox" checked={pins.has(key)} onChange={() => togglePin(course.id, section.sourceSectionId)} />
                          <Pin aria-hidden="true" /> {sectionLabel(section)}
                        </label>
                      );
                    })}
                  </fieldset>
                );
              })}
            </details>
          )}

          <div className={styles.alternativeBar}>
            <button type="button" disabled={alternativeIndex === 0} onClick={() => setAlternativeIndex((index) => Math.max(0, index - 1))} aria-label="Previous alternative">
              <ChevronLeft aria-hidden="true" /> Previous
            </button>
            <strong aria-live="polite">{option ? `Alternative ${alternativeIndex + 1}` : "No alternative"}</strong>
            <button type="button" disabled={!option || (!generated.hasMore && alternativeIndex >= generated.options.length - 1)} onClick={nextAlternative}>
              Next <ChevronRight aria-hidden="true" />
            </button>
          </div>

          {generated.explanation && <div className={styles.empty} role="status"><h2>No complete schedule</h2><p>{generated.explanation}</p></div>}
          {option && <PrototypeCalendar sections={option.sections} courses={option.combinations.map((item) => item.courseId)} />}

          {option && (
            <div className={styles.evidence}>
              <h2>Supplied enrollment evidence</h2>
              <p>Every row below came from one complete synthetic association; time compatibility was used only after those associations were supplied.</p>
              {option.combinations.map((combination) => (
                <article key={combination.id}>
                  <h3>{combination.courseCode}: {combination.courseTitle}</h3>
                  <dl>
                    <div><dt>Term / session</dt><dd>{combination.term} / {combination.session}</dd></div>
                    <div><dt>Association</dt><dd>{combination.associationIdentity}</dd></div>
                    <div><dt>Source IDs</dt><dd>{combination.sourceRecordIds.join(", ")}</dd></div>
                  </dl>
                  <ul>{combination.sections.map((section) => <li key={section.sourceSectionId}>{sectionLabel(section)} — {section.instructor}</li>)}</ul>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function PrototypeCalendar({ sections, courses }: { sections: PrototypeSection[]; courses: string[] }) {
  return (
    <div className={styles.calendarRegion}>
      <h2>Monday–Sunday calendar</h2>
      <div className={styles.calendarScroll} tabIndex={0} aria-label="Seven-day schedule calendar; scroll horizontally on narrow screens">
        <div className={styles.calendar} style={{ "--calendar-height": `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` } as CSSProperties}>
          <div className={styles.corner} />
          {PROTOTYPE_DAYS.map((day) => <div className={styles.dayHeader} key={day}>{day.slice(0, 3)}</div>)}
          <div className={styles.times}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => <span key={index} style={{ top: index * HOUR_HEIGHT }}>{displayTime(`${START_HOUR + index}:00`)}</span>)}
          </div>
          {PROTOTYPE_DAYS.map((day) => (
            <div className={styles.dayColumn} key={day}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => <i key={index} style={{ top: index * HOUR_HEIGHT }} />)}
              {sections.flatMap((section) => section.meetings.filter((meeting) => meeting.days.includes(day)).map((meeting) => {
                const top = (minutes(meeting.startTime) - START_HOUR * 60) / 60 * HOUR_HEIGHT;
                const height = (minutes(meeting.endTime) - minutes(meeting.startTime)) / 60 * HOUR_HEIGHT;
                const courseId = courses.find((id) => section.sourceSectionId.startsWith(id)) ?? courses[0];
                const color = COLORS[Math.max(0, courses.indexOf(courseId)) % COLORS.length];
                return (
                  <article className={styles.event} key={`${section.sourceSectionId}-${day}`} style={{ top, height, background: color }} title={`${sectionLabel(section)}, ${displayTime(meeting.startTime)}–${displayTime(meeting.endTime)}`}>
                    <strong>{section.sourceSectionId.split("-").slice(0, 2).join(" ").toUpperCase()}</strong>
                    <span>{section.component} {section.sectionNumber}</span>
                    <small>{displayTime(meeting.startTime)}–{displayTime(meeting.endTime)}</small>
                  </article>
                );
              }))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
