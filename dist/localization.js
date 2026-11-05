const STORAGE_KEY = "casecraft.interfaceLanguage";
const translations = new Map(Object.entries({
  "Lewati ke area kerja": "Skip to workspace", "Navigasi utama": "Main navigation", "Manajemen": "Management",
  "Diproses di browser": "Processed in the browser", "Susun fondasi pengujian.": "Build the testing foundation.",
  "Review board untuk QA.": "QA review board.", "Nama fitur": "Feature name", "Requirement": "Requirement",
  "Profil test reusable": "Reusable test profile", "Spesifikasi terstruktur": "Structured specification",
  "Impor file lokal": "Import local file", "Cakupan pengujian": "Test coverage", "Buat dan tinjau fitur": "Create and review feature",
  "Gunakan contoh": "Use example", "Feature suites": "Feature suites", "Siklus baru": "New cycle", "Siklus aktif": "Active cycle",
  "Pemulihan lokal": "Local recovery", "Simpan lintas sesi": "Persist across sessions", "Gunakan IndexedDB": "Use IndexedDB",
  "Versi baru": "New version", "Tambah requirement terkait": "Add related requirement", "Ubah nama": "Rename", "Arsipkan": "Archive",
  "Buat manual": "Create manually", "Buat dari requirement": "Create from requirement", "Cari test case": "Search test cases",
  "Kategori": "Category", "Prioritas": "Priority", "Status QA": "QA status", "Status reject": "Reject status", "Tag": "Tag",
  "Reset filter": "Reset filters", "Risiko": "Risk", "Pilih test case": "Select a test case", "Edit": "Edit", "Duplikasi": "Duplicate",
  "Hapus": "Delete", "Langkah uji": "Test steps", "Data uji": "Test data", "Kombinasi parameter": "Parameter combinations",
  "Hasil aktual": "Actual result", "Referensi defect": "Defect reference", "Blocker": "Blocker", "Riwayat eksekusi": "Execution history",
  "Ekspor proyek": "Export project", "Impor proyek": "Import project", "Atur ekspor": "Configure export", "Bandingkan run": "Compare runs",
  "Laporan QA": "QA report", "Lulus": "Passed", "Gagal": "Failed", "Terblokir": "Blocked", "Belum diuji": "Untested",
  "Semua status": "All statuses", "Semua kategori": "All categories", "Semua prioritas": "All priorities", "Semua tag": "All tags",
  "Batal": "Cancel", "Simpan perubahan": "Save changes", "Terapkan": "Apply", "Salin hasil": "Copy result", "Unduh file": "Download file",
  "Bahasa antarmuka": "Interface language", "Bahasa requirement": "Requirement language", "Bahasa output": "Output language",
  "Bahasa Indonesia": "Indonesian", "Deteksi otomatis": "Auto-detect", "Inggris": "English", "Instal aplikasi": "Install app",
  "Perbandingan test run": "Test run comparison", "Pilih baseline dan target untuk melihat perubahan hasil eksekusi.": "Select a baseline and target to review execution changes.",
  "Automation workspace": "Automation workspace", "Manual ↔ automation": "Manual ↔ automation", "Impor hasil": "Import results",
  "Analisis Git diff": "Analyze Git diff", "Peta dependensi": "Dependency map", "Automation readiness": "Automation readiness",
  "Kesiapan automation": "Automation readiness", "Coverage status": "Coverage status", "Kandidat automation": "Automation candidate",
  "Tidak layak diotomasi": "Not suitable for automation", "Review skeleton": "Skeleton review", "Belum disetujui": "Not approved",
  "Disetujui QA": "Approved by QA", "Selector / target request": "Selector / request target", "Cleanup": "Cleanup",
  "Buat skeleton automation": "Generate automation skeleton", "Generate kombinasi pairwise": "Generate pairwise combinations",
  "Faktor dan nilai": "Factors and values", "Buat kombinasi pairwise": "Generate pairwise combinations",
  "Automation skeleton": "Automation skeleton", "Framework": "Framework", "Preview draft": "Draft preview",
  "Salin skeleton": "Copy skeleton", "Unduh draft": "Download draft", "Hasil automation": "Automation results",
  "Test cycle tujuan": "Target test cycle", "Terapkan ke test run": "Apply to test run", "Change analysis dari Git diff": "Git diff change analysis",
  "Peta dependensi test": "Test dependency map", "Test data studio": "Test data studio", "Analisis flaky": "Analyze flaky tests",
  "Test Data Studio": "Test Data Studio", "Mode": "Mode", "Buat dataset sintetis": "Generate synthetic dataset",
  "Masking JSON sensitif": "Mask sensitive JSON", "Definisi field": "Field definitions", "Jumlah record": "Record count",
  "Seed deterministik": "Deterministic seed", "Tambahkan variasi boundary eksplisit": "Add explicit boundary variations",
  "JSON yang akan dimasking": "JSON to mask", "Field sensitif tambahan": "Additional sensitive fields",
  "Preview fixture": "Fixture preview", "Proses data": "Process data", "Unduh CSV": "Download CSV", "Unduh JSON": "Download JSON",
  "Flaky-test management": "Flaky-test management", "Test case": "Test case", "Klasifikasi": "Classification",
  "Environment": "Environment", "Evidence": "Evidence",
  "Lab desain pengujian": "Test design lab", "Jenis rancangan": "Design type", "State machine / diagram alur": "State machine / flow diagram",
  "Aturan input": "Input rules", "Invariant / property": "Invariant / property", "Jumlah variasi": "Variation count",
  "Nama rencana": "Plan name", "Halaman": "Pages", "Tema": "Themes", "Area yang boleh berubah": "Allowed change regions",
  "Baseline screenshot": "Screenshot baselines", "Scope halaman / alur": "Page / flow scope", "Pola komponen dalam scope": "Component patterns in scope",
  "Nama workload": "Workload name", "Format draft": "Draft format", "Metode HTTP": "HTTP method", "Path target": "Target path",
  "Profil workload": "Workload profile", "Durasi total (detik)": "Total duration (seconds)", "Ramp-up (detik)": "Ramp-up (seconds)",
  "Volume data": "Data volume", "p95 maksimum (ms)": "Maximum p95 (ms)", "Error rate maksimum (%)": "Maximum error rate (%)",
  "Throughput minimum (req/s)": "Minimum throughput (req/s)", "Request body JSON (opsional)": "Request body JSON (optional)",
  "Strategi data dan cleanup": "Data and cleanup strategy", "Preview rancangan": "Plan preview", "Buat rancangan": "Generate plan", "Unduh hasil": "Download result",
  "Security test catalogue": "Security test catalogue", "Scope keamanan": "Security scope", "Authorization": "Authorization",
  "Session": "Session", "Input injection": "Input injection", "Data exposure": "Data exposure", "Rate limit": "Rate limit", "Abuse case": "Abuse case",
  "Mobile device matrix": "Mobile device matrix", "Perangkat": "Devices", "Orientasi": "Orientation", "Kondisi jaringan": "Network conditions", "Virtual keyboard": "Virtual keyboard",
  "Data migration testing": "Data migration testing", "Nama migrasi": "Migration name", "Versi sumber": "Source versions", "Versi target": "Target version",
  "Entitas dan integritas": "Entities and integrity", "Backward compatibility": "Backward compatibility", "Rollback": "Rollback", "Rekonsiliasi": "Reconciliation",
  "Localization testing": "Localization testing", "Scope localization": "Localization scope", "Locale, timezone, dan currency": "Locale, timezone, and currency",
  "Timestamp contoh": "Sample timestamp", "Angka contoh": "Sample number", "Nilai pluralisasi": "Plural values", "Fallback locale": "Fallback locale",
  "Surface dan teks panjang": "Surfaces and long text", "Ekspansi teks (%)": "Text expansion (%)", "Teks campuran": "Mixed text",
}));

const reverseTranslations = new Map([...translations].map(([id, en]) => [en, id]));
const sourceText = new WeakMap();

export function interfaceLanguage() {
  try { return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "id"; } catch { return "id"; }
}

function translateTextNode(node, language) {
  const trimmed = node.nodeValue.trim();
  if (!trimmed) return;
  if (!sourceText.has(node)) sourceText.set(node, reverseTranslations.get(trimmed) || trimmed);
  const source = sourceText.get(node);
  const translated = language === "en" ? translations.get(source) || source : source;
  node.nodeValue = node.nodeValue.replace(trimmed, translated);
}

export function applyInterfaceLanguage(language = interfaceLanguage(), root = document.body) {
  const locale = language === "en" ? "en" : "id";
  document.documentElement.lang = locale;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (!["SCRIPT", "STYLE", "TEXTAREA"].includes(node.parentElement?.tagName)) translateTextNode(node, locale);
    node = walker.nextNode();
  }
  root.querySelectorAll?.("[placeholder]").forEach((element) => {
    if (!element.dataset.placeholderId) element.dataset.placeholderId = reverseTranslations.get(element.placeholder) || element.placeholder;
    element.placeholder = locale === "en" ? translations.get(element.dataset.placeholderId) || element.dataset.placeholderId : element.dataset.placeholderId;
  });
  return locale;
}

export function initLocalization() {
  const selector = document.querySelector("#interface-language");
  const current = interfaceLanguage();
  if (selector) selector.value = current;
  applyInterfaceLanguage(current);
  selector?.addEventListener("change", () => {
    const language = selector.value === "en" ? "en" : "id";
    try { localStorage.setItem(STORAGE_KEY, language); } catch { /* Session still works without preference persistence. */ }
    applyInterfaceLanguage(language);
    document.dispatchEvent(new CustomEvent("casecraft:language", { detail: { language } }));
  });
  const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) applyInterfaceLanguage(interfaceLanguage(), node);
    else if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, interfaceLanguage());
  })));
  observer.observe(document.body, { childList: true, subtree: true });
}

