import { analyzeRequirement, mergeTestCases, sanitizePrefix } from "./generator.js";
import { compareRequirementVersions, defaultRiskForCase, normalizeParameterSets, normalizeRisk, requirementImpactForCase } from "./analysis-tools.js";
import { normalizeAutomation } from "./automation-tools.js";

const TEST_TYPE_LABELS = { happy: "Positif", negative: "Negatif", edge: "HYBRID", regression: "HYBRID" };
const CATEGORY_LABELS = { happy: "Happy path", negative: "Negative", edge: "Edge case", regression: "Regression" };
const DEFAULT_RESULT = { qaStatus: "Belum diuji", rejectStatus: "Tidak ditolak", actual: "", defectReference: "", blocker: "", updatedAt: "" };

export const COLLECTION_STORAGE_KEY = "casecraft.activeCollection.v1";
export const PROJECT_FORMAT = "casecraft-project";
export const PROJECT_FORMAT_VERSION = 1;

export function normalizeTestCase(testCase = {}) {
  const defaultPriority = ["happy", "negative"].includes(testCase.category) ? "High" : "Medium";
  const normalized = {
    ...testCase,
    steps: Array.isArray(testCase.steps) ? testCase.steps.map(String) : [],
    criterionIds: Array.isArray(testCase.criterionIds) ? [...new Set(testCase.criterionIds.map(String))] : [],
    tags: Array.isArray(testCase.tags)
      ? [...new Set(testCase.tags.map((tag) => String(tag).trim()).filter(Boolean))]
      : [],
    priority: testCase.priority || defaultPriority,
    qaStatus: testCase.qaStatus || DEFAULT_RESULT.qaStatus,
    rejectStatus: testCase.rejectStatus || DEFAULT_RESULT.rejectStatus,
    actual: testCase.actual || "",
    defectReference: testCase.defectReference || "",
    blocker: testCase.blocker || "",
    parameterSets: normalizeParameterSets(testCase.parameterSets),
    risk: normalizeRisk(testCase.risk || defaultRiskForCase(testCase)),
    requirementImpact: testCase.requirementImpact && typeof testCase.requirementImpact === "object" ? { ...testCase.requirementImpact } : null,
    needsCustomization: Boolean(testCase.needsCustomization),
    automation: normalizeAutomation(testCase.automation),
  };
  return normalized;
}

export function featureIdFromName(featureName = "") {
  const normalized = String(featureName).trim().toLocaleLowerCase("id-ID");
  const slug = normalized.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fitur";
  let hash = 2166136261;
  for (const character of normalized) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${slug}-${(hash >>> 0).toString(36)}`;
}

export function nextCaseId(featureName = "", cases = []) {
  const prefix = `TC_${sanitizePrefix(featureName)}_`;
  const usedIds = new Set(cases.map((testCase) => testCase.id));
  let nextNumber = cases.reduce((highest, testCase) => {
    if (!String(testCase.id || "").startsWith(prefix)) return highest;
    const suffix = Number.parseInt(testCase.id.slice(prefix.length), 10);
    return Number.isNaN(suffix) ? highest : Math.max(highest, suffix);
  }, 0) + 1;
  let candidate = `${prefix}${String(nextNumber).padStart(3, "0")}`;
  while (usedIds.has(candidate)) {
    nextNumber += 1;
    candidate = `${prefix}${String(nextNumber).padStart(3, "0")}`;
  }
  return candidate;
}

export function nextRequirementId(feature = {}) {
  const highest = (feature.requirements || []).reduce((value, requirement) => {
    const number = Number.parseInt(String(requirement.id || "").replace(/^REQ-/, ""), 10);
    return Number.isNaN(number) ? value : Math.max(value, number);
  }, 0);
  return `REQ-${String(highest + 1).padStart(3, "0")}`;
}

export function createManualTestCase(feature, specification = {}) {
  const category = Object.hasOwn(CATEGORY_LABELS, specification.category) ? specification.category : "happy";
  return normalizeTestCase({
    id: nextCaseId(feature.name, feature.cases),
    module: feature.name,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    testType: TEST_TYPE_LABELS[category],
    scenario: String(specification.scenario || "").trim(),
    precondition: String(specification.precondition || "").trim(),
    steps: Array.isArray(specification.steps) ? specification.steps.map((step) => String(step).trim()).filter(Boolean) : [],
    testData: String(specification.testData || "").trim(),
    expected: String(specification.expected || "").trim(),
    source: "Dibuat manual oleh QA",
    criterionIds: Array.isArray(specification.criterionIds) ? specification.criterionIds : [],
    tags: Array.isArray(specification.tags) ? specification.tags : [],
    parameterSets: normalizeParameterSets(specification.parameterSets),
    risk: normalizeRisk(specification.risk || {}),
    priority: specification.priority,
  });
}

export function duplicateTestCase(feature, testCase) {
  return normalizeTestCase({
    ...testCase,
    id: nextCaseId(feature.name, feature.cases),
    scenario: `${String(testCase.scenario || "").trim()} (salinan)`,
    steps: [...(testCase.steps || [])],
    criterionIds: [...(testCase.criterionIds || [])],
    tags: [...(testCase.tags || [])],
    parameterSets: normalizeParameterSets(testCase.parameterSets),
    risk: normalizeRisk(testCase.risk),
    source: testCase.source || testCase.scenario,
    qaStatus: DEFAULT_RESULT.qaStatus,
    rejectStatus: DEFAULT_RESULT.rejectStatus,
    actual: "",
    defectReference: "",
    blocker: "",
    automation: { ...normalizeAutomation(testCase.automation), reviewStatus: "draft", lifecycle: "manual", scripts: [] },
  });
}

export function removeTestCase(feature, caseId) {
  const index = feature.cases.findIndex((testCase) => testCase.id === caseId);
  if (index === -1) return null;
  const [testCase] = feature.cases.splice(index, 1);
  return { index, testCase: { ...testCase, steps: [...(testCase.steps || [])], criterionIds: [...(testCase.criterionIds || [])], tags: [...(testCase.tags || [])], parameterSets: normalizeParameterSets(testCase.parameterSets), risk: normalizeRisk(testCase.risk) } };
}

export function restoreTestCase(feature, testCase, index) {
  if (feature.cases.some((item) => item.id === testCase.id)) return false;
  feature.cases.splice(Math.min(Math.max(index, 0), feature.cases.length), 0, {
    ...testCase,
    steps: [...(testCase.steps || [])],
    criterionIds: [...(testCase.criterionIds || [])],
    tags: [...(testCase.tags || [])],
    parameterSets: normalizeParameterSets(testCase.parameterSets),
    risk: normalizeRisk(testCase.risk),
  });
  return true;
}

function normalizeRequirement(record, fallbackId = "REQ-001") {
  const id = String(record?.id || fallbackId);
  const text = String(record?.text || record?.requirement || "");
  const generated = analyzeRequirement(text, { requirementId: id });
  const criteria = Array.isArray(record?.criteria) ? record.criteria : generated.criteria;
  const warnings = Array.isArray(record?.warnings) ? record.warnings.map(String) : generated.warnings;
  const currentVersion = Math.max(1, Number.parseInt(record?.currentVersion, 10) || (Array.isArray(record?.versions) ? record.versions.length : 1));
  const versions = Array.isArray(record?.versions) && record.versions.length
    ? record.versions.map((version, index) => ({ version: Number.parseInt(version.version, 10) || index + 1, text: String(version.text || ""), criteria: Array.isArray(version.criteria) ? version.criteria : [], warnings: Array.isArray(version.warnings) ? version.warnings.map(String) : [], createdAt: version.createdAt || "" }))
    : [{ version: currentVersion, text, criteria, warnings, createdAt: record?.createdAt || "" }];
  return {
    id,
    text,
    criteria,
    warnings,
    coverage: Array.isArray(record?.coverage) ? record.coverage : [],
    createdAt: record?.createdAt || "",
    currentVersion,
    versions,
  };
}

export function applyRequirementVersion(feature, requirementId, nextText, createdAt = new Date().toISOString()) {
  const requirement = feature?.requirements?.find((item) => item.id === requirementId);
  const text = String(nextText || "").trim();
  if (!requirement || !text) return null;
  const nextAnalysis = analyzeRequirement(text, { requirementId });
  const comparison = compareRequirementVersions(requirement, nextAnalysis);
  const nextVersion = (requirement.currentVersion || requirement.versions?.length || 1) + 1;
  const impacts = feature.cases.map((testCase) => {
    const impact = { ...requirementImpactForCase(testCase, comparison, requirementId), requirementId, version: nextVersion, assessedAt: createdAt };
    testCase.requirementImpact = impact;
    return { caseId: testCase.id, ...impact };
  });
  requirement.text = text;
  requirement.criteria = comparison.criteria;
  requirement.warnings = nextAnalysis.warnings;
  requirement.currentVersion = nextVersion;
  requirement.versions = [...(requirement.versions || []), { version: nextVersion, text, criteria: comparison.criteria, warnings: nextAnalysis.warnings, createdAt }];
  if (feature.requirement === requirement.versions[0]?.text || feature.requirements.length === 1) feature.requirement = text;
  return { requirement, comparison, impacts };
}

function resultFromCase(testCase) {
  return {
    qaStatus: testCase.qaStatus || DEFAULT_RESULT.qaStatus,
    rejectStatus: testCase.rejectStatus || DEFAULT_RESULT.rejectStatus,
    actual: testCase.actual || "",
    defectReference: testCase.defectReference || "",
    blocker: testCase.blocker || "",
    updatedAt: "",
  };
}

function normalizeCycle(cycle, index = 0) {
  const results = {};
  Object.entries(cycle?.results || {}).forEach(([caseId, result]) => {
    results[caseId] = { ...DEFAULT_RESULT, ...result };
  });
  return {
    id: cycle?.id || `CYCLE-${String(index + 1).padStart(3, "0")}`,
    name: String(cycle?.name || `Siklus ${index + 1}`),
    buildVersion: String(cycle?.buildVersion || ""),
    environment: String(cycle?.environment || ""),
    browser: String(cycle?.browser || ""),
    device: String(cycle?.device || ""),
    createdAt: cycle?.createdAt || "",
    results,
    caseIds: Array.isArray(cycle?.caseIds) ? [...new Set(cycle.caseIds.map(String))] : Object.keys(results),
  };
}

function initialCycle(cases, details = {}) {
  return normalizeCycle({
    id: "CYCLE-001",
    name: details.name || "Siklus awal",
    buildVersion: details.buildVersion || "",
    environment: details.environment || "",
    browser: details.browser || "",
    device: details.device || "",
    createdAt: details.createdAt || "",
    results: Object.fromEntries(cases.map((testCase) => [testCase.id, resultFromCase(testCase)])),
    caseIds: cases.map((testCase) => testCase.id),
  });
}

export function activeCycle(feature) {
  return feature?.cycles?.find((cycle) => cycle.id === feature.activeCycleId) || feature?.cycles?.[0] || null;
}

export function applyActiveCycle(feature) {
  const cycle = activeCycle(feature);
  feature.cases.forEach((testCase) => {
    const result = cycle?.results?.[testCase.id] || DEFAULT_RESULT;
    testCase.qaStatus = result.qaStatus;
    testCase.rejectStatus = result.rejectStatus;
    testCase.actual = result.actual;
    testCase.defectReference = result.defectReference || "";
    testCase.blocker = result.blocker || "";
  });
  return feature;
}

export function createExecutionCycle(feature, details = {}) {
  const nextNumber = (feature.cycles || []).reduce((highest, cycle) => {
    const number = Number.parseInt(String(cycle.id || "").replace(/^CYCLE-/, ""), 10);
    return Number.isNaN(number) ? highest : Math.max(highest, number);
  }, 0) + 1;
  const cycle = normalizeCycle({
    id: `CYCLE-${String(nextNumber).padStart(3, "0")}`,
    name: details.name || `Siklus ${nextNumber}`,
    buildVersion: details.buildVersion,
    environment: details.environment,
    browser: details.browser,
    device: details.device,
    createdAt: details.createdAt || new Date().toISOString(),
    results: {},
    caseIds: feature.cases.map((testCase) => testCase.id),
  }, nextNumber - 1);
  feature.cycles.push(cycle);
  feature.activeCycleId = cycle.id;
  applyActiveCycle(feature);
  return cycle;
}

export function selectExecutionCycle(feature, cycleId) {
  if (!feature.cycles.some((cycle) => cycle.id === cycleId)) return false;
  feature.activeCycleId = cycleId;
  applyActiveCycle(feature);
  return true;
}

export function updateExecutionResult(feature, caseId, patch) {
  const cycle = activeCycle(feature);
  if (!cycle || !feature.cases.some((testCase) => testCase.id === caseId)) return null;
  const result = { ...DEFAULT_RESULT, ...(cycle.results[caseId] || {}), ...patch, updatedAt: new Date().toISOString() };
  cycle.results[caseId] = result;
  const testCase = feature.cases.find((item) => item.id === caseId);
  Object.assign(testCase, { qaStatus: result.qaStatus, rejectStatus: result.rejectStatus, actual: result.actual, defectReference: result.defectReference, blocker: result.blocker });
  return result;
}

export function bulkUpdateExecutionStatus(feature, caseIds = [], qaStatus = "Belum diuji") {
  const allowed = new Set(["Belum diuji", "Lulus", "Gagal", "Terblokir"]);
  if (!allowed.has(qaStatus)) return 0;
  const uniqueIds = [...new Set(caseIds.map(String))];
  return uniqueIds.reduce((updated, caseId) => updateExecutionResult(feature, caseId, { qaStatus }) ? updated + 1 : updated, 0);
}

export function renameFeature(feature, nextName = "") {
  const name = String(nextName).trim();
  if (!feature || !name) return false;
  feature.name = name;
  feature.cases.forEach((testCase) => { testCase.module = name; });
  return true;
}

export function setFeatureArchived(feature, archived = true, archivedAt = new Date().toISOString()) {
  if (!feature) return false;
  feature.archived = Boolean(archived);
  feature.archivedAt = feature.archived ? archivedAt : "";
  return true;
}

export function executionHistory(feature, caseId) {
  return (feature.cycles || []).map((cycle) => ({
    id: cycle.id,
    name: cycle.name,
    buildVersion: cycle.buildVersion,
    environment: cycle.environment,
    browser: cycle.browser,
    device: cycle.device,
    createdAt: cycle.createdAt,
    result: { ...DEFAULT_RESULT, ...(cycle.results[caseId] || {}) },
    active: cycle.id === feature.activeCycleId,
  })).reverse();
}

export function addRequirementToFeature(feature, report, text = "") {
  const requirement = normalizeRequirement({
    id: report.requirementId,
    text,
    criteria: report.criteria,
    warnings: report.warnings,
    coverage: report.coverage,
    createdAt: new Date().toISOString(),
  }, report.requirementId);
  const index = feature.requirements.findIndex((item) => item.id === requirement.id);
  if (index === -1) feature.requirements.push(requirement);
  else feature.requirements[index] = requirement;
  feature.requirement = text || feature.requirement;
  return requirement;
}

function createFeature(cases, details = {}) {
  const normalizedCases = cases.map(normalizeTestCase);
  const name = String(details.featureName || "").trim() || normalizedCases[0]?.module || "Fitur tanpa nama";
  const report = details.generationReport || analyzeRequirement(details.requirement || "", { requirementId: "REQ-001" });
  const requirement = normalizeRequirement({
    id: report.requirementId || "REQ-001",
    text: details.requirement || "",
    criteria: report.criteria,
    warnings: report.warnings,
    coverage: report.coverage,
    createdAt: details.createdAt || "",
  });
  const cycle = initialCycle(normalizedCases, { createdAt: details.createdAt || "" });
  return {
    id: featureIdFromName(name),
    name,
    requirement: details.requirement || "",
    requirements: [requirement],
    cases: normalizedCases,
    cycles: [cycle],
    activeCycleId: cycle.id,
    archived: false,
    archivedAt: "",
    requirementLanguage: details.requirementLanguage || "auto",
    outputLanguage: details.outputLanguage || "id",
  };
}

export function createCollection(cases, details = {}) {
  const feature = createFeature(cases, details);
  return { version: 3, activeFeatureId: feature.id, features: [feature] };
}

export function upsertFeature(collection, cases, details = {}) {
  const current = normalizeCollection(collection);
  const candidateName = String(details.featureName || "").trim() || cases[0]?.module || "Fitur tanpa nama";
  const candidateId = featureIdFromName(candidateName);
  if (!current) return { collection: createCollection(cases, details), feature: null, added: cases, duplicates: [], created: true };
  const existingIndex = current.features.findIndex((feature) => feature.id === candidateId);
  if (existingIndex === -1) {
    const incomingFeature = createFeature(cases, details);
    return {
      collection: { ...current, activeFeatureId: incomingFeature.id, features: [...current.features, incomingFeature] },
      feature: incomingFeature,
      added: incomingFeature.cases,
      duplicates: [],
      created: true,
    };
  }

  const existingFeature = current.features[existingIndex];
  const merged = mergeTestCases(existingFeature.cases, cases);
  existingFeature.cases = merged.cases.map(normalizeTestCase);
  existingFeature.name = candidateName;
  existingFeature.requirementLanguage = details.requirementLanguage || existingFeature.requirementLanguage || "auto";
  existingFeature.outputLanguage = details.outputLanguage || existingFeature.outputLanguage || "id";
  if (details.generationReport) addRequirementToFeature(existingFeature, details.generationReport, details.requirement || "");
  else if (details.requirement) existingFeature.requirement = details.requirement;
  const cycle = activeCycle(existingFeature);
  if (cycle) cycle.caseIds = [...new Set([...(cycle.caseIds || Object.keys(cycle.results || {})), ...merged.added.map((testCase) => testCase.id)])];
  applyActiveCycle(existingFeature);
  current.activeFeatureId = existingFeature.id;
  return { collection: current, feature: existingFeature, added: merged.added, duplicates: merged.duplicates, created: false };
}

function migrateVersionOne(collection) {
  const groups = new Map();
  (collection.cases || []).forEach((testCase) => {
    const name = testCase.module || collection.lastFeatureName || "Fitur tanpa nama";
    const id = featureIdFromName(name);
    if (!groups.has(id)) groups.set(id, { id, name, requirement: "", cases: [] });
    groups.get(id).cases.push(normalizeTestCase(testCase));
  });
  const features = [...groups.values()].map((feature) => normalizeFeature(feature));
  const preferredId = featureIdFromName(collection.lastFeatureName || features[0]?.name || "");
  const activeFeature = features.find((feature) => feature.id === preferredId) || features[0];
  if (activeFeature) activeFeature.requirement = collection.lastRequirement || "";
  return { version: 3, activeFeatureId: activeFeature?.id || "", features };
}

function normalizeFeature(feature) {
  const cases = Array.isArray(feature?.cases) ? feature.cases.map(normalizeTestCase) : [];
  const requirementText = feature?.requirement || "";
  const requirements = Array.isArray(feature?.requirements) && feature.requirements.length
    ? feature.requirements.map((item, index) => normalizeRequirement(item, `REQ-${String(index + 1).padStart(3, "0")}`))
    : [normalizeRequirement({ id: "REQ-001", text: requirementText })];
  const cycles = Array.isArray(feature?.cycles) && feature.cycles.length
    ? feature.cycles.map(normalizeCycle)
    : [initialCycle(cases)];
  const normalized = {
    ...feature,
    id: feature?.id || featureIdFromName(feature?.name),
    name: feature?.name || "Fitur tanpa nama",
    requirement: requirementText,
    requirements,
    cases,
    cycles,
    activeCycleId: cycles.some((cycle) => cycle.id === feature?.activeCycleId) ? feature.activeCycleId : cycles[0].id,
    archived: Boolean(feature?.archived),
    archivedAt: feature?.archived ? String(feature?.archivedAt || "") : "",
    requirementLanguage: feature?.requirementLanguage || "auto",
    outputLanguage: feature?.outputLanguage || "id",
  };
  return applyActiveCycle(normalized);
}

export function normalizeCollection(collection) {
  if (collection?.version === 1 && Array.isArray(collection.cases)) return migrateVersionOne(collection);
  if (![2, 3].includes(collection?.version) || !Array.isArray(collection.features)) return null;
  const features = collection.features.map(normalizeFeature);
  const fallback = features.find((feature) => !feature.archived) || features[0];
  const activeFeatureId = features.some((feature) => feature.id === collection.activeFeatureId && !feature.archived)
    ? collection.activeFeatureId
    : fallback?.id || "";
  return { version: 3, activeFeatureId, features };
}

function resolveStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

export function loadCollection(storage) {
  try {
    const activeStorage = resolveStorage(storage);
    if (!activeStorage) return null;
    const raw = activeStorage.getItem(COLLECTION_STORAGE_KEY);
    return raw ? normalizeCollection(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveCollection(collection, storage) {
  try {
    const activeStorage = resolveStorage(storage);
    const normalized = normalizeCollection(collection);
    if (!activeStorage || !normalized) return false;
    activeStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function serializeProject(collection, exportedAt = new Date().toISOString()) {
  const normalized = normalizeCollection(collection);
  if (!normalized) throw new TypeError("Koleksi Casecraft tidak valid.");
  return JSON.stringify({ format: PROJECT_FORMAT, formatVersion: PROJECT_FORMAT_VERSION, exportedAt, collection: normalized }, null, 2);
}

export function parseProject(input) {
  try {
    const value = typeof input === "string" ? JSON.parse(input) : input;
    const candidate = value?.format === PROJECT_FORMAT ? value.collection : value;
    if (value?.format === PROJECT_FORMAT && value.formatVersion !== PROJECT_FORMAT_VERSION) {
      return { ok: false, error: `Versi file .casecraft.json (${value.formatVersion}) belum didukung.` };
    }
    const collection = normalizeCollection(candidate);
    if (!collection) return { ok: false, error: "File bukan proyek Casecraft yang valid." };
    if (!collection.features.length) return { ok: false, error: "File proyek tidak berisi feature suite yang dapat dipulihkan." };
    return { ok: true, collection };
  } catch {
    return { ok: false, error: "File tidak dapat dibaca sebagai JSON Casecraft." };
  }
}
