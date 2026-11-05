import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAccessibilityPlan,
  buildFuzzPlan,
  buildLocalizationTestPlan,
  buildMigrationTestPlan,
  buildMobileDeviceMatrix,
  buildModelTestPlan,
  buildPerformanceDraft,
  buildSecurityCatalogue,
  buildVisualRegressionPlan,
  parseFuzzRules,
  parseStateModel,
} from "../dist/advanced-test-design.js";

test("model-based planner creates only declared valid, invalid, and recovery behavior", () => {
  const plan = buildModelTestPlan(`name: Payment\ninitial: Draft\nDraft -- pay --> Processing\nProcessing -- success --> Paid\ninvalid: Paid | pay | State tetap Paid\nrecovery: Failed | retry | Processing`);
  assert.equal(plan.model.initial, "Draft");
  assert.deepEqual(plan.cases.map((item) => item.type), ["valid", "valid", "invalid", "recovery"]);
  assert.match(plan.content, /State tetap Paid/);
  assert.equal(plan.warnings.length, 0);

  const incomplete = buildModelTestPlan("Draft --> Paid: pay");
  assert.equal(incomplete.cases.length, 1);
  assert.equal(incomplete.warnings.length, 2);
  assert.throws(() => parseStateModel("Draft to Paid"), /tidak dikenali/);
});

test("property and fuzz plan is seeded, bounded, and keeps missing invariants visible", () => {
  const input = { rules: "amount:integer,min=1,max=10\ncode:string,minLength=2,maxLength=4\nrole:enum,values=admin|member", properties: "Amount valid berada pada rentang kontrak", runs: 8, seed: "release-9" };
  const first = buildFuzzPlan(input);
  const second = buildFuzzPlan(input);
  assert.deepEqual(first.plan.records, second.plan.records);
  assert.equal(first.plan.records[0].input.amount, 1);
  assert.equal(first.plan.records[2].input.amount, 0);
  assert.equal(first.plan.records[3].input.amount, 11);
  assert.equal(first.plan.properties.length, 1);
  assert.equal(buildFuzzPlan({ ...input, properties: "" }).warnings.length, 1);
  assert.throws(() => parseFuzzRules("amount:integer,min=1"), /membutuhkan min dan max/);
});

test("visual regression plan creates an explicit cross-product with baseline evidence", () => {
  const result = buildVisualRegressionPlan({
    name: "Checkout",
    pages: "Checkout | /checkout\nSuccess | /checkout/success",
    viewports: "desktop=1440x900\nmobile=390x844",
    themes: "light,dark",
    locales: "id-ID,en-US",
    allowedRegions: "[data-clock] | waktu dinamis",
    baselines: [{ name: "checkout.png", size: 42, type: "image/png", sha256: "abc" }],
  });
  assert.equal(result.plan.matrix.length, 16);
  assert.equal(result.plan.baselines[0].sha256, "abc");
  assert.equal(result.warnings.length, 0);
  assert.equal(buildVisualRegressionPlan({ name: "X", pages: "X | /x", viewports: "m=390x844", themes: "light", locales: "id", allowedRegions: "", baselines: [] }).warnings.length, 2);
});

test("accessibility workbench covers core flows and selected component patterns", () => {
  const result = buildAccessibilityPlan({ scope: "Checkout", patterns: ["form", "dialog", "form"] });
  assert.equal(result.checks.length, 7);
  assert.ok(result.checks.some((check) => check.id === "A11Y-ZOOM-001"));
  assert.ok(result.checks.some((check) => check.id === "A11Y-DIALOG-001"));
  assert.match(result.content, /bukan bukti konformitas otomatis/);
});

test("performance designer emits deterministic review-only k6 and JMeter drafts", () => {
  const config = { name: "Checkout load", method: "POST", path: "/checkout", workload: "load", concurrency: 20, duration: 120, rampUp: 30, dataVolume: 1000, p95: 500, errorRate: 1, throughput: 10, body: '{"productId":"fixture"}', dataStrategy: "Fixture sintetis dan cleanup order." };
  const k6 = buildPerformanceDraft({ ...config, format: "k6" });
  assert.match(k6.content, /p\(95\)<500/);
  assert.match(k6.content, /rate<0\.01/);
  assert.match(k6.content, /__ENV\.BASE_URL/);
  assert.equal(k6.warnings.length, 0);
  const jmeter = buildPerformanceDraft({ ...config, format: "jmeter", name: "Load & smoke" });
  assert.match(jmeter.content, /Load &amp; smoke/);
  assert.match(jmeter.content, /TARGET_P95_MS/);
  assert.match(jmeter.content, /DATA_VOLUME/);
  assert.equal(jmeter.extension, "jmx");
  assert.throws(() => buildPerformanceDraft({ ...config, rampUp: 120 }), /Ramp-up/);
  assert.throws(() => buildPerformanceDraft({ ...config, body: "{invalid}" }), /JSON valid/);
});

test("security catalogue maps explicit contracts to OWASP-labelled review scenarios", () => {
  const result = buildSecurityCatalogue({
    scope: "Checkout",
    authorization: "member | own invoice | allow\nmember | other invoice | deny",
    sessions: "idle 15m | idle-timeout=15m | Session berakhir",
    injections: "coupon | query | Input tetap data",
    exposures: "invoice response | paymentToken | payment-service",
    rateLimits: "OTP | 5 | 10m | Request keenam ditolak",
    abuseCases: "coupon | reuse | one-use guard | Credit satu kali",
  });
  assert.equal(result.cases.length, 7);
  assert.match(result.content, /API4:2023/);
  assert.match(result.content, /tidak membuktikan keamanan/);
  assert.equal(result.warnings.length, 0);
  assert.equal(buildSecurityCatalogue({ scope: "X", authorization: "member | invoice | deny" }).warnings.length, 5);
  assert.throws(() => buildSecurityCatalogue({ scope: "X", authorization: "member | invoice | maybe" }), /allow atau deny/);
});

test("mobile matrix crosses device, OS, browser, orientation, network, and keyboard", () => {
  const result = buildMobileDeviceMatrix({ devices: "iPhone | iOS 18 | Safari | 393x852\nPixel | Android 15 | Chrome | 412x915", orientations: "portrait,landscape", networks: "Wi-Fi,Slow 3G", keyboards: "hidden,open" });
  assert.equal(result.plan.matrix.length, 16);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.plan.matrix[0].device.browser, "Safari");
  assert.equal(buildMobileDeviceMatrix({ devices: "Phone | OS | Browser | 390x844", orientations: "portrait", networks: "4G", keyboards: "hidden" }).warnings.length, 3);
  assert.throws(() => buildMobileDeviceMatrix({ devices: "Phone | OS | Browser | bad", orientations: "portrait", networks: "4G", keyboards: "hidden" }), /viewport/);
});

test("migration planner covers forward migration, integrity, compatibility, rollback, and reconciliation", () => {
  const result = buildMigrationTestPlan({ name: "Orders v3", sourceVersions: "v1,v2", targetVersion: "v3", entities: "orders | orderId | 100 | status,total", compatibility: "mobile-v2 | Tetap dapat membaca order", rollbacks: "batch gagal | Data kembali ke v2", reconciliations: "order_count | Count sama | 0" });
  assert.equal(result.cases.length, 7);
  assert.ok(["version-migration", "integrity", "backward-compatibility", "rollback", "reconciliation"].every((category) => result.cases.some((item) => item.category === category)));
  assert.equal(result.warnings.length, 0);
  assert.equal(buildMigrationTestPlan({ name: "X", sourceVersions: "v1", targetVersion: "v2", entities: "orders | id | 1 | status" }).warnings.length, 3);
});

test("localization planner produces long-text, locale formatting, timezone, plural, mixed, and fallback evidence", () => {
  const result = buildLocalizationTestPlan({ name: "Checkout", locales: "id-ID | Asia/Jakarta | IDR\nen-US | America/New_York | USD", instant: "2026-11-05T08:30:00Z", sampleNumber: 1234567.89, pluralCounts: "0,1,2", fallbackLocale: "id-ID", surfaces: "pay-button | Bayar sekarang | 24", expansion: 150, mixedText: "Invoice INV-123 — العربية 日本語" });
  assert.equal(result.plan.cases.length, 9);
  assert.ok(result.plan.cases.some((item) => item.category === "fallback"));
  assert.ok(result.plan.cases.some((item) => item.category === "mixed-text"));
  assert.equal(result.plan.samples[0].timeZone, "Asia/Jakarta");
  assert.throws(() => buildLocalizationTestPlan({ name: "X", locales: "id-ID | Bad/Zone | IDR", instant: "2026-01-01T00:00:00Z", sampleNumber: 1, fallbackLocale: "id-ID", surfaces: "x | X | 1", expansion: 100, mixedText: "X" }), /tidak didukung/);
});
