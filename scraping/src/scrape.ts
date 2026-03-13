import axios from "axios";
import { z } from "zod";

async function scrapeAllCourses() {
  return await scrapeCourseList("0", "999999");
}

async function scrapeCourseList(skip: string, limit: string) {
  const API_BASE =
    "https://app.coursedog.com/api/v1/cm/htr01/courses/search/%24filters";

  const response = await axios.post(
    API_BASE,
    {
      condition: "AND",
      filters: [
        {
          filters: [
            {
              id: "status-course",
              condition: "field",
              name: "status",
              inputType: "select",
              group: "course",
              type: "is",
              value: "Active",
              customField: false,
            },
            {
              id: "catalogPrint-course",
              condition: "field",
              name: "catalogPrint",
              inputType: "boolean",
              group: "course",
              type: "is",
              value: true,
              customField: false,
            },
            {
              id: "career-course",
              condition: "field",
              name: "career",
              inputType: "careerSelect",
              group: "course",
              type: "is",
              value: "Undergraduate",
              customField: false,
            },
          ],
          id: "zvOi8Ggo",
          condition: "and",
        },
      ],
    },
    {
      params: {
        skip: skip,
        limit: limit,
        orderBy: "code",
        effectiveDateRange: "2026-03-12,2026-03-12",
        ignoreEffectiveDating: "false",
        columns:
          "displayName,department,name,courseNumber,subjectCode,code,courseGroupId,credits.creditHours,longName,career,components,customFields.catalogRequirementDesignation,customFields.catalogAttributes",
      },
      headers: {
        Accept: "application/json",
        Origin: "https://hunter-undergraduate.catalog.cuny.edu",
        "Content-Type": "application/json",
      },
    },
  );

  return response.data;
}

(async () => {
  try {
    const result = await scrapeCourseList("0", "20");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Scraping failed:", error);
    process.exit(1);
  }
})();
