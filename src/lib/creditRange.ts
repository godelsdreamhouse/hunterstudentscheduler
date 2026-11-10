export const DEFAULT_CREDIT_RANGE = [12, 16] as const;
export const MINIMUM_CREDIT_LOAD = 0.5;
export const MAXIMUM_CREDIT_LOAD = 18;
export const CREDIT_LOAD_STEP = 0.5;

export function validateCreditRange(
  minimum: string | number,
  maximum: string | number,
): string | null {
  const min = Number(minimum);
  const max = Number(maximum);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return "Enter both a minimum and maximum credit load.";
  }
  if (min < MINIMUM_CREDIT_LOAD || max < MINIMUM_CREDIT_LOAD) {
    return `Credit loads must be at least ${MINIMUM_CREDIT_LOAD}.`;
  }
  if (min > MAXIMUM_CREDIT_LOAD || max > MAXIMUM_CREDIT_LOAD) {
    return `Credit loads cannot exceed ${MAXIMUM_CREDIT_LOAD}.`;
  }
  if (!Number.isInteger(min / CREDIT_LOAD_STEP) || !Number.isInteger(max / CREDIT_LOAD_STEP)) {
    return "Credit loads must use half-credit increments.";
  }
  if (min > max) {
    return "Minimum credits cannot be greater than maximum credits.";
  }
  return null;
}

export function normalizeStoredCreditRange(value: unknown): number[] {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    validateCreditRange(value[0], value[1]) === null
  ) {
    // Migrate the former slider's untouched 3–18 default to the new full-time default.
    if (value[0] === 3 && value[1] === 18) return [...DEFAULT_CREDIT_RANGE];
    return [Number(value[0]), Number(value[1])];
  }
  return [...DEFAULT_CREDIT_RANGE];
}
