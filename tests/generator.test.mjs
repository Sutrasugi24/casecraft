import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRequirement, buildGenerationReport, extractClauses, generateTestCases, mergeTestCases, sanitizePrefix, testCaseFingerprint, toJiraCsv, toMarkdown, toNotionTsv } from "../dist/generator.js";

const requirement = `
Pengguna dapat mengedit beberapa driver sekaligus.
- Sistem memvalidasi input dan menandai baris yang tidak sesuai.
- Perubahan hanya diterapkan pada data yang diedit.
- Setelah disimpan, perhitungan tabungan diperbarui.
- Fitur existing tidak boleh terganggu.
`;

test("sanitizePrefix creates stable test case prefixes", () => {
  assert.equal(sanitizePrefix("Tabungan Driver"), "TD");
  assert.equal(sanitizePrefix(""), "FITUR");
});

test("extractClauses removes bullets and keeps meaningful requirements", () => {
  const clauses = extractClauses(requirement);
  assert.ok(clauses.length >= 5);
  assert.equal(clauses.some((clause) => clause.startsWith("-")), false);
});

test("generateTestCases creates only categories supported by requirement evidence", () => {
  const cases = generateTestCases({ featureName: "Tabungan Driver", requirement });
  assert.ok(cases.length >= 7);
  assert.deepEqual(new Set(cases.map((item) => item.category)), new Set(["happy", "negative", "regression"]));
  assert.equal(cases[0].id, "TC_TD_001");
  assert.equal(new Set(cases.map((item) => item.id)).size, cases.length);
  assert.equal(cases[0].testType, "Positif");
  assert.equal(cases[0].priority, "High");
  assert.equal(cases[0].qaStatus, "Belum diuji");
  assert.equal(cases[0].rejectStatus, "Tidak ditolak");
  assert.ok(cases.every((item) => item.precondition.length > 0));
  assert.ok(cases.every((item) => item.steps.length > 0));
  assert.ok(cases.every((item) => item.testData.length > 0));
  assert.ok(cases.every((item) => item.criterionIds.length === 1));
});

test("analyzeRequirement recognizes Given When Then, numeric boundaries, roles, dependencies, and outcomes", () => {
  const source = `
Given Admin sudah masuk dan API pembayaran tersedia
When Admin mengirim nominal antara 10 sampai 100 transaksi
Then status pembayaran tersimpan sebagai Berhasil
Hanya supervisor boleh membatalkan pembayaran.
Jika gateway timeout, pembayaran gagal dan saldo tidak berubah.
`;
  const analysis = analyzeRequirement(source, { requirementId: "REQ-007" });
  const [gwt, permission, dependency] = analysis.criteria;

  assert.equal(gwt.id, "REQ-007-AC-001");
  assert.equal(gwt.given, "Admin sudah masuk dan API pembayaran tersedia");
  assert.equal(gwt.when, "Admin mengirim nominal antara 10 sampai 100 transaksi");
  assert.equal(gwt.then, "Status pembayaran tersimpan sebagai Berhasil");
  assert.deepEqual(gwt.signals.bounds.map((bound) => [bound.kind, bound.value]), [["min", "10"], ["max", "100"]]);
  assert.equal(gwt.signals.hasDependency, true);
  assert.equal(gwt.signals.hasOutcome, true);
  assert.equal(permission.signals.hasAccessRestriction, true);
  assert.equal(dependency.signals.hasErrorCondition, true);
  assert.equal(dependency.signals.hasDependency, true);
});

test("acceptance criteria headings keep descriptive context out of the traceability list", () => {
  const source = `Deskripsi:\nUbah tata letak halaman profil.\nAcceptance Criteria:\n- Pengguna dapat menyimpan nama dan nama baru ditampilkan.\n- Nama wajib minimal 3 karakter.`;
  const analysis = analyzeRequirement(source);

  assert.equal(analysis.criteria.length, 2);
  assert.equal(analysis.criteria.some((criterion) => criterion.text.includes("tata letak")), false);
});

test("generator reports insufficient information instead of inventing unsupported cases", () => {
  const vague = "Sistem harus cepat, mudah, dan bekerja sebagaimana mestinya untuk seluruh pengguna.";
  const cases = generateTestCases({ featureName: "Pencarian", requirement: vague });
  const report = buildGenerationReport({ requirement: vague, cases });

  assert.equal(cases.length, 0);
  assert.equal(report.criteria[0].ambiguous, true);
  assert.ok(report.warnings.some((warning) => warning.includes("belum terukur")));
  assert.ok(report.warnings.some((warning) => warning.includes("Negative belum dibuat")));
});

test("a dependency precondition alone does not invent a failure scenario", () => {
  const source = "Given API profil tersedia When Pengguna membuka profil Then Data profil ditampilkan.";
  const cases = generateTestCases({ featureName: "Profil", requirement: source, coverage: ["negative"] });

  assert.equal(cases.length, 0);
});

test("explicit boundaries create exact edge and just-outside negative cases", () => {
  const source = "Pengguna harus mengisi PIN minimal 4 digit dan maksimal 6 digit sebelum data tersimpan.";
  const cases = generateTestCases({ featureName: "PIN", requirement: source, coverage: ["negative", "edge"] });

  assert.equal(cases.filter((item) => item.category === "edge").length, 2);
  assert.equal(cases.filter((item) => item.category === "negative").length, 2);
  assert.ok(cases.some((item) => item.testData.startsWith("3 digit")));
  assert.ok(cases.some((item) => item.testData.startsWith("7 digit")));
});

test("generateTestCases respects category selection", () => {
  const cases = generateTestCases({ featureName: "Login", requirement: "Pengguna dapat login dengan email dan password valid lalu masuk ke dashboard.", coverage: ["happy"] });
  assert.ok(cases.length > 0);
  assert.equal(cases.every((item) => item.category === "happy"), true);
});

test("testCaseFingerprint ignores feature-name differences for the same scenario", () => {
  const first = generateTestCases({ featureName: "Tabungan Driver", requirement, coverage: ["regression"] });
  const second = generateTestCases({ featureName: "Tabungan Driver Bulk", requirement, coverage: ["regression"] });
  const firstExisting = first.find((item) => item.category === "regression");
  const secondExisting = second.find((item) => item.category === "regression");

  assert.equal(testCaseFingerprint(firstExisting), testCaseFingerprint(secondExisting));
});

test("mergeTestCases adds only missing scenarios and keeps unique IDs", () => {
  const existing = generateTestCases({
    featureName: "Tabungan Driver",
    requirement: "Pengguna dapat mengedit beberapa driver sekaligus dan menyimpan seluruh perubahan dengan satu aksi.",
    coverage: ["happy"],
  });
  const incoming = generateTestCases({
    featureName: "Tabungan Driver",
    requirement: "Pengguna dapat mengedit beberapa driver sekaligus dan menyimpan seluruh perubahan dengan satu aksi.\nSistem menampilkan ringkasan perubahan sebelum data disimpan.",
    coverage: ["happy"],
  });
  const merged = mergeTestCases(existing, incoming);

  assert.ok(merged.added.length > 0);
  assert.ok(merged.duplicates.length > 0);
  assert.equal(merged.cases.length, existing.length + merged.added.length);
  assert.deepEqual(merged.cases.slice(0, existing.length), existing);
  assert.equal(new Set(merged.cases.map((item) => item.id)).size, merged.cases.length);
  assert.ok(merged.added.every((item) => Number(item.id.slice(-3)) > existing.length));

  const repeated = mergeTestCases(merged.cases, incoming);
  assert.equal(repeated.added.length, 0);
  assert.equal(repeated.duplicates.length, incoming.length);
  assert.deepEqual(repeated.cases, merged.cases);
});

test("exports produce Notion Markdown and Jira CSV", () => {
  const cases = generateTestCases({ featureName: "Tabungan Driver", requirement, coverage: ["happy"] });
  const markdown = toMarkdown(cases);
  const csv = toJiraCsv(cases);
  assert.match(markdown, /^\| ID Test Case \| Acceptance Criteria \| Fitur \/ Modul \| Jenis \| Skenario Uji \|/);
  assert.match(markdown, /\| Prioritas \| Status QA \| Status Reject \| Precondition \| Langkah Uji \| Data Uji \| Expected Result \| Hasil Aktual \|/);
  assert.match(markdown, /\| Positif \|/);
  assert.match(markdown, /\| Belum diuji \| Tidak ditolak \|/);
  assert.match(markdown, /TC_TD_001/);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"Summary","Description"/);
  assert.match(csv, /"Priority"/);
  assert.match(csv, /"Belum diuji"/);
});

test("Notion clipboard uses headerless TSV in the database column order", () => {
  const cases = generateTestCases({ featureName: "Tabungan Driver", requirement, coverage: ["happy"] });
  cases[0].actual = "Baris pertama\nBaris kedua\tdengan tab";
  const tsv = toNotionTsv(cases);
  const lines = tsv.split("\n");
  const firstRow = lines[0].split("\t");

  assert.equal(lines.length, cases.length);
  assert.equal(firstRow.length, 11);
  assert.deepEqual(firstRow.slice(0, 6), [
    "Tabungan Driver",
    "Positif",
    cases[0].scenario,
    "High",
    "Belum diuji",
    "Tidak ditolak",
  ]);
  assert.equal(firstRow[10], "Baris pertama Baris kedua dengan tab");
  assert.equal(tsv.includes("ID Test Case"), false);
  assert.equal(tsv.includes("<br>"), false);
});

test("generator creates parameter sets from explicit boundaries and optional profile drafts", () => {
  const source = "Acceptance criteria:\n- Pengguna dapat mengirim minimal 10 dan maksimal 100 transaksi lalu status berubah menjadi Diproses.";
  const cases = generateTestCases({ featureName: "Bulk payment", requirement: source, profile: "bulk" });
  assert.ok(cases.some((item) => item.parameterSets.some((set) => /minimum/.test(set.label))));
  assert.ok(cases.some((item) => item.templateProfile === "bulk" && item.needsCustomization));
  assert.ok(cases.every((item) => item.risk.score >= 20 && item.risk.score <= 100));
});
