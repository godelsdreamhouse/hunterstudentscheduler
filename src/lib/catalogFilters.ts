const ATTRIBUTE_LABELS: Array<[RegExp, string]> = [
  [/^PLDI\s*-\s*GROUPA\b/i, "Pluralism and Diversity Group A"],
  [/^PLDI\s*-\s*GROUPB\b/i, "Pluralism and Diversity Group B"],
  [/^PLDI\s*-\s*GROUPC\b/i, "Pluralism and Diversity Group C"],
  [/^PLDI\s*-\s*GROUPD\b/i, "Pluralism and Diversity Group D"],
  [/^PLDI\s*-\s*CATG1\b/i, "Pluralism and Diversity Category 1: Migration, Diaspora, and Globalization"],
  [/^PLDI\s*-\s*CATG2\b/i, "Pluralism and Diversity Category 2: Residency, Citizenship, and Human Rights"],
  [/^PLDI\s*-\s*CATG3\b/i, "Pluralism and Diversity Category 3: Intersectionality and Social Justice"],
  [/^PLDI\s*-\s*CATG4\b/i, "Pluralism and Diversity Category 4: Knowledge Construction, Environments, and Technologies"],
  [/^WRIC\b/i, "Writing Intensive"],
  [/^OERS\b/i, "Zero Textbook Cost"],
  [/^EXPR\b/i, "Experimental Course"],
  [/^DOC\b/i, "Doctoral Course"],
];

/**
 * Hides Coursedog implementation markers that are not meaningful standalone
 * student-facing course attributes. Program membership is modeled separately.
 */
export function isStudentFacingCatalogAttribute(attribute: string) {
  const normalized = attribute.trim().toUpperCase();
  return normalized.length > 0
    && !normalized.startsWith("COPT -")
    && !normalized.includes("COLLEGE OPTION")
    && !/^ME[A-Z]{2}\s*-/.test(normalized)
    && !/^UT[A-Z]{2}\s*-/.test(normalized);
}

/** Converts a stored Coursedog attribute value into a readable student label. */
export function formatCatalogAttribute(attribute: string) {
  const normalized = attribute.trim();
  const known = ATTRIBUTE_LABELS.find(([pattern]) => pattern.test(normalized));
  if (known) return known[1];

  const parentheticalLabel = normalized.match(/\(([^()]*)\)\s*$/)?.[1]?.trim();
  if (parentheticalLabel) return parentheticalLabel;

  const separator = normalized.indexOf(" - ");
  return separator >= 0 ? normalized.slice(separator + 3).trim() : normalized;
}
