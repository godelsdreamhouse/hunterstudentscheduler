import { expect, test, type Page } from "@playwright/test";

const MAJORS = [
  { parserName: "Computer Science", schedulerCode: "CS" },
  { parserName: "Mathematics", schedulerCode: "MATH" },
  { parserName: "Political Science", schedulerCode: "POLISCI" },
] as const;

function parserResponse(major: string) {
  return {
    Major: [major],
    Concentration: [],
    Minor: [],
    "Degree Credits": {
      Status: "Still Needed",
      "Credits applied": 60,
      "Credits required": 120,
    },
    MajorInfo: {},
    Completed: [
      {
        name: "Introduction",
        tag: "major_core",
        credits: 3,
        courses: [
          { departmentCode: "SYN", courseID: "10000", name: "Introduction", grade: "A" },
        ],
      },
    ],
    "Still Needed": [
      {
        name: "Synthetic major requirement",
        tag: "major_core",
        credits: 3,
        courses: [
          { departmentCode: "SYN", courseID: "20000", name: "Synthetic Seminar", grade: null },
        ],
      },
    ],
    GPA: 3.5,
  };
}

const generatedSchedule = {
  score: 42,
  credits: 3,
  error_code: null,
  error_message: null,
  error_details: {},
  optimization_codes: ["MAXSAT_RC2_OPTIMIZED"],
  optimization_details: {},
  sections: [
    {
      class_num: 54321,
      section_code: "01",
      instruction_modality: "INPERSON",
      instructor: "Ada Lovelace",
      enrollment_total: 18,
      class_capacity: 25,
      major_elective: false,
      attributes: [],
      course: {
        subject_area: "SYN",
        catalog_number: 20000,
        course_title: "Synthetic Seminar",
        department: "SYN",
        academic_career: "UGRD",
        credits: 3,
        description: "Synthetic browser-test fixture.",
        tags: ["major_core"],
        prereqs: [],
      },
      meetings: [{ day: "MONDAY", start_time: 600, end_time: 675 }],
    },
  ],
};

async function mockCatalog(page: Page) {
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

async function completeSmartBuilder(page: Page, major: string) {
  await page.route("**/AuditParse", (route) =>
    route.fulfill({ status: 200, json: parserResponse(major) }),
  );
  await mockCatalog(page);

  await page.goto("/upload");
  await page.locator("#file-upload").setInputFiles({
    name: "synthetic-degreeworks.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% synthetic browser fixture\n"),
  });
  await page.getByRole("button", { name: "Upload and Analyze" }).click();
  await expect(page.getByRole("dialog")).toContainText("Synthetic major requirement");
  await page.getByRole("button", { name: "Continue to Preferences" }).click();
  await expect(page).toHaveURL(/\/preferences$/);
  await page.getByRole("button", { name: "Generate Schedules" }).click();
}

for (const major of MAJORS) {
  test(`${major.parserName} completes the Smart Builder journey`, async ({ page }, testInfo) => {
    const requests: unknown[] = [];
    await page.route("**/api/schedule/generate", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, json: generatedSchedule });
    });

    await completeSmartBuilder(page, major.parserName);

    await expect(page).toHaveURL(/\/planner\?imported=1$/);
    await expect(page.getByText("1 smart schedule added.")).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      parser_payload: {
        majors: [major.schedulerCode],
        classes_taken: [{ subject_area: "SYN", catalog_number: 10000 }],
        requirements_needed: [{
          name: "Synthetic major requirement",
          attribute: "major_core",
          credits_needed: 3,
          fulfilled_by: [{ subject_area: "SYN", catalog_number: 20000 }],
        }],
      },
      ui_payload: {
        credit_lower_bound: 3,
        credit_upper_bound: 18,
        unavailable: [],
        morning: false,
        afternoon: false,
        evening: false,
        less_gaps: false,
        less_days: false,
        in_person: false,
        remote: false,
        major_electives_needed: [],
        general_electives_needed: [],
        specific_courses: [],
        departmental: [],
      },
      term_season: "SPRING",
      term_year: 2027,
    });

    if (testInfo.project.name === "mobile-chrome") {
      await page.getByRole("tab", { name: "Schedule" }).first().click();
    }
    const selected = page.getByRole("region", { name: "Weekly schedule calendar" })
      .locator("xpath=following::section[@aria-labelledby='selected-sections-heading'][1]");
    await expect(selected).toContainText("SYN 20000");
    await expect(selected).toContainText("Synthetic Seminar");
    await expect(selected).toContainText("Ada Lovelace");
    await expect(selected).toContainText("18/25");

    await page.reload();
    if (testInfo.project.name === "mobile-chrome") {
      await page.getByRole("tab", { name: "Schedule" }).first().click();
    }
    await expect(page.getByRole("heading", { name: "Selected sections" }))
      .toBeVisible();
    await expect(page.getByText("Synthetic Seminar")).toBeVisible();

    await page.getByRole("button", { name: "Remove SYN 20000 section 01" }).click();
    await expect(page.getByText("Synthetic Seminar")).toHaveCount(0);
    await page.reload();
    if (testInfo.project.name === "mobile-chrome") {
      await page.getByRole("tab", { name: "Schedule" }).first().click();
    }
    await expect(page.getByText("Add a section to start building your schedule."))
      .toBeVisible();
    await expect(page.getByText("Synthetic Seminar")).toHaveCount(0);
  });
}

test("scheduler failure is readable and does not import a schedule", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "watchtower_setup_progress",
      JSON.stringify({ auditUploaded: true, preferencesSet: true, semester: "Spring 2027" }),
    );
    localStorage.setItem("watchtower_preferences", JSON.stringify({ semester: "spring-2027" }));
    sessionStorage.setItem(
      "watchtower_audit_data",
      JSON.stringify({
        parserPayload: {
          majors: ["CS"],
          classes_taken: [],
          requirements_needed: [],
          major_elective_credits: 0,
          general_elective_credits: 0,
        },
      }),
    );
  });
  await page.route("**/api/schedule/generate", (route) =>
    route.fulfill({
      status: 503,
      json: {
        ...generatedSchedule,
        sections: [],
        error_code: "SOLVER_FAILED",
        error_message: "Synthetic failure",
      },
    }),
  );

  await page.goto("/schedules");
  await expect(page.getByText("The scheduler encountered an internal error. Please try again."))
    .toBeVisible();
  await expect(page).toHaveURL(/\/schedules$/);
  expect(await page.evaluate(() => localStorage.getItem("hunter-schedules-v2"))).toBeNull();
});
