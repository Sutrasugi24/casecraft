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
    radius: "10px"
  panel:
    radius: "16px"
  input:
    radius: "10px"
---

## Overview

Casecraft should feel like a QA engineer's annotated lab notebook: systematic, legible, and visibly concerned with coverage. It is a product surface for Indonesian QA practitioners, not a marketing page. The signature element is the coverage rail beside generated results, where the suite's balance is visible before any row is read.

Avoid generic AI-dashboard styling, neon gradients, chat bubbles, glassmorphism, and oversized decorative metrics. The interface should communicate that generation is an inspectable draft, not magic.

Runtime token owner: this file defines the durable intent and exact values. `dist/styles.css` maps each color, radius, and type role once into CSS custom properties; components consume only those custom properties.

## Colors

The canvas is a cool paper gray. White panels are working sheets, carbon ink carries content, and blueprint blue marks primary actions and functional structure. Signal coral is reserved for validation and selected coverage marks. Positive green and caution amber are semantic only.

## Typography

Use the display serif sparingly for the product name and the primary workspace headline. Body copy uses a locale-safe sans-serif stack. IDs, counts, and small data labels use the utility mono stack so the table reads like an executable specification.

## Layout

Desktop uses a two-column workbench: requirement input on the left and generated coverage on the right. The output table owns its horizontal overflow. At narrow widths, the panels stack and controls remain full-width. The page itself keeps natural document scrolling.

## Elevation & Depth

Panels use a single quiet shadow and a 1px line. Nested surfaces are flat; hierarchy comes from tone and dividers rather than stacking cards.

## Shapes

Panels use a restrained 16px radius. Inputs and buttons use 10px. Pills are limited to status and category labels. Table geometry remains mostly square so rows stay easy to scan.

## Components

Buttons have explicit hover, focus, pressed, disabled, and busy states. The primary button uses blueprint blue. Semantic category chips include text and a marker, never color alone. The result table uses a native table with a sticky header and a clearly visible horizontal scrollbar.

## Do's and Don'ts

- Do show what coverage was generated and what is absent.
- Do use plain Indonesian actions: “Buat test case”, “Salin untuk Notion”, “Unduh CSV Jira”.
- Do retain the user's requirement when validation or generation fails.
- Don't imply that a generated suite is automatically complete.
- Don't use animation beyond one short result reveal and clear busy feedback.
- Don't hide table columns on mobile; allow deliberate horizontal comparison.
