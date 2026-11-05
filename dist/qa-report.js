import { compareTestRuns } from "./run-comparison.js";

const COPY = {
  id: {
    title: "Laporan QA lokal", scope: "Scope", environment: "Environment", coverage: "Coverage", execution: "Hasil eksekusi",
    defects: "Referensi defect", blockers: "Blocker aktif", risks: "Risiko tersisa", comparison: "Perbandingan test run",
    total: "Total", passed: "Lulus", failed: "Gagal", blocked: "Terblokir", untested: "Belum diuji", passRate: "Pass rate",
    noData: "Tidak ada data.", generated: "Dibuat lokal oleh Casecraft", riskNote: "Skor risiko membantu prioritas eksekusi dan bukan klaim coverage lengkap.",
  },
  en: {
    title: "Local QA report", scope: "Scope", environment: "Environment", coverage: "Coverage", execution: "Execution results",
    defects: "Defect references", blockers: "Active blockers", risks: "Residual risks", comparison: "Test run comparison",
    total: "Total", passed: "Passed", failed: "Failed", blocked: "Blocked", untested: "Untested", passRate: "Pass rate",
    noData: "No data.", generated: "Generated locally by Casecraft", riskNote: "Risk scores prioritize execution and do not claim complete coverage.",
  },
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function resultFor(cycle, caseId) {
  return { qaStatus: "Belum diuji", actual: "", defectReference: "", blocker: "", ...(cycle?.results?.[caseId] || {}) };
}

export function buildQaReport(feature = {}, cycleId = "", options = {}) {
  const cycle = (feature.cycles || []).find((item) => item.id === cycleId) || feature.cycles?.[0];
  if (!cycle) throw new TypeError("Test cycle untuk laporan tidak ditemukan.");
  const caseIds = cycle.caseIds || (feature.cases || []).map((item) => item.id);
  const cases = (feature.cases || []).filter((item) => caseIds.includes(item.id));
  const results = cases.map((testCase) => ({ testCase, result: resultFor(cycle, testCase.id) }));
  const counts = { total: cases.length, passed: 0, failed: 0, blocked: 0, untested: 0 };
  results.forEach(({ result }) => {
    if (result.qaStatus === "Lulus") counts.passed += 1;
    else if (result.qaStatus === "Gagal") counts.failed += 1;
    else if (result.qaStatus === "Terblokir") counts.blocked += 1;
    else counts.untested += 1;
  });
  const executed = counts.passed + counts.failed + counts.blocked;
  const comparison = options.baselineId && options.baselineId !== cycle.id ? compareTestRuns(feature, options.baselineId, cycle.id) : null;
  return {
    language: options.language === "en" ? "en" : "id",
    feature: feature.name || "Fitur",
    requirementCount: feature.requirements?.length || 0,
    caseCount: cases.length,
    cycle,
    counts,
    passRate: executed ? Math.round((counts.passed / executed) * 1000) / 10 : 0,
    coverage: ["happy", "negative", "edge", "regression"].map((category) => ({ category, count: cases.filter((item) => item.category === category).length })),
    defects: results.filter(({ result }) => result.defectReference).map(({ testCase, result }) => ({ id: testCase.id, scenario: testCase.scenario, reference: result.defectReference })),
    blockers: results.filter(({ result }) => result.qaStatus === "Terblokir").map(({ testCase, result }) => ({ id: testCase.id, scenario: testCase.scenario, reason: result.blocker || result.actual || "—" })),
    residualRisks: results.filter(({ testCase, result }) => (testCase.risk?.score || 0) >= 70 && result.qaStatus !== "Lulus").map(({ testCase, result }) => ({ id: testCase.id, scenario: testCase.scenario, score: testCase.risk.score, status: result.qaStatus })),
    comparison,
    generatedAt: options.generatedAt || new Date().toISOString(),
  };
}

function rows(items, cells, empty) {
  if (!items.length) return `<p class="empty">${escapeHtml(empty)}</p>`;
  return `<table><thead><tr>${cells.map((cell) => `<th>${escapeHtml(cell.label)}</th>`).join("")}</tr></thead><tbody>${items.map((item) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell.value(item))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function localizedStatus(status, language) {
  if (language !== "en") return status;
  return ({ "Belum diuji": "Untested", Lulus: "Passed", Gagal: "Failed", Terblokir: "Blocked" })[status] || status;
}

export function renderQaReportHtml(report) {
  const t = COPY[report.language] || COPY.id;
  const comparison = report.comparison;
  const comparisonHtml = comparison ? `<section><h2>${t.comparison}</h2><div class="metrics"><div><b>${comparison.newFailures.length}</b><span>New failures</span></div><div><b>${comparison.fixed.length}</b><span>Fixed</span></div><div><b>${comparison.regressions.length}</b><span>Regressions</span></div><div><b>${comparison.activeBlockers.length}</b><span>Blockers</span></div><div><b>${comparison.passRateDelta > 0 ? "+" : ""}${comparison.passRateDelta}%</b><span>Δ pass rate</span></div></div></section>` : "";
  const title = `${t.title} · ${report.feature}`;
  return `<!doctype html><html lang="${report.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>
  :root{font-family:Arial,sans-serif;color:#17212b;background:#fff}body{max-width:1100px;margin:0 auto;padding:32px}header{border-bottom:3px solid #2457a7;padding-bottom:18px}h1{margin:0 0 8px;font-family:Georgia,serif}h2{font-size:18px;margin-top:28px}.meta,.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.meta div,.metrics div{border:1px solid #d9e0e7;padding:12px}.metrics b{display:block;font-size:24px}.metrics span,.muted{color:#5f6b76;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d9e0e7;padding:8px;text-align:left;vertical-align:top}th{background:#f2f5f8}.empty{color:#5f6b76}.note{border-left:3px solid #a15c00;padding-left:12px}@media print{body{padding:0}section{break-inside:avoid}table{break-inside:auto}tr{break-inside:avoid}a{color:inherit;text-decoration:none}}
  </style></head><body><header><h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(t.generated)} · ${escapeHtml(new Date(report.generatedAt).toLocaleString(report.language === "en" ? "en-GB" : "id-ID"))}</p></header>
  <section><h2>${t.scope}</h2><div class="meta"><div><b>${escapeHtml(report.feature)}</b><span>Feature</span></div><div><b>${report.requirementCount}</b><span>Requirements</span></div><div><b>${report.caseCount}</b><span>Test cases</span></div></div></section>
  <section><h2>${t.environment}</h2><div class="meta"><div><b>${escapeHtml(report.cycle.name)}</b><span>Cycle</span></div><div><b>${escapeHtml(report.cycle.buildVersion || "—")}</b><span>Build</span></div><div><b>${escapeHtml(report.cycle.environment || "—")}</b><span>Environment</span></div><div><b>${escapeHtml(report.cycle.browser || "—")}</b><span>Browser</span></div><div><b>${escapeHtml(report.cycle.device || "—")}</b><span>Device</span></div></div></section>
  <section><h2>${t.coverage}</h2><div class="metrics">${report.coverage.map((item) => `<div><b>${item.count}</b><span>${escapeHtml(item.category)}</span></div>`).join("")}</div></section>
  <section><h2>${t.execution}</h2><div class="metrics"><div><b>${report.counts.total}</b><span>${t.total}</span></div><div><b>${report.counts.passed}</b><span>${t.passed}</span></div><div><b>${report.counts.failed}</b><span>${t.failed}</span></div><div><b>${report.counts.blocked}</b><span>${t.blocked}</span></div><div><b>${report.passRate}%</b><span>${t.passRate}</span></div></div></section>${comparisonHtml}
  <section><h2>${t.defects}</h2>${rows(report.defects,[{label:"ID",value:(x)=>x.id},{label:"Scenario",value:(x)=>x.scenario},{label:"Reference",value:(x)=>x.reference}],t.noData)}</section>
  <section><h2>${t.blockers}</h2>${rows(report.blockers,[{label:"ID",value:(x)=>x.id},{label:"Scenario",value:(x)=>x.scenario},{label:"Reason",value:(x)=>x.reason}],t.noData)}</section>
  <section><h2>${t.risks}</h2>${rows(report.residualRisks,[{label:"ID",value:(x)=>x.id},{label:"Scenario",value:(x)=>x.scenario},{label:"Risk",value:(x)=>x.score},{label:"Status",value:(x)=>localizedStatus(x.status,report.language)}],t.noData)}<p class="note">${escapeHtml(t.riskNote)}</p></section></body></html>`;
}

