const CATEGORY_LABELS = {
  happy: "Happy path",
  negative: "Negative",
  edge: "Edge case",
  regression: "Regression",
};

const STOP_HEADINGS = /^(deskripsi|description|kriteria penerimaan|acceptance criteria|requirement|requirements|catatan|notes?)\s*:? ?$/i;

export function sanitizePrefix(featureName = "") {
  const words = featureName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "FITUR";

  const initials = words.map((word) => word[0]).join("").toUpperCase();
  if (initials.length >= 2 && initials.length <= 8) return initials;

  return words.join("_").slice(0, 12).toUpperCase();
}

export function extractClauses(requirement = "") {
  const normalized = requirement
    .replace(/\r/g, "")
    .replace(/[•●▪◦]/g, "-")
    .replace(/\t/g, " ");

  const lineClauses = normalized
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .map((line) => line.replace(/^\*\*(.*?)\**:?$/, "$1").trim())
    .filter((line) => line.length > 8 && !STOP_HEADINGS.test(line));

  return [...new Set(lineClauses)].slice(0, 14);
}

function sentenceCase(text) {
  const clean = text.replace(/[.:;]+$/, "").trim();
  if (!clean) return "Requirement utama";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function concise(text, max = 92) {
  const clean = sentenceCase(text);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

function contains(text, words) {
  const source = text.toLowerCase();
  return words.some((word) => source.includes(word));
}

function moduleName(featureName) {
  return featureName.trim() || "Fitur yang diuji";
}

function buildCase(category, scenario, steps, expected, source = "") {
  return {
    category,
    scenario,
    steps,
    expected,
    source,
    actual: "",
    status: "",
  };
}

function genericContext(feature) {
  return `Buka halaman atau alur ${feature} dengan pengguna yang memiliki akses.`;
}

function happyCases(feature, clauses, fullText) {
  const cases = [];
  const mainClause = clauses[0] || `Pengguna menyelesaikan alur ${feature}`;

  cases.push(buildCase(
    "happy",
    `Menyelesaikan alur utama ${feature}`,
    [
      genericContext(feature),
      `Siapkan data valid yang memenuhi requirement.`,
      `Jalankan alur utama: ${concise(mainClause, 120)}.`,
      "Selesaikan aksi utama dan amati hasilnya.",
    ],
    `Alur ${feature} selesai tanpa error dan hasilnya sesuai requirement yang diberikan.`,
    mainClause,
  ));

  clauses.slice(0, 6).forEach((clause) => {
    cases.push(buildCase(
      "happy",
      `Memenuhi acceptance criteria: ${concise(clause, 70)}`,
      [
        genericContext(feature),
        "Siapkan precondition dan data valid.",
        `Lakukan aksi sesuai kriteria: ${concise(clause, 140)}.`,
        "Periksa data dan tampilan setelah aksi selesai.",
      ],
      `Sistem menjalankan kriteria “${concise(clause, 150)}” dan menampilkan hasil yang konsisten.`,
      clause,
    ));
  });

  if (contains(fullText, ["beberapa", "sekaligus", "multiple", "bulk", "seluruh perubahan"])) {
    cases.push(buildCase(
      "happy",
      "Memproses beberapa data dalam satu aksi",
      [
        genericContext(feature),
        "Ubah sedikitnya tiga data yang berbeda dengan nilai valid.",
        "Jalankan satu kali aksi utama untuk memproses seluruh perubahan.",
        "Periksa hasil pada setiap data yang diubah.",
      ],
      "Seluruh data valid yang dipilih diproses melalui satu aksi dan masing-masing menampilkan nilai yang benar.",
      "bulk",
    ));
  }

  if (contains(fullText, ["simpan", "save", "submit"])) {
    cases.push(buildCase(
      "happy",
      "Menyimpan perubahan dan memuat ulang data",
      [
        genericContext(feature),
        "Ubah data menggunakan nilai yang valid.",
        "Klik aksi simpan satu kali.",
        "Muat ulang halaman atau buka kembali data yang sama.",
      ],
      "Sistem mengonfirmasi penyimpanan dan nilai terbaru tetap tampil setelah data dimuat ulang.",
      "save",
    ));
  }

  return cases;
}

function negativeCases(feature, clauses, fullText) {
  const cases = [
    buildCase(
      "negative",
      "Menjalankan aksi dengan data wajib kosong",
      [genericContext(feature), "Kosongkan satu input yang wajib diisi.", "Jalankan aksi utama.", "Periksa pesan dan penanda pada input."],
      "Sistem tidak memproses data invalid, menandai input terkait, dan menjelaskan cara memperbaikinya.",
      "required validation",
    ),
    buildCase(
      "negative",
      "Menjalankan aksi dengan format input tidak valid",
      [genericContext(feature), "Masukkan huruf, simbol, atau format yang tidak sesuai pada input terkait.", "Jalankan aksi utama.", "Periksa data yang tersimpan."],
      "Input invalid ditolak dengan pesan yang spesifik. Nilai sebelumnya tidak berubah.",
      "invalid input",
    ),
  ];

  if (contains(fullText, ["validasi", "validation", "invalid", "tidak sesuai", "menandai"])) {
    cases.push(buildCase(
      "negative",
      "Menampilkan seluruh baris atau field yang tidak valid",
      [genericContext(feature), "Isi dua input dengan kondisi invalid yang berbeda.", "Isi satu input lain dengan nilai valid.", "Jalankan aksi utama."],
      "Setiap input invalid ditandai secara terpisah beserta penyebabnya, sementara input valid tidak ditandai error.",
      "validation markers",
    ));
  }

  if (contains(fullText, ["simpan", "save", "submit", "kirim", "proses"])) {
    cases.push(
      buildCase(
        "negative",
        "Menangani kegagalan proses atau jaringan",
        [genericContext(feature), "Isi perubahan dengan data valid.", "Simulasikan respons server gagal atau koneksi terputus.", "Jalankan aksi utama dan coba kembali setelah koneksi pulih."],
        "Sistem tidak mengklaim berhasil, mempertahankan input pengguna, menampilkan cara pemulihan, dan tidak menyimpan data sebagian.",
        "server failure",
      ),
      buildCase(
        "negative",
        "Mencegah proses ganda akibat klik berulang",
        [genericContext(feature), "Isi data valid.", "Aktifkan tombol aksi beberapa kali dengan cepat.", "Periksa jumlah permintaan dan hasil akhir."],
        "Hanya satu proses dijalankan. Tombol menunjukkan status sibuk tanpa berubah ukuran dan tidak menghasilkan data duplikat.",
        "duplicate submit",
      ),
    );
  }

  if (contains(fullText, ["hak akses", "permission", "role", "otorisasi"])) {
    cases.push(buildCase(
      "negative",
      "Menolak aksi dari pengguna tanpa hak akses",
      ["Masuk sebagai pengguna tanpa hak edit.", `Buka halaman atau alur ${feature}.`, "Coba mengubah dan memproses data."],
      "Kontrol edit tidak tersedia sesuai kebijakan UI dan server menolak perubahan tanpa hak akses.",
      "permission",
    ));
  }

  const numericRule = clauses.find((clause) => /\d/.test(clause) && contains(clause, ["minimal", "maksimal", "minimum", "maximum", "batas", "karakter", "digit"]));
  if (numericRule) {
    cases.push(buildCase(
      "negative",
      `Menolak nilai yang melanggar batas: ${concise(numericRule, 58)}`,
      [genericContext(feature), "Masukkan nilai tepat di luar batas yang disebutkan.", "Jalankan aksi utama.", "Periksa pesan validasi."],
      "Sistem menolak nilai di luar batas, menyebutkan batas yang benar, dan tidak mengubah data.",
      numericRule,
    ));
  }

  return cases;
}

function edgeCases(feature, clauses, fullText) {
  const cases = [
    buildCase(
      "edge",
      "Memproses nilai pada batas terendah yang valid",
      [genericContext(feature), "Masukkan nilai minimum yang masih valid sesuai aturan bisnis.", "Jalankan aksi utama.", "Periksa hasil dan data tersimpan."],
      "Nilai pada batas minimum diterima dan diproses tanpa pembulatan atau perubahan yang tidak ditentukan.",
      "minimum boundary",
    ),
    buildCase(
      "edge",
      "Memproses nilai pada batas tertinggi yang valid",
      [genericContext(feature), "Masukkan nilai maksimum yang masih valid sesuai aturan bisnis.", "Jalankan aksi utama.", "Periksa hasil dan data tersimpan."],
      "Nilai pada batas maksimum diterima dan diproses tanpa overflow atau kehilangan data.",
      "maximum boundary",
    ),
  ];

  if (contains(fullText, ["edit", "ubah", "perubahan", "update"])) {
    cases.push(buildCase(
      "edge",
      "Menjalankan aksi saat tidak ada perubahan",
      [genericContext(feature), "Jangan mengubah data apa pun.", "Periksa keadaan tombol aksi utama.", "Jika tombol aktif, jalankan aksi."],
      "Tombol aksi dinonaktifkan atau sistem melakukan no-op yang aman tanpa mengubah data.",
      "no changes",
    ));
  }

  if (contains(fullText, ["beberapa", "sekaligus", "multiple", "bulk", "seluruh"])) {
    cases.push(
      buildCase(
        "edge",
        "Memproses satu data melalui alur bulk",
        [genericContext(feature), "Ubah hanya satu data dengan nilai valid.", "Jalankan aksi utama.", "Periksa data lain."],
        "Satu perubahan berhasil diproses dan data lain tetap sama.",
        "single item bulk",
      ),
      buildCase(
        "edge",
        "Memproses jumlah data terbanyak yang didukung",
        [genericContext(feature), "Siapkan perubahan valid hingga batas jumlah data yang didukung.", "Jalankan satu kali aksi utama.", "Periksa waktu respons dan integritas setiap data."],
        "Seluruh perubahan diproses dalam batas performa yang disepakati tanpa data hilang, tertukar, atau tersimpan sebagian.",
        "maximum data volume",
      ),
    );
  }

  if (contains(fullText, ["hanya", "only", "data yang diedit", "data yang diubah"])) {
    cases.push(buildCase(
      "edge",
      "Menjaga data yang tidak diedit tetap sama",
      [genericContext(feature), "Catat nilai awal tiga data.", "Ubah hanya dua data.", "Jalankan aksi utama dan bandingkan ketiga data."],
      "Hanya data yang diedit berubah. Data yang tidak disentuh mempertahankan nilai dan metadata sebelumnya.",
      "unchanged records",
    ));
  }

  return cases;
}

function regressionCases(feature, clauses, fullText) {
  const cases = [];

  if (contains(fullText, ["perhitungan", "hitung", "calculation", "total", "saldo"])) {
    cases.push(buildCase(
      "regression",
      "Memastikan perhitungan turunan tetap akurat",
      [genericContext(feature), "Catat nilai dan hasil perhitungan awal.", "Ubah data yang memengaruhi perhitungan lalu proses perubahan.", "Hitung hasil pembanding menggunakan rumus bisnis."],
      "Nilai turunan dan total diperbarui sesuai rumus bisnis tanpa memengaruhi data yang tidak terkait.",
      "calculation",
    ));
  }

  cases.push(
    buildCase(
      "regression",
      `Memastikan alur existing ${feature} tetap berfungsi`,
      [genericContext(feature), "Jalankan alur existing utama dengan data lama yang masih valid.", "Bandingkan hasil dengan perilaku sebelum perubahan."],
      "Fitur existing tetap menghasilkan keluaran, navigasi, dan feedback yang sama kecuali perubahan yang dinyatakan dalam requirement.",
      "existing flow",
    ),
    buildCase(
      "regression",
      "Memastikan pencarian, filter, atau pengurutan tidak terganggu",
      [genericContext(feature), "Gunakan pencarian, filter, atau pengurutan yang tersedia.", "Lakukan perubahan pada data hasil.", "Jalankan aksi utama dan periksa posisi serta identitas data."],
      "Kontrol data existing tetap berfungsi dan perubahan diterapkan pada entitas yang benar meskipun posisi tampilan berubah.",
      "list controls",
    ),
    buildCase(
      "regression",
      "Memastikan data tetap konsisten setelah halaman dimuat ulang",
      [genericContext(feature), "Selesaikan satu perubahan valid.", "Muat ulang halaman atau buka sesi baru.", "Bandingkan hasil dengan perubahan terakhir."],
      "Data terbaru tetap konsisten setelah halaman dimuat ulang dan tidak kembali ke nilai sebelumnya.",
      "persistence",
    ),
  );

  return cases;
}

export function generateTestCases({ featureName = "", requirement = "", coverage = ["happy", "negative", "edge", "regression"] }) {
  const feature = moduleName(featureName);
  const clauses = extractClauses(requirement);
  const selected = new Set(coverage);
  let cases = [];

  if (selected.has("happy")) cases.push(...happyCases(feature, clauses, requirement));
  if (selected.has("negative")) cases.push(...negativeCases(feature, clauses, requirement));
  if (selected.has("edge")) cases.push(...edgeCases(feature, clauses, requirement));
  if (selected.has("regression")) cases.push(...regressionCases(feature, clauses, requirement));

  const seen = new Set();
  cases = cases.filter((testCase) => {
    const key = testCase.scenario.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);

  const prefix = sanitizePrefix(featureName);
  return cases.map((testCase, index) => ({
    ...testCase,
    id: `TC_${prefix}_${String(index + 1).padStart(3, "0")}`,
    module: feature,
    categoryLabel: CATEGORY_LABELS[testCase.category],
  }));
}

function markdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, "<br>");
}

export function toMarkdown(cases) {
  const headers = ["Test Case ID", "Module / Fitur", "Test Scenario / Judul Pengujian", "Test Steps (Langkah-langkah)", "Expected Result", "Actual Result", "Status"];
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];

  cases.forEach((testCase) => {
    const steps = testCase.steps.map((step, index) => `${index + 1}. ${step}`).join("<br>");
    const row = [testCase.id, testCase.module, testCase.scenario, steps, testCase.expected, testCase.actual, testCase.status].map(markdownCell);
    lines.push(`| ${row.join(" | ")} |`);
  });

  return lines.join("\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function toJiraCsv(cases) {
  const headers = ["Summary", "Description", "Preconditions", "Steps", "Expected Result", "Test Case ID", "Module", "Category", "Actual Result", "Status"];
  const rows = [headers.map(csvCell).join(",")];

  cases.forEach((testCase) => {
    const values = [
      testCase.scenario,
      `Verifikasi ${testCase.module}: ${testCase.source || testCase.scenario}`,
      `Pengguna memiliki akses ke ${testCase.module} dan data uji tersedia.`,
      testCase.steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
      testCase.expected,
      testCase.id,
      testCase.module,
      testCase.categoryLabel,
      testCase.actual,
      testCase.status,
    ];
    rows.push(values.map(csvCell).join(","));
  });

  return `\uFEFF${rows.join("\r\n")}`;
}

export { CATEGORY_LABELS };
