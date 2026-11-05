const COLUMN_DEFINITIONS = [
  { key: "id", label: "ID Test Case", value: (item) => item.id },
  { key: "criterionIds", label: "Acceptance Criteria", value: (item) => (item.criterionIds || []).join(", ") },
  { key: "module", label: "Fitur / Modul", value: (item) => item.module },
  { key: "testType", label: "Jenis", value: (item) => item.testType },
  { key: "categoryLabel", label: "Kategori", value: (item) => item.categoryLabel },
  { key: "scenario", label: "Skenario Uji", value: (item) => item.scenario },
  { key: "source", label: "Sumber Requirement", value: (item) => item.source || item.scenario },
  { key: "priority", label: "Prioritas", value: (item) => item.priority },
  { key: "qaStatus", label: "Status QA", value: (item) => item.qaStatus },
  { key: "rejectStatus", label: "Status Reject", value: (item) => item.rejectStatus },
  { key: "tags", label: "Tag", value: (item) => (item.tags || []).join(", ") },
  { key: "riskScore", label: "Skor Risiko", value: (item) => item.risk?.score ?? "" },
  { key: "riskLevel", label: "Level Risiko", value: (item) => item.risk?.level ?? "" },
  { key: "requirementImpact", label: "Impact Requirement", value: (item) => item.requirementImpact?.label ?? "" },
  { key: "precondition", label: "Precondition", value: (item) => item.precondition },
  { key: "steps", label: "Langkah Uji", value: (item) => (item.steps || []).map((step, index) => `${index + 1}. ${step}`).join("\n") },
  { key: "testData", label: "Data Uji", value: (item) => item.testData },
  { key: "parameterSets", label: "Kombinasi Parameter", value: (item) => (item.parameterSets || []).map((set) => `${set.label}: ${set.data} → ${set.expected}`).join("\n") },
  { key: "expected", label: "Expected Result", value: (item) => item.expected },
  { key: "actual", label: "Hasil Aktual", value: (item) => item.actual },
  { key: "defectReference", label: "Referensi Defect", value: (item) => item.defectReference || "" },
  { key: "blocker", label: "Blocker", value: (item) => item.blocker || "" },
];

const ENGLISH_LABELS = {
  criterionIds: "Acceptance Criteria", module: "Feature / Module", testType: "Type", categoryLabel: "Category", scenario: "Test Scenario",
  source: "Requirement Source", priority: "Priority", qaStatus: "QA Status", rejectStatus: "Reject Status", tags: "Tags",
  riskScore: "Risk Score", riskLevel: "Risk Level", requirementImpact: "Requirement Impact", precondition: "Precondition",
  steps: "Test Steps", testData: "Test Data", parameterSets: "Parameter Sets", expected: "Expected Result", actual: "Actual Result",
  defectReference: "Defect Reference", blocker: "Blocker",
};

export const EXPORT_COLUMNS = COLUMN_DEFINITIONS.map(({ key, label }) => ({ key, label }));
export const EXPORT_TEMPLATES = {
  jira: {
    label: "Jira",
    columns: ["scenario", "source", "precondition", "steps", "expected", "id", "criterionIds", "module", "categoryLabel", "priority", "actual", "qaStatus"],
    headers: { scenario: "Summary", source: "Description", precondition: "Preconditions", steps: "Steps", expected: "Expected Result", id: "Test Case ID", criterionIds: "Acceptance Criteria", module: "Module", categoryLabel: "Category", priority: "Priority", actual: "Actual Result", qaStatus: "Status" },
    delimiter: ",",
    extension: "csv",
    mime: "text/csv",
  },
  markdown: { label: "Markdown", columns: COLUMN_DEFINITIONS.map((column) => column.key), delimiter: "|", extension: "md", mime: "text/markdown" },
  tsv: { label: "TSV", columns: ["module", "testType", "scenario", "priority", "qaStatus", "rejectStatus", "precondition", "steps", "testData", "expected", "actual"], delimiter: "\t", extension: "tsv", mime: "text/tab-separated-values" },
  csv: { label: "CSV generik", columns: COLUMN_DEFINITIONS.map((column) => column.key), delimiter: ",", extension: "csv", mime: "text/csv" },
  azure: {
    label: "Azure DevOps", columns: ["scenario", "steps", "expected", "priority", "qaStatus", "tags", "id"],
    headers: { scenario: "Title", steps: "Steps", expected: "Expected Result", priority: "Priority", qaStatus: "State", tags: "Tags", id: "Casecraft ID" },
    delimiter: ",", extension: "csv", mime: "text/csv",
  },
  testrail: {
    label: "TestRail", columns: ["scenario", "precondition", "steps", "expected", "priority", "qaStatus", "id"],
    headers: { scenario: "Title", precondition: "Preconditions", steps: "Steps", expected: "Expected Result", priority: "Priority", qaStatus: "Status", id: "Casecraft ID" },
    delimiter: ",", extension: "csv", mime: "text/csv",
  },
  xray: {
    label: "Xray", columns: ["scenario", "testType", "precondition", "steps", "expected", "qaStatus", "id", "criterionIds"],
    headers: { scenario: "Summary", testType: "Test Type", precondition: "Precondition", steps: "Action", expected: "Result", qaStatus: "Status", id: "Casecraft ID", criterionIds: "Requirement" },
    delimiter: ",", extension: "csv", mime: "text/csv",
  },
  internal: { label: "Internal JSON", columns: COLUMN_DEFINITIONS.map((column) => column.key), delimiter: "", extension: "json", mime: "application/json" },
};

export const DEFAULT_STATUS_MAPPING = {
  "Belum diuji": "Belum diuji",
  Lulus: "Lulus",
  Gagal: "Gagal",
  Terblokir: "Terblokir",
};

function selectedDefinitions(keys = []) {
  const requested = new Set(keys);
  return COLUMN_DEFINITIONS.filter((column) => requested.has(column.key));
}

function normalizedValue(column, item, mapping) {
  const value = column.value(item) ?? "";
  return column.key === "qaStatus" ? mapping[value] ?? value : String(value);
}

function columnLabel(column, language) {
  return language === "en" ? ENGLISH_LABELS[column.key] || column.label : column.label;
}

function delimitedCell(value, delimiter) {
  const text = String(value ?? "");
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

export function createExport(cases = [], options = {}) {
  const templateKey = Object.hasOwn(EXPORT_TEMPLATES, options.template) ? options.template : "jira";
  const template = EXPORT_TEMPLATES[templateKey];
  const columns = selectedDefinitions(Array.isArray(options.columns) ? options.columns : template.columns);
  if (!columns.length) throw new TypeError("Pilih sedikitnya satu kolom untuk diekspor.");
  const statusMapping = { ...DEFAULT_STATUS_MAPPING, ...(options.statusMapping || {}) };
  const language = options.outputLanguage === "en" ? "en" : "id";
  const rows = cases.map((item) => columns.map((column) => normalizedValue(column, item, statusMapping)));

  if (templateKey === "internal") {
    const records = cases.map((item) => Object.fromEntries(columns.map((column) => [column.key, normalizedValue(column, item, statusMapping)])));
    return { content: JSON.stringify({ format: "casecraft-adapter", version: 1, language, records }, null, 2), extension: template.extension, mime: `${template.mime};charset=utf-8` };
  }

  if (templateKey === "markdown") {
    const header = `| ${columns.map((column) => markdownCell(columnLabel(column, language))).join(" | ")} |`;
    const divider = `| ${columns.map(() => "---").join(" | ")} |`;
    return { content: [header, divider, ...rows.map((row) => `| ${row.map(markdownCell).join(" | ")} |`)].join("\n"), extension: template.extension, mime: template.mime };
  }

  const delimiter = templateKey === "tsv" ? "\t" : String(options.delimiter || template.delimiter).slice(0, 1) || ",";
  const lineBreak = templateKey === "tsv" ? "\n" : "\r\n";
  const content = [columns.map((column) => template.headers?.[column.key] || columnLabel(column, language)), ...rows]
    .map((row) => row.map((value) => delimitedCell(value, delimiter)).join(delimiter))
    .join(lineBreak);
  return {
    content: ["jira", "csv", "azure", "testrail", "xray"].includes(templateKey) ? `\uFEFF${content}` : content,
    extension: template.extension,
    mime: `${template.mime};charset=utf-8`,
  };
}
