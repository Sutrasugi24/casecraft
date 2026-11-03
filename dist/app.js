import { CATEGORY_LABELS, generateTestCases, toJiraCsv, toMarkdown } from "./generator.js";

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
const requirementInput = document.querySelector("#requirement");
const requirementError = document.querySelector("#requirement-error");
const coverageError = document.querySelector("#coverage-error");
const characterCount = document.querySelector("#character-count");
const generateButton = document.querySelector("#generate-button");
const buttonLabel = generateButton.querySelector(".button-label");
const emptyState = document.querySelector("#empty-state");
const results = document.querySelector("#results");
const exportActions = document.querySelector("#export-actions");
const tableBody = document.querySelector("#test-case-body");
const caseCount = document.querySelector("#case-count");
const coverageSummary = document.querySelector("#coverage-summary");
const coverageNote = document.querySelector("#coverage-note");
const copyNotion = document.querySelector("#copy-notion");
const downloadJira = document.querySelector("#download-jira");
const toast = document.querySelector("#toast");
const filterButtons = [...document.querySelectorAll(".filter-chip")];

let generatedCases = [];
let activeFilter = "all";
let toastTimer;

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

function validateForm() {
  let valid = true;
  const value = requirementInput.value.trim();

  clearRequirementError();
  coverageError.hidden = true;
  coverageError.textContent = "";

  if (!value) {
    requirementInput.setAttribute("aria-invalid", "true");
    requirementError.textContent = "Requirement wajib diisi agar test case dapat dibuat.";
    requirementError.hidden = false;
    requirementInput.focus();
    valid = false;
  } else if (value.length < 30) {
    requirementInput.setAttribute("aria-invalid", "true");
    requirementError.textContent = "Tambahkan detail requirement hingga sedikitnya 30 karakter.";
    requirementError.hidden = false;
    requirementInput.focus();
    valid = false;
  } else if (!selectedCoverage().length) {
    coverageError.textContent = "Pilih sedikitnya satu jenis cakupan pengujian.";
    coverageError.hidden = false;
    form.querySelector('input[name="coverage"]').focus();
    valid = false;
  }

  return valid;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTable() {
  const visibleCases = activeFilter === "all"
    ? generatedCases
    : generatedCases.filter((testCase) => testCase.category === activeFilter);

  if (!visibleCases.length) {
    tableBody.innerHTML = `<tr class="no-filter-results"><td colspan="7">Tidak ada test case untuk kategori ini.</td></tr>`;
    return;
  }

  tableBody.innerHTML = visibleCases.map((testCase) => `
    <tr data-category="${testCase.category}">
      <td>
        <span class="case-id">${escapeHtml(testCase.id)}</span>
        <span class="category-badge" data-category="${testCase.category}">${escapeHtml(testCase.categoryLabel)}</span>
      </td>
      <td>${escapeHtml(testCase.module)}</td>
      <td><span class="scenario-title">${escapeHtml(testCase.scenario)}</span></td>
      <td><ol class="steps-list">${testCase.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></td>
      <td><span class="expected-result">${escapeHtml(testCase.expected)}</span></td>
      <td><span class="empty-cell">Kosong</span></td>
      <td><span class="status-placeholder">Belum diuji</span></td>
    </tr>
  `).join("");
}

function renderCoverage() {
  const counts = Object.keys(CATEGORY_LABELS).reduce((summary, category) => {
    summary[category] = generatedCases.filter((testCase) => testCase.category === category).length;
    return summary;
  }, {});

  coverageSummary.innerHTML = Object.entries(CATEGORY_LABELS).map(([category, label]) => `
    <div class="coverage-item" data-category="${category}">
      <span class="coverage-marker" aria-hidden="true"></span>
      <span><strong>${counts[category]}</strong><small>${escapeHtml(label)}</small></span>
    </div>
  `).join("");

  const missing = Object.entries(counts).filter(([, count]) => count === 0).map(([category]) => CATEGORY_LABELS[category]);
  coverageNote.textContent = missing.length
    ? `Belum dicakup: ${missing.join(", ")}. Aktifkan kategori tersebut lalu buat ulang.`
    : "Empat sudut coverage sudah terwakili. Tinjau detail bisnis sebelum eksekusi.";
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  generateButton.setAttribute("aria-busy", String(isBusy));
  buttonLabel.textContent = isBusy ? "Menganalisis requirement" : "Buat test case";
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temporary = document.createElement("textarea");
  temporary.value = text;
  temporary.setAttribute("readonly", "");
  temporary.style.position = "fixed";
  temporary.style.opacity = "0";
  document.body.appendChild(temporary);
  temporary.select();
  document.execCommand("copy");
  temporary.remove();
}

function safeFilename(value) {
  return (value || "test-cases")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "test-cases";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  setBusy(true);

  await new Promise((resolve) => window.setTimeout(resolve, 420));

  generatedCases = generateTestCases({
    featureName: featureInput.value,
    requirement: requirementInput.value,
    coverage: selectedCoverage(),
  });

  activeFilter = "all";
  filterButtons.forEach((button) => {
    const active = button.dataset.filter === "all";
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  caseCount.textContent = generatedCases.length.toLocaleString("id-ID");
  renderCoverage();
  renderTable();
  emptyState.hidden = true;
  results.hidden = false;
  exportActions.hidden = false;
  setBusy(false);

  results.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  showToast(`${generatedCases.length} test case berhasil dibuat.`);
});

requirementInput.addEventListener("input", () => {
  updateCharacterCount();
  if (requirementInput.getAttribute("aria-invalid") === "true") clearRequirementError();
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
  clearRequirementError();
  requirementInput.focus();
  showToast("Contoh Tabungan Driver dimasukkan.");
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderTable();
  });
});

copyNotion.addEventListener("click", async () => {
  try {
    await copyText(toMarkdown(generatedCases));
    showToast("Tabel Markdown disalin. Tempel langsung ke Notion.");
  } catch {
    showToast("Tabel belum dapat disalin. Coba lagi atau gunakan unduhan CSV.");
  }
});

downloadJira.addEventListener("click", () => {
  const blob = new Blob([toJiraCsv(generatedCases)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(featureInput.value)}-jira.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("CSV Jira berhasil diunduh.");
});

updateCharacterCount();
