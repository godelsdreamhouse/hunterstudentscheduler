export const PREFERENCE_WIZARD_LAST_STEP = 3;

export function advancePreferenceStep(
	currentStep: number,
	hasCreditRangeError: boolean,
): number {
	if (currentStep === 0 && hasCreditRangeError) return currentStep;
	return Math.min(currentStep + 1, PREFERENCE_WIZARD_LAST_STEP);
}

export function retreatPreferenceStep(currentStep: number): number {
	return Math.max(currentStep - 1, 0);
}
