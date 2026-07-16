# figma-skill helper scripts

These scripts support figma-skill v3 PlanWeave-orchestrated tasks. PlanWeave owns workflow state. `figma-cli` owns Figma reads and writes. These helpers do not create task state.

## Read-only helpers

- `list-children.mjs` — lists direct children for a target node.
- `overlap-check.mjs` — checks scoped child AABB overlap and Containment Gate data.
- `page-overlap-check.mjs` — checks top-level page AABB overlap.
- `inspect-geometry.mjs` — reports detailed geometry for a target node.
- `figma-validate-bounds.mjs` — offline JSON bounds analysis for specific geometry risks.

Read-only helpers must be run through `figma-cli run` when they need live Figma data. `figma-validate-bounds.mjs` may analyze exported JSON without contacting Figma.

## Write helpers

- `apply-layout.mjs` — applies an approved movement plan.
- `resize-section.mjs` — resizes approved sections.

Write helpers require an approved PlanWeave write block, fresh pre-write live revalidation, and post-write live re-read evidence.

## Installer

- `install-figma-cli.ps1` installs `figma-cli` on Windows from the approved GitHub Releases flow described in `references/installation.md`.
