# Naming and Workflow Coverage

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

## Spec Resolution Notes

- No `references/naming.md` was created; the spec revision folded naming grammar into `SKILL.md`.
- Existing reference files (`installation.md`, `design-system.md`, `discovery-and-planning.md`, `execution.md`, `validation.md`) are unchanged in this upgrade.
- The five new Red Flags from spec Section 9 are listed in `SKILL.md` `## Red Flags — Stop` at line 462.