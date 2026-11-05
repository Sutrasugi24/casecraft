function resultFor(cycle, caseId) {
  return cycle?.results?.[caseId] || null;
}

function executionEnvironment(cycle = {}) {
  return [cycle.environment, cycle.browser, cycle.device].filter(Boolean).join(" · ") || "Environment tidak dicatat";
}

function classify(history = [], testCase = {}) {
  const executed = history.filter((item) => item.status && item.status !== "Belum diuji");
  const passed = executed.filter((item) => item.status === "Lulus");
  const failed = executed.filter((item) => item.status === "Gagal");
  const retryRecovered = executed.filter((item) => item.flaky || (item.retries > 0 && item.status === "Lulus"));
  const failedEnvironments = new Set(failed.map((item) => item.environment));
  const passedEnvironments = new Set(passed.map((item) => item.environment));
  const sharedEnvironment = [...failedEnvironments].some((environment) => passedEnvironments.has(environment));
  const hasDefect = failed.some((item) => item.defectReference);

  if (retryRecovered.length || testCase.automation?.lifecycle === "flaky") return {
    code: "automation-instability",
    label: "Kemungkinan masalah automation",
    confidence: retryRecovered.length ? "tinggi" : "sedang",
    reason: retryRecovered.length ? `${retryRecovered.length} run pulih setelah retry atau ditandai flaky.` : "Lifecycle test case ditandai flaky oleh QA.",
  };
  if (failed.length && passed.length && sharedEnvironment) return {
    code: "unstable-same-environment",
    label: "Hasil tidak stabil",
    confidence: "sedang",
    reason: "Status pass dan fail muncul pada environment yang sama tanpa bukti retry lengkap.",
  };
  if (failed.length && passed.length && !sharedEnvironment) return {
    code: "environment-signal",
    label: "Kemungkinan terkait environment",
    confidence: "sedang",
    reason: "Kegagalan dan kelulusan terkonsentrasi pada environment yang berbeda.",
  };
  if (failed.length >= 2 && hasDefect && !passed.length) return {
    code: "product-defect-signal",
    label: "Sinyal defect produk",
    confidence: "sedang",
    reason: "Kegagalan konsisten dan memiliki referensi defect; konfirmasi tetap memerlukan triage manusia.",
  };
  if (failed.length && !passed.length) return {
    code: "consistent-failure",
    label: "Kegagalan konsisten",
    confidence: "rendah",
    reason: "Belum ada hasil pass atau retry recovery untuk membedakan defect produk dan automation.",
  };
  return {
    code: "insufficient-evidence",
    label: "Evidence belum cukup",
    confidence: "rendah",
    reason: executed.length ? "Belum ada pola kegagalan yang cukup untuk triage flaky." : "Test case belum memiliki riwayat eksekusi.",
  };
}

export function analyzeFlakyTests(feature = {}) {
  const cycles = feature.cycles || [];
  const cases = (feature.cases || []).map((testCase) => {
    const history = cycles.map((cycle) => {
      const result = resultFor(cycle, testCase.id);
      if (!result) return null;
      return {
        cycleId: cycle.id,
        cycleName: cycle.name,
        build: cycle.buildVersion || "Build tidak dicatat",
        environment: executionEnvironment(cycle),
        status: result.qaStatus || "Belum diuji",
        retries: Math.max(0, Number(result.automationRetries) || 0),
        flaky: Boolean(result.automationFlaky),
        defectReference: result.defectReference || "",
        source: result.automationSource || "Manual",
        updatedAt: result.updatedAt || "",
      };
    }).filter(Boolean);
    const classification = classify(history, testCase);
    const transitions = history.reduce((count, item, index) => count + Number(index > 0 && item.status !== history[index - 1].status), 0);
    return {
      caseId: testCase.id,
      scenario: testCase.scenario,
      lifecycle: testCase.automation?.lifecycle || "manual",
      history,
      transitions,
      retries: history.reduce((total, item) => total + item.retries, 0),
      classification,
    };
  });
  const attention = cases.filter((item) => item.classification.code !== "insufficient-evidence" || item.lifecycle === "flaky");
  return {
    cases,
    attention,
    summary: {
      total: cases.length,
      flaky: cases.filter((item) => ["automation-instability", "unstable-same-environment"].includes(item.classification.code)).length,
      environment: cases.filter((item) => item.classification.code === "environment-signal").length,
      productSignals: cases.filter((item) => item.classification.code === "product-defect-signal").length,
      inconclusive: cases.filter((item) => ["consistent-failure", "insufficient-evidence"].includes(item.classification.code)).length,
    },
  };
}
