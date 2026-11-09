import type { ParserPayload } from "../../lib/schedulePayload";
export const AUDIT_STORAGE_KEY = "watchtower_audit_data";

function clearLegacyAuditData(): void {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key === AUDIT_STORAGE_KEY || key?.startsWith(`${AUDIT_STORAGE_KEY}:`)) {
      localStorage.removeItem(key);
    }
  }
}

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
    clearLegacyAuditData();
    const raw = sessionStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuditData;
  } catch {}
  return null;
}

export function writeAuditData(data: AuditData): void {
  clearLegacyAuditData();
  sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(data));
}

export function clearAuditData(): void {
  sessionStorage.removeItem(AUDIT_STORAGE_KEY);
  clearLegacyAuditData();
}

export function useAuditData(): AuditData | null {
  return readAuditData();
}
