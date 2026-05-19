import type { ParserPayload } from "../../lib/schedulePayload";

const STORAGE_KEY = "watchtower_audit_data";

export interface ParsedRequirements {
  degree: string[];
  commonCore: string[];
  pluralism: string[];
  hunterFocus: string[];
  writing: string[];
  major: string[];
  additionalMajor: string[];
  electives: string[];
}

export interface AuditData {
  creditsRequired: number;
  creditsApplied: number;
  gpa: number | null;
  fileName?: string | null;
  parserPayload?: ParserPayload | null;
  requirementsSummary?: ParsedRequirements | null;
}

export function readAuditData(): AuditData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuditData;
  } catch {}
  return null;
}

export function writeAuditData(data: AuditData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAuditData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAuditData(): AuditData | null {
  return readAuditData();
}
