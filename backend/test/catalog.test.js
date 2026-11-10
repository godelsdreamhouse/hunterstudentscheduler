const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");

const queries = [];
const dbPath = require.resolve("../src/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (text, values) => {
      queries.push({ text, values });
      if (text.includes("GROUP BY term_season")) {
        return { rows: [{ term_season: "FALL", term_year: 2026 }] };
      }
      return { rows: [{ class_num: 12345, meetings: [] }] };
    },
  },
};

const catalogRouter = require("../src/routes/catalog");

let baseUrl;
let server;

before(async () => {
  const app = express();
  app.use("/api/catalog", catalogRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

beforeEach(() => {
  queries.length = 0;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("lists public catalog terms", async () => {
  const response = await fetch(`${baseUrl}/api/catalog/terms`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    terms: [{ term_season: "FALL", term_year: 2026 }],
  });
  assert.equal(queries.length, 1);
});

test("rejects an invalid catalog term without querying the database", async () => {
  const response = await fetch(
    `${baseUrl}/api/catalog/sections?term_season=AUTUMN&term_year=2026`,
  );
  assert.equal(response.status, 400);
  assert.equal(queries.length, 0);
});

test("searches sections with parameterized term and query values", async () => {
  const response = await fetch(
    `${baseUrl}/api/catalog/sections?term_season=fall&term_year=2026&q=CSCI`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    sections: [{ class_num: 12345, meetings: [] }],
    pagination: { limit: 50, offset: 0, has_more: false },
  });
  assert.deepEqual(queries[0].values, ["FALL", 2026, "CSCI", 51, 0, "", false]);
  assert.match(queries[0].text, /s\.term_season = \$1/);
  assert.match(queries[0].text, /s\.term_year = \$2/);
});

test("applies hide-full before pagination with a parameterized boolean", async () => {
  const response = await fetch(
    `${baseUrl}/api/catalog/sections?term_season=FALL&term_year=2026&hide_full=true&limit=20&offset=40`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(queries[0].values, ["FALL", 2026, "", 21, 40, "", true]);
  assert.match(queries[0].text, /NOT \$7::boolean/);
  assert.match(queries[0].text, /s\.max_enrollment <= 0/);
  assert.match(queries[0].text, /s\.enrollment < s\.max_enrollment/);
  assert.ok(
    queries[0].text.indexOf("NOT $7::boolean") < queries[0].text.indexOf("LIMIT $4"),
    "capacity filtering must happen before LIMIT/OFFSET",
  );
});

test("accepts explicit hide_full=false without hiding sections", async () => {
  const response = await fetch(
    `${baseUrl}/api/catalog/sections?term_season=FALL&term_year=2026&hide_full=false`,
  );
  assert.equal(response.status, 200);
  assert.equal(queries[0].values[6], false);
});

test("rejects invalid hide_full values without querying the database", async () => {
  for (const value of ["1", "TRUE", "yes", "", "true&hide_full=false"]) {
    queries.length = 0;
    const response = await fetch(
      `${baseUrl}/api/catalog/sections?term_season=FALL&term_year=2026&hide_full=${value}`,
    );
    assert.equal(response.status, 400);
    assert.equal(queries.length, 0);
  }
});

test("rejects oversized public search queries", async () => {
  const query = "x".repeat(101);
  const response = await fetch(
    `${baseUrl}/api/catalog/sections?term_season=FALL&term_year=2026&q=${query}`,
  );
  assert.equal(response.status, 400);
  assert.equal(queries.length, 0);
});
