export const TEST_PROFILES = {
  none: { label: "Tanpa profil", description: "Gunakan hanya bukti yang tertulis pada requirement.", templates: [] },
  authentication: {
    label: "Autentikasi",
    description: "Akses valid, kredensial tidak valid, dan pembatasan sesi.",
    templates: [
      ["happy", "Akses dengan identitas valid", "Identitas dan akses valid yang disebutkan requirement tersedia."],
      ["negative", "Tolak identitas atau kredensial tidak valid", "Gunakan identitas tidak valid yang disetujui QA."],
      ["regression", "Verifikasi pembatasan sesi dan akses existing", "Sesi existing tersedia sebagai pembanding."],
    ],
  },
  crud: {
    label: "CRUD",
    description: "Create, read, update, delete, serta integritas data.",
    templates: [
      ["happy", "Buat dan baca kembali data", "Data valid yang didefinisikan requirement tersedia."],
      ["happy", "Perbarui data dan verifikasi perubahan", "Record existing yang dapat diedit tersedia."],
      ["negative", "Tolak perubahan data yang tidak valid", "Data invalid yang disepakati QA tersedia."],
      ["regression", "Verifikasi data terkait setelah perubahan", "Relasi data existing tersedia sebagai pembanding."],
    ],
  },
  payment: {
    label: "Pembayaran",
    description: "Otorisasi, nominal, idempotensi, dan kegagalan dependensi.",
    templates: [
      ["happy", "Proses pembayaran yang valid", "Metode dan nominal valid yang disebutkan requirement tersedia."],
      ["negative", "Tangani pembayaran yang ditolak", "Kondisi penolakan yang dapat disimulasikan tersedia."],
      ["edge", "Cegah pemrosesan pembayaran ganda", "Gunakan referensi transaksi yang sama pada percobaan ulang."],
      ["regression", "Verifikasi status dan data transaksi terkait", "Data transaksi existing tersedia sebagai pembanding."],
    ],
  },
  search: {
    label: "Pencarian",
    description: "Exact, partial, kosong, karakter khusus, dan tanpa hasil.",
    templates: [
      ["happy", "Temukan data dengan kata kunci valid", "Data yang cocok dan kata kunci valid tersedia."],
      ["edge", "Cari dengan input kosong atau karakter khusus", "Variasi input disetujui QA sebelum eksekusi."],
      ["negative", "Tampilkan keadaan tanpa hasil", "Kata kunci yang dipastikan tidak cocok tersedia."],
    ],
  },
  upload: {
    label: "Upload",
    description: "Format, ukuran, isi file, dan kegagalan proses.",
    templates: [
      ["happy", "Upload file yang memenuhi spesifikasi", "File valid sesuai format dan ukuran requirement tersedia."],
      ["negative", "Tolak format atau ukuran file yang tidak didukung", "File invalid yang disetujui QA tersedia."],
      ["edge", "Tangani file kosong atau batas ukuran", "File batas disiapkan dari nilai eksplisit requirement."],
    ],
  },
  permission: {
    label: "Permission",
    description: "Peran berhak, tidak berhak, dan perubahan hak akses.",
    templates: [
      ["happy", "Izinkan aksi untuk peran yang berhak", "Peran yang disebutkan requirement tersedia."],
      ["negative", "Tolak aksi untuk peran yang tidak berhak", "Peran pembanding tanpa hak tersedia."],
      ["regression", "Verifikasi batas akses setelah hak berubah", "Kondisi sebelum dan sesudah perubahan hak tersedia."],
    ],
  },
  bulk: {
    label: "Bulk operation",
    description: "Pilihan banyak data, kegagalan parsial, dan konsistensi hasil.",
    templates: [
      ["happy", "Proses beberapa item valid sekaligus", "Kumpulan item valid sesuai requirement tersedia."],
      ["negative", "Tangani kegagalan parsial dalam operasi bulk", "Campuran item valid dan invalid disetujui QA."],
      ["edge", "Proses jumlah item pada batas bulk", "Jumlah item mengikuti batas eksplisit requirement."],
      ["regression", "Verifikasi item yang tidak dipilih tetap utuh", "Item selected dan unselected tersedia sebagai pembanding."],
    ],
  },
};

const RISK_LEVELS = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
const IMPACT_LABELS = { update: "Perlu diperbarui", rerun: "Jalankan ulang", obsolete: "Tidak relevan", unaffected: "Tidak terdampak" };

function clampRisk(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(5, Math.max(1, number)) : 3;
}

export function normalizeRisk(risk = {}) {
  const normalized = {
    impact: clampRisk(risk.impact),
    probability: clampRisk(risk.probability),
    complexity: clampRisk(risk.complexity),
    regression: clampRisk(risk.regression),
  };
  const weighted = normalized.impact * 0.35 + normalized.probability * 0.25 + normalized.complexity * 0.2 + normalized.regression * 0.2;
  const score = Math.round(weighted * 20);
  return { ...normalized, score, level: score >= 70 ? RISK_LEVELS.high : score >= 40 ? RISK_LEVELS.medium : RISK_LEVELS.low };
}

export function defaultRiskForCase(testCase = {}) {
  const category = testCase.category || "happy";
  return normalizeRisk({
    impact: ["negative", "regression"].includes(category) ? 4 : 3,
    probability: category === "happy" ? 4 : 3,
    complexity: ["edge", "regression"].includes(category) ? 4 : 3,
    regression: category === "regression" ? 5 : 3,
  });
}

export function normalizeParameterSets(parameterSets = []) {
  if (!Array.isArray(parameterSets)) return [];
  return parameterSets.map((set, index) => ({
    id: String(set?.id || `DATA-${String(index + 1).padStart(3, "0")}`),
    label: String(set?.label || `Kombinasi ${index + 1}`).trim(),
    data: String(set?.data || "").trim(),
    expected: String(set?.expected || "").trim(),
  })).filter((set) => set.label || set.data || set.expected);
}

export function profileDrafts(profileKey, { featureName = "Fitur", criterion = null } = {}) {
  const profile = TEST_PROFILES[profileKey] || TEST_PROFILES.none;
  if (!profile.templates.length || !criterion) return [];
  return profile.templates.map(([category, scenario, precondition], index) => ({
    category,
    scenario: `[Profil ${profile.label}] ${scenario}`,
    precondition,
    steps: [
      `Siapkan konteks ${criterion.id} dan data profil yang telah disesuaikan QA.`,
      `Jalankan: ${scenario.toLocaleLowerCase("id-ID")}.`,
      "Catat outcome yang dapat diamati dan perubahan data.",
    ],
    testData: "Sesuaikan data profil dengan nilai, format, peran, atau dependensi yang benar-benar tersedia.",
    expected: criterion.then || criterion.text,
    source: `Profil ${profile.label}; ${criterion.id}`,
    evidence: criterion.text,
    criterionIds: [criterion.id],
    tags: ["template", profileKey],
    templateProfile: profileKey,
    needsCustomization: true,
    parameterSets: [],
    risk: normalizeRisk({ impact: profileKey === "payment" || profileKey === "permission" ? 5 : 3, probability: 3, complexity: index > 1 ? 4 : 3, regression: category === "regression" ? 5 : 3 }),
    module: featureName,
  }));
}

function normalizedText(value = "") {
  return String(value).normalize("NFKD").toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, " ").trim();
}

function similarity(first = "", second = "") {
  const a = new Set(normalizedText(first).split(/\s+/).filter(Boolean));
  const b = new Set(normalizedText(second).split(/\s+/).filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

export function compareRequirementVersions(previous = {}, nextAnalysis = {}) {
  const oldCriteria = previous.criteria || [];
  const newCriteria = nextAnalysis.criteria || [];
  const usedNew = new Set();
  const exact = [];
  const changed = [];
  const removed = [];

  oldCriteria.forEach((oldCriterion) => {
    let matchIndex = newCriteria.findIndex((candidate, index) => !usedNew.has(index) && normalizedText(candidate.text) === normalizedText(oldCriterion.text));
    if (matchIndex >= 0) {
      usedNew.add(matchIndex);
      exact.push({ previous: oldCriterion, next: { ...newCriteria[matchIndex], id: oldCriterion.id } });
      return;
    }
    const candidates = newCriteria.map((candidate, index) => ({ candidate, index, score: usedNew.has(index) ? 0 : similarity(oldCriterion.text, candidate.text) })).sort((a, b) => b.score - a.score);
    if (candidates[0]?.score >= 0.4) {
      usedNew.add(candidates[0].index);
      changed.push({ previous: oldCriterion, next: { ...candidates[0].candidate, id: oldCriterion.id }, similarity: candidates[0].score });
    } else removed.push(oldCriterion);
  });

  let nextNumber = oldCriteria.reduce((highest, criterion) => {
    const number = Number.parseInt(String(criterion.id).split("-AC-")[1], 10);
    return Number.isNaN(number) ? highest : Math.max(highest, number);
  }, 0) + 1;
  const added = newCriteria.filter((_, index) => !usedNew.has(index)).map((criterion) => ({ ...criterion, id: `${previous.id || nextAnalysis.requirementId || "REQ-001"}-AC-${String(nextNumber++).padStart(3, "0")}` }));
  const criteria = [...exact.map((item) => item.next), ...changed.map((item) => item.next), ...added];
  return { exact, changed, removed, added, criteria };
}

export function requirementImpactForCase(testCase = {}, comparison = {}, requirementId = "") {
  const links = (testCase.criterionIds || []).filter((id) => !requirementId || id.startsWith(`${requirementId}-AC-`));
  if (!links.length) return { status: "unaffected", label: IMPACT_LABELS.unaffected, reason: "Test case tidak tertaut ke criterion pada requirement ini." };
  const changedIds = new Set((comparison.changed || []).map((item) => item.previous.id));
  const removedIds = new Set((comparison.removed || []).map((item) => item.id));
  const exactIds = new Set((comparison.exact || []).map((item) => item.previous.id));
  if (links.every((id) => removedIds.has(id))) return { status: "obsolete", label: IMPACT_LABELS.obsolete, reason: "Seluruh acceptance criterion terkait telah dihapus." };
  if (links.some((id) => changedIds.has(id) || removedIds.has(id))) return { status: "update", label: IMPACT_LABELS.update, reason: "Acceptance criterion terkait berubah atau sebagian dihapus." };
  if (links.some((id) => exactIds.has(id))) return { status: "rerun", label: IMPACT_LABELS.rerun, reason: "Criterion tetap ada; jalankan ulang untuk memverifikasi versi requirement baru." };
  return { status: "unaffected", label: IMPACT_LABELS.unaffected, reason: "Tidak ada perubahan terdeteksi pada criterion terkait." };
}

export function runQualityGate(feature = {}) {
  const findings = [];
  const cases = feature.cases || [];
  const add = (severity, code, message, reference = "") => findings.push({ severity, code, message, reference });
  const fingerprints = new Map();

  cases.forEach((testCase) => {
    const reference = testCase.id || "Test case";
    if (!(testCase.steps || []).length) add("error", "steps-empty", "Langkah uji belum diisi.", reference);
    else if ((testCase.steps || []).some((step) => /\b(dll|dan lain-lain|seperlunya|sesuai kebutuhan|lakukan pengujian)\b/i.test(step))) add("warning", "steps-ambiguous", "Langkah uji masih ambigu.", reference);
    if (!String(testCase.expected || "").trim()) add("error", "expected-empty", "Expected result belum diisi.", reference);
    else if (/\b(berjalan baik|sesuai harapan|berhasil dengan benar|sesuai kebutuhan)\b/i.test(testCase.expected)) add("warning", "expected-unmeasurable", "Expected result belum terukur.", reference);
    if (!String(testCase.testData || "").trim() && !(testCase.parameterSets || []).some((set) => set.data)) add("error", "data-empty", "Data uji dan kombinasi parameter masih kosong.", reference);
    if (testCase.qaStatus === "Gagal" && !String(testCase.actual || "").trim()) add("error", "failed-no-actual", "Kasus gagal belum memiliki hasil aktual.", reference);
    if (testCase.qaStatus === "Terblokir" && !String(testCase.blocker || testCase.actual || "").trim()) add("error", "blocked-no-reason", "Kasus terblokir belum memiliki alasan blocker.", reference);
    if (testCase.needsCustomization) add("warning", "template-draft", "Draft profil belum ditandai selesai disesuaikan QA.", reference);
    if (["update", "obsolete"].includes(testCase.requirementImpact?.status)) add("warning", `impact-${testCase.requirementImpact.status}`, testCase.requirementImpact.reason, reference);
    const fingerprint = `${testCase.category}|${normalizedText(testCase.scenario)}`;
    if (fingerprints.has(fingerprint)) add("warning", "duplicate", `Duplikat dengan ${fingerprints.get(fingerprint)}.`, reference);
    else fingerprints.set(fingerprint, reference);
  });

  (feature.requirements || []).forEach((requirement) => {
    (requirement.criteria || []).forEach((criterion) => {
      if (!cases.some((testCase) => (testCase.criterionIds || []).includes(criterion.id))) add("error", "criterion-uncovered", "Requirement belum memiliki test case terkait.", criterion.id);
    });
  });
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  return { findings, errors, warnings, passed: errors === 0 };
}
