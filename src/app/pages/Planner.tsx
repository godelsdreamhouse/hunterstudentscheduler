import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronRight, Download, Filter, List, LoaderCircle, Moon, Pencil, Plus, Search, Sun, Trash2, WandSparkles, X } from "lucide-react";
import { NavLink } from "react-router";
import {
  fetchCatalogAttributes,
  fetchCatalogTerms,
  searchCatalogSections,
  type CatalogMeeting,
  type CatalogSection,
  type CatalogTerm,
  type Weekday,
} from "../../lib/catalog";
import { downloadScheduleCalendar } from "../../lib/calendarExport";
import {
  createPlannerSchedule,
  readPlannerSchedules,
  writePlannerSchedules,
  type PlannerSchedule,
  type PlannerScheduleState,
} from "../../lib/plannerSchedules";
import styles from "./Planner.module.css";

const DAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const START_HOUR = 8;
const END_HOUR = 21;
const HOUR_HEIGHT = 34;
const SECTION_COLORS = [
  "#72e48e",
  "#e77be3",
  "#aaaef2",
  "#80b2ec",
  "#ef8294",
  "#70e5ad",
  "#f2a181",
  "#bcf391",
  "#f3bad5",
  "#9cebea",
  "#f4d477",
  "#d8ef78",
];
const DEFAULT_TERMS: CatalogTerm[] = [
  { term_season: "SPRING", term_year: 2027 },
];
const THEME_STORAGE_KEY = "hunter-planner-theme";

const PREVIEW_SECTIONS: CatalogSection[] = [
  {
    class_num: 12701,
    term_season: "SPRING",
    term_year: 2027,
    section_number: "01",
    section_component: "lecture",
    group_code: null,
    instructor: "Staff",
    instruction_mode: "in_person",
    max_enrollment: 30,
    enrollment: 18,
    waitlist_max_enrollment: 0,
    waitlist_count: 0,
    enrollment_status: "open",
    notes: null,
    course_id: "preview-csci-127",
    course_code: "CSCI 127",
    course_name: "Introduction to Computer Science",
    dep_code: "CSCI",
    course_description: null,
    credits: 3,
    prerequisites: [],
    corequisites: [],
    catalog_attributes: [],
    meetings: [{ days: ["Monday", "Wednesday"], start_time: "10:00:00", end_time: "11:15:00", location: "HN 1001" }],
  },
  {
    class_num: 15001,
    term_season: "SPRING",
    term_year: 2027,
    section_number: "03",
    section_component: "lecture",
    group_code: null,
    instructor: "Staff",
    instruction_mode: "in_person",
    max_enrollment: 28,
    enrollment: 12,
    waitlist_max_enrollment: 0,
    waitlist_count: 0,
    enrollment_status: "open",
    notes: null,
    course_id: "preview-math-150",
    course_code: "MATH 150",
    course_name: "Calculus with Analytic Geometry I",
    dep_code: "MATH",
    course_description: null,
    credits: 4,
    prerequisites: [],
    corequisites: [],
    catalog_attributes: [],
    meetings: [{ days: ["Tuesday", "Thursday"], start_time: "13:00:00", end_time: "14:15:00", location: "HN 511" }],
  },
];

function termKey(term: CatalogTerm) {
  return `${term.term_season}-${term.term_year}`;
}

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

function meetingsOverlap(a: CatalogMeeting, b: CatalogMeeting) {
  return a.days.some((day) => b.days.includes(day))
    && minutes(a.start_time) < minutes(b.end_time)
    && minutes(b.start_time) < minutes(a.end_time);
}

function conflictsWith(section: CatalogSection, selected: CatalogSection[]) {
  return selected.some((candidate) => candidate.meetings.some((a) => section.meetings.some((b) => meetingsOverlap(a, b))));
}

function alreadyHasCourse(section: CatalogSection, selected: CatalogSection[]) {
  return selected.some((candidate) => candidate.course_id === section.course_id && candidate.class_num !== section.class_num);
}

function formatMode(mode: CatalogSection["instruction_mode"]) {
  return mode.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isSectionOpen(section: CatalogSection) {
  if (section.enrollment_status != null) return section.enrollment_status === "open";
  return section.enrollment != null
    && section.max_enrollment != null
    && section.enrollment < section.max_enrollment;
}

function isUsefulAttribute(attribute: string) {
  return !attribute.toUpperCase().startsWith("COPT -")
    && !attribute.toLowerCase().includes("college option");
}

export function Planner() {
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSection[]>([]);
  const [saved, setSaved] = useState<PlannerScheduleState>(readPlannerSchedules);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [mode, setMode] = useState<"all" | CatalogSection["instruction_mode"]>("all");
  const [days, setDays] = useState<Weekday[]>([]);
  const [attributeQuery, setAttributeQuery] = useState("");
  const [attributeSuggestions, setAttributeSuggestions] = useState<string[]>([]);
  const [showConflicts, setShowConflicts] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"search" | "schedule">("search");
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState(() => {
    const count = Number(new URLSearchParams(window.location.search).get("imported"));
    return count > 0 ? `${count} smart schedule${count === 1 ? "" : "s"} added. You can edit, rename, or export any option.` : null;
  });
  const activeSchedule = saved.schedules.find((schedule) => schedule.id === saved.activeId) ?? saved.schedules[0];
  const term = activeSchedule?.term ?? DEFAULT_TERMS[0];
  const selected = activeSchedule?.sections ?? [];

  useEffect(() => {
    writePlannerSchedules(saved);
  }, [saved]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalogTerms(controller.signal)
      .then((available) => {
        const relevant = available.filter((item) => item.term_year === 2027 && item.term_season === "SPRING");
        if (relevant.length) {
          setTerms(relevant);
          const preferred = relevant.find((item) => item.term_season === "SPRING") ?? relevant[0];
          setSaved((current) => ({
            ...current,
            schedules: current.schedules.map((schedule) => schedule.id === current.activeId && schedule.sections.length === 0
              ? { ...schedule, term: preferred }
              : schedule),
          }));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalogAttributes(term, controller.signal)
      .then((attributes) => setAttributeSuggestions(attributes.filter(isUsefulAttribute)))
      .catch(() => setAttributeSuggestions([]));
    return () => controller.abort();
  }, [term]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchCatalogSections(term, query, 0, controller.signal, attributeQuery)
        .then((page) => {
          setResults(page.sections);
          setHasMore(page.pagination.has_more);
          setPreviewMode(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          const fallback = PREVIEW_SECTIONS.map((section) => ({ ...section, term_season: term.term_season, term_year: term.term_year })).filter((section) => {
            const text = `${section.course_code} ${section.course_name}`.toLowerCase();
            return text.includes(query.trim().toLowerCase());
          });
          setResults(fallback);
          setHasMore(false);
          setPreviewMode(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [attributeQuery, query, term]);

  function updateActiveSchedule(update: (schedule: PlannerSchedule) => PlannerSchedule) {
    setSaved((current) => ({
      ...current,
      schedules: current.schedules.map((schedule) => schedule.id === current.activeId ? update(schedule) : schedule),
    }));
  }

  function updateSelected(next: CatalogSection[]) {
    updateActiveSchedule((schedule) => ({ ...schedule, sections: next }));
  }

  function addSection(section: CatalogSection) {
    if (selected.some((item) => item.class_num === section.class_num)) return;
    if (alreadyHasCourse(section, selected)) {
      setNotice(`${section.course_code} is already represented by another section.`);
      return;
    }
    if (conflictsWith(section, selected)) {
      const match = selected.find((candidate) => candidate.meetings.some((a) => section.meetings.some((b) => meetingsOverlap(a, b))));
      setNotice(`${section.course_code} overlaps ${match?.course_code ?? "a selected course"}. Remove the conflict before adding it.`);
      return;
    }
    updateSelected([...selected, section]);
    setNotice(null);
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await searchCatalogSections(term, query, results.length, undefined, attributeQuery);
      setResults((current) => [...current, ...page.sections.filter((section) => !current.some((item) => item.class_num === section.class_num))]);
      setHasMore(page.pagination.has_more);
    } finally {
      setLoadingMore(false);
    }
  }

  function removeSection(classNumber: number) {
    updateSelected(selected.filter((section) => section.class_num !== classNumber));
  }

  function createNewSchedule() {
    const schedule = createPlannerSchedule(term, `Schedule ${saved.schedules.length + 1}`);
    setSaved((current) => ({ activeId: schedule.id, schedules: [...current.schedules, schedule] }));
  }

  function renameSchedule() {
    const name = window.prompt("Schedule name", activeSchedule.name)?.trim();
    if (name) updateActiveSchedule((schedule) => ({ ...schedule, name }));
  }

  function deleteSchedule() {
    if (saved.schedules.length === 1) {
      updateSelected([]);
      return;
    }
    const remaining = saved.schedules.filter((schedule) => schedule.id !== saved.activeId);
    setSaved({ activeId: remaining[0].id, schedules: remaining });
  }

  function exportSchedule() {
    try {
      downloadScheduleCalendar(activeSchedule.name, term, selected);
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Calendar export failed.");
    }
  }

  const filteredResults = useMemo(() => results.filter((section) => {
    if (openOnly && !isSectionOpen(section)) return false;
    if (mode !== "all" && section.instruction_mode !== mode) return false;
    if (days.length && !days.every((day) => section.meetings.some((meeting) => meeting.days.includes(day)))) return false;
    if (!showConflicts && conflictsWith(section, selected)) return false;
    return true;
  }), [days, mode, openOnly, results, selected, showConflicts]);

  return (
    <main className={`${styles.planner} ${darkMode ? styles.dark : ""} ${mobilePane === "schedule" ? styles.scheduleFocused : ""}`}>
      <h1 className="sr-only">Hunter Schedule Builder</h1>
      <section id="course-search-panel" role="tabpanel" aria-labelledby="course-search-tab" className={`${styles.mainPane} ${mobilePane === "schedule" ? styles.mobileHidden : ""}`}>
        <div className={styles.tabs} role="tablist" aria-label="Planner views">
          <button id="course-search-tab" type="button" role="tab" aria-controls="course-search-panel" aria-selected={mobilePane === "search"} className={`${styles.tab} ${mobilePane === "search" ? styles.tabActive : ""}`} onClick={() => setMobilePane("search")}>Course Search</button>
          <button id="schedule-tab" type="button" role="tab" aria-controls="schedule-panel" aria-selected={mobilePane === "schedule"} className={`${styles.tab} ${mobilePane === "schedule" ? styles.tabActive : ""}`} onClick={() => setMobilePane("schedule")}>Schedule</button>
        </div>

        <div className={styles.searchControls}>
          <select
            aria-label="Term"
            value={termKey(term)}
            onChange={(event) => {
              const next = terms.find((item) => termKey(item) === event.target.value);
              if (next) updateActiveSchedule((schedule) => ({ ...schedule, term: next, sections: [] }));
            }}
            className={styles.control}
          >
            {terms.map((item) => <option key={termKey(item)} value={termKey(item)}>SP{item.term_year}</option>)}
          </select>
          <div className={styles.searchBox}>
            <Search aria-hidden="true" />
            <input
              type="search"
              aria-label="Search courses and sections"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for codes, titles, instructors, locations…"
              className={styles.searchInput}
            />
          </div>
          <button type="button" className={styles.actionButton} onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} aria-controls="catalog-filters">
            <Filter aria-hidden="true" /> Filters
          </button>
        </div>

        {filtersOpen && (
          <div id="catalog-filters" className={styles.filterPanel} role="group" aria-label="Catalog filters">
            <button type="button" aria-pressed={openOnly} onClick={() => setOpenOnly((value) => !value)} className={`${styles.filterChip} ${openOnly ? styles.filterChipActive : ""}`}>Open seats</button>
            <select aria-label="Instruction mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className={styles.control}>
              <option value="all">All formats</option>
              <option value="in_person">In person</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
              <option value="asynchronous">Asynchronous</option>
            </select>
            <label className={styles.attributeFilter}>
              <Search aria-hidden="true" />
              <input
                type="search"
                list="catalog-attribute-suggestions"
                value={attributeQuery}
                onChange={(event) => setAttributeQuery(event.target.value)}
                placeholder="Course attribute, e.g. Writing Intensive"
                aria-label="Filter by course attribute"
              />
              <datalist id="catalog-attribute-suggestions">
                {attributeSuggestions.map((attribute) => <option key={attribute} value={attribute} />)}
              </datalist>
            </label>
            {DAYS.slice(0, 6).map((day) => (
              <button
                type="button"
                key={day}
                aria-label={`Filter ${day}`}
                aria-pressed={days.includes(day)}
                onClick={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])}
                className={`${styles.dayChip} ${days.includes(day) ? styles.dayChipActive : ""}`}
              >
                {day.slice(0, 1)}
              </button>
            ))}
          </div>
        )}

        {previewMode && <div className={styles.notice} role="alert"><span>Catalog is unavailable, so preview data is shown.</span></div>}
        {importNotice && <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status"><span>{importNotice}</span><button type="button" onClick={() => setImportNotice(null)} aria-label="Dismiss"><X /></button></div>}
        {notice && <div className={styles.notice} role="alert"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X /></button></div>}

        <div className={styles.results} aria-busy={loading}>
          {loading && <div className={styles.loading} role="status"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading sections</div>}
          {!loading && !filteredResults.length && <p className={styles.empty}>No sections match these filters.</p>}
          {!loading && filteredResults.map((section, resultIndex) => {
            const isSelected = selected.some((item) => item.class_num === section.class_num);
            const hasConflict = !isSelected && conflictsWith(section, selected);
            const hasAnotherSection = !isSelected && alreadyHasCourse(section, selected);
            const expanded = expandedClass === section.class_num;
            const sectionColor = SECTION_COLORS[resultIndex % SECTION_COLORS.length];
            const sectionOpen = isSectionOpen(section);
            return (
              <article
                key={section.class_num}
                className={`${styles.courseRow} ${isSelected ? styles.courseRowSelected : ""} ${hasConflict ? styles.courseRowConflict : ""}`}
                style={{ "--section-color": sectionColor } as CSSProperties}
              >
                <div className={styles.courseBar}>
                  <button type="button" className={`${styles.expandButton} ${expanded ? styles.expandButtonOpen : ""}`} onClick={() => setExpandedClass(expanded ? null : section.class_num)} aria-expanded={expanded} aria-controls={`section-${section.class_num}-details`} aria-label={`${expanded ? "Collapse" : "Expand"} ${section.course_code}`}>
                    <ChevronRight />
                  </button>
                  <strong className={styles.courseCode}>{section.course_code}-{section.section_number}</strong>
                  <button type="button" className={styles.courseTitle} onClick={() => setExpandedClass(expanded ? null : section.class_num)} aria-expanded={expanded} aria-controls={`section-${section.class_num}-details`}>{section.course_name}</button>
                  <span className={`${styles.statusBadge} ${sectionOpen ? "" : styles.statusClosed}`}>{sectionOpen ? "Open" : section.enrollment_status ?? "Closed"}</span>
                  <span className={styles.seatCount}>{section.enrollment ?? "?"}/{section.max_enrollment ?? "?"} seats filled</span>
                  <button
                    type="button"
                    aria-label={isSelected ? `Remove ${section.course_code}` : `Add ${section.course_code}`}
                    className={styles.addButton}
                    onClick={() => isSelected ? removeSection(section.class_num) : addSection(section)}
                  >
                    {isSelected ? <X /> : <Plus />}
                  </button>
                </div>
                {hasConflict && <p className={styles.rowMessage}>Time conflict with the selected schedule.</p>}
                {hasAnotherSection && <p className={styles.rowMessage}>Another section of this course is selected.</p>}
                {expanded && (
                  <div id={`section-${section.class_num}-details`} className={styles.details}>
                    <p><strong>Meeting</strong><br />{section.meetings.length ? section.meetings.map((meeting) => `${meeting.days.map((day) => day.slice(0, 3)).join("/")} ${displayTime(meeting.start_time)}–${displayTime(meeting.end_time)} · ${meeting.location ?? "TBA"}`).join("; ") : "Online / TBA"}</p>
                    <p><strong>Section</strong><br />Class #{section.class_num} · {formatMode(section.instruction_mode)}{section.instructor ? ` · ${section.instructor}` : ""} · {section.credits} credits</p>
                    {section.course_description && <p className={styles.detailsDescription}><strong>Description</strong><br />{section.course_description}</p>}
                    {section.catalog_attributes.some(isUsefulAttribute) && (
                      <div className={styles.detailsWide}>
                        <strong>Course attributes</strong>
                        <div className={styles.attributeList}>
                          {section.catalog_attributes.filter(isUsefulAttribute).map((attribute) => <span key={attribute}>{attribute}</span>)}
                        </div>
                      </div>
                    )}
                    {section.prerequisites.length > 0 && <p className={styles.detailsWide}><strong>Prerequisites</strong><br />{section.prerequisites.join(", ")}</p>}
                    {section.corequisites.length > 0 && <p className={styles.detailsWide}><strong>Corequisites</strong><br />{section.corequisites.join(", ")}</p>}
                    {section.notes && <p className={styles.detailsWide}><strong>Section notes</strong><br />{section.notes}</p>}
                  </div>
                )}
              </article>
            );
          })}
          {!loading && hasMore && !previewMode && (
            <button type="button" className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading more…" : "Load more sections"}
            </button>
          )}
        </div>
      </section>

      <aside id="schedule-panel" role="tabpanel" aria-labelledby="schedule-tab" className={`${styles.sidebar} ${mobilePane === "search" ? styles.mobileHidden : ""}`}>
        <div className={`${styles.tabs} ${styles.sidebarTabs}`} role="tablist" aria-label="Planner views">
          <button type="button" role="tab" aria-controls="course-search-panel" aria-selected={false} className={styles.tab} onClick={() => setMobilePane("search")}>Course Search</button>
          <button type="button" role="tab" aria-controls="schedule-panel" aria-selected className={`${styles.tab} ${styles.tabActive}`} onClick={() => setMobilePane("schedule")}>Schedule</button>
        </div>

        <div className={styles.toolbar}>
          <button type="button" className={styles.actionButton} onClick={exportSchedule} disabled={!selected.length}><Download /> Export calendar</button>
          <span className={styles.toolbarSpacer} />
          <NavLink to="/upload" className={styles.actionButton}><WandSparkles /> Smart Builder</NavLink>
          <button type="button" className={styles.iconButton} onClick={() => setDarkMode((value) => !value)} aria-label={`Use ${darkMode ? "light" : "dark"} mode`} title={`Use ${darkMode ? "light" : "dark"} mode`}>
            {darkMode ? <Sun /> : <Moon />}
          </button>
          <NavLink to="/" className={styles.brandMark} title="Hunter Schedule Builder">H</NavLink>
        </div>

        <div className={styles.calendarShell} role="region" aria-label="Weekly schedule calendar">
          <div className={styles.dayHeaders}>
            {DAYS.slice(0, 5).map((day) => <span key={day}>{day.slice(0, 3)}</span>)}
          </div>
          <div className={styles.timeColumn}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
              <span key={index} style={{ top: index * HOUR_HEIGHT }}>{displayTime(`${START_HOUR + index}:00`)}</span>
            ))}
          </div>
          <div className={styles.calendarGrid}>
            {DAYS.slice(0, 5).map((day) => (
              <div key={day} className={styles.dayColumn}>
                {selected.flatMap((section) => section.meetings.map((meeting, index) => ({ section, meeting, index })))
                  .filter(({ meeting }) => meeting.days.includes(day))
                  .map(({ section, meeting, index }) => {
                    const top = ((minutes(meeting.start_time) / 60) - START_HOUR) * HOUR_HEIGHT;
                    const height = Math.max(((minutes(meeting.end_time) - minutes(meeting.start_time)) / 60) * HOUR_HEIGHT, 26);
                    const selectedIndex = Math.max(selected.findIndex((item) => item.class_num === section.class_num), 0);
                    return (
                      <div key={`${section.class_num}-${index}`} className={styles.calendarCard} style={{ top, height, backgroundColor: SECTION_COLORS[selectedIndex % SECTION_COLORS.length] }}>
                        <strong>{section.course_code}</strong>
                        <span>{displayTime(meeting.start_time)}</span>
                        <button type="button" aria-label={`Remove ${section.course_code}`} onClick={() => removeSection(section.class_num)}><X /></button>
                      </div>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>

        <p className={styles.credits}>{selected.reduce((total, section) => total + section.credits, 0)} credits displayed</p>

        <div className={styles.scheduleControls}>
          <List />
          <select aria-label="Saved schedule" value={saved.activeId} onChange={(event) => setSaved((current) => ({ ...current, activeId: event.target.value }))} className={styles.scheduleSelect}>
            {saved.schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name} ({term.term_season.slice(0, 2)}{term.term_year})</option>)}
          </select>
          <button type="button" onClick={renameSchedule} className={styles.actionButton}><Pencil /> Edit</button>
          <button type="button" onClick={createNewSchedule} aria-label="Create schedule" className={styles.iconButton}><Plus /></button>
          <button type="button" onClick={deleteSchedule} aria-label="Delete schedule" className={styles.iconButton}><Trash2 /></button>
        </div>

        <div className={styles.conflictToggle}>
          <span id="conflict-toggle-label">show conflicting sections</span>
          <button type="button" role="switch" aria-labelledby="conflict-toggle-label" aria-checked={showConflicts} className={`${styles.switch} ${showConflicts ? styles.switchOn : ""}`} onClick={() => setShowConflicts((value) => !value)} />
        </div>

        <div className={styles.selectedList}>
          {activeSchedule.source === "degreeworks" && <p className={`${styles.notice} ${styles.noticeSuccess}`}>DegreeWorks suggestion{activeSchedule.score != null ? ` · score ${activeSchedule.score}` : ""}</p>}
          {selected.map((section, index) => (
            <div key={section.class_num} className={styles.selectedRow} style={{ backgroundColor: SECTION_COLORS[index % SECTION_COLORS.length] }}>
              <span><strong>{section.course_code}-{section.section_number}</strong> · {section.course_name}</span>
              <button type="button" onClick={() => removeSection(section.class_num)} aria-label={`Remove ${section.course_code}`}><X /></button>
            </div>
          ))}
          {!selected.length && <p className={styles.emptySelected}>Add a section to start building your schedule.</p>}
        </div>

        <p className={styles.footnote}>Hunter Schedule Builder · Spring 2027 · Planning aid only. Confirm enrollment details in CUNYfirst.</p>
      </aside>
    </main>
  );
}
