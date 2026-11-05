# UX Contract

## Product context

- Audience: QA engineer berbahasa Indonesia yang meninjau dan mengeksekusi test case.
- Primary jobs: membuat suite dari requirement, membuktikan traceability acceptance criterion, mengkurasi spesifikasi, menjalankan test cycle tanpa menimpa riwayat, dan mencadangkan proyek lokal.
- Interface locale: `id-ID` default with an `en` option. Requirement language and generated/export/report output language are stored separately; Casecraft does not translate arbitrary source requirement text.
- Persistence: `sessionStorage` adalah default. Pengguna dapat memilih mirror IndexedDB permanen pada perangkat dan dapat ekspor/impor `.casecraft.json`. Tidak ada backend atau sinkronisasi remote.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Product workflow and data lifecycle | `PRODUCT.md` | Product brief | 2026-11-04 |
| Visual and interaction direction | `DESIGN.md` | Design contract | 2026-11-04 |

Permissions, billing, payment, and legal-copy rules are not applicable to the current browser-only release.

## Visual contract

- Project design source: `DESIGN.md`.
- Token ownership: `DESIGN.md` defines durable values; `dist/styles.css` maps them once to CSS custom properties.
- Supported theme: light.
- Drift gate: `npm run check`, project tests, premium audit, and real-browser inspection.

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native `<select>` in product forms | `DESIGN.md` | native | keyboard + browser popup |
| Form | Product forms in `dist/index.html` and `dist/management.html` | This contract | create / edit | validation + browser flow |
| Scrollbar | Global baseline in `dist/styles.css` | `DESIGN.md` | stable gutter on tables | computed style + browser |
| Toast | Single `#toast` live region per page | This contract | acknowledgement / undo | live region + browser |
| CRUD | Management inspector and `dist/management.js` | `PRODUCT.md` + this contract | stay in active suite | full browser flow |
| File import | Native file inputs with explicit triggers | This contract | project backup or structured specification | validation + replacement/generation flow |
| Test cycle | `dist/collection-store.js` cycle helpers | `PRODUCT.md` + this contract | build / environment / browser / device | unit + browser flow |
| Table selection | Repository checkboxes and `selectedCaseIds` in `dist/management.js` | This contract | visible rows / explicit cases | unit + E2E |
| Configurable export | `dist/export-config.js` and `#export-dialog` | `PRODUCT.md` + this contract | Jira / Markdown / TSV / CSV | unit + E2E |
| Requirement versioning | `dist/analysis-tools.js` and `#version-dialog` | `PRODUCT.md` + this contract | analyze / apply | unit + E2E |
| Risk and parameters | Management inspector/editor | `PRODUCT.md` + this contract | generated / QA-adjusted | unit + E2E |
| Quality gate | `runQualityGate` and `#export-dialog` | `PRODUCT.md` + this contract | blocking error / warning / draft override | unit + E2E |
| Run comparison | `dist/run-comparison.js` and `#compare-dialog` | `PRODUCT.md` + this contract | baseline / target cycle | unit + E2E |
| QA report | `dist/qa-report.js` and `#report-dialog` | `PRODUCT.md` + this contract | HTML download / browser print-PDF | unit + E2E + print preview |
| Local adapter | `dist/adapter-registry.js` | `ADAPTERS.md` | import / export | unit + E2E |
| Locale | `dist/localization.js` plus explicit output selectors | This contract | `id` / `en` | E2E |
| PWA shell | `dist/pwa.js`, `dist/sw.js`, manifest | `PRODUCT.md` + this contract | online / offline / installable | offline E2E |
| Automation readiness | `dist/automation-tools.js` and inspector automation card | `PRODUCT.md` + this contract | incomplete / candidate / ready | unit + E2E |
| Automation result import | `dist/automation-results.js` and `#automation-report-dialog` | `PRODUCT.md` + this contract | JUnit XML / Playwright JSON | unit + E2E |
| Pairwise generation | `dist/pairwise.js` and inspector disclosure | `PRODUCT.md` + this contract | explicit factors only | pair-coverage unit test + E2E |
| Change analysis | `dist/change-analysis.js` and `#diff-dialog` | `PRODUCT.md` + this contract | local patch evidence | unit + E2E |
| Dependency graph | `dist/dependency-graph.js` and `#dependency-dialog` | `PRODUCT.md` + this contract | evidence nodes and edges | unit + E2E |
| Test Data Studio | `dist/test-data-studio.js` and `#test-data-dialog` | `PRODUCT.md` + this contract | synthetic / masking | unit + E2E |
| Flaky triage | `dist/flaky-analysis.js` and `#flaky-dialog` | `PRODUCT.md` + this contract | retry / environment / product signals | unit + E2E |
| CLI quality gate | `bin/casecraft.mjs` and `dist/ci-quality-gate.js` | `CLI.md` | generate / validate / export / compare | unit + CLI integration |
| Plugin SDK | `dist/plugin-sdk.js` | `PLUGIN-SDK.md` | parser / generator / validator / exporter / automation adapter | unit + CLI integration |
| Advanced test design | `dist/advanced-test-design.js` and `#design-lab-dialog` | `PRODUCT.md` + this contract | model / fuzz / visual / accessibility / performance / security / mobile / migration / localization | unit + E2E + narrow viewport |

## Dataset and navigation

- The current release renders the bounded suite in one horizontally scrollable native table; no pagination is needed for the generator's maximum of 30 cases plus QA additions.
- Search and committed filters remain in URL parameters. Clearing search is immediate, returns focus to the field, and updates the visible-count status.
- Category, priority, QA status, reject status, tag, and sorting remain reversible and are reflected in URL parameters. Sortable headers are keyboard buttons with `aria-sort`.
- Empty collection and no-filter-results are distinct states. No-results offers Reset filter.
- The selected feature scopes summary, list, inspector, and exports. Narrow layouts preserve all table columns through horizontal scrolling.
- The traceability map lists every parsed criterion and its linked cases. Status is explicit text: covered, uncovered, ambiguous, or Happy-path-only.
- Requirement versions retain a local history. Impact labels are explicit text: update, rerun, obsolete, or unaffected.
- Each case can carry parameter combinations and a weighted risk score derived from impact, probability, complexity, and regression exposure. Risk orders work; it does not claim coverage.
- Manual and edited test cases can link to one or more existing criteria through checkboxes in the specification editor; no link is inferred from similar wording.
- QA status, reject status, and actual result always belong to the active cycle. Switching cycles restores that cycle's values and keeps prior results in the inspector timeline.
- Defect reference and blocker reason also belong to the active cycle. New and manually created cases join the active cycle snapshot without rewriting earlier cycle scope.
- Pass rate is `passed / executed`; `Belum diuji` is excluded. A passing baseline that fails in the target is a new regression; a failing baseline that passes is fixed.
- Rename preserves the suite's stable internal ID. Archive is reversible and keeps all requirements, cases, cycles, and history; the final active suite cannot be archived so restore controls remain reachable.
- Bulk status updates apply only to explicitly checked cases and only in the active cycle. The confirmation states the exact count and next status.
- Route titles use `{feature} — Manajemen Test Case — Casecraft` on management and page-specific Indonesian titles elsewhere.
- Automation status is visible per repository row and summarized in the audit rail. A technically ready case remains only a candidate until QA sets an explicit lifecycle and approves skeleton generation.
- Imported automation results update only the selected cycle. Matching requires an exact Casecraft ID in the report title; unmatched entries remain unchanged and visible in the import summary.
- Git-diff suggestions require overlapping path, tag, module, scenario, source, or criterion evidence. No match produces a review warning instead of a guessed regression suite.

## Flow ledger

| Operation | Trigger | Success destination | Success feedback | Failure recovery | Focus outcome |
|---|---|---|---|---|---|
| Create manual | Buat manual | Inspector, new case selected | Toast + “Baru” badge | Inline errors preserve input | New case heading |
| Edit specification | Edit / Simpan perubahan | Same inspector | Toast + local save status | Inline errors preserve input | Updated case heading |
| Duplicate | Duplikasi | Duplicated case in same suite | Toast | Storage error remains visible | Duplicate heading |
| Delete | Hapus / Hapus test case | Next surviving case or empty collection | Toast with Urungkan | Undo restores exact specification | Next case, create action, or restored heading |
| Search/filter | Search and native filters | Same route | Result-count status | Reset filter | Search remains operable |
| Cancel editor | Batal | Same selected case | None | Dirty form requires discard confirmation | Case heading |
| Create cycle | Siklus baru / Buat siklus | Same active suite, new cycle selected | Toast + persistent cycle context | Inline validation preserves input | Cycle selector |
| Import project | Impor proyek / Impor proyek | Imported active feature | Toast | Invalid file leaves active project unchanged | Suite heading |
| Enable persistence | Gunakan IndexedDB | Same active suite | Inline storage status | Session copy remains available | Storage toggle |
| Rename suite | Ubah nama / Simpan nama | Same active suite | Toast | Inline duplicate/required validation | Suite heading |
| Archive suite | Arsipkan / Arsipkan suite | Next active suite | Toast + archive rail | Restore retains exact suite data | Next suite heading |
| Restore suite | Pulihkan | Restored suite selected | Toast | Archived copy remains if save fails | Suite heading |
| Bulk status | Row checkboxes / Terapkan status | Same active suite and cycle | Toast with exact count | Confirmation can be cancelled | Select-all checkbox |
| Configure export | Atur ekspor | Same active suite | Preview, copy toast, or download | Empty-column error preserves choices | Template select |
| Import specification | Impor file lokal | Generator populated from local structure | Recognized format + scenario count | Invalid/unsupported file leaves current input intact | Requirement field |
| Version requirement | Versi baru / Analisis / Terapkan | Same active suite with impact labels | Toast with impact counts | Invalid/unchanged text remains in dialog | Version trigger |
| Curate risk/parameters | Edit / Simpan perubahan | Same selected case | Updated inspector and table | Inline validation preserves input | Updated case heading |
| Quality gate export | Atur ekspor / export as draft | Same active suite | Findings + enabled output | Blocking errors disable actions until fixed or overridden | Template or override |
| Compare runs | Bandingkan run | Comparison dialog | Metrics and exact affected case IDs | Requires two distinct cycles | Baseline select |
| Create report | Laporan QA | Report dialog | Preview + HTML download or browser print | Invalid cycle keeps actions disabled | Cycle select |
| Change interface language | Bahasa antarmuka | Same route and state | Owned UI copy changes in place | Preference failure falls back to Indonesian | Language select |
| Install/offline | Instal aplikasi / browser offline | Standalone or cached shell | Persistent connection status | Cache failure keeps online app usable | Trigger or current context |
| Generate skeleton | Disetujui QA / Buat skeleton automation | Skeleton dialog | Preview, copy, or local download | Missing fields remain TODO; unapproved case is blocked | Framework select |
| Import automation report | Impor hasil / Terapkan ke test run | Same suite and selected cycle | Toast with matched, unmatched, and flaky counts | Invalid file or absent IDs leaves run unchanged | Cycle select |
| Generate pairwise | Pairwise disclosure / Buat kombinasi pairwise | Same selected case | Combination count and parameter table | Invalid factor syntax preserves input | Factor textarea |
| Analyze Git diff | Analisis Git diff / local file | Diff dialog | Exact suggested case IDs and matched terms | No evidence yields an explicit manual-review warning | Close button |
| Inspect dependency graph | Peta dependensi | Graph dialog | Node and relation totals | Empty relation types remain absent rather than fabricated | Close button |
| Create synthetic fixture | Test data studio / Proses data | Same dialog with preview | Deterministic records and enabled downloads | Invalid grammar preserves definitions and focuses error | Preview or error |
| Mask fixture JSON | Test data studio / Masking JSON sensitif | Same dialog with masked preview | Sensitive values replaced locally | Invalid JSON preserves source and focuses error | Preview or error |
| Analyze flaky tests | Analisis flaky | Flaky evidence dialog | Text summary and exact case evidence | Insufficient history remains an explicit empty state | Close button |
| Generate advanced test plan | Lab desain pengujian / Buat rancangan | Same focused dialog | Preview, warnings, copy, or local download | Invalid grammar preserves every field and focuses inline error | Preview or error |

Duplication preserves specification, criterion links, and priority, appends “(salinan)” to the scenario, and resets execution fields in the active cycle. Deleting the final case keeps its feature requirement and traceability map so the uncovered state remains reviewable. Deletion is local removal with a six-second undo window.

## Forms, overlays, and feedback

- Product forms use `novalidate`, Indonesian inline errors, `aria-invalid`, existing `aria-describedby` targets, and first-invalid focus.
- Specification textareas use `resize: none` and explicit save. Execution fields retain their existing session autosave behavior.
- Dirty specification drafts use the styled native `<dialog>` for in-app case/feature changes and `beforeunload` only for page/tab exit.
- Destructive confirmation names the case and consequence, initially focuses Batal, closes on Escape, and restores or deliberately moves focus.
- The single toast appears at bottom-right, deduplicates by replacement, lasts 3.2 seconds normally or 6 seconds when it contains Urungkan.
- Native selects are intentional because platform-owned popup geometry is acceptable for Casecraft.
- Project import accepts one `.casecraft.json`/JSON file up to 5 MB, validates the versioned envelope and normalized schema, then requires an app-owned replacement confirmation. The current project is untouched on validation failure.
- Structured import accepts one local `.feature`, `.json`, `.yaml`, `.yml`, `.csv`, `.md`, or `.markdown` file up to 5 MB. It supports Gherkin, OpenAPI, JSON Schema, CSV, and Markdown without network calls.
- Automation report import accepts one `.xml` or `.json` file up to 10 MB. Git-diff analysis accepts one `.diff`, `.patch`, or `.txt` file up to 5 MB. Both use native file selection, parse locally, preserve the current workspace on validation failure, and expose an app-owned review dialog before mutation.
- Turning off IndexedDB requires confirmation because it removes the durable local mirror; the session copy remains intact.
- Export preview and output use only the active suite. Templates provide defaults, but selected columns, CSV delimiter, QA status mapping, quality findings, and the explicit draft override remain user-controlled and local.
- Test Data Studio accepts an explicit local field grammar and a maximum of 1,000 generated records. Preview is capped while download keeps the full fixture. Masking processes pasted JSON in memory and never persists it automatically.
- Flaky analysis reads existing local cycle evidence and never changes case status, defect state, or automation ownership.
- Advanced test-design modes process only local form input. Security mode never sends requests; mobile and localization matrices are capped; migration mode never connects to a database; all outputs remain review artifacts until explicitly downloaded.

## Resilience and verification

- Session mutations are synchronous; IndexedDB mirroring is asynchronous. A mirror failure keeps the in-memory/session data and exposes inline recovery status.
- The service worker caches only same-origin application-shell GET requests. Requirement and workspace data remain in sessionStorage/IndexedDB and are not placed in the Cache API.
- Offline reload preserves the shell. Durable workspace recovery still requires opted-in IndexedDB or a `.casecraft.json` backup; the UI never equates an installed PWA with a durable workspace.
- Collaboration mode stays local until a registered provider supplies authentication, privacy-policy URL, consent copy, and an explicit connect action. No provider is bundled in this release.
- Requirement and specification input is never sent over the network.
- CLI commands perform no network request. Plugin loading is explicit and outside the browser upload surface; trusted Node plugins retain process privileges and are governed by `PLUGIN-SDK.md`.
- Required commands: `npm run check`, `npm test`, `npm run test:e2e`, and the strict premium audit.
- Browser matrix: desktop and narrow viewport; pointer and keyboard; empty, validation-error, generate, structured import, reusable profile, ambiguous/uncovered traceability, requirement versioning/impact, parameter/risk editing, quality-gated export, automation readiness/approval/skeleton, JUnit result import, pairwise generation, all nine advanced test-design modes, Test Data Studio generation/masking/download, flaky empty/evidence states, Git-diff suggestions, dependency graph, contract cases, edit, create, duplicate, delete/undo, filtered, sorted, autosave, cycle create/switch/history, backup/import, IndexedDB, configurable copy/download, and narrow-table overflow states.
