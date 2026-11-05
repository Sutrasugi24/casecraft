const METHOD_PATTERN = /^(get|post|put|patch|delete|options|head|trace)$/i;

function prefix(value = "") {
  const words = String(value).normalize("NFKD").replace(/[^a-zA-Z0-9\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  return (words.map((word) => word[0]).join("").slice(0, 8) || "IMP").toUpperCase();
}

function finalizeCases(cases, featureName) {
  return cases.map((testCase, index) => ({
    id: `TC_${prefix(featureName)}_${String(index + 1).padStart(3, "0")}`,
    module: featureName,
    category: testCase.category || "happy",
    categoryLabel: testCase.category === "negative" ? "Negative" : testCase.category === "edge" ? "Edge case" : testCase.category === "regression" ? "Regression" : "Happy path",
    testType: testCase.category === "negative" ? "Negatif" : testCase.category === "happy" || !testCase.category ? "Positif" : "HYBRID",
    priority: testCase.priority || (["negative", "happy"].includes(testCase.category) ? "High" : "Medium"),
    qaStatus: "Belum diuji",
    rejectStatus: "Tidak ditolak",
    actual: "",
    tags: ["import", ...(testCase.tags || [])],
    criterionIds: testCase.criterionIds || [],
    parameterSets: testCase.parameterSets || [],
    ...testCase,
  }));
}

function parseGherkin(text, fallbackName) {
  const lines = text.replace(/\r/g, "").split("\n");
  const featureName = lines.find((line) => /^\s*(Feature|Fitur)\s*:/i.test(line))?.replace(/^\s*(Feature|Fitur)\s*:\s*/i, "").trim() || fallbackName;
  const cases = [];
  let scenario = null;
  let mode = "";
  lines.forEach((raw) => {
    const line = raw.trim();
    const match = line.match(/^(Scenario Outline|Scenario|Skenario Outline|Skenario)\s*:\s*(.+)$/i);
    if (match) {
      if (scenario) cases.push(scenario);
      scenario = { scenario: match[2], category: /invalid|gagal|error|tolak|tidak/i.test(match[2]) ? "negative" : "happy", precondition: "", steps: [], expected: "", testData: "", parameterSets: [], source: "Import Gherkin" };
      mode = "";
      return;
    }
    if (!scenario) return;
    const step = line.match(/^(Given|When|Then|And|But|Dengan|Ketika|Maka|Dan|Tapi)\s+(.+)$/i);
    if (step) {
      const keyword = step[1].toLocaleLowerCase("id-ID");
      if (["given", "dengan"].includes(keyword)) { scenario.precondition = step[2]; mode = "given"; }
      else if (["then", "maka"].includes(keyword)) { scenario.expected = step[2]; mode = "then"; }
      else if (["and", "dan"].includes(keyword) && mode === "then") scenario.expected += `${scenario.expected ? "; " : ""}${step[2]}`;
      else { scenario.steps.push(step[2]); mode = "when"; }
      return;
    }
    if (/^Examples?\s*:/i.test(line)) { mode = "examples"; return; }
    if (mode === "examples" && /^\|.*\|$/.test(line)) {
      const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
      if (!scenario._exampleHeaders) scenario._exampleHeaders = cells;
      else {
        const data = Object.fromEntries(scenario._exampleHeaders.map((header, index) => [header, cells[index] || ""]));
        scenario.parameterSets.push({ label: `Examples ${scenario.parameterSets.length + 1}`, data: JSON.stringify(data), expected: scenario.expected });
      }
    }
  });
  if (scenario) cases.push(scenario);
  cases.forEach((testCase) => { delete testCase._exampleHeaders; testCase.steps = testCase.steps.length ? testCase.steps : ["Jalankan scenario sesuai spesifikasi Gherkin."]; testCase.testData = testCase.parameterSets.length ? "Gunakan kombinasi pada Examples." : "Data yang disebutkan pada scenario."; });
  return { format: "Gherkin", featureName, requirementText: cases.map((item) => `Given ${item.precondition}\nWhen ${item.steps.join(" dan ")}\nThen ${item.expected}`).join("\n\n"), cases, warnings: cases.length ? [] : ["Scenario Gherkin tidak ditemukan."] };
}

function openApiOperationsFromJson(document) {
  const operations = [];
  Object.entries(document.paths || {}).forEach(([path, pathItem]) => {
    Object.entries(pathItem || {}).forEach(([method, operation]) => {
      if (!METHOD_PATTERN.test(method)) return;
      const parameters = [...(pathItem.parameters || []), ...(operation.parameters || [])];
      operations.push({
        path,
        method: method.toUpperCase(),
        summary: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        parameters: parameters.filter((parameter) => parameter?.required).map((parameter) => parameter.name),
        parameterContracts: parameters.map((parameter) => ({ name: parameter.name, required: Boolean(parameter.required), schema: parameter.schema || {} })),
        requestRequired: Boolean(operation.requestBody?.required),
        security: operation.security === undefined ? (document.security || []) : operation.security,
        responses: Object.entries(operation.responses || {}).map(([status, response]) => ({
          status,
          description: response?.description || "",
          hasSchema: Object.values(response?.content || {}).some((media) => Boolean(media?.schema)),
        })),
      });
    });
  });
  return operations;
}

function openApiOperationsFromYaml(text) {
  const operations = [];
  let currentPath = "";
  let current = null;
  let section = "";
  let currentResponse = null;
  let currentParameter = null;
  text.replace(/\r/g, "").split("\n").forEach((raw) => {
    const indent = raw.match(/^\s*/)[0].length;
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    if (indent === 2 && /^\//.test(line) && line.endsWith(":")) { currentPath = line.slice(0, -1); current = null; section = ""; return; }
    const method = line.match(/^(get|post|put|patch|delete|options|head|trace):$/i);
    if (currentPath && indent === 4 && method) {
      current = { path: currentPath, method: method[1].toUpperCase(), summary: `${method[1].toUpperCase()} ${currentPath}`, parameters: [], parameterContracts: [], requestRequired: false, security: [], responses: [] };
      operations.push(current);
      section = "";
      currentResponse = null;
      currentParameter = null;
      return;
    }
    if (!current) return;
    if (/^(summary|operationId):/.test(line)) current.summary = line.replace(/^[^:]+:\s*/, "").replace(/^['"]|['"]$/g, "");
    if (indent === 6 && /^responses:$/.test(line)) { section = "responses"; currentResponse = null; return; }
    if (indent === 6 && /^parameters:$/.test(line)) { section = "parameters"; currentParameter = null; return; }
    if (indent === 6 && /^requestBody:$/.test(line)) { section = "requestBody"; return; }
    if (section === "responses") {
      const response = line.match(/^['"]?(\d{3}|default)['"]?:\s*(.*)$/);
      if (response) {
        currentResponse = { status: response[1], description: response[2] || "", hasSchema: false };
        current.responses.push(currentResponse);
        return;
      }
      const description = line.match(/^description:\s*(.*)$/);
      if (currentResponse && description) currentResponse.description = description[1].replace(/^['"]|['"]$/g, "");
    }
    if (section === "parameters") {
      const name = line.match(/^(?:-\s*)?name:\s*(.+)$/);
      if (name) { currentParameter = name[1].replace(/^['"]|['"]$/g, ""); return; }
      if (currentParameter && /^required:\s*true\s*$/i.test(line)) {
        current.parameters.push(currentParameter);
        currentParameter = null;
      }
    }
    if (section === "requestBody" && /^required:\s*true\s*$/i.test(line)) current.requestRequired = true;
    if (/^security:\s*$/.test(line)) current.security = ["declared"];
  });
  return operations;
}

function boundaryParameterSets(name, schema = {}, rejectedExpected = "Nilai ditolak oleh constraint schema.") {
  const sets = [];
  const numericStep = Number(schema.multipleOf) > 0 ? Number(schema.multipleOf) : 1;
  const addNumeric = (key, label, direction) => {
    if (schema[key] === undefined || !Number.isFinite(Number(schema[key]))) return;
    const boundary = Number(schema[key]);
    const outside = boundary + (numericStep * direction);
    sets.push(
      { label: `${name} · ${label}`, data: `${name}=${boundary}`, expected: `Nilai pada ${label} diterima sesuai contract.` },
      { label: `${name} · di luar ${label}`, data: `${name}=${outside}`, expected: rejectedExpected },
    );
  };
  const addLength = (key, label, direction) => {
    if (schema[key] === undefined || !Number.isInteger(Number(schema[key]))) return;
    const boundary = Math.max(0, Number(schema[key]));
    const outside = Math.max(0, boundary + direction);
    sets.push(
      { label: `${name} · ${label}`, data: `${name}=<panjang ${boundary}>`, expected: `Nilai pada ${label} diterima sesuai contract.` },
      { label: `${name} · di luar ${label}`, data: `${name}=<panjang ${outside}>`, expected: rejectedExpected },
    );
  };
  addNumeric("minimum", "minimum", -1);
  addNumeric("maximum", "maksimum", 1);
  addLength("minLength", "panjang minimum", -1);
  addLength("maxLength", "panjang maksimum", 1);
  return sets;
}

function parseOpenApi(text, fallbackName) {
  let document = null;
  try { document = JSON.parse(text); } catch { /* YAML handled below */ }
  const operations = document ? openApiOperationsFromJson(document) : openApiOperationsFromYaml(text);
  const featureName = document?.info?.title || fallbackName || "OpenAPI";
  const cases = [];
  const warnings = [];
  operations.forEach((operation) => {
    const required = [...operation.parameters, ...(operation.requestRequired ? ["request body"] : [])];
    const boundarySets = (operation.parameterContracts || []).flatMap((parameter) => boundaryParameterSets(parameter.name, parameter.schema, "Request ditolak sesuai error contract eksplisit."));
    operation.responses.forEach((response) => {
      const numeric = Number.parseInt(response.status, 10);
      const category = numeric >= 400 ? "negative" : "happy";
      cases.push({
        category,
        scenario: `${operation.method} ${operation.path} menghasilkan ${response.status}`,
        precondition: required.length ? `Field wajib tersedia: ${required.join(", ")}.` : "Endpoint tersedia sesuai spesifikasi OpenAPI.",
        steps: [`Kirim request ${operation.method} ke ${operation.path}.`, "Catat status, body, dan perubahan data."],
        testData: required.length ? `Nilai untuk: ${required.join(", ")}.` : "Request tanpa parameter wajib eksplisit.",
        expected: `${response.status}${response.description ? ` · ${response.description}` : ""}${response.hasSchema ? " · Body valid terhadap response schema." : ""}`,
        source: operation.summary,
        tags: ["openapi", "contract", numeric >= 400 ? "error-contract" : "response-contract", operation.method.toLocaleLowerCase("id-ID")],
        parameterSets: boundarySets,
      });
    });
    if (operation.security?.length) {
      const authorizationResponse = operation.responses.find((response) => ["401", "403"].includes(response.status));
      if (authorizationResponse) cases.push({
        category: "negative",
        scenario: `${operation.method} ${operation.path} tanpa authorization yang valid`,
        precondition: "Security scheme dideklarasikan pada OpenAPI.",
        steps: [`Kirim request ${operation.method} ke ${operation.path} tanpa credential atau dengan credential tidak valid.`, "Validasi status dan body error terhadap contract."],
        testData: "Credential kosong atau tidak valid sesuai security scheme yang dideklarasikan.",
        expected: `${authorizationResponse.status}${authorizationResponse.description ? ` · ${authorizationResponse.description}` : ""}${authorizationResponse.hasSchema ? " · Body error valid terhadap response schema." : ""}`,
        source: operation.summary,
        tags: ["openapi", "contract", "authorization"],
      });
      else warnings.push(`${operation.method} ${operation.path} mendeklarasikan security tetapi tidak memiliki response 401/403; authorization case tidak dikarang.`);
    }
  });
  if (!operations.length) warnings.push("Path dan operation OpenAPI tidak ditemukan.");
  return { format: "OpenAPI", featureName, requirementText: operations.map((operation) => `${operation.summary}: ${operation.method} ${operation.path}; respons ${operation.responses.map((response) => response.status).join(", ")}.`).join("\n"), cases, warnings };
}

function parseJsonSchema(text, fallbackName) {
  const schema = JSON.parse(text);
  const featureName = schema.title || fallbackName || "JSON Schema";
  const required = new Set(schema.required || []);
  const properties = schema.properties || {};
  const parameterSets = [];
  Object.entries(properties).forEach(([name, definition]) => {
    parameterSets.push(...boundaryParameterSets(name, definition, "Payload ditolak oleh constraint schema."));
    if (definition.format) parameterSets.push({ label: `${name} · format valid`, data: `${name}=<${definition.format} valid>`, expected: `Format ${definition.format} diterima.` });
    if (definition.pattern) parameterSets.push({ label: `${name} · pattern`, data: `${name}=<sesuai ${definition.pattern}>`, expected: "Nilai yang sesuai pattern diterima." });
  });
  const cases = [{
    category: "happy",
    scenario: `Validasi payload ${featureName} sesuai JSON Schema`,
    precondition: "Validator menggunakan schema yang diimpor.",
    steps: ["Susun payload dari properties schema.", "Validasi payload.", "Catat error dan perubahan data."],
    testData: `Field wajib: ${[...required].join(", ") || "tidak ada yang ditandai required"}.`,
    expected: "Payload yang memenuhi type, required, format, dan constraint diterima.",
    source: "Import JSON Schema",
    tags: ["json-schema"],
    parameterSets,
  }];
  if (required.size) cases.push({ category: "negative", scenario: "Tolak payload tanpa field wajib", precondition: "Validator menggunakan schema yang diimpor.", steps: ["Hapus satu field required.", "Validasi payload."], testData: `Variasikan field: ${[...required].join(", ")}.`, expected: "Payload ditolak untuk setiap field required yang hilang.", source: "Import JSON Schema", tags: ["json-schema", "required"], parameterSets: [...required].map((name, index) => ({ id: `DATA-${String(index + 1).padStart(3, "0")}`, label: `Tanpa ${name}`, data: `Hapus ${name}`, expected: `${name} dilaporkan wajib.` })) });
  const formatted = Object.entries(properties).filter(([, definition]) => definition.format || definition.pattern);
  if (formatted.length) cases.push({ category: "negative", scenario: "Tolak format atau pattern payload yang invalid", precondition: "Validator menggunakan JSON Schema yang diimpor.", steps: ["Isi field dengan format yang melanggar schema.", "Validasi payload dan detail error contract."], testData: formatted.map(([name, definition]) => `${name}=<invalid ${definition.format || definition.pattern}>`).join(", "), expected: "Payload ditolak dan field yang melanggar format atau pattern diidentifikasi.", source: "Import JSON Schema", tags: ["json-schema", "contract", "format"] });
  return { format: "JSON Schema", featureName, requirementText: `Schema ${featureName}. Field wajib: ${[...required].join(", ") || "tidak ada"}. Constraint: ${parameterSets.map((set) => set.label).join(", ") || "type properties"}.`, cases, warnings: [] };
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) { if (character === "\r" && text[index + 1] === "\n") index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseCsv(text, fallbackName) {
  const rows = parseCsvRows(text);
  const headers = (rows.shift() || []).map((header) => header.trim().toLocaleLowerCase("id-ID"));
  const get = (record, aliases) => aliases.map((alias) => record[headers.indexOf(alias)]).find((value) => value !== undefined) || "";
  const cases = rows.map((record) => ({
    category: get(record, ["category", "kategori"]) || "happy",
    scenario: get(record, ["scenario", "skenario", "summary", "skenario uji"]),
    precondition: get(record, ["precondition", "prasyarat"]),
    steps: get(record, ["steps", "langkah", "langkah uji"]).split(/\r?\n|\s*;\s*/).filter(Boolean),
    testData: get(record, ["test data", "data uji", "testdata"]),
    expected: get(record, ["expected", "expected result", "hasil yang diharapkan"]),
    priority: get(record, ["priority", "prioritas"]) || "Medium",
    tags: get(record, ["tags", "tag"]).split(/\s*[,;]\s*/).filter(Boolean),
    source: "Import CSV",
  })).filter((item) => item.scenario);
  return { format: "CSV", featureName: fallbackName || "Import CSV", requirementText: cases.map((item) => `${item.scenario}: ${item.expected}`).join("\n"), cases, warnings: cases.length ? [] : ["Kolom scenario/skenario tidak ditemukan atau CSV kosong."] };
}

function parseMarkdown(text, fallbackName) {
  const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackName || "Import Markdown";
  const meaningful = text.replace(/```[\s\S]*?```/g, "").split("\n").map((line) => line.replace(/^\s*(?:#{1,6}|[-*+] |\d+[.)] )\s*/, "").trim()).filter((line) => line.length > 8);
  return { format: "Markdown", featureName: title, requirementText: meaningful.join("\n"), cases: [], warnings: meaningful.length ? ["Markdown diubah menjadi requirement; test case dibuat hanya dari kriteria yang dapat dikenali."] : ["Konten requirement tidak ditemukan pada Markdown."] };
}

export function detectStructuredFormat({ name = "", text = "" } = {}) {
  const lower = name.toLocaleLowerCase("id-ID");
  if (/\.feature$/.test(lower) || /^\s*(Feature|Fitur)\s*:/im.test(text)) return "gherkin";
  if (/\.(yaml|yml)$/.test(lower) || /^\s*openapi\s*:/im.test(text)) return "openapi";
  if (/\.csv$/.test(lower)) return "csv";
  if (/\.(?:md|markdown)$/.test(lower)) return "markdown";
  if (/\.json$/.test(lower)) {
    try { const parsed = JSON.parse(text); return parsed.openapi || parsed.swagger ? "openapi" : parsed.$schema || parsed.properties ? "json-schema" : "unknown"; } catch { return "unknown"; }
  }
  return "unknown";
}

export function parseStructuredSpecification(file) {
  const format = detectStructuredFormat(file);
  const fallbackName = String(file.name || "Import spesifikasi").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  try {
    const parsed = format === "gherkin" ? parseGherkin(file.text, fallbackName)
      : format === "openapi" ? parseOpenApi(file.text, fallbackName)
        : format === "json-schema" ? parseJsonSchema(file.text, fallbackName)
          : format === "csv" ? parseCsv(file.text, fallbackName)
            : format === "markdown" ? parseMarkdown(file.text, fallbackName)
              : { format: "Tidak dikenal", featureName: fallbackName, requirementText: "", cases: [], warnings: ["Format file belum dikenali sebagai Gherkin, OpenAPI, JSON Schema, CSV, atau Markdown."] };
    return { ok: Boolean(parsed.requirementText || parsed.cases.length), ...parsed, cases: finalizeCases(parsed.cases, parsed.featureName) };
  } catch (error) {
    return { ok: false, format, featureName: fallbackName, requirementText: "", cases: [], warnings: [`File tidak dapat diparsing: ${error.message}`] };
  }
}
