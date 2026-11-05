function decodeXml(value = "") {
  return String(value).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function attribute(source = "", name = "") {
  return decodeXml(source.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] || "");
}

function caseIdFrom(value = "") {
  return String(value).match(/\bTC_[A-Z0-9][A-Z0-9_-]*\b/i)?.[0]?.toUpperCase() || "";
}

function parseJunit(text) {
  const entries = [];
  const pattern = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gi;
  let match;
  while ((match = pattern.exec(text))) {
    const attributes = match[1] || "";
    const body = match[2] || "";
    const title = [attribute(attributes, "classname"), attribute(attributes, "name")].filter(Boolean).join(" · ");
    const failure = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>/i);
    const skipped = /<skipped\b/i.test(body);
    const qaStatus = failure ? "Gagal" : skipped ? "Terblokir" : "Lulus";
    const actual = failure ? decodeXml(attribute(failure[2], "message") || failure[3].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : skipped ? "Dilewati oleh automation report." : "Automation report: passed.";
    entries.push({ caseId: caseIdFrom(title), title, qaStatus, actual, retries: 0, flaky: false });
  }
  return { format: "JUnit XML", entries, warnings: entries.length ? [] : ["Elemen testcase tidak ditemukan pada JUnit XML."] };
}

function collectPlaywrightSuites(suites = [], entries = [], parents = []) {
  suites.forEach((suite) => {
    const path = [...parents, suite.title].filter(Boolean);
    (suite.specs || []).forEach((spec) => {
      (spec.tests || []).forEach((test) => {
        const results = test.results || [];
        const latest = results.at(-1) || {};
        const statuses = results.map((result) => result.status);
        const flaky = statuses.some((status) => status && status !== "passed") && latest.status === "passed";
        const qaStatus = latest.status === "passed" ? "Lulus" : latest.status === "skipped" ? "Terblokir" : "Gagal";
        const title = [...path, spec.title, test.title].filter(Boolean).join(" · ");
        entries.push({ caseId: caseIdFrom(title), title, qaStatus, actual: latest.error?.message || `Playwright: ${latest.status || "unknown"}.`, retries: Math.max(0, results.length - 1), flaky });
      });
    });
    collectPlaywrightSuites(suite.suites || [], entries, path);
  });
  return entries;
}

function parseJson(text) {
  const document = JSON.parse(text);
  const entries = collectPlaywrightSuites(document.suites || []);
  if (!entries.length && Array.isArray(document.tests || document.results)) {
    (document.tests || document.results).forEach((result) => {
      const title = result.title || result.name || "Automation result";
      const rawStatus = String(result.status || result.outcome || "").toLowerCase();
      entries.push({ caseId: caseIdFrom(title), title, qaStatus: ["passed", "pass", "success"].includes(rawStatus) ? "Lulus" : ["skipped", "blocked", "pending"].includes(rawStatus) ? "Terblokir" : "Gagal", actual: result.error?.message || result.message || `Automation: ${rawStatus || "unknown"}.`, retries: Number(result.retries || 0), flaky: rawStatus === "flaky" });
    });
  }
  return { format: document.config && document.suites ? "Playwright JSON" : "Automation JSON", entries, warnings: entries.length ? [] : ["Hasil test tidak ditemukan pada JSON."] };
}

export function parseAutomationReport({ name = "", text = "" } = {}) {
  try {
    const parsed = /^\s*</.test(text) || /\.xml$/i.test(name) ? parseJunit(text) : parseJson(text);
    const unmatched = parsed.entries.filter((entry) => !entry.caseId).length;
    if (unmatched) parsed.warnings.push(`${unmatched} hasil tidak memiliki Casecraft ID pada judul test.`);
    return { ok: parsed.entries.length > 0, ...parsed };
  } catch (error) {
    return { ok: false, format: "Tidak dikenal", entries: [], warnings: [`Laporan automation tidak dapat dibaca: ${error.message}`] };
  }
}

export function applyAutomationResults(feature = {}, cycleId = "", entries = [], importedAt = new Date().toISOString()) {
  const cycle = (feature.cycles || []).find((item) => item.id === cycleId);
  if (!cycle) throw new TypeError("Test cycle tujuan tidak ditemukan.");
  cycle.caseIds ||= [];
  const cases = new Map((feature.cases || []).map((testCase) => [testCase.id, testCase]));
  const summary = { matched: 0, unmatched: 0, passed: 0, failed: 0, blocked: 0, flaky: 0 };
  entries.forEach((entry) => {
    const testCase = cases.get(entry.caseId);
    if (!testCase) { summary.unmatched += 1; return; }
    const previous = cycle.results?.[testCase.id] || {};
    cycle.results ||= {};
    cycle.results[testCase.id] = { qaStatus: "Belum diuji", rejectStatus: "Tidak ditolak", actual: "", defectReference: "", blocker: "", ...previous, qaStatus: entry.qaStatus, actual: entry.actual, updatedAt: importedAt, automationSource: entry.title, automationRetries: Math.max(0, Number(entry.retries) || 0), automationFlaky: Boolean(entry.flaky) };
    if (!cycle.caseIds.includes(testCase.id)) cycle.caseIds.push(testCase.id);
    testCase.automation = { ...testCase.automation, lifecycle: entry.flaky ? "flaky" : "automated", lastRunAt: importedAt, lastRunStatus: entry.qaStatus };
    if (feature.activeCycleId === cycle.id) Object.assign(testCase, { qaStatus: entry.qaStatus, actual: entry.actual });
    summary.matched += 1;
    if (entry.flaky) summary.flaky += 1;
    if (entry.qaStatus === "Lulus") summary.passed += 1;
    else if (entry.qaStatus === "Terblokir") summary.blocked += 1;
    else summary.failed += 1;
  });
  return summary;
}
