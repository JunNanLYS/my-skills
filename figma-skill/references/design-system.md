# Design-System Authority

## Workspace Path

`<Current workspace>/docs/FIGMA_DESIGN_SYSTEM.md` is the only design-system source for figma-skill work. The current workspace is the directory selected and authorized by the user when Claude Code or Codex starts. Changing shell directories or discovering a parent `.git` directory does not redefine the workspace.

## Pre-Spec Context Gate

The design-system document must be read before spec drafting. This read is pre-spec evidence, not a step inside the implementation plan.

The spec must cite the specific design-system rules that govern the task. If the document is missing or lacks rules needed for the task, the agent must stop spec drafting and propose the minimum design-system addition.

## Required Coverage

The document must cover the current task's needed:

- design principles and target platforms;
- colors and semantic roles;
- typography hierarchy;
- spacing and sizing scale;
- grid and responsive breakpoints;
- radius, stroke, and shadow rules;
- icon system;
- base components and states;
- interaction states and accessibility floor;
- naming and component organization.

## Missing Document

When `docs/FIGMA_DESIGN_SYSTEM.md` is missing, build the minimum current-task draft using this priority order:

1. explicit user requirements and brand material;
2. existing Figma variables, styles, and components read through `figma-cli`;
3. stable repeated visual patterns in the target page;
4. professional defaults only when the first three sources are absent.

Show the proposed rules, basis, impact, and out-of-scope conflicts. Wait for explicit design-system approval before writing the document.

## Incomplete Document

When the document lacks current-task rules, add only the minimum missing rule set after approval. Do not use temporary defaults to bypass the gap. Do not modify Figma before the design-system gap is resolved.

## Conflict Policy

The document outranks existing Figma. Approved task scope and direct dependencies must be corrected to match the document. Out-of-scope historical conflicts are reported, not fixed. If correcting a direct dependency affects other pages, disclose that before approval.

## Approval Boundary

Design-system approval does not authorize Figma writes. After the design-system basis is approved, the task still needs an approved spec, approved implementation plan, and pre-write live revalidation before any Figma write.
