import { describe, expect, it } from "vitest";
import {
	advancePreferenceStep,
	PREFERENCE_WIZARD_LAST_STEP,
	retreatPreferenceStep,
} from "../preferenceWizard";

describe("preference wizard navigation", () => {
	it("does not leave the credit step while its range is invalid", () => {
		expect(advancePreferenceStep(0, true)).toBe(0);
	});

	it("moves through each bounded step when the range is valid", () => {
		expect(advancePreferenceStep(0, false)).toBe(1);
		expect(advancePreferenceStep(1, false)).toBe(2);
		expect(advancePreferenceStep(2, false)).toBe(3);
		expect(advancePreferenceStep(3, false)).toBe(PREFERENCE_WIZARD_LAST_STEP);
	});

	it("moves backward without leaving the first step", () => {
		expect(retreatPreferenceStep(3)).toBe(2);
		expect(retreatPreferenceStep(0)).toBe(0);
	});
});
