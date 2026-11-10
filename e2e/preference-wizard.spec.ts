import { expect, test } from "@playwright/test";

test("preferences are collected in four focused steps", async ({ page }) => {
	await page.goto("/preferences");

	await expect(page.getByRole("heading", { name: "Build Your Schedule Preferences" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Semester" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Required Constraints" })).toBeHidden();

	await page.getByLabel("Minimum credits").fill("17");
	await page.getByLabel("Maximum credits").fill("16");
	await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

	await page.getByLabel("Minimum credits").fill("12");
	await page.getByLabel("Maximum credits").fill("16");
	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.getByRole("heading", { name: "Required Constraints" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Schedule Preferences", exact: true })).toBeHidden();

	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.getByRole("heading", { name: "Schedule Preferences", exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Continue" }).click();
	await expect(page.getByRole("heading", { name: "Course Preferences" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Generate Schedules" })).toBeVisible();

	await page.getByRole("button", { name: "Previous step" }).click();
	await expect(page.getByRole("heading", { name: "Schedule Preferences", exact: true })).toBeVisible();
	await page.getByRole("navigation", { name: "Preference steps" }).getByRole("button").first().click();
	await expect(page.getByRole("heading", { name: "Semester" })).toBeVisible();
});
