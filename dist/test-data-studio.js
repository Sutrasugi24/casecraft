const FIELD_TYPES = new Set(["name", "email", "phone", "username", "uuid", "date", "integer", "number", "string", "boolean"]);
const SENSITIVE_KEY = /(?:name|nama|email|mail|phone|telepon|mobile|address|alamat|nik|ktp|passport|card|kartu|account|rekening|token|secret|password|credential)/i;
const FIRST_NAMES = ["Ari", "Bima", "Citra", "Dewi", "Eka", "Farah", "Gilang", "Hana"];
const LAST_NAMES = ["Aruna", "Baskara", "Cendana", "Dirgantara", "Elang", "Fajar", "Garuda", "Harapan"];
const OPTION_KEYS = {
  integer: new Set(["min", "max", "multipleOf"]),
  number: new Set(["min", "max", "multipleOf"]),
  string: new Set(["minLength", "maxLength"]),
  date: new Set(["start", "end"]),
};

function hashSeed(seed = "casecraft") {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFromSeed(seed) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function scalar(value = "") {
  const text = String(value).trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
  return text;
}

function validateOptions(field, lineNumber) {
  const allowed = OPTION_KEYS[field.type] || new Set();
  const unknown = Object.keys(field.options).filter((key) => !allowed.has(key));
  if (unknown.length) throw new TypeError(`Baris ${lineNumber}: opsi ${unknown.join(", ")} tidak didukung untuk tipe ${field.type}.`);
  if (["integer", "number"].includes(field.type)) {
    ["min", "max", "multipleOf"].forEach((key) => {
      if (field.options[key] !== undefined && !Number.isFinite(Number(field.options[key]))) throw new TypeError(`Baris ${lineNumber}: ${key} harus berupa angka.`);
    });
    if (field.options.min !== undefined && field.options.max !== undefined && Number(field.options.min) > Number(field.options.max)) throw new TypeError(`Baris ${lineNumber}: min tidak boleh lebih besar dari max.`);
    if (field.options.multipleOf !== undefined && Number(field.options.multipleOf) <= 0) throw new TypeError(`Baris ${lineNumber}: multipleOf harus lebih besar dari 0.`);
    if (field.type === "integer" && ["min", "max", "multipleOf"].some((key) => field.options[key] !== undefined && !Number.isInteger(Number(field.options[key])))) throw new TypeError(`Baris ${lineNumber}: batas integer harus berupa bilangan bulat.`);
    if (field.options.multipleOf !== undefined) {
      const step = Number(field.options.multipleOf);
      const minimum = field.options.min === undefined ? 0 : Number(field.options.min);
      const maximum = field.options.max === undefined ? minimum + 100 : Number(field.options.max);
      if (Math.ceil(minimum / step) > Math.floor(maximum / step)) throw new TypeError(`Baris ${lineNumber}: rentang tidak memiliki nilai yang sesuai multipleOf.`);
    }
  }
  if (field.type === "string") {
    ["minLength", "maxLength"].forEach((key) => {
      const value = field.options[key];
      if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 200)) throw new TypeError(`Baris ${lineNumber}: ${key} harus bilangan bulat 0–200.`);
    });
    if (field.options.minLength !== undefined && field.options.maxLength !== undefined && Number(field.options.minLength) > Number(field.options.maxLength)) throw new TypeError(`Baris ${lineNumber}: minLength tidak boleh lebih besar dari maxLength.`);
  }
  if (field.type === "date") {
    const start = field.options.start === undefined ? null : Date.parse(String(field.options.start));
    const end = field.options.end === undefined ? null : Date.parse(String(field.options.end));
    if (start !== null && !Number.isFinite(start)) throw new TypeError(`Baris ${lineNumber}: start harus tanggal yang valid.`);
    if (end !== null && !Number.isFinite(end)) throw new TypeError(`Baris ${lineNumber}: end harus tanggal yang valid.`);
    if (start !== null && end !== null && start > end) throw new TypeError(`Baris ${lineNumber}: start tidak boleh setelah end.`);
  }
}

export function parseFieldDefinitions(text = "") {
  const fields = String(text).split(/\r?\n/).map((line, index) => {
    const source = line.trim();
    if (!source || source.startsWith("#")) return null;
    const [identity, ...optionParts] = source.split(",").map((part) => part.trim());
    const separator = identity.indexOf(":");
    if (separator < 1) throw new TypeError(`Baris ${index + 1}: gunakan format nama:type.`);
    const name = identity.slice(0, separator).trim();
    const type = identity.slice(separator + 1).trim().toLowerCase();
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(name)) throw new TypeError(`Baris ${index + 1}: nama field tidak valid.`);
    if (!FIELD_TYPES.has(type)) throw new TypeError(`Baris ${index + 1}: tipe ${type || "kosong"} belum didukung.`);
    const options = {};
    optionParts.filter(Boolean).forEach((part) => {
      const optionSeparator = part.indexOf("=");
      if (optionSeparator < 1) throw new TypeError(`Baris ${index + 1}: opsi ${part} harus key=value.`);
      options[part.slice(0, optionSeparator).trim()] = scalar(part.slice(optionSeparator + 1));
    });
    const field = { name, type, options };
    validateOptions(field, index + 1);
    return field;
  }).filter(Boolean);
  if (!fields.length) throw new TypeError("Tambahkan sedikitnya satu definisi field sintetis.");
  if (fields.length > 30) throw new TypeError("Dataset dibatasi maksimal 30 field.");
  if (new Set(fields.map((field) => field.name)).size !== fields.length) throw new TypeError("Nama field tidak boleh duplikat.");
  return fields;
}

function pick(items, random) {
  return items[Math.floor(random() * items.length)];
}

function padded(value, length = 4) {
  return String(value).padStart(length, "0");
}

function syntheticValue(field, index, random) {
  const { type, options } = field;
  if (type === "name") return `${pick(FIRST_NAMES, random)} ${pick(LAST_NAMES, random)}`;
  if (type === "email") return `qa.${padded(index + 1)}.${Math.floor(random() * 10000)}@example.test`;
  if (type === "phone") return `+6280000${padded(Math.floor(random() * 1000000), 6)}`;
  if (type === "username") return `qa_user_${padded(index + 1)}`;
  if (type === "uuid") return `00000000-0000-4000-8000-${padded(hashSeed(`${field.name}-${index}`), 12).slice(-12)}`;
  if (type === "date") {
    const start = Date.parse(String(options.start || "2024-01-01"));
    const end = Date.parse(String(options.end || "2028-12-31"));
    const lower = Number.isFinite(start) ? start : Date.parse("2024-01-01");
    const upper = Number.isFinite(end) && end >= lower ? end : Date.parse("2028-12-31");
    return new Date(lower + Math.floor(random() * (upper - lower + 1))).toISOString().slice(0, 10);
  }
  if (type === "integer" || type === "number") {
    const minimum = Number.isFinite(Number(options.min)) ? Number(options.min) : 0;
    const maximum = Number.isFinite(Number(options.max)) ? Number(options.max) : minimum + 100;
    const step = Number(options.multipleOf);
    if (Number.isFinite(step) && step > 0) {
      const lowerIndex = Math.ceil(minimum / step);
      const upperIndex = Math.floor(maximum / step);
      const selected = lowerIndex + Math.floor(random() * (upperIndex - lowerIndex + 1));
      const value = selected * step;
      return type === "integer" ? value : Math.round(value * 1e9) / 1e9;
    }
    const raw = minimum + random() * Math.max(0, maximum - minimum);
    return type === "integer" ? Math.round(raw) : Math.round(raw * 100) / 100;
  }
  if (type === "boolean") return random() >= 0.5;
  const minLength = options.minLength === undefined ? 6 : Number(options.minLength);
  const maxLength = options.maxLength === undefined ? Math.max(minLength, 18) : Number(options.maxLength);
  const length = Math.min(80, minLength + Math.floor(random() * (maxLength - minLength + 1)));
  return `synthetic-${padded(index + 1)}`.padEnd(length, "x").slice(0, length);
}

function boundaryRecords(fields) {
  const records = [];
  fields.forEach((field) => {
    const step = Number(field.options.multipleOf) > 0 ? Number(field.options.multipleOf) : 1;
    [["min", -step], ["max", step]].forEach(([key, offset]) => {
      if (!Number.isFinite(Number(field.options[key]))) return;
      const value = Number(field.options[key]);
      records.push(
        { __casecraftVariation: `${field.name}:${key}`, [field.name]: value },
        { __casecraftVariation: `${field.name}:outside-${key}`, [field.name]: value + offset },
      );
    });
    [["minLength", -1], ["maxLength", 1]].forEach(([key, offset]) => {
      if (!Number.isInteger(Number(field.options[key]))) return;
      const length = Math.max(0, Number(field.options[key]));
      records.push({ __casecraftVariation: `${field.name}:${key}`, [field.name]: "x".repeat(length) });
      if (length + offset >= 0) records.push({ __casecraftVariation: `${field.name}:outside-${key}`, [field.name]: "x".repeat(length + offset) });
    });
    [["start", -86400000], ["end", 86400000]].forEach(([key, offset]) => {
      if (field.type !== "date" || field.options[key] === undefined) return;
      const timestamp = Date.parse(String(field.options[key]));
      records.push(
        { __casecraftVariation: `${field.name}:${key}`, [field.name]: new Date(timestamp).toISOString().slice(0, 10) },
        { __casecraftVariation: `${field.name}:outside-${key}`, [field.name]: new Date(timestamp + offset).toISOString().slice(0, 10) },
      );
    });
  });
  return records;
}

export function generateSyntheticDataset(fields = [], options = {}) {
  if (!Array.isArray(fields) || !fields.length) throw new TypeError("Definisi field sintetis belum tersedia.");
  const count = Math.min(1000, Math.max(1, Number.parseInt(options.count, 10) || 10));
  const seed = String(options.seed || "casecraft");
  const random = randomFromSeed(seed);
  const records = Array.from({ length: count }, (_, index) => Object.fromEntries(fields.map((field) => [field.name, syntheticValue(field, index, random)])));
  if (options.includeBoundaries) {
    boundaryRecords(fields).forEach((variation) => {
      const base = Object.fromEntries(fields.map((field) => [field.name, syntheticValue(field, records.length, random)]));
      records.push({ ...base, ...variation });
    });
  }
  return { records, seed, synthetic: true, warnings: ["Dataset menggunakan nilai sintetis deterministik. Jangan menggantinya dengan data produksi asli."] };
}

function maskValue(key, value) {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (/email|mail/i.test(key) || /^[^@\s]+@[^@\s]+$/.test(text)) {
    const domain = text.includes("@") ? text.split("@").at(-1) : "masked.invalid";
    return `m***@${domain}`;
  }
  if (/phone|telepon|mobile|nik|ktp|passport|card|kartu|account|rekening/i.test(key) || /^\+?\d[\d\s-]{6,}$/.test(text)) {
    const digits = text.replace(/\D/g, "");
    return `${"*".repeat(Math.max(4, digits.length - 4))}${digits.slice(-4)}`;
  }
  return "***MASKED***";
}

export function maskSensitiveData(input, options = {}) {
  const explicitFields = new Set((options.fields || []).map((field) => String(field).trim()).filter(Boolean));
  const visit = (value, key = "") => {
    if (Array.isArray(value)) return value.map((item) => visit(item, key));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, visit(child, childKey)]));
    return explicitFields.has(key) || SENSITIVE_KEY.test(key) ? maskValue(key, value) : value;
  };
  return visit(structuredClone(input));
}

function csvCell(value) {
  const text = value && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportFixture(records = [], format = "json") {
  if (!Array.isArray(records) || !records.length) throw new TypeError("Belum ada record fixture untuk diekspor.");
  if (format === "json") return { content: `${JSON.stringify(records, null, 2)}\n`, extension: "json", mime: "application/json;charset=utf-8" };
  if (format !== "csv") throw new TypeError("Format fixture hanya JSON atau CSV.");
  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  const content = [headers, ...records.map((record) => headers.map((header) => record[header]))]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
  return { content: `\uFEFF${content}`, extension: "csv", mime: "text/csv;charset=utf-8" };
}
