import { createCollection, featureIdFromName, nextRequirementId, upsertFeature } from "./collection-store.js";
import { buildGenerationReport, generateTestCases, mergeTestCases } from "./generator.js";
import { loadBestCollection, saveActiveCollection } from "./persistent-store.js";
import { importWithAdapter } from "./adapter-registry.js";
import { initLocalization } from "./localization.js";
import { initPwa } from "./pwa.js";

const EXAMPLE_FEATURE = "Tabungan Driver";
const EXAMPLE_REQUIREMENT = `Deskripsi:
Ubah mekanisme pengisian pada halaman Tabungan Driver agar pengguna dapat mengisi atau mengedit nilai untuk beberapa driver dalam satu kolom sekaligus, kemudian menyimpan seluruh perubahan dalam satu aksi.

Kriteria Penerimaan:
- Pengguna dapat mengedit nilai pada kolom yang sama untuk beberapa baris driver tanpa menyimpan satu per satu.
- Tersedia tombol Simpan Perubahan untuk menyimpan seluruh data yang telah diedit.
- Sistem memvalidasi input dan menandai baris yang tidak sesuai.
- Perubahan hanya diterapkan pada data yang diedit.
- Setelah berhasil disimpan, nilai dan perhitungan tabungan driver diperbarui sesuai perubahan.
- Fitur yang sudah exist tidak boleh terganggu.`;

const form = document.querySelector("#generator-form");
const featureInput = document.querySelector("#feature-name");
const featureError = document.querySelector("#feature-error");
const requirementInput = document.querySelector("#requirement");
const requirementError = document.querySelector("#requirement-error");
const coverageError = document.querySelector("#coverage-error");
const characterCount = document.querySelector("#character-count");
const generateButton = document.querySelector("#generate-button");
const buttonLabel = generateButton.querySelector(".button-label");
const existingCollection = document.querySelector("#existing-collection");
const existingCollectionText = document.querySelector("#existing-collection-text");
const storageError = document.querySelector("#storage-error");
const toast = document.querySelector("#toast");
const profileSelect = document.querySelector("#test-profile");
const importSpecificationButton = document.querySelector("#import-specification");
const specificationFile = document.querySelector("#specification-file");
const specificationFeedback = document.querySelector("#specification-feedback");
const requirementLanguage = document.querySelector("#requirement-language");
const outputLanguage = document.querySelector("#output-language");

let toastTimer;
let collection = await loadBestCollection();
let structuredImport = null;

function selectedCoverage() {
  return [...form.querySelectorAll('input[name="coverage"]:checked')].map((input) => input.value);
}

function updateCharacterCount() {
  characterCount.textContent = `${requirementInput.value.length.toLocaleString("id-ID")} karakter`;
}

function clearRequirementError() {
  requirementInput.removeAttribute("aria-invalid");
  requirementError.hidden = true;
  requirementError.textContent = "";
}

function clearFeatureError() {
  featureInput.removeAttribute("aria-invalid");
  featureError.hidden = true;
  featureError.textContent = "";
}

function validateForm() {
  const value = requirementInput.value.trim();

  clearFeatureError();
  clearRequirementError();
  coverageError.hidden = true;
  coverageError.textContent = "";

  if (!featureInput.value.trim()) {
    featureInput.setAttribute("aria-invalid", "true");
    featureError.textContent = "Nama fitur wajib diisi agar test case tidak bercampur dengan suite lain.";
    featureError.hidden = false;
    featureInput.focus();
    return false;
  }

  if (!value) {
    requirementInput.setAttribute("aria-invalid", "true");
    requirementError.textContent = "Requirement wajib diisi agar test case dapat dibuat.";
    requirementError.hidden = false;
    requirementInput.focus();
    return false;
  }

  if (value.length < 30) {
    requirementInput.setAttribute("aria-invalid", "true");
    requirementError.textContent = "Tambahkan detail requirement hingga sedikitnya 30 karakter.";
    requirementError.hidden = false;
    requirementInput.focus();
    return false;
  }

  if (!selectedCoverage().length) {
    coverageError.textContent = "Pilih sedikitnya satu jenis cakupan pengujian.";
    coverageError.hidden = false;
    form.querySelector('input[name="coverage"]').focus();
    return false;
  }

  return true;
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  generateButton.setAttribute("aria-busy", String(isBusy));
  buttonLabel.textContent = isBusy ? "Menyusun suite fitur" : "Buat dan tinjau fitur";
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function showExistingCollection() {
  if (!collection?.features.length) return;

  const totalCases = collection.features.reduce((total, feature) => total + feature.cases.length, 0);
  existingCollectionText.textContent = `${collection.features.length.toLocaleString("id-ID")} fitur dan ${totalCases.toLocaleString("id-ID")} test case tersimpan. Nama fitur yang sama akan diperbarui tanpa mencampur suite lain.`;
  existingCollection.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  storageError.hidden = true;
  if (!validateForm()) return;

  setBusy(true);
  await new Promise((resolve) => window.setTimeout(resolve, 420));

  const existingFeature = collection?.features.find((feature) => feature.id === featureIdFromName(featureInput.value));
  const requirementId = existingFeature ? nextRequirementId(existingFeature) : "REQ-001";
  const coverage = selectedCoverage();
  const generatedCases = generateTestCases({
    featureName: featureInput.value,
    requirement: requirementInput.value,
    coverage,
    requirementId,
    profile: profileSelect.value,
    outputLanguage: outputLanguage.value,
  });
  const cases = structuredImport?.cases?.length ? mergeTestCases(generatedCases, structuredImport.cases.map((testCase) => ({ ...testCase, module: featureInput.value.trim() }))).cases : generatedCases;
  const generationReport = buildGenerationReport({ requirement: requirementInput.value, coverage, requirementId, cases });
  if (profileSelect.value !== "none") generationReport.warnings.push("Draft dari profil reusable harus ditinjau dan disesuaikan QA sebelum quality gate dapat lulus.");
  if (structuredImport?.warnings?.length) generationReport.warnings.push(...structuredImport.warnings);
  const details = {
    featureName: featureInput.value.trim(),
    requirement: requirementInput.value.trim(),
    generationReport,
    createdAt: new Date().toISOString(),
    requirementLanguage: requirementLanguage.value,
    outputLanguage: outputLanguage.value,
  };
  const result = collection ? upsertFeature(collection, cases, details) : { collection: createCollection(cases, details) };

  const saveResult = saveActiveCollection(result.collection);
  if (!saveResult.sessionSaved) {
    storageError.textContent = "Koleksi tidak dapat disimpan di sesi browser ini. Jalankan Casecraft melalui server lokal lalu coba lagi.";
    storageError.hidden = false;
    setBusy(false);
    storageError.focus();
    return;
  }

  collection = result.collection;
  saveResult.permanentSave.catch(() => {});

  window.location.href = "./management.html";
});

requirementInput.addEventListener("input", () => {
  updateCharacterCount();
  if (requirementInput.getAttribute("aria-invalid") === "true") clearRequirementError();
});

featureInput.addEventListener("input", () => {
  if (featureInput.getAttribute("aria-invalid") === "true") clearFeatureError();
});

form.querySelectorAll('input[name="coverage"]').forEach((input) => {
  input.addEventListener("change", () => {
    coverageError.hidden = true;
    coverageError.textContent = "";
  });
});

document.querySelector("#fill-example").addEventListener("click", () => {
  featureInput.value = EXAMPLE_FEATURE;
  requirementInput.value = EXAMPLE_REQUIREMENT;
  updateCharacterCount();
  clearFeatureError();
  clearRequirementError();
  requirementInput.focus();
  showToast("Contoh Tabungan Driver dimasukkan.");
});

importSpecificationButton.addEventListener("click", () => specificationFile.click());
specificationFile.addEventListener("change", async () => {
  const [file] = specificationFile.files || [];
  specificationFile.value = "";
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    specificationFeedback.textContent = "File melebihi batas 5 MB.";
    specificationFeedback.dataset.tone = "error";
    specificationFeedback.hidden = false;
    return;
  }
  const parsed = importWithAdapter({ name: file.name, type: file.type, text: await file.text() });
  structuredImport = parsed.ok ? parsed : null;
  specificationFeedback.hidden = false;
  specificationFeedback.dataset.tone = parsed.ok ? "success" : "error";
  specificationFeedback.textContent = parsed.ok
    ? `${parsed.format}: ${parsed.cases.length} skenario terstruktur dibaca lokal.${parsed.warnings.length ? ` ${parsed.warnings.join(" ")}` : ""}`
    : parsed.warnings.join(" ");
  if (!parsed.ok) return;
  featureInput.value = parsed.featureName || featureInput.value;
  requirementInput.value = parsed.requirementText || requirementInput.value;
  updateCharacterCount();
  clearFeatureError();
  clearRequirementError();
  requirementInput.focus();
});

updateCharacterCount();
showExistingCollection();
initLocalization();
initPwa();
