import { expect, test } from "@playwright/test";

const requirement = `
Acceptance criteria:
- Given pengguna berada di halaman pembayaran When pengguna membayar invoice valid Then status invoice berubah menjadi Lunas.
- Minimal pembayaran 10 dan maksimal 100 transaksi per hari.
- Jika gateway timeout, sistem menampilkan error dan data pembayaran tidak berubah.
`;

async function generateSuite(page, feature = "Pembayaran") {
  await page.goto("/index.html");
  await page.getByLabel("Nama fitur").fill(feature);
  await page.locator("#requirement").fill(requirement);
  await page.getByRole("button", { name: "Buat dan tinjau fitur" }).click();
  await expect(page).toHaveURL(/management\.html/);
  await expect(page.locator("#suite-feature-name")).toHaveText(feature);
  await expect(page.locator("#test-case-body tr")).not.toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); indexedDB.deleteDatabase("casecraft-local"); });
});

test("validasi dan generate menyimpan suite lalu membuka manajemen", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Buat dan tinjau fitur" }).click();
  await expect(page.locator("#feature-error")).toContainText("Nama fitur wajib diisi");
  await expect(page.getByLabel("Nama fitur")).toBeFocused();

  await page.getByLabel("Nama fitur").fill("Pembayaran");
  await page.locator("#requirement").fill("Terlalu singkat");
  await page.getByRole("button", { name: "Buat dan tinjau fitur" }).click();
  await expect(page.locator("#requirement-error")).toContainText("sedikitnya 30 karakter");

  await page.locator("#requirement").fill(requirement);
  await page.getByRole("button", { name: "Buat dan tinjau fitur" }).click();
  await expect(page).toHaveURL(/management\.html/);
  await expect(page.locator("#traceability-summary")).not.toHaveText("0/0");
  expect(await page.locator("#test-case-body tr").count()).toBeGreaterThan(1);
});

test("filter, autosave, copy, dan download bekerja di browser", async ({ page }) => {
  await generateSuite(page);
  await page.locator("#case-qa-status").selectOption("Gagal");
  await page.locator("#case-reject-status").selectOption("Ditolak");
  await page.locator("#case-actual").fill("Gateway mengembalikan HTTP 500.");
  await expect(page.locator("#save-status")).toContainText("tersimpan");
  const selectedId = await page.locator("#selected-case-id").textContent();

  await page.reload();
  await expect(page.locator("#case-actual")).toHaveValue("Gateway mengembalikan HTTP 500.");
  await page.locator("#status-filter").selectOption("Gagal");
  await page.locator("#reject-filter").selectOption("Ditolak");
  await expect(page.locator("#test-case-body [data-open-case]" )).toHaveCount(1);
  await expect(page.locator("#selected-case-id")).toHaveText(selectedId);

  await page.getByRole("button", { name: "Atur ekspor" }).click();
  if (await page.locator("#quality-override").isVisible()) {
    await expect(page.locator("#copy-export")).toBeDisabled();
    await page.locator("#quality-override").check();
  }
  await page.locator("#export-template").selectOption("markdown");
  await page.getByRole("button", { name: "Salin hasil" }).click();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("ID Test Case");

  await page.locator("#export-template").selectOption("csv");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh file" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/pembayaran-csv\.csv$/);
});

test("keyboard sorting dan viewport sempit mempertahankan tabel lengkap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await generateSuite(page, "Pembayaran mobile");
  const sortButton = page.getByRole("button", { name: /^Skenario uji/ });
  await sortButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('th[data-sort-column="scenario"]')).toHaveAttribute("aria-sort", "ascending");
  await page.keyboard.press("Enter");
  await expect(page.locator('th[data-sort-column="scenario"]')).toHaveAttribute("aria-sort", "descending");

  await page.locator("#case-search").focus();
  await page.keyboard.type("tidak ditemukan");
  await expect(page.locator("#test-case-body")).toContainText("Tidak ada test case yang cocok");
  await page.locator("#reset-filters").press("Enter");
  await expect(page.locator("#test-case-body [data-open-case]").first()).toBeVisible();

  const overflow = await page.locator(".repository-table-frame").evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(overflow.scroll).toBeGreaterThan(overflow.client);
  await expect(page.locator("#configure-export")).toBeVisible();
});

test("rename, archive restore, tag, dan bulk status menjaga scope suite aktif", async ({ page }) => {
  await generateSuite(page, "Login");
  await page.locator("#rename-suite").click();
  await page.locator("#rename-input").fill("Autentikasi");
  await page.getByRole("button", { name: "Simpan nama" }).click();
  await expect(page.locator("#suite-feature-name")).toHaveText("Autentikasi");

  await generateSuite(page, "Checkout");
  await page.locator("#archive-suite").click();
  await page.locator("#confirm-action").click();
  await expect(page.locator("#suite-feature-name")).toHaveText("Autentikasi");
  await page.locator("#archive-disclosure").click();
  await page.getByRole("button", { name: "Pulihkan" }).click();
  await expect(page.locator("#suite-feature-name")).toHaveText("Checkout");

  await page.locator("#edit-case").click();
  await page.locator("#editor-tags").fill("smoke, mobile");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.locator("#tag-filter").selectOption("smoke");
  await expect(page.locator("#test-case-body [data-open-case]")).toHaveCount(1);
  await page.locator("#reset-filters").click();

  await page.locator("#select-visible").check();
  const selected = await page.locator("#test-case-body [data-select-case]:checked").count();
  await page.locator("#bulk-status").selectOption("Gagal");
  await page.locator("#apply-bulk").click();
  await page.locator("#confirm-action").click();
  await expect(page.locator("#summary-failed")).toHaveText(String(selected));
});

test("impor Gherkin lokal dan profil reusable menghasilkan draft yang dapat ditinjau", async ({ page }) => {
  await page.goto("/index.html");
  const gherkin = `Feature: Login anggota
Scenario Outline: Login dengan kredensial valid
  Given anggota aktif berada di halaman login
  When anggota mengisi email <email> dan kata sandi <password>
  Then dashboard anggota ditampilkan
Examples:
  | email | password |
  | qa@example.test | benar-123 |`;

  await page.locator("#specification-file").setInputFiles({
    name: "login.feature",
    mimeType: "text/plain",
    buffer: Buffer.from(gherkin),
  });
  await expect(page.locator("#specification-feedback")).toContainText("Gherkin: 1 skenario");
  await expect(page.getByLabel("Nama fitur")).toHaveValue("Login anggota");
  await page.locator("#test-profile").selectOption("authentication");
  await page.getByRole("button", { name: "Buat dan tinjau fitur" }).click();

  await expect(page).toHaveURL(/management\.html/);
  await expect(page.locator("#generation-warnings")).toContainText("profil reusable");
  await expect(page.locator("#test-case-body")).toContainText("Profil Autentikasi");
  await page.getByRole("button", { name: /Login dengan kredensial valid/ }).click();
  await expect(page.locator("#parameter-count")).toHaveText("1 kombinasi");
  await expect(page.locator("#parameter-body")).toContainText("qa@example.test");
});

test("requirement versioning menandai impact dan parameter serta risiko dapat disesuaikan", async ({ page }) => {
  await generateSuite(page);
  await page.getByRole("button", { name: "Versi baru" }).click();
  const nextRequirement = requirement
    .replace("status invoice berubah menjadi Lunas", "status invoice berubah menjadi Selesai dan waktu bayar tersimpan")
    .concat("\n- Given auditor membuka invoice When melihat riwayat Then waktu bayar terlihat.");
  await page.locator("#version-text").fill(nextRequirement);
  await page.getByRole("button", { name: "Analisis dampak" }).click();
  await expect(page.locator("#version-preview")).toContainText("v1 → v2");
  await page.getByRole("button", { name: "Terapkan versi baru" }).click();
  await expect(page.locator("#traceability-list")).toContainText("v2");
  await expect(page.locator("#selected-case-impact")).toContainText(/Perlu diperbarui|Jalankan ulang/);

  await page.locator("#edit-case").click();
  await page.locator("#editor-parameters").fill("Minimum | nominal=10 | Diterima\nDi luar minimum | nominal=9 | Ditolak");
  await page.locator("#risk-impact").selectOption("5");
  await page.locator("#risk-probability").selectOption("5");
  await page.locator("#risk-complexity").selectOption("5");
  await page.locator("#risk-regression").selectOption("5");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(page.locator("#parameter-count")).toHaveText("2 kombinasi");
  await expect(page.locator("#risk-score")).toHaveText("100 · Tinggi");
});

test("quality gate memblokir ekspor bermasalah dan menyediakan override draft", async ({ page }) => {
  await generateSuite(page);
  await page.locator("#case-qa-status").selectOption("Gagal");
  await page.getByRole("button", { name: "Atur ekspor" }).click();

  await expect(page.locator("#quality-gate-summary")).toContainText("error");
  await expect(page.locator("#quality-gate-list")).toContainText("Kasus gagal belum memiliki hasil aktual");
  await expect(page.locator("#copy-export")).toBeDisabled();
  await expect(page.locator("#download-export")).toBeDisabled();
  await page.locator("#quality-override").check();
  await expect(page.locator("#copy-export")).toBeEnabled();
  await expect(page.locator("#download-export")).toBeEnabled();
});

test("perbandingan build dan laporan QA memakai riwayat cycle, defect, blocker, dan risiko", async ({ page }) => {
  await generateSuite(page, "Checkout release");
  await page.locator("#case-qa-status").selectOption("Lulus");

  await page.getByRole("button", { name: "Siklus baru" }).click();
  await page.locator("#cycle-name").fill("Release 1.1");
  await page.locator("#cycle-build").fill("1.1.0");
  await page.locator("#cycle-environment").fill("Staging");
  await page.locator("#cycle-browser").fill("Chromium");
  await page.getByRole("button", { name: "Buat siklus" }).click();
  await page.locator("#case-qa-status").selectOption("Gagal");
  await page.locator("#case-actual").fill("Status invoice tidak berubah.");
  await page.locator("#case-defect-reference").fill("BUG-142");

  await page.getByRole("button", { name: "Bandingkan run" }).click();
  await expect(page.locator("#comparison-result")).toContainText("Regression baru");
  await expect(page.locator("#comparison-result")).toContainText("TC_CR_001");
  await page.locator("#compare-close").click();

  await page.getByRole("button", { name: "Laporan QA" }).click();
  await page.locator("#report-baseline").selectOption("CYCLE-001");
  await expect(page.locator("#report-preview")).toContainText("1 referensi defect");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh HTML" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/checkout-release-qa-report\.html$/);
  await expect(page.getByRole("button", { name: "Cetak / simpan PDF" })).toBeEnabled();
});

test("adapter lokal dan bahasa output Inggris tidak mengubah generator inti", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByLabel("Bahasa antarmuka").selectOption("en");
  await expect(page.locator("#page-title")).toHaveText("Build the testing foundation.");
  await page.getByLabel("Feature name").fill("Regional profile");
  await page.locator("#requirement-language").selectOption("en");
  await page.locator("#output-language").selectOption("en");
  await page.locator("#requirement").fill("Given a member has a valid profile When the member saves it Then profile status becomes Active.");
  await page.getByRole("button", { name: "Create and review feature" }).click();
  await expect(page).toHaveURL(/management\.html/);
  await expect(page.locator("#case-steps")).toContainText(/Prepare valid data|Perform action/);

  await page.getByRole("button", { name: "Configure export" }).click();
  await page.locator("#export-template").selectOption("azure");
  expect(await page.locator("#export-error").textContent()).toBe("");
  await expect(page.locator("#export-preview")).toHaveValue(/Casecraft ID/);
  await expect(page.locator("#export-preview")).toHaveValue(/Untested/);
  await page.locator("#export-template").selectOption("internal");
  await expect(page.locator("#export-preview")).toHaveValue(/"format": "casecraft-adapter"/);
});

test("readiness, skeleton draft, dan pairwise terhubung ke test case terpilih", async ({ page }) => {
  await generateSuite(page, "Automation checkout");
  await expect(page.locator("#automation-readiness-score")).toHaveText("60%");
  await page.locator("#automation-selector").fill("[data-testid='pay']");
  await page.locator("#automation-selector").press("Tab");
  await page.locator("#automation-cleanup").fill("Hapus transaksi uji.");
  await page.locator("#automation-cleanup").press("Tab");
  await expect(page.locator("#automation-readiness-score")).toHaveText("100%");
  await page.locator("#automation-review").selectOption("approved");
  await page.getByRole("button", { name: "Buat skeleton automation" }).click();
  await expect(page.locator("#skeleton-preview")).toHaveValue(/Review engineer wajib/);
  await page.locator("#skeleton-framework").selectOption("cypress");
  await expect(page.locator("#skeleton-preview")).toHaveValue(/cy\.get/);
  await page.locator("#skeleton-close").click();

  await page.locator(".pairwise-disclosure summary").click();
  await page.locator("#pairwise-factors").fill("browser=Chrome|Firefox|Safari\nrole=admin|member\nlocale=id|en");
  await page.getByRole("button", { name: "Buat kombinasi pairwise" }).click();
  await expect(page.locator("#pairwise-feedback")).toContainText("kombinasi pairwise");
  await expect(page.locator("#parameter-count")).not.toHaveText("0 kombinasi");
});

test("laporan automation lokal memperbarui cycle dan coverage map", async ({ page }) => {
  await generateSuite(page, "Automation result");
  const caseId = await page.locator("#selected-case-id").textContent();
  const junit = `<testsuite><testcase classname="checkout" name="${caseId} payment"><failure message="HTTP 500">trace</failure></testcase></testsuite>`;
  await page.locator("#automation-report-file").setInputFiles({ name: "junit.xml", mimeType: "application/xml", buffer: Buffer.from(junit) });
  await expect(page.locator("#automation-report-preview")).toContainText(caseId);
  await page.getByRole("button", { name: "Terapkan ke test run" }).click();
  await expect(page.locator("#case-qa-status")).toHaveValue("Gagal");
  await expect(page.locator("#test-case-body .automation-label").first()).toHaveText("Automated");
  await expect(page.locator("#automation-coverage-summary")).toContainText("Automated");
});

test("Test Data Studio membuat boundary fixture, masking, dan unduhan lokal", async ({ page }) => {
  await generateSuite(page, "Fixture checkout");
  await page.getByRole("button", { name: "Test data studio" }).click();
  await page.locator("#test-data-definitions").fill("email:email\namount:integer,min=1,max=10\ncustomerId:string,minLength=3,maxLength=6");
  await page.locator("#test-data-count").fill("2");
  await page.locator("#test-data-seed").fill("release-42");
  await page.getByRole("button", { name: "Proses data" }).click();
  await expect(page.locator("#test-data-preview")).toHaveValue(/"amount": 0/);
  await expect(page.locator("#test-data-preview")).toHaveValue(/@example\.test/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fixture-checkout-fixture.json");

  await page.locator("#test-data-mode").selectOption("mask");
  await page.locator("#test-data-source").fill(JSON.stringify({ email: "person@company.test", token: "raw-secret", publicLabel: "Demo" }));
  await page.getByRole("button", { name: "Proses data" }).click();
  await expect(page.locator("#test-data-preview")).not.toHaveValue(/raw-secret/);
  await expect(page.locator("#test-data-preview")).toHaveValue(/"publicLabel": "Demo"/);
});

test("flaky management membaca retry evidence tanpa menetapkan diagnosis final", async ({ page }) => {
  await generateSuite(page, "Flaky checkout");
  const caseId = await page.locator("#selected-case-id").textContent();
  const report = {
    config: {},
    suites: [{ title: "checkout", specs: [{ title: `${caseId} payment`, tests: [{ title: "recovers", results: [{ status: "failed", error: { message: "timeout" } }, { status: "passed" }] }] }] }],
  };
  await page.locator("#automation-report-file").setInputFiles({ name: "playwright.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(report)) });
  await page.getByRole("button", { name: "Terapkan ke test run" }).click();
  await page.getByRole("button", { name: "Analisis flaky" }).click();
  await expect(page.locator("#flaky-summary")).toContainText("1 flaky");
  await expect(page.locator("#flaky-body")).toContainText(caseId);
  await expect(page.locator("#flaky-body")).toContainText("Kemungkinan masalah automation");
  await expect(page.locator("#flaky-dialog")).toContainText("bukan diagnosis final");
});

test("Lab desain pengujian membuat sembilan artefak deterministik tanpa jaringan", async ({ page }) => {
  await generateSuite(page, "Advanced design");
  await page.getByRole("button", { name: "Lab desain pengujian" }).click();

  await page.locator("#model-source").fill("name: Order\ninitial: Draft\nDraft -- submit --> Submitted");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/MBT-V-001/);
  await expect(page.locator("#design-lab-warning")).toContainText("transisi invalid belum didefinisikan");

  await page.locator("#design-lab-mode").selectOption("fuzz");
  await page.locator("#fuzz-rules").fill("amount:integer,min=1,max=10\nrole:enum,values=admin|member");
  await page.locator("#fuzz-properties").fill("Amount valid mengikuti kontrak");
  await page.locator("#fuzz-runs").fill("6");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/"id": "FUZZ-0006"/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/"amount": 0/);

  await page.locator("#design-lab-mode").selectOption("visual");
  await page.locator("#visual-baselines").setInputFiles({ name: "checkout.png", mimeType: "image/png", buffer: Buffer.from("local-baseline") });
  await expect(page.locator("#visual-file-status")).toContainText("1 baseline valid");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/"sha256": "[a-f0-9]{64}"/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/"id": "VR-016"/);

  await page.locator("#design-lab-mode").selectOption("accessibility");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/A11Y-KB-001/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/A11Y-DIALOG-001/);

  await page.locator("#design-lab-mode").selectOption("performance");
  await page.locator("#performance-method").selectOption("POST");
  await page.locator("#performance-body").fill('{"productId":"fixture"}');
  await page.locator("#performance-data").fill("Gunakan fixture sintetis dan hapus order setelah run.");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/import http from 'k6\/http'/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh hasil" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("advanced-design-performance.k6.js");

  await page.locator("#design-lab-mode").selectOption("security");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/SEC-AUTH-001/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/OWASP API4:2023/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/tidak membuktikan keamanan/);

  await page.locator("#design-lab-mode").selectOption("mobile");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/"id": "MOBILE-0048"/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/"network": "Slow 3G"/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/"keyboard": "open"/);

  await page.locator("#design-lab-mode").selectOption("migration");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/Data migration test plan/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/backward-compatibility/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/Rekonsiliasi order_count/);

  await page.locator("#design-lab-mode").selectOption("localization");
  await page.getByRole("button", { name: "Buat rancangan" }).click();
  await expect(page.locator("#design-lab-preview")).toHaveValue(/casecraft-localization-test-plan/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/Asia\/Jakarta/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/long-translation/);
  await expect(page.locator("#design-lab-preview")).toHaveValue(/fallback/);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Lab desain pengujian" })).toBeFocused();
});

test("Git diff dan dependency graph memberi evidence lokal tanpa akses repository", async ({ page }) => {
  await generateSuite(page, "Pembayaran regression");
  const caseId = await page.locator("#selected-case-id").textContent();
  const diff = "diff --git a/src/pembayaran/gateway.js b/src/pembayaran/gateway.js\n+++ b/src/pembayaran/gateway.js\n+function pembayaranGatewayTimeout() {}";
  await page.locator("#git-diff-file").setInputFiles({ name: "release.patch", mimeType: "text/plain", buffer: Buffer.from(diff) });
  await expect(page.locator("#diff-preview")).toContainText(caseId);
  await page.locator("#diff-close").click();
  await page.getByRole("button", { name: "Peta dependensi" }).click();
  await expect(page.locator("#dependency-summary")).toContainText(/node.*relasi/);
  await expect(page.locator("#dependency-graph")).toContainText(caseId);
});

test("OpenAPI lokal menghasilkan contract, authorization, error, dan boundary cases", async ({ page }) => {
  await page.goto("/index.html");
  const openapi = { openapi: "3.1.0", info: { title: "Orders API" }, security: [{ bearerAuth: [] }], paths: { "/orders": { post: { parameters: [{ name: "limit", required: true, schema: { minimum: 1, maximum: 10 } }], responses: { 201: { description: "Created", content: { "application/json": { schema: { type: "object" } } } }, 401: { description: "Unauthorized", content: { "application/json": { schema: { type: "object" } } } }, 422: { description: "Invalid" } } } } } };
  await page.locator("#specification-file").setInputFiles({ name: "orders.openapi.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(openapi)) });
  await expect(page.locator("#specification-feedback")).toContainText("OpenAPI");
  await page.getByRole("button", { name: "Buat dan tinjau fitur" }).click();
  await expect(page.locator("#test-case-body")).toContainText("tanpa authorization");
  await page.getByRole("button", { name: /POST \/orders menghasilkan 201/ }).click();
  await expect(page.locator("#case-expected")).toContainText("response schema");
  await expect(page.locator("#parameter-body")).toContainText("di luar minimum");
});

test("PWA memuat ulang workspace shell saat browser offline", async ({ page, context }) => {
  await page.goto("/index.html");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#connection-status")).toContainText("Offline");
  await expect(page.locator("#generator-form")).toBeVisible();
  await context.setOffline(false);
});
