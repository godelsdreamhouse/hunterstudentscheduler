import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronUp, Download, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
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

const DAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const START_HOUR = 8;
const END_HOUR = 21;
const HOUR_HEIGHT = 52;
const DEFAULT_TERMS: CatalogTerm[] = [
  { term_season: "SPRING", term_year: 2027 },
];

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

function seatsRemaining(section: CatalogSection) {
  if (section.max_enrollment == null || section.enrollment == null) return null;
  return Math.max(section.max_enrollment - section.enrollment, 0);
}

function formatMode(mode: CatalogSection["instruction_mode"]) {
  return mode.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function meetingSummary(section: CatalogSection) {
  if (!section.meetings.length) return "Online / time not announced";
  const first = section.meetings[0];
  return `${first.days.map((day) => day.slice(0, 3)).join("/")} · ${displayTime(first.start_time)}–${displayTime(first.end_time)}`;
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
  const [showConflicts, setShowConflicts] = useState(true);
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
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchCatalogSections(term, query, 0, controller.signal)
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
  }, [query, term]);

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
      const page = await searchCatalogSections(term, query, results.length);
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
    if (openOnly && section.enrollment_status !== "open") return false;
    if (mode !== "all" && section.instruction_mode !== mode) return false;
    if (days.length && !days.every((day) => section.meetings.some((meeting) => meeting.days.includes(day)))) return false;
    if (!showConflicts && conflictsWith(section, selected)) return false;
    return true;
  }), [days, mode, openOnly, results, selected, showConflicts]);

  return (
    <main className="min-h-screen bg-[#f6f4f8] text-slate-950">
      <header className="border-b border-[#ded8e5] bg-white">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-6">
          <a href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-[#582C83] text-sm font-black text-white">H</span>
            <span>
              <strong className="block text-sm leading-none tracking-tight">Hunter Schedule Builder</strong>
              <span className="text-[11px] text-slate-500">Spring 2027</span>
            </span>
          </a>
          <nav className="hidden items-center rounded-lg bg-slate-100 p-1 text-sm font-semibold md:flex">
            <span className="rounded-md bg-white px-4 py-1.5 text-[#582C83] shadow-sm">Course Search</span>
            <span className="px-4 py-1.5 text-slate-500">Schedule</span>
          </nav>
          <div className="flex items-center gap-2">
            <a href="/upload" className="hidden rounded-lg border border-[#cdbddc] px-3 py-2 text-xs font-bold text-[#582C83] hover:bg-[#f6f0fa] sm:block">Build from DegreeWorks</a>
            <Button variant="outline" size="sm" onClick={exportSchedule} disabled={!selected.length} title="Download an .ics calendar file">
              <Download className="size-4" /> Export calendar
            </Button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-65px)] lg:grid-cols-[minmax(560px,1.65fr)_minmax(420px,1fr)]">
        <aside className="min-w-0 border-b border-[#ded8e5] bg-white lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 p-4 lg:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#70439a]">Course catalog</p>
                <h1 className="text-xl font-black tracking-tight">Build your Spring 2027 schedule</h1>
                <p className="mt-1 text-xs text-slate-500">Search live Hunter sections and add them to your week.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">No account needed</span>
            </div>
            <div className="mt-4 grid grid-cols-[132px_1fr] gap-2">
              <select
                aria-label="Term"
                value={termKey(term)}
                onChange={(event) => {
                  const next = terms.find((item) => termKey(item) === event.target.value);
                  if (next) updateActiveSchedule((schedule) => ({ ...schedule, term: next, sections: [] }));
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#582C83]"
              >
                {terms.map((item) => <option key={termKey(item)} value={termKey(item)}>{item.term_season[0] + item.term_season.slice(1).toLowerCase()} {item.term_year}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-slate-400" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search CSCI, calculus…" className="h-10 rounded-lg bg-white pl-9" />
              </div>
            </div>
            {previewMode && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Catalog is unavailable, so preview data is shown.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button onClick={() => setOpenOnly((value) => !value)} className={`rounded-full border px-3 py-1.5 font-semibold ${openOnly ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"}`}>Open seats</button>
              <select aria-label="Instruction mode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 outline-none">
                <option value="all">All formats</option>
                <option value="in_person">In person</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="asynchronous">Asynchronous</option>
              </select>
              {DAYS.slice(0, 6).map((day) => (
                <button key={day} aria-label={`Filter ${day}`} onClick={() => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day])} className={`size-7 rounded-full border text-[10px] font-bold ${days.includes(day) ? "border-[#582C83] bg-[#582C83] text-white" : "border-slate-200 text-slate-500"}`}>{day.slice(0, 1)}</button>
              ))}
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-slate-500"><input type="checkbox" checked={showConflicts} onChange={(event) => setShowConflicts(event.target.checked)} className="accent-[#582C83]" /> Show conflicts</label>
            </div>
          </div>

          {importNotice && <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"><span>{importNotice}</span><button onClick={() => setImportNotice(null)} aria-label="Dismiss"><X className="size-3.5" /></button></div>}
          {notice && <div className="mx-4 mt-3 flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X className="size-3.5" /></button></div>}
          <div className="max-h-[560px] overflow-y-auto p-3 lg:max-h-[calc(100vh-266px)]">
            {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Loading sections</div>}
            {!loading && !filteredResults.length && <p className="px-3 py-12 text-center text-sm text-slate-500">No sections match these filters.</p>}
            {!loading && filteredResults.map((section, resultIndex) => {
              const isSelected = selected.some((item) => item.class_num === section.class_num);
              const hasConflict = !isSelected && conflictsWith(section, selected);
              const hasAnotherSection = !isSelected && alreadyHasCourse(section, selected);
              const expanded = expandedClass === section.class_num;
              const remaining = seatsRemaining(section);
              const colors = ["border-l-violet-500", "border-l-sky-500", "border-l-amber-500", "border-l-emerald-500", "border-l-rose-500"];
              return (
                <article key={section.class_num} className={`mb-2 border border-l-4 border-slate-200 ${colors[resultIndex % colors.length]} bg-white px-3 py-2.5 transition hover:border-y-[#bba7ce] hover:border-r-[#bba7ce] ${isSelected ? "bg-violet-50/40" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setExpandedClass(expanded ? null : section.class_num)}>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-[#582C83]">{section.course_code}</strong>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">Sec {section.section_number}</span>
                        {section.enrollment_status === "open" && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Open{remaining != null ? ` · ${remaining}` : ""}</span>}
                      </div>
                      <h2 className="mt-0.5 truncate text-sm font-semibold leading-snug">{section.course_name}</h2>
                    </button>
                    <button
                      aria-label={isSelected ? `Remove ${section.course_code}` : `Add ${section.course_code}`}
                      onClick={() => isSelected ? removeSection(section.class_num) : addSection(section)}
                      className={`grid size-7 shrink-0 place-items-center rounded-full transition ${isSelected ? "bg-[#582C83] text-white" : hasConflict || hasAnotherSection ? "border border-rose-200 bg-rose-50 text-rose-500" : "border border-slate-200 text-slate-600 hover:border-[#582C83] hover:text-[#582C83]"}`}
                    >
                      {isSelected ? <Check className="size-4" /> : <Plus className="size-4" />}
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>{section.credits} credits</span>
                    <span>{meetingSummary(section)}</span>
                    {section.instructor && <span>{section.instructor}</span>}
                    <button onClick={() => setExpandedClass(expanded ? null : section.class_num)} className="ml-auto flex items-center font-semibold text-[#70439a]">Details {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}</button>
                  </div>
                  {hasConflict && <p className="mt-1.5 text-[11px] font-semibold text-rose-600">Time conflict — click + for details</p>}
                  {hasAnotherSection && <p className="mt-1.5 text-[11px] font-semibold text-amber-700">Another section of this course is selected</p>}
                  {expanded && (
                    <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-600 sm:grid-cols-2">
                      <div><strong className="text-slate-800">Meeting</strong><br />{section.meetings.length ? section.meetings.map((meeting) => `${meeting.days.map((day) => day.slice(0, 3)).join("/")} ${displayTime(meeting.start_time)}–${displayTime(meeting.end_time)} · ${meeting.location ?? "TBA"}`).join("; ") : "Online / TBA"}</div>
                      <div><strong className="text-slate-800">Section</strong><br />Class #{section.class_num} · {formatMode(section.instruction_mode)}{section.instructor ? ` · ${section.instructor}` : ""}</div>
                      {section.course_description && <p className="sm:col-span-2"><strong className="text-slate-800">Description</strong><br />{section.course_description}</p>}
                    </div>
                  )}
                </article>
              );
            })}
            {!loading && hasMore && !previewMode && (
              <Button variant="outline" className="mt-1 w-full" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <><LoaderCircle className="size-4 animate-spin" /> Loading more</> : "Load more sections"}
              </Button>
            )}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden bg-[#f7f5f9] p-4 lg:sticky lg:top-0 lg:h-[calc(100vh-65px)] lg:overflow-y-auto">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#70439a]"><CalendarDays className="size-4" /> Weekly schedule</p>
              <button onClick={renameSchedule} className="mt-1 max-w-full truncate text-left text-xl font-black hover:text-[#582C83]" title="Rename schedule">{activeSchedule.name}</button>
              <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>{term.term_season[0] + term.term_season.slice(1).toLowerCase()} {term.term_year} · saved in this browser</span>
                {activeSchedule.source === "degreeworks" && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-[#582C83]">DegreeWorks suggestion{activeSchedule.score != null ? ` · score ${activeSchedule.score}` : ""}</span>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <select aria-label="Saved schedule" value={saved.activeId} onChange={(event) => setSaved((current) => ({ ...current, activeId: event.target.value }))} className="max-w-32 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold">
                {saved.schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}
              </select>
              <button onClick={createNewSchedule} aria-label="Create schedule" className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-[#582C83] hover:bg-violet-50"><Plus className="size-4" /></button>
              <button onClick={deleteSchedule} aria-label="Delete schedule" className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 hover:text-rose-600"><Trash2 className="size-4" /></button>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {selected.map((section, index) => (
              <button key={section.class_num} onClick={() => removeSection(section.class_num)} className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 shadow-sm" title={`Remove ${section.course_code}`}>
                <span className={`size-2 rounded-full ${["bg-violet-500", "bg-sky-500", "bg-amber-500", "bg-emerald-500", "bg-rose-500"][index % 5]}`} />{section.course_code}<X className="size-2.5 text-slate-400" />
              </button>
            ))}
            {!selected.length && <p className="rounded-lg border border-dashed border-[#cdbddc] bg-white px-3 py-2 text-xs text-slate-500">Add a section to start building your week.</p>}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#ded8e5] bg-white shadow-sm">
            <div className="min-w-[500px]">
              <div className="grid grid-cols-[48px_repeat(5,1fr)] border-b border-slate-200 bg-[#fbfafc]">
                <div />
                {DAYS.slice(0, 5).map((day) => <div key={day} className="border-l border-slate-200 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">{day.slice(0, 3)}</div>)}
              </div>
              <div className="relative grid grid-cols-[48px_repeat(5,1fr)]" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                <div className="relative">
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                    <span key={index} className="absolute right-2 -translate-y-2 text-[10px] text-slate-400" style={{ top: index * HOUR_HEIGHT }}>{displayTime(`${START_HOUR + index}:00`)}</span>
                  ))}
                </div>
                {DAYS.slice(0, 5).map((day) => (
                  <div key={day} className="relative border-l border-slate-200 bg-[linear-gradient(to_bottom,transparent_51px,#e8e5eb_52px)] bg-[length:100%_52px]">
                    {selected.flatMap((section) => section.meetings.map((meeting, index) => ({ section, meeting, index })))
                      .filter(({ meeting }) => meeting.days.includes(day))
                      .map(({ section, meeting, index }) => {
                        const top = ((minutes(meeting.start_time) / 60) - START_HOUR) * HOUR_HEIGHT;
                        const height = Math.max(((minutes(meeting.end_time) - minutes(meeting.start_time)) / 60) * HOUR_HEIGHT, 34);
                        return (
                          <div key={`${section.class_num}-${index}`} className="absolute inset-x-0.5 overflow-hidden rounded-md border border-[#7f57a4] bg-[#efe7f7] px-1.5 py-1 text-[#3e1d5d] shadow-sm" style={{ top, height }}>
                            <div className="flex items-start justify-between gap-1">
                              <strong className="text-[11px] leading-tight">{section.course_code}</strong>
                              <button aria-label={`Remove ${section.course_code}`} onClick={() => removeSection(section.class_num)} className="opacity-50 hover:opacity-100"><X className="size-3" /></button>
                            </div>
                            <p className="mt-0.5 truncate text-[10px]">{displayTime(meeting.start_time)} · {meeting.location ?? "TBA"}</p>
                          </div>
                        );
                      })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {selected.some((section) => !section.meetings.length) && (
            <div className="mt-3 rounded-xl border border-dashed border-[#bba7ce] bg-white p-3 text-xs text-slate-600">
              Online / TBA: {selected.filter((section) => !section.meetings.length).map((section) => section.course_code).join(", ")}
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">Planning aid only. Confirm enrollment details in CUNYfirst before registering.</p>
        </section>
      </div>
    </main>
  );
}
