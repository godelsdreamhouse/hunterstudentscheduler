import { API_BASE } from "./api";

export type TermSeason = "SPRING" | "SUMMER" | "FALL" | "WINTER";
export type Weekday =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export interface CatalogTerm {
  term_season: TermSeason;
  term_year: number;
}

export interface CatalogMeeting {
  days: Weekday[];
  start_time: string;
  end_time: string;
  location: string | null;
}

export interface CatalogSection {
  class_num: number;
  term_season: TermSeason;
  term_year: number;
  section_number: string;
  section_component: string;
  group_code: string | null;
  instructor: string | null;
  instruction_mode: "in_person" | "hybrid" | "asynchronous" | "remote";
  max_enrollment: number | null;
  enrollment: number | null;
  waitlist_max_enrollment: number | null;
  waitlist_count: number | null;
  enrollment_status: "open" | "closed" | "waitlist" | null;
  notes: string | null;
  course_id: string;
  course_code: string;
  course_name: string;
  dep_code: string;
  course_description: string | null;
  credits: number;
  prerequisites: string[];
  corequisites: string[];
  catalog_attributes: string[];
  meetings: CatalogMeeting[];
}

export interface CatalogSectionPage {
  sections: CatalogSection[];
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Catalog request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchCatalogTerms(signal?: AbortSignal): Promise<CatalogTerm[]> {
  const response = await fetch(`${API_BASE}/api/catalog/terms`, { signal });
  const payload = await readJson<{ terms: CatalogTerm[] }>(response);
  return payload.terms;
}

export async function fetchCatalogAttributes(term: CatalogTerm, signal?: AbortSignal): Promise<string[]> {
  const search = new URLSearchParams({
    term_season: term.term_season,
    term_year: String(term.term_year),
  });
  const response = await fetch(`${API_BASE}/api/catalog/attributes?${search}`, { signal });
  const payload = await readJson<{ attributes: string[] }>(response);
  return payload.attributes;
}

export async function searchCatalogSections(
  term: CatalogTerm,
  query = "",
  offset = 0,
  signal?: AbortSignal,
  attribute = "",
): Promise<CatalogSectionPage> {
  const search = new URLSearchParams({
    term_season: term.term_season,
    term_year: String(term.term_year),
    limit: "50",
    offset: String(offset),
  });
  if (query.trim()) search.set("q", query.trim());
  if (attribute.trim()) search.set("attribute", attribute.trim());

  const response = await fetch(`${API_BASE}/api/catalog/sections?${search}`, { signal });
  return readJson<CatalogSectionPage>(response);
}
