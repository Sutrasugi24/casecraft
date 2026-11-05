export function buildDependencyGraph(feature = {}) {
  const nodes = [];
  const edges = [];
  const addNode = (id, type, label, metadata = {}) => { if (!nodes.some((node) => node.id === id)) nodes.push({ id, type, label, metadata }); };
  const addEdge = (from, to, relation) => edges.push({ from, to, relation });
  const featureId = `feature:${feature.id || feature.name || "active"}`;
  addNode(featureId, "feature", feature.name || "Feature");
  (feature.requirements || []).forEach((requirement) => {
    const requirementId = `requirement:${requirement.id}`;
    addNode(requirementId, "requirement", requirement.id, { version: requirement.currentVersion || 1 });
    addEdge(featureId, requirementId, "memiliki requirement");
  });
  (feature.cases || []).forEach((testCase) => {
    const caseId = `case:${testCase.id}`;
    addNode(caseId, "case", testCase.id, { scenario: testCase.scenario, automation: testCase.automation?.lifecycle || "manual" });
    addEdge(featureId, caseId, "memiliki test case");
    (testCase.criterionIds || []).forEach((criterionId) => addEdge(`requirement:${criterionId.split("-AC-")[0]}`, caseId, `menguji ${criterionId}`));
    if (testCase.testData) {
      const baseDataId = `data:${testCase.id}:base`;
      addNode(baseDataId, "data", `Data utama ${testCase.id}`, { data: testCase.testData });
      addEdge(caseId, baseDataId, "menggunakan data");
    }
    (testCase.parameterSets || []).forEach((set) => {
      const dataId = `data:${testCase.id}:${set.id}`;
      addNode(dataId, "data", set.label || set.id, { data: set.data });
      addEdge(caseId, dataId, "menggunakan data");
    });
    if (testCase.defectReference) {
      const defectId = `defect:${testCase.defectReference}`;
      addNode(defectId, "defect", testCase.defectReference);
      addEdge(caseId, defectId, "menemukan defect");
    }
    (testCase.automation?.scripts || []).forEach((script, index) => {
      const scriptId = `script:${testCase.id}:${index + 1}`;
      addNode(scriptId, "script", script.filename, { framework: script.framework, status: "draft" });
      addEdge(caseId, scriptId, "memiliki draft automation");
    });
  });
  (feature.cycles || []).forEach((cycle) => {
    const cycleId = `run:${cycle.id}`;
    addNode(cycleId, "run", cycle.name, { build: cycle.buildVersion, environment: cycle.environment });
    addEdge(featureId, cycleId, "dieksekusi pada");
    Object.entries(cycle.results || {}).forEach(([caseId, result]) => {
      addEdge(`case:${caseId}`, cycleId, "memiliki hasil pada run");
      if (result.defectReference) {
        const defectId = `defect:${result.defectReference}`;
        addNode(defectId, "defect", result.defectReference);
        addEdge(`case:${caseId}`, defectId, "menemukan defect");
        addEdge(defectId, cycleId, "tercatat pada run");
      }
    });
  });
  return { nodes, edges };
}
