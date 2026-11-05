const MAX_RUNS = 1000;

function requiredText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} wajib diisi.`);
  return text;
}

function boundedNumber(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${label} harus bernilai ${minimum}–${maximum}.`);
  }
  return number;
}

function cleanLines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value || "casecraft")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function parseStateModel(source) {
  const lines = cleanLines(source);
  if (!lines.length) throw new Error("Diagram state wajib diisi.");
  const model = { name: "State model", initial: "", transitions: [], invalid: [], recovery: [] };

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const directive = line.match(/^(name|initial)\s*:\s*(.+)$/i);
    if (directive) {
      model[directive[1].toLowerCase()] = directive[2].trim();
      return;
    }
    const invalid = line.match(/^invalid\s*:\s*([^|]+)\|([^|]+)\|(.+)$/i);
    if (invalid) {
      model.invalid.push({ from: invalid[1].trim(), event: invalid[2].trim(), expected: invalid[3].trim() });
      return;
    }
    const recovery = line.match(/^recovery\s*:\s*([^|]+)\|([^|]+)\|([^|]+)(?:\|(.+))?$/i);
    if (recovery) {
      model.recovery.push({ from: recovery[1].trim(), event: recovery[2].trim(), to: recovery[3].trim(), expected: recovery[4]?.trim() || "" });
      return;
    }
    const compact = line.match(/^(.+?)\s*--\s*(.+?)\s*-->\s*(.+)$/);
    const mermaid = line.match(/^(.+?)\s*-->\s*(.+?)\s*:\s*(.+)$/);
    const match = compact || (mermaid ? [mermaid[0], mermaid[1], mermaid[3], mermaid[2]] : null);
    if (!match) throw new Error(`Baris ${lineNumber} tidak dikenali. Gunakan “State -- event --> State”.`);
    model.transitions.push({ from: match[1].trim(), event: match[2].trim(), to: match[3].trim() });
  });

  if (!model.transitions.length) throw new Error("Tambahkan sedikitnya satu transisi valid.");
  if (!model.initial) model.initial = model.transitions[0].from;
  return model;
}

export function buildModelTestPlan(source) {
  const model = parseStateModel(source);
  const warnings = [];
  if (!model.invalid.length) warnings.push("Perilaku transisi invalid belum didefinisikan; test invalid tidak dibuat.");
  if (!model.recovery.length) warnings.push("Alur pemulihan belum didefinisikan; test recovery tidak dibuat.");
  const cases = [];
  model.transitions.forEach((transition, index) => cases.push({
    id: `MBT-V-${String(index + 1).padStart(3, "0")}`,
    type: "valid",
    title: `${transition.event}: ${transition.from} → ${transition.to}`,
    precondition: `State saat ini adalah ${transition.from}.`,
    steps: [`Picu event “${transition.event}”.`, "Amati state setelah transisi."],
    expected: `State berubah menjadi ${transition.to}.`,
  }));
  model.invalid.forEach((transition, index) => cases.push({
    id: `MBT-I-${String(index + 1).padStart(3, "0")}`,
    type: "invalid",
    title: `${transition.event} ditolak dari ${transition.from}`,
    precondition: `State saat ini adalah ${transition.from}.`,
    steps: [`Picu event “${transition.event}”.`, "Amati respons dan state akhir."],
    expected: transition.expected,
  }));
  model.recovery.forEach((transition, index) => cases.push({
    id: `MBT-R-${String(index + 1).padStart(3, "0")}`,
    type: "recovery",
    title: `Pemulihan ${transition.from} melalui ${transition.event}`,
    precondition: `State saat ini adalah ${transition.from}.`,
    steps: [`Picu event pemulihan “${transition.event}”.`, "Amati state setelah pemulihan."],
    expected: transition.expected || `State berubah menjadi ${transition.to}.`,
  }));
  const markdown = [
    `# Model-based test plan — ${model.name}`,
    "",
    `Initial state: ${model.initial}`,
    `Cases: ${cases.length} (${model.transitions.length} valid, ${model.invalid.length} invalid, ${model.recovery.length} recovery)`,
    ...(warnings.length ? ["", "## Peringatan", ...warnings.map((warning) => `- ${warning}`)] : []),
    "",
    "## Test cases",
    ...cases.flatMap((testCase) => ["", `### ${testCase.id} · ${testCase.title}`, `- Tipe: ${testCase.type}`, `- Precondition: ${testCase.precondition}`, ...testCase.steps.map((step, index) => `- Langkah ${index + 1}: ${step}`), `- Expected: ${testCase.expected}`]),
  ].join("\n");
  return { model, cases, warnings, content: markdown, extension: "md", mime: "text/markdown;charset=utf-8" };
}

export function parseFuzzRules(source) {
  const supported = new Set(["integer", "number", "string", "boolean", "email", "enum"]);
  const rules = cleanLines(source).map((line, index) => {
    const [head, ...options] = line.split(",").map((part) => part.trim());
    const separator = head.indexOf(":");
    if (separator < 1) throw new Error(`Baris ${index + 1}: gunakan nama:type,opsi=value.`);
    const name = head.slice(0, separator).trim();
    const type = head.slice(separator + 1).trim().toLowerCase();
    if (!supported.has(type)) throw new Error(`Baris ${index + 1}: tipe ${type} tidak didukung.`);
    const rule = { name, type };
    options.forEach((option) => {
      const equals = option.indexOf("=");
      if (equals < 1) throw new Error(`Baris ${index + 1}: opsi “${option}” tidak valid.`);
      const key = option.slice(0, equals).trim();
      const raw = option.slice(equals + 1).trim();
      if (["min", "max", "minLength", "maxLength"].includes(key)) rule[key] = Number(raw);
      else if (key === "values") rule.values = raw.split("|").map((value) => value.trim()).filter(Boolean);
      else throw new Error(`Baris ${index + 1}: opsi ${key} tidak didukung.`);
    });
    if (["integer", "number"].includes(type)) {
      if (!Number.isFinite(rule.min) || !Number.isFinite(rule.max)) throw new Error(`Baris ${index + 1}: ${type} membutuhkan min dan max eksplisit.`);
      if (rule.min > rule.max) throw new Error(`Baris ${index + 1}: min tidak boleh melebihi max.`);
    }
    if (type === "string") {
      if (!Number.isInteger(rule.minLength) || !Number.isInteger(rule.maxLength)) throw new Error(`Baris ${index + 1}: string membutuhkan minLength dan maxLength.`);
      if (rule.minLength < 0 || rule.minLength > rule.maxLength) throw new Error(`Baris ${index + 1}: batas panjang string tidak valid.`);
    }
    if (type === "enum" && (!rule.values || rule.values.length < 2)) throw new Error(`Baris ${index + 1}: enum membutuhkan sedikitnya dua values.`);
    return rule;
  });
  if (!rules.length) throw new Error("Tambahkan sedikitnya satu aturan input.");
  return rules;
}

function randomString(length, random) {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length }, () => alphabet[Math.floor(random() * alphabet.length)]).join("");
}

function validFuzzValue(rule, random) {
  if (rule.type === "integer") return Math.floor(rule.min + random() * (rule.max - rule.min + 1));
  if (rule.type === "number") return Number((rule.min + random() * (rule.max - rule.min)).toFixed(3));
  if (rule.type === "string") return randomString(Math.max(rule.minLength, Math.floor(rule.minLength + random() * (rule.maxLength - rule.minLength + 1))), random);
  if (rule.type === "boolean") return random() >= 0.5;
  if (rule.type === "email") return `${randomString(8, random)}@example.test`;
  return rule.values[Math.floor(random() * rule.values.length)];
}

function boundaryValue(rule, index, random) {
  if (["integer", "number"].includes(rule.type)) return [rule.min, rule.max, rule.min - 1, rule.max + 1][index % 4];
  if (rule.type === "string") return ["x".repeat(rule.minLength), "x".repeat(rule.maxLength), "x".repeat(Math.max(0, rule.minLength - 1)), "x".repeat(rule.maxLength + 1)][index % 4];
  if (rule.type === "email") return ["qa@example.test", "tanpa-at", "@example.test", "qa@"][index % 4];
  if (rule.type === "enum") return index % 3 === 2 ? "__OUTSIDE_ENUM__" : rule.values[index % rule.values.length];
  return validFuzzValue(rule, random);
}

export function buildFuzzPlan({ rules: ruleSource, properties, runs = 100, seed = "casecraft" }) {
  const rules = parseFuzzRules(ruleSource);
  const runCount = Math.trunc(boundedNumber(runs, "Jumlah variasi", 1, MAX_RUNS));
  const propertyList = cleanLines(properties);
  const warnings = propertyList.length ? [] : ["Invariant/property belum diisi; dataset dibuat tanpa klaim lulus atau gagal."];
  const random = seededRandom(seed);
  const records = Array.from({ length: runCount }, (_, index) => {
    const boundary = index < Math.min(4, runCount);
    const input = Object.fromEntries(rules.map((rule) => [rule.name, boundary ? boundaryValue(rule, index, random) : validFuzzValue(rule, random)]));
    return { id: `FUZZ-${String(index + 1).padStart(4, "0")}`, kind: boundary ? (index < 2 ? "boundary-valid" : "boundary-invalid") : "generated-valid", input };
  });
  const plan = { format: "casecraft-fuzz-plan", version: 1, seed: String(seed || "casecraft"), runs: runCount, rules, properties: propertyList, warnings, records };
  return { plan, warnings, content: JSON.stringify(plan, null, 2), extension: "json", mime: "application/json;charset=utf-8" };
}

export function buildVisualRegressionPlan({ name, pages, viewports, themes, locales, allowedRegions, baselines = [] }) {
  const planName = requiredText(name, "Nama rencana visual");
  const pageList = cleanLines(pages).map((line, index) => {
    const [label, path] = line.split("|").map((part) => part.trim());
    if (!path?.startsWith("/")) throw new Error(`Halaman baris ${index + 1} membutuhkan path yang diawali “/”.`);
    return { label, path };
  });
  if (!pageList.length) throw new Error("Tambahkan sedikitnya satu halaman visual.");
  const viewportList = cleanLines(viewports).map((line, index) => {
    const match = line.match(/^([^=]+)=(\d+)x(\d+)$/i);
    if (!match) throw new Error(`Viewport baris ${index + 1}: gunakan nama=lebarxtinggi.`);
    return { name: match[1].trim(), width: boundedNumber(match[2], "Lebar viewport", 240, 7680), height: boundedNumber(match[3], "Tinggi viewport", 240, 7680) };
  });
  if (!viewportList.length) throw new Error("Tambahkan sedikitnya satu viewport.");
  const themeList = String(themes || "").split(",").map((item) => item.trim()).filter(Boolean);
  const localeList = String(locales || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!themeList.length || !localeList.length) throw new Error("Tema dan locale wajib diisi.");
  const regionList = cleanLines(allowedRegions).map((line, index) => {
    const [selector, reason] = line.split("|").map((part) => part.trim());
    if (!selector || !reason) throw new Error(`Area dinamis baris ${index + 1}: gunakan selector | alasan.`);
    return { selector, reason };
  });
  const matrix = pageList.flatMap((page) => viewportList.flatMap((viewport) => themeList.flatMap((theme) => localeList.map((locale) => ({ id: `VR-${String(1).padStart(3, "0")}`, page, viewport, theme, locale })))))
    .map((entry, index) => ({ ...entry, id: `VR-${String(index + 1).padStart(3, "0")}` }));
  if (matrix.length > 1000) throw new Error("Matriks visual melebihi 1.000 kombinasi. Kurangi halaman, viewport, tema, atau locale.");
  const warnings = [];
  if (!baselines.length) warnings.push("Baseline screenshot belum dipilih; rencana belum siap dibandingkan.");
  if (!regionList.length) warnings.push("Tidak ada area dinamis yang diizinkan; seluruh perbedaan akan dianggap perlu ditinjau.");
  const plan = { format: "casecraft-visual-regression-plan", version: 1, name: planName, baselines, allowedRegions: regionList, matrix, warnings };
  return { plan, warnings, content: JSON.stringify(plan, null, 2), extension: "visual.json", mime: "application/json;charset=utf-8" };
}

const ACCESSIBILITY_CORE = [
  ["A11Y-KB-001", "Keyboard", "Navigasi seluruh kontrol interaktif hanya dengan Tab, Shift+Tab, Enter, Space, dan Escape.", "Urutan fokus mengikuti urutan visual; semua aksi dapat dijalankan; tidak ada keyboard trap.", "2.1.1, 2.1.2, 2.4.3"],
  ["A11Y-FOCUS-001", "Focus", "Pindahkan fokus melewati setiap kontrol dan buka lalu tutup dialog.", "Indikator fokus terlihat; fokus masuk ke dialog dan kembali ke pemicu saat ditutup.", "2.4.7, 2.4.11"],
  ["A11Y-SR-001", "Screen reader", "Baca heading, landmark, label, status, error, dan nama/role/value kontrol.", "Struktur dan perubahan status diumumkan tanpa bergantung pada posisi visual.", "1.3.1, 3.3.1, 4.1.2, 4.1.3"],
  ["A11Y-ZOOM-001", "Zoom", "Uji text zoom 200% dan reflow setara viewport 320 CSS px.", "Konten dan fungsi tetap tersedia tanpa kehilangan informasi atau scroll dua dimensi, kecuali area yang memang membutuhkan tabel.", "1.4.4, 1.4.10"],
  ["A11Y-MOTION-001", "Reduced motion", "Aktifkan prefers-reduced-motion: reduce dan ulangi interaksi utama.", "Animasi non-esensial dinonaktifkan atau dipersingkat; tidak ada perubahan konteks mendadak.", "Preferensi platform; 2.3.3 sebagai referensi tambahan"],
];

const ACCESSIBILITY_PATTERN_CHECKS = {
  form: ["A11Y-FORM-001", "Form & error", "Kirim form kosong dan isi nilai invalid, lalu perbaiki nilainya.", "Error menjelaskan field terkait, terhubung secara programatis, dan input tetap dipertahankan.", "3.3.1, 3.3.2, 3.3.3"],
  dialog: ["A11Y-DIALOG-001", "Dialog", "Buka dialog, navigasi seluruh kontrol, lalu tutup dengan Escape dan tombol tutup.", "Nama dialog diumumkan, fokus tetap di dalam saat terbuka, dan kembali ke pemicu setelah ditutup.", "2.1.2, 2.4.3, 4.1.2"],
  table: ["A11Y-TABLE-001", "Data table", "Baca header dan sel tabel dengan screen reader serta scroll pada viewport sempit.", "Header memiliki hubungan dengan data; tabel tetap lengkap dan dapat digulir tanpa menyembunyikan kolom.", "1.3.1, 1.4.10"],
  upload: ["A11Y-UPLOAD-001", "File selection", "Pilih file valid dan invalid menggunakan keyboard.", "Tipe/batas file dijelaskan sebelum memilih; nama, ukuran, dan error file diumumkan.", "2.1.1, 3.3.1, 3.3.2"],
  animation: ["A11Y-ANIM-001", "Motion control", "Jalankan animasi atau auto-update lebih dari lima detik.", "Pengguna dapat pause/stop atau animasi dibatasi sesuai kontrak produk.", "2.2.2"],
};

export function buildAccessibilityPlan({ scope, patterns = [] }) {
  const target = requiredText(scope, "Scope aksesibilitas");
  const selected = [...new Set(patterns)].filter((pattern) => ACCESSIBILITY_PATTERN_CHECKS[pattern]);
  const checks = [...ACCESSIBILITY_CORE, ...selected.map((pattern) => ACCESSIBILITY_PATTERN_CHECKS[pattern])].map(([id, area, steps, expected, criteria]) => ({ id, area, steps, expected, criteria }));
  const warnings = selected.length ? [] : ["Tidak ada pola komponen tambahan dipilih; checklist hanya memuat alur inti lintas halaman."];
  const content = [
    `# Accessibility test plan — ${target}`,
    "",
    "Target: WCAG 2.2 AA. Checklist ini membantu perencanaan dan bukan bukti konformitas otomatis.",
    ...(warnings.length ? ["", "## Peringatan", ...warnings.map((warning) => `- ${warning}`)] : []),
    "",
    "## Checklist",
    ...checks.flatMap((check) => ["", `### ${check.id} · ${check.area}`, `- Referensi: ${check.criteria}`, `- Langkah: ${check.steps}`, `- Expected: ${check.expected}`]),
  ].join("\n");
  return { target, checks, warnings, content, extension: "a11y.md", mime: "text/markdown;charset=utf-8" };
}

function performanceStages(workload, concurrency, rampUp, duration) {
  const steady = Math.max(1, duration - rampUp);
  if (workload === "spike") return [{ duration: `${rampUp}s`, target: concurrency }, { duration: `${steady}s`, target: concurrency }, { duration: "10s", target: 0 }];
  if (workload === "stress") return [{ duration: `${rampUp}s`, target: Math.ceil(concurrency / 2) }, { duration: `${steady}s`, target: concurrency }, { duration: "15s", target: 0 }];
  if (workload === "soak") return [{ duration: `${rampUp}s`, target: concurrency }, { duration: `${steady}s`, target: concurrency }, { duration: `${rampUp}s`, target: 0 }];
  return [{ duration: `${rampUp}s`, target: concurrency }, { duration: `${steady}s`, target: concurrency }, { duration: "10s", target: 0 }];
}

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function buildPerformanceDraft(config) {
  const name = requiredText(config.name, "Nama workload");
  const method = String(config.method || "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error("Metode HTTP tidak didukung.");
  const path = requiredText(config.path, "Path target");
  if (!path.startsWith("/")) throw new Error("Path target harus diawali “/”.");
  const workload = ["load", "stress", "spike", "soak"].includes(config.workload) ? config.workload : "load";
  const concurrency = Math.trunc(boundedNumber(config.concurrency, "Concurrency", 1, 100000));
  const duration = Math.trunc(boundedNumber(config.duration, "Durasi", 10, 86400));
  const rampUp = Math.trunc(boundedNumber(config.rampUp, "Ramp-up", 1, duration - 1));
  const dataVolume = Math.trunc(boundedNumber(config.dataVolume, "Volume data", 1, 10000000));
  const p95 = Math.trunc(boundedNumber(config.p95, "Threshold p95", 1, 600000));
  const errorRate = boundedNumber(config.errorRate, "Error rate", 0, 100);
  const throughput = boundedNumber(config.throughput, "Throughput", 0, 1000000);
  const stages = performanceStages(workload, concurrency, rampUp, duration);
  const warnings = [];
  const rawBody = String(config.body || "").trim();
  let requestBody = {};
  if (["POST", "PUT", "PATCH"].includes(method) && !rawBody) warnings.push("Request body belum diisi; draft memakai objek kosong dan wajib ditinjau engineer.");
  if (rawBody) {
    try { requestBody = JSON.parse(rawBody); }
    catch { throw new Error("Request body harus berupa JSON valid."); }
  }
  if (!String(config.dataStrategy || "").trim()) warnings.push("Strategi penyediaan dan cleanup data belum diisi.");
  const format = config.format === "jmeter" ? "jmeter" : "k6";
  let content;
  let extension;
  let mime;
  if (format === "k6") {
    const body = JSON.stringify(requestBody, null, 2);
    content = `import http from 'k6/http';\nimport { check } from 'k6';\n\n// Draft Casecraft: tinjau auth, payload, data unik, dan cleanup sebelum dijalankan.\nexport const options = {\n  stages: ${JSON.stringify(stages, null, 2)},\n  thresholds: {\n    http_req_duration: ['p(95)<${p95}'],\n    http_req_failed: ['rate<${errorRate / 100}'],\n    http_reqs: ['rate>=${throughput}'],\n  },\n};\n\nexport default function () {\n  const url = \`\${__ENV.BASE_URL || 'http://localhost:3000'}${path}\`;\n  const response = http.request('${method}', url, ${["GET", "DELETE"].includes(method) ? "null" : `JSON.stringify(${body})`}, { headers: { 'Content-Type': 'application/json' } });\n  check(response, { 'status terdefinisi': (result) => result.status > 0 });\n}\n`;
    extension = "k6.js";
    mime = "text/javascript;charset=utf-8";
  } else {
    content = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Draft Casecraft: tinjau auth, payload, assertions, threshold listener, dan cleanup sebelum dijalankan. -->\n<jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3"><hashTree><TestPlan testname="${xmlEscape(name)}"><elementProp name="TestPlan.user_defined_variables" elementType="Arguments"><collectionProp name="Arguments.arguments"><elementProp name="TARGET_P95_MS" elementType="Argument"><stringProp name="Argument.value">${p95}</stringProp></elementProp><elementProp name="MAX_ERROR_PERCENT" elementType="Argument"><stringProp name="Argument.value">${errorRate}</stringProp></elementProp><elementProp name="MIN_RPS" elementType="Argument"><stringProp name="Argument.value">${throughput}</stringProp></elementProp><elementProp name="DATA_VOLUME" elementType="Argument"><stringProp name="Argument.value">${dataVolume}</stringProp></elementProp></collectionProp></elementProp></TestPlan><hashTree><ThreadGroup testname="${xmlEscape(workload)}"><stringProp name="ThreadGroup.num_threads">${concurrency}</stringProp><stringProp name="ThreadGroup.ramp_time">${rampUp}</stringProp><stringProp name="ThreadGroup.duration">${duration}</stringProp><boolProp name="ThreadGroup.scheduler">true</boolProp></ThreadGroup><hashTree><HTTPSamplerProxy testname="${xmlEscape(method)} ${xmlEscape(path)}"><stringProp name="HTTPSampler.domain">\${BASE_URL}</stringProp><stringProp name="HTTPSampler.path">${xmlEscape(path)}</stringProp><stringProp name="HTTPSampler.method">${method}</stringProp><boolProp name="HTTPSampler.postBodyRaw">true</boolProp><elementProp name="HTTPsampler.Arguments" elementType="Arguments"><collectionProp name="Arguments.arguments"><elementProp name="" elementType="HTTPArgument"><stringProp name="Argument.value">${xmlEscape(JSON.stringify(requestBody))}</stringProp></elementProp></collectionProp></elementProp></HTTPSamplerProxy><hashTree/></hashTree></hashTree></hashTree></jmeterTestPlan>\n`;
    extension = "jmx";
    mime = "application/xml;charset=utf-8";
  }
  return { plan: { name, workload, concurrency, duration, rampUp, dataVolume, p95, errorRate, throughput, stages, dataStrategy: String(config.dataStrategy || "").trim(), warnings }, warnings, content, extension, mime };
}

function parsePipeRows(source, label, columns) {
  return cleanLines(source).map((line, index) => {
    const values = line.split("|").map((value) => value.trim());
    if (values.length !== columns || values.some((value) => !value)) {
      throw new Error(`${label} baris ${index + 1} harus memiliki ${columns} kolom yang tidak kosong.`);
    }
    return values;
  });
}

const SECURITY_REFERENCES = {
  authorization: { label: "OWASP WSTG v4.2 — Authorization Testing", url: "https://owasp.org/www-project-web-security-testing-guide/" },
  session: { label: "OWASP WSTG v4.2 — Session Management Testing", url: "https://owasp.org/www-project-web-security-testing-guide/" },
  injection: { label: "OWASP WSTG v4.2 — Injection Testing / ASVS 5.0.0", url: "https://asvs.owasp.org/" },
  exposure: { label: "OWASP ASVS 5.0.0 — data protection verification", url: "https://asvs.owasp.org/" },
  rate: { label: "OWASP API4:2023 — Unrestricted Resource Consumption", url: "https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/" },
  abuse: { label: "OWASP API6:2023 — Unrestricted Access to Sensitive Business Flows", url: "https://api-security.owasp.org/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/" },
};

export function buildSecurityCatalogue(config) {
  const scope = requiredText(config.scope, "Scope keamanan");
  const warnings = [];
  const cases = [];
  const addWarning = (rows, label) => { if (!rows.length) warnings.push(`${label} belum memiliki kontrak; skenario kategori ini tidak dibuat.`); };
  const authorization = parsePipeRows(config.authorization, "Authorization", 3);
  addWarning(authorization, "Authorization");
  authorization.forEach(([role, action, decision], index) => {
    const normalized = decision.toLowerCase();
    if (!new Set(["allow", "deny"]).has(normalized)) throw new Error(`Authorization baris ${index + 1}: keputusan harus allow atau deny.`);
    cases.push({ id: `SEC-AUTH-${String(index + 1).padStart(3, "0")}`, category: "authorization", title: `${role} · ${action}`, steps: [`Autentikasi sebagai ${role}.`, `Minta aksi/resource “${action}” melalui UI dan request langsung yang disetujui untuk environment test.`, "Periksa respons, perubahan data, dan data yang dikembalikan."], expected: normalized === "allow" ? `Aksi “${action}” diizinkan untuk ${role} sesuai matriks akses.` : `Aksi “${action}” ditolak untuk ${role}; state dan data terlindungi tidak berubah atau terekspos.`, reference: SECURITY_REFERENCES.authorization });
  });

  const sessions = parsePipeRows(config.sessions, "Session", 3);
  addWarning(sessions, "Session");
  sessions.forEach(([event, policy, expected], index) => cases.push({ id: `SEC-SESSION-${String(index + 1).padStart(3, "0")}`, category: "session", title: event, steps: [`Siapkan session pengguna pada scope ${scope}.`, `Jalankan kondisi “${event}” dengan kebijakan “${policy}”.`, "Periksa cookie/token, state autentikasi, dan akses setelah kondisi."], expected, reference: SECURITY_REFERENCES.session }));

  const injections = parsePipeRows(config.injections, "Injection", 3);
  addWarning(injections, "Input injection");
  injections.forEach(([entry, context, expected], index) => cases.push({ id: `SEC-INJECT-${String(index + 1).padStart(3, "0")}`, category: "injection", title: `${entry} · ${context}`, steps: [`Identifikasi entry point “${entry}” dalam konteks ${context}.`, "Gunakan corpus uji yang disetujui: metacharacter, encoding, delimiter, dan input bertipe salah tanpa menyasar sistem di luar scope.", "Periksa respons, log test, dan perubahan data."], expected, reference: SECURITY_REFERENCES.injection }));

  const exposures = parsePipeRows(config.exposures, "Data exposure", 3);
  addWarning(exposures, "Data exposure");
  exposures.forEach(([surface, sensitiveData, audience], index) => cases.push({ id: `SEC-DATA-${String(index + 1).padStart(3, "0")}`, category: "exposure", title: `${sensitiveData} pada ${surface}`, steps: [`Buka “${surface}” sebagai audience yang diizinkan dan tidak diizinkan.`, "Periksa UI, response body, URL, cache, storage browser, log, dan file ekspor yang termasuk scope."], expected: `${sensitiveData} hanya tersedia untuk ${audience}; audience lain tidak menerima nilai mentah atau metadata sensitif.`, reference: SECURITY_REFERENCES.exposure }));

  const rates = parsePipeRows(config.rateLimits, "Rate limit", 4);
  addWarning(rates, "Rate limit");
  rates.forEach(([operation, limit, window, expected], index) => cases.push({ id: `SEC-RATE-${String(index + 1).padStart(3, "0")}`, category: "rate", title: `${operation} · ${limit}/${window}`, steps: [`Jalankan “${operation}” hingga mendekati ${limit} dalam ${window}.`, "Lanjutkan satu permintaan melewati batas dari identitas test yang sama.", "Periksa respons pembatasan, retry window, dan tidak adanya side effect tambahan."], expected, reference: SECURITY_REFERENCES.rate }));

  const abuses = parsePipeRows(config.abuseCases, "Abuse case", 4);
  addWarning(abuses, "Abuse case");
  abuses.forEach(([flow, abuse, guard, expected], index) => cases.push({ id: `SEC-ABUSE-${String(index + 1).padStart(3, "0")}`, category: "abuse", title: `${flow} · ${abuse}`, steps: [`Siapkan flow bisnis “${flow}” pada data test.`, `Simulasikan pola abuse “${abuse}” dalam batas environment test.`, `Periksa guard “${guard}” dan dampak pada pengguna sah.`], expected, reference: SECURITY_REFERENCES.abuse }));

  if (!cases.length) throw new Error("Tambahkan sedikitnya satu kontrak keamanan eksplisit.");
  const content = [
    `# Security test catalogue — ${scope}`,
    "",
    "Review aid berbasis OWASP. Katalog ini tidak menjalankan serangan, tidak membuktikan keamanan, dan tidak menggantikan threat model atau pentest berizin.",
    ...(warnings.length ? ["", "## Peringatan", ...warnings.map((warning) => `- ${warning}`)] : []),
    "",
    "## Test scenarios",
    ...cases.flatMap((testCase) => ["", `### ${testCase.id} · ${testCase.title}`, `- Kategori: ${testCase.category}`, `- Referensi: [${testCase.reference.label}](${testCase.reference.url})`, ...testCase.steps.map((step, index) => `- Langkah ${index + 1}: ${step}`), `- Expected: ${testCase.expected}`]),
  ].join("\n");
  return { scope, cases, warnings, references: SECURITY_REFERENCES, content, extension: "security.md", mime: "text/markdown;charset=utf-8" };
}

export function buildMobileDeviceMatrix({ devices, orientations, networks, keyboards }) {
  const deviceList = parsePipeRows(devices, "Perangkat", 4).map(([name, os, browser, viewport], index) => {
    const match = viewport.match(/^(\d+)x(\d+)$/i);
    if (!match) throw new Error(`Perangkat baris ${index + 1}: viewport harus berformat lebarxtinggi.`);
    return { name, os, browser, viewport: { width: boundedNumber(match[1], "Lebar viewport", 240, 7680), height: boundedNumber(match[2], "Tinggi viewport", 240, 7680) } };
  });
  if (!deviceList.length) throw new Error("Tambahkan sedikitnya satu perangkat.");
  const splitValues = (value, label) => {
    const values = String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (!values.length) throw new Error(`${label} wajib diisi.`);
    return [...new Set(values)];
  };
  const orientationList = splitValues(orientations, "Orientasi");
  const networkList = splitValues(networks, "Kondisi jaringan");
  const keyboardList = splitValues(keyboards, "Kondisi virtual keyboard");
  const matrix = deviceList.flatMap((device) => orientationList.flatMap((orientation) => networkList.flatMap((network) => keyboardList.map((keyboard) => ({ device, orientation, network, keyboard })))))
    .map((entry, index) => ({ id: `MOBILE-${String(index + 1).padStart(4, "0")}`, ...entry, expected: "Layout, fokus, input, dan aksi utama tetap dapat digunakan tanpa konten penting tertutup atau perubahan data ganda." }));
  if (matrix.length > 1000) throw new Error("Matriks mobile melebihi 1.000 kombinasi. Kurangi perangkat atau variasi kondisi.");
  const warnings = [];
  if (!networkList.some((network) => /slow|lambat|3g|2g|offline/i.test(network))) warnings.push("Belum ada jaringan lambat atau offline dalam matriks.");
  if (orientationList.length < 2) warnings.push("Hanya satu orientasi terdefinisi.");
  if (!keyboardList.some((keyboard) => /open|visible|terbuka|muncul/i.test(keyboard))) warnings.push("Kondisi virtual keyboard terbuka belum terdefinisi.");
  const plan = { format: "casecraft-mobile-device-matrix", version: 1, devices: deviceList, orientations: orientationList, networks: networkList, keyboards: keyboardList, warnings, matrix };
  return { plan, warnings, content: JSON.stringify(plan, null, 2), extension: "mobile.json", mime: "application/json;charset=utf-8" };
}

export function buildMigrationTestPlan(config) {
  const name = requiredText(config.name, "Nama migrasi");
  const sourceVersions = String(config.sourceVersions || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!sourceVersions.length) throw new Error("Versi sumber wajib diisi.");
  const targetVersion = requiredText(config.targetVersion, "Versi target");
  const entities = parsePipeRows(config.entities, "Entitas", 4).map(([entity, key, volume, checks], index) => {
    const recordCount = Math.trunc(boundedNumber(volume, `Volume entitas baris ${index + 1}`, 1, 1000000000));
    return { entity, key, recordCount, checks: checks.split(",").map((value) => value.trim()).filter(Boolean) };
  });
  if (!entities.length) throw new Error("Tambahkan sedikitnya satu entitas migrasi.");
  const compatibility = parsePipeRows(config.compatibility, "Backward compatibility", 2);
  const rollbacks = parsePipeRows(config.rollbacks, "Rollback", 2);
  const reconciliations = parsePipeRows(config.reconciliations, "Rekonsiliasi", 3);
  const warnings = [];
  if (!compatibility.length) warnings.push("Backward compatibility belum memiliki kontrak.");
  if (!rollbacks.length) warnings.push("Rollback belum memiliki trigger dan expected result.");
  if (!reconciliations.length) warnings.push("Rekonsiliasi belum memiliki metric dan toleransi.");
  const cases = [];
  let migrationSequence = 0;
  sourceVersions.forEach((source) => entities.forEach((entity) => {
    const sequence = ++migrationSequence;
    cases.push({ id: `MIG-FWD-${String(sequence).padStart(3, "0")}`, category: "version-migration", title: `${entity.entity}: ${source} → ${targetVersion}`, steps: [`Siapkan ${entity.recordCount} record ${entity.entity} dari ${source}.`, `Jalankan prosedur migrasi menuju ${targetVersion}.`, `Validasi key ${entity.key} dan field ${entity.checks.join(", ")}.`], expected: `Seluruh record ${entity.entity} bermigrasi satu kali; ${entity.key} tetap unik dan field yang disebutkan mempertahankan nilai sesuai mapping.` });
    cases.push({ id: `MIG-INT-${String(sequence).padStart(3, "0")}`, category: "integrity", title: `Integritas ${entity.entity} setelah ${source} → ${targetVersion}`, steps: [`Bandingkan count, key ${entity.key}, dan checksum/aggregate field ${entity.checks.join(", ")} sebelum dan sesudah migrasi.`, "Cari record hilang, duplikat, orphan, atau nilai terpotong."], expected: `${entity.recordCount} record dapat direkonsiliasi tanpa key hilang, duplikat, orphan, atau perubahan field di luar mapping.` });
  }));
  compatibility.forEach(([client, expected], index) => cases.push({ id: `MIG-COMP-${String(index + 1).padStart(3, "0")}`, category: "backward-compatibility", title: `Kompatibilitas ${client} terhadap ${targetVersion}`, steps: [`Gunakan client/schema ${client} terhadap data atau service ${targetVersion}.`, "Jalankan operasi baca/tulis yang termasuk kontrak kompatibilitas."], expected }));
  rollbacks.forEach(([trigger, expected], index) => cases.push({ id: `MIG-ROLL-${String(index + 1).padStart(3, "0")}`, category: "rollback", title: `Rollback saat ${trigger}`, steps: [`Mulai migrasi dari versi sumber yang ditentukan.`, `Aktifkan trigger “${trigger}” pada environment test.`, "Jalankan prosedur rollback dan validasi service serta data."], expected }));
  reconciliations.forEach(([metric, expected, tolerance], index) => cases.push({ id: `MIG-REC-${String(index + 1).padStart(3, "0")}`, category: "reconciliation", title: `Rekonsiliasi ${metric}`, steps: [`Hitung metric “${metric}” pada sumber dan target.`, `Bandingkan hasil dengan toleransi ${tolerance}.`], expected }));
  const content = [
    `# Data migration test plan — ${name}`,
    "",
    `Versi sumber: ${sourceVersions.join(", ")} · target: ${targetVersion}`,
    ...(warnings.length ? ["", "## Peringatan", ...warnings.map((warning) => `- ${warning}`)] : []),
    "",
    "## Test cases",
    ...cases.flatMap((testCase) => ["", `### ${testCase.id} · ${testCase.title}`, `- Kategori: ${testCase.category}`, ...testCase.steps.map((step, index) => `- Langkah ${index + 1}: ${step}`), `- Expected: ${testCase.expected}`]),
  ].join("\n");
  return { name, sourceVersions, targetVersion, entities, cases, warnings, content, extension: "migration.md", mime: "text/markdown;charset=utf-8" };
}

function pseudoExpand(text, percent) {
  const source = String(text || "");
  const targetLength = Math.max(source.length, Math.ceil(source.length * percent / 100));
  return `⟦${source}${"~".repeat(Math.max(0, targetLength - source.length))}⟧`;
}

export function buildLocalizationTestPlan(config) {
  const name = requiredText(config.name, "Nama scope localization");
  const instant = new Date(requiredText(config.instant, "Timestamp contoh"));
  if (Number.isNaN(instant.getTime())) throw new Error("Timestamp contoh harus berupa ISO date-time yang valid.");
  const sampleNumber = Number(config.sampleNumber);
  if (!Number.isFinite(sampleNumber)) throw new Error("Angka contoh tidak valid.");
  const expansion = boundedNumber(config.expansion, "Ekspansi teks", 100, 300);
  const localeRows = parsePipeRows(config.locales, "Locale", 3).map(([locale, timeZone, currency], index) => {
    try {
      new Intl.DateTimeFormat(locale, { timeZone }).format(instant);
      new Intl.NumberFormat(locale, { style: "currency", currency }).format(sampleNumber);
      new Intl.PluralRules(locale).select(1);
    } catch { throw new Error(`Locale baris ${index + 1} memiliki locale, timezone, atau currency yang tidak didukung.`); }
    return { locale, timeZone, currency };
  });
  if (!localeRows.length) throw new Error("Tambahkan sedikitnya satu locale.");
  const fallbackLocale = requiredText(config.fallbackLocale, "Fallback locale");
  if (!localeRows.some((row) => row.locale === fallbackLocale)) throw new Error("Fallback locale harus ada dalam daftar locale.");
  const surfaces = parsePipeRows(config.surfaces, "Surface terjemahan", 3).map(([surface, text, maxCharacters], index) => ({ surface, text, maxCharacters: Math.trunc(boundedNumber(maxCharacters, `Batas karakter surface baris ${index + 1}`, 1, 10000)) }));
  if (!surfaces.length) throw new Error("Tambahkan sedikitnya satu surface terjemahan.");
  const counts = String(config.pluralCounts || "0,1,2").split(",").map((value) => Number(value.trim()));
  if (!counts.length || counts.some((value) => !Number.isFinite(value))) throw new Error("Nilai pluralisasi harus berupa angka yang dipisahkan koma.");
  const mixedText = requiredText(config.mixedText, "Teks campuran");
  const cases = [];
  const samples = [];
  localeRows.forEach((localeConfig) => {
    const dateTime = new Intl.DateTimeFormat(localeConfig.locale, { dateStyle: "medium", timeStyle: "medium", timeZone: localeConfig.timeZone }).format(instant);
    const number = new Intl.NumberFormat(localeConfig.locale, { style: "currency", currency: localeConfig.currency }).format(sampleNumber);
    const plural = Object.fromEntries(counts.map((count) => [count, new Intl.PluralRules(localeConfig.locale).select(count)]));
    samples.push({ ...localeConfig, dateTime, number, plural });
    cases.push({ id: `L10N-FMT-${String(cases.length + 1).padStart(3, "0")}`, category: "format", locale: localeConfig.locale, input: { instant: instant.toISOString(), number: sampleNumber, timeZone: localeConfig.timeZone, currency: localeConfig.currency }, expected: { dateTime, number } });
    cases.push({ id: `L10N-PLURAL-${String(cases.length + 1).padStart(3, "0")}`, category: "pluralization", locale: localeConfig.locale, input: counts, expected: plural });
    cases.push({ id: `L10N-MIXED-${String(cases.length + 1).padStart(3, "0")}`, category: "mixed-text", locale: localeConfig.locale, input: mixedText, expected: "Token, angka, tanda baca, dan urutan baca tetap tersedia tanpa karakter hilang atau kontrol tertukar." });
    surfaces.forEach((surface) => cases.push({ id: `L10N-LONG-${String(cases.length + 1).padStart(3, "0")}`, category: "long-translation", locale: localeConfig.locale, surface: surface.surface, input: pseudoExpand(surface.text, expansion), limit: surface.maxCharacters, expected: "Teks tetap terbaca tanpa overlap, clipping, atau kontrol terdorong keluar dari area operable." }));
  });
  cases.push({ id: `L10N-FALLBACK-${String(cases.length + 1).padStart(3, "0")}`, category: "fallback", input: "Kunci terjemahan tidak tersedia pada locale aktif", expected: `Gunakan teks ${fallbackLocale} yang terdefinisi; jangan tampilkan key mentah, string kosong, atau locale acak.` });
  const warnings = surfaces.some((surface) => pseudoExpand(surface.text, expansion).length > surface.maxCharacters) ? ["Sedikitnya satu sampel ekspansi melebihi batas karakter surface; pertahankan sebagai kasus layout kritis."] : [];
  const plan = { format: "casecraft-localization-test-plan", version: 1, name, fallbackLocale, expansionPercent: expansion, samples, warnings, cases };
  return { plan, warnings, content: JSON.stringify(plan, null, 2), extension: "l10n.json", mime: "application/json;charset=utf-8" };
}
