import { runQualityGate } from "./analysis-tools.js";

const CI_BLOCKING_CODES = new Set(["criterion-uncovered", "expected-empty", "expected-unmeasurable"]);

function duplicateRatio(feature = {}) {
  const cases = feature.cases || [];
  if (!cases.length) return 0;
  const duplicates = runQualityGate(feature).findings.filter((finding) => finding.code === "duplicate").length;
  return Math.round((duplicates / cases.length) * 1000) / 1000;
}

export function runCiQualityGate(collection = {}, options = {}) {
  const threshold = Number.isFinite(Number(options.maxDuplicateRatio)) ? Math.max(0, Number(options.maxDuplicateRatio)) : 0.1;
  const findings = [];
  (collection.features || []).filter((feature) => !feature.archived).forEach((feature) => {
    const base = runQualityGate(feature);
    base.findings.forEach((finding) => findings.push({ ...finding, severity: CI_BLOCKING_CODES.has(finding.code) ? "error" : finding.severity, featureId: feature.id, featureName: feature.name }));
    (feature.requirements || []).forEach((requirement) => {
      const criterionIds = new Set((requirement.criteria || []).map((criterion) => criterion.id));
      const linked = (feature.cases || []).some((testCase) => (testCase.criterionIds || []).some((id) => criterionIds.has(id)));
      if (!linked) findings.push({
        severity: "error",
        code: "requirement-uncovered",
        message: "Requirement tidak memiliki test case yang terhubung melalui acceptance criterion.",
        reference: requirement.id,
        featureId: feature.id,
        featureName: feature.name,
      });
    });
    const ratio = duplicateRatio(feature);
    if (ratio > threshold) findings.push({
      severity: "error",
      code: "duplicate-ratio-high",
      message: `Rasio duplikasi ${(ratio * 100).toFixed(1)}% melewati batas ${(threshold * 100).toFixed(1)}%.`,
      reference: feature.id,
      featureId: feature.id,
      featureName: feature.name,
    });
    (feature.cases || []).filter((testCase) => testCase.category === "regression" && ["update", "obsolete"].includes(testCase.requirementImpact?.status)).forEach((testCase) => findings.push({
      severity: "error",
      code: "regression-suite-stale",
      message: "Regression test case terdampak requirement baru tetapi belum diperbarui.",
      reference: testCase.id,
      featureId: feature.id,
      featureName: feature.name,
    }));
  });
  if (!(collection.features || []).some((feature) => !feature.archived)) findings.push({ severity: "error", code: "feature-empty", message: "Proyek tidak memiliki feature suite aktif.", reference: "collection" });
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const passed = errors === 0 && !(options.failOnWarnings && warnings > 0);
  return { passed, errors, warnings, findings, policy: { maxDuplicateRatio: threshold, failOnWarnings: Boolean(options.failOnWarnings) } };
}
