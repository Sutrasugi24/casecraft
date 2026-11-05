import test from "node:test";
import assert from "node:assert/strict";
import { compareRequirementVersions, normalizeRisk, profileDrafts, requirementImpactForCase, runQualityGate } from "../dist/analysis-tools.js";

const previous = {
  id: "REQ-001",
  criteria: [
    { id: "REQ-001-AC-001", text: "Pengguna dapat menyimpan profil dan status berubah menjadi Aktif." },
    { id: "REQ-001-AC-002", text: "Email wajib memiliki format valid." },
  ],
};

test("requirement comparison preserves exact IDs and classifies changed, added, and removed criteria", () => {
  const comparison = compareRequirementVersions(previous, { requirementId: "REQ-001", criteria: [
    { id: "TEMP-1", text: "Pengguna dapat menyimpan profil dan status berubah menjadi Aktif." },
    { id: "TEMP-2", text: "Email wajib memiliki format valid dan domain perusahaan." },
    { id: "TEMP-3", text: "Nomor telepon wajib diisi." },
  ] });

  assert.equal(comparison.exact.length, 1);
  assert.equal(comparison.changed.length, 1);
  assert.equal(comparison.added.length, 1);
  assert.equal(comparison.criteria[0].id, "REQ-001-AC-001");
  assert.equal(comparison.criteria[1].id, "REQ-001-AC-002");
  assert.equal(requirementImpactForCase({ criterionIds: ["REQ-001-AC-002"] }, comparison, "REQ-001").status, "update");
  assert.equal(requirementImpactForCase({ criterionIds: ["REQ-001-AC-001"] }, comparison, "REQ-001").status, "rerun");
});

test("risk score is deterministic and profile drafts remain marked for QA customization", () => {
  const risk = normalizeRisk({ impact: 5, probability: 4, complexity: 3, regression: 5 });
  const drafts = profileDrafts("payment", { featureName: "Pembayaran", criterion: { id: "REQ-001-AC-001", text: "Pembayaran mengubah status invoice.", then: "Status invoice menjadi Lunas." } });
  assert.equal(risk.score, 87);
  assert.equal(risk.level, "Tinggi");
  assert.ok(drafts.length >= 3);
  assert.ok(drafts.every((item) => item.needsCustomization));
});

test("quality gate catches incomplete cases, uncovered criteria, duplicates, and failed cases without actual result", () => {
  const feature = {
    requirements: [{ criteria: [{ id: "REQ-001-AC-001" }, { id: "REQ-001-AC-002" }] }],
    cases: [
      { id: "TC_001", category: "happy", scenario: "Simpan profil", criterionIds: ["REQ-001-AC-001"], steps: [], expected: "", testData: "", qaStatus: "Gagal", actual: "" },
      { id: "TC_002", category: "happy", scenario: "Simpan profil", criterionIds: ["REQ-001-AC-001"], steps: ["Simpan"], expected: "Tersimpan", testData: "valid", qaStatus: "Lulus" },
    ],
  };
  const gate = runQualityGate(feature);
  assert.equal(gate.passed, false);
  assert.ok(gate.findings.some((finding) => finding.code === "criterion-uncovered"));
  assert.ok(gate.findings.some((finding) => finding.code === "failed-no-actual"));
  assert.ok(gate.findings.some((finding) => finding.code === "duplicate"));
});
