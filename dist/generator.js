import { defaultRiskForCase, normalizeParameterSets, profileDrafts } from "./analysis-tools.js";

const CATEGORY_LABELS = {
  happy: "Happy path",
  negative: "Negative",
  edge: "Edge case",
  regression: "Regression",
};

const TEST_TYPE_LABELS = {
  happy: "Positif",
  negative: "Negatif",
  edge: "HYBRID",
  regression: "HYBRID",
};

const DEFAULT_PRIORITIES = {
  happy: "High",
  negative: "High",
  edge: "Medium",
  regression: "Medium",
};

const STOP_HEADINGS = /^(deskripsi|description|kriteria penerimaan|acceptance criteria|requirement|requirements|catatan|notes?|aturan bisnis|business rules?)\s*:?\s*$/i;
const SECTION_HEADING = /^(deskripsi|description|kriteria penerimaan|acceptance criteria|requirement|requirements|catatan|notes?|aturan bisnis|business rules?)\s*:\s*(.*)$/i;
const GIVEN_PATTERN = /^(?:given|dengan kondisi|diberikan|jika awalnya)\b\s*:?-?\s*/i;
const WHEN_PATTERN = /^(?:when|ketika|saat)\b\s*:?-?\s*/i;
const THEN_PATTERN = /^(?:then|maka)\b\s*:?-?\s*/i;
const INLINE_GWT_PATTERN = /^(?:given|dengan kondisi|diberikan)\b\s*:?-?\s*(.*?)\s+(?:when|ketika|saat)\b\s*:?-?\s*(.*?)\s+(?:then|maka)\b\s*:?-?\s*(.*)$/i;
const AMBIGUOUS_PATTERN = /\b(cepat|mudah|normal|sesuai kebutuhan|sesuai standar|sebagaimana mestinya|optimal|user[- ]friendly|dan lain-lain|dll)\b/i;
const ACTION_PATTERN = /\b(dapat|boleh|harus|memilih|mengisi|mengubah|mengedit|menghapus|menyimpan|mengirim|memproses|menampilkan|membuka|menutup|login|masuk|keluar|membayar|membatalkan|mengunduh|mengunggah|mencari|memfilter|mengurutkan|menyetujui|menolak|membuat|memvalidasi|menandai|menerapkan|diterapkan|memperbarui|menyediakan)\b/i;
const OUTCOME_PATTERN = /\b(tersimpan|disimpan|diperbarui|diterapkan|berubah|bertambah|berkurang|tetap|ditolak|ditampilkan|muncul|hilang|berhasil|gagal|status|saldo|total|dialihkan|diarahkan|terkirim|terhapus|tercatat|ditandai|tidak berubah|tidak diproses)\b/i;
const ERROR_PATTERN = /\b(gagal|error|invalid|tidak valid|tidak sesuai|ditolak|timeout|terputus|tidak tersedia|kosong|wajib|duplikat|salah|kedaluwarsa|down|offline)\b/i;
const DEPENDENCY_PATTERN = /\b(api|service|layanan|server|koneksi|jaringan|dependensi|gateway|database|sistem eksternal|pihak ketiga)\b/i;
const REGRESSION_PATTERN = /\b(existing|eksisting|sebelumnya|tetap berfungsi|tidak boleh terganggu|backward compatible|regression)\b/i;
const ACCESS_RESTRICTION_PATTERN = /\b(hanya|kecuali|tanpa hak|tidak berhak|tidak boleh|dilarang|role|peran|hak akses|permission|otorisasi)\b/i;

export function sanitizePrefix(featureName = "") {
  const words = featureName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "FITUR";
  const initials = words.map((word) => word[0]).join("").toUpperCase();
  if (initials.length >= 2 && initials.length <= 8) return initials;
  return words.join("_").slice(0, 12).toUpperCase();
}

function cleanLine(line = "") {
  return line
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/^\*\*(.*?)\**:?$/, "$1")
    .trim();
}

export function extractClauses(requirement = "") {
  const normalized = requirement
    .replace(/\r/g, "")
    .replace(/[•●▪◦]/g, "-")
    .replace(/\t/g, " ");
  const lineClauses = normalized
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map(cleanLine)
    .filter((line) => line.length > 8 && !STOP_HEADINGS.test(line));
  return [...new Set(lineClauses)].slice(0, 30);
}

function sentenceCase(text) {
  const clean = String(text || "").replace(/[.:;]+$/, "").trim();
  if (!clean) return "Requirement utama";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function concise(text, max = 92) {
  const clean = sentenceCase(text);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseBounds(text) {
  const results = [];
  const rangePattern = /\b(?:antara|mulai dari)\s+(\d+(?:[.,]\d+)?)\s+(?:sampai|hingga|dan)\s+(\d+(?:[.,]\d+)?)(?:\s+([a-zA-Z]+))?/gi;
  const namedPattern = /\b(minimal|minimum|min\.?|maksimal|maximum|max\.?|sedikitnya|paling sedikit|paling banyak)\s*(?:sebanyak|sebesar)?\s*(\d+(?:[.,]\d+)?)(?:\s+([a-zA-Z]+))?/gi;
  let match;
  while ((match = rangePattern.exec(text))) {
    results.push({ kind: "min", value: match[1], unit: match[3] || "" });
    results.push({ kind: "max", value: match[2], unit: match[3] || "" });
  }
  while ((match = namedPattern.exec(text))) {
    const kind = /maks|max|paling banyak/i.test(match[1]) ? "max" : "min";
    results.push({ kind, value: match[2], unit: match[3] || "" });
  }
  return results.filter((bound, index) => results.findIndex((item) => item.kind === bound.kind && item.value === bound.value && item.unit === bound.unit) === index);
}

function parseRoles(text) {
  const roles = [];
  const rolePattern = /\b(admin(?:istrator)?|pengguna|user|qa|manager|manajer|supervisor|driver|pelanggan|kasir|operator|pemilik|owner|agen|staf)\b/gi;
  let match;
  while ((match = rolePattern.exec(text))) roles.push(match[1].toLocaleLowerCase("id-ID"));
  return unique(roles);
}

function criterionSignals(text, given = "", when = "", then = "") {
  const combined = `${given} ${when} ${then} ${text}`.trim();
  const roles = parseRoles(combined);
  return {
    bounds: parseBounds(combined),
    roles,
    hasAccessRestriction: ACCESS_RESTRICTION_PATTERN.test(combined) && (roles.length > 0 || /\b(hak akses|permission|otorisasi|tanpa hak|tidak berhak)\b/i.test(combined)),
    hasErrorCondition: ERROR_PATTERN.test(combined),
    hasDependency: DEPENDENCY_PATTERN.test(combined),
    hasOutcome: Boolean(then) || OUTCOME_PATTERN.test(combined),
    hasRegressionIntent: REGRESSION_PATTERN.test(combined),
  };
}

function criterionQuality(text, parts) {
  const issues = [];
  const combined = `${parts.given || ""} ${parts.when || ""} ${parts.then || ""} ${text}`;
  if (AMBIGUOUS_PATTERN.test(combined)) issues.push("memakai istilah yang belum terukur");
  if (!parts.when && !ACTION_PATTERN.test(combined) && !OUTCOME_PATTERN.test(combined)) issues.push("aksi yang diuji belum jelas");
  if (!parts.then && !OUTCOME_PATTERN.test(combined) && !ACTION_PATTERN.test(combined)) issues.push("outcome belum dinyatakan");
  return issues;
}

function makeCriterion({ id, text, given = "", when = "", then = "" }) {
  const normalizedText = sentenceCase(text);
  const issues = criterionQuality(normalizedText, { given, when, then });
  return {
    id,
    text: normalizedText,
    given: given ? sentenceCase(given) : "",
    when: when ? sentenceCase(when) : "",
    then: then ? sentenceCase(then) : "",
    ambiguous: issues.length > 0,
    issues,
    signals: criterionSignals(normalizedText, given, when, then),
  };
}

export function analyzeRequirement(requirement = "", { requirementId = "REQ-001" } = {}) {
  const normalized = String(requirement).replace(/\r/g, "").replace(/[•●▪◦]/g, "-").replace(/\t/g, " ");
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const hasAcceptanceHeading = lines.some((line) => /^(kriteria penerimaan|acceptance criteria)\s*:?/i.test(cleanLine(line)));
  const rawCriteria = [];
  let gwt = null;
  let section = hasAcceptanceHeading ? "other" : "general";

  function flushGwt() {
    if (!gwt) return;
    const text = [gwt.given && `Given ${gwt.given}`, gwt.when && `When ${gwt.when}`, gwt.then && `Then ${gwt.then}`].filter(Boolean).join(" · ");
    if (text) rawCriteria.push({ text, ...gwt });
    gwt = null;
  }

  lines.forEach((rawLine) => {
    let line = cleanLine(rawLine);
    if (!line) return;
    const heading = line.match(SECTION_HEADING);
    if (heading) {
      flushGwt();
      section = /kriteria penerimaan|acceptance criteria/i.test(heading[1]) ? "acceptance" : "other";
      line = cleanLine(heading[2]);
      if (!line || (hasAcceptanceHeading && section !== "acceptance")) return;
    } else if (STOP_HEADINGS.test(line)) {
      flushGwt();
      section = /kriteria penerimaan|acceptance criteria/i.test(line) ? "acceptance" : "other";
      return;
    }
    if (hasAcceptanceHeading && section !== "acceptance") return;
    const inlineGwt = line.match(INLINE_GWT_PATTERN);
    if (inlineGwt) {
      flushGwt();
      rawCriteria.push({
        text: `Given ${inlineGwt[1]} · When ${inlineGwt[2]} · Then ${inlineGwt[3]}`,
        given: inlineGwt[1],
        when: inlineGwt[2],
        then: inlineGwt[3],
      });
      return;
    }
    if (GIVEN_PATTERN.test(line)) {
      flushGwt();
      gwt = { given: line.replace(GIVEN_PATTERN, ""), when: "", then: "" };
      return;
    }
    if (WHEN_PATTERN.test(line)) {
      if (!gwt) gwt = { given: "", when: "", then: "" };
      gwt.when = line.replace(WHEN_PATTERN, "");
      return;
    }
    if (THEN_PATTERN.test(line)) {
      if (!gwt) gwt = { given: "", when: "", then: "" };
      gwt.then = line.replace(THEN_PATTERN, "");
      flushGwt();
      return;
    }
    flushGwt();
    if (line.length > 8) rawCriteria.push({ text: line });
  });
  flushGwt();

  const deduplicated = rawCriteria.filter((criterion, index) => {
    const fingerprint = criterion.text.toLocaleLowerCase("id-ID").replace(/\W+/g, " ").trim();
    return rawCriteria.findIndex((candidate) => candidate.text.toLocaleLowerCase("id-ID").replace(/\W+/g, " ").trim() === fingerprint) === index;
  });
  const criteria = deduplicated.slice(0, 30).map((criterion, index) => makeCriterion({
    ...criterion,
    id: `${requirementId}-AC-${String(index + 1).padStart(3, "0")}`,
  }));
  const warnings = [];
  if (!criteria.length) warnings.push("Acceptance criterion belum ditemukan. Tulis satu perilaku yang dapat diamati per baris atau gunakan Given/When/Then.");
  criteria.filter((criterion) => criterion.ambiguous).forEach((criterion) => warnings.push(`${criterion.id}: ${criterion.issues.join("; ")}.`));
  return { requirementId, criteria, warnings };
}

function buildCase(category, criterion, scenario, { precondition, steps, testData, expected, evidence, parameterSets = [] }) {
  return {
    category,
    scenario,
    precondition,
    steps,
    testData,
    expected,
    source: criterion.text,
    criterionIds: [criterion.id],
    evidence: evidence || criterion.text,
    parameterSets,
    actual: "",
    status: "",
  };
}

function parameterSetsForCriterion(criterion) {
  const sets = [];
  criterion.signals.bounds.forEach((bound) => {
    const numeric = Number(String(bound.value).replace(",", "."));
    const outside = bound.kind === "min" ? numeric - 1 : numeric + 1;
    sets.push({ label: `Tepat ${bound.kind === "min" ? "minimum" : "maksimum"}`, data: `${bound.value}${bound.unit ? ` ${bound.unit}` : ""}`, expected: "Nilai batas diproses sesuai requirement." });
    sets.push({ label: `Tepat di luar ${bound.kind === "min" ? "minimum" : "maksimum"}`, data: `${outside}${bound.unit ? ` ${bound.unit}` : ""}`, expected: "Nilai di luar batas ditolak tanpa menerapkan outcome bisnis." });
  });
  if (/\b(format|email|nomor telepon|tanggal|kode|regex|pattern)\b/i.test(criterion.text)) {
    sets.push({ label: "Format valid", data: "Nilai dengan format valid yang disebutkan requirement.", expected: "Format valid diterima." });
    sets.push({ label: "Format invalid", data: "Nilai yang melanggar format eksplisit requirement.", expected: "Format invalid ditolak." });
  }
  return normalizeParameterSets(sets);
}

function englishGeneratedText(value = "") {
  return String(value)
    .replace(/^Kondisi awal untuk /, "Initial condition for ")
    .replace(/ tersedia sesuai requirement\.?$/, " is available as specified.")
    .replace(/^Siapkan data valid yang dinyatakan pada /, "Prepare valid data stated in ")
    .replace(/^Lakukan aksi: /, "Perform action: ")
    .replace(/^Amati hasil tanpa mengubah kondisi lain di luar requirement\.?$/, "Observe the result without changing conditions outside the requirement.")
    .replace(/^Masukkan tepat /, "Enter exactly ")
    .replace(/^Masukkan /, "Enter ")
    .replace(/^Periksa /, "Verify ")
    .replace(/^Picu kondisi gagal atau dependensi sesuai teks /, "Trigger the failure condition or dependency stated in ")
    .replace(/^Coba lakukan aksi: /, "Attempt action: ")
    .replace(/^Nilai valid sesuai batas eksplisit pada /, "Valid values within the explicit boundary in ")
    .replace(/^Data valid yang disebutkan pada /, "Valid data stated in ")
    .replace(/^Peran pembanding terhadap /, "Comparison role against ")
    .replace(/^Kondisi error\/dependensi yang disebutkan secara eksplisit pada /, "Error/dependency condition explicitly stated in ")
    .replace(/^Nilai tepat pada batas /, "Value exactly at boundary ")
    .replace(/^Nilai di luar batas /, "Value outside boundary ")
    .replace(/^Memenuhi /, "Satisfy ")
    .replace(/^Menolak /, "Reject ")
    .replace(/^Menangani /, "Handle ")
    .replace(/^Memproses /, "Process ")
    .replace(/^Melindungi perilaku existing pada /, "Protect existing behavior in ")
    .replace(/^Sesuaikan data profil /, "Adjust profile data ")
    .replace(/^Draft profil /, "Profile draft ");
}

function localizeGeneratedCase(testCase, language) {
  if (language !== "en") return testCase;
  return {
    ...testCase,
    scenario: englishGeneratedText(testCase.scenario),
    precondition: englishGeneratedText(testCase.precondition),
    steps: (testCase.steps || []).map(englishGeneratedText),
    testData: englishGeneratedText(testCase.testData),
    expected: englishGeneratedText(testCase.expected),
    categoryLabel: { happy: "Happy path", negative: "Negative", edge: "Edge case", regression: "Regression" }[testCase.category],
    testType: testCase.category === "happy" ? "Positive" : testCase.category === "negative" ? "Negative" : "HYBRID",
    outputLanguage: "en",
  };
}

function baseCaseParts(feature, criterion) {
  return {
    precondition: criterion.given || `Kondisi awal untuk ${criterion.id} tersedia sesuai requirement.`,
    action: criterion.when || criterion.text,
    expected: criterion.then || criterion.text,
    testData: criterion.signals.bounds.length
      ? `Nilai valid sesuai batas eksplisit pada ${criterion.id}.`
      : `Data valid yang disebutkan pada ${criterion.id}; tidak menambahkan nilai bisnis di luar requirement.`,
    feature,
  };
}

function happyCase(feature, criterion) {
  const parts = baseCaseParts(feature, criterion);
  return buildCase("happy", criterion, `Memenuhi ${criterion.id}: ${concise(criterion.text, 68)}`, {
    precondition: parts.precondition,
    steps: [`Siapkan data valid yang dinyatakan pada ${criterion.id}.`, `Lakukan aksi: ${concise(parts.action, 150)}.`, "Amati hasil tanpa mengubah kondisi lain di luar requirement."],
    testData: parts.testData,
    expected: parts.expected,
    evidence: criterion.then || criterion.text,
  });
}

function negativeCasesForCriterion(feature, criterion) {
  const parts = baseCaseParts(feature, criterion);
  const cases = [];
  if (criterion.signals.hasAccessRestriction) {
    cases.push(buildCase("negative", criterion, `Menolak akses yang tidak memenuhi ${criterion.id}`, {
      precondition: criterion.given || `Gunakan peran yang tidak memiliki hak sesuai ${criterion.id}.`,
      steps: [`Coba lakukan aksi: ${concise(parts.action, 140)}.`, "Amati kontrol, respons, dan perubahan data."],
      testData: `Peran pembanding terhadap ${criterion.signals.roles.join(", ") || "hak akses yang disebutkan"}.`,
      expected: `Akses ditolak sesuai batas peran pada ${criterion.id} dan data tidak berubah.`,
      evidence: criterion.text,
    }));
  }
  if (criterion.signals.hasErrorCondition) {
    cases.push(buildCase("negative", criterion, `Menangani kondisi gagal pada ${criterion.id}`, {
      precondition: criterion.given || `Kondisi kegagalan yang disebutkan pada ${criterion.id} dapat disimulasikan.`,
      steps: [`Picu kondisi gagal atau dependensi sesuai teks ${criterion.id}.`, `Lakukan aksi: ${concise(parts.action, 140)}.`, "Periksa feedback dan perubahan data."],
      testData: `Kondisi error/dependensi yang disebutkan secara eksplisit pada ${criterion.id}.`,
      expected: criterion.then || `Sistem mengikuti perilaku gagal yang dinyatakan pada ${criterion.id} tanpa mengarang fallback lain.`,
      evidence: criterion.text,
    }));
  }
  criterion.signals.bounds.forEach((bound) => {
    const numericValue = Number(String(bound.value).replace(",", "."));
    const outside = bound.kind === "min" ? numericValue - 1 : numericValue + 1;
    cases.push(buildCase("negative", criterion, `Menolak nilai di luar batas ${bound.kind === "min" ? "minimum" : "maksimum"} ${bound.value}${bound.unit ? ` ${bound.unit}` : ""}`, {
      precondition: parts.precondition,
      steps: [`Masukkan ${outside}${bound.unit ? ` ${bound.unit}` : ""}.`, `Lakukan aksi: ${concise(parts.action, 140)}.`, "Periksa validasi dan perubahan data."],
      testData: `${outside}${bound.unit ? ` ${bound.unit}` : ""}, tepat di luar batas ${bound.value}${bound.unit ? ` ${bound.unit}` : ""}.`,
      expected: `Nilai di luar batas ${criterion.id} ditolak dan outcome bisnis tidak diterapkan.`,
      evidence: `${bound.kind}:${bound.value}${bound.unit}`,
    }));
  });
  return cases;
}

function edgeCasesForCriterion(feature, criterion) {
  const parts = baseCaseParts(feature, criterion);
  return criterion.signals.bounds.map((bound) => buildCase("edge", criterion, `Memproses tepat pada batas ${bound.kind === "min" ? "minimum" : "maksimum"} ${bound.value}${bound.unit ? ` ${bound.unit}` : ""}`, {
    precondition: parts.precondition,
    steps: [`Masukkan tepat ${bound.value}${bound.unit ? ` ${bound.unit}` : ""}.`, `Lakukan aksi: ${concise(parts.action, 140)}.`, "Periksa hasil pada nilai batas."],
    testData: `${bound.value}${bound.unit ? ` ${bound.unit}` : ""}, sesuai batas eksplisit ${criterion.id}.`,
    expected: criterion.then || `Nilai tepat pada batas ${criterion.id} diproses sesuai requirement.`,
    evidence: `${bound.kind}:${bound.value}${bound.unit}`,
  }));
}

function regressionCase(feature, criterion) {
  const parts = baseCaseParts(feature, criterion);
  return buildCase("regression", criterion, `Melindungi perilaku existing pada ${criterion.id}`, {
    precondition: criterion.given || `Perilaku existing yang disebutkan pada ${criterion.id} tersedia sebagai pembanding.`,
    steps: [`Jalankan perilaku existing yang disebutkan pada ${criterion.id}.`, `Lakukan perubahan atau aksi: ${concise(parts.action, 140)}.`, "Bandingkan outcome dengan perilaku yang harus dipertahankan."],
    testData: `Data existing yang disebutkan atau tersirat langsung pada ${criterion.id}.`,
    expected: criterion.then || criterion.text,
    evidence: criterion.text,
  });
}

export function generateTestCases({ featureName = "", requirement = "", coverage = ["happy", "negative", "edge", "regression"], requirementId = "REQ-001", profile = "none", outputLanguage = "id" }) {
  const feature = featureName.trim() || "Fitur yang diuji";
  const analysis = analyzeRequirement(requirement, { requirementId });
  const selected = new Set(coverage);
  let cases = [];
  analysis.criteria.forEach((criterion) => {
    if (criterion.ambiguous) return;
    if (selected.has("happy")) cases.push(happyCase(feature, criterion));
    if (selected.has("negative")) cases.push(...negativeCasesForCriterion(feature, criterion));
    if (selected.has("edge")) cases.push(...edgeCasesForCriterion(feature, criterion));
    if (selected.has("regression") && criterion.signals.hasRegressionIntent) cases.push(regressionCase(feature, criterion));
  });
  const profileCriterion = analysis.criteria.find((criterion) => !criterion.ambiguous) || null;
  cases.push(...profileDrafts(profile, { featureName: feature, criterion: profileCriterion }).filter((testCase) => selected.has(testCase.category)));
  const seen = new Set();
  cases = cases.filter((testCase) => {
    const key = `${testCase.category}|${testCase.scenario}`.toLocaleLowerCase("id-ID");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 60);
  const prefix = sanitizePrefix(featureName);
  return cases.map((testCase, index) => {
    const criterion = analysis.criteria.find((item) => (testCase.criterionIds || []).includes(item.id));
    const enriched = {
      ...testCase,
      parameterSets: normalizeParameterSets(testCase.parameterSets?.length ? testCase.parameterSets : criterion ? parameterSetsForCriterion(criterion) : []),
    };
    return localizeGeneratedCase({
    ...enriched,
    id: `TC_${prefix}_${String(index + 1).padStart(3, "0")}`,
    module: feature,
    categoryLabel: CATEGORY_LABELS[testCase.category],
    testType: TEST_TYPE_LABELS[testCase.category],
    priority: DEFAULT_PRIORITIES[testCase.category],
    qaStatus: "Belum diuji",
    rejectStatus: "Tidak ditolak",
    risk: testCase.risk || defaultRiskForCase(enriched),
    outputLanguage: outputLanguage === "en" ? "en" : "id",
  }, outputLanguage);
  });
}

export function buildGenerationReport({ requirement = "", coverage = ["happy", "negative", "edge", "regression"], requirementId = "REQ-001", cases = [] }) {
  const analysis = analyzeRequirement(requirement, { requirementId });
  const selected = new Set(coverage);
  const warnings = [...analysis.warnings];
  const generatedCategories = new Set(cases.map((testCase) => testCase.category));
  ["negative", "edge", "regression"].forEach((category) => {
    if (selected.has(category) && !generatedCategories.has(category)) warnings.push(`${CATEGORY_LABELS[category]} belum dibuat karena requirement tidak memberi bukti yang cukup untuk kategori ini.`);
  });
  return { ...analysis, warnings: unique(warnings), coverage: [...selected] };
}

function fingerprintTokens(value = "") {
  return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function testCaseFingerprint(testCase) {
  const moduleTokens = new Set(fingerprintTokens(testCase.module));
  const scenarioWithoutCriterionId = String(testCase.scenario || "").replace(/REQ-\d+-AC-\d+:?\s*/gi, "");
  const scenario = fingerprintTokens(scenarioWithoutCriterionId).filter((token) => !moduleTokens.has(token)).join(" ");
  return `${testCase.category || "unknown"}|${scenario}`;
}

function nextAvailableId(testCase, usedIds) {
  if (testCase.id && !usedIds.has(testCase.id)) return testCase.id;
  const prefix = `TC_${sanitizePrefix(testCase.module)}_`;
  let nextNumber = [...usedIds].reduce((highest, id) => {
    if (!id.startsWith(prefix)) return highest;
    const suffix = Number.parseInt(id.slice(prefix.length), 10);
    return Number.isNaN(suffix) ? highest : Math.max(highest, suffix);
  }, 0) + 1;
  let candidate = `${prefix}${String(nextNumber).padStart(3, "0")}`;
  while (usedIds.has(candidate)) {
    nextNumber += 1;
    candidate = `${prefix}${String(nextNumber).padStart(3, "0")}`;
  }
  return candidate;
}

export function mergeTestCases(existingCases = [], incomingCases = []) {
  const cases = existingCases.map((testCase) => ({ ...testCase }));
  const usedIds = new Set(cases.map((testCase) => testCase.id));
  const fingerprints = new Set(cases.map(testCaseFingerprint));
  const added = [];
  const duplicates = [];
  incomingCases.forEach((testCase) => {
    const fingerprint = testCaseFingerprint(testCase);
    if (fingerprints.has(fingerprint)) {
      const existing = cases.find((item) => testCaseFingerprint(item) === fingerprint);
      if (existing) existing.criterionIds = [...new Set([...(existing.criterionIds || []), ...(testCase.criterionIds || [])])];
      duplicates.push(testCase);
      return;
    }
    const mergedCase = { ...testCase, id: nextAvailableId(testCase, usedIds) };
    cases.push(mergedCase);
    added.push(mergedCase);
    usedIds.add(mergedCase.id);
    fingerprints.add(fingerprint);
  });
  return { cases, added, duplicates };
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function toMarkdown(cases) {
  const headers = ["ID Test Case", "Acceptance Criteria", "Fitur / Modul", "Jenis", "Skenario Uji", "Prioritas", "Status QA", "Status Reject", "Precondition", "Langkah Uji", "Data Uji", "Expected Result", "Hasil Aktual"];
  const lines = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
  cases.forEach((testCase) => {
    const steps = (testCase.steps || []).map((step, index) => `${index + 1}. ${step}`).join("<br>");
    const row = [testCase.id, (testCase.criterionIds || []).join(", "), testCase.module, testCase.testType, testCase.scenario, testCase.priority, testCase.qaStatus, testCase.rejectStatus, testCase.precondition, steps, testCase.testData, testCase.expected, testCase.actual].map(markdownCell);
    lines.push(`| ${row.join(" | ")} |`);
  });
  return lines.join("\n");
}

function notionCell(value) {
  return String(value ?? "").replace(/[\t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function toNotionTsv(cases) {
  return cases.map((testCase) => {
    const steps = (testCase.steps || []).map((step, index) => `${index + 1}. ${step}`).join(" ");
    return [testCase.module, testCase.testType, testCase.scenario, testCase.priority, testCase.qaStatus, testCase.rejectStatus, testCase.precondition, steps, testCase.testData, testCase.expected, testCase.actual].map(notionCell).join("\t");
  }).join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function toJiraCsv(cases) {
  const headers = ["Summary", "Description", "Preconditions", "Steps", "Expected Result", "Test Case ID", "Acceptance Criteria", "Module", "Category", "Priority", "Actual Result", "Status"];
  const rows = [headers.map(csvCell).join(",")];
  cases.forEach((testCase) => {
    const values = [testCase.scenario, `Verifikasi ${testCase.module}: ${testCase.source || testCase.scenario}`, testCase.precondition, (testCase.steps || []).map((step, index) => `${index + 1}. ${step}`).join("\n"), testCase.expected, testCase.id, (testCase.criterionIds || []).join(", "), testCase.module, testCase.categoryLabel, testCase.priority, testCase.actual, testCase.qaStatus];
    rows.push(values.map(csvCell).join(","));
  });
  return `\uFEFF${rows.join("\r\n")}`;
}

export { CATEGORY_LABELS };
