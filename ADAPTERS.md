# Local adapter contract

Casecraft adapters extend import or export formats without changing `generator.js`. The registry is implemented in `dist/adapter-registry.js` and runs entirely in the browser.

## Register an export adapter

```js
import { registerAdapter } from "./adapter-registry.js";

registerAdapter({
  id: "internal-qa",
  label: "Internal QA",
  export(cases, options) {
    return {
      content: JSON.stringify({ cases, options }, null, 2),
      extension: "json",
      mime: "application/json;charset=utf-8",
    };
  },
});
```

Adapter IDs are stable lowercase identifiers. An adapter must provide `export` or `import`; duplicate IDs are rejected. Export functions return `{ content, extension, mime }`. Import functions receive `{ name, type, text }` and return normalized parse results.

Built-in export adapters cover Jira, Azure DevOps, TestRail, Xray, Markdown, TSV, generic CSV, and internal JSON. Structured local import covers Gherkin, OpenAPI, JSON Schema, CSV, and Markdown. The `automation-report` import adapter reads JUnit XML, Playwright JSON, and compatible local JSON result arrays before a separate cycle-update step.

Casecraft does not load arbitrary JavaScript selected from a file input. New adapter modules are reviewed source code shipped with the local application. This prevents a “plugin” file from silently reading the workspace or enabling network access.

## Collaboration providers

`dist/collaboration-provider.js` is a separate boundary. A remote provider must declare a privacy-policy URL and explicit consent copy before registration. Registration alone does not enable networking; a future product decision must add authentication, consent UI, retention rules, and a reviewed provider connection.
