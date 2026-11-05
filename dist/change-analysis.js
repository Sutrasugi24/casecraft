const STOP_WORDS = new Set(["diff", "index", "new", "file", "mode", "const", "function", "return", "from", "this", "that", "with", "untuk", "yang", "dan", "atau", "the", "src", "dist", "test", "tests"]);

function tokens(value = "") {
  return [...new Set(String(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token)))];
}

export function parseGitDiff(text = "") {
  const files = [];
  const changedLines = [];
  String(text).replace(/\r/g, "").split("\n").forEach((line) => {
    const file = line.match(/^\+\+\+\s+b\/(.+)$/)?.[1] || line.match(/^diff --git\s+a\/.+?\s+b\/(.+)$/)?.[1];
    if (file && file !== "/dev/null" && !files.includes(file)) files.push(file);
    if (/^[+-](?![+-])/.test(line)) changedLines.push(line.slice(1));
  });
  return { files, changedLines, tokens: tokens(`${files.join(" ")} ${changedLines.join(" ")}`) };
}

export function suggestRegressionCases(feature = {}, diffText = "") {
  const diff = parseGitDiff(diffText);
  if (!diff.files.length && !diff.changedLines.length) return { diff, suggestions: [], warnings: ["Patch tidak memiliki path atau perubahan baris yang dapat dianalisis."] };
  const diffTokens = new Set(diff.tokens);
  const suggestions = (feature.cases || []).map((testCase) => {
    const caseTokens = tokens([testCase.module, testCase.scenario, testCase.source, testCase.evidence, ...(testCase.tags || []), ...(testCase.criterionIds || [])].join(" "));
    const matches = caseTokens.filter((token) => diffTokens.has(token));
    const tagMatches = (testCase.tags || []).filter((tag) => diffTokens.has(String(tag).toLowerCase()));
    const score = matches.length * 10 + tagMatches.length * 15 + (testCase.category === "regression" && matches.length ? 8 : 0) + Math.round((testCase.risk?.score || 0) / 20);
    return { caseId: testCase.id, scenario: testCase.scenario, score, matches: [...new Set([...tagMatches, ...matches])], riskScore: testCase.risk?.score || 0 };
  }).filter((item) => item.matches.length).sort((a, b) => b.score - a.score || b.riskScore - a.riskScore || a.caseId.localeCompare(b.caseId));
  return { diff, suggestions, warnings: suggestions.length ? [] : ["Tidak ada test case dengan bukti tag, modul, atau istilah yang cocok. Tinjau manual; Casecraft tidak mengarang dampak."] };
}
