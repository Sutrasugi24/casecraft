import test from "node:test";
import assert from "node:assert/strict";
import {
  applyRequirementVersion,
  bulkUpdateExecutionStatus,
  COLLECTION_STORAGE_KEY,
  createExecutionCycle,
  createCollection,
  createManualTestCase,
  duplicateTestCase,
  executionHistory,
  featureIdFromName,
  loadCollection,
  nextCaseId,
  parseProject,
  removeTestCase,
  renameFeature,
  restoreTestCase,
  saveCollection,
  selectExecutionCycle,
  serializeProject,
  setFeatureArchived,
  updateExecutionResult,
  upsertFeature,
} from "../dist/collection-store.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

test("collection store persists and restores execution fields", () => {
  const storage = new MemoryStorage();
  const collection = createCollection([{ id: "TC_LOGIN_001", scenario: "Login valid" }], {
    featureName: "Login",
    requirement: "Pengguna dapat login dengan kredensial valid.",
  });

  assert.equal(saveCollection(collection, storage), true);
  assert.ok(storage.getItem(COLLECTION_STORAGE_KEY));

  const restored = loadCollection(storage);
  assert.equal(restored.version, 3);
  assert.equal(restored.features[0].name, "Login");
  assert.equal(restored.features[0].cases[0].qaStatus, "Belum diuji");
  assert.equal(restored.features[0].cases[0].priority, "Medium");
  assert.equal(restored.features[0].cases[0].rejectStatus, "Tidak ditolak");
  assert.equal(restored.features[0].cases[0].actual, "");
  assert.equal(restored.features[0].requirements[0].id, "REQ-001");
  assert.equal(restored.features[0].cycles[0].id, "CYCLE-001");
});

test("collection store rejects malformed or unsupported data", () => {
  const storage = new MemoryStorage();
  storage.setItem(COLLECTION_STORAGE_KEY, "not-json");
  assert.equal(loadCollection(storage), null);

  storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({ version: 2, cases: [] }));
  assert.equal(loadCollection(storage), null);
});

test("collection store separates test cases by feature", () => {
  const loginCases = [{ id: "TC_LOGIN_001", module: "Login", category: "happy", scenario: "Login valid" }];
  const checkoutCases = [{ id: "TC_CHECKOUT_001", module: "Checkout", category: "happy", scenario: "Checkout valid" }];
  const initial = createCollection(loginCases, { featureName: "Login", requirement: "Login valid" });
  const result = upsertFeature(initial, checkoutCases, { featureName: "Checkout", requirement: "Checkout valid" });

  assert.equal(result.created, true);
  assert.equal(result.collection.features.length, 2);
  assert.deepEqual(result.collection.features.map((feature) => feature.name), ["Login", "Checkout"]);
  assert.equal(result.collection.activeFeatureId, featureIdFromName("Checkout"));
  assert.deepEqual(result.collection.features[0].cases.map((testCase) => testCase.id), ["TC_LOGIN_001"]);
  assert.deepEqual(result.collection.features[1].cases.map((testCase) => testCase.id), ["TC_CHECKOUT_001"]);
});

test("collection store merges only into the matching feature", () => {
  const existing = createCollection([
    { id: "TC_LOGIN_001", module: "Login", category: "happy", scenario: "Login valid" },
  ], { featureName: "Login" });
  const result = upsertFeature(existing, [
    { id: "TC_LOGIN_001", module: "Login", category: "happy", scenario: "Login valid" },
    { id: "TC_LOGIN_002", module: "Login", category: "negative", scenario: "Password salah" },
  ], { featureName: "Login" });

  assert.equal(result.created, false);
  assert.equal(result.collection.features.length, 1);
  assert.equal(result.feature.cases.length, 2);
  assert.equal(result.added.length, 1);
  assert.equal(result.duplicates.length, 1);
});

test("version one collections migrate into feature suites", () => {
  const storage = new MemoryStorage();
  storage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({
    version: 1,
    lastFeatureName: "Checkout",
    lastRequirement: "Requirement checkout",
    cases: [
      { id: "TC_LOGIN_001", module: "Login", scenario: "Login valid" },
      { id: "TC_CHECKOUT_001", module: "Checkout", scenario: "Checkout valid" },
    ],
  }));

  const restored = loadCollection(storage);
  assert.equal(restored.version, 3);
  assert.equal(restored.features.length, 2);
  assert.equal(restored.activeFeatureId, featureIdFromName("Checkout"));
  assert.equal(restored.features.find((feature) => feature.name === "Checkout").requirement, "Requirement checkout");
});

test("collection store fails safely when browser storage is unavailable", () => {
  assert.equal(loadCollection(), null);
  assert.equal(saveCollection(createCollection([])), false);
});

test("manual test cases receive the next stable feature ID and complete defaults", () => {
  const feature = {
    name: "Login",
    cases: [
      { id: "TC_LOGIN_001" },
      { id: "TC_LOGIN_003" },
      { id: "CUSTOM-ID" },
    ],
  };

  assert.equal(nextCaseId(feature.name, feature.cases), "TC_LOGIN_004");
  const manual = createManualTestCase(feature, {
    category: "negative",
    scenario: "  Menolak password kedaluwarsa  ",
    precondition: "  Akun aktif  ",
    steps: [" Buka login ", " ", "Masukkan password lama"],
    testData: " Password kedaluwarsa ",
    expected: " Login ditolak ",
    criterionIds: ["REQ-001-AC-002"],
  });

  assert.equal(manual.id, "TC_LOGIN_004");
  assert.equal(manual.module, "Login");
  assert.equal(manual.categoryLabel, "Negative");
  assert.equal(manual.testType, "Negatif");
  assert.equal(manual.priority, "High");
  assert.equal(manual.qaStatus, "Belum diuji");
  assert.deepEqual(manual.steps, ["Buka login", "Masukkan password lama"]);
  assert.deepEqual(manual.criterionIds, ["REQ-001-AC-002"]);
});

test("duplicating a test case preserves its specification and resets execution data", () => {
  const source = {
    id: "TC_TD_001",
    module: "Tabungan Driver",
    category: "edge",
    categoryLabel: "Edge case",
    testType: "HYBRID",
    scenario: "Memproses nilai maksimum",
    precondition: "Data tersedia",
    steps: ["Isi batas maksimum", "Simpan"],
    testData: "Nilai maksimum",
    expected: "Data tersimpan",
    priority: "Critical",
    qaStatus: "Gagal",
    rejectStatus: "Ditolak",
    actual: "Overflow",
  };
  const feature = { name: "Tabungan Driver", cases: [source] };
  const duplicate = duplicateTestCase(feature, source);

  assert.equal(duplicate.id, "TC_TD_002");
  assert.equal(duplicate.scenario, "Memproses nilai maksimum (salinan)");
  assert.deepEqual(duplicate.steps, source.steps);
  assert.equal(duplicate.priority, "Critical");
  assert.equal(duplicate.qaStatus, "Belum diuji");
  assert.equal(duplicate.rejectStatus, "Tidak ditolak");
  assert.equal(duplicate.actual, "");
});

test("removing and restoring a test case preserves its original position and content", () => {
  const feature = {
    name: "Login",
    cases: [
      { id: "TC_LOGIN_001", scenario: "Login valid", steps: ["Buka login"] },
      { id: "TC_LOGIN_002", scenario: "Login invalid", steps: ["Isi password salah"] },
      { id: "TC_LOGIN_003", scenario: "Logout", steps: ["Klik logout"] },
    ],
  };
  const removed = removeTestCase(feature, "TC_LOGIN_002");

  assert.equal(removed.index, 1);
  assert.equal(removed.testCase.scenario, "Login invalid");
  assert.deepEqual(feature.cases.map((testCase) => testCase.id), ["TC_LOGIN_001", "TC_LOGIN_003"]);
  assert.equal(restoreTestCase(feature, removed.testCase, removed.index), true);
  assert.deepEqual(feature.cases.map((testCase) => testCase.id), ["TC_LOGIN_001", "TC_LOGIN_002", "TC_LOGIN_003"]);
  assert.equal(restoreTestCase(feature, removed.testCase, removed.index), false);
});
  executionHistory,

test("execution cycles preserve retest history instead of overwriting prior results", () => {
  const collection = createCollection([{ id: "TC_LOGIN_001", module: "Login", category: "happy", scenario: "Login valid" }], { featureName: "Login" });
  const feature = collection.features[0];

  updateExecutionResult(feature, "TC_LOGIN_001", { qaStatus: "Gagal", actual: "HTTP 500" });
  const second = createExecutionCycle(feature, { name: "Retest build 42", buildVersion: "42", environment: "Staging" });
  updateExecutionResult(feature, "TC_LOGIN_001", { qaStatus: "Lulus", actual: "Login berhasil" });

  assert.equal(feature.cases[0].qaStatus, "Lulus");
  assert.equal(executionHistory(feature, "TC_LOGIN_001").length, 2);
  assert.equal(executionHistory(feature, "TC_LOGIN_001")[1].result.qaStatus, "Gagal");
  assert.equal(selectExecutionCycle(feature, "CYCLE-001"), true);
  assert.equal(feature.cases[0].qaStatus, "Gagal");
  assert.equal(second.buildVersion, "42");
});

test("project backup round-trips through the versioned .casecraft.json envelope", () => {
  const collection = createCollection([{ id: "TC_LOGIN_001", module: "Login", category: "happy", scenario: "Login valid" }], {
    featureName: "Login",
    requirement: "Pengguna dapat login dan dashboard ditampilkan.",
  });
  const serialized = serializeProject(collection, "2026-11-04T00:00:00.000Z");
  const parsed = parseProject(serialized);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.collection.version, 3);
  assert.equal(parsed.collection.features[0].name, "Login");
  assert.match(serialized, /"format": "casecraft-project"/);
  assert.equal(parseProject('{"format":"casecraft-project","formatVersion":99}').ok, false);
  assert.equal(parseProject("not-json").ok, false);
});

test("suite rename and archive preserve stable identity and test history", () => {
  const collection = createCollection([{ id: "TC_LOGIN_001", module: "Login", category: "happy", scenario: "Login valid", tags: ["smoke"] }], { featureName: "Login" });
  const feature = collection.features[0];
  const originalId = feature.id;
  updateExecutionResult(feature, "TC_LOGIN_001", { qaStatus: "Gagal", actual: "HTTP 500" });

  assert.equal(renameFeature(feature, "Autentikasi"), true);
  assert.equal(feature.id, originalId);
  assert.equal(feature.cases[0].module, "Autentikasi");
  assert.deepEqual(feature.cases[0].tags, ["smoke"]);
  assert.equal(setFeatureArchived(feature, true, "2026-11-04T00:00:00.000Z"), true);
  assert.equal(feature.archived, true);
  assert.equal(setFeatureArchived(feature, false), true);
  assert.equal(feature.archivedAt, "");
  assert.equal(executionHistory(feature, "TC_LOGIN_001")[0].result.actual, "HTTP 500");
});

test("bulk status update affects only the active execution cycle", () => {
  const collection = createCollection([
    { id: "TC_LOGIN_001", module: "Login", category: "happy", scenario: "Login valid" },
    { id: "TC_LOGIN_002", module: "Login", category: "negative", scenario: "Login invalid" },
  ], { featureName: "Login" });
  const feature = collection.features[0];

  assert.equal(bulkUpdateExecutionStatus(feature, ["TC_LOGIN_001", "TC_LOGIN_002"], "Gagal"), 2);
  createExecutionCycle(feature, { name: "Retest" });
  assert.equal(bulkUpdateExecutionStatus(feature, ["TC_LOGIN_001"], "Lulus"), 1);
  assert.equal(feature.cases[0].qaStatus, "Lulus");
  assert.equal(selectExecutionCycle(feature, "CYCLE-001"), true);
  assert.equal(feature.cases[0].qaStatus, "Gagal");
  assert.equal(feature.cases[1].qaStatus, "Gagal");
});

test("requirement versioning stores history and marks impacted test cases", () => {
  const collection = createCollection([{ id: "TC_PROFILE_001", module: "Profile", category: "happy", scenario: "Simpan profil", criterionIds: ["REQ-001-AC-001"] }], {
    featureName: "Profile",
    requirement: "Pengguna dapat menyimpan profil dan status berubah menjadi Aktif.",
  });
  const feature = collection.features[0];
  const result = applyRequirementVersion(feature, "REQ-001", "Pengguna dapat menyimpan profil dan status berubah menjadi Terverifikasi setelah email dikonfirmasi.", "2026-11-04T00:00:00.000Z");
  assert.equal(result.requirement.currentVersion, 2);
  assert.equal(result.requirement.versions.length, 2);
  assert.equal(feature.cases[0].requirementImpact.status, "update");
});
