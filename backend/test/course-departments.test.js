const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
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
      return {
        rows: [
          { code: "AFPRL", name: "Africana & Puerto Rican/Latino Studies" },
          { code: "CSCI", name: "Computer Science" },
        ],
      };
    },
  },
};

const coursesRouter = require("../src/routes/courses");

let baseUrl;
let server;

before(async () => {
  const app = express();
  app.use("/api/courses", coursesRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("lists departments with active undergraduate catalog courses", async () => {
  const response = await fetch(`${baseUrl}/api/courses/departments`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    departments: [
      { code: "AFPRL", name: "Africana & Puerto Rican/Latino Studies" },
      { code: "CSCI", name: "Computer Science" },
    ],
  });
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /c\.is_active = TRUE/);
  assert.match(queries[0].text, /ORDER BY d\.dep_name/);
  assert.equal(queries[0].values, undefined);
});
