---
version: alpha
colors:
  canvas: "#f2f5f8"
  surface: "#ffffff"
  ink: "#17212b"
  muted: "#5f6b76"
  line: "#d9e0e7"
  blueprint: "#2457a7"
  signal: "#e95d3f"
  positive: "#18794e"
  caution: "#a15c00"
typography:
  display:
    fontFamily: "Iowan Old Style, Baskerville, Georgia, serif"
    lineHeight: "1.05"
  body:
    fontFamily: "Aptos, Segoe UI, Helvetica Neue, Arial, sans-serif"
    lineHeight: "1.55"
  utility:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    lineHeight: "1.4"
rounded:
  control: "10px"
  panel: "16px"
  pill: "999px"
spacing:
  unit: "4px"
  section: "24px"
components:
  button:
    rounded: "10px"
  panel:
    rounded: "16px"
  input:
    rounded: "10px"
---

## Overview

Casecraft should feel like a QA engineer's annotated lab notebook: systematic, legible, and visibly concerned with coverage. It is a product surface for Indonesian QA practitioners, not a marketing page. The signature element is the audit rail: category coverage, requirement traceability, generation warnings, and execution context remain readable beside the active suite before any row is opened.

Avoid generic AI-dashboard styling, neon gradients, chat bubbles, glassmorphism, and oversized decorative metrics. The interface should communicate that generation is an inspectable draft, not magic.

Runtime token owner: this file defines the durable intent and exact values. `dist/styles.css` maps each color, radius, and type role once into CSS custom properties; components consume only those custom properties.

## Colors

The canvas is a cool paper gray. White panels are working sheets, carbon ink carries content, and blueprint blue marks primary actions and functional structure. Signal coral is reserved for validation and selected coverage marks. Positive green and caution amber are semantic only.

## Typography

Use the display serif sparingly for the product name and the primary workspace headline. Body copy uses a locale-safe sans-serif stack. IDs, counts, and small data labels use the utility mono stack so the table reads like an executable specification.

## Layout

Casecraft uses two focused pages connected by a numbered workflow header. The header owns compact locale, install, and offline-state controls without becoming a separate settings dashboard. Generator is a calm two-column brief intake: requirement and output language, local structured import, and reusable profiles sit beside a QA-specific input checklist. Management remains a three-part QA repository, while build comparison and printable reports open in focused dialogs so release analysis does not displace the active suite. At narrow widths, panels and report controls stack, the compact table keeps horizontal overflow, and the page retains natural document scrolling.

## Elevation & Depth

Panels use a single quiet shadow and a 1px line. Nested surfaces are flat; hierarchy comes from tone and dividers rather than stacking cards.

## Shapes

Panels use a restrained 16px radius. Inputs and buttons use 10px. Pills are limited to status and category labels. Table geometry remains mostly square so rows stay easy to scan.

## Components

Buttons have explicit hover, focus, pressed, disabled, and busy states. The primary button uses blueprint blue. Semantic category, priority, and execution-status chips include text, never color alone. The repository list uses a native table with a sticky header and a clearly visible horizontal scrollbar; selecting the scenario button opens the complete case in the adjacent inspector.

Traceability items use a narrow semantic rule plus explicit text labels: `Tercakup`, `Belum tercakup`, `Ambigu`, or `Happy path saja`. Test case IDs are real buttons that open the linked case. The specification editor exposes criterion links as labeled checkboxes so manual and curated cases can repair traceability intentionally. Generation warnings remain persistent in the rail because they are review work, not transient notifications. Test cycle metadata and execution history use compact notebook entries; the active cycle is always named in text.

Generator creates a new feature suite or merges missing scenarios into a suite with the same feature name. Management never mixes suites: feature selection scopes the execution summary, requirement additions, coverage, search, filters, list, inspector, and exports. The selected feature and selected test case use a blueprint inset marker plus `aria-current`, so selection never relies on color alone. Search and committed filters are reflected in the URL; a visible clear action and no-results recovery keep filtering reversible. Priority defaults to High for Happy path and Negative cases, and Medium for Edge case and Regression cases, but remains editable by QA. Priority, QA status, reject status, and actual result use native controls because platform-owned popup geometry is acceptable for this browser-only workbench; all execution edits auto-save to session storage.

Specification curation uses one explicit editor inside the existing inspector instead of a separate dashboard or page. Editing and manual creation require an explicit save, guard dirty drafts, and retain the inspector's notebook-like hierarchy. Duplication copies the specification but resets execution status, reject status, and actual result. Deletion uses an app-owned confirmation dialog followed by a short, honest undo window; safe edit/duplicate actions remain visually separated from the danger action. Project import uses the same confirmation system because it replaces the active local collection. Native file selection is intentional; accepted type and size are validated before replacement.

Reusable profiles remain visibly labeled drafts and carry a quality-gate warning until QA edits them. Structured specification import is a native local-file action on the Generator page; its feedback names the recognized format and scenario count. Parameter combinations use a compact three-column table in the inspector and a deliberately plain `Label | Data | Expected` editor so data remains portable and inspectable.

Requirement versioning uses a two-step dialog: analyze first, then explicitly apply. The comparison preserves stable criterion IDs where possible and the inspector shows the resulting case impact in text. Risk is displayed as both a score and level, with all four 1–5 inputs available in the editor; it supports sorting but never replaces traceability.

Suite rename preserves the stable internal suite identity and updates its visible module name. Archive is a reversible local lifecycle state exposed in the suite rail; the final active suite is kept available so recovery controls are never stranded. Table sorting uses real header buttons with `aria-sort`, selection is explicit through checkboxes, and bulk QA-status changes name their exact scope before updating the active cycle. Failed and blocked cases remain summarized below the repository table with text status and direct navigation.

Configurable export uses one app-owned dialog. Template selection establishes useful defaults for Jira, Markdown, TSV, or generic CSV, while column selection, delimiter, status mapping, preview, copy, and download remain visible together. Export configuration never implies a remote Jira or Notion connection.

The quality gate is part of the export dialog, close to the action it governs. Errors disable copy and download; an explicit “export as draft” checkbox provides an auditable local override. Warnings remain non-blocking and all findings name the affected test case or criterion.

Run comparison uses the notebook's strongest visual device: small evidence cells followed by four textual case groups. It avoids chart decoration because exact test IDs and status transitions matter more than a trend graphic. Local reports deliberately switch to a restrained white print sheet with stable tables and page-break behavior. The report preview shows counts only; the downloaded/printed document owns the full evidence.

Offline state is persistent header text, not a transient toast. Install is shown only when the browser exposes the install prompt. Workspace persistence remains an explicit IndexedDB choice, and the collaboration rail states that networking is inactive rather than presenting a disabled integration as a usable control.

Automation stays inside the existing audit-rail and inspector language. The rail uses compact evidence counts for manual, candidate, automated, flaky, and not-suitable cases; the repository adds one explicit text column instead of a chart. The inspector readiness card resembles a lab checklist: five named technical inputs, a percentage, and a restrained blueprint rule. It never uses a celebratory score treatment because readiness is not approval.

Skeleton, automation-report, Git-diff, and dependency views reuse the established focused dialog. Pairwise input remains a plain portable factor grammar. The dependency view uses small typed evidence nodes rather than a decorative force graph so labels, counts, keyboard reading order, and narrow layouts remain stable.

Test Data Studio and flaky triage also reuse focused workbench dialogs instead of becoming separate dashboards. Test Data Studio keeps its field grammar, seed, boundary choice, masking input, preview, and fixture downloads in one linear form; synthetic and masking modes never compete on screen. Flaky triage uses a horizontally scrollable evidence table with textual classification, retry count, environment, and reason. Neither surface uses a confidence chart or color-only diagnosis because exact evidence and uncertainty matter more than decoration.

Advanced test design is consolidated in one focused lab dialog with a native mode selector. Only the active model, fuzz, visual, accessibility, performance, security, mobile, migration, or localization form is visible, keeping the action rail compact and keyboard order predictable. Every mode ends in the same preview, warning, copy, and local-download pattern. Visual baseline selection uses a visible native file control with type, count, and size guidance; screenshot bytes stay in memory while portable plans retain only metadata and a digest. Security uses compact contract grammars instead of attack controls; device and locale coverage use bounded matrices; migration keeps version and reconciliation evidence textual. The lab uses explicit grammars and measured thresholds instead of wizard-like inference, and generated scripts remain visually labeled as review artifacts.

## Do's and Don'ts

- Do show what coverage was generated and what is absent.
- Do keep the requirement-to-case link and prior cycle results inspectable.
- Do use plain Indonesian actions: “Buat test case”, “Salin untuk Notion”, “Unduh CSV Jira”.
- Do retain the user's requirement when validation or generation fails.
- Don't imply that a generated suite is automatically complete.
- Don't use animation beyond one short result reveal and clear busy feedback.
- Don't hide table columns on mobile; allow deliberate horizontal comparison.
- Don't present a generated automation skeleton as deployable code or hide unresolved TODO evidence.
- Don't infer regression impact, selectors, cleanup, authorization contracts, or report-to-case identity without explicit local evidence.
- Don't infer invalid state transitions, fuzz invariants, allowed visual differences, accessibility conformance, or production-ready load settings when the contract is absent.
- Don't imply security assurance, physical-device coverage, migration safety, or translation correctness from a generated planning artefact alone.
