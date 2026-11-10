import { describe, expect, it } from "vitest";
import { formatCatalogAttribute, isStudentFacingCatalogAttribute } from "../catalogFilters";

describe("catalog filter labels", () => {
  it("expands Hunter's current Pluralism and Diversity categories", () => {
    expect(formatCatalogAttribute("PLDI - CATG2 (Category 2)")).toBe(
      "Pluralism and Diversity Category 2: Residency, Citizenship, and Human Rights",
    );
    expect(formatCatalogAttribute("PLDI - CATG4 (Category 4)")).toBe(
      "Pluralism and Diversity Category 4: Knowledge Construction, Environments, and Technologies",
    );
  });

  it("identifies Hunter's pre-Fall 2024 Pluralism and Diversity groups", () => {
    expect(formatCatalogAttribute("PLDI - GROUPA (Group A)")).toBe("Pluralism and Diversity Group A");
    expect(formatCatalogAttribute("PLDI - GROUPC (Group C)")).toBe("Pluralism and Diversity Group C");
  });

  it("uses readable labels for common and unknown attributes", () => {
    expect(formatCatalogAttribute("WRIC - WRIC (Writing Intensive)")).toBe("Writing Intensive");
    expect(formatCatalogAttribute("OERS - OERS (ZERO Textbook Cost)")).toBe("Zero Textbook Cost");
    expect(formatCatalogAttribute("TEST - VALUE (Readable name)")).toBe("Readable name");
  });

  it("keeps internal program markers out of the attribute filter", () => {
    expect(isStudentFacingCatalogAttribute("WRIC - WRIC (Writing Intensive)")).toBe(true);
    expect(isStudentFacingCatalogAttribute("MEPY - ME_PSYC_1 (Introduction to Psychology)")).toBe(false);
    expect(isStudentFacingCatalogAttribute("UTCO - UT_COSC_1 (Programming I)")).toBe(false);
    expect(isStudentFacingCatalogAttribute("COPT - COPT (College Option)")).toBe(false);
  });
});
