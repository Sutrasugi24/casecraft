#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generateTestCases, buildGenerationReport } from "../dist/generator.js";
import { createCollection, parseProject, serializeProject } from "../dist/collection-store.js";
import { createExport, EXPORT_TEMPLATES } from "../dist/export-config.js";
import { compareTestRuns } from "../dist/run-comparison.js";
import { runCiQualityGate } from "../dist/ci-quality-gate.js";
import { createPluginRegistry } from "../dist/plugin-sdk.js";

const HELP = `Casecraft CLI · deterministic local QA tooling

Usage:
  casecraft generate --feature <name> (--requirement <text> | --requirement-file <path>) [--output project.casecraft.json]
  casecraft validate <project.casecraft.json> [--ci] [--json] [--max-duplicate-ratio 0.1]
  casecraft export <project.casecraft.json> --template <markdown|jira|tsv|csv|azure|testrail|xray|internal> [--output file]
  casecraft compare <project.casecraft.json> --baseline <cycle-id> --target <cycle-id> [--feature <id-or-name>]

Shared options:
  --plugin <path>       Load an explicitly trusted local ESM plugin (repeatable).
  --help                Show this help.

No command sends project or requirement data over the network.`;

export function parseArguments(argv) {
  const positional = [];
  const options = { plugin: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) { positional.push(value); continue; }
    const key = value.slice(2);
    if (["help", "ci", "json", "fail-on-warnings"].includes(key)) { options[key] = true; continue; }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) throw new TypeError(`Opsi --${key} membutuhkan nilai.`);
    index += 1;
    if (key === "plugin") options.plugin.push(next);
    else options[key] = next;
  }
  return { command: positional.shift() || "", positional, options };
}

async function loadPlugins(paths = []) {
  const registry = createPluginRegistry();
  for (const pluginPath of paths) {
    const absolute = resolve(pluginPath);
    const module = await import(pathToFileURL(absolute).href);
    const plugin = module.default || module.plugin;
    registry.register(plugin);
  }
  return registry;
}

async function readText(path) {
  return readFile(resolve(path), "utf8");
}

async function writeResult(content, output = "", stdout = process.stdout) {
  if (output) {
    await writeFile(resolve(output), content, "utf8");
    stdout.write(`${resolve(output)}\n`);
  } else stdout.write(content.endsWith("\n") ? content : `${content}\n`);
}

function selectedFeature(collection, selector = "") {
  const active = collection.features.find((feature) => feature.id === collection.activeFeatureId);
  if (!selector) return active || collection.features[0];
  return collection.features.find((feature) => feature.id === selector || feature.name.toLowerCase() === selector.toLowerCase());
}

async function loadProject(path) {
  if (!path) throw new TypeError("Path proyek .casecraft.json wajib diberikan.");
  const parsed = parseProject(await readText(path));
  if (!parsed.ok) throw new TypeError(parsed.error);
  return parsed.collection;
}

async function generateCommand(options, registry, stdout) {
  const featureName = String(options.feature || "").trim();
  const requirement = options["requirement-file"] ? await readText(options["requirement-file"]) : String(options.requirement || "");
  if (!featureName) throw new TypeError("--feature wajib diisi.");
  if (!requirement.trim()) throw new TypeError("--requirement atau --requirement-file wajib diisi.");
  const coverage = String(options.coverage || "happy,negative,edge,regression").split(",").map((item) => item.trim()).filter(Boolean);
  let collection;
  if (options.generator) {
    const generated = await registry.execute("generator", options.generator, { featureName, requirement, coverage }, { command: "generate" });
    if (generated?.collection) collection = generated.collection;
    else if (Array.isArray(generated?.cases)) collection = createCollection(generated.cases, { featureName, requirement, generationReport: generated.generationReport });
    else throw new TypeError(`Generator plugin ${options.generator} tidak menghasilkan collection atau cases.`);
  } else {
    const cases = generateTestCases({ featureName, requirement, coverage, outputLanguage: options.language === "en" ? "en" : "id" });
    const generationReport = buildGenerationReport({ requirement, coverage, cases });
    collection = createCollection(cases, { featureName, requirement, generationReport, outputLanguage: options.language === "en" ? "en" : "id" });
  }
  await writeResult(`${serializeProject(collection)}\n`, options.output, stdout);
}

async function validateCommand(projectPath, options, registry, stdout) {
  const collection = await loadProject(projectPath);
  const report = runCiQualityGate(collection, {
    maxDuplicateRatio: options["max-duplicate-ratio"],
    failOnWarnings: options["fail-on-warnings"],
  });
  for (const validator of registry.list("validator")) {
    const result = await registry.execute("validator", validator.id, collection, { command: "validate" });
    (result?.findings || []).forEach((finding) => report.findings.push({ severity: "warning", ...finding, pluginId: validator.pluginId }));
  }
  report.errors = report.findings.filter((finding) => finding.severity === "error").length;
  report.warnings = report.findings.filter((finding) => finding.severity === "warning").length;
  report.passed = report.errors === 0 && !(report.policy.failOnWarnings && report.warnings > 0);
  if (options.json) await writeResult(`${JSON.stringify(report, null, 2)}\n`, "", stdout);
  else {
    const lines = [`Quality gate: ${report.passed ? "LULUS" : "GAGAL"} · ${report.errors} error · ${report.warnings} warning`];
    report.findings.forEach((finding) => lines.push(`${finding.severity.toUpperCase()} ${finding.code} ${finding.featureName ? `[${finding.featureName}] ` : ""}${finding.reference ? `${finding.reference}: ` : ""}${finding.message}`));
    await writeResult(`${lines.join("\n")}\n`, "", stdout);
  }
  if (!report.passed) process.exitCode = 1;
}

async function exportCommand(projectPath, options, registry, stdout) {
  const collection = await loadProject(projectPath);
  const feature = selectedFeature(collection, options.feature || "");
  if (!feature) throw new TypeError("Feature suite untuk ekspor tidak ditemukan.");
  const template = options.template || "markdown";
  if (!Object.hasOwn(EXPORT_TEMPLATES, template) && !registry.has("exporter", template)) {
    throw new TypeError(`Template ekspor ${template} tidak dikenal.`);
  }
  let result;
  if (registry.has("exporter", template)) result = await registry.execute("exporter", template, feature.cases, { command: "export", feature, options });
  else result = createExport(feature.cases, { template, outputLanguage: options.language, delimiter: options.delimiter });
  const content = typeof result === "string" ? result : result?.content;
  if (typeof content !== "string") throw new TypeError(`Exporter ${template} tidak menghasilkan content string.`);
  const output = options.output || "";
  await writeResult(content, output, stdout);
}

async function compareCommand(projectPath, options, stdout) {
  const collection = await loadProject(projectPath);
  const feature = selectedFeature(collection, options.feature || "");
  if (!feature) throw new TypeError("Feature suite untuk perbandingan tidak ditemukan.");
  const comparison = compareTestRuns(feature, options.baseline || "", options.target || "");
  const output = {
    feature: { id: feature.id, name: feature.name },
    baseline: { id: comparison.baseline.id, name: comparison.baseline.name, passRate: comparison.baselineRate.rate },
    target: { id: comparison.target.id, name: comparison.target.name, passRate: comparison.targetRate.rate },
    passRateDelta: comparison.passRateDelta,
    newCases: comparison.newCases.map((item) => item.caseId),
    newFailures: comparison.newFailures.map((item) => item.caseId),
    fixed: comparison.fixed.map((item) => item.caseId),
    regressions: comparison.regressions.map((item) => item.caseId),
    activeBlockers: comparison.activeBlockers.map((item) => item.caseId),
  };
  await writeResult(`${JSON.stringify(output, null, 2)}\n`, options.output, stdout);
}

export async function main(argv = process.argv.slice(2), io = process) {
  const { command, positional, options } = parseArguments(argv);
  if (!command || options.help || command === "help") { io.stdout.write(`${HELP}\n`); return; }
  const registry = await loadPlugins(options.plugin);
  if (command === "generate") return generateCommand(options, registry, io.stdout);
  if (command === "validate") return validateCommand(positional[0], options, registry, io.stdout);
  if (command === "export") return exportCommand(positional[0], options, registry, io.stdout);
  if (command === "compare") return compareCommand(positional[0], options, io.stdout);
  throw new TypeError(`Perintah ${command} tidak dikenal.\n\n${HELP}`);
}

const isDirectExecution = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`Casecraft: ${error.message}\n`);
    process.exitCode = 2;
  });
}
