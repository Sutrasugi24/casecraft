import test from "node:test";
import assert from "node:assert/strict";
import { createExport } from "../dist/export-config.js";

const cases = [{
  id: "TC_PAY_001",
  module: "Pembayaran",
  scenario: "Bayar invoice",
  categoryLabel: "Happy path",
  testType: "Positif",
  priority: "High",
  qaStatus: "Lulus",
  rejectStatus: "Tidak ditolak",
  tags: ["smoke", "mobile"],
  steps: ["Buka invoice", "Bayar"],
  expected: "Pembayaran berhasil",
}];

test("configurable export supports Jira, Markdown, TSV, and generic CSV", () => {
  const jira = createExport(cases, { template: "jira", columns: ["scenario", "qaStatus"] });
  const markdown = createExport(cases, { template: "markdown", columns: ["id", "tags"] });
  const tsv = createExport(cases, { template: "tsv", columns: ["id", "scenario"] });
  const csv = createExport(cases, { template: "csv", columns: ["id", "scenario"], delimiter: ";" });

  assert.match(jira.content, /Summary,Status/);
  assert.match(markdown.content, /\| TC_PAY_001 \| smoke, mobile \|/);
  assert.match(tsv.content, /ID Test Case\tSkenario Uji/);
  assert.match(csv.content, /ID Test Case;Skenario Uji/);
  assert.equal(csv.extension, "csv");
});

test("export applies status mapping and rejects empty column selections", () => {
  const result = createExport(cases, { template: "csv", columns: ["qaStatus"], statusMapping: { Lulus: "Done" } });
  assert.match(result.content, /Done/);
  assert.throws(() => createExport(cases, { template: "csv", columns: [] }), /sedikitnya satu kolom/);
});
