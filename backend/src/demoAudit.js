// This fixture is intentionally limited to the demo account. It is derived
// from the supplied Political Science audit, but excludes the original PDF,
// student identity, grades, and course titles.
const DEMO_ACCOUNT_EMAIL = "phix.test@login.cuny.edu";

const DEMO_AUDIT = {
  creditsRequired: 120,
  creditsApplied: 122.7,
  gpa: 3.63,
  fileName: "Saved Political Science demo audit",
  parserPayload: {
    majors: ["POLISCI"],
    classes_taken: [
      { subject_area: "ENGL", catalog_number: 12000 },
      { subject_area: "ENGL", catalog_number: 22000 },
      { subject_area: "STAT", catalog_number: 21300 },
      { subject_area: "GEOG", catalog_number: 15000 },
      { subject_area: "HIST", catalog_number: 15200 },
      { subject_area: "CSCI", catalog_number: 12700 },
      { subject_area: "MATH", catalog_number: 15500 },
    ],
    requirements_needed: [
      {
        name: "Life & Physical Sciences",
        attribute: "CUNY Common Core",
        credits_needed: 3,
        fulfilled_by: [
          { subject_area: "ANTHP", catalog_number: 10100 },
          { subject_area: "ASTRO", catalog_number: 10200 },
          { subject_area: "BIOL", catalog_number: 10000 },
          { subject_area: "CHEM", catalog_number: 10000 },
          { subject_area: "PHYS", catalog_number: 10100 },
        ],
      },
      {
        name: "SUBFIELD: American Government Courses",
        attribute: "Political Science",
        credits_needed: 3,
        fulfilled_by: [
          { subject_area: "POLSC", catalog_number: 11000 },
          { subject_area: "POLSC", catalog_number: 11100 },
          { subject_area: "POLSC", catalog_number: 21100 },
          { subject_area: "POLSC", catalog_number: 21200 },
          { subject_area: "POLSC", catalog_number: 21300 },
        ],
      },
      {
        name: "SUBFIELD: Political Theory Courses",
        attribute: "Political Science",
        credits_needed: 3,
        fulfilled_by: [
          { subject_area: "POLSC", catalog_number: 20000 },
          { subject_area: "POLSC", catalog_number: 20100 },
          { subject_area: "POLSC", catalog_number: 20200 },
          { subject_area: "POLSC", catalog_number: 20300 },
          { subject_area: "POLSC", catalog_number: 20401 },
        ],
      },
      {
        name: "SUBFIELD: Comparative Politics Courses",
        attribute: "Political Science",
        credits_needed: 3,
        fulfilled_by: [
          { subject_area: "POLSC", catalog_number: 11700 },
          { subject_area: "POLSC", catalog_number: 25000 },
          { subject_area: "POLSC", catalog_number: 25100 },
          { subject_area: "POLSC", catalog_number: 25200 },
          { subject_area: "POLSC", catalog_number: 26100 },
        ],
      },
      {
        name: "SUBFIELD: International Relations Courses",
        attribute: "Political Science",
        credits_needed: 3,
        fulfilled_by: [
          { subject_area: "POLSC", catalog_number: 11500 },
          { subject_area: "POLSC", catalog_number: 27000 },
          { subject_area: "POLSC", catalog_number: 27100 },
          { subject_area: "POLSC", catalog_number: 27303 },
          { subject_area: "POLSC", catalog_number: 27306 },
        ],
      },
      {
        name: "Major Political Science Elective",
        attribute: "Political Science elective",
        credits_needed: 18,
        fulfilled_by: [],
      },
    ],
    major_elective_credits: 18,
    general_elective_credits: 0,
  },
  requirementsSummary: {
    degree: [
      "122.7 / 120 total credits — Completed",
      "Political Science: 0 / 30 credits — Still Needed",
    ],
    commonCore: [
      "English Composition — Completed",
      "Mathematical and Quantitative Reasoning — Completed",
      "Life & Physical Sciences — Still Needed",
    ],
    pluralism: ["Pluralism & Diversity — Completed"],
    hunterFocus: ["Hunter Focus: Foreign Language — Completed"],
    writing: ["Writing Requirement — Completed"],
    major: [
      "SUBFIELD: American Government Courses — Still Needed",
      "SUBFIELD: Political Theory Courses — Still Needed",
      "SUBFIELD: Comparative Politics Courses — Still Needed",
      "SUBFIELD: International Relations Courses — Still Needed",
    ],
    additionalMajor: [],
    electives: ["Major Political Science Elective — Still Needed"],
  },
};

module.exports = { DEMO_ACCOUNT_EMAIL, DEMO_AUDIT };
