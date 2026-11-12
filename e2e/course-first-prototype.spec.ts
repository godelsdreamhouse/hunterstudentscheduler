import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("course-first research prototype supports a complete local planning journey", async ({ page }) => {
  await page.goto("/prototypes/course-first");

  await expect(page.getByRole("heading", { name: "Course-first schedule explorer" })).toBeVisible();
  await expect(page.getByText("Research prototype", { exact: true })).toBeVisible();
  await expect(page.getByText(/Synthetic data only.*not connected to Hunter’s live catalog.*must not be used to enroll/i)).toBeVisible();

  const courseResults = page.getByLabel("Choose synthetic courses");
  await expect(courseResults.getByText("4 courses", { exact: true })).toBeVisible();
  await expect(courseResults.getByRole("heading", { name: "CSCI 127" })).toBeVisible();
  await expect(courseResults.getByRole("heading", { name: "BIOL 100" })).toBeVisible();
  await expect(courseResults.getByRole("heading", { name: "MATH 150" })).toBeVisible();
  await expect(courseResults.getByRole("heading", { name: "ARTLA 201" })).toBeVisible();

  const csciCard = courseResults.getByRole("article").filter({ has: page.getByRole("heading", { name: "CSCI 127" }) });
  const biolCard = courseResults.getByRole("article").filter({ has: page.getByRole("heading", { name: "BIOL 100" }) });
  await csciCard.getByRole("button", { name: "Select course" }).click();
  await biolCard.getByRole("button", { name: "Select course" }).click();

  await expect(page.getByText("Alternative 1", { exact: true })).toBeVisible();
  const evidence = page.getByRole("heading", { name: "Supplied enrollment evidence" }).locator("..");
  await expect(evidence.getByRole("heading", { name: /CSCI 127:/ })).toBeVisible();
  await expect(evidence.getByRole("heading", { name: /BIOL 100:/ })).toBeVisible();
  await expect(evidence.getByText("assoc-csci-a", { exact: true })).toBeVisible();
  await expect(evidence.getByText("assoc-biol-a", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Alternative 2", { exact: true })).toBeVisible();

  await page.getByText("Pin preferred sections", { exact: true }).click();
  await expect(page.getByText(/A\. Example.*Mon\/Wed 9:00 AM–10:15 AM.*North 100/i)).toBeVisible();
  await expect(page.getByText(/H\. Example.*Wed 3:00 PM–5:40 PM.*North 201/i)).toBeVisible();

  await page.getByRole("button", { name: "New" }).click();
  const scheduleName = page.getByRole("textbox", { name: "Schedule name" });
  await expect(scheduleName).toHaveValue("Prototype schedule 2");
  await scheduleName.fill("Weekend comparison");

  await csciCard.getByRole("button", { name: "Select course" }).click();
  const artCard = courseResults.getByRole("article").filter({ has: page.getByRole("heading", { name: "ARTLA 201" }) });
  await artCard.getByRole("button", { name: "Select course" }).click();
  await page.getByText("Pin preferred sections", { exact: true }).click();
  const saturdayLab = page.getByRole("checkbox", { name: /lab 2A.*D\. Example.*Sat 10:00 AM–11:50 AM.*North 100/i });
  await saturdayLab.check();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Schedule name" })).toHaveValue("Weekend comparison");
  await expect(csciCard.getByRole("button", { name: "Remove course" })).toBeVisible();
  await expect(artCard.getByRole("button", { name: "Remove course" })).toBeVisible();

  await page.getByText("Pin preferred sections", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /lab 2A.*D\. Example.*Sat 10:00 AM–11:50 AM.*North 100/i })).toBeChecked();
  const incompatibleLab = page.getByRole("checkbox", { name: /lab 1A.*B\. Example.*Fri 9:00 AM–10:50 AM.*North 100/i });
  await incompatibleLab.check();
  await expect(page.getByRole("heading", { name: "No complete schedule" })).toBeVisible();
  await expect(page.getByText(/No enrollment combination for CSCI 127 contains every pinned section.*Unpin a section/i)).toBeVisible();

  await incompatibleLab.uncheck();
  await expect(page.getByText("Alternative 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No complete schedule" })).toHaveCount(0);

  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    await expect(page.getByText(day, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("group", { name: "Saturday meetings" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Sunday meetings" })).toBeVisible();
  await expect(page.getByLabel(/Saturday, lab 2A.*10:00 AM to 11:50 AM.*North 100/i)).toBeVisible();
  await expect(page.getByLabel(/Sunday, lecture 01.*12:30 PM to 3:30 PM.*Thomas Hunter 400/i)).toBeVisible();
});
