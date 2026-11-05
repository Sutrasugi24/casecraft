import {
  addRequirementToFeature,
  applyRequirementVersion,
  bulkUpdateExecutionStatus,
  createExecutionCycle,
  createManualTestCase,
  duplicateTestCase,
  executionHistory,
  nextRequirementId,
  parseProject,
  removeTestCase,
  renameFeature,
  restoreTestCase,
  selectExecutionCycle,
  serializeProject,
  setFeatureArchived,
  updateExecutionResult,
} from "./collection-store.js";
import { analyzeRequirement, buildGenerationReport, CATEGORY_LABELS, generateTestCases, mergeTestCases } from "./generator.js";
import { DEFAULT_STATUS_MAPPING, EXPORT_COLUMNS, EXPORT_TEMPLATES } from "./export-config.js";
import { loadBestCollection, permanentStorageEnabled, saveActiveCollection, setPermanentStorage } from "./persistent-store.js";
import { compareRequirementVersions, normalizeParameterSets, normalizeRisk, runQualityGate } from "./analysis-tools.js";
import { exportWithAdapter, importWithAdapter, listAdapters } from "./adapter-registry.js";
import { compareTestRuns } from "./run-comparison.js";
import { buildQaReport, renderQaReportHtml } from "./qa-report.js";
import { collaborationCapabilities } from "./collaboration-provider.js";
import { initLocalization, interfaceLanguage } from "./localization.js";
import { initPwa } from "./pwa.js";
import { assessAutomationReadiness, automationCoverage, generateAutomationSkeleton, normalizeAutomation } from "./automation-tools.js";
import { generatePairwise, parsePairwiseFactors } from "./pairwise.js";
import { applyAutomationResults } from "./automation-results.js";
import { suggestRegressionCases } from "./change-analysis.js";
import { buildDependencyGraph } from "./dependency-graph.js";
import { exportFixture, generateSyntheticDataset, maskSensitiveData, parseFieldDefinitions } from "./test-data-studio.js";
import { analyzeFlakyTests } from "./flaky-analysis.js";
import { buildAccessibilityPlan, buildFuzzPlan, buildLocalizationTestPlan, buildMigrationTestPlan, buildMobileDeviceMatrix, buildModelTestPlan, buildPerformanceDraft, buildSecurityCatalogue, buildVisualRegressionPlan } from "./advanced-test-design.js";

const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const QA_STATUSES = ["Belum diuji", "Lulus", "Gagal", "Terblokir"];
const REJECT_STATUSES = ["Tidak ditolak", "Ditolak"];
const TEST_TYPE_LABELS = {
  happy: "Positif",
  negative: "Negatif",
  edge: "HYBRID",
  regression: "HYBRID",
};

const noCollection = document.querySelector("#no-collection");
const managementContent = document.querySelector("#management-content");
const exportActions = document.querySelector("#export-actions");
const navCaseCount = document.querySelector("#nav-case-count");
const featureList = document.querySelector("#feature-list");
const featureCount = document.querySelector("#feature-count");
const activeFeatureName = document.querySelector("#active-feature-name");
const activeFeatureCaseCount = document.querySelector("#active-feature-case-count");
const suiteFeatureName = document.querySelector("#suite-feature-name");
const coverageDisclosure = document.querySelector("#coverage-disclosure");
const form = document.querySelector("#add-form");
const requirementInput = document.querySelector("#requirement");
const requirementError = document.querySelector("#requirement-error");
const coverageError = document.querySelector("#coverage-error");
const characterCount = document.querySelector("#character-count");
const addButton = document.querySelector("#add-button");
const buttonLabel = addButton.querySelector(".button-label");
const storageError = document.querySelector("#storage-error");
const saveStatus = document.querySelector("#save-status");
const collectionUpdate = document.querySelector("#collection-update");
const tableBody = document.querySelector("#test-case-body");
const caseCount = document.querySelector("#case-count");
const visibleCount = document.querySelector("#visible-count");
const coverageSummary = document.querySelector("#coverage-summary");
const coverageNote = document.querySelector("#coverage-note");
const searchInput = document.querySelector("#case-search");
const clearSearch = document.querySelector("#clear-search");
const categoryFilter = document.querySelector("#category-filter");
const priorityFilter = document.querySelector("#priority-filter");
const statusFilter = document.querySelector("#status-filter");
const rejectFilter = document.querySelector("#reject-filter");
const tagFilter = document.querySelector("#tag-filter");
const resetFiltersButton = document.querySelector("#reset-filters");
const inspectorEmpty = document.querySelector("#inspector-empty");
const inspectorContent = document.querySelector("#inspector-content");
const selectedCaseId = document.querySelector("#selected-case-id");
const selectedCaseCategory = document.querySelector("#selected-case-category");
const selectedCaseTitle = document.querySelector("#selected-case-title");
const createManualButton = document.querySelector("#create-manual");
const inspectorActions = document.querySelector("#inspector-actions");
const editCaseButton = document.querySelector("#edit-case");
const duplicateCaseButton = document.querySelector("#duplicate-case");
const deleteCaseButton = document.querySelector("#delete-case");
const executionFields = document.querySelector("#execution-fields");
const casePriority = document.querySelector("#case-priority");
const caseQaStatus = document.querySelector("#case-qa-status");
const caseRejectStatus = document.querySelector("#case-reject-status");
const casePrecondition = document.querySelector("#case-precondition");
const caseSteps = document.querySelector("#case-steps");
const caseTestData = document.querySelector("#case-test-data");
const caseExpected = document.querySelector("#case-expected");
const caseSpecView = document.querySelector("#case-spec-view");
const caseActual = document.querySelector("#case-actual");
const caseDefectReference = document.querySelector("#case-defect-reference");
const caseBlocker = document.querySelector("#case-blocker");
const actualField = document.querySelector("#actual-field");
const caseEditor = document.querySelector("#case-editor");
const editorIntro = document.querySelector("#editor-intro");
const editorCategory = document.querySelector("#editor-category");
const editorTags = document.querySelector("#editor-tags");
const editorParameters = document.querySelector("#editor-parameters");
const riskImpact = document.querySelector("#risk-impact");
const riskProbability = document.querySelector("#risk-probability");
const riskComplexity = document.querySelector("#risk-complexity");
const riskRegression = document.querySelector("#risk-regression");
const editorCriteriaOptions = document.querySelector("#editor-criteria-options");
const editorScenario = document.querySelector("#editor-scenario");
const editorPrecondition = document.querySelector("#editor-precondition");
const editorSteps = document.querySelector("#editor-steps");
const editorTestData = document.querySelector("#editor-test-data");
const editorExpected = document.querySelector("#editor-expected");
const editorFormError = document.querySelector("#editor-form-error");
const cancelEditorButton = document.querySelector("#cancel-editor");
const saveEditorButton = document.querySelector("#save-editor");
const configureExportButton = document.querySelector("#configure-export");
const toast = document.querySelector("#toast");
const toastMessage = document.querySelector("#toast-message");
const toastAction = document.querySelector("#toast-action");
const confirmDialog = document.querySelector("#confirm-dialog");
const confirmTitle = document.querySelector("#confirm-title");
const confirmDescription = document.querySelector("#confirm-description");
const confirmCancel = document.querySelector("#confirm-cancel");
const confirmAction = document.querySelector("#confirm-action");
const importProjectButton = document.querySelector("#import-project");
const projectFileInput = document.querySelector("#project-file");
const importFeedback = document.querySelector("#import-feedback");
const exportProjectButton = document.querySelector("#export-project");
const permanentStorageInput = document.querySelector("#permanent-storage");
const persistenceStatus = document.querySelector("#persistence-status");
const cycleSelect = document.querySelector("#cycle-select");
const cycleMeta = document.querySelector("#cycle-meta");
const createCycleButton = document.querySelector("#create-cycle");
const cycleDialog = document.querySelector("#cycle-dialog");
const cycleForm = document.querySelector("#cycle-form");
const cycleName = document.querySelector("#cycle-name");
const cycleNameError = document.querySelector("#cycle-name-error");
const cycleBuild = document.querySelector("#cycle-build");
const cycleEnvironment = document.querySelector("#cycle-environment");
const cycleBrowser = document.querySelector("#cycle-browser");
const cycleDevice = document.querySelector("#cycle-device");
const cycleCancel = document.querySelector("#cycle-cancel");
const traceabilitySummary = document.querySelector("#traceability-summary");
const traceabilityList = document.querySelector("#traceability-list");
const generationWarnings = document.querySelector("#generation-warnings");
const selectedCaseCriteria = document.querySelector("#selected-case-criteria");
const historyList = document.querySelector("#history-list");
const historyCount = document.querySelector("#history-count");
const executionHistoryPanel = document.querySelector(".execution-history");
const selectedCaseImpact = document.querySelector("#selected-case-impact");
const parameterSection = document.querySelector("#parameter-section");
const parameterBody = document.querySelector("#parameter-body");
const parameterCount = document.querySelector("#parameter-count");
const riskScore = document.querySelector("#risk-score");
const riskDetail = document.querySelector("#risk-detail");
const archiveDisclosure = document.querySelector("#archive-disclosure");
const archiveCount = document.querySelector("#archive-count");
const archiveList = document.querySelector("#archive-list");
const renameSuiteButton = document.querySelector("#rename-suite");
const archiveSuiteButton = document.querySelector("#archive-suite");
const renameDialog = document.querySelector("#rename-dialog");
const renameForm = document.querySelector("#rename-form");
const renameInput = document.querySelector("#rename-input");
const renameError = document.querySelector("#rename-error");
const renameCancel = document.querySelector("#rename-cancel");
const selectVisible = document.querySelector("#select-visible");
const bulkBar = document.querySelector("#bulk-bar");
const bulkCount = document.querySelector("#bulk-count");
const bulkStatus = document.querySelector("#bulk-status");
const applyBulk = document.querySelector("#apply-bulk");
const clearSelection = document.querySelector("#clear-selection");
const issueSummaryList = document.querySelector("#issue-summary-list");
const exportDialog = document.querySelector("#export-dialog");
const exportForm = document.querySelector("#export-form");
const exportClose = document.querySelector("#export-close");
const exportTemplate = document.querySelector("#export-template");
const exportOutputLanguage = document.querySelector("#export-output-language");
const exportDelimiter = document.querySelector("#export-delimiter");
const exportColumnOptions = document.querySelector("#export-column-options");
const exportPreview = document.querySelector("#export-preview");
const exportError = document.querySelector("#export-error");
const copyExportButton = document.querySelector("#copy-export");
const downloadExportButton = document.querySelector("#download-export");
const qualityGateSummary = document.querySelector("#quality-gate-summary");
const qualityGateList = document.querySelector("#quality-gate-list");
const qualityOverride = document.querySelector("#quality-override");
const versionRequirementButton = document.querySelector("#version-requirement");
const versionDialog = document.querySelector("#version-dialog");
const versionForm = document.querySelector("#version-form");
const versionClose = document.querySelector("#version-close");
const versionRequirementSelect = document.querySelector("#version-requirement-select");
const versionText = document.querySelector("#version-text");
const versionError = document.querySelector("#version-error");
const versionPreview = document.querySelector("#version-preview");
const applyVersionButton = document.querySelector("#apply-version");
const compareRunsButton = document.querySelector("#compare-runs");
const compareDialog = document.querySelector("#compare-dialog");
const compareClose = document.querySelector("#compare-close");
const compareBaseline = document.querySelector("#compare-baseline");
const compareTarget = document.querySelector("#compare-target");
const comparisonResult = document.querySelector("#comparison-result");
const openReportButton = document.querySelector("#open-report");
const reportDialog = document.querySelector("#report-dialog");
const reportClose = document.querySelector("#report-close");
const reportCycle = document.querySelector("#report-cycle");
const reportBaseline = document.querySelector("#report-baseline");
const reportLanguage = document.querySelector("#report-language");
const reportPreview = document.querySelector("#report-preview");
const downloadReportButton = document.querySelector("#download-report");
const printReportButton = document.querySelector("#print-report");
const collaborationStatus = document.querySelector("#collaboration-status");
const automationCoverageSummary = document.querySelector("#automation-coverage-summary");
const importAutomationButton = document.querySelector("#import-automation");
const automationReportFile = document.querySelector("#automation-report-file");
const automationReportDialog = document.querySelector("#automation-report-dialog");
const automationReportForm = document.querySelector("#automation-report-form");
const automationReportClose = document.querySelector("#automation-report-close");
const automationReportCycle = document.querySelector("#automation-report-cycle");
const automationReportPreview = document.querySelector("#automation-report-preview");
const applyAutomationReportButton = document.querySelector("#apply-automation-report");
const analyzeDiffButton = document.querySelector("#analyze-diff");
const gitDiffFile = document.querySelector("#git-diff-file");
const diffDialog = document.querySelector("#diff-dialog");
const diffClose = document.querySelector("#diff-close");
const diffPreview = document.querySelector("#diff-preview");
const openDependencyGraphButton = document.querySelector("#open-dependency-graph");
const dependencyDialog = document.querySelector("#dependency-dialog");
const dependencyClose = document.querySelector("#dependency-close");
const dependencySummary = document.querySelector("#dependency-summary");
const dependencyGraph = document.querySelector("#dependency-graph");
const automationReadinessScore = document.querySelector("#automation-readiness-score");
const automationCard = document.querySelector("#automation-card");
const automationReadinessLabel = document.querySelector("#automation-readiness-label");
const automationReadinessList = document.querySelector("#automation-readiness-list");
const automationLifecycle = document.querySelector("#automation-lifecycle");
const automationReview = document.querySelector("#automation-review");
const automationSelector = document.querySelector("#automation-selector");
const automationCleanup = document.querySelector("#automation-cleanup");
const openSkeletonButton = document.querySelector("#open-skeleton");
const skeletonDialog = document.querySelector("#skeleton-dialog");
const skeletonClose = document.querySelector("#skeleton-close");
const skeletonFramework = document.querySelector("#skeleton-framework");
const skeletonWarning = document.querySelector("#skeleton-warning");
const skeletonPreview = document.querySelector("#skeleton-preview");
const copySkeletonButton = document.querySelector("#copy-skeleton");
const downloadSkeletonButton = document.querySelector("#download-skeleton");
const pairwiseFactors = document.querySelector("#pairwise-factors");
const generatePairwiseButton = document.querySelector("#generate-pairwise");
const pairwiseFeedback = document.querySelector("#pairwise-feedback");
const openTestDataButton = document.querySelector("#open-test-data");
const testDataDialog = document.querySelector("#test-data-dialog");
const testDataForm = document.querySelector("#test-data-form");
const testDataClose = document.querySelector("#test-data-close");
const testDataMode = document.querySelector("#test-data-mode");
const syntheticDataFields = document.querySelector("#synthetic-data-fields");
const maskDataFields = document.querySelector("#mask-data-fields");
const testDataDefinitions = document.querySelector("#test-data-definitions");
const testDataCount = document.querySelector("#test-data-count");
const testDataSeed = document.querySelector("#test-data-seed");
const testDataBoundaries = document.querySelector("#test-data-boundaries");
const testDataSource = document.querySelector("#test-data-source");
const testDataMaskFields = document.querySelector("#test-data-mask-fields");
const testDataError = document.querySelector("#test-data-error");
const testDataPreview = document.querySelector("#test-data-preview");
const downloadFixtureJson = document.querySelector("#download-fixture-json");
const downloadFixtureCsv = document.querySelector("#download-fixture-csv");
const openFlakyAnalysisButton = document.querySelector("#open-flaky-analysis");
const flakyDialog = document.querySelector("#flaky-dialog");
const flakyClose = document.querySelector("#flaky-close");
const flakySummary = document.querySelector("#flaky-summary");
const flakyBody = document.querySelector("#flaky-body");
const openDesignLabButton = document.querySelector("#open-design-lab");
const designLabDialog = document.querySelector("#design-lab-dialog");
const designLabForm = document.querySelector("#design-lab-form");
const designLabClose = document.querySelector("#design-lab-close");
const designLabMode = document.querySelector("#design-lab-mode");
const designLabPanels = [...document.querySelectorAll("[data-design-panel]")];
const designLabError = document.querySelector("#design-lab-error");
const designLabWarning = document.querySelector("#design-lab-warning");
const designLabPreview = document.querySelector("#design-lab-preview");
const copyDesignPlan = document.querySelector("#copy-design-plan");
const downloadDesignPlan = document.querySelector("#download-design-plan");
const visualBaselines = document.querySelector("#visual-baselines");
const visualFileStatus = document.querySelector("#visual-file-status");

let collection = await loadBestCollection();
let selectedCaseKey = "";
let recentAddedIds = new Set();
let toastTimer;
let saveTimer;
let searchComposing = false;
let editorMode = "";
let editorDirty = false;
let pendingDialogAction = null;
let dialogTrigger = null;
let undoDeletion = null;
let selectedCaseIds = new Set();
let sortState = { key: "id", direction: "asc" };
let exportResult = null;
let pendingVersionAnalysis = null;
let reportHtml = "";
let pendingAutomationReport = null;
let automationSkeleton = null;
let fixtureRecords = [];
let designPlanResult = null;
let validBaselineFiles = [];

const collaboration = collaborationCapabilities();
collaborationStatus.textContent = `${collaboration.providers.length} provider remote · jaringan ${collaboration.networkEnabled ? "aktif" : "nonaktif"}`;

permanentStorageInput.checked = permanentStorageEnabled();
persistenceStatus.textContent = permanentStorageInput.checked
  ? "Penyimpanan permanen aktif di perangkat ini."
  : "Saat ini proyek hanya disimpan selama sesi tab.";

function activeFeature() {
  return collection?.features.find((feature) => feature.id === collection.activeFeatureId && !feature.archived)
    || collection?.features.find((feature) => !feature.archived)
    || null;
}

function activeTestCase() {
  return activeFeature()?.cases.find((testCase) => testCase.id === selectedCaseKey) || null;
}

function includeCasesInActiveCycle(feature, caseIds = []) {
  const cycle = feature.cycles.find((item) => item.id === feature.activeCycleId);
  if (!cycle) return;
  cycle.caseIds = [...new Set([...(cycle.caseIds || Object.keys(cycle.results || {})), ...caseIds])];
}

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
  const value = requirementInput.value.trim();
  clearRequirementError();
  coverageError.hidden = true;
  coverageError.textContent = "";

  if (!value) {
    requirementInput.setAttribute("aria-invalid", "true");
    requirementError.textContent = "Requirement tambahan wajib diisi.";
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
  addButton.disabled = isBusy;
  addButton.setAttribute("aria-busy", String(isBusy));
  buttonLabel.textContent = isBusy ? "Mencari skenario baru" : "Tambahkan yang belum ada";
}

function showToast(message, action = null) {
  window.clearTimeout(toastTimer);
  toastMessage.textContent = message;
  toastAction.hidden = !action;
  toastAction.textContent = action?.label || "";
  toastAction.onclick = action?.handler || null;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
    toastAction.onclick = null;
  }, action ? 6000 : 3200);
}

function openConfirmDialog({ title, description, actionLabel, intent = "danger", onConfirm, trigger }) {
  confirmTitle.textContent = title;
  confirmDescription.textContent = description;
  confirmAction.textContent = actionLabel;
  confirmAction.className = intent === "danger" ? "danger-button danger-button-solid" : "primary-button";
  pendingDialogAction = onConfirm;
  dialogTrigger = trigger || document.activeElement;
  confirmDialog.showModal();
  confirmCancel.focus();
}

function closeConfirmDialog() {
  confirmDialog.close();
  pendingDialogAction = null;
  const target = dialogTrigger;
  dialogTrigger = null;
  if (target?.isConnected) target.focus({ preventScroll: true });
}

function showStorageError() {
  coverageDisclosure.open = true;
  storageError.textContent = "Perubahan belum dapat disimpan di sesi browser. Jalankan Casecraft melalui server lokal lalu coba lagi.";
  storageError.hidden = false;
  storageError.focus();
}

function persistCollection(message = "Perubahan tersimpan otomatis di sesi browser.") {
  const saveResult = saveActiveCollection(collection);
  if (!saveResult.sessionSaved) {
    showStorageError();
    return false;
  }
  saveResult.permanentSave.then((saved) => {
    if (permanentStorageEnabled() && !saved) persistenceStatus.textContent = "Penyimpanan permanen gagal; salinan sesi tetap tersedia.";
  });
  storageError.hidden = true;
  saveStatus.textContent = message;
  return true;
}

function statusCounts(cases) {
  return cases.reduce((summary, testCase) => {
    summary[testCase.qaStatus] = (summary[testCase.qaStatus] || 0) + 1;
    return summary;
  }, {});
}

function updateUrlState() {
  const url = new URL(window.location.href);
  const feature = activeFeature();
  const values = {
    feature: feature?.id || "",
    case: selectedCaseKey,
    q: searchInput.value.trim(),
    category: categoryFilter.value === "all" ? "" : categoryFilter.value,
    priority: priorityFilter.value === "all" ? "" : priorityFilter.value,
    status: statusFilter.value === "all" ? "" : statusFilter.value,
    reject: rejectFilter.value === "all" ? "" : rejectFilter.value,
    tag: tagFilter.value === "all" ? "" : tagFilter.value,
    sort: sortState.key === "id" && sortState.direction === "asc" ? "" : `${sortState.key}:${sortState.direction}`,
  };

  Object.entries(values).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  window.history.replaceState({}, "", url);
}

function renderFeatureList() {
  const activeFeatures = collection.features.filter((feature) => !feature.archived);
  const archivedFeatures = collection.features.filter((feature) => feature.archived);
  featureCount.textContent = `${activeFeatures.length.toLocaleString("id-ID")} fitur`;
  navCaseCount.textContent = activeFeatures.length.toLocaleString("id-ID");
  navCaseCount.hidden = false;
  const featureButtons = activeFeatures.map((feature) => {
    const counts = statusCounts(feature.cases);
    const completed = (counts.Lulus || 0) + (counts.Gagal || 0) + (counts.Terblokir || 0);
    const active = feature.id === collection.activeFeatureId;
    const button = document.createElement("button");
    const label = document.createElement("span");
    const name = document.createElement("strong");
    const total = document.createElement("small");
    const progress = document.createElement("span");

    button.className = `feature-item${active ? " is-active" : ""}`;
    button.type = "button";
    button.dataset.featureId = feature.id;
    if (active) button.setAttribute("aria-current", "true");
    name.textContent = feature.name;
    total.textContent = `${feature.cases.length.toLocaleString("id-ID")} test case`;
    progress.className = "feature-progress";
    progress.setAttribute("aria-label", `${completed} dari ${feature.cases.length} sudah diuji`);
    progress.textContent = `${completed}/${feature.cases.length}`;
    label.append(name, total);
    button.append(label, progress);
    return button;
  });
  featureList.replaceChildren(...featureButtons);
  archiveDisclosure.hidden = !archivedFeatures.length;
  archiveCount.textContent = archivedFeatures.length.toLocaleString("id-ID");
  archiveList.replaceChildren(...archivedFeatures.map((feature) => {
    const item = document.createElement("div");
    const label = document.createElement("span");
    const restore = document.createElement("button");
    label.textContent = `${feature.name} · ${feature.cases.length} test case`;
    restore.type = "button";
    restore.className = "text-button";
    restore.dataset.restoreFeature = feature.id;
    restore.textContent = "Pulihkan";
    item.append(label, restore);
    return item;
  }));
}

function renderExecutionSummary() {
  const feature = activeFeature();
  const counts = statusCounts(feature.cases);
  document.querySelector("#summary-total").textContent = feature.cases.length.toLocaleString("id-ID");
  document.querySelector("#summary-passed").textContent = (counts.Lulus || 0).toLocaleString("id-ID");
  document.querySelector("#summary-failed").textContent = (counts.Gagal || 0).toLocaleString("id-ID");
  document.querySelector("#summary-blocked").textContent = (counts.Terblokir || 0).toLocaleString("id-ID");
  document.querySelector("#summary-untested").textContent = (counts["Belum diuji"] || 0).toLocaleString("id-ID");
  const issues = feature.cases.filter((testCase) => ["Gagal", "Terblokir"].includes(testCase.qaStatus));
  issueSummaryList.replaceChildren(...(issues.length ? issues.map((testCase) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const status = document.createElement("span");
    const detail = document.createElement("small");
    button.type = "button";
    button.dataset.issueCase = testCase.id;
    button.textContent = `${testCase.id} · ${testCase.scenario}`;
    status.className = "status-label";
    status.dataset.status = testCase.qaStatus;
    status.textContent = testCase.qaStatus;
    detail.textContent = testCase.actual || (testCase.qaStatus === "Terblokir" ? "Blocker belum dicatat." : "Hasil gagal belum dicatat.");
    item.append(button, status, detail);
    return item;
  }) : (() => {
    const item = document.createElement("li");
    item.className = "issue-summary-empty";
    item.textContent = "Tidak ada kasus gagal atau terblokir pada siklus aktif.";
    return [item];
  })()));
}

function renderCoverage() {
  const feature = activeFeature();
  const counts = Object.keys(CATEGORY_LABELS).reduce((summary, category) => {
    summary[category] = feature.cases.filter((testCase) => testCase.category === category).length;
    return summary;
  }, {});

  const coverageItems = Object.entries(CATEGORY_LABELS).map(([category, label]) => {
    const item = document.createElement("div");
    const marker = document.createElement("span");
    const detail = document.createElement("span");
    const count = document.createElement("strong");
    const categoryLabel = document.createElement("small");

    item.className = "coverage-item";
    item.dataset.category = category;
    marker.className = "coverage-marker";
    marker.setAttribute("aria-hidden", "true");
    count.textContent = counts[category];
    categoryLabel.textContent = label;
    detail.append(count, categoryLabel);
    item.append(marker, detail);
    return item;
  });
  coverageSummary.replaceChildren(...coverageItems);
  const missing = Object.entries(counts).filter(([, count]) => count === 0).map(([category]) => CATEGORY_LABELS[category]);
  coverageNote.textContent = missing.length ? `Belum dicakup: ${missing.join(", ")}.` : "Empat sudut coverage terwakili. Tetap tinjau detail bisnis sebelum eksekusi.";
}

function renderAutomationCoverage() {
  const coverage = automationCoverage(activeFeature().cases);
  const labels = { manual: "Manual", candidate: "Kandidat", automated: "Automated", flaky: "Flaky", "not-suitable": "Tidak layak" };
  automationCoverageSummary.replaceChildren(...Object.entries(labels).map(([lifecycle, label]) => {
    const item = document.createElement("div");
    const name = document.createElement("span");
    const count = document.createElement("strong");
    item.dataset.lifecycle = lifecycle;
    name.textContent = label;
    count.textContent = String(coverage.counts[lifecycle]);
    item.append(name, count);
    return item;
  }));
}

function featureCriteria(feature = activeFeature()) {
  return (feature.requirements || []).flatMap((requirement) => (requirement.criteria || []).map((criterion) => ({ ...criterion, requirementId: requirement.id, requirementVersion: requirement.currentVersion || 1 })));
}

function renderTraceability() {
  const feature = activeFeature();
  const criteria = featureCriteria(feature);
  const items = criteria.map((criterion) => {
    const linkedCases = feature.cases.filter((testCase) => (testCase.criterionIds || []).includes(criterion.id));
    const categories = new Set(linkedCases.map((testCase) => testCase.category));
    const status = criterion.ambiguous ? "ambiguous" : !linkedCases.length ? "uncovered" : categories.size === 1 && categories.has("happy") ? "happy-only" : "covered";
    return { criterion, linkedCases, status };
  });
  const coveredCount = items.filter((item) => item.linkedCases.length > 0).length;
  traceabilitySummary.textContent = `${coveredCount}/${items.length}`;
  traceabilitySummary.setAttribute("aria-label", `${coveredCount} dari ${items.length} acceptance criterion memiliki test case`);

  const nodes = items.map(({ criterion, linkedCases, status }) => {
    const item = document.createElement("article");
    const heading = document.createElement("div");
    const id = document.createElement("strong");
    const badge = document.createElement("span");
    const text = document.createElement("p");
    const cases = document.createElement("div");
    const labels = { covered: "Tercakup", uncovered: "Belum tercakup", ambiguous: "Ambigu", "happy-only": "Happy path saja" };
    item.className = "traceability-item";
    item.dataset.traceStatus = status;
    heading.className = "traceability-item-heading";
    id.textContent = `${criterion.id} · v${criterion.requirementVersion}`;
    badge.className = "trace-status";
    badge.textContent = labels[status];
    heading.append(id, badge);
    text.textContent = criterion.text;
    cases.className = "trace-case-links";
    if (linkedCases.length) {
      linkedCases.forEach((testCase) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.traceCase = testCase.id;
        button.textContent = `${testCase.id} · ${CATEGORY_LABELS[testCase.category]}`;
        cases.append(button);
      });
    } else {
      const empty = document.createElement("small");
      empty.textContent = criterion.ambiguous ? `Perjelas: ${(criterion.issues || []).join("; ")}.` : "Belum ada test case yang menguji kriteria ini.";
      cases.append(empty);
    }
    item.append(heading, text, cases);
    return item;
  });
  traceabilityList.replaceChildren(...nodes);

  const warnings = (feature.requirements || []).flatMap((requirement) => requirement.warnings || []);
  generationWarnings.replaceChildren();
  if (warnings.length) {
    const title = document.createElement("strong");
    const list = document.createElement("ul");
    title.textContent = "Informasi belum cukup";
    warnings.forEach((warning) => {
      const item = document.createElement("li");
      item.textContent = warning;
      list.append(item);
    });
    generationWarnings.append(title, list);
  }
  generationWarnings.hidden = !warnings.length;
}

function renderCycles() {
  const feature = activeFeature();
  const options = feature.cycles.map((cycle) => {
    const option = document.createElement("option");
    option.value = cycle.id;
    option.textContent = `${cycle.name}${cycle.buildVersion ? ` · ${cycle.buildVersion}` : ""}`;
    return option;
  });
  cycleSelect.replaceChildren(...options);
  cycleSelect.value = feature.activeCycleId;
  const cycle = feature.cycles.find((item) => item.id === feature.activeCycleId);
  const cycleIndex = feature.cycles.findIndex((item) => item.id === feature.activeCycleId);
  const previousCycle = cycleIndex > 0 ? feature.cycles[cycleIndex - 1] : null;
  const failedCount = Object.values(cycle.results).filter((result) => result.qaStatus === "Gagal").length;
  const previousFailed = previousCycle ? Object.values(previousCycle.results).filter((result) => result.qaStatus === "Gagal").length : null;
  const trend = previousFailed === null
    ? `${failedCount} gagal`
    : `${failedCount} gagal · ${failedCount === previousFailed ? "tetap" : failedCount < previousFailed ? `turun ${previousFailed - failedCount}` : `naik ${failedCount - previousFailed}`} dari siklus sebelumnya`;
  const context = [cycle.environment, cycle.browser, cycle.device].filter(Boolean).join(" · ");
  cycleMeta.textContent = `${context || "Konteks belum diisi"} · ${trend}.`;
  compareRunsButton.disabled = feature.cycles.length < 2;
  if (feature.cycles.length < 2) cycleMeta.textContent += " Buat cycle kedua untuk mengaktifkan perbandingan run.";
}

function renderExecutionHistory(testCase) {
  if (!testCase) {
    historyList.replaceChildren();
    historyCount.textContent = "";
    return;
  }
  const history = executionHistory(activeFeature(), testCase.id);
  historyCount.textContent = `${history.length} siklus`;
  const items = history.map((entry) => {
    const item = document.createElement("li");
    const heading = document.createElement("div");
    const name = document.createElement("strong");
    const status = document.createElement("span");
    const meta = document.createElement("p");
    const actual = document.createElement("p");
    name.textContent = `${entry.name}${entry.active ? " · aktif" : ""}`;
    status.className = "status-label";
    status.dataset.status = entry.result.qaStatus;
    status.textContent = entry.result.qaStatus;
    heading.append(name, status);
    const timestamp = new Date(entry.createdAt || "");
    const date = entry.createdAt && !Number.isNaN(timestamp.getTime())
      ? `${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(timestamp)} WIB`
      : "";
    meta.textContent = [date, entry.buildVersion && `Build ${entry.buildVersion}`, entry.environment, entry.browser, entry.device].filter(Boolean).join(" · ") || "Konteks belum diisi";
    actual.textContent = [entry.result.actual || "Belum ada hasil aktual.", entry.result.defectReference && `Defect: ${entry.result.defectReference}`, entry.result.blocker && `Blocker: ${entry.result.blocker}`].filter(Boolean).join(" · ");
    item.append(heading, meta, actual);
    return item;
  });
  historyList.replaceChildren(...items);
}

function visibleCases() {
  const query = searchInput.value.trim().toLocaleLowerCase("id-ID");
  const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return activeFeature().cases.filter((testCase) => {
    const searchMatches = !query || `${testCase.id} ${testCase.scenario} ${(testCase.tags || []).join(" ")}`.toLocaleLowerCase("id-ID").includes(query);
    const categoryMatches = categoryFilter.value === "all" || testCase.category === categoryFilter.value;
    const priorityMatches = priorityFilter.value === "all" || testCase.priority === priorityFilter.value;
    const statusMatches = statusFilter.value === "all" || testCase.qaStatus === statusFilter.value;
    const rejectMatches = rejectFilter.value === "all" || testCase.rejectStatus === rejectFilter.value;
    const tagMatches = tagFilter.value === "all" || (testCase.tags || []).includes(tagFilter.value);
    return searchMatches && categoryMatches && priorityMatches && statusMatches && rejectMatches && tagMatches;
  }).sort((first, second) => {
    const firstValue = sortState.key === "priority" ? priorityOrder[first.priority] ?? 9 : sortState.key === "riskScore" ? first.risk?.score || 0 : sortState.key === "automationStatus" ? automationCoverage([first]).entries[0].lifecycle : String(first[sortState.key] || "");
    const secondValue = sortState.key === "priority" ? priorityOrder[second.priority] ?? 9 : sortState.key === "riskScore" ? second.risk?.score || 0 : sortState.key === "automationStatus" ? automationCoverage([second]).entries[0].lifecycle : String(second[sortState.key] || "");
    const result = typeof firstValue === "number" ? firstValue - secondValue : firstValue.localeCompare(secondValue, "id-ID", { numeric: true });
    return sortState.direction === "asc" ? result : -result;
  });
}

function hasActiveFilters() {
  return Boolean(searchInput.value.trim()) || categoryFilter.value !== "all" || priorityFilter.value !== "all" || statusFilter.value !== "all" || rejectFilter.value !== "all" || tagFilter.value !== "all";
}

function renderTagFilter() {
  const current = tagFilter.value;
  const tags = [...new Set(activeFeature().cases.flatMap((testCase) => testCase.tags || []))].sort((a, b) => a.localeCompare(b, "id-ID"));
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Semua tag";
  tagFilter.replaceChildren(all, ...tags.map((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    option.textContent = tag;
    return option;
  }));
  tagFilter.value = tags.includes(current) ? current : "all";
}

function renderSortHeaders() {
  document.querySelectorAll("[data-sort-column]").forEach((header) => {
    const active = header.dataset.sortColumn === sortState.key;
    header.setAttribute("aria-sort", active ? (sortState.direction === "asc" ? "ascending" : "descending") : "none");
    const icon = header.querySelector(".sort-button span");
    if (icon) icon.textContent = active ? (sortState.direction === "asc" ? "↑" : "↓") : "↕";
  });
}

function renderBulkBar(cases = visibleCases()) {
  const visibleIds = cases.map((testCase) => testCase.id);
  const selectedVisible = visibleIds.filter((id) => selectedCaseIds.has(id));
  bulkBar.hidden = !selectedCaseIds.size;
  bulkCount.textContent = `${selectedCaseIds.size.toLocaleString("id-ID")} dipilih`;
  selectVisible.checked = Boolean(visibleIds.length) && selectedVisible.length === visibleIds.length;
  selectVisible.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visibleIds.length;
}

function ensureSelection(cases) {
  if (editorMode && activeTestCase()) return;
  if (!cases.some((testCase) => testCase.id === selectedCaseKey)) selectedCaseKey = cases[0]?.id || "";
}

function renderTable() {
  const cases = visibleCases();
  ensureSelection(cases);
  clearSearch.hidden = !searchInput.value;
  resetFiltersButton.hidden = !hasActiveFilters();
  visibleCount.textContent = hasActiveFilters()
    ? `${cases.length.toLocaleString("id-ID")} dari ${activeFeature().cases.length.toLocaleString("id-ID")} test case`
    : `${cases.length.toLocaleString("id-ID")} test case`;

  if (!cases.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    const title = document.createElement("strong");
    const guidance = document.createElement("span");
    const resetButton = document.createElement("button");
    row.className = "no-filter-results";
    cell.colSpan = 8;
    const suiteEmpty = activeFeature().cases.length === 0;
    title.textContent = suiteEmpty ? "Belum ada test case yang dapat dibuat." : "Tidak ada test case yang cocok.";
    guidance.textContent = suiteEmpty
      ? "Tinjau peringatan pada traceability map, lalu tambahkan detail requirement yang belum cukup."
      : "Ubah kata kunci atau filter untuk melihat hasil lain.";
    resetButton.className = "text-button";
    resetButton.type = "button";
    resetButton.dataset.resetFilters = "";
    resetButton.textContent = "Reset filter";
    cell.append(title, guidance);
    if (!suiteEmpty) cell.append(resetButton);
    row.append(cell);
    tableBody.replaceChildren(row);
    renderSortHeaders();
    renderBulkBar(cases);
    renderInspector();
    updateUrlState();
    return;
  }

  const rows = cases.map((testCase) => {
    const selected = testCase.id === selectedCaseKey;
    const row = document.createElement("tr");
    const cells = Array.from({ length: 8 }, () => document.createElement("td"));
    const selection = document.createElement("input");
    const id = document.createElement("span");
    const openButton = document.createElement("button");
    const scenario = document.createElement("span");
    const category = document.createElement("span");
    const priority = document.createElement("span");
    const risk = document.createElement("span");
    const status = document.createElement("span");
    const automationStatus = document.createElement("span");

    row.dataset.caseId = testCase.id;
    row.dataset.category = testCase.category;
    selection.type = "checkbox";
    selection.className = "case-select";
    selection.dataset.selectCase = testCase.id;
    selection.checked = selectedCaseIds.has(testCase.id);
    selection.setAttribute("aria-label", `Pilih ${testCase.id}`);
    if (selected) row.className = "is-selected";
    id.className = "repository-case-id";
    id.textContent = testCase.id;
    openButton.className = "case-open";
    openButton.type = "button";
    openButton.dataset.openCase = testCase.id;
    if (selected) openButton.setAttribute("aria-current", "true");
    scenario.textContent = testCase.scenario;
    openButton.append(scenario);
    if (recentAddedIds.has(testCase.id)) {
      const newBadge = document.createElement("small");
      newBadge.className = "new-case-badge";
      newBadge.textContent = "Baru";
      openButton.append(newBadge);
    }
    category.className = "category-badge";
    category.dataset.category = testCase.category;
    category.textContent = testCase.testType;
    priority.className = "priority-label";
    priority.dataset.priority = testCase.priority;
    priority.textContent = testCase.priority;
    risk.className = "risk-label";
    risk.dataset.level = testCase.risk?.level || "Sedang";
    risk.textContent = `${testCase.risk?.score || 60} · ${testCase.risk?.level || "Sedang"}`;
    status.className = "status-label";
    status.dataset.status = testCase.qaStatus;
    status.textContent = testCase.qaStatus;
    const lifecycle = automationCoverage([testCase]).entries[0].lifecycle;
    const automationLabels = { manual: "Manual", candidate: "Kandidat", automated: "Automated", flaky: "Flaky", "not-suitable": "Tidak layak" };
    automationStatus.className = "automation-label";
    automationStatus.dataset.lifecycle = lifecycle;
    automationStatus.textContent = automationLabels[lifecycle];
    cells[0].className = "selection-cell";
    cells[0].append(selection);
    cells[1].append(id);
    cells[2].append(openButton);
    cells[3].append(category);
    cells[4].append(priority);
    cells[5].append(risk);
    cells[6].append(status);
    cells[7].append(automationStatus);
    row.append(...cells);
    return row;
  });
  tableBody.replaceChildren(...rows);
  renderSortHeaders();
  renderBulkBar(cases);
  renderInspector();
  updateUrlState();
}

function renderInspector() {
  const testCase = activeTestCase();
  const showingEditor = Boolean(editorMode);
  inspectorEmpty.hidden = Boolean(testCase) || showingEditor;
  inspectorContent.hidden = !testCase && !showingEditor;
  if (!testCase && !showingEditor) return;

  const editorCategoryValue = editorCategory.value || "happy";
  selectedCaseId.textContent = editorMode === "create" ? "DRAFT MANUAL" : testCase.id;
  selectedCaseCategory.textContent = editorMode === "create"
    ? CATEGORY_LABELS[editorCategoryValue]
    : testCase.categoryLabel || CATEGORY_LABELS[testCase.category] || testCase.testType;
  selectedCaseCategory.dataset.category = editorMode === "create" ? editorCategoryValue : testCase.category || "";
  selectedCaseTitle.textContent = editorMode === "create" ? "Test case manual baru" : testCase.scenario;
  selectedCaseCriteria.hidden = showingEditor;

  inspectorActions.hidden = showingEditor;
  executionFields.hidden = showingEditor;
  caseSpecView.hidden = showingEditor;
  automationCard.hidden = showingEditor;
  actualField.hidden = showingEditor;
  caseEditor.hidden = !showingEditor;
  saveStatus.hidden = showingEditor;
  executionHistoryPanel.hidden = showingEditor;

  if (showingEditor || !testCase) return;

  const criterionText = (testCase.criterionIds || []).length
    ? `Menguji: ${testCase.criterionIds.join(", ")}`
    : "Belum ditautkan ke acceptance criterion.";
  const tagText = (testCase.tags || []).length ? ` · Tag: ${testCase.tags.join(", ")}` : "";
  selectedCaseCriteria.textContent = `${criterionText}${tagText}`;
  selectedCaseImpact.hidden = !testCase.requirementImpact;
  if (testCase.requirementImpact) {
    selectedCaseImpact.dataset.impact = testCase.requirementImpact.status;
    selectedCaseImpact.textContent = `${testCase.requirementImpact.label} · ${testCase.requirementImpact.reason}`;
  }

  casePriority.value = PRIORITIES.includes(testCase.priority) ? testCase.priority : "Medium";
  caseQaStatus.value = QA_STATUSES.includes(testCase.qaStatus) ? testCase.qaStatus : "Belum diuji";
  caseRejectStatus.value = REJECT_STATUSES.includes(testCase.rejectStatus) ? testCase.rejectStatus : "Tidak ditolak";
  casePrecondition.textContent = testCase.precondition || "Belum ada precondition.";
  caseSteps.replaceChildren(...(testCase.steps || []).map((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    return item;
  }));
  caseTestData.textContent = testCase.testData || "Belum ada data uji.";
  const parameterSets = normalizeParameterSets(testCase.parameterSets);
  parameterSection.hidden = !parameterSets.length;
  parameterCount.textContent = `${parameterSets.length} kombinasi`;
  parameterBody.replaceChildren(...parameterSets.map((set) => {
    const row = document.createElement("tr");
    [set.label, set.data, set.expected].forEach((value) => { const cell = document.createElement("td"); cell.textContent = value || "—"; row.append(cell); });
    return row;
  }));
  const risk = normalizeRisk(testCase.risk);
  riskScore.textContent = `${risk.score} · ${risk.level}`;
  riskScore.dataset.level = risk.level;
  riskDetail.textContent = `Dampak ${risk.impact}/5 · Probabilitas ${risk.probability}/5 · Kompleksitas ${risk.complexity}/5 · Regression ${risk.regression}/5`;
  caseExpected.textContent = testCase.expected || "Belum ada expected result.";
  const automation = normalizeAutomation(testCase.automation);
  const readiness = assessAutomationReadiness(testCase);
  automationReadinessScore.textContent = `${readiness.score}%`;
  automationReadinessScore.dataset.level = readiness.level;
  automationReadinessLabel.textContent = `${readiness.label}. Skor hanya menilai kelengkapan teknis, bukan menjamin kelayakan bisnis.`;
  automationReadinessList.replaceChildren(...readiness.checks.map((check) => {
    const item = document.createElement("li");
    item.dataset.passed = String(check.passed);
    item.textContent = `${check.passed ? "✓" : "○"} ${check.label}`;
    if (check.evidence) item.title = check.evidence;
    return item;
  }));
  automationLifecycle.value = automation.lifecycle;
  automationReview.value = automation.reviewStatus;
  automationSelector.value = automation.selector;
  automationCleanup.value = automation.cleanup;
  openSkeletonButton.disabled = automation.reviewStatus !== "approved";
  openSkeletonButton.title = openSkeletonButton.disabled ? "Setujui test case pada Review skeleton sebelum membuat draft." : "";
  caseActual.value = testCase.actual || "";
  caseDefectReference.value = testCase.defectReference || "";
  caseBlocker.value = testCase.blocker || "";
  renderExecutionHistory(testCase);
}

function clearEditorErrors() {
  editorFormError.hidden = true;
  editorFormError.textContent = "";
  [editorScenario, editorPrecondition, editorSteps, editorTestData, editorExpected].forEach((field) => {
    field.removeAttribute("aria-invalid");
    const error = document.querySelector(`#${field.id}-error`);
    error.hidden = true;
    error.textContent = "";
  });
}

function editorSpecification() {
  const parameterSets = editorParameters.value.split("\n").map((line, index) => {
    const [label = "", data = "", expected = ""] = line.split("|").map((value) => value.trim());
    return { id: `DATA-${String(index + 1).padStart(3, "0")}`, label, data, expected };
  }).filter((set) => set.label || set.data || set.expected);
  return {
    category: editorCategory.value,
    criterionIds: [...editorCriteriaOptions.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value),
    tags: [...new Set(editorTags.value.split(",").map((tag) => tag.trim()).filter(Boolean))],
    parameterSets,
    risk: normalizeRisk({ impact: riskImpact.value, probability: riskProbability.value, complexity: riskComplexity.value, regression: riskRegression.value }),
    scenario: editorScenario.value.trim(),
    precondition: editorPrecondition.value.trim(),
    steps: editorSteps.value.split("\n").map((step) => step.replace(/^\s*\d+[.)-]?\s*/, "").trim()).filter(Boolean),
    testData: editorTestData.value.trim(),
    expected: editorExpected.value.trim(),
  };
}

function renderEditorCriteria(selectedIds = []) {
  const selected = new Set(selectedIds);
  const options = featureCriteria().map((criterion) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const content = document.createElement("span");
    const id = document.createElement("strong");
    const text = document.createElement("small");
    input.type = "checkbox";
    input.value = criterion.id;
    input.checked = selected.has(criterion.id);
    id.textContent = criterion.id;
    text.textContent = criterion.text;
    content.append(id, text);
    label.append(input, content);
    return label;
  });
  editorCriteriaOptions.replaceChildren(...options);
}

function validateEditor() {
  clearEditorErrors();
  const fields = [
    [editorScenario, "Skenario uji wajib diisi."],
    [editorPrecondition, "Precondition wajib diisi agar kondisi awal dapat ditinjau."],
    [editorSteps, "Tambahkan sedikitnya satu langkah uji."],
    [editorTestData, "Data uji wajib diisi agar kasus dapat dieksekusi."],
    [editorExpected, "Expected result wajib diisi agar hasil dapat dinilai."],
  ];
  const invalid = fields.find(([field]) => !field.value.trim());

  if (!invalid) return true;
  const [field, message] = invalid;
  field.setAttribute("aria-invalid", "true");
  const error = document.querySelector(`#${field.id}-error`);
  error.textContent = message;
  error.hidden = false;
  editorFormError.textContent = "Lengkapi field yang ditandai sebelum menyimpan.";
  editorFormError.hidden = false;
  field.focus();
  return false;
}

function beginEditor(mode) {
  const testCase = activeTestCase();
  if (mode === "edit" && !testCase) return;
  editorMode = mode;
  editorDirty = false;
  clearEditorErrors();
  editorCategory.value = mode === "edit" ? testCase.category : "happy";
  editorTags.value = mode === "edit" ? (testCase.tags || []).join(", ") : "";
  editorParameters.value = mode === "edit" ? normalizeParameterSets(testCase.parameterSets).map((set) => `${set.label} | ${set.data} | ${set.expected}`).join("\n") : "";
  const risk = normalizeRisk(mode === "edit" ? testCase.risk : {});
  riskImpact.value = String(risk.impact);
  riskProbability.value = String(risk.probability);
  riskComplexity.value = String(risk.complexity);
  riskRegression.value = String(risk.regression);
  renderEditorCriteria(mode === "edit" ? testCase.criterionIds || [] : []);
  editorScenario.value = mode === "edit" ? testCase.scenario : "";
  editorPrecondition.value = mode === "edit" ? testCase.precondition || "" : "";
  editorSteps.value = mode === "edit" ? (testCase.steps || []).join("\n") : "";
  editorTestData.value = mode === "edit" ? testCase.testData || "" : "";
  editorExpected.value = mode === "edit" ? testCase.expected || "" : "";
  editorIntro.textContent = mode === "edit"
    ? `Edit spesifikasi ${testCase.id}. Status eksekusi dan hasil aktual tetap disimpan terpisah.`
    : `Tambahkan kasus di suite ${activeFeature().name}. ID dibuat otomatis dan kasus langsung tersedia untuk review.`;
  saveEditorButton.querySelector(".button-label").textContent = mode === "edit" ? "Simpan perubahan" : "Buat test case";
  renderInspector();
  editorScenario.focus();
}

function cancelEditor({ focus = true } = {}) {
  editorMode = "";
  editorDirty = false;
  clearEditorErrors();
  renderInspector();
  if (focus) (activeTestCase() ? selectedCaseTitle : createManualButton).focus({ preventScroll: true });
}

function withEditorGuard(action, trigger) {
  if (!editorMode || !editorDirty) {
    if (editorMode) cancelEditor({ focus: false });
    action();
    return;
  }
  openConfirmDialog({
    title: "Buang perubahan yang belum disimpan?",
    description: "Perubahan pada form editor belum tersimpan di sesi browser. Anda dapat tetap mengedit atau membuang perubahan ini.",
    actionLabel: "Buang perubahan",
    onConfirm: () => {
      cancelEditor({ focus: false });
      action();
    },
    trigger,
  });
}

function renderFeature() {
  const feature = activeFeature();
  activeFeatureName.textContent = feature.name;
  activeFeatureCaseCount.textContent = `${feature.cases.length.toLocaleString("id-ID")} test case dalam suite ini`;
  suiteFeatureName.textContent = feature.name;
  caseCount.textContent = feature.cases.length.toLocaleString("id-ID");
  document.title = `${feature.name} — Manajemen Test Case — Casecraft`;
  renderFeatureList();
  renderCycles();
  renderExecutionSummary();
  renderCoverage();
  renderAutomationCoverage();
  renderTraceability();
  renderTagFilter();
  renderTable();
}

function resetFilters({ focus = false } = {}) {
  searchInput.value = "";
  categoryFilter.value = "all";
  priorityFilter.value = "all";
  statusFilter.value = "all";
  rejectFilter.value = "all";
  tagFilter.value = "all";
  renderTable();
  if (focus) searchInput.focus();
}

function selectFeature(featureId, { focusHeading = true } = {}) {
  if (!collection.features.some((feature) => feature.id === featureId)) return;
  collection.activeFeatureId = featureId;
  selectedCaseKey = "";
  selectedCaseIds.clear();
  recentAddedIds = new Set();
  collectionUpdate.textContent = "";
  renderFeature();
  persistCollection(`Suite ${activeFeature().name} dipilih.`);
  if (focusHeading) document.querySelector("#suite-title").focus({ preventScroll: true });
}

function updateSelectedCase(field, value) {
  const testCase = activeTestCase();
  if (!testCase) return;
  if (["qaStatus", "rejectStatus", "actual"].includes(field)) updateExecutionResult(activeFeature(), testCase.id, { [field]: value });
  else testCase[field] = value;
  persistCollection(`${testCase.id} diperbarui di suite ${activeFeature().name}.`);
  renderExecutionSummary();
  renderFeatureList();
  renderTable();
}

function duplicateSelectedCase() {
  const feature = activeFeature();
  const testCase = activeTestCase();
  if (!feature || !testCase) return;
  const duplicate = duplicateTestCase(feature, testCase);
  const sourceIndex = feature.cases.findIndex((item) => item.id === testCase.id);
  feature.cases.splice(sourceIndex + 1, 0, duplicate);
  includeCasesInActiveCycle(feature, [duplicate.id]);
  selectedCaseKey = duplicate.id;
  recentAddedIds = new Set([duplicate.id]);
  persistCollection(`${duplicate.id} dibuat sebagai salinan ${testCase.id}.`);
  renderFeature();
  selectedCaseTitle.focus({ preventScroll: true });
  showToast(`${duplicate.id} diduplikasi. Status eksekusi direset agar siap ditinjau.`);
}

function deleteSelectedCase() {
  const feature = activeFeature();
  const testCase = activeTestCase();
  if (!feature || !testCase) return;
  const deletedIndex = feature.cases.findIndex((item) => item.id === testCase.id);

  openConfirmDialog({
    title: `Hapus ${testCase.id}?`,
    description: feature.cases.length === 1
      ? `“${testCase.scenario}” adalah test case terakhir di suite ${feature.name}. Requirement dan traceability map tetap disimpan agar coverage yang kosong dapat ditinjau.`
      : `“${testCase.scenario}” akan dihapus dari suite ${feature.name}. Anda dapat memulihkannya dari notifikasi setelah penghapusan.`,
    actionLabel: "Hapus test case",
    onConfirm: () => {
      const removed = removeTestCase(feature, testCase.id);
      if (!removed) return;
      undoDeletion = { featureId: feature.id, index: removed.index, testCase: removed.testCase, feature };

      const nextCase = activeFeature()?.cases[Math.min(deletedIndex, (activeFeature()?.cases.length || 1) - 1)];
      selectedCaseKey = nextCase?.id || "";
      persistCollection(`${testCase.id} dihapus dari suite ${feature.name}.`);

      renderFeature();

      showToast(`${testCase.id} dihapus dari ${feature.name}.`, {
        label: "Urungkan",
        handler: () => {
          const snapshot = undoDeletion;
          if (!snapshot) return;
          const targetFeature = collection.features.find((item) => item.id === snapshot.featureId) || snapshot.feature;
          restoreTestCase(targetFeature, snapshot.testCase, snapshot.index);
          collection.activeFeatureId = targetFeature.id;
          selectedCaseKey = snapshot.testCase.id;
          undoDeletion = null;
          noCollection.hidden = true;
          managementContent.hidden = false;
          exportActions.hidden = false;
          persistCollection(`${snapshot.testCase.id} dipulihkan ke suite ${targetFeature.name}.`);
          renderFeature();
          showToast(`${snapshot.testCase.id} berhasil dipulihkan.`);
          selectedCaseTitle.focus({ preventScroll: true });
        },
      });

      const focusTarget = document.querySelector(`[data-open-case="${CSS.escape(selectedCaseKey)}"]`) || createManualButton;
      focusTarget?.focus({ preventScroll: true });
    },
    trigger: deleteCaseButton,
  });
}

function safeFilename(value) {
  return (value || "test-case").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "test-case";
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

if (!collection?.features.length) {
  noCollection.hidden = false;
} else {
  const parameters = new URLSearchParams(window.location.search);
  const requestedFeature = parameters.get("feature");
  if (requestedFeature && collection.features.some((feature) => feature.id === requestedFeature)) collection.activeFeatureId = requestedFeature;
  searchInput.value = parameters.get("q") || "";
  if (["happy", "negative", "edge", "regression"].includes(parameters.get("category"))) categoryFilter.value = parameters.get("category");
  if (PRIORITIES.includes(parameters.get("priority"))) priorityFilter.value = parameters.get("priority");
  if (QA_STATUSES.includes(parameters.get("status"))) statusFilter.value = parameters.get("status");
  if (REJECT_STATUSES.includes(parameters.get("reject"))) rejectFilter.value = parameters.get("reject");
  const requestedSort = String(parameters.get("sort") || "").split(":");
  if (["id", "scenario", "categoryLabel", "priority", "riskScore", "qaStatus", "automationStatus"].includes(requestedSort[0]) && ["asc", "desc"].includes(requestedSort[1])) {
    sortState = { key: requestedSort[0], direction: requestedSort[1] };
  }
  selectedCaseKey = parameters.get("case") || "";
  managementContent.hidden = false;
  exportActions.hidden = false;
  renderFeature();
  if ([...tagFilter.options].some((option) => option.value === parameters.get("tag"))) {
    tagFilter.value = parameters.get("tag");
    renderTable();
  }
}

featureList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-feature-id]");
  if (!button || button.dataset.featureId === collection.activeFeatureId) return;
  withEditorGuard(() => selectFeature(button.dataset.featureId), button);
});

archiveList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-restore-feature]");
  if (!button) return;
  const feature = collection.features.find((item) => item.id === button.dataset.restoreFeature);
  if (!feature) return;
  setFeatureArchived(feature, false);
  collection.activeFeatureId = feature.id;
  selectedCaseKey = "";
  selectedCaseIds.clear();
  persistCollection(`Suite ${feature.name} dipulihkan dari arsip.`);
  renderFeature();
  showToast(`Suite ${feature.name} kembali aktif.`);
  document.querySelector("#suite-title").focus({ preventScroll: true });
});

renameSuiteButton.addEventListener("click", () => withEditorGuard(() => {
  renameInput.value = activeFeature().name;
  renameError.hidden = true;
  renameInput.removeAttribute("aria-invalid");
  renameDialog.showModal();
  renameInput.select();
}, renameSuiteButton));
renameCancel.addEventListener("click", () => renameDialog.close());
renameDialog.addEventListener("cancel", (event) => { event.preventDefault(); renameDialog.close(); renameSuiteButton.focus({ preventScroll: true }); });
renameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextName = renameInput.value.trim();
  const duplicate = collection.features.some((feature) => feature.id !== activeFeature().id && feature.name.toLocaleLowerCase("id-ID") === nextName.toLocaleLowerCase("id-ID"));
  if (!nextName || duplicate) {
    renameInput.setAttribute("aria-invalid", "true");
    renameError.textContent = duplicate ? "Nama tersebut sudah dipakai suite lain." : "Nama suite wajib diisi.";
    renameError.hidden = false;
    renameInput.focus();
    return;
  }
  const previousName = activeFeature().name;
  renameFeature(activeFeature(), nextName);
  renameDialog.close();
  persistCollection(`Suite ${previousName} diubah menjadi ${nextName}.`);
  renderFeature();
  showToast(`Nama suite diperbarui menjadi ${nextName}.`);
  document.querySelector("#suite-title").focus({ preventScroll: true });
});

archiveSuiteButton.addEventListener("click", () => withEditorGuard(() => {
  const activeSuites = collection.features.filter((feature) => !feature.archived);
  if (activeSuites.length === 1) {
    showToast("Suite terakhir tidak dapat diarsipkan. Tambahkan atau pulihkan suite lain terlebih dahulu.");
    return;
  }
  const feature = activeFeature();
  openConfirmDialog({
    title: `Arsipkan suite ${feature.name}?`,
    description: "Suite disembunyikan dari repository aktif, tetapi test case, requirement, dan riwayatnya tetap tersimpan dan dapat dipulihkan.",
    actionLabel: "Arsipkan suite",
    onConfirm: () => {
      setFeatureArchived(feature, true);
      const next = collection.features.find((item) => !item.archived);
      collection.activeFeatureId = next.id;
      selectedCaseKey = "";
      selectedCaseIds.clear();
      persistCollection(`Suite ${feature.name} diarsipkan.`);
      renderFeature();
      showToast(`Suite ${feature.name} dipindahkan ke arsip.`);
      document.querySelector("#suite-title").focus({ preventScroll: true });
    },
    trigger: archiveSuiteButton,
  });
}, archiveSuiteButton));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feature = activeFeature();
  if (!feature || !validateForm()) return;
  setBusy(true);
  await new Promise((resolve) => window.setTimeout(resolve, 420));

  const requirementId = nextRequirementId(feature);
  const coverage = selectedCoverage();
  const incomingCases = generateTestCases({ featureName: feature.name, requirement: requirementInput.value, coverage, requirementId, outputLanguage: feature.outputLanguage || "id" });
  const generationReport = buildGenerationReport({ requirement: requirementInput.value, coverage, requirementId, cases: incomingCases });
  const merged = mergeTestCases(feature.cases, incomingCases);
  feature.cases = merged.cases;
  includeCasesInActiveCycle(feature, merged.added.map((testCase) => testCase.id));
  addRequirementToFeature(feature, generationReport, requirementInput.value.trim());
  recentAddedIds = new Set(merged.added.map((testCase) => testCase.id));
  selectedCaseKey = merged.added[0]?.id || selectedCaseKey;
  persistCollection();
  resetFilters();
  renderFeature();
  collectionUpdate.textContent = merged.added.length
    ? `${merged.added.length} baru ditambahkan · ${merged.duplicates.length} duplikat dilewati`
    : `${requirementId} tersimpan untuk ditinjau; tidak ada skenario baru yang cukup spesifik`;
  requirementInput.value = "";
  updateCharacterCount();
  setBusy(false);
  showToast(merged.added.length ? `${merged.added.length} test case baru ditambahkan ke ${feature.name}.` : `Tidak ada test case baru untuk ${feature.name}.`);
});

requirementInput.addEventListener("input", () => {
  updateCharacterCount();
  if (requirementInput.getAttribute("aria-invalid") === "true") clearRequirementError();
});

form.querySelectorAll('input[name="coverage"]').forEach((input) => input.addEventListener("change", () => {
  coverageError.hidden = true;
  coverageError.textContent = "";
}));

caseEditor.addEventListener("input", (event) => {
  editorDirty = true;
  const field = event.target.closest("textarea");
  if (!field || field.getAttribute("aria-invalid") !== "true") return;
  field.removeAttribute("aria-invalid");
  const error = document.querySelector(`#${field.id}-error`);
  error.hidden = true;
  error.textContent = "";
});

editorCategory.addEventListener("change", () => {
  editorDirty = true;
  selectedCaseCategory.textContent = CATEGORY_LABELS[editorCategory.value];
  selectedCaseCategory.dataset.category = editorCategory.value;
});

caseEditor.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validateEditor()) return;
  const feature = activeFeature();
  const specification = editorSpecification();
  const wasCreate = editorMode === "create";
  let savedCase;

  if (wasCreate) {
    savedCase = createManualTestCase(feature, specification);
    feature.cases.push(savedCase);
    includeCasesInActiveCycle(feature, [savedCase.id]);
    recentAddedIds = new Set([savedCase.id]);
    selectedCaseKey = savedCase.id;
  } else {
    savedCase = activeTestCase();
    Object.assign(savedCase, specification, {
      categoryLabel: CATEGORY_LABELS[specification.category],
      testType: TEST_TYPE_LABELS[specification.category],
      source: savedCase.source || specification.scenario,
      needsCustomization: false,
    });
  }

  editorMode = "";
  editorDirty = false;
  persistCollection(`${savedCase.id} tersimpan di suite ${feature.name}.`);
  if (!visibleCases().some((item) => item.id === savedCase.id)) {
    searchInput.value = "";
    categoryFilter.value = "all";
    priorityFilter.value = "all";
    statusFilter.value = "all";
    rejectFilter.value = "all";
    tagFilter.value = "all";
  }
  renderFeature();
  selectedCaseTitle.focus({ preventScroll: true });
  showToast(wasCreate ? `${savedCase.id} dibuat manual.` : `${savedCase.id} berhasil diperbarui.`);
});

createManualButton.addEventListener("click", () => withEditorGuard(() => beginEditor("create"), createManualButton));
editCaseButton.addEventListener("click", () => beginEditor("edit"));
duplicateCaseButton.addEventListener("click", duplicateSelectedCase);
deleteCaseButton.addEventListener("click", deleteSelectedCase);
cancelEditorButton.addEventListener("click", () => withEditorGuard(() => {}, cancelEditorButton));

searchInput.addEventListener("compositionstart", () => {
  searchComposing = true;
});

searchInput.addEventListener("compositionend", () => {
  searchComposing = false;
  renderTable();
});

searchInput.addEventListener("input", () => {
  if (!searchComposing) renderTable();
});

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  renderTable();
  searchInput.focus();
});

[categoryFilter, priorityFilter, statusFilter, rejectFilter, tagFilter].forEach((filter) => filter.addEventListener("change", renderTable));
resetFiltersButton.addEventListener("click", () => resetFilters({ focus: true }));

tableBody.addEventListener("click", (event) => {
  const resetButton = event.target.closest("[data-reset-filters]");
  if (resetButton) {
    resetFilters({ focus: true });
    return;
  }
  const caseButton = event.target.closest("[data-open-case]");
  if (!caseButton) return;
  withEditorGuard(() => {
    selectedCaseKey = caseButton.dataset.openCase;
    renderTable();
    selectedCaseTitle.focus({ preventScroll: true });
  }, caseButton);
});

tableBody.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-select-case]");
  if (!checkbox) return;
  if (checkbox.checked) selectedCaseIds.add(checkbox.dataset.selectCase);
  else selectedCaseIds.delete(checkbox.dataset.selectCase);
  renderBulkBar();
});

selectVisible.addEventListener("change", () => {
  visibleCases().forEach((testCase) => selectVisible.checked ? selectedCaseIds.add(testCase.id) : selectedCaseIds.delete(testCase.id));
  renderTable();
});

clearSelection.addEventListener("click", () => {
  selectedCaseIds.clear();
  renderTable();
  selectVisible.focus();
});

document.querySelector(".repository-table-frame thead").addEventListener("click", (event) => {
  const button = event.target.closest("[data-sort]");
  if (!button) return;
  const key = button.dataset.sort;
  sortState = sortState.key === key ? { key, direction: sortState.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" };
  renderTable();
});

applyBulk.addEventListener("click", () => {
  if (!selectedCaseIds.size) return;
  const count = selectedCaseIds.size;
  const nextStatus = bulkStatus.value;
  openConfirmDialog({
    title: `Ubah status ${count} test case?`,
    description: `Status QA pada siklus aktif akan diubah menjadi “${nextStatus}”. Riwayat siklus lain tidak ikut berubah.`,
    actionLabel: "Terapkan status",
    intent: "neutral",
    onConfirm: () => {
      const updated = bulkUpdateExecutionStatus(activeFeature(), [...selectedCaseIds], nextStatus);
      selectedCaseIds.clear();
      persistCollection(`${updated} test case diubah menjadi ${nextStatus}.`);
      renderFeature();
      showToast(`${updated} test case diperbarui pada siklus aktif.`);
    },
    trigger: applyBulk,
  });
});

issueSummaryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-issue-case]");
  if (!button) return;
  selectedCaseKey = button.dataset.issueCase;
  resetFilters();
  selectedCaseTitle.focus({ preventScroll: true });
});

casePriority.addEventListener("change", () => updateSelectedCase("priority", casePriority.value));
caseQaStatus.addEventListener("change", () => updateSelectedCase("qaStatus", caseQaStatus.value));
caseRejectStatus.addEventListener("change", () => updateSelectedCase("rejectStatus", caseRejectStatus.value));

function autosaveExecutionPatch(patch) {
  const testCase = activeTestCase();
  if (!testCase) return;
  updateExecutionResult(activeFeature(), testCase.id, patch);
  renderExecutionHistory(testCase);
  window.clearTimeout(saveTimer);
  saveStatus.textContent = `Menyimpan hasil ${testCase.id}…`;
  saveTimer = window.setTimeout(() => persistCollection(`${testCase.id} tersimpan di suite ${activeFeature().name}.`), 250);
}

caseActual.addEventListener("input", () => autosaveExecutionPatch({ actual: caseActual.value }));
caseDefectReference.addEventListener("input", () => autosaveExecutionPatch({ defectReference: caseDefectReference.value }));
caseBlocker.addEventListener("input", () => autosaveExecutionPatch({ blocker: caseBlocker.value }));

function updateAutomation(patch, message = "Metadata automation diperbarui.") {
  const testCase = activeTestCase();
  if (!testCase) return;
  testCase.automation = { ...normalizeAutomation(testCase.automation), ...patch };
  persistCollection(`${testCase.id} · ${message}`);
  renderAutomationCoverage();
  renderInspector();
}

automationLifecycle.addEventListener("change", () => updateAutomation({ lifecycle: automationLifecycle.value }, "status coverage automation diperbarui."));
automationReview.addEventListener("change", () => updateAutomation({ reviewStatus: automationReview.value }, "status review skeleton diperbarui."));
automationSelector.addEventListener("change", () => updateAutomation({ selector: automationSelector.value.trim() }, "selector atau target request disimpan."));
automationCleanup.addEventListener("change", () => updateAutomation({ cleanup: automationCleanup.value.trim() }, "cleanup disimpan."));

generatePairwiseButton.addEventListener("click", () => {
  const testCase = activeTestCase();
  if (!testCase) return;
  try {
    const factors = parsePairwiseFactors(pairwiseFactors.value);
    const combinations = generatePairwise(factors);
    testCase.parameterSets = combinations;
    pairwiseFeedback.textContent = `${combinations.length} kombinasi pairwise dibuat dari ${factors.length} faktor. Tinjau expected result sebelum eksekusi.`;
    persistCollection(`${testCase.id} menerima ${combinations.length} kombinasi pairwise.`);
    renderInspector();
  } catch (error) {
    pairwiseFeedback.textContent = error.message;
    pairwiseFactors.focus();
  }
});

function updateSkeletonPreview() {
  try {
    automationSkeleton = generateAutomationSkeleton(activeTestCase(), skeletonFramework.value);
    skeletonPreview.value = automationSkeleton.content;
    const missing = automationSkeleton.readiness.missing;
    skeletonWarning.hidden = !missing.length;
    skeletonWarning.textContent = missing.length ? `Draft masih memiliki informasi kosong: ${missing.join(", ")}. TODO dipertahankan agar detail bisnis tidak dikarang.` : "";
    copySkeletonButton.disabled = false;
    downloadSkeletonButton.disabled = false;
  } catch (error) {
    automationSkeleton = null;
    skeletonPreview.value = "";
    skeletonWarning.hidden = false;
    skeletonWarning.textContent = error.message;
    copySkeletonButton.disabled = true;
    downloadSkeletonButton.disabled = true;
  }
}

function recordSkeleton() {
  if (!automationSkeleton) return;
  const testCase = activeTestCase();
  const automation = normalizeAutomation(testCase.automation);
  if (!automation.scripts.some((script) => script.framework === automationSkeleton.framework && script.filename === automationSkeleton.filename)) {
    automation.scripts.push({ framework: automationSkeleton.framework, filename: automationSkeleton.filename, generatedAt: new Date().toISOString(), status: "draft" });
    testCase.automation = automation;
    persistCollection(`${testCase.id} · draft ${automationSkeleton.framework} dicatat pada peta dependensi.`);
  }
}

openSkeletonButton.addEventListener("click", () => {
  skeletonFramework.value = "playwright";
  updateSkeletonPreview();
  skeletonDialog.showModal();
  skeletonFramework.focus();
});
skeletonFramework.addEventListener("change", updateSkeletonPreview);
skeletonClose.addEventListener("click", () => { skeletonDialog.close(); openSkeletonButton.focus({ preventScroll: true }); });
skeletonDialog.addEventListener("cancel", (event) => { event.preventDefault(); skeletonDialog.close(); openSkeletonButton.focus({ preventScroll: true }); });
copySkeletonButton.addEventListener("click", async () => {
  if (!automationSkeleton) return;
  try { await copyText(automationSkeleton.content); recordSkeleton(); showToast("Draft automation berhasil disalin."); }
  catch { showToast("Draft belum dapat disalin. Gunakan unduhan file."); }
});
downloadSkeletonButton.addEventListener("click", () => {
  if (!automationSkeleton) return;
  const url = URL.createObjectURL(new Blob([automationSkeleton.content], { type: automationSkeleton.mime }));
  const link = document.createElement("a"); link.href = url; link.download = automationSkeleton.filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  recordSkeleton();
  showToast("Draft automation berhasil diunduh; code review tetap diperlukan.");
});

function renderAutomationReportPreview(report) {
  automationReportPreview.replaceChildren();
  const summary = document.createElement("p");
  summary.textContent = `${report.format} · ${report.entries.length} hasil dibaca · ${report.entries.filter((entry) => entry.caseId).length} memiliki Casecraft ID.`;
  const list = document.createElement("ul");
  report.entries.slice(0, 20).forEach((entry) => { const item = document.createElement("li"); item.textContent = `${entry.caseId || "Tanpa ID"} · ${entry.qaStatus}${entry.flaky ? " · flaky" : ""} · ${entry.title}`; list.append(item); });
  report.warnings.forEach((warning) => { const item = document.createElement("p"); item.className = "form-alert"; item.textContent = warning; automationReportPreview.append(item); });
  automationReportPreview.prepend(summary, list);
}

importAutomationButton.addEventListener("click", () => automationReportFile.click());
automationReportFile.addEventListener("change", async () => {
  const [file] = automationReportFile.files || [];
  automationReportFile.value = "";
  if (!file) return;
  if (!/\.(xml|json)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
    showToast("Pilih JUnit XML atau Playwright JSON berukuran maksimal 10 MB.");
    return;
  }
  pendingAutomationReport = importWithAdapter({ name: file.name, text: await file.text() }, "automation-report");
  automationReportCycle.replaceChildren(...activeFeature().cycles.map(cycleOption));
  automationReportCycle.value = activeFeature().activeCycleId;
  renderAutomationReportPreview(pendingAutomationReport);
  applyAutomationReportButton.disabled = !pendingAutomationReport.ok;
  automationReportDialog.showModal();
  automationReportCycle.focus();
});
automationReportClose.addEventListener("click", () => { automationReportDialog.close(); importAutomationButton.focus({ preventScroll: true }); });
automationReportDialog.addEventListener("cancel", (event) => { event.preventDefault(); automationReportDialog.close(); importAutomationButton.focus({ preventScroll: true }); });
automationReportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!pendingAutomationReport?.ok) return;
  const summary = applyAutomationResults(activeFeature(), automationReportCycle.value, pendingAutomationReport.entries);
  automationReportDialog.close();
  persistCollection(`${summary.matched} hasil automation diterapkan ke ${automationReportCycle.value}.`);
  renderFeature();
  showToast(`${summary.matched} hasil diterapkan · ${summary.unmatched} tidak cocok · ${summary.flaky} flaky.`);
});

function resetTestDataResult() {
  fixtureRecords = [];
  testDataPreview.value = "";
  testDataError.hidden = true;
  testDataError.textContent = "";
  downloadFixtureJson.disabled = true;
  downloadFixtureCsv.disabled = true;
}

function updateTestDataMode() {
  const masking = testDataMode.value === "mask";
  syntheticDataFields.hidden = masking;
  maskDataFields.hidden = !masking;
  resetTestDataResult();
}

function downloadFixture(format) {
  try {
    const result = exportFixture(fixtureRecords, format);
    const url = URL.createObjectURL(new Blob([result.content], { type: result.mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(activeFeature()?.name || "casecraft")}-fixture.${result.extension}`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Fixture ${format.toUpperCase()} berhasil diunduh.`);
  } catch (error) {
    testDataError.textContent = error.message;
    testDataError.hidden = false;
  }
}

openTestDataButton.addEventListener("click", () => {
  testDataMode.value = "synthetic";
  updateTestDataMode();
  testDataDialog.showModal();
  testDataMode.focus();
});
testDataMode.addEventListener("change", updateTestDataMode);
testDataClose.addEventListener("click", () => { testDataDialog.close(); openTestDataButton.focus({ preventScroll: true }); });
testDataDialog.addEventListener("cancel", (event) => { event.preventDefault(); testDataDialog.close(); openTestDataButton.focus({ preventScroll: true }); });
testDataForm.addEventListener("submit", (event) => {
  event.preventDefault();
  resetTestDataResult();
  try {
    if (testDataMode.value === "synthetic") {
      const fields = parseFieldDefinitions(testDataDefinitions.value);
      fixtureRecords = generateSyntheticDataset(fields, { count: testDataCount.value, seed: testDataSeed.value, includeBoundaries: testDataBoundaries.checked }).records;
    } else {
      const source = JSON.parse(testDataSource.value);
      const fields = testDataMaskFields.value.split(",").map((field) => field.trim()).filter(Boolean);
      const masked = maskSensitiveData(source, { fields });
      fixtureRecords = Array.isArray(masked) ? masked : [masked];
      if (!fixtureRecords.length) throw new TypeError("JSON tidak memiliki record untuk dimasking.");
    }
    testDataPreview.value = `${JSON.stringify(fixtureRecords.slice(0, 50), null, 2)}${fixtureRecords.length > 50 ? `\n\n… ${fixtureRecords.length - 50} record lain tidak ditampilkan di preview.` : ""}`;
    downloadFixtureJson.disabled = false;
    downloadFixtureCsv.disabled = false;
    testDataPreview.focus();
  } catch (error) {
    testDataError.textContent = testDataMode.value === "mask" && error instanceof SyntaxError ? "JSON masking tidak valid. Periksa koma, kutip, dan kurung." : error.message;
    testDataError.hidden = false;
    testDataError.focus();
  }
});
downloadFixtureJson.addEventListener("click", () => downloadFixture("json"));
downloadFixtureCsv.addEventListener("click", () => downloadFixture("csv"));

function resetDesignPlan() {
  designPlanResult = null;
  designLabPreview.value = "";
  designLabError.hidden = true;
  designLabError.textContent = "";
  designLabWarning.hidden = true;
  designLabWarning.textContent = "";
  copyDesignPlan.disabled = true;
  downloadDesignPlan.disabled = true;
}

function updateDesignLabMode() {
  designLabPanels.forEach((panel) => { panel.hidden = panel.dataset.designPanel !== designLabMode.value; });
  resetDesignPlan();
}

function validateBaselineFiles(fileList) {
  const files = [...(fileList || [])];
  const acceptedExtensions = [".png", ".jpg", ".jpeg", ".webp"];
  const errors = [];
  if (files.length > 20) errors.push(`Maksimal 20 file; ${files.length - 20} file terakhir diabaikan.`);
  validBaselineFiles = files.slice(0, 20).filter((file) => {
    const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (!acceptedExtensions.includes(extension)) { errors.push(`${file.name}: tipe file tidak didukung.`); return false; }
    if (!file.size) { errors.push(`${file.name}: file kosong.`); return false; }
    if (file.size > 5 * 1024 * 1024) { errors.push(`${file.name}: melebihi 5 MB.`); return false; }
    return true;
  });
  const validText = validBaselineFiles.length ? `${validBaselineFiles.length} baseline valid siap diproses.` : "Belum ada baseline valid dipilih.";
  visualFileStatus.textContent = errors.length ? `${validText} ${errors.join(" ")}` : validText;
}

async function baselineMetadata() {
  return Promise.all(validBaselineFiles.map(async (file) => {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return { name: file.name, size: file.size, type: file.type || "application/octet-stream", sha256 };
  }));
}

async function createDesignPlan() {
  if (designLabMode.value === "model") return buildModelTestPlan(document.querySelector("#model-source").value);
  if (designLabMode.value === "fuzz") return buildFuzzPlan({ rules: document.querySelector("#fuzz-rules").value, properties: document.querySelector("#fuzz-properties").value, runs: document.querySelector("#fuzz-runs").value, seed: document.querySelector("#fuzz-seed").value });
  if (designLabMode.value === "visual") return buildVisualRegressionPlan({ name: document.querySelector("#visual-name").value, pages: document.querySelector("#visual-pages").value, viewports: document.querySelector("#visual-viewports").value, themes: document.querySelector("#visual-themes").value, locales: document.querySelector("#visual-locales").value, allowedRegions: document.querySelector("#visual-regions").value, baselines: await baselineMetadata() });
  if (designLabMode.value === "accessibility") return buildAccessibilityPlan({ scope: document.querySelector("#accessibility-scope").value, patterns: [...designLabForm.querySelectorAll('input[name="a11y-pattern"]:checked')].map((input) => input.value) });
  if (designLabMode.value === "performance") return buildPerformanceDraft({ name: document.querySelector("#performance-name").value, format: document.querySelector("#performance-format").value, method: document.querySelector("#performance-method").value, path: document.querySelector("#performance-path").value, workload: document.querySelector("#performance-workload").value, concurrency: document.querySelector("#performance-concurrency").value, duration: document.querySelector("#performance-duration").value, rampUp: document.querySelector("#performance-ramp").value, dataVolume: document.querySelector("#performance-volume").value, p95: document.querySelector("#performance-p95").value, errorRate: document.querySelector("#performance-error").value, throughput: document.querySelector("#performance-throughput").value, body: document.querySelector("#performance-body").value, dataStrategy: document.querySelector("#performance-data").value });
  if (designLabMode.value === "security") return buildSecurityCatalogue({ scope: document.querySelector("#security-scope").value, authorization: document.querySelector("#security-authorization").value, sessions: document.querySelector("#security-session").value, injections: document.querySelector("#security-injection").value, exposures: document.querySelector("#security-exposure").value, rateLimits: document.querySelector("#security-rate").value, abuseCases: document.querySelector("#security-abuse").value });
  if (designLabMode.value === "mobile") return buildMobileDeviceMatrix({ devices: document.querySelector("#mobile-devices").value, orientations: document.querySelector("#mobile-orientations").value, networks: document.querySelector("#mobile-networks").value, keyboards: document.querySelector("#mobile-keyboards").value });
  if (designLabMode.value === "migration") return buildMigrationTestPlan({ name: document.querySelector("#migration-name").value, sourceVersions: document.querySelector("#migration-sources").value, targetVersion: document.querySelector("#migration-target").value, entities: document.querySelector("#migration-entities").value, compatibility: document.querySelector("#migration-compatibility").value, rollbacks: document.querySelector("#migration-rollbacks").value, reconciliations: document.querySelector("#migration-reconciliation").value });
  return buildLocalizationTestPlan({ name: document.querySelector("#localization-name").value, locales: document.querySelector("#localization-locales").value, instant: document.querySelector("#localization-instant").value, sampleNumber: document.querySelector("#localization-number").value, pluralCounts: document.querySelector("#localization-plurals").value, fallbackLocale: document.querySelector("#localization-fallback").value, surfaces: document.querySelector("#localization-surfaces").value, expansion: document.querySelector("#localization-expansion").value, mixedText: document.querySelector("#localization-mixed").value });
}

openDesignLabButton.addEventListener("click", () => {
  designLabMode.value = "model";
  updateDesignLabMode();
  designLabDialog.showModal();
  designLabMode.focus();
});
designLabMode.addEventListener("change", updateDesignLabMode);
visualBaselines.addEventListener("change", () => { validateBaselineFiles(visualBaselines.files); resetDesignPlan(); });
designLabClose.addEventListener("click", () => { designLabDialog.close(); openDesignLabButton.focus({ preventScroll: true }); });
designLabDialog.addEventListener("cancel", (event) => { event.preventDefault(); designLabDialog.close(); openDesignLabButton.focus({ preventScroll: true }); });
designLabForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resetDesignPlan();
  try {
    designPlanResult = await createDesignPlan();
    designLabPreview.value = designPlanResult.content;
    const warnings = designPlanResult.warnings || [];
    designLabWarning.textContent = warnings.length ? `Perlu ditinjau: ${warnings.join(" ")}` : "Rancangan lengkap berdasarkan kontrak yang tersedia.";
    designLabWarning.hidden = false;
    copyDesignPlan.disabled = false;
    downloadDesignPlan.disabled = false;
    designLabPreview.focus();
  } catch (error) {
    designLabError.textContent = error.message;
    designLabError.hidden = false;
    designLabError.focus();
  }
});
copyDesignPlan.addEventListener("click", async () => {
  if (!designPlanResult) return;
  try { await copyText(designPlanResult.content); showToast("Rancangan pengujian berhasil disalin."); }
  catch { showToast("Rancangan belum dapat disalin. Gunakan unduhan file."); }
});
downloadDesignPlan.addEventListener("click", () => {
  if (!designPlanResult) return;
  const url = URL.createObjectURL(new Blob([designPlanResult.content], { type: designPlanResult.mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(activeFeature()?.name || "casecraft")}-${designLabMode.value}.${designPlanResult.extension}`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Rancangan pengujian berhasil diunduh untuk ditinjau.");
});

function renderFlakyAnalysis() {
  const report = analyzeFlakyTests(activeFeature());
  flakySummary.textContent = `${report.summary.flaky} flaky · ${report.summary.environment} sinyal environment · ${report.summary.productSignals} sinyal defect produk · ${report.summary.inconclusive} belum konklusif`;
  flakyBody.replaceChildren();
  if (!report.attention.length) {
    const row = document.createElement("tr"); const cell = document.createElement("td");
    cell.colSpan = 5; cell.textContent = "Belum ada pola tidak stabil. Impor hasil automation atau jalankan beberapa test cycle untuk menambah evidence.";
    row.append(cell); flakyBody.append(row); return;
  }
  report.attention.forEach((item) => {
    const row = document.createElement("tr");
    const identity = document.createElement("td"); const classification = document.createElement("td"); const retries = document.createElement("td"); const environments = document.createElement("td"); const evidence = document.createElement("td");
    identity.textContent = `${item.caseId} · ${item.scenario}`;
    classification.textContent = `${item.classification.label} · confidence ${item.classification.confidence}`;
    retries.textContent = `${item.retries} retry · ${item.transitions} perubahan status`;
    environments.textContent = [...new Set(item.history.map((entry) => entry.environment))].join("; ") || "Belum dicatat";
    evidence.textContent = item.classification.reason;
    row.append(identity, classification, retries, environments, evidence);
    flakyBody.append(row);
  });
}

openFlakyAnalysisButton.addEventListener("click", () => {
  renderFlakyAnalysis();
  flakyDialog.showModal();
  flakyClose.focus();
});
flakyClose.addEventListener("click", () => { flakyDialog.close(); openFlakyAnalysisButton.focus({ preventScroll: true }); });
flakyDialog.addEventListener("cancel", (event) => { event.preventDefault(); flakyDialog.close(); openFlakyAnalysisButton.focus({ preventScroll: true }); });

analyzeDiffButton.addEventListener("click", () => gitDiffFile.click());
gitDiffFile.addEventListener("change", async () => {
  const [file] = gitDiffFile.files || [];
  gitDiffFile.value = "";
  if (!file) return;
  if (!/\.(diff|patch|txt)$/i.test(file.name) || file.size > 5 * 1024 * 1024) {
    showToast("Pilih file .diff, .patch, atau .txt berukuran maksimal 5 MB.");
    return;
  }
  const analysis = suggestRegressionCases(activeFeature(), await file.text());
  diffPreview.replaceChildren();
  const summary = document.createElement("p"); summary.textContent = `${analysis.diff.files.length} file berubah · ${analysis.suggestions.length} test case memiliki bukti kecocokan.`; diffPreview.append(summary);
  if (analysis.diff.files.length) { const paths = document.createElement("p"); paths.textContent = `Path: ${analysis.diff.files.join(", ")}`; diffPreview.append(paths); }
  analysis.suggestions.forEach((suggestion) => { const section = document.createElement("section"); const title = document.createElement("strong"); const reason = document.createElement("p"); title.textContent = `${suggestion.caseId} · skor dampak ${suggestion.score}`; reason.textContent = `${suggestion.scenario} · cocok pada: ${suggestion.matches.join(", ")}`; section.append(title, reason); diffPreview.append(section); });
  analysis.warnings.forEach((warning) => { const message = document.createElement("p"); message.className = "form-alert"; message.textContent = warning; diffPreview.append(message); });
  diffDialog.showModal();
  diffClose.focus();
});
diffClose.addEventListener("click", () => { diffDialog.close(); analyzeDiffButton.focus({ preventScroll: true }); });
diffDialog.addEventListener("cancel", (event) => { event.preventDefault(); diffDialog.close(); analyzeDiffButton.focus({ preventScroll: true }); });

openDependencyGraphButton.addEventListener("click", () => {
  const graph = buildDependencyGraph(activeFeature());
  const typeCounts = graph.nodes.reduce((counts, node) => ({ ...counts, [node.type]: (counts[node.type] || 0) + 1 }), {});
  dependencySummary.textContent = `${graph.nodes.length} node · ${graph.edges.length} relasi · ${Object.entries(typeCounts).map(([type, count]) => `${count} ${type}`).join(" · ")}`;
  dependencyGraph.replaceChildren(...graph.nodes.map((node) => {
    const item = document.createElement("div"); const label = document.createElement("strong"); const relation = document.createElement("small");
    item.className = "dependency-node"; item.dataset.type = node.type; item.setAttribute("role", "listitem"); label.textContent = node.label;
    const outgoing = graph.edges.filter((edge) => edge.from === node.id).length; const incoming = graph.edges.filter((edge) => edge.to === node.id).length;
    relation.textContent = `${node.type} · ${incoming} relasi masuk · ${outgoing} relasi keluar`;
    item.append(label, relation); return item;
  }));
  dependencyDialog.showModal();
  dependencyClose.focus();
});
dependencyClose.addEventListener("click", () => { dependencyDialog.close(); openDependencyGraphButton.focus({ preventScroll: true }); });
dependencyDialog.addEventListener("cancel", (event) => { event.preventDefault(); dependencyDialog.close(); openDependencyGraphButton.focus({ preventScroll: true }); });

function exportOptions() {
  return {
    template: exportTemplate.value,
    outputLanguage: exportOutputLanguage.value,
    columns: [...exportColumnOptions.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value),
    delimiter: exportDelimiter.value === "tab" ? "\t" : exportDelimiter.value,
    statusMapping: {
      "Belum diuji": document.querySelector("#map-untested").value.trim() || DEFAULT_STATUS_MAPPING["Belum diuji"],
      Lulus: document.querySelector("#map-passed").value.trim() || DEFAULT_STATUS_MAPPING.Lulus,
      Gagal: document.querySelector("#map-failed").value.trim() || DEFAULT_STATUS_MAPPING.Gagal,
      Terblokir: document.querySelector("#map-blocked").value.trim() || DEFAULT_STATUS_MAPPING.Terblokir,
    },
  };
}

function updateExportPreview() {
  const gate = runQualityGate(activeFeature());
  qualityGateSummary.textContent = gate.passed ? `${gate.warnings} peringatan · siap` : `${gate.errors} error · ${gate.warnings} peringatan`;
  qualityGateSummary.dataset.passed = String(gate.passed);
  qualityGateList.replaceChildren(...(gate.findings.length ? gate.findings.slice(0, 10).map((finding) => {
    const item = document.createElement("li");
    const severity = document.createElement("strong");
    const message = document.createElement("span");
    severity.textContent = finding.severity === "error" ? "Error" : "Peringatan";
    severity.dataset.severity = finding.severity;
    message.textContent = `${finding.reference ? `${finding.reference} · ` : ""}${finding.message}`;
    item.append(severity, message);
    return item;
  }) : (() => { const item = document.createElement("li"); item.textContent = "Tidak ada temuan quality gate."; return [item]; })()));
  if (gate.findings.length > 10) {
    const remaining = document.createElement("li");
    remaining.textContent = `${gate.findings.length - 10} temuan lain tidak ditampilkan di ringkasan.`;
    qualityGateList.append(remaining);
  }
  qualityOverride.closest("label").hidden = gate.passed;
  try {
    exportResult = exportWithAdapter(exportTemplate.value, activeFeature().cases, exportOptions());
    exportPreview.value = exportResult.content.slice(0, 10000);
    exportError.hidden = true;
    exportError.textContent = "";
    const blocked = !gate.passed && !qualityOverride.checked;
    copyExportButton.disabled = blocked;
    downloadExportButton.disabled = blocked;
  } catch (error) {
    exportResult = null;
    exportPreview.value = "";
    exportError.textContent = error.message;
    exportError.hidden = false;
    copyExportButton.disabled = true;
    downloadExportButton.disabled = true;
  }
}

function applyExportTemplate() {
  const template = EXPORT_TEMPLATES[exportTemplate.value];
  exportColumnOptions.querySelectorAll('input[type="checkbox"]').forEach((input) => { input.checked = template.columns.includes(input.value); });
  exportDelimiter.value = template.delimiter === "\t" ? "tab" : (template.delimiter || ",");
  exportDelimiter.disabled = ["markdown", "tsv", "internal"].includes(exportTemplate.value);
  updateExportPreview();
}

function applyExportLanguageMapping() {
  const mapping = exportOutputLanguage.value === "en"
    ? { untested: "Untested", passed: "Passed", failed: "Failed", blocked: "Blocked" }
    : { untested: "Belum diuji", passed: "Lulus", failed: "Gagal", blocked: "Terblokir" };
  document.querySelector("#map-untested").value = mapping.untested;
  document.querySelector("#map-passed").value = mapping.passed;
  document.querySelector("#map-failed").value = mapping.failed;
  document.querySelector("#map-blocked").value = mapping.blocked;
  updateExportPreview();
}

exportColumnOptions.replaceChildren(...EXPORT_COLUMNS.map((column) => {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const text = document.createElement("span");
  input.type = "checkbox";
  input.value = column.key;
  text.textContent = column.label;
  label.append(input, text);
  return label;
}));
exportTemplate.replaceChildren(...listAdapters("export").map((adapter) => {
  const option = document.createElement("option");
  option.value = adapter.id;
  option.textContent = adapter.label;
  return option;
}));

configureExportButton.addEventListener("click", () => {
  qualityOverride.checked = false;
  applyExportTemplate();
  exportDialog.showModal();
  exportTemplate.focus();
});
exportTemplate.addEventListener("change", applyExportTemplate);
exportOutputLanguage.addEventListener("change", applyExportLanguageMapping);
exportForm.addEventListener("input", updateExportPreview);
exportClose.addEventListener("click", () => { exportDialog.close(); configureExportButton.focus({ preventScroll: true }); });
exportDialog.addEventListener("cancel", (event) => { event.preventDefault(); exportDialog.close(); configureExportButton.focus({ preventScroll: true }); });
copyExportButton.addEventListener("click", async () => {
  if (!exportResult) return;
  try {
    await copyText(exportResult.content);
    showToast(`${EXPORT_TEMPLATES[exportTemplate.value].label} berhasil disalin.`);
  } catch {
    showToast("Hasil ekspor belum dapat disalin. Gunakan unduhan file.");
  }
});
downloadExportButton.addEventListener("click", () => {
  if (!exportResult) return;
  const blob = new Blob([exportResult.content], { type: exportResult.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(activeFeature().name)}-${exportTemplate.value}.${exportResult.extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(`${EXPORT_TEMPLATES[exportTemplate.value].label} ${activeFeature().name} berhasil diunduh.`);
});

exportProjectButton.addEventListener("click", () => {
  const blob = new Blob([serializeProject(collection)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(activeFeature()?.name || "casecraft")}.casecraft.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Backup proyek .casecraft.json berhasil diunduh.");
});

function showImportError(message) {
  importFeedback.textContent = message;
  importFeedback.hidden = false;
  showToast(message);
}

importProjectButton.addEventListener("click", () => {
  importFeedback.hidden = true;
  importFeedback.textContent = "";
  projectFileInput.click();
});

projectFileInput.addEventListener("change", async () => {
  const [file] = projectFileInput.files || [];
  projectFileInput.value = "";
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".casecraft.json") && file.type !== "application/json") {
    showImportError("Pilih file .casecraft.json yang valid.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showImportError("File proyek melebihi batas 5 MB.");
    return;
  }
  const parsed = parseProject(await file.text());
  if (!parsed.ok) {
    showImportError(parsed.error);
    return;
  }
  importFeedback.hidden = true;
  const featureTotal = parsed.collection.features.length;
  const caseTotal = parsed.collection.features.reduce((total, feature) => total + feature.cases.length, 0);
  openConfirmDialog({
    title: "Ganti proyek aktif?",
    description: `Impor berisi ${featureTotal} fitur dan ${caseTotal} test case. Proyek aktif akan diganti; ekspor backup terlebih dahulu bila masih diperlukan.`,
    actionLabel: "Impor proyek",
    onConfirm: () => {
      collection = parsed.collection;
      selectedCaseKey = "";
      recentAddedIds = new Set();
      noCollection.hidden = true;
      managementContent.hidden = false;
      exportActions.hidden = false;
      persistCollection("Proyek impor tersimpan di sesi browser.");
      renderFeature();
      showToast("Proyek Casecraft berhasil dipulihkan.");
      document.querySelector("#suite-title").focus({ preventScroll: true });
    },
    trigger: importProjectButton,
  });
});

traceabilityList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-trace-case]");
  if (!button) return;
  withEditorGuard(() => {
    selectedCaseKey = button.dataset.traceCase;
    searchInput.value = "";
    categoryFilter.value = "all";
    priorityFilter.value = "all";
    statusFilter.value = "all";
    rejectFilter.value = "all";
    tagFilter.value = "all";
    renderTable();
    selectedCaseTitle.focus({ preventScroll: true });
  }, button);
});

function resetVersionDraft() {
  const requirement = activeFeature().requirements.find((item) => item.id === versionRequirementSelect.value) || activeFeature().requirements[0];
  versionText.value = requirement?.text || "";
  versionPreview.hidden = true;
  versionPreview.replaceChildren();
  versionError.hidden = true;
  versionText.removeAttribute("aria-invalid");
  applyVersionButton.disabled = true;
  pendingVersionAnalysis = null;
}

versionRequirementButton.addEventListener("click", () => withEditorGuard(() => {
  versionRequirementSelect.replaceChildren(...activeFeature().requirements.map((requirement) => {
    const option = document.createElement("option");
    option.value = requirement.id;
    option.textContent = `${requirement.id} · versi ${requirement.currentVersion || 1}`;
    return option;
  }));
  resetVersionDraft();
  versionDialog.showModal();
  versionRequirementSelect.focus();
}, versionRequirementButton));
versionRequirementSelect.addEventListener("change", resetVersionDraft);
versionClose.addEventListener("click", () => { versionDialog.close(); versionRequirementButton.focus({ preventScroll: true }); });
versionDialog.addEventListener("cancel", (event) => { event.preventDefault(); versionDialog.close(); versionRequirementButton.focus({ preventScroll: true }); });

versionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const requirement = activeFeature().requirements.find((item) => item.id === versionRequirementSelect.value);
  const nextText = versionText.value.trim();
  versionError.hidden = true;
  versionText.removeAttribute("aria-invalid");
  if (!requirement || nextText.length < 30 || nextText === requirement.text.trim()) {
    versionText.setAttribute("aria-invalid", "true");
    versionError.textContent = nextText === requirement?.text.trim() ? "Versi baru belum berbeda dari versi aktif." : "Requirement versi baru wajib berisi sedikitnya 30 karakter.";
    versionError.hidden = false;
    versionText.focus();
    return;
  }
  const analysis = analyzeRequirement(nextText, { requirementId: requirement.id });
  const comparison = compareRequirementVersions(requirement, analysis);
  pendingVersionAnalysis = { requirementId: requirement.id, text: nextText, comparison };
  const summary = document.createElement("strong");
  const list = document.createElement("ul");
  summary.textContent = `Perbandingan v${requirement.currentVersion || 1} → v${(requirement.currentVersion || 1) + 1}`;
  [["Tetap", comparison.exact.length], ["Berubah", comparison.changed.length], ["Baru", comparison.added.length], ["Dihapus", comparison.removed.length]].forEach(([label, count]) => {
    const item = document.createElement("li");
    item.textContent = `${label}: ${count}`;
    list.append(item);
  });
  versionPreview.replaceChildren(summary, list);
  versionPreview.hidden = false;
  applyVersionButton.disabled = false;
  applyVersionButton.focus();
});

applyVersionButton.addEventListener("click", () => {
  if (!pendingVersionAnalysis) return;
  const result = applyRequirementVersion(activeFeature(), pendingVersionAnalysis.requirementId, pendingVersionAnalysis.text);
  if (!result) return;
  const counts = result.impacts.reduce((summary, impact) => { summary[impact.status] = (summary[impact.status] || 0) + 1; return summary; }, {});
  versionDialog.close();
  pendingVersionAnalysis = null;
  persistCollection(`Requirement ${result.requirement.id} diperbarui ke versi ${result.requirement.currentVersion}.`);
  renderFeature();
  showToast(`Impact analysis: ${counts.update || 0} perbarui · ${counts.rerun || 0} jalankan ulang · ${counts.obsolete || 0} tidak relevan.`);
  versionRequirementButton.focus({ preventScroll: true });
});

function cycleOption(cycle) {
  const option = document.createElement("option");
  option.value = cycle.id;
  option.textContent = `${cycle.name}${cycle.buildVersion ? ` · ${cycle.buildVersion}` : ""}`;
  return option;
}

function renderRunComparison() {
  comparisonResult.replaceChildren();
  try {
    const comparison = compareTestRuns(activeFeature(), compareBaseline.value, compareTarget.value);
    const metrics = document.createElement("div");
    metrics.className = "comparison-metrics";
    [
      ["Kasus baru", comparison.newCases.length], ["Gagal baru", comparison.newFailures.length], ["Sudah diperbaiki", comparison.fixed.length],
      ["Regression baru", comparison.regressions.length], ["Blocker aktif", comparison.activeBlockers.length],
      ["Perubahan pass rate", `${comparison.passRateDelta > 0 ? "+" : ""}${comparison.passRateDelta}%`],
    ].forEach(([label, value]) => {
      const card = document.createElement("div");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = String(value);
      span.textContent = label;
      card.append(strong, span);
      metrics.append(card);
    });
    const details = document.createElement("div");
    details.className = "comparison-groups";
    [["Gagal baru", comparison.newFailures], ["Sudah diperbaiki", comparison.fixed], ["Regression baru", comparison.regressions], ["Blocker aktif", comparison.activeBlockers]].forEach(([label, items]) => {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      const list = document.createElement("ul");
      heading.textContent = `${label} · ${items.length}`;
      if (!items.length) {
        const item = document.createElement("li"); item.textContent = "Tidak ada."; list.append(item);
      } else items.forEach((entry) => { const item = document.createElement("li"); item.textContent = `${entry.caseId} · ${entry.testCase.scenario}`; list.append(item); });
      section.append(heading, list);
      details.append(section);
    });
    comparisonResult.append(metrics, details);
  } catch (error) {
    const message = document.createElement("p"); message.className = "form-alert"; message.textContent = error.message; comparisonResult.append(message);
  }
}

compareRunsButton.addEventListener("click", () => {
  const cycles = activeFeature().cycles;
  compareBaseline.replaceChildren(...cycles.map(cycleOption));
  compareTarget.replaceChildren(...cycles.map(cycleOption));
  compareTarget.value = activeFeature().activeCycleId;
  const targetIndex = cycles.findIndex((cycle) => cycle.id === compareTarget.value);
  compareBaseline.value = cycles[Math.max(0, targetIndex - 1)]?.id || cycles[0].id;
  renderRunComparison();
  compareDialog.showModal();
  compareBaseline.focus();
});
[compareBaseline, compareTarget].forEach((select) => select.addEventListener("change", renderRunComparison));
compareClose.addEventListener("click", () => { compareDialog.close(); compareRunsButton.focus({ preventScroll: true }); });
compareDialog.addEventListener("cancel", (event) => { event.preventDefault(); compareDialog.close(); compareRunsButton.focus({ preventScroll: true }); });

function updateReportPreview() {
  try {
    const report = buildQaReport(activeFeature(), reportCycle.value, { baselineId: reportBaseline.value, language: reportLanguage.value });
    reportHtml = renderQaReportHtml(report);
    reportPreview.replaceChildren();
    const metrics = document.createElement("div"); metrics.className = "comparison-metrics";
    [["Total", report.counts.total], ["Lulus", report.counts.passed], ["Gagal", report.counts.failed], ["Terblokir", report.counts.blocked], ["Pass rate", `${report.passRate}%`], ["Risiko tinggi tersisa", report.residualRisks.length]].forEach(([label, value]) => {
      const card = document.createElement("div"); const strong = document.createElement("strong"); const span = document.createElement("span"); strong.textContent = String(value); span.textContent = label; card.append(strong, span); metrics.append(card);
    });
    const note = document.createElement("p"); note.textContent = `${report.defects.length} referensi defect · ${report.blockers.length} blocker aktif · report diproses lokal.`;
    reportPreview.append(metrics, note);
    downloadReportButton.disabled = false;
    printReportButton.disabled = false;
  } catch (error) {
    reportHtml = "";
    reportPreview.textContent = error.message;
    downloadReportButton.disabled = true;
    printReportButton.disabled = true;
  }
}

openReportButton.addEventListener("click", () => {
  const cycles = activeFeature().cycles;
  reportCycle.replaceChildren(...cycles.map(cycleOption));
  reportCycle.value = activeFeature().activeCycleId;
  const empty = document.createElement("option"); empty.value = ""; empty.textContent = "Tanpa perbandingan";
  reportBaseline.replaceChildren(empty, ...cycles.map(cycleOption));
  reportLanguage.value = activeFeature().outputLanguage === "en" ? "en" : "id";
  updateReportPreview();
  reportDialog.showModal();
  reportCycle.focus();
});
[reportCycle, reportBaseline, reportLanguage].forEach((select) => select.addEventListener("change", updateReportPreview));
reportClose.addEventListener("click", () => { reportDialog.close(); openReportButton.focus({ preventScroll: true }); });
reportDialog.addEventListener("cancel", (event) => { event.preventDefault(); reportDialog.close(); openReportButton.focus({ preventScroll: true }); });
downloadReportButton.addEventListener("click", () => {
  if (!reportHtml) return;
  const url = URL.createObjectURL(new Blob([reportHtml], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `${safeFilename(activeFeature().name)}-qa-report.html`; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  showToast("Laporan QA HTML berhasil diunduh.");
});
printReportButton.addEventListener("click", () => {
  if (!reportHtml) return;
  const url = URL.createObjectURL(new Blob([reportHtml], { type: "text/html;charset=utf-8" }));
  const reportWindow = window.open(url, "_blank");
  if (!reportWindow) { URL.revokeObjectURL(url); showToast("Izinkan pop-up untuk mencetak atau menyimpan PDF."); return; }
  reportWindow.addEventListener("load", () => { reportWindow.print(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }, { once: true });
});

cycleSelect.addEventListener("change", () => {
  const targetCycleId = cycleSelect.value;
  const targetCycleName = activeFeature().cycles.find((cycle) => cycle.id === targetCycleId)?.name || targetCycleId;
  cycleSelect.value = activeFeature().activeCycleId;
  withEditorGuard(() => {
    selectExecutionCycle(activeFeature(), targetCycleId);
    persistCollection(`${targetCycleName} dipilih sebagai siklus aktif.`);
    renderFeature();
  }, cycleSelect);
});

createCycleButton.addEventListener("click", () => withEditorGuard(() => {
  cycleForm.reset();
  cycleNameError.hidden = true;
  cycleName.removeAttribute("aria-invalid");
  cycleDialog.showModal();
  cycleName.focus();
}, createCycleButton));

cycleCancel.addEventListener("click", () => cycleDialog.close());
cycleDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  cycleDialog.close();
  createCycleButton.focus({ preventScroll: true });
});

cycleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cycleName.value.trim();
  if (!name) {
    cycleName.setAttribute("aria-invalid", "true");
    cycleNameError.textContent = "Nama siklus wajib diisi.";
    cycleNameError.hidden = false;
    cycleName.focus();
    return;
  }
  const cycle = createExecutionCycle(activeFeature(), {
    name,
    buildVersion: cycleBuild.value.trim(),
    environment: cycleEnvironment.value.trim(),
    browser: cycleBrowser.value.trim(),
    device: cycleDevice.value.trim(),
  });
  cycleDialog.close();
  persistCollection(`${cycle.name} dibuat sebagai siklus aktif.`);
  renderFeature();
  showToast(`${cycle.name} siap untuk eksekusi baru.`);
  cycleSelect.focus({ preventScroll: true });
});

permanentStorageInput.addEventListener("change", async () => {
  if (permanentStorageInput.checked) {
    persistenceStatus.textContent = "Menyimpan proyek ke IndexedDB…";
    const saved = await setPermanentStorage(true, collection);
    permanentStorageInput.checked = saved;
    persistenceStatus.textContent = saved ? "Penyimpanan permanen aktif di perangkat ini." : "IndexedDB tidak tersedia; proyek tetap ada di sesi tab.";
    return;
  }
  permanentStorageInput.checked = true;
  openConfirmDialog({
    title: "Hapus salinan permanen?",
    description: "Salinan IndexedDB akan dihapus. Proyek aktif tetap tersedia selama sesi tab dan dapat diamankan lewat ekspor .casecraft.json.",
    actionLabel: "Hapus salinan",
    onConfirm: async () => {
      const cleared = await setPermanentStorage(false, collection);
      permanentStorageInput.checked = !cleared;
      persistenceStatus.textContent = cleared ? "Penyimpanan permanen nonaktif; data sesi tetap tersedia." : "Salinan permanen belum dapat dihapus.";
    },
    trigger: permanentStorageInput,
  });
});

confirmCancel.addEventListener("click", closeConfirmDialog);
confirmAction.addEventListener("click", () => {
  const action = pendingDialogAction;
  pendingDialogAction = null;
  dialogTrigger = null;
  confirmDialog.close();
  action?.();
});

confirmDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeConfirmDialog();
});

window.addEventListener("beforeunload", (event) => {
  if (!editorDirty) return;
  event.preventDefault();
  event.returnValue = "";
});

window.addEventListener("pagehide", () => {
  if (collection) saveActiveCollection(collection);
});

updateCharacterCount();
exportOutputLanguage.value = activeFeature()?.outputLanguage === "en" ? "en" : "id";
applyExportLanguageMapping();
initLocalization();
initPwa();
document.addEventListener("casecraft:language", () => {
  const feature = activeFeature();
  if (feature) document.title = interfaceLanguage() === "en" ? `${feature.name} — Test Case Management — Casecraft` : `${feature.name} — Manajemen Test Case — Casecraft`;
});
