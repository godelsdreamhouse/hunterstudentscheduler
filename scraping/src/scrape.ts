import axios from "axios";
import { z } from "zod";

async function fetchAllCourses() {
  return await fetchCourseList("0", "999999");
}

async function fetchCourseList(skip: string, limit: string) {
  const date = getDate();

  const API_BASE =
    "https://app.coursedog.com/api/v1/cm/htr01/courses/search/$filters";

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
        effectiveDateRange: `${date}-${date}`,
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

async function fetchCourseDetail(courseGroupId: string) {
  const date = getDate();

  const API_BASE =
    "https://app.coursedog.com/api/v1/cm/htr01/courses/search/$filters";

  const response = await axios.get(API_BASE, {
    params: {
      courseGroupId: courseGroupId,
      includeRelatedData: "true",
      includeCrosslisted: "true",
      includeCourseEquivalencies: "true",
      effectiveDateRange: `${date},${date}`,
      columns:
        "departments,courseTypicallyOffered,career,credits,components,topics,catalogAttributes,description,requirementGroup,courseSchedule,customFields.ZK6fC,longName,institution,consent,customFields.cuPathwaysAttribute,subjectCode,courseNumber,customFields.cuLibartsFlag,code,name,college,status,institutionId,rawCourseId,crseOfferNbr,customFields.catalogAttributes,customFields.rawCourseId,sisId",
    },
    headers: {
      Accept: "application/json",
      Origin: "https://hunter-undergraduate.catalog.cuny.edu",
    },
  });

  return response.data;
}

async function fetchCourseSection(courseGroupId: string, termId: string) {
  const API_BASE = `https://app.coursedog.com/api/v1/ca/htr01/sections/${termId}/${courseGroupId}`;

  const response = await axios.get(API_BASE, {
    params: {
      includeRelatedData: "true",
      returnFields:
        "callNumber,sectionNumber,days,times,dates,instructionMode,enrollment,maxEnrollment,startDate,endDate",
    },
    headers: {
      Accept: "application/json",
      Origin: "https://hunter-undergraduate.catalog.cuny.edu",
    },
  });

  return response.data;
}

function getDate() {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  return `${currentYear}-${currentMonth}-${today}`;
}

(async () => {
  try {
    const result = await fetchCourseSection("1209731", "1262");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Scraping failed:", error);
    process.exit(1);
  }
})();
