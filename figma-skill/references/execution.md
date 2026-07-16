# Approved Figma Execution

Execution is authorized by an approved PlanWeave implementation block. `figma-cli` is the only Figma fact and mutation authority.

## Pre-write Live Revalidation Block

Immediately before any write, re-read:

- target node ids, names, types, parents, positions, and sizes;
- direct children of the mutation scope;
- Auto Layout, constraints, and sizing behavior;
- components, Component Sets, variants, instances, variables, and styles affected by the block;
- screenshots when visual baseline affects the block.

Drift from the approved spec or plan returns to Plan Draft Block or Spec Draft Block. Do not patch around drift inside the write block.

## Singular Environment Order

Every new figma-cli session must run:

```text
figma-cli --version
figma-cli --help
figma-cli status
  if connected-to-figma and daemon-running → continue
  otherwise figma-cli connect, then status again
```

This order is Pre-Spec Context Gate evidence for tasks that require live Figma.

## Command Truth

Before first use of a command in the current session, query:

```text
figma-cli <command> --help
figma-cli <command> <subcommand> --help
```

If the needed subcommand or flag is not present in current help output, do not execute it. Do not rely on memory, examples, or third-party docs.

## Unified `eval/run` Contract

Only use `eval/run` or non-native helper execution when the PlanWeave write block includes all six fields and the user has approved the block:

1. `NativeHelpChecked` — top-level and nearest subcommand help checked;
2. `MissingNativeCapability` — closest native command lacks the required capability;
3. `TargetNodeIds` — exact NodeIds affected;
4. `FallbackCodeScope` — exact code or helper scope;
5. `FallbackImpact` — impact radius;
6. `GeometryReaudit` — how affected geometry will be rechecked.

After any fallback, re-read affected nodes and submit evidence to PlanWeave.

## Geometry-aware Commands

| Need | Command |
| --- | --- |
| File lint | `figma-cli lint --json` |
| Duplicate-origin dry run | `figma-cli unstack --dry-run` |
| Canvas information | `figma-cli canvas info` |
| Next non-overlap position | `figma-cli canvas next` |
| Section children | `figma-cli run scripts/list-children.mjs` |
| Node geometry and sizing | `figma-cli inspect --json <id>` |
| Section AABB matrix | `figma-cli run scripts/overlap-check.mjs` |
| Page top-level AABB | `figma-cli run scripts/page-overlap-check.mjs` |
| Full node geometry | `figma-cli run scripts/inspect-geometry.mjs` |
| Apply movement plan | `figma-cli run scripts/apply-layout.mjs` |
| Resize section | `figma-cli run scripts/resize-section.mjs` |

Read-only helpers (`list-children`, `overlap-check`, `page-overlap-check`, `inspect-geometry`, `figma-validate-bounds`) do not mutate Figma. Write helpers (`apply-layout`, `resize-section`) require an approved PlanWeave write block and must be followed by live re-read.

## Small-Batch Loop

Each write block executes the smallest coherent mutation group:

1. read target state;
2. perform one coherent mutation group;
3. re-read affected nodes;
4. check structural expectations;
5. submit evidence to PlanWeave;
6. continue only after the block evidence matches the approved plan.

After duplicate, reparent, unwrap, componentization, combining variants, delete/recreate, or major hierarchy changes, re-read NodeIds and geometry before the next write.

## Write order and `--check-exists`

For `figma-cli create.*` commands that create a single named node, use `--check-exists` when daemon retry or duplicate creation is possible.

Behavior contract:

```text
figma-cli create section --name "X" --parent P --check-exists
  ├─ not found → create and return new nodeId
  ├─ found, no --reuse → return DUPLICATE_NODE, exit 3
  ├─ found, --reuse → return existingId with reused: true, exit 0
  └─ found, --strict → abort, exit 4
```

Only pass `--reuse` after a live-read confirms the existing node matches the approved plan.

## Failure Handling

Partial success or severe deviation stops downstream writes. Submit the failure, command output, affected NodeIds, and live re-read evidence to PlanWeave. Only use undo when current help and batch history prove it precisely targets the most recent mutation.
