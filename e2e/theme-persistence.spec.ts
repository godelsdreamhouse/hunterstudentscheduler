import { expect, test } from "@playwright/test";

const SMART_BUILDER_ROUTES = [
  "/upload",
  "/requirements",
  "/preferences",
  "/schedules",
] as const;

test("a saved dark theme follows the student through Smart Builder", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("hunter-planner-theme", "dark");
  });

  for (const route of SMART_BUILDER_ROUTES) {
    await page.goto(route);
    await expect(page.locator("html")).toHaveAttribute("data-planner-theme", "dark");
    await expect(page.getByRole("button", { name: "Use light mode" })).toBeVisible();
    await expect(page.locator("header")).toHaveCSS("background-color", "rgb(23, 25, 29)");
  }

  await page.getByRole("button", { name: "Use light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-planner-theme", "light");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("hunter-planner-theme"))).toBe("light");

  await page.goto("/planner");
  await expect(page.getByRole("button", { name: "Use dark mode" })).toBeVisible();
});

