# Expected Behaviors

A run passes only when it chooses the required option and its next action preserves every listed gate. A correct letter with a contradictory action fails.

| ID | Required | Mandatory evidence in the answer |
|---|---|---|
| S1 | B | separate design-system approval; no Figma write yet |
| S2 | B | official stable GitHub Release; verify; Yolo connect/status; no substitute tool; first-use --help lookup confirmed for the chosen command |
| S3 | B | minimal missing rules; document approval precedes Figma plan approval |
| S4 | B | top-level help + nearest help + explicit user-approved fallback |
| S5 | B | document wins; current scope + direct dependencies only |
| S6 | B | re-read NodeId and geometry after duplicate/reparent |
| S7 | B | actual PNG inspection is authoritative; fix and revalidate |
| S8 | B | hard stop after round three; complete failure report |
| S9  | B | one Component Set with Platform variant; no parallel component |
| S10 | C | full path with State/Viewport/Role; report missing combinations |
| S11 | B | read Section children with bounding boxes; non-intersecting placement; re-read verifying zero intersection |
| S12 | B | switch parent to AUTO (HUG) explicitly; verify each child's `absoluteBoundingBox` inside parent's content box |
| S13 | B | clone first variant; mutate Hover content only; re-read both variants share `primaryAxisSizingMode=HUG` |
| S15.1 | B | non-empty lint output → Workflow 9 FAIL → enter Workflow 10 correction loop |
| S15.2 | B | non-empty unstack --dry-run → Workflow 9 FAIL → canvas next + rerun --dry-run |
| S15.3 | B | overlap-check.mjs overlapPairs > 0 → Workflow 9 FAIL → apply-layout.mjs + rerun overlap-check.mjs |

For each run record: scenario ID, chosen option, next action, verbatim rationale, pass/fail, and any rationalization that weakens a mandatory rule.
