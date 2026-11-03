import test from "node:test";
import assert from "node:assert/strict";
import { extractClauses, generateTestCases, sanitizePrefix, toJiraCsv, toMarkdown } from "../dist/generator.js";

const requirement = `
Pengguna dapat mengedit beberapa driver sekaligus.
- Sistem memvalidasi input dan menandai baris yang tidak sesuai.
- Perubahan hanya diterapkan pada data yang diedit.
- Setelah disimpan, perhitungan tabungan diperbarui.
- Fitur existing tidak boleh terganggu.
`;

test("sanitizePrefix creates stable test case prefixes", () => {
  assert.equal(sanitizePrefix("Tabungan Driver"), "TD");
  assert.equal(sanitizePrefix(""), "FITUR");
});

test("extractClauses removes bullets and keeps meaningful requirements", () => {
  const clauses = extractClauses(requirement);
  assert.ok(clauses.length >= 5);
  assert.equal(clauses.some((clause) => clause.startsWith("-")), false);
});

test("generateTestCases covers all selected QA categories", () => {
  const cases = generateTestCases({ featureName: "Tabungan Driver", requirement });
  assert.ok(cases.length >= 12);
  assert.deepEqual(new Set(cases.map((item) => item.category)), new Set(["happy", "negative", "edge", "regression"]));
  assert.equal(cases[0].id, "TC_TD_001");
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
});

test("generateTestCases respects category selection", () => {
  const cases = generateTestCases({ featureName: "Login", requirement: "Pengguna dapat login dengan email dan password valid lalu masuk ke dashboard.", coverage: ["happy"] });
  assert.ok(cases.length > 0);
  assert.equal(cases.every((item) => item.category === "happy"), true);
});

test("exports produce Notion Markdown and Jira CSV", () => {
  const cases = generateTestCases({ featureName: "Tabungan Driver", requirement, coverage: ["happy"] });
  const markdown = toMarkdown(cases);
  const csv = toJiraCsv(cases);
  assert.match(markdown, /^\| Test Case ID \|/);
  assert.match(markdown, /TC_TD_001/);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Summary","Description"/);
});
