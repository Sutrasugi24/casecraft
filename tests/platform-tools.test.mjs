import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { exportFixture, generateSyntheticDataset, maskSensitiveData, parseFieldDefinitions } from "../dist/test-data-studio.js";
import { analyzeFlakyTests } from "../dist/flaky-analysis.js";
import { runCiQualityGate } from "../dist/ci-quality-gate.js";
import { CASECRAFT_SDK_VERSION, createCasecraftPlugin, createPluginRegistry } from "../dist/plugin-sdk.js";

test("test data studio creates deterministic synthetic boundary fixtures", () => {
  const fields = parseFieldDefinitions("email:email\namount:integer,min=1,max=10\ncode:string,minLength=2,maxLength=4");
  const first = generateSyntheticDataset(fields, { count: 3, seed: "release-42", includeBoundaries: true });
  const second = generateSyntheticDataset(fields, { count: 3, seed: "release-42", includeBoundaries: true });
  assert.deepEqual(first.records, second.records);
  assert.ok(first.records.some((record) => record.amount === 0));
  assert.ok(first.records.some((record) => record.amount === 11));
  assert.ok(first.records.every((record) => String(record.email).endsWith("@example.test")));
  assert.match(exportFixture(first.records, "csv").content, /^\uFEFFemail,amount,code/);
  assert.throws(() => parseFieldDefinitions("amount:integer,min=10,max=1"), /min tidak boleh/);
  assert.throws(() => parseFieldDefinitions("email:email,minLength=2"), /tidak didukung/);
});

test("masking removes common sensitive values without mutating source", () => {
  const source = { email: "qa@corp.test", profile: { phone: "+628123456789", publicLabel: "Demo" }, internalReference: "ABC-123" };
  const masked = maskSensitiveData(source, { fields: ["internalReference"] });
  assert.equal(source.email, "qa@corp.test");
  assert.notEqual(masked.email, source.email);
  assert.match(masked.profile.phone, /\*+6789$/);
  assert.equal(masked.profile.publicLabel, "Demo");
  assert.equal(masked.internalReference, "***MASKED***");
});

test("flaky analysis distinguishes retry recovery, environment signal, and product signal", () => {
  const feature = {
    cases: [
      { id: "TC_001", scenario: "Retry recovers", automation: { lifecycle: "automated" } },
      { id: "TC_002", scenario: "Environment differs", automation: { lifecycle: "automated" } },
      { id: "TC_003", scenario: "Consistent defect", automation: { lifecycle: "automated" } },
    ],
    cycles: [
      { id: "CYCLE-001", name: "Chrome", environment: "staging", browser: "Chrome", results: { TC_001: { qaStatus: "Lulus", automationRetries: 1, automationFlaky: true }, TC_002: { qaStatus: "Gagal" }, TC_003: { qaStatus: "Gagal", defectReference: "BUG-9" } } },
      { id: "CYCLE-002", name: "Firefox", environment: "staging", browser: "Firefox", results: { TC_002: { qaStatus: "Lulus" }, TC_003: { qaStatus: "Gagal", defectReference: "BUG-9" } } },
    ],
  };
  const report = analyzeFlakyTests(feature);
  assert.equal(report.cases.find((item) => item.caseId === "TC_001").classification.code, "automation-instability");
  assert.equal(report.cases.find((item) => item.caseId === "TC_002").classification.code, "environment-signal");
  assert.equal(report.cases.find((item) => item.caseId === "TC_003").classification.code, "product-defect-signal");
});

test("CI quality gate blocks uncovered criteria, ambiguous expected, high duplicates, and stale regression", () => {
  const base = { steps: ["Jalankan langkah terukur"], testData: "id=1", precondition: "Data tersedia", qaStatus: "Belum diuji", parameterSets: [] };
  const collection = { features: [{
    id: "checkout", name: "Checkout", archived: false,
    requirements: [{ id: "REQ-001", criteria: [{ id: "REQ-001-AC-001", text: "Simpan order" }, { id: "REQ-001-AC-002", text: "Audit order" }] }, { id: "REQ-002", criteria: [] }],
    cases: [
      { ...base, id: "TC_CHECKOUT_001", category: "happy", scenario: "Simpan order", expected: "Berjalan baik", criterionIds: ["REQ-001-AC-001"] },
      { ...base, id: "TC_CHECKOUT_002", category: "happy", scenario: "Simpan order", expected: "Order tersimpan", criterionIds: ["REQ-001-AC-001"] },
      { ...base, id: "TC_CHECKOUT_003", category: "regression", scenario: "Regression order", expected: "Order tersimpan", criterionIds: ["REQ-001-AC-001"], requirementImpact: { status: "update" } },
    ],
  }] };
  const gate = runCiQualityGate(collection, { maxDuplicateRatio: 0.2 });
  assert.equal(gate.passed, false);
  assert.ok(["criterion-uncovered", "requirement-uncovered", "expected-unmeasurable", "duplicate-ratio-high", "regression-suite-stale"].every((code) => gate.findings.some((finding) => finding.code === code && finding.severity === "error")));
});

test("plugin SDK registers namespaced capabilities and rejects incompatible versions", async () => {
  const registry = createPluginRegistry();
  registry.register(createCasecraftPlugin({ id: "acme.qa", name: "ACME", sdkVersion: CASECRAFT_SDK_VERSION, setup(api) { api.registerExporter({ id: "acme.qa.text", label: "Text", run: (cases) => cases.map((item) => item.id).join("\n") }); } }));
  assert.equal(await registry.execute("exporter", "acme.qa.text", [{ id: "TC_001" }]), "TC_001");
  assert.throws(() => createCasecraftPlugin({ id: "acme.bad", name: "Bad", sdkVersion: 999, setup() {} }), /membutuhkan SDK/);
  assert.throws(() => registry.register(createCasecraftPlugin({ id: "broken.qa", name: "Broken", sdkVersion: CASECRAFT_SDK_VERSION, setup(api) { api.registerValidator({ id: "broken.qa.partial", label: "Partial", run() {} }); throw new Error("setup failed"); } })), /setup failed/);
  assert.equal(registry.has("validator", "broken.qa.partial"), false);
});

test("open project schema declares the portable envelope and execution evidence", async () => {
  const schema = JSON.parse(await readFile(new URL("../docs/casecraft-project.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.properties.format.const, "casecraft-project");
  assert.equal(schema.properties.formatVersion.const, 1);
  assert.ok(schema.$defs.result.properties.automationRetries);
});
