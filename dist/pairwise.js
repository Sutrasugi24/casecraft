function unique(values = []) {
  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
}

export function parsePairwiseFactors(text = "") {
  const factors = String(text).split(/\r?\n/).map((line) => {
    const separator = line.indexOf("=");
    if (separator < 1) return null;
    const name = line.slice(0, separator).trim();
    const values = unique(line.slice(separator + 1).split("|"));
    return name && values.length ? { name, values } : null;
  }).filter(Boolean);
  if (factors.length > 8) throw new TypeError("Pairwise dibatasi maksimal 8 faktor per proses.");
  if (factors.some((factor) => factor.values.length > 12)) throw new TypeError("Setiap faktor dibatasi maksimal 12 nilai.");
  return factors;
}

function key(index, previousValue, nextValue) {
  return `${index}\u0000${previousValue}\u0000${nextValue}`;
}

export function generatePairwise(factors = []) {
  if (!Array.isArray(factors) || factors.length < 2) throw new TypeError("Pairwise memerlukan sedikitnya dua faktor.");
  let rows = factors[0].values.flatMap((first) => factors[1].values.map((second) => [first, second]));
  for (let nextIndex = 2; nextIndex < factors.length; nextIndex += 1) {
    const uncovered = new Set();
    for (let previousIndex = 0; previousIndex < nextIndex; previousIndex += 1) {
      factors[previousIndex].values.forEach((previousValue) => factors[nextIndex].values.forEach((nextValue) => uncovered.add(key(previousIndex, previousValue, nextValue))));
    }
    rows.forEach((row) => {
      const scored = factors[nextIndex].values.map((nextValue, order) => ({ nextValue, order, score: row.reduce((sum, previousValue, previousIndex) => sum + Number(uncovered.has(key(previousIndex, previousValue, nextValue))), 0) })).sort((a, b) => b.score - a.score || a.order - b.order);
      row[nextIndex] = scored[0].nextValue;
      for (let previousIndex = 0; previousIndex < nextIndex; previousIndex += 1) uncovered.delete(key(previousIndex, row[previousIndex], row[nextIndex]));
    });
    while (uncovered.size) {
      const [pair] = uncovered;
      const [anchorIndexText, anchorValue, nextValue] = pair.split("\u0000");
      const anchorIndex = Number(anchorIndexText);
      const row = Array(nextIndex + 1).fill("");
      row[anchorIndex] = anchorValue;
      row[nextIndex] = nextValue;
      for (let previousIndex = 0; previousIndex < nextIndex; previousIndex += 1) {
        if (row[previousIndex]) continue;
        row[previousIndex] = factors[previousIndex].values.find((candidate) => uncovered.has(key(previousIndex, candidate, nextValue))) || factors[previousIndex].values[0];
      }
      for (let previousIndex = 0; previousIndex < nextIndex; previousIndex += 1) uncovered.delete(key(previousIndex, row[previousIndex], nextValue));
      rows.push(row);
    }
  }
  return rows.map((row, index) => ({
    id: `PAIR-${String(index + 1).padStart(3, "0")}`,
    label: `Pairwise ${index + 1}`,
    data: factors.map((factor, factorIndex) => `${factor.name}=${row[factorIndex]}`).join(", "),
    expected: "Gunakan expected result test case untuk kombinasi ini.",
    values: Object.fromEntries(factors.map((factor, factorIndex) => [factor.name, row[factorIndex]])),
  }));
}
