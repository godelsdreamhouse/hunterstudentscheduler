import { describe, expect, it } from "vitest";
import {
  DEFAULT_CREDIT_RANGE,
  normalizeStoredCreditRange,
  validateCreditRange,
} from "../creditRange";

describe("credit range preferences", () => {
  it("defaults to a full-time 12–16 credit load", () => {
    expect(DEFAULT_CREDIT_RANGE).toEqual([12, 16]);
  });

  it("accepts integer and half-credit bounds", () => {
    expect(validateCreditRange(12, 16)).toBeNull();
    expect(validateCreditRange(12, 17.5)).toBeNull();
  });

  it("rejects incomplete, reversed, or unsupported increments", () => {
    expect(validateCreditRange("", 16)).not.toBeNull();
    expect(validateCreditRange(17, 16)).not.toBeNull();
    expect(validateCreditRange(12, 16.25)).not.toBeNull();
    expect(validateCreditRange(12, 18.5)).toBe("Credit loads cannot exceed 18.");
    expect(validateCreditRange(12, Number.MAX_VALUE)).toBe("Credit loads cannot exceed 18.");
  });

  it("migrates the former untouched slider default", () => {
    expect(normalizeStoredCreditRange([3, 18])).toEqual([12, 16]);
    expect(normalizeStoredCreditRange([12, 17.5])).toEqual([12, 17.5]);
  });
});
