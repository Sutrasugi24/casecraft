import test from "node:test";
import assert from "node:assert/strict";
import { detectStructuredFormat, parseStructuredSpecification } from "../dist/structured-import.js";

test("Gherkin import reads scenarios and Examples as parameter sets", () => {
  const text = `Feature: Login\nScenario Outline: Login valid\nGiven akun aktif\nWhen login dengan <email>\nThen dashboard tampil\nExamples:\n| email |\n| qa@example.com |`;
  const parsed = parseStructuredSpecification({ name: "login.feature", text });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.format, "Gherkin");
  assert.equal(parsed.cases.length, 1);
  assert.equal(parsed.cases[0].parameterSets.length, 1);
});

test("OpenAPI JSON and YAML imports use only declared operations and responses", () => {
  const json = JSON.stringify({ openapi: "3.0.0", info: { title: "Orders" }, paths: { "/orders": { get: { summary: "List orders", responses: { 200: { description: "OK" }, 401: { description: "Unauthorized" } } } } } });
  const yaml = `openapi: 3.0.0\npaths:\n  /users:\n    post:\n      summary: Create user\n      parameters:\n        - name: tenantId\n          in: header\n          required: true\n      requestBody:\n        required: false\n      responses:\n        '201':\n          description: Created\n        '400': Invalid`;
  const fromJson = parseStructuredSpecification({ name: "orders.json", text: json });
  const fromYaml = parseStructuredSpecification({ name: "users.yaml", text: yaml });
  assert.deepEqual(fromJson.cases.map((item) => item.category), ["happy", "negative"]);
  assert.deepEqual(fromYaml.cases.map((item) => item.expected), ["201 · Created", "400 · Invalid"]);
  assert.match(fromYaml.cases[0].precondition, /tenantId/);
  assert.doesNotMatch(fromYaml.cases[0].precondition, /request body/);
});

test("JSON Schema, CSV, and Markdown imports preserve available structure", () => {
  const schema = parseStructuredSpecification({ name: "profile.json", text: JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", title: "Profile", required: ["email"], properties: { email: { type: "string", format: "email" }, age: { type: "number", minimum: 18, maximum: 60 } } }) });
  const csv = parseStructuredSpecification({ name: "cases.csv", text: "scenario,steps,test data,expected,tags\nLogin valid,Isi email;Klik masuk,email valid,Dashboard tampil,smoke" });
  const markdown = parseStructuredSpecification({ name: "requirement.md", text: "# Profil\n- Pengguna dapat menyimpan profil dan status berubah menjadi Aktif." });
  assert.ok(schema.cases[0].parameterSets.length >= 3);
  assert.equal(csv.cases[0].steps.length, 2);
  assert.match(markdown.requirementText, /menyimpan profil/);
  assert.equal(detectStructuredFormat({ name: "unknown.txt", text: "abc" }), "unknown");
});
