# Naming and Workflow Coverage

## v1.2.1 Connect-Status + Specimen Reduction Traceability

| Spec part / section                              | Implemented at                                                | Marker                                                                    |
|--------------------------------------------------|---------------------------------------------------------------|---------------------------------------------------------------------------|
| Part I.3 — Workflow 1 status-first sequence      | figma-skill/SKILL.md: Workflow 1                               | 6 步顺序 + "禁止在 status 之前调用 connect"                                |
| Part I.5 — Yolo Connection Gate rewritten         | figma-skill/references/installation.md: Yolo Connection Gate   | 4 步顺序 + 末尾 "任何情况下禁止自动调用 daemon restart"                    |
| Part I, validator assertion 3                     | figma-skill/SKILL.md: Workflow 1                               | "daemon restart" literal in Workflow 1 block                              |
| Part I, validator assertion 5 (negative)          | figma-skill/references/installation.md                        | no `## Concurrent Agent Connection` heading                               |
| Part II.3 — Workflow 4A specimen count 4→1       | figma-skill/SKILL.md: Workflow 4A                              | "Specimen/StateGallery" only, contains all variants                        |
| Part II.4 — validator removes three Specimens     | figma-skill/tests/validate-skill.mjs: assertNamingAndWorkflow | only Specimen/StateGallery listed; VariantMatrix/Properties/Usage removed  |
| Part III.1 — validator adds Connect-Status Gate   | figma-skill/tests/validate-skill.mjs: assertConnectStatusGate | 5 assertions (status-before-connect, prohibition, daemon-restart, status-first Yolo, negative assertion) |
| Part III.2 — validator keeps StateGallery        | figma-skill/tests/validate-skill.mjs                          | Specimen/StateGallery in marker list                                      |

## v1.2 Geometry & Placement Mandates Traceability

| Spec section                                     | Implemented at                  | Marker                                                                 |
|--------------------------------------------------|---------------------------------|------------------------------------------------------------------------|
| Section 3 — Visual-Overlap Rules                 | figma-skill/SKILL.md:223        | Workflow 4A overlap sub-steps                                          |
| Section 3 — Screen placement                     | figma-skill/SKILL.md:243        | Workflow 4D overlap sub-steps                                          |
| Section 3 — Flow connector placement             | figma-skill/SKILL.md:258        | Workflow 4F magnet-from-geometry                                       |
| Section 4 — Geometry Family A (Auto Layout)      | figma-skill/SKILL.md:534        | `### Auto Layout Mode Selection`                                       |
| Section 4 — Geometry Family B (Fixed Parent)     | figma-skill/SKILL.md:540        | `### Fixed Parent Clipping`                                            |
| Section 4 — Geometry Family C (Variant Baseline) | figma-skill/SKILL.md:546        | `### Component Set Variant Baseline`                                   |
| Section 5 — Mandatory Lookups by Phase           | figma-skill/SKILL.md:186        | `## Mandatory Lookups by Phase`                                        |
| Section 5.2 — NNR rule for Lookups               | figma-skill/SKILL.md:24         | `## Non-Negotiable Rules` 10th bullet                                  |
| Section 6.5 — Workflow 6 fields                  | figma-skill/SKILL.md:280        | `PlacementAudit` / `GeometryAudit` / `OverlapCheck` / `GeometryReaudit`|
| Section 6.6 — Workflow 7 Geometry baseline        | figma-skill/SKILL.md:318        | `Geometry:` block                                                      |
| Section 6.7 — Workflow 8 batch check             | figma-skill/SKILL.md:336        | `命名、NodeId、hierarchy、geometry` clause in check step                |
| Section 6.8 — Workflow 9 Geometry layer           | figma-skill/SKILL.md:340        | `Naming → Structure → Geometry → Visual → DesignSystem → Flow`          |
| Section 6.9 — Workflow 11 delivery report        | figma-skill/SKILL.md:359        | `Geometry:` / `OverlapMatrix:` / `VariantRowParity:`                   |
| Section 7 — Component Geometry Mandates          | figma-skill/SKILL.md:534        | `## Component Geometry Mandates`                                       |
| Section 8 — Six New Red Flags                    | figma-skill/SKILL.md:572-577    | last six bullets in `## Red Flags — Stop`                              |
| Section 9.1 — execution.md Geometry-aware         | figma-skill/references/execution.md | `## Geometry-aware Commands`                                       |
| Section 9.2 — validation.md Geometry Validation  | figma-skill/references/validation.md | `## Geometry Validation Checklist`                                  |
| Section 10.1 — S11/S12/S13                       | figma-skill/tests/scenarios.md:67+ | three new pressure scenarios                                         |
| Section 10.1 — Expected behaviors                 | figma-skill/tests/expected-behaviors.md | rows S11/S12/S13                                              |
| Section 10.2 — validate-skill.mjs v1.2 asserts    | figma-skill/tests/validate-skill.mjs:165+ | `assertGeometryAndLookups`                                       |
| Section 10.3 — naming-and-workflow.test.mjs v1.2  | figma-skill/tests/naming-and-workflow.test.mjs:108+ | three new tests                                            |

## Deterministic Tests

| Test                                                                                  | Purpose                                       | Status |
|---------------------------------------------------------------------------------------|-----------------------------------------------|--------|
| `node figma-skill/tests/validate-skill.mjs`                                           | Structure, wording, S1-S8, naming + workflow | PASS   |
| `node --test figma-skill/tests/naming-and-workflow.test.mjs`                           | Dedicated naming/workflow coverage            | PASS   |
| `node --test figma-skill/tests/figma-validate-bounds.test.mjs`                        | Bounds auditor regression                     | PASS   |
| `powershell figma-skill/tests/install-figma-cli.Tests.ps1`                            | Installer fixtures                             | PASS   |
| `powershell figma-skill/scripts/install-figma-cli.ps1 -PlanOnly`                     | Live stable Release plan                      | PASS   |

## SKILL.md Coverage

### Naming Grammar (Spec Sections 1–5)

| Spec section                                | Implemented at                  | Marker                                                                 |
|--------------------------------------------|---------------------------------|------------------------------------------------------------------------|
| Section 1 — Language and Path Grammar      | figma-skill/SKILL.md:28         | `### Component Path`                                                   |
| Section 1 — language anchor                 | figma-skill/SKILL.md:26         | `## Naming Grammar` heading                                            |
| Section 2 — Fixed Base Categories          | figma-skill/SKILL.md:43-54      | Foundation / Primitive / Action / Input / Navigation / DataDisplay / Feedback / Overlay / Layout / Content / Internal / Deprecated |
| Section 3 — Collision Resolution            | figma-skill/SKILL.md:89         | `### Collision Resolution`                                            |
| Section 4 — Variants, Properties, Instances| figma-skill/SKILL.md:97         | `### Variant Axes`                                                     |
| Section 4 — Instance naming                | figma-skill/SKILL.md:132        | `### Instance Naming`                                                  |
| Section 5 — Screen path                    | figma-skill/SKILL.md:55         | `### Screen Path`                                                      |
| Section 5 — Three-page architecture        | figma-skill/SKILL.md:136        | `## Three-Page Architecture (Free Figma Plan)`                         |
| Section 5 — Specimen path                  | figma-skill/SKILL.md:74         | `### Specimen Path`                                                    |
| Section 5 — Flow path                      | figma-skill/SKILL.md:83         | `### Flow Path`                                                        |

### Workflows 0–11 (Spec Section 6)

| Workflow  | Implemented at                  |
|-----------|---------------------------------|
| Workflow 0  | figma-skill/SKILL.md:187        |
| Workflow 1  | figma-skill/SKILL.md:191        |
| Workflow 2  | figma-skill/SKILL.md:195        |
| Workflow 3  | figma-skill/SKILL.md:199        |
| Workflow 4  | figma-skill/SKILL.md:203        |
| Workflow 4A | figma-skill/SKILL.md:207        |
| Workflow 4B | figma-skill/SKILL.md:211        |
| Workflow 4C | figma-skill/SKILL.md:215        |
| Workflow 4D | figma-skill/SKILL.md:219        |
| Workflow 4E | figma-skill/SKILL.md:223        |
| Workflow 4F | figma-skill/SKILL.md:227        |
| Workflow 4G | figma-skill/SKILL.md:231        |
| Workflow 4H | figma-skill/SKILL.md:235        |
| Workflow 5  | figma-skill/SKILL.md:239        |
| Workflow 6  | figma-skill/SKILL.md:243        |
| Workflow 7  | figma-skill/SKILL.md:274        |
| Workflow 8  | figma-skill/SKILL.md:278        |
| Workflow 9  | figma-skill/SKILL.md:282        |
| Workflow 10 | figma-skill/SKILL.md:286        |
| Workflow 11 | figma-skill/SKILL.md:290        |

### Diagrams (Spec Section 7)

| Diagram                            | Implemented at                  |
|------------------------------------|---------------------------------|
| Total Workflow Graph               | figma-skill/SKILL.md:320        |
| Task Entry and Reuse Graph         | figma-skill/SKILL.md:362        |
| Single-Direction Dependency Graph | figma-skill/SKILL.md:408        |
| Validation Order Graph             | figma-skill/SKILL.md:419        |
| Page Architecture Graph            | figma-skill/SKILL.md:433        |

## Behavior Scenarios

| Scenario                                            | Choice | Coverage by deterministic test                                                  |
|-----------------------------------------------------|--------|---------------------------------------------------------------------------------|
| S1–S8                                               | B      | `validate-skill.mjs` S1–S8 markers                                              |
| S9 — Component naming collision                     | B      | `naming-and-workflow.test.mjs` Variant axes + `### Collision Resolution`      |
| S10 — Screen identity with State/Viewport/Role      | C      | `naming-and-workflow.test.mjs` Screen path markers + `### Screen Path`        |
| S11 — Visual overlap on create                      | B      | `naming-and-workflow.test.mjs` overlap keywords + `### Auto Layout Mode Selection` |
| S12 — Auto Layout overflow                          | B      | `naming-and-workflow.test.mjs` geometry families test                          |
| S13 — Component Set variant baseline divergence     | B      | `naming-and-workflow.test.mjs` variant parity test                            |

## Spec Resolution Notes

- No `references/naming.md` was created; the spec revision folded naming grammar into `SKILL.md`.
- Existing reference files (`installation.md`, `design-system.md`, `discovery-and-planning.md`, `execution.md`, `validation.md`) are unchanged in this upgrade.
- The five new Red Flags from spec Section 9 are listed in `SKILL.md` `## Red Flags — Stop` at line 462.
- v1.2: SKILL.md grew from 494 to 598 lines (+104). Adding `## Mandatory Lookups by Phase`, expanding Workflows 4A/4D/4F/6/7/8/9/11, and inserting `## Component Geometry Mandates` produced the change. References remain minimal-only.
- v1.2: Tests grew from 7 → 10 in `naming-and-workflow.test.mjs`; validator adds `assertGeometryAndLookups`.