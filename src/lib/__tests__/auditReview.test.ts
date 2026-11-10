import { describe, expect, it } from "vitest";
import { buildConfirmedAuditData } from "../auditReview";

describe("DegreeWorks audit confirmation", () => {
  it("preserves the parser's completed and still-needed partition", () => {
    const parserResponse = {
      Major: ["Computer Science"],
      "Degree Credits": {
        Status: "Incomplete",
        "Credits applied": 60,
        "Credits required": 120,
      },
      Completed: [{
        name: "Intro course",
        tag: "major_core",
        credits: 3,
        courses: [{ departmentCode: "CSCI", courseID: "12700", grade: "A" }],
      }],
      "Still Needed": [{
        name: "Data Structures",
        tag: "major_core",
        credits: 3,
        courses: [{ departmentCode: "CSCI", courseID: "23500", grade: null }],
      }],
      GPA: 3.5,
    };
    const original = structuredClone(parserResponse);
    const summary = { major: ["Intro course — Completed", "Data Structures — Still Needed"] };

    const confirmed = buildConfirmedAuditData(parserResponse, summary);

    expect(parserResponse).toEqual(original);
    expect(confirmed.requirementsSummary).toBe(summary);
    expect(confirmed.parserPayload.classes_taken).toEqual([
      { subject_area: "CSCI", catalog_number: 12700 },
    ]);
    expect(confirmed.parserPayload.requirements_needed).toEqual([
      {
        name: "Data Structures",
        attribute: "major_core",
        credits_needed: 3,
        fulfilled_by: [{ subject_area: "CSCI", catalog_number: 23500 }],
      },
    ]);
  });
});
