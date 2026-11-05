# Casecraft

Casecraft is an Indonesian-language QA workbench that turns feature requirements into structured test cases. The first release runs entirely in the browser and does not transmit requirement text to an external service.

## Primary workflow

1. On the Generator page, a QA engineer enters a feature name and requirement, selects the coverage categories, and may opt into a reusable profile for authentication, CRUD, payment, search, upload, permission, or bulk operations.
2. The engineer may import a local Gherkin, OpenAPI, JSON Schema, CSV, or Markdown file. Casecraft uses only structures present in the file and never uploads it.
3. Casecraft parses acceptance criteria, Given/When/Then, explicit boundaries, roles, failure conditions, dependencies, and data outcomes. It creates only scenarios supported by that evidence, records warnings when information is insufficient, and attaches explicit parameter combinations where boundaries or examples exist.
4. On the Management page, the QA engineer selects one feature suite at a time, can rename or archive suites, searches or filters by category, priority, QA status, reject status, and tag, sorts the compact repository list, and reviews a traceability map from every criterion to its test cases. Criteria that are uncovered, ambiguous, or covered only by Happy path remain visible.
5. During review, they can edit generated specifications, parameter combinations, and four risk inputs; add manual cases; duplicate a case as a clean execution draft; or delete a case with an immediate undo path. The weighted risk score prioritizes execution and never claims complete coverage.
6. When a requirement changes, QA stores a new local version. Casecraft compares criteria and marks linked cases as needing an update, a rerun, no longer relevant, or unaffected.
7. Before execution, they select or create a test cycle with build, environment, browser, and device context. Status, reject state, and actual results are recorded per cycle so retest and regression runs do not overwrite history.
8. Two cycles can be compared by build or release. Casecraft highlights new failures, fixed cases, regressions, active blockers, new cases, and the pass-rate delta using the cycle snapshots.
9. A local QA report summarizes scope, environment, coverage, execution, defect references, blockers, residual risk, and an optional run comparison. It downloads as standalone HTML and prints through the browser for PDF saving.
10. Before export, a quality gate identifies incomplete steps, unmeasurable expected results, empty data, duplicates, uncovered requirements, failed cases without an actual result, and blocked cases without a reason. Errors block export unless QA explicitly exports a draft.
11. The active feature suite can be exported through local adapters for Jira, Azure DevOps, TestRail, Xray, Markdown, TSV, generic CSV, or internal JSON. QA chooses columns, delimiter, QA-status mapping, output language, and optional risk, impact, and parameter columns.
12. Interface, requirement, and output language are separate choices. Indonesian remains the default. English output translates Casecraft-owned structure; source requirement wording remains intact and is never sent to a translation service.
13. Casecraft is an installable PWA. Its application shell works offline, while IndexedDB and `.casecraft.json` remain the explicit workspace persistence and recovery mechanisms.
14. Each test case has an automation readiness check for selector or request target, data, precondition, assertion, and cleanup. The repository maps manual, candidate, automated, flaky, and not-suitable states without equating readiness with business approval.
15. After QA explicitly approves a case, Casecraft can export a review-only Playwright, Cypress, WebdriverIO, or Postman skeleton. Missing evidence remains a visible `TODO`; the generator does not invent selectors, endpoints, or assertions.
16. JUnit XML and Playwright JSON reports can be imported locally into an explicitly selected test cycle. Results match by Casecraft ID in the automation test title, and unmatched results remain reported rather than guessed.
17. QA can create deterministic pairwise data sets, inspect a dependency map across requirements, cases, data, runs, defects, and draft scripts, and import a local Git patch to receive evidence-based regression suggestions.
18. OpenAPI and JSON Schema imports act as a contract-testing assistant: declared responses, error contracts, authorization responses, formats, required fields, and explicit boundaries become reviewable cases or parameter sets.
19. Test Data Studio creates deterministic synthetic records from an explicit field grammar, adds declared boundary variations, masks sensitive JSON fields, and exports local JSON or CSV fixtures. It warns QA not to use original production data.
20. Flaky-test management summarizes retry recovery, status transitions, environment correlation, and repeated defect evidence across test cycles. Its classifications are triage signals, never an automatic verdict about product or automation ownership.
21. A local CLI exposes `generate`, `validate`, `export`, and `compare` for CI and scripted workflows. The CI quality gate returns a failing exit code for uncovered criteria, unmeasurable expected results, excessive duplication, or stale regression cases.
22. `.casecraft.json` is an openly documented, versioned interchange format with a published JSON Schema. Other tools may read or produce the workspace without a Casecraft account or service.
23. A versioned Plugin SDK registers namespaced parser, generator, validator, exporter, and automation-adapter capabilities. Plugins are explicitly installed trusted code; uploaded JavaScript is never executed by the browser UI.
24. The local test-design lab converts an explicit state-transition grammar into valid, invalid, and recovery test cases. Invalid and recovery behavior is generated only when the expected transition is declared.
25. Property-based and fuzz planning creates a seeded, repeatable corpus from typed rules, explicit numeric or length limits, enum values, and QA-written invariants. Boundary values outside a declared contract remain labeled as invalid candidates rather than asserted product outcomes.
26. Visual-regression planning builds a review matrix across pages, viewports, themes, and locales. Selected baseline screenshots remain local; only their name, size, MIME type, and SHA-256 digest are written to the portable plan, together with explicitly allowed dynamic regions.
27. The accessibility workbench creates a WCAG 2.2 AA-oriented checklist for keyboard, focus, screen-reader expectations, zoom/reflow, reduced motion, and selected component patterns. It is a test plan, not an automated conformance claim.
28. The performance designer turns explicit workload, concurrency, duration, ramp-up, data-volume, and threshold inputs into review-only k6 or JMeter drafts. It never executes load from the browser.
29. The security catalogue maps explicit authorization decisions, session policies, injection entry points, sensitive-data audiences, rate limits, and business-abuse guards to review scenarios labelled with OWASP WSTG v4.2, ASVS 5.0.0, and API Security Top 10 references. It never executes attacks or claims security assurance.
30. The mobile-device matrix crosses declared devices, operating systems, browsers, viewport sizes, orientations, network conditions, and virtual-keyboard states. It is capped at 1,000 combinations and warns when slow-network, rotation, or open-keyboard evidence is absent.
31. Data-migration planning creates forward-version, integrity, backward-compatibility, rollback, and reconciliation cases from explicit source/target versions, entities, keys, record volumes, checks, triggers, metrics, and tolerances.
32. Localization planning produces reviewable evidence for expanded translations, locale-aware date/time/number formatting, timezones, plural categories, mixed-script text, and an explicit fallback locale using the browser's local `Intl` implementation.

## Product boundaries

- Generation is deterministic, evidence-bound, and heuristic in this release. A warning is preferred over invented business detail.
- Reusable profiles are editable drafts, not hidden business rules. Imported specifications are parsed locally with deliberately focused format support.
- Requirement impact and risk scores are decision aids. They do not replace QA review or prove complete coverage.
- Generated cases are a review aid, not a replacement for QA judgment.
- No authentication, team sharing, remote synchronization, or remote AI service is included.
- The active collection can contain multiple feature suites and local execution cycles. It uses browser session storage by default, supports an opt-in IndexedDB mirror, and can be exported as a portable local backup.
- Archived suites remain in the local project and can be restored. Bulk status updates affect only explicitly selected cases in the active test cycle.
- Pass rate uses passed cases divided by executed cases; untested cases are excluded. Cycle snapshots preserve scope for release comparison.
- Local adapter modules are validated and registered outside the generator. Casecraft does not execute arbitrary imported JavaScript as a plugin.
- Remote collaboration remains unavailable by default. Any future provider must be a separate opt-in mode with authentication, explicit consent, and a visible privacy policy before network access is enabled.
- Automation skeletons are drafts, never production-ready scripts. Engineer review, stable fixtures, secrets handling, retries, and CI integration remain outside Casecraft.
- Automation report import never creates unknown test cases. Git-diff analysis uses only local patch evidence and does not access a repository, infer ownership, or claim a complete impact analysis.
- Pairwise generation covers value pairs from explicitly supplied factors; it does not prove exhaustive state, sequence, or business-rule coverage.
- Synthetic fixtures use deterministic fake values and reserved example domains. Masking is a safety aid, not permission to copy production data into Casecraft.
- Flaky classifications remain evidence summaries. Product defects and automation instability still require human triage with logs, retry history, environment context, and defect references.
- CLI and CI commands read local files and share the browser application's deterministic core. Exit codes are machine-readable, but a passing gate is not a claim of complete test coverage.
- The open project schema and Plugin SDK are public interoperability surfaces. Node plugins execute with the caller's process privileges and must be reviewed before use.
- Advanced test-design artifacts are local drafts. State models do not invent missing invalid behavior, fuzz datasets do not evaluate business invariants, screenshot baselines are not stored in the project, accessibility checklists do not certify conformance, and performance drafts require engineer review before execution.
- Security references guide catalogue structure but do not prove OWASP coverage, vulnerability absence, or authorization to test a target. Mobile matrices do not replace physical-device evidence; migration plans do not run database changes; localization samples may vary when the browser's locale data changes and still require native-language review.
- A self-hosted team edition is not part of the local release. It may be built only as a separate edition after collaboration demand and policies for authentication, roles, approval, audit, PII, conflicts, tenant isolation, and privacy are established.
