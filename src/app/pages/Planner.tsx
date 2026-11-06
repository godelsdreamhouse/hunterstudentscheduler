import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Download, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
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

const DAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const START_HOUR = 8;
const END_HOUR = 21;
const HOUR_HEIGHT = 64;
const STORAGE_KEY = "watchtower-planning-session-v1";
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

type SavedSchedules = Record<string, CatalogSection[]>;

function termKey(term: CatalogTerm) {
  return `${term.term_season}-${term.term_year}`;
}

function readSavedSchedules(): SavedSchedules {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as SavedSchedules;
  } catch {
    return {};
  }
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

function meetingSummary(section: CatalogSection) {
  if (!section.meetings.length) return "Online / time not announced";
  const first = section.meetings[0];
  return `${first.days.map((day) => day.slice(0, 3)).join("/")} · ${displayTime(first.start_time)}–${displayTime(first.end_time)}`;
}

export function Planner() {
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [term, setTerm] = useState(DEFAULT_TERMS[0]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogSection[]>([]);
  const [saved, setSaved] = useState<SavedSchedules>(readSavedSchedules);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const selected = useMemo(() => saved[termKey(term)] ?? [], [saved, term]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalogTerms(controller.signal)
      .then((available) => {
        const relevant = available.filter((item) => item.term_year === 2027 && item.term_season === "SPRING");
        if (relevant.length) {
          setTerms(relevant);
          setTerm((current) => relevant.find((item) => termKey(item) === termKey(current))
            ?? relevant.find((item) => item.term_season === "SPRING")
            ?? relevant[0]);
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

  function updateSelected(next: CatalogSection[]) {
    setSaved((current) => ({ ...current, [termKey(term)]: next }));
  }

  function addSection(section: CatalogSection) {
    if (!selected.some((item) => item.class_num === section.class_num)
      && !alreadyHasCourse(section, selected)
      && !conflictsWith(section, selected)) {
      updateSelected([...selected, section]);
    }
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

  function exportSchedule() {
    const payload = JSON.stringify({ version: 1, term, sections: selected }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `hunter-schedule-${term.term_season.toLowerCase()}-${term.term_year}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#f6f4f8] text-slate-950">
      <header className="border-b border-[#ded8e5] bg-white">
        <div className="flex min-h-16 items-center justify-between gap-4 px-5 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-[#582C83] text-sm font-black text-white">H</span>
            <span>
              <strong className="block text-sm leading-none tracking-tight">Hunter Scheduler</strong>
              <span className="text-[11px] text-slate-500">Session planner</span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">Saved in this browser</span>
            <Button variant="outline" size="sm" onClick={exportSchedule} disabled={!selected.length}>
              <Download className="size-4" /> Export
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-65px)] flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-[#ded8e5] bg-white lg:w-[390px] lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 p-5">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#70439a]">Build manually</p>
            <h1 className="text-2xl font-black tracking-tight">Find your classes</h1>
            <p className="mt-1 text-sm text-slate-500">Add sections to the calendar. Conflicting times are blocked.</p>
            <div className="mt-4 grid grid-cols-[128px_1fr] gap-2">
              <select
                aria-label="Term"
                value={termKey(term)}
                onChange={(event) => {
                  const next = terms.find((item) => termKey(item) === event.target.value);
                  if (next) setTerm(next);
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
          </div>

          <div className="max-h-[520px] overflow-y-auto p-3 lg:max-h-[calc(100vh-300px)]">
            {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Loading sections</div>}
            {!loading && !results.length && <p className="px-3 py-12 text-center text-sm text-slate-500">No sections found for this search.</p>}
            {!loading && results.map((section) => {
              const isSelected = selected.some((item) => item.class_num === section.class_num);
              const hasConflict = !isSelected && conflictsWith(section, selected);
              const hasAnotherSection = !isSelected && alreadyHasCourse(section, selected);
              return (
                <article key={section.class_num} className="mb-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#bba7ce]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-[#582C83]">{section.course_code}</strong>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">{section.section_number}</span>
                      </div>
                      <h2 className="mt-1 text-sm font-semibold leading-snug">{section.course_name}</h2>
                    </div>
                    <button
                      aria-label={isSelected ? `Remove ${section.course_code}` : `Add ${section.course_code}`}
                      disabled={hasConflict || hasAnotherSection}
                      onClick={() => isSelected ? removeSection(section.class_num) : addSection(section)}
                      className={`grid size-8 shrink-0 place-items-center rounded-full transition ${isSelected ? "bg-[#582C83] text-white" : "border border-slate-200 text-slate-600 hover:border-[#582C83] hover:text-[#582C83] disabled:cursor-not-allowed disabled:opacity-30"}`}
                    >
                      {isSelected ? <Check className="size-4" /> : <Plus className="size-4" />}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{section.credits} credits</span>
                    <span>{meetingSummary(section)}</span>
                    {section.instructor && <span>{section.instructor}</span>}
                  </div>
                  {hasConflict && <p className="mt-2 text-xs font-semibold text-rose-600">Conflicts with your schedule</p>}
                  {hasAnotherSection && <p className="mt-2 text-xs font-semibold text-amber-700">Another section of this course is selected</p>}
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

        <section className="min-w-0 flex-1 overflow-hidden p-4 lg:p-6">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#70439a]"><CalendarDays className="size-4" /> Weekly schedule</p>
              <h2 className="mt-1 text-xl font-black">{term.term_season[0] + term.term_season.slice(1).toLowerCase()} {term.term_year}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{selected.length} selected</span>
              {selected.length > 0 && <button className="flex items-center gap-1 font-semibold text-slate-600 hover:text-rose-600" onClick={() => updateSelected([])}><Trash2 className="size-3.5" /> Clear</button>}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#ded8e5] bg-white shadow-sm">
            <div className="min-w-[1040px]">
              <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-slate-200 bg-[#fbfafc]">
                <div />
                {DAYS.map((day) => <div key={day} className="border-l border-slate-200 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{day.slice(0, 3)}</div>)}
              </div>
              <div className="relative grid grid-cols-[64px_repeat(7,1fr)]" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                <div className="relative">
                  {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                    <span key={index} className="absolute right-2 -translate-y-2 text-[10px] text-slate-400" style={{ top: index * HOUR_HEIGHT }}>{displayTime(`${START_HOUR + index}:00`)}</span>
                  ))}
                </div>
                {DAYS.map((day) => (
                  <div key={day} className="relative border-l border-slate-200 bg-[linear-gradient(to_bottom,transparent_63px,#e8e5eb_64px)] bg-[length:100%_64px]">
                    {selected.flatMap((section) => section.meetings.map((meeting, index) => ({ section, meeting, index })))
                      .filter(({ meeting }) => meeting.days.includes(day))
                      .map(({ section, meeting, index }) => {
                        const top = ((minutes(meeting.start_time) / 60) - START_HOUR) * HOUR_HEIGHT;
                        const height = Math.max(((minutes(meeting.end_time) - minutes(meeting.start_time)) / 60) * HOUR_HEIGHT, 34);
                        return (
                          <div key={`${section.class_num}-${index}`} className="absolute inset-x-1 overflow-hidden rounded-lg border border-[#7f57a4] bg-[#efe7f7] px-2 py-1.5 text-[#3e1d5d] shadow-sm" style={{ top, height }}>
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
