const FRAMEWORKS = new Set(["playwright", "cypress", "webdriverio", "postman"]);
const LIFECYCLES = new Set(["manual", "candidate", "automated", "flaky", "not-suitable"]);

function value(value = "") {
  return String(value || "").trim();
}

function comment(valueToClean = "") {
  return value(valueToClean).replace(/\*\//g, "* /").replace(/[\r\n]+/g, " ");
}

export function normalizeAutomation(automation = {}) {
  return {
    reviewStatus: automation.reviewStatus === "approved" ? "approved" : "draft",
    lifecycle: LIFECYCLES.has(automation.lifecycle) ? automation.lifecycle : "manual",
    selector: value(automation.selector),
    data: value(automation.data),
    cleanup: value(automation.cleanup),
    scripts: Array.isArray(automation.scripts) ? automation.scripts.map((script) => ({
      framework: FRAMEWORKS.has(script?.framework) ? script.framework : "playwright",
      filename: value(script?.filename),
      generatedAt: value(script?.generatedAt),
      status: "draft",
    })).filter((script) => script.filename) : [],
  };
}

export function assessAutomationReadiness(testCase = {}) {
  const automation = normalizeAutomation(testCase.automation);
  const isApi = (testCase.tags || []).some((tag) => ["openapi", "json-schema", "api"].includes(String(tag).toLowerCase()));
  const checks = [
    { key: "selector", label: isApi ? "Target request" : "Selector", passed: Boolean(automation.selector), evidence: automation.selector },
    { key: "data", label: "Data", passed: Boolean(automation.data || value(testCase.testData) || testCase.parameterSets?.some((set) => value(set.data))), evidence: automation.data || value(testCase.testData) },
    { key: "precondition", label: "Precondition", passed: Boolean(value(testCase.precondition)), evidence: value(testCase.precondition) },
    { key: "assertion", label: "Assertion", passed: Boolean(value(testCase.expected)), evidence: value(testCase.expected) },
    { key: "cleanup", label: "Cleanup", passed: Boolean(automation.cleanup), evidence: automation.cleanup },
  ];
  const score = checks.filter((check) => check.passed).length * 20;
  return {
    score,
    checks,
    missing: checks.filter((check) => !check.passed).map((check) => check.key),
    level: score === 100 ? "ready" : score >= 60 ? "candidate" : "incomplete",
    label: score === 100 ? "Siap diautomasi" : score >= 60 ? "Kandidat automation" : "Belum cukup spesifik",
  };
}

export function automationCoverage(cases = []) {
  const counts = { manual: 0, candidate: 0, automated: 0, flaky: 0, "not-suitable": 0 };
  const entries = cases.map((testCase) => {
    const automation = normalizeAutomation(testCase.automation);
    const readiness = assessAutomationReadiness(testCase);
    const lifecycle = automation.lifecycle === "manual" && readiness.score >= 60 ? "candidate" : automation.lifecycle;
    counts[lifecycle] += 1;
    return { caseId: testCase.id, lifecycle, readiness };
  });
  return { counts, entries, total: entries.length };
}

function jsHeader(testCase, framework) {
  return `/**\n * Casecraft automation draft · ${framework}\n * ${comment(testCase.id)} · ${comment(testCase.scenario)}\n * Review engineer wajib sebelum digunakan pada pipeline.\n */`;
}

function apiEvidence(testCase = {}) {
  const source = [testCase.scenario, ...(testCase.steps || [])].join(" ");
  const operation = source.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s.,;]*)/i);
  const status = String(testCase.expected || "").match(/^\s*([1-5]\d{2})\b/)?.[1] || "";
  return { method: operation?.[1]?.toUpperCase() || "TODO_METHOD", path: operation?.[2] || "/TODO_ENDPOINT", status: status || "TODO_EXPECTED_STATUS" };
}

export function generateAutomationSkeleton(testCase = {}, framework = "playwright") {
  if (!FRAMEWORKS.has(framework)) throw new TypeError("Framework automation tidak didukung.");
  const automation = normalizeAutomation(testCase.automation);
  if (automation.reviewStatus !== "approved") throw new TypeError("Test case harus disetujui QA sebelum skeleton dibuat.");
  const selector = automation.selector || "TODO_SELECTOR";
  const testData = automation.data || testCase.testData || "TODO_TEST_DATA";
  const cleanup = automation.cleanup || "TODO: tambahkan cleanup yang idempotent";
  const assertion = testCase.expected || "TODO_EXPECTED_RESULT";
  const title = `${testCase.id} ${testCase.scenario}`.trim();
  let content;
  let extension = "js";
  let mime = "text/javascript;charset=utf-8";

  if (framework === "playwright") content = `${jsHeader(testCase, "Playwright")}\nimport { test, expect } from "@playwright/test";\n\ntest(${JSON.stringify(title)}, async ({ page }) => {\n  // Precondition: ${comment(testCase.precondition)}\n  // Data: ${comment(testData)}\n  await page.goto("TODO_BASE_URL");\n  const subject = page.locator(${JSON.stringify(selector)});\n  // TODO: terjemahkan langkah manual menjadi aksi yang stabil.\n  await expect(subject).toBeVisible();\n  // Assertion: ${comment(assertion)}\n  // Cleanup: ${comment(cleanup)}\n});\n`;
  else if (framework === "cypress") content = `${jsHeader(testCase, "Cypress")}\ndescribe(${JSON.stringify(testCase.module || "Casecraft suite")}, () => {\n  it(${JSON.stringify(title)}, () => {\n    // Precondition: ${comment(testCase.precondition)}\n    // Data: ${comment(testData)}\n    cy.visit("TODO_BASE_URL");\n    cy.get(${JSON.stringify(selector)}).should("be.visible");\n    // Assertion: ${comment(assertion)}\n    // Cleanup: ${comment(cleanup)}\n  });\n});\n`;
  else if (framework === "webdriverio") content = `${jsHeader(testCase, "WebdriverIO")}\ndescribe(${JSON.stringify(testCase.module || "Casecraft suite")}, () => {\n  it(${JSON.stringify(title)}, async () => {\n    // Precondition: ${comment(testCase.precondition)}\n    // Data: ${comment(testData)}\n    await browser.url("TODO_BASE_URL");\n    const subject = await $(${JSON.stringify(selector)});\n    await expect(subject).toBeDisplayed();\n    // Assertion: ${comment(assertion)}\n    // Cleanup: ${comment(cleanup)}\n  });\n});\n`;
  else {
    extension = "postman_collection.json";
    mime = "application/json;charset=utf-8";
    const evidence = apiEvidence(testCase);
    content = `${JSON.stringify({
      info: { name: title, schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", description: "Draft Casecraft; wajib ditinjau engineer. Method, endpoint, dan status tetap TODO jika tidak ada evidence pada test case." },
      variable: [{ key: "expectedStatus", value: evidence.status }],
      item: [{ name: title, request: { method: evidence.method, header: [], url: { raw: `{{baseUrl}}${evidence.path}`, host: ["{{baseUrl}}"], path: evidence.path.replace(/^\//, "").split("/") }, description: `Precondition: ${testCase.precondition || "TODO"}\nData: ${testData}` }, event: [{ listen: "test", script: { type: "text/javascript", exec: [`// Expected: ${comment(assertion)}`, "pm.test(\"status contract sesuai spesifikasi\", function () {", "  const expectedStatus = Number(pm.variables.get(\"expectedStatus\"));", "  pm.expect(expectedStatus, \"Isi expectedStatus dari contract\").to.be.a(\"number\").and.not.NaN;", "  pm.expect(pm.response.code).to.eql(expectedStatus);", "});"] } }] }],
    }, null, 2)}\n`;
  }
  const safeId = value(testCase.id).toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "casecraft-test";
  return { framework, content, extension, mime, filename: `${safeId}.${extension}`, draft: true, readiness: assessAutomationReadiness(testCase) };
}
