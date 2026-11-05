import { createCasecraftPlugin } from "../../dist/plugin-sdk.js";

export default createCasecraftPlugin({
  id: "example.qa",
  name: "Example QA policy",
  sdkVersion: 1,
  setup(api) {
    api.registerValidator({
      id: "example.qa.scenario-length",
      label: "Scenario length",
      run(collection) {
        const findings = collection.features.flatMap((feature) => feature.cases
          .filter((testCase) => testCase.scenario.length > 160)
          .map((testCase) => ({ severity: "warning", code: "scenario-long", reference: testCase.id, message: "Skenario melebihi 160 karakter." })));
        return { findings };
      },
    });
  },
});
