import { expect, test, type Page } from "@playwright/test";

async function mockPlanner(page: Page) {
	await page.route("**/api/users/profile", (route) =>
		route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
	);
	await page.route("**/api/courses/departments", (route) =>
		route.fulfill({ json: { departments: [] } }),
	);
	await page.route("**/api/catalog/terms", (route) =>
		route.fulfill({ json: { terms: [{ term_season: "SPRING", term_year: 2027 }] } }),
	);
	await page.route("**/api/catalog/attributes?*", (route) =>
		route.fulfill({ json: { attributes: [] } }),
	);
	await page.route("**/api/catalog/sections?*", (route) =>
		route.fulfill({
			json: { sections: [], pagination: { limit: 50, offset: 0, has_more: false } },
		}),
	);
}

test.use({ viewport: { width: 320, height: 800 } });

test("320px planner keeps primary controls reachable without page overflow", async ({ page }) => {
	await mockPlanner(page);
	await page.goto("/planner");

	await expect(page.getByRole("heading", { name: "Hunter Schedule Builder" })).toBeVisible();
	await expect(page.getByRole("searchbox", { name: "Search courses" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
	await expect(page.getByRole("tab", { name: "Course Search" }).first()).toBeVisible();
	await expect(page.getByRole("tab", { name: "Schedule" }).first()).toBeVisible();
	await expect.poll(() => page.evaluate(() => ({
		clientWidth: document.documentElement.clientWidth,
		scrollWidth: document.documentElement.scrollWidth,
	}))).toEqual({ clientWidth: 320, scrollWidth: 320 });

	await page.getByRole("tab", { name: "Schedule" }).first().click();
	await expect(page.getByRole("region", { name: "Weekly schedule calendar" })).toBeVisible();
	await expect(page.getByRole("combobox", { name: "Saved schedule" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Clear planning data" })).toBeVisible();
	await expect.poll(() => page.evaluate(() => ({
		clientWidth: document.documentElement.clientWidth,
		scrollWidth: document.documentElement.scrollWidth,
	}))).toEqual({ clientWidth: 320, scrollWidth: 320 });
});

test("forced-colors planner preserves keyboard tab semantics and named controls", async ({ page }) => {
	await page.emulateMedia({ forcedColors: "active" });
	await mockPlanner(page);
	await page.goto("/planner");

	const searchTab = page.getByRole("tab", { name: "Course Search" }).first();
	const scheduleTab = page.getByRole("tab", { name: "Schedule" }).first();
	await searchTab.focus();
	await expect(searchTab).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(scheduleTab).toBeFocused();
	await scheduleTab.press("Enter");
	await expect(scheduleTab).toHaveAttribute("aria-selected", "true");
	await expect(page.getByRole("region", { name: "Weekly schedule calendar" })).toBeVisible();
	await expect(page.getByRole("switch", { name: "show conflicting sections" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Use dark mode" })).toBeVisible();
});
