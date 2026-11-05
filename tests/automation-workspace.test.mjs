import test from "node:test";
import assert from "node:assert/strict";
import { assessAutomationReadiness, automationCoverage, generateAutomationSkeleton } from "../dist/automation-tools.js";
import { generatePairwise, parsePairwiseFactors } from "../dist/pairwise.js";
import { applyAutomationResults, parseAutomationReport } from "../dist/automation-results.js";
import { suggestRegressionCases } from "../dist/change-analysis.js";
import { buildDependencyGraph } from "../dist/dependency-graph.js";
import { parseStructuredSpecification } from "../dist/structured-import.js";

const readyCase = {
  id: "TC_CHECKOUT_001",
  module: "Checkout",
  scenario: "Simpan order",
  precondition: "Member sudah login.",
  steps: ["Isi order", "Simpan order"],
  testData: "sku=ABC, qty=1",
  expected: "Order tersimpan dan status menjadi Pending.",
  tags: ["checkout"],
  risk: { score: 80 },
  parameterSets: [],
  automation: { reviewStatus: "approved", lifecycle: "candidate", selector: "[data-testid='save']", cleanup: "Hapus order uji." },
};

test("automation readiness checks selector, data, precondition, assertion, and cleanup", () => {
  const readiness = assessAutomationReadiness(readyCase);
  assert.equal(readiness.score, 100);
  assert.equal(readiness.level, "ready");
  const incomplete = assessAutomationReadiness({ id: "TC_EMPTY", expected: "Tampil" });
  assert.deepEqual(incomplete.missing.sort(), ["cleanup", "data", "precondition", "selector"].sort());
});

test("automation skeleton requires QA approval and emits deterministic supported drafts", () => {
  assert.throws(() => generateAutomationSkeleton({ ...readyCase, automation: { ...readyCase.automation, reviewStatus: "draft" } }, "playwright"), /disetujui QA/);
  for (const framework of ["playwright", "cypress", "webdriverio", "postman"]) {
    const result = generateAutomationSkeleton(readyCase, framework);
    assert.equal(result.draft, true);
    assert.match(result.content, /TC_CHECKOUT_001/);
    assert.match(result.content, /wajib ditinjau|Review engineer wajib/);
  }
  const postman = generateAutomationSkeleton(readyCase, "postman");
  assert.match(postman.content, /TODO_METHOD/);
  assert.doesNotMatch(postman.content, /oneOf\(\[200\]\)/);
  const contractDraft = generateAutomationSkeleton({ ...readyCase, scenario: "POST /orders menghasilkan 201", expected: "201 · Created", tags: ["openapi"] }, "postman");
  assert.match(contractDraft.content, /\"method\": \"POST\"/);
  assert.match(contractDraft.content, /\"value\": \"201\"/);
});

test("automation report imports JUnit and Playwright results into an explicit cycle", () => {
  const junit = parseAutomationReport({ name: "junit.xml", text: `<testsuite><testcase classname="checkout" name="TC_CHECKOUT_001 saves"><failure message="Expected 200, received 500">trace</failure></testcase></testsuite>` });
  assert.equal(junit.entries[0].qaStatus, "Gagal");
  const playwright = parseAutomationReport({ name: "report.json", text: JSON.stringify({ config: {}, suites: [{ title: "checkout", specs: [{ title: "TC_CHECKOUT_001", tests: [{ results: [{ status: "failed", error: { message: "timeout" } }, { status: "passed" }] }] }] }] }) });
  assert.equal(playwright.entries[0].flaky, true);
  const feature = { activeCycleId: "CYCLE-002", cases: [{ ...readyCase }], cycles: [{ id: "CYCLE-001", caseIds: [], results: {} }, { id: "CYCLE-002", caseIds: [], results: {} }] };
  const summary = applyAutomationResults(feature, "CYCLE-001", junit.entries, "2026-11-04T00:00:00.000Z");
  assert.equal(summary.matched, 1);
  assert.equal(feature.cycles[0].results.TC_CHECKOUT_001.qaStatus, "Gagal");
  assert.equal(feature.cases[0].qaStatus, undefined, "non-active cycle must not overwrite the visible active result");
});

test("manual–automation coverage distinguishes candidates, automated, flaky, and unsuitable cases", () => {
  const coverage = automationCoverage([
    readyCase,
    { ...readyCase, id: "TC_002", automation: { ...readyCase.automation, lifecycle: "automated" } },
    { ...readyCase, id: "TC_003", automation: { ...readyCase.automation, lifecycle: "flaky" } },
    { ...readyCase, id: "TC_004", automation: { ...readyCase.automation, lifecycle: "not-suitable" } },
  ]);
  assert.deepEqual(coverage.counts, { manual: 0, candidate: 1, automated: 1, flaky: 1, "not-suitable": 1 });
});

test("pairwise covers every value pair without full Cartesian expansion", () => {
  const factors = parsePairwiseFactors("browser=Chrome|Firefox|Safari\nrole=admin|member\nlocale=id|en");
  const combinations = generatePairwise(factors);
  assert.ok(combinations.length < 12);
  for (let first = 0; first < factors.length; first += 1) for (let second = first + 1; second < factors.length; second += 1) {
    for (const firstValue of factors[first].values) for (const secondValue of factors[second].values) {
      assert.ok(combinations.some((item) => item.values[factors[first].name] === firstValue && item.values[factors[second].name] === secondValue), `${firstValue}/${secondValue} must be covered`);
    }
  }
});

test("dependency graph connects requirements, cases, data, runs, defects, and scripts", () => {
  const feature = { id: "checkout", name: "Checkout", requirements: [{ id: "REQ-001", currentVersion: 2 }], cases: [{ ...readyCase, criterionIds: ["REQ-001-AC-001"], defectReference: "BUG-9", parameterSets: [{ id: "DATA-001", label: "Valid", data: "qty=1" }], automation: { ...readyCase.automation, scripts: [{ framework: "playwright", filename: "checkout.spec.js" }] } }], cycles: [{ id: "CYCLE-001", name: "Build 1", results: { TC_CHECKOUT_001: { qaStatus: "Gagal" } } }] };
  const graph = buildDependencyGraph(feature);
  assert.ok(["requirement", "case", "data", "run", "defect", "script"].every((type) => graph.nodes.some((node) => node.type === type)));
  assert.ok(graph.edges.some((edge) => edge.relation.includes("draft automation")));
});

test("Git diff analysis suggests only cases with local evidence matches", () => {
  const feature = { cases: [readyCase, { ...readyCase, id: "TC_PROFILE_001", module: "Profile", scenario: "Ubah avatar", tags: ["profile"] }] };
  const analysis = suggestRegressionCases(feature, "diff --git a/src/checkout/order.js b/src/checkout/order.js\n+++ b/src/checkout/order.js\n+function saveCheckoutOrder() {}");
  assert.deepEqual(analysis.suggestions.map((item) => item.caseId), ["TC_CHECKOUT_001"]);
  assert.ok(analysis.suggestions[0].matches.includes("checkout"));
});

test("contract import creates response, error, authorization, and boundary evidence from OpenAPI", () => {
  const document = { openapi: "3.1.0", info: { title: "Orders" }, security: [{ bearerAuth: [] }], paths: { "/orders": { post: { parameters: [{ name: "limit", required: true, schema: { minimum: 1, maximum: 10 } }], responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } }, 401: { description: "Unauthorized", content: { "application/json": { schema: { type: "object" } } } }, 422: { description: "Invalid" } } } } } };
  const parsed = parseStructuredSpecification({ name: "openapi.json", text: JSON.stringify(document) });
  assert.equal(parsed.ok, true);
  assert.ok(parsed.cases.some((item) => item.tags.includes("response-contract") && /response schema/.test(item.expected)));
  assert.ok(parsed.cases.some((item) => item.tags.includes("error-contract")));
  assert.ok(parsed.cases.some((item) => item.tags.includes("authorization")));
  assert.ok(parsed.cases.some((item) => item.parameterSets.some((set) => /di luar/.test(set.label))));
  assert.ok(parsed.cases.some((item) => item.parameterSets.some((set) => set.data === "limit=0")));
  assert.ok(parsed.cases.some((item) => item.parameterSets.some((set) => set.data === "limit=11")));
});
