import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCollection, createExecutionCycle, serializeProject, updateExecutionResult } from "../dist/collection-store.js";
import { main, parseArguments } from "../bin/casecraft.mjs";

const REQUIREMENT = "Given anggota aktif berada di halaman profil When anggota menyimpan nama baru Then nama profil berubah dan audit tersimpan.";

function memoryIo() {
  let stdout = "";
  return { io: { stdout: { write(value) { stdout += value; } } }, read: () => stdout };
}

function reviewableCase(overrides = {}) {
  return {
    id: "TC_PROFILE_001",
    module: "Profil",
    category: "happy",
    categoryLabel: "Happy path",
    testType: "Positif",
    scenario: "Simpan nama profil",
    precondition: "Anggota aktif sudah masuk.",
    steps: ["Buka profil.", "Isi nama baru.", "Simpan perubahan."],
    testData: "nama=Casecraft Demo",
    expected: "Nama profil tampil sebagai Casecraft Demo dan satu audit perubahan tersimpan.",
    source: REQUIREMENT,
    criterionIds: ["REQ-001-AC-001"],
    qaStatus: "Belum diuji",
    parameterSets: [],
    ...overrides,
  };
}

test("CLI memetakan opsi berulang dan flag tanpa mengubah input", () => {
  const parsed = parseArguments(["validate", "project.casecraft.json", "--ci", "--plugin", "a.mjs", "--plugin", "b.mjs"]);
  assert.equal(parsed.command, "validate");
  assert.deepEqual(parsed.positional, ["project.casecraft.json"]);
  assert.equal(parsed.options.ci, true);
  assert.deepEqual(parsed.options.plugin, ["a.mjs", "b.mjs"]);
});

test("CLI generate dan export bekerja deterministik tanpa layanan jaringan", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "casecraft-cli-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const projectPath = join(directory, "profile.casecraft.json");
  const markdownPath = join(directory, "profile.md");

  const generatedIo = memoryIo();
  await main(["generate", "--feature", "Profil", "--requirement", REQUIREMENT, "--output", projectPath], generatedIo.io);
  const project = JSON.parse(await readFile(projectPath, "utf8"));
  assert.equal(project.format, "casecraft-project");
  assert.equal(project.collection.features[0].name, "Profil");

  await main(["export", projectPath, "--template", "markdown", "--output", markdownPath], memoryIo().io);
  assert.match(await readFile(markdownPath, "utf8"), /ID Test Case/);
  await assert.rejects(() => main(["export", projectPath, "--template", "unknown-adapter"], memoryIo().io), /tidak dikenal/);
});

test("CLI validate mengembalikan exit code quality gate yang dapat dipakai CI", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "casecraft-ci-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const projectPath = join(directory, "invalid.casecraft.json");
  const collection = createCollection([
    reviewableCase({ expected: "Berjalan baik" }),
  ], {
    featureName: "Profil",
    requirement: REQUIREMENT,
    generationReport: {
      requirementId: "REQ-001",
      criteria: [
        { id: "REQ-001-AC-001", text: "Nama profil berubah." },
        { id: "REQ-001-AC-002", text: "Audit perubahan tersimpan." },
      ],
      warnings: [],
      coverage: [],
    },
  });
  await writeFile(projectPath, serializeProject(collection), "utf8");

  const output = memoryIo();
  const previousExitCode = process.exitCode;
  await main(["validate", projectPath, "--ci", "--json"], output.io);
  assert.equal(process.exitCode, 1);
  process.exitCode = previousExitCode;
  const report = JSON.parse(output.read());
  assert.equal(report.passed, false);
  assert.ok(report.findings.some((finding) => finding.code === "criterion-uncovered"));
  assert.ok(report.findings.some((finding) => finding.code === "expected-unmeasurable"));
});

test("CLI compare melaporkan regression dan perubahan pass rate antar-cycle", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "casecraft-compare-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const projectPath = join(directory, "runs.casecraft.json");
  const collection = createCollection([reviewableCase()], { featureName: "Profil", requirement: REQUIREMENT });
  const feature = collection.features[0];
  updateExecutionResult(feature, "TC_PROFILE_001", { qaStatus: "Lulus" });
  createExecutionCycle(feature, { name: "Release 1.1", buildVersion: "1.1.0", environment: "staging" });
  updateExecutionResult(feature, "TC_PROFILE_001", { qaStatus: "Gagal", actual: "Nama lama tetap tampil." });
  await writeFile(projectPath, serializeProject(collection), "utf8");

  const output = memoryIo();
  await main(["compare", projectPath, "--baseline", "CYCLE-001", "--target", "CYCLE-002"], output.io);
  const comparison = JSON.parse(output.read());
  assert.deepEqual(comparison.regressions, ["TC_PROFILE_001"]);
  assert.equal(comparison.passRateDelta, -100);
});
