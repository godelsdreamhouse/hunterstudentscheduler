import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronRight, Download, Filter, List, LoaderCircle, Moon, Pencil, Plus, Search, Sun, Trash2, WandSparkles, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { BetaNotice } from "../components/BetaNotice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { clearPlanningData } from "../utils/clearPlanningData";
import { schedulePlannerSearchFocus } from "../../lib/plannerReset";
import {
  fetchCatalogAttributes,
  fetchCatalogTerms,
  searchCatalogSections,
  type CatalogSection,
  type CatalogTerm,
  type Weekday,
} from "../../lib/catalog";
import { downloadScheduleCalendar } from "../../lib/calendarExport";
import { formatCatalogAttribute, isStudentFacingCatalogAttribute } from "../../lib/catalogFilters";
import { appendUniqueCatalogSections, createCatalogPaginationGuard } from "../../lib/catalogPagination";
import {
  addSectionToSchedule,
  alreadyHasCourse,
  conflictsWith,
  filterPlannerSections,
  removeSectionFromSchedule,
} from "../../lib/plannerJourney";
import {
  createPlannerSchedule,
  readPlannerSchedules,
  writePlannerSchedules,
  type PlannerSchedule,
  type PlannerScheduleState,
} from "../../lib/plannerSchedules";
import {
  formatSectionComponent,
  formatSearchEnrollment,
  formatSelectedEnrollment,
  formatSelectedMeetings,
} from "../../lib/plannerSectionDetails";
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
const STORAGE_WARNING = "Browser storage is unavailable. Schedule and display changes may not persist; do not rely on this device to keep them.";

function systemPrefersDarkMode() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function readInitialTheme() {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return {
      darkMode: savedTheme ? savedTheme === "dark" : systemPrefersDarkMode(),
      storageUnavailable: false,
    };
  } catch {
    return { darkMode: systemPrefersDarkMode(), storageUnavailable: true };
  }
}

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

function formatMode(mode: CatalogSection["instruction_mode"]) {
  return mode.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function Planner() {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearSucceededRef = useRef(false);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const [catalogPaginationGuard] = useState(() => createCatalogPaginationGuard());
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSection[]>([]);
  const [saved, setSaved] = useState<PlannerScheduleState>(readPlannerSchedules);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [hideFull, setHideFull] = useState(false);
  const [mode, setMode] = useState<"all" | CatalogSection["instruction_mode"]>("all");
  const [days, setDays] = useState<Weekday[]>([]);
  const [attributeQuery, setAttributeQuery] = useState("");
  const [attributeSuggestions, setAttributeSuggestions] = useState<string[]>([]);
  const [showConflicts, setShowConflicts] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"search" | "schedule">("search");
  const [initialTheme] = useState(readInitialTheme);
  const [darkMode, setDarkMode] = useState(initialTheme.darkMode);
  const [expandedClass, setExpandedClass] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(
    initialTheme.storageUnavailable ? STORAGE_WARNING : null,
  );
  const [clearError, setClearError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState(() => {
    const count = Number(new URLSearchParams(window.location.search).get("imported"));
    return count > 0 ? `${count} smart schedule${count === 1 ? "" : "s"} added. You can edit, rename, or export any option.` : null;
  });
  const activeSchedule = saved.schedules.find((schedule) => schedule.id === saved.activeId) ?? saved.schedules[0];
  const term = activeSchedule?.term ?? DEFAULT_TERMS[0];
  const selected = activeSchedule?.sections ?? [];

  useEffect(() => {
    try {
      writePlannerSchedules(saved);
    } catch {
      setStorageWarning(STORAGE_WARNING);
    }
  }, [saved]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
    } catch {
      setStorageWarning(STORAGE_WARNING);
    }
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
      .then((attributes) => setAttributeSuggestions(attributes.filter(isStudentFacingCatalogAttribute)))
      .catch(() => setAttributeSuggestions([]));
    return () => controller.abort();
  }, [term]);

  useEffect(() => {
    const controller = new AbortController();
    const generation = catalogPaginationGuard.beginDataset();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = null;
    setLoadingMore(false);
    setLoading(true);
    setCatalogError(null);
    const timer = window.setTimeout(() => {
      searchCatalogSections(term, query, 0, controller.signal, attributeQuery, hideFull)
        .then((page) => {
          if (!catalogPaginationGuard.accepts(generation)) return;
          setResults(page.sections);
          setHasMore(page.pagination.has_more);
          setCatalogError(null);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (!catalogPaginationGuard.accepts(generation)) return;
          setResults([]);
          setHasMore(false);
          setCatalogError("Live catalog sections are unavailable right now. No course results are being shown. Try again before adding sections.");
        })
        .finally(() => {
          if (!controller.signal.aborted && catalogPaginationGuard.accepts(generation)) setLoading(false);
        });
    }, 250);
    return () => {
      controller.abort();
      loadMoreControllerRef.current?.abort();
      loadMoreControllerRef.current = null;
      window.clearTimeout(timer);
    };
  }, [attributeQuery, catalogPaginationGuard, catalogRetry, hideFull, query, term]);

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
    const result = addSectionToSchedule(selected, section);
    if (result.reason === "already-selected") return;
    if (result.reason === "duplicate-course") {
      setNotice(`${section.course_code} is already represented by another section.`);
      return;
    }
    if (result.reason === "time-conflict") {
      setNotice(`${section.course_code} overlaps ${result.conflictingCourseCode ?? "a selected course"}. Remove the conflict before adding it.`);
      return;
    }
    updateSelected(result.sections);
    setNotice(null);
  }

  async function loadMore() {
    const generation = catalogPaginationGuard.currentDataset();
    const controller = new AbortController();
    loadMoreControllerRef.current?.abort();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    try {
      const page = await searchCatalogSections(term, query, results.length, controller.signal, attributeQuery, hideFull);
      if (controller.signal.aborted || !catalogPaginationGuard.accepts(generation)) return;
      setResults((current) => appendUniqueCatalogSections(current, page.sections));
      setHasMore(page.pagination.has_more);
      setCatalogError(null);
    } catch (error) {
      if (controller.signal.aborted || !catalogPaginationGuard.accepts(generation)) return;
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setCatalogError("More live catalog sections could not be loaded. The results already shown are unchanged. Try again.");
      }
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null;
        setLoadingMore(false);
      }
    }
  }

  function removeSection(classNumber: number) {
    updateSelected(removeSectionFromSchedule(selected, classNumber));
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

  function retryCatalog() {
    setCatalogRetry((value) => value + 1);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function confirmClearPlanningData(event: { preventDefault: () => void }) {
    setClearError(null);
    try {
      clearPlanningData({
        confirmed: true,
        afterClear: () => {
          clearSucceededRef.current = true;
          setSaved(readPlannerSchedules());
          setQuery("");
          setResults([]);
          setHideFull(false);
          setMode("all");
          setDays([]);
          setAttributeQuery("");
          setShowConflicts(true);
          setFiltersOpen(false);
          setMobilePane("search");
          setExpandedClass(null);
          setNotice(null);
          setImportNotice(null);
          navigate("/planner", { replace: true });
          schedulePlannerSearchFocus(searchInputRef.current);
        },
      });
    } catch {
      event.preventDefault();
      clearSucceededRef.current = false;
      setClearError("We couldn't clear all planning data from this browser. Some data may remain. Please try again.");
    }
  }

  const filteredResults = useMemo(() => filterPlannerSections(results, selected, {
    hideFull,
    mode,
    days,
    showConflicts,
  }), [days, hideFull, mode, results, selected, showConflicts]);
  const activeFilterCount = Number(hideFull)
    + Number(mode !== "all")
    + Number(Boolean(attributeQuery))
    + Number(days.length > 0)
    + Number(!showConflicts);

  return (
    <main className={`${styles.planner} ${darkMode ? styles.dark : ""} ${mobilePane === "schedule" ? styles.scheduleFocused : ""}`}>
      <h1 className="sr-only">Hunter Schedule Builder</h1>
      <BetaNotice className={styles.betaNotice} />
      {storageWarning && <div className={`${styles.notice} ${styles.storageWarning}`} role="alert"><span>{storageWarning}</span></div>}
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
              ref={searchInputRef}
              type="search"
              aria-label="Search courses and sections"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for codes, titles, instructors, locations…"
              className={styles.searchInput}
            />
          </div>
          <button type="button" className={styles.actionButton} onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} aria-controls="catalog-filters">
            <Filter aria-hidden="true" /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
        </div>

        {activeFilterCount > 0 && (
          <div className={styles.activeFilters} aria-label="Active catalog filters">
            <span className={styles.activeFiltersLabel}>Active filters</span>
            {hideFull && (
              <button type="button" className={styles.activeFilterChip} onClick={() => setHideFull(false)} aria-label="Remove hide full sections filter">
                <span><strong>Availability:</strong> Hide full sections</span><X aria-hidden="true" />
              </button>
            )}
            {mode !== "all" && (
              <button type="button" className={styles.activeFilterChip} onClick={() => setMode("all")} aria-label="Remove instruction format filter">
                <span><strong>Format:</strong> {formatMode(mode)}</span><X aria-hidden="true" />
              </button>
            )}
            {attributeQuery && (
              <button type="button" className={styles.activeFilterChip} onClick={() => setAttributeQuery("")} aria-label="Remove course attribute filter">
                <span><strong>Attribute:</strong> {formatCatalogAttribute(attributeQuery)}</span><X aria-hidden="true" />
              </button>
            )}
            {days.length > 0 && (
              <button type="button" className={styles.activeFilterChip} onClick={() => setDays([])} aria-label="Remove meeting days filter">
                <span><strong>Days:</strong> {days.map((day) => day.slice(0, 3)).join(", ")}</span><X aria-hidden="true" />
              </button>
            )}
            {!showConflicts && (
              <button type="button" className={styles.activeFilterChip} onClick={() => setShowConflicts(true)} aria-label="Remove hide conflicting sections filter">
                <span><strong>Schedule:</strong> Hide conflicts</span><X aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className={styles.clearFiltersButton}
              onClick={() => {
                setHideFull(false);
                setMode("all");
                setAttributeQuery("");
                setDays([]);
                setShowConflicts(true);
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {filtersOpen && (
          <div id="catalog-filters" className={styles.filterPanel} role="group" aria-label="Catalog filters">
            <button type="button" aria-pressed={hideFull} onClick={() => setHideFull((value) => !value)} className={`${styles.filterChip} ${hideFull ? styles.filterChipActive : ""}`}>Hide full sections</button>
            <select aria-label="Instruction mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className={styles.control}>
              <option value="all">All formats</option>
              <option value="in_person">In person</option>
              <option value="hybrid">Hybrid</option>
              <option value="remote">Remote</option>
              <option value="asynchronous">Asynchronous</option>
            </select>
            <label className={styles.attributeFilter}>
              <span>Course attribute</span>
              <select
                value={attributeQuery}
                onChange={(event) => setAttributeQuery(event.target.value)}
                aria-label="Filter by course attribute"
              >
                <option value="">All course attributes</option>
                {attributeSuggestions.map((attribute) => (
                  <option key={attribute} value={attribute}>{formatCatalogAttribute(attribute)}</option>
                ))}
              </select>
            </label>
            {DAYS.map((day) => (
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

        {catalogError && <div className={styles.notice} role="alert"><span>{catalogError}</span><button type="button" onClick={retryCatalog}>Retry catalog</button></div>}
        {importNotice && <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status"><span>{importNotice}</span><button type="button" onClick={() => setImportNotice(null)} aria-label="Dismiss"><X /></button></div>}
        {notice && <div className={styles.notice} role="alert"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X /></button></div>}

        <div className={styles.results} aria-busy={loading}>
          {loading && <div className={styles.loading} role="status"><LoaderCircle className="animate-spin" aria-hidden="true" /> Loading sections</div>}
          {!loading && !catalogError && !filteredResults.length && <p className={styles.empty}>No sections match these filters.</p>}
          {!loading && filteredResults.map((section, resultIndex) => {
            const isSelected = selected.some((item) => item.class_num === section.class_num);
            const hasConflict = !isSelected && conflictsWith(section, selected);
            const hasAnotherSection = !isSelected && alreadyHasCourse(section, selected);
            const expanded = expandedClass === section.class_num;
            const sectionColor = SECTION_COLORS[resultIndex % SECTION_COLORS.length];
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
                  {section.enrollment_status && (
                    <span className={`${styles.statusBadge} ${section.enrollment_status === "open" ? "" : styles.statusClosed}`}>
                      {section.enrollment_status}
                    </span>
                  )}
                  <span className={styles.seatCount}>{formatSearchEnrollment(section)}</span>
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
                    {section.catalog_attributes.some(isStudentFacingCatalogAttribute) && (
                      <div className={styles.detailsWide}>
                        <strong>Course attributes</strong>
                        <div className={styles.attributeList}>
                          {section.catalog_attributes.filter(isStudentFacingCatalogAttribute).map((attribute) => <span key={attribute}>{formatCatalogAttribute(attribute)}</span>)}
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
          {!loading && hasMore && (
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
            {DAYS.map((day) => <span key={day}>{day.slice(0, 3)}</span>)}
          </div>
          <div className={styles.timeColumn}>
            {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
              <span key={index} style={{ top: index * HOUR_HEIGHT }}>{displayTime(`${START_HOUR + index}:00`)}</span>
            ))}
          </div>
          <div className={styles.calendarGrid}>
            {DAYS.map((day) => (
              <div key={day} className={styles.dayColumn} role="group" aria-label={`${day} meetings`}>
                {selected.flatMap((section) => section.meetings.map((meeting, index) => ({ section, meeting, index })))
                  .filter(({ meeting }) => meeting.days.includes(day))
                  .map(({ section, meeting, index }) => {
                    const top = ((minutes(meeting.start_time) / 60) - START_HOUR) * HOUR_HEIGHT;
                    const height = Math.max(((minutes(meeting.end_time) - minutes(meeting.start_time)) / 60) * HOUR_HEIGHT, 26);
                    const selectedIndex = Math.max(selected.findIndex((item) => item.class_num === section.class_num), 0);
                    return (
                      <div key={`${section.class_num}-${index}`} className={styles.calendarCard} role="article" aria-label={`${day}, ${section.course_code}, ${displayTime(meeting.start_time)} to ${displayTime(meeting.end_time)}`} style={{ top, height, backgroundColor: SECTION_COLORS[selectedIndex % SECTION_COLORS.length] }}>
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

        <section className={styles.selectedList} aria-labelledby="selected-sections-heading">
          <h2 id="selected-sections-heading" className={styles.selectedHeading}>Selected sections</h2>
          {activeSchedule.source === "degreeworks" && <p className={`${styles.notice} ${styles.noticeSuccess}`}>DegreeWorks suggestion{activeSchedule.score != null ? ` · score ${activeSchedule.score}` : ""}</p>}
          {selected.map((section, index) => (
            <article key={section.class_num} className={styles.selectedRow} style={{ "--selected-color": SECTION_COLORS[index % SECTION_COLORS.length] } as CSSProperties}>
              <div className={styles.selectedTitle}>
                <div>
                  <strong>{section.course_code}</strong>
                  <span>{section.course_name}</span>
                </div>
                <button type="button" onClick={() => removeSection(section.class_num)} aria-label={`Remove ${section.course_code} section ${section.section_number}`} title="Remove section"><X aria-hidden="true" /></button>
              </div>
              <p className={styles.selectedSectionMeta}>
                {formatSectionComponent(section.section_component)} · Section {section.section_number} · Class #{section.class_num} · {section.credits} {section.credits === 1 ? "credit" : "credits"}
              </p>
              <dl className={styles.selectedDetails}>
                <div>
                  <dt>Meeting</dt>
                  <dd>
                    {formatSelectedMeetings(section).map((meeting, meetingIndex) => <span key={`${section.class_num}-meeting-${meetingIndex}`}>{meeting}</span>)}
                  </dd>
                </div>
                <div>
                  <dt>Instructor</dt>
                  <dd>{section.instructor || "TBA"}</dd>
                </div>
                <div>
                  <dt>Modality</dt>
                  <dd>{formatMode(section.instruction_mode)}</dd>
                </div>
                <div>
                  <dt>Enrollment</dt>
                  <dd>{formatSelectedEnrollment(section)}</dd>
                </div>
              </dl>
            </article>
          ))}
          {!selected.length && <p className={styles.emptySelected}>Add a section to start building your schedule.</p>}
        </section>

        <AlertDialog onOpenChange={(open) => {
          if (open) {
            clearSucceededRef.current = false;
            setClearError(null);
          }
        }}>
          <AlertDialogTrigger asChild>
            <button type="button" className={styles.clearDataButton}>
              <Trash2 aria-hidden="true" />
              Clear planning data
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent
            className="border-gray-200 bg-white text-gray-900"
            onCloseAutoFocus={(event) => {
              if (!clearSucceededRef.current) return;
              event.preventDefault();
              clearSucceededRef.current = false;
              schedulePlannerSearchFocus(searchInputRef.current);
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Clear planning data on this device?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600">
                This removes all browser-local Watchtower schedules, preferences, setup progress, and uploaded-audit review data. Server-side data and Hunter or CUNYfirst records remain untouched.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {clearError && (
              <p role="alert" aria-live="assertive" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {clearError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my data</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmClearPlanningData}
                className="bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700"
              >
                Clear planning data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <p className={styles.footnote}>Hunter Schedule Builder · Spring 2027 · Planning aid only. Confirm enrollment details in CUNYfirst.</p>
      </aside>
    </main>
  );
}
