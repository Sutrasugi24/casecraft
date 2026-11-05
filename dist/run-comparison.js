const STATUS = {
  passed: "Lulus",
  failed: "Gagal",
  blocked: "Terblokir",
  untested: "Belum diuji",
};

function resultFor(cycle, caseId) {
  return { qaStatus: STATUS.untested, actual: "", defectReference: "", blocker: "", ...(cycle?.results?.[caseId] || {}) };
}

function passRate(cycle, caseIds) {
  const results = caseIds.map((caseId) => resultFor(cycle, caseId));
  const executed = results.filter((result) => result.qaStatus !== STATUS.untested).length;
  const passed = results.filter((result) => result.qaStatus === STATUS.passed).length;
  return { passed, executed, rate: executed ? Math.round((passed / executed) * 1000) / 10 : 0 };
}

export function compareTestRuns(feature = {}, baselineId = "", targetId = "") {
  const baseline = (feature.cycles || []).find((cycle) => cycle.id === baselineId);
  const target = (feature.cycles || []).find((cycle) => cycle.id === targetId);
  if (!baseline || !target) throw new TypeError("Pilih dua test cycle yang valid untuk dibandingkan.");
  if (baseline.id === target.id) throw new TypeError("Baseline dan target harus menggunakan test cycle yang berbeda.");

  const baselineIds = new Set(baseline.caseIds || Object.keys(baseline.results || {}));
  const targetIds = new Set(target.caseIds || Object.keys(target.results || {}));
  const caseById = new Map((feature.cases || []).map((testCase) => [testCase.id, testCase]));
  const items = [...new Set([...baselineIds, ...targetIds])].map((caseId) => ({
    caseId,
    testCase: caseById.get(caseId) || { id: caseId, scenario: "Test case tidak lagi tersedia" },
    baseline: resultFor(baseline, caseId),
    target: resultFor(target, caseId),
  }));

  const newCases = items.filter((item) => !baselineIds.has(item.caseId) && targetIds.has(item.caseId));
  const newFailures = items.filter((item) => targetIds.has(item.caseId) && item.target.qaStatus === STATUS.failed && item.baseline.qaStatus !== STATUS.failed);
  const fixed = items.filter((item) => item.baseline.qaStatus === STATUS.failed && item.target.qaStatus === STATUS.passed);
  const regressions = items.filter((item) => item.baseline.qaStatus === STATUS.passed && item.target.qaStatus === STATUS.failed);
  const activeBlockers = items.filter((item) => targetIds.has(item.caseId) && item.target.qaStatus === STATUS.blocked);
  const baselineRate = passRate(baseline, [...baselineIds]);
  const targetRate = passRate(target, [...targetIds]);

  return {
    baseline,
    target,
    baselineRate,
    targetRate,
    passRateDelta: Math.round((targetRate.rate - baselineRate.rate) * 10) / 10,
    newCases,
    newFailures,
    fixed,
    regressions,
    activeBlockers,
  };
}

