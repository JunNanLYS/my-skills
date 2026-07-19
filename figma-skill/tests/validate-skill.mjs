import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");
const required = [
  "SKILL.md",
  "references/installation.md",
  "references/design-system.md",
  "references/state-and-recovery.md",
  "references/planning.md",
  "references/execution.md",
  "references/validation.md",
  "references/geometry-verifier.md",
  "references/naming.md",
  "references/self-reflection.md",
  // scripts/install-figma-cli.ps1 removed in v3 (Rust CLI is bundled in bin/).
  "scripts/figma-validate-bounds.mjs",
  // DEPRECATED in v3 — physically retained for archival; do not invoke.
  "scripts/list-children.mjs",
  "scripts/overlap-check.mjs",
  "scripts/page-overlap-check.mjs",
  "scripts/inspect-geometry.mjs",
  "scripts/apply-layout.mjs",
  "scripts/resize-section.mjs",
  "scripts/figma-task-state.mjs",
  "scripts/README.md",
  "schemas/config.schema.json",
  "schemas/index.schema.json",
  "schemas/event.schema.json",
  "schemas/task-state.schema.json",
];

for (const file of required) {
  assert.ok(existsSync(join(root, file)), `missing ${file}`);
}

const skill = read("SKILL.md");
assert.ok(skill.startsWith("---\n"), "frontmatter must be first");
// Only name / description / version are required frontmatter fields (CLAUDE.md).
// model / category are optional; do not assert them.
for (const field of ["name: figma-skill", "description:"]) {
  assert.match(skill, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(skill, /^version: 3\.0$/m);

for (const phrase of [
  "figma-cli",
  "Figma MCP",
  "docs/FIGMA_DESIGN_SYSTEM.md",
  "两次独立审批",
  "NativeHelpChecked",
  "NativeHelpChecked[\\s\\S]{0,40}MissingNativeCapability[\\s\\S]{0,40}TargetNodeIds[\\s\\S]{0,40}FallbackCodeScope[\\s\\S]{0,40}FallbackImpact[\\s\\S]{0,40}GeometryReaudit",
  "最多自动修正三轮",
  "state\\.validation\\.visual\\.summary",
  "archiveStatus",
  "Recovery|recovery",
]) {
  assert.match(skill, new RegExp(phrase));
}

const runtimeMarkdown = required
  .filter((file) => file.endsWith(".md"))
  .map((name) => read(name))
  .join("\n");
assert.doesNotMatch(runtimeMarkdown, /\.figma\/cache\.json/);
assert.doesNotMatch(runtimeMarkdown, /figma-guide/);
assert.match(read("references/installation.md"), /figma-cli daemon status/);
assert.match(read("references/installation.md"), /Yolo|Singular Yolo|Yolo Connection Gate/i);
assert.match(read("references/validation.md"), /\.figma\/screenshot\/<task-id>\//);
assert.doesNotMatch(read("references/validation.md"), /temp\/figma-screenshot/);
assert.match(read("references/execution.md"), /duplicate\s*\/|duplicate\b/);
assert.doesNotMatch(read("references/execution.md"), /`clone`/);
assert.match(read("references/naming.md"), /Specimen\/StateGallery/);
assert.match(read("references/state-and-recovery.md"), /E-####/);
assert.match(read("references/geometry-verifier.md"), /Variant Parity/);

const scenarioCoverage = {
  S1: [/设计系统审批/, /Figma.*审批/s, /禁止.*Figma 写入/s],
  S2: [/bin\/figma-cli\.exe|daemon status/, /禁止使用 Figma MCP/, /figma-cli connect/, /figma-cli daemon status/],
  S3: [/缺少当前任务规则/, /最小必要规范/, /等待明确批准/],
  S4: [/figma-cli --help/, /subcommand/, /子命令/],
  S5: [/文档优先/, /直接依赖/, /范围外历史冲突只报告/],
  S6: [/duplicate/, /重新读取 NodeId/],
  S7: [/实际打开.*截图/s, /最小修正/, /重新运行受影响验证/],
  S8: [/最多自动修正三轮/, /停止写入/, /三轮修正/],
};
for (const [scenario, patterns] of Object.entries(scenarioCoverage)) {
  for (const pattern of patterns) {
    assert.match(runtimeMarkdown, pattern, `${scenario} mandatory behavior is not covered: ${pattern}`);
  }
}

function assertNamingAndWorkflow(skill, runtimeMarkdown, refs) {
  // Naming grammar markers now live in references/naming.md (v2.0 single authority).
  const combined = `${skill}\n${runtimeMarkdown}\n${refs}`;
  for (const phrase of [
    /<Category>\/<Domain>\/<Component>\[?\/<Part>\.\.\.\]?\/?/,
    "Screen/<Platform>/<Domain>/<Flow>/<View>",
    "State=<State>",
    "Viewport=<Viewport>",
    "Role=<Role>",
    "Specimen/StateGallery",
    "Foundation",
    "Primitive",
    "Action",
    "Input",
    "Navigation",
    "DataDisplay",
    "Feedback",
    "Overlay",
    "Layout",
    "Content",
    "Internal",
    "Deprecated",
    "Variant",
    "Platform",
    "Size",
    "State",
    "Validation",
    "Selection",
    "Orientation",
    "Density",
    "Expanded",
    "Loading",
    "True",
    "False",
    "01 Library",
    "02 Screens",
    "03 Flows",
    "00 Foundations",
    "10 Components",
    "80 Internal",
    "90 Deprecated",
  ]) {
    if (phrase instanceof RegExp) {
      assert.match(combined, phrase, `naming marker missing: ${phrase}`);
    } else {
      assert.ok(combined.includes(phrase), `naming marker missing: ${phrase}`);
    }
  }

  // Workflow stages live across SKILL.md and references/state-and-recovery.md.
  for (const workflow of [
    "Workflow 0A",
    "Workflow 0B",
    "Workflow 1",
    "Workflow 2",
    "Workflow 4",
    "Workflow 4A",
    "Workflow 4I",
    "Workflow 5",
    "Workflow 6",
    "Workflow 7",
    "Workflow 8",
    "Workflow 9",
    "Workflow 10",
    "Workflow 11",
  ]) {
    assert.ok(combined.includes(workflow), `workflow marker missing: ${workflow}`);
  }

  assert.match(refs, /```mermaid[\s\S]+?```/, "expected mermaid block");
}

function assertRuntimeContract() {
  // v2.0 Mandatory Lookups lives in SKILL.md under the same heading; each required reference file is mentioned.
  assert.ok(skill.includes("## Mandatory Lookups"), "missing chapter: ## Mandatory Lookups");
  for (const row of [
    "references/installation.md",
    "references/design-system.md",
    "references/state-and-recovery.md",
    "references/planning.md",
    "references/execution.md",
    "references/geometry-verifier.md",
    "references/validation.md",
    "references/naming.md",
  ]) {
    assert.ok(skill.includes(row), `Mandatory Lookups row missing: ${row}`);
  }

  const nnrStart = skill.indexOf("## Non-Negotiable Rules");
  const nnrEnd = skill.indexOf("\n## ", nnrStart + 1);
  const nnrBlock = skill.slice(nnrStart, nnrEnd === -1 ? undefined : nnrEnd);
  assert.ok(
    nnrBlock.includes("每个 Workflow 阶段开始时必须先加载规定的 reference"),
    "Mandatory Lookups rule is not in ## Non-Negotiable Rules",
  );

  assert.match(read("references/execution.md"), /## Geometry-aware Commands/);
  assert.match(read("references/validation.md"), /## Geometry Validation Checklist/);

  for (const t of ["Create", "Modify", "Audit", "Migrate", "Export"]) {
    assert.ok(skill.includes(t), `task type missing in SKILL.md: ${t}`);
  }
}

function assertConnectOrder() {
  const installation = read("references/installation.md");
  assert.match(installation, /figma-cli\s+--version/);
  assert.match(installation, /figma-cli\s+--help/);
  assert.match(installation, /figma-cli\s+daemon\s+status/);
  assert.match(installation, /figma-cli\s+connect/);
  assert.match(skill, /--version[\s\S]{0,200}--help[\s\S]{0,200}daemon\s+status[\s\S]{0,200}connect/);
  assert.doesNotMatch(installation, /^##\s+Concurrent Agent Connection\s*$/m);
}

function assertHelpDiscovery() {
  const nnrStart = skill.indexOf("## Non-Negotiable Rules");
  const nnrEnd = skill.indexOf("\n## ", nnrStart + 1);
  const nnrBlock = skill.slice(nnrStart, nnrEnd === -1 ? undefined : nnrEnd);
  assert.ok(
    nnrBlock.includes("禁止凭旧记忆、第三方文档或示例代码推断 figma-cli 命令"),
    "NNR must require --help lookup on first use",
  );
  assert.ok(
    nnrBlock.includes("figma-cli eval <CODE>") || nnrBlock.includes("eval/run"),
    "NNR must gate non-CLI runtimes via eval gate",
  );
  assert.match(
    read("references/execution.md"),
    /figma-cli\s+<command>\s+\[?\s*<subcommand>?\s*\]?\s+--help/,
    "references/execution.md must teach recursive subcommand help lookup",
  );
  assert.match(skill, /eval\/run/);
  assert.match(skill, /visual\s+summary|视觉结论|视觉总结/);
}

assertNamingAndWorkflow(skill, runtimeMarkdown, read("references/naming.md") + "\n" + read("references/state-and-recovery.md"));
assertRuntimeContract();
assertConnectOrder();
assertHelpDiscovery();
console.log("PASS: figma-skill structure, wording, S1-S8 rule coverage, v2 naming + workflow + runtime + connect + help gates");
