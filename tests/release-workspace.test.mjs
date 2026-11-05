import test from "node:test";
import assert from "node:assert/strict";
import { compareTestRuns } from "../dist/run-comparison.js";
import { buildQaReport, renderQaReportHtml } from "../dist/qa-report.js";
import { exportWithAdapter, listAdapters, registerAdapter } from "../dist/adapter-registry.js";
import { collaborationCapabilities, registerCollaborationProvider } from "../dist/collaboration-provider.js";
import { generateTestCases } from "../dist/generator.js";

const feature = {
  name: "Checkout <Regional>",
  requirements: [{ id: "REQ-001" }],
  cases: [
    { id: "TC_001", scenario: "Bayar invoice", category: "happy", risk: { score: 80 } },
    { id: "TC_002", scenario: "Gateway timeout", category: "negative", risk: { score: 75 } },
    { id: "TC_003", scenario: "Voucher baru", category: "edge", risk: { score: 50 } },
  ],
  cycles: [
    { id: "CYCLE-001", name: "Build 1", buildVersion: "1.0", caseIds: ["TC_001", "TC_002"], results: { TC_001: { qaStatus: "Lulus" }, TC_002: { qaStatus: "Gagal", defectReference: "BUG-1" } } },
    { id: "CYCLE-002", name: "Build 2", buildVersion: "1.1", environment: "Staging", caseIds: ["TC_001", "TC_002", "TC_003"], results: { TC_001: { qaStatus: "Gagal", defectReference: "BUG-2" }, TC_002: { qaStatus: "Lulus" }, TC_003: { qaStatus: "Terblokir", blocker: "Data belum tersedia" } } },
  ],
};

test("run comparison classifies new failures, fixes, regressions, blockers, and pass-rate delta", () => {
  const comparison = compareTestRuns(feature, "CYCLE-001", "CYCLE-002");
  assert.deepEqual(comparison.newCases.map((item) => item.caseId), ["TC_003"]);
  assert.deepEqual(comparison.fixed.map((item) => item.caseId), ["TC_002"]);
  assert.deepEqual(comparison.regressions.map((item) => item.caseId), ["TC_001"]);
  assert.deepEqual(comparison.activeBlockers.map((item) => item.caseId), ["TC_003"]);
  assert.equal(comparison.passRateDelta, -16.7);
});

test("local QA report includes scope, execution, defects, blockers, risks, and escaped HTML", () => {
  const report = buildQaReport(feature, "CYCLE-002", { baselineId: "CYCLE-001", language: "en", generatedAt: "2026-11-04T00:00:00.000Z" });
  const html = renderQaReportHtml(report);
  assert.equal(report.defects[0].reference, "BUG-2");
  assert.equal(report.blockers[0].reason, "Data belum tersedia");
  assert.equal(report.residualRisks.length, 1);
  assert.match(html, /Test run comparison/);
  assert.match(html, /<td>Failed<\/td>/);
  assert.doesNotMatch(html, /<td>Gagal<\/td>/);
  assert.match(html, /Checkout &lt;Regional&gt;/);
  assert.doesNotMatch(html, /Checkout <Regional>/);
});

test("adapter registry exposes built-in systems and accepts a validated local adapter", () => {
  const ids = listAdapters("export").map((adapter) => adapter.id);
  assert.ok(["jira", "azure", "testrail", "xray", "internal"].every((id) => ids.includes(id)));
  const result = exportWithAdapter("azure", feature.cases, { columns: ["scenario", "id"] });
  assert.match(result.content, /Casecraft ID,Title/);
  registerAdapter({ id: "sample-local", label: "Sample local", export: () => ({ content: "ok", extension: "txt", mime: "text/plain" }) });
  assert.equal(exportWithAdapter("sample-local", []).content, "ok");
});

test("collaboration providers require explicit privacy and consent contracts", () => {
  assert.throws(() => registerCollaborationProvider({ id: "unsafe", label: "Unsafe", connect() {} }), /kebijakan privasi/);
  registerCollaborationProvider({ id: "team-safe", label: "Team Safe", privacyPolicyUrl: "https://example.test/privacy", consentText: "Saya setuju", connect() {} });
  const capabilities = collaborationCapabilities();
  assert.equal(capabilities.mode, "local");
  assert.equal(capabilities.networkEnabled, false);
  assert.equal(capabilities.providers.length, 1);
});

test("generator can emit deterministic English structural output independently of requirement language", () => {
  const cases = generateTestCases({ featureName: "Profile", requirement: "Given user has a valid profile When user saves the profile Then profile status becomes Active.", coverage: ["happy"], outputLanguage: "en" });
  assert.equal(cases[0].outputLanguage, "en");
  assert.match(cases[0].steps.join(" "), /Prepare valid data|Perform action/);
});

