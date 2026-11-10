import { buildParserPayload } from "./schedulePayload";

interface DegreeCredits {
  "Credits applied": number;
  "Credits required": number;
}

interface ConfirmableAudit {
  "Degree Credits": DegreeCredits;
  GPA?: unknown;
  [key: string]: unknown;
}

function parseGpa(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds the saved audit state without changing the parser's academic result.
 * Completed and still-needed requirements flow directly into the scheduler
 * payload; the review screen is not an academic override mechanism.
 */
export function buildConfirmedAuditData<T>(
  parserResponse: ConfirmableAudit,
  requirementsSummary: T,
) {
  const degreeCredits = parserResponse["Degree Credits"];
  return {
    creditsRequired: degreeCredits["Credits required"],
    creditsApplied: degreeCredits["Credits applied"],
    gpa: parseGpa(parserResponse.GPA),
    parserPayload: buildParserPayload(parserResponse),
    requirementsSummary,
  };
}
