import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

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
        academic_career: "UNDERGRADUATE",
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
	await page.route("**/api/courses/departments", (route) =>
		route.fulfill({
			json: {
				departments: [
					{ code: "CSCI", name: "Computer Science" },
					{ code: "MATH", name: "Mathematics" },
				],
			},
		}),
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

test("planner calendar renders Saturday and Sunday meetings", async ({ page }) => {
  await page.addInitScript(() => {
    const section = (classNum: number, code: string, day: "Saturday" | "Sunday", start: string, end: string) => ({
      class_num: classNum,
      term_season: "SPRING",
      term_year: 2027,
      section_number: "01",
      section_component: "lecture",
      group_code: null,
      instructor: "Synthetic Instructor",
      instruction_mode: "in_person",
      max_enrollment: 25,
      enrollment: 10,
      waitlist_max_enrollment: 0,
      waitlist_count: 0,
      enrollment_status: "open",
      notes: null,
      course_id: `synthetic-${classNum}`,
      course_code: code,
      course_name: `${day} Synthetic Course`,
      dep_code: "SYN",
      course_description: "Synthetic weekend browser-test fixture.",
      credits: 3,
      prerequisites: [],
      corequisites: [],
      catalog_attributes: [],
      meetings: [{ days: [day], start_time: start, end_time: end, location: "TEST 100" }],
    });
    localStorage.setItem("hunter-schedules-v2", JSON.stringify({
      activeId: "weekend-plan",
      schedules: [{
        id: "weekend-plan",
        name: "Weekend plan",
        term: { term_season: "SPRING", term_year: 2027 },
        sections: [
          section(71001, "SYN 710", "Saturday", "10:00", "11:15"),
          section(72001, "SYN 720", "Sunday", "12:30", "15:30"),
        ],
      }],
    }));
  });
  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await mockCatalog(page);

  await page.goto("/planner");
  await page.getByRole("tab", { name: "Schedule" }).first().click();

  await expect(page.getByRole("group", { name: "Saturday meetings" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Sunday meetings" })).toBeVisible();
  await expect(page.getByLabel(/Saturday, SYN 710, 10:00 AM to 11:15 AM/i)).toBeVisible();
  await expect(page.getByLabel(/Sunday, SYN 720, 12:30 PM to 3:30 PM/i)).toBeVisible();
});

test("catalog outages show an error instead of actionable preview sections", async ({ page }) => {
  let catalogAvailable = false;
  let loadMoreAttempts = 0;
  await page.addInitScript(() => {
    localStorage.setItem("hunter-schedules-v2", JSON.stringify({
      activeId: "legacy-preview-plan",
      schedules: [{
        id: "legacy-preview-plan",
        name: "Legacy preview plan",
        term: { term_season: "SPRING", term_year: 2027 },
        sections: [
          {
            class_num: 77777,
            term_season: "SPRING",
            term_year: 2027,
            section_number: "01",
            section_component: "lecture",
            group_code: null,
            instructor: "Saved Instructor",
            instruction_mode: "in_person",
            max_enrollment: 25,
            enrollment: 10,
            waitlist_max_enrollment: 0,
            waitlist_count: 0,
            enrollment_status: "open",
            notes: null,
            course_id: "saved-synthetic-201",
            course_code: "SYN 201",
            course_name: "Saved Synthetic Course",
            dep_code: "SYN",
            course_description: "A genuine browser-local section saved before the outage.",
            credits: 3,
            prerequisites: [],
            corequisites: [],
            catalog_attributes: [],
            meetings: [{
              days: ["Tuesday"], start_time: "13:00", end_time: "14:15", location: "TEST 201",
            }],
          },
          { course_id: "preview-csci-127" },
          { course_id: "preview-math-150" },
        ],
      }],
    }));
  });
  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await page.route("**/api/catalog/terms", (route) =>
    route.fulfill({ json: { terms: [{ term_season: "SPRING", term_year: 2027 }] } }),
  );
  await page.route("**/api/catalog/attributes?*", (route) =>
    route.fulfill({ json: { attributes: [] } }),
  );
  await page.route("**/api/catalog/sections?*", (route) => {
    if (!catalogAvailable) return route.fulfill({ status: 503, body: "catalog unavailable" });
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    if (offset > 0 && loadMoreAttempts++ === 0) {
      return route.fulfill({ status: 503, body: "pagination unavailable" });
    }
    const isNextPage = offset > 0;
    return route.fulfill({
      json: {
        sections: [{
          class_num: isNextPage ? 12346 : 12345,
          term_season: "SPRING",
          term_year: 2027,
          section_number: "01",
          section_component: "lecture",
          group_code: null,
          instructor: "Synthetic Instructor",
          instruction_mode: "in_person",
          max_enrollment: 25,
          enrollment: 10,
          waitlist_max_enrollment: 0,
          waitlist_count: 0,
          enrollment_status: "open",
          notes: null,
          course_id: isNextPage ? "synthetic-102" : "synthetic-101",
          course_code: isNextPage ? "SYN 102" : "SYN 101",
          course_name: isNextPage ? "Second Synthetic Catalog Course" : "Synthetic Catalog Course",
          dep_code: "SYN",
          course_description: "Synthetic browser-test fixture.",
          credits: 3,
          prerequisites: [],
          corequisites: [],
          catalog_attributes: [],
          meetings: [{
            days: ["Monday"], start_time: "10:00", end_time: "11:15", location: "TEST 101",
          }],
        }],
        pagination: { limit: 50, offset, has_more: !isNextPage },
      },
    });
  });

  await page.goto("/planner");
  const outage = page.getByRole("alert");
  await expect(outage).toContainText("Live catalog sections are unavailable");
  await expect(outage).toContainText("No course results are being shown");
  await expect(page.getByRole("button", { name: /^Add / })).toHaveCount(0);
  await expect(page.getByText("No sections match these filters.")).toHaveCount(0);
  expect(await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("hunter-schedules-v2") ?? "null");
    return saved?.schedules?.[0]?.sections?.map((section: { course_id: string }) => section.course_id);
  })).toEqual(["saved-synthetic-201"]);

  catalogAvailable = true;
  await page.getByRole("button", { name: "Retry catalog" }).click();
  await expect(page.getByLabel("Search courses and sections")).toBeFocused();
  await expect(page.getByText("SYN 101-01")).toBeVisible();
  await expect(outage).toHaveCount(0);

  await page.getByRole("button", { name: "Load more sections" }).click();
  await expect(outage).toContainText("More live catalog sections could not be loaded");
  await expect(page.getByText("SYN 101-01")).toBeVisible();

  await page.getByRole("button", { name: "Load more sections" }).click();
  await expect(page.getByText("SYN 102-01")).toBeVisible();
  await expect(outage).toHaveCount(0);
});

test("a superseded pagination failure cannot contaminate a new catalog search", async ({ page }) => {
  let releaseStaleRequest = () => {};
  let markStaleRequestStarted = () => {};
  let markStaleRequestFinished = () => {};
  const staleRequestGate = new Promise<void>((resolve) => {
    releaseStaleRequest = resolve;
  });
  const staleRequestStarted = new Promise<void>((resolve) => {
    markStaleRequestStarted = resolve;
  });
  const staleRequestFinished = new Promise<void>((resolve) => {
    markStaleRequestFinished = resolve;
  });

  await page.addInitScript(() => {
    const browserFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const rawUrl = typeof input === "string" ? input : input.url;
      const url = new URL(rawUrl, window.location.href);
      if (url.pathname.endsWith("/api/catalog/sections") && url.searchParams.get("offset") !== "0") {
        return browserFetch(input, { ...init, signal: undefined });
      }
      return browserFetch(input, init);
    };
  });
  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await page.route("**/api/catalog/terms", (route) =>
    route.fulfill({ json: { terms: [{ term_season: "SPRING", term_year: 2027 }] } }),
  );
  await page.route("**/api/catalog/attributes?*", (route) =>
    route.fulfill({ json: { attributes: [] } }),
  );
  await page.route("**/api/catalog/sections?*", async (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get("offset"));
    if (offset > 0) {
      markStaleRequestStarted();
      await staleRequestGate;
      await route.fulfill({ status: 503, body: "stale pagination failure" });
      markStaleRequestFinished();
      return;
    }
    const isNewSearch = url.searchParams.get("q") === "new";
    await route.fulfill({
      json: {
        sections: [{
          class_num: isNewSearch ? 22345 : 12345,
          term_season: "SPRING",
          term_year: 2027,
          section_number: "01",
          section_component: "lecture",
          group_code: null,
          instructor: "Synthetic Instructor",
          instruction_mode: "in_person",
          max_enrollment: 25,
          enrollment: 10,
          waitlist_max_enrollment: 0,
          waitlist_count: 0,
          enrollment_status: "open",
          notes: null,
          course_id: isNewSearch ? "new-201" : "old-101",
          course_code: isNewSearch ? "NEW 201" : "OLD 101",
          course_name: isNewSearch ? "New Search Result" : "Old Search Result",
          dep_code: isNewSearch ? "NEW" : "OLD",
          course_description: "Synthetic browser-test fixture.",
          credits: 3,
          prerequisites: [],
          corequisites: [],
          catalog_attributes: [],
          meetings: [{
            days: ["Monday"], start_time: "10:00", end_time: "11:15", location: "TEST 101",
          }],
        }],
        pagination: { limit: 50, offset: 0, has_more: !isNewSearch },
      },
    });
  });

  await page.goto("/planner");
  await expect(page.getByText("OLD 101-01")).toBeVisible();
  await page.getByRole("button", { name: "Load more sections" }).click();
  await staleRequestStarted;
  await page.getByLabel("Search courses and sections").fill("new");
  await expect(page.getByText("NEW 201-01")).toBeVisible();

  releaseStaleRequest();
  await staleRequestFinished;
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("NEW 201-01")).toBeVisible();
});

test("planner stays usable when browser storage writes fail", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hunter-schedules-v2", JSON.stringify({
      activeId: "readable-plan",
      schedules: [{
        id: "readable-plan",
        name: "Readable saved plan",
        term: { term_season: "SPRING", term_year: 2027 },
        sections: [{
          class_num: 77888,
          term_season: "SPRING",
          term_year: 2027,
          section_number: "02",
          section_component: "lecture",
          group_code: null,
          instructor: "Saved Instructor",
          instruction_mode: "in_person",
          max_enrollment: 25,
          enrollment: 10,
          waitlist_max_enrollment: 0,
          waitlist_count: 0,
          enrollment_status: "open",
          notes: null,
          course_id: "saved-synthetic-202",
          course_code: "SYN 202",
          course_name: "Readable Saved Course",
          dep_code: "SYN",
          course_description: "A readable browser-local section.",
          credits: 3,
          prerequisites: [],
          corequisites: [],
          catalog_attributes: [],
          meetings: [{
            days: ["Wednesday"], start_time: "14:00", end_time: "15:15", location: "TEST 202",
          }],
        }],
      }],
    }));
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function storageGetItem(key: string) {
      if (key === "hunter-planner-theme") {
        throw new DOMException("Synthetic theme read failure", "SecurityError");
      }
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Synthetic storage write failure", "QuotaExceededError");
    };
  });
  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await mockCatalog(page);

  await page.goto("/planner");
  const warning = page.getByRole("alert").filter({ hasText: "Browser storage is unavailable" });
  await expect(warning).toContainText("do not rely on this device to keep them");

  await page.getByRole("tab", { name: "Schedule", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Selected sections" })).toBeVisible();
  await expect(page.getByText("Readable Saved Course")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Saved schedule" })).toHaveValue("readable-plan");

  await page.getByRole("button", { name: "Use dark mode" }).click();
  await expect(page.getByRole("button", { name: "Use light mode" })).toBeVisible();
  await expect(warning).toBeVisible();
});

test("beta and audit-privacy notices appear before upload", async ({ page }) => {
  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await mockCatalog(page);

  await page.goto("/upload");
  const betaNotice = page.getByRole("note");
  await expect(betaNotice).toContainText("Student beta");
  await expect(betaNotice).toContainText("Enrollment and waitlist counts are periodic snapshots");
  await expect(betaNotice).toContainText("confirm current availability and degree requirements");

	const supportNotice = page.getByRole("region", { name: "Check your major before uploading" });
	await expect(supportNotice).toBeVisible();
	await expect(supportNotice).toContainText(
		"Smart Builder currently supports DegreeWorks audits listing only Computer Science, Mathematics, or Political Science",
	);
	await expect(supportNotice).toContainText(
		"If your audit lists another major, do not upload it here; use Course Search",
	);

  const privacyNotice = page.getByRole("region", { name: "How your audit is handled" });
  await expect(privacyNotice).toBeVisible();
  await expect(privacyNotice).toContainText("Your PDF is sent to Satisfi's parser");
  await expect(privacyNotice).toContainText(
    "the required audit facts and your planning preferences are sent to Satisfi's scheduler",
  );
  await expect(privacyNotice).toContainText("Only upload your own audit");
  await expect(privacyNotice).toContainText("On a shared computer, use Clear planning data");
  expect(await privacyNotice.evaluate((notice) => {
    const fileInput = document.querySelector("#file-upload");
    return fileInput !== null && Boolean(
      notice.compareDocumentPosition(fileInput) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  })).toBe(true);

  await page.goto("/planner");
  await expect(page.getByRole("note")).toContainText("Student beta");
});

test("manual planner uses readable removable filter chips", async ({ page }) => {
  const sectionRequests: string[] = [];
  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await page.route("**/api/catalog/terms", (route) =>
    route.fulfill({ json: { terms: [{ term_season: "SPRING", term_year: 2027 }] } }),
  );
  await page.route("**/api/catalog/attributes?*", (route) =>
    route.fulfill({
      json: {
        attributes: [
          "MEPY - ME_PSYC_1 (Introduction to Psychology)",
          "PLDI - GROUPC (Group C)",
          "PLDI - CATG4 (Category 4)",
          "WRIC - WRIC (Writing Intensive)",
        ],
      },
    }),
  );
  await page.route("**/api/catalog/sections?*", (route) => {
    sectionRequests.push(route.request().url());
    const hideFull = new URL(route.request().url()).searchParams.get("hide_full") === "true";
    const catalogSection = (classNum: number, code: string, enrollment: number, capacity: number, waitlist = 0, waitlistCapacity = 0) => ({
      class_num: classNum,
      term_season: "SPRING",
      term_year: 2027,
      section_number: "01",
      section_component: "lecture",
      group_code: null,
      instructor: "Synthetic Instructor",
      instruction_mode: "in_person",
      max_enrollment: capacity,
      enrollment,
      waitlist_max_enrollment: waitlistCapacity,
      waitlist_count: waitlist,
      enrollment_status: null,
      notes: null,
      course_id: `synthetic-${classNum}`,
      course_code: code,
      course_name: `${code} enrollment fixture`,
      dep_code: "SYN",
      course_description: "Synthetic enrollment browser-test fixture.",
      credits: 3,
      prerequisites: [],
      corequisites: [],
      catalog_attributes: [],
      meetings: [{ days: ["Monday"], start_time: "10:00", end_time: "11:15", location: "TEST 100" }],
    });
    const available = catalogSection(81001, "SYN 810", 24, 25);
    const full = catalogSection(82001, "SYN 820", 25, 25, 0, 10);
    const unpublishedCapacity = catalogSection(83001, "SYN 830", 18, 0, 4, 10);
    return route.fulfill({
      json: {
        sections: hideFull ? [available, unpublishedCapacity] : [available, full, unpublishedCapacity],
        pagination: { limit: 50, offset: 0, has_more: false },
      },
    });
  });

  await page.goto("/planner");
  await expect(page.getByText("24/25 seats filled", { exact: false })).toBeVisible();
  await expect(page.getByText("25/25 seats filled · Waitlist 0/10", { exact: true })).toBeVisible();
  await expect(page.getByText("18 enrolled · Capacity not published · Waitlist 4/10", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("button", { name: "Hide full sections" }).click();
  await expect.poll(() => sectionRequests.some((url) => (
    new URL(url).searchParams.get("hide_full") === "true"
  ))).toBe(true);
  await expect(page.getByText("25/25 seats filled", { exact: false })).toHaveCount(0);
  await expect(page.getByText("24/25 seats filled", { exact: false })).toBeVisible();
  await expect(page.getByText("Capacity not published", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Remove hide full sections filter" }).click();
  await expect(page.getByText("25/25 seats filled", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Filter Sunday" }).click();
  await expect(page.getByText("No sections match these filters.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove meeting days filter" })).toContainText("Days: Sun");
  await page.getByRole("button", { name: "Remove meeting days filter" }).click();
  await expect(page.getByText("24/25 seats filled", { exact: false })).toBeVisible();

  const attribute = page.getByLabel("Filter by course attribute");
  await expect(attribute.getByRole("option", { name: "Introduction to Psychology" }))
    .toHaveCount(0);
  await expect(attribute.getByRole("option", { name: "Pluralism and Diversity Group C" }))
    .toHaveCount(1);
  await attribute.selectOption({ label: "Writing Intensive" });

  const chip = page.getByRole("button", { name: "Remove course attribute filter" });
  await expect(chip).toContainText("Attribute: Writing Intensive");
  await expect(page.getByRole("button", { name: "Filters (1)" })).toBeVisible();
  await expect.poll(() => sectionRequests.some((url) => (
    new URL(url).searchParams.get("attribute") === "WRIC - WRIC (Writing Intensive)"
  ))).toBe(true);

  await chip.click();
  await expect(attribute).toHaveValue("");
  await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
});

test("manual planner persists selected details and exports the saved schedule", async ({ page }, testInfo) => {
  const manualSection = {
    class_num: 24680,
    term_season: "SPRING",
    term_year: 2027,
    section_number: "02",
    section_component: "lecture",
    group_code: null,
    instructor: "Grace Hopper",
    instruction_mode: "in_person",
    max_enrollment: 25,
    enrollment: 18,
    waitlist_max_enrollment: 5,
    waitlist_count: 1,
    enrollment_status: "open",
    notes: "Synthetic manual-planner fixture.",
    course_id: "synthetic-csci-235",
    course_code: "CSCI 235",
    course_name: "Software Analysis and Design II",
    dep_code: "CSCI",
    course_description: "A rich synthetic section used only for browser verification.",
    credits: 3,
    prerequisites: ["CSCI 135"],
    corequisites: [],
    catalog_attributes: ["WRIC - WRIC (Writing Intensive)"],
    meetings: [{
      days: ["Monday", "Wednesday"],
      start_time: "10:00:00",
      end_time: "11:15:00",
      location: "HN 1000",
    }],
  };

  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await page.route("**/api/catalog/terms", (route) =>
    route.fulfill({ json: { terms: [{ term_season: "SPRING", term_year: 2027 }] } }),
  );
  await page.route("**/api/catalog/attributes?*", (route) =>
    route.fulfill({ json: { attributes: manualSection.catalog_attributes } }),
  );
  await page.route("**/api/catalog/sections?*", (route) =>
    route.fulfill({
      json: {
        sections: [manualSection],
        pagination: { limit: 50, offset: 0, has_more: false },
      },
    }),
  );

  await page.goto("/planner");
  await page.getByRole("button", { name: "Add CSCI 235" }).click();

  if (testInfo.project.name === "mobile-chrome") {
    await page.getByRole("tab", { name: "Schedule" }).first().click();
  }
  const selected = page.getByRole("heading", { name: "Selected sections" }).locator("xpath=..");
  await expect(selected).toContainText("CSCI 235");
  await expect(selected).toContainText("Software Analysis and Design II");
  await expect(selected).toContainText("Lecture · Section 02 · Class #24680 · 3 credits");
  await expect(selected).toContainText("Mon/Wed · 10:00 AM–11:15 AM · HN 1000");
  await expect(selected).toContainText("Grace Hopper");
  await expect(selected).toContainText("In Person");
  await expect(selected).toContainText("18/25 · Open");

  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("hunter-schedules-v2") ?? "null");
    return state?.schedules?.find((schedule: { id: string }) => schedule.id === state.activeId)
      ?.sections?.map((section: { class_num: number }) => section.class_num);
  })).toEqual([24680]);

  await page.reload();
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByRole("tab", { name: "Schedule" }).first().click();
  }
  await expect(page.getByRole("heading", { name: "Selected sections" }).locator("xpath=.."))
    .toContainText("Software Analysis and Design II");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export calendar" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("my-schedule.ics");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const calendar = (await readFile(downloadPath!, "utf8")).replaceAll("\r\n ", "");
  expect(calendar).toContain("BEGIN:VCALENDAR");
  expect(calendar).toContain("SUMMARY:CSCI 235");
  expect(calendar).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO");
  expect(calendar).toContain("RRULE:FREQ=WEEKLY;BYDAY=WE");
  expect(calendar).toContain("LOCATION:HN 1000");
  expect(calendar).toContain("Class #24680");
  expect(calendar).toContain("Instructor: Grace Hopper");
  expect(calendar).toContain("END:VCALENDAR");
});

test("clear planning data requires confirmation and removes only planning state", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const selectedSection = {
      class_num: 24680,
      term_season: "SPRING",
      term_year: 2027,
      section_number: "02",
      section_component: "lecture",
      group_code: null,
      instructor: "Grace Hopper",
      instruction_mode: "in_person",
      max_enrollment: 25,
      enrollment: 18,
      waitlist_max_enrollment: 5,
      waitlist_count: 1,
      enrollment_status: "open",
      notes: null,
      course_id: "synthetic-csci-235",
      course_code: "CSCI 235",
      course_name: "Software Analysis and Design II",
      dep_code: "CSCI",
      course_description: null,
      credits: 3,
      prerequisites: [],
      corequisites: [],
      catalog_attributes: [],
      meetings: [{
        days: ["Monday", "Wednesday"],
        start_time: "10:00:00",
        end_time: "11:15:00",
        location: "HN 1000",
      }],
    };
    localStorage.setItem("hunter-schedules-v2", JSON.stringify({
      activeId: "manual-plan",
      schedules: [{
        id: "manual-plan",
        name: "My Schedule",
        term: { term_season: "SPRING", term_year: 2027 },
        sections: [selectedSection],
        source: "manual",
      }],
    }));
    localStorage.setItem("watchtower_preferences", JSON.stringify({ semester: "spring-2027" }));
    localStorage.setItem("watchtower_preferences:12345678", "scoped preferences");
    localStorage.setItem("watchtower_setup_progress", JSON.stringify({ auditUploaded: true }));
    localStorage.setItem("watchtower_planning_session_id", "12345678");
    localStorage.setItem("watchtower_active_user_id", "12345678");
    localStorage.setItem("hunter-planner-theme", "dark");
    localStorage.setItem("another-app-data", "keep-local");
    sessionStorage.setItem("watchtower_audit_data", "synthetic audit facts");
    sessionStorage.setItem("watchtower_audit_data:12345678", "scoped synthetic audit facts");
    sessionStorage.setItem("unrelated-session-data", "keep-session");
  });
  await page.route("**/api/users/profile", (route) =>
    route.fulfill({ status: 401, json: { error: "Synthetic unauthenticated session" } }),
  );
  await mockCatalog(page);

  await page.goto("/planner?imported=1");
  if (testInfo.project.name === "mobile-chrome") {
    await page.getByRole("tab", { name: "Schedule" }).first().click();
  }
  await expect(page.getByText("Software Analysis and Design II")).toBeVisible();

  const clearTrigger = page.getByRole("button", { name: "Clear planning data" });
  await clearTrigger.focus();
  await clearTrigger.press("Enter");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Clear planning data on this device?");
  await dialog.getByRole("button", { name: "Keep my data" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Software Analysis and Design II")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("watchtower_preferences"))).not.toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem("watchtower_audit_data"))).not.toBeNull();

  const reopenedClearTrigger = page.getByRole("button", { name: "Clear planning data" });
  await reopenedClearTrigger.focus();
  await expect(reopenedClearTrigger).toBeFocused();
  await reopenedClearTrigger.press("Enter");
  await expect(dialog).toBeVisible();
  const confirmClear = dialog.getByRole("button", { name: "Clear planning data" });
  await confirmClear.focus();
  await confirmClear.press("Enter");
  await expect(page).toHaveURL(/\/planner$/);
  await expect(page.getByLabel("Search courses and sections")).toBeFocused();

  const storage = await page.evaluate(() => ({
    preferences: localStorage.getItem("watchtower_preferences"),
    scopedPreferences: localStorage.getItem("watchtower_preferences:12345678"),
    progress: localStorage.getItem("watchtower_setup_progress"),
    planningSession: localStorage.getItem("watchtower_planning_session_id"),
    activeUser: localStorage.getItem("watchtower_active_user_id"),
    theme: localStorage.getItem("hunter-planner-theme"),
    unrelatedLocal: localStorage.getItem("another-app-data"),
    audit: sessionStorage.getItem("watchtower_audit_data"),
    scopedAudit: sessionStorage.getItem("watchtower_audit_data:12345678"),
    unrelatedSession: sessionStorage.getItem("unrelated-session-data"),
  }));
  expect(storage.preferences).toBeNull();
  expect(storage.scopedPreferences).toBeNull();
  expect(storage.progress).toBeNull();
  expect(storage.planningSession).toBeNull();
  expect(storage.activeUser).toBeNull();
  expect(storage.audit).toBeNull();
  expect(storage.scopedAudit).toBeNull();
  expect(storage.theme).toBe("dark");
  expect(storage.unrelatedLocal).toBe("keep-local");
  expect(storage.unrelatedSession).toBe("keep-session");
  await expect.poll(() => page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("hunter-schedules-v2") ?? "null");
    return state?.schedules?.find((schedule: { id: string }) => schedule.id === state.activeId)
      ?.sections?.map((section: { class_num: number }) => section.class_num);
  })).toEqual([]);

  if (testInfo.project.name === "mobile-chrome") {
    await page.getByRole("tab", { name: "Schedule" }).first().click();
  }
  await expect(page.getByText("Add a section to start building your schedule.")).toBeVisible();
  await expect(page.getByText("Software Analysis and Design II")).toHaveCount(0);
});

async function completeSmartBuilder(page: Page, major: string, customizePreferences = false) {
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
  if (customizePreferences) {
	await page.getByLabel("Maximum credits").fill("17.5");
	await page.getByLabel("Computer Science").click();
  }
  await page.getByRole("button", { name: "Generate Schedules" }).click();
}

test("unsupported majors receive a specific Smart Builder explanation", async ({ page }) => {
	let schedulerRequests = 0;
	await page.route("**/api/schedule/generate", (route) => {
		schedulerRequests += 1;
		return route.abort();
	});

	await completeSmartBuilder(page, "Biology");

	await expect(page).toHaveURL(/\/schedules$/);
	await expect(page.getByText(
		"This audit includes a major Smart Builder does not currently support. Smart Builder supports only Computer Science, Mathematics, and Political Science; use Course Search to build a schedule manually.",
	)).toBeVisible();
	expect(schedulerRequests).toBe(0);
});

for (const major of MAJORS) {
  test(`${major.parserName} completes the Smart Builder journey`, async ({ page }, testInfo) => {
    const requests: unknown[] = [];
    await page.route("**/api/schedule/generate", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, json: generatedSchedule });
    });

		const customizePreferences = major.schedulerCode === "CS";
		await completeSmartBuilder(page, major.parserName, customizePreferences);

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
				credit_lower_bound: 12,
				credit_upper_bound: customizePreferences ? 17.5 : 16,
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
				departmental: customizePreferences ? ["Computer Science"] : [],
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
    localStorage.setItem("watchtower_preferences", JSON.stringify({
      semester: "spring-2027",
      creditRange: [12, 16],
      blockedTimes: {},
      preferences: {
        backToBack: false,
        morningClasses: false,
        midDayClasses: false,
        eveningClasses: false,
        minimizeDays: false,
        preferInPerson: false,
        preferRemote: false,
      },
      preferredDepartments: [],
      specificCoursesList: [],
      electiveCourses: [],
    }));
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

test("leaving generation cancels the stale request without importing", async ({ page }) => {
  let releaseScheduler: (() => void) | undefined;
  let markRequestReceived: (() => void) | undefined;
  const responseGate = new Promise<void>((resolve) => {
    releaseScheduler = resolve;
  });
  const requestReceived = new Promise<void>((resolve) => {
    markRequestReceived = resolve;
  });
  await page.route("**/api/schedule/generate", async (route) => {
    markRequestReceived?.();
    await responseGate;
    try {
      await route.fulfill({ status: 200, json: generatedSchedule });
    } catch {
      // The fixed client aborts the request when the generation page unmounts.
    }
  });

  await completeSmartBuilder(page, "Computer Science");
  await expect(page).toHaveURL(/\/schedules$/);
  await requestReceived;
  await page.getByRole("button", { name: "Back to Preferences" }).first().click();
  await expect(page).toHaveURL(/\/preferences$/);

  releaseScheduler?.();
  await page.waitForTimeout(250);

  await expect(page).toHaveURL(/\/preferences$/);
  expect(await page.evaluate(() => localStorage.getItem("hunter-schedules-v2"))).toBeNull();
});
