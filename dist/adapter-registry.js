import { createExport, EXPORT_TEMPLATES } from "./export-config.js";
import { parseStructuredSpecification } from "./structured-import.js";
import { parseAutomationReport } from "./automation-results.js";

const registry = new Map();

export function registerAdapter(adapter) {
  if (!adapter || !/^[a-z][a-z0-9-]*$/.test(adapter.id || "") || !adapter.label) throw new TypeError("Adapter lokal membutuhkan id dan label yang valid.");
  if (!adapter.export && !adapter.import) throw new TypeError("Adapter lokal harus menyediakan fungsi export atau import.");
  if (registry.has(adapter.id)) throw new TypeError(`Adapter ${adapter.id} sudah terdaftar.`);
  registry.set(adapter.id, Object.freeze({ ...adapter }));
  return adapter.id;
}

export function listAdapters(direction = "export") {
  return [...registry.values()].filter((adapter) => typeof adapter[direction] === "function");
}

export function exportWithAdapter(id, cases, options = {}) {
  const adapter = registry.get(id);
  if (!adapter?.export) throw new TypeError(`Adapter ekspor ${id} tidak tersedia.`);
  return adapter.export(cases, options);
}

export function importWithAdapter(file, adapterId = "structured-spec") {
  const adapter = registry.get(adapterId);
  if (!adapter?.import) throw new TypeError(`Adapter impor ${adapterId} tidak tersedia.`);
  return adapter.import(file);
}

Object.entries(EXPORT_TEMPLATES).forEach(([id, template]) => registerAdapter({
  id,
  label: template.label,
  kind: "export",
  export: (cases, options) => createExport(cases, { ...options, template: id }),
}));

registerAdapter({ id: "structured-spec", label: "Structured specification", kind: "import", import: parseStructuredSpecification });
registerAdapter({ id: "automation-report", label: "Automation report", kind: "import", import: parseAutomationReport });

