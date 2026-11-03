# Casecraft

Casecraft is an Indonesian-language QA workbench that turns feature requirements into structured test cases. The first release runs entirely in the browser and does not transmit requirement text to an external service.

## Primary workflow

1. A QA engineer enters a feature name and requirement.
2. They select the coverage categories that matter.
3. Casecraft analyzes requirement clauses and creates a reviewable test suite.
4. The suite can be copied as a Notion-ready Markdown table or downloaded as Jira-ready CSV.

## Product boundaries

- Generation is deterministic and heuristic in this release.
- Generated cases are a review aid, not a replacement for QA judgment.
- No authentication, persistence, team sharing, or remote AI service is included yet.
- All generated data remains in the current browser tab unless exported.
