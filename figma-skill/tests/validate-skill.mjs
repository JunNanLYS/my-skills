import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");
const required = [
  "SKILL.md",
  "references/installation.md",
  "references/design-system.md",
  "references/discovery-and-planning.md",
  "references/execution.md",
  "references/validation.md",
  "scripts/install-figma-cli.ps1",
  "scripts/figma-validate-bounds.mjs",
];

for (const file of required) {
  assert.ok(existsSync(join(root, file)), `missing ${file}`);
}

const skill = read("SKILL.md");
assert.ok(skill.startsWith("---\n"), "frontmatter must be first");
for (const field of ["name: figma-skill", "model:", "category:", "description:"]) {
  assert.match(skill, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(skill, /^version: \d+\.\d+$/m);

for (const phrase of [
  "必须使用 `figma-cli`",
  "禁止使用 Figma MCP",
  "docs/FIGMA_DESIGN_SYSTEM.md",
  "两次独立审批",
  "只有.*才允许使用 `eval/run`",
  "最多自动修正三轮",
  "禁止创建跨任务持久缓存",
]) {
  assert.match(skill, new RegExp(phrase));
}

const runtimeMarkdown = required.filter((file) => file.endsWith(".md")).map(read).join("\n");
assert.doesNotMatch(runtimeMarkdown, /\.figma\/cache\.json/);
assert.doesNotMatch(runtimeMarkdown, /figma-guide/);
assert.doesNotMatch(runtimeMarkdown, /不允许/);
assert.match(read("references/installation.md"), /GitHub Releases/);
assert.match(read("references/installation.md"), /Yolo/);
assert.match(read("references/validation.md"), /temp\/figma-screenshot/);
assert.match(read("references/execution.md"), /duplicate\|dup/);
assert.doesNotMatch(read("references/execution.md"), /`clone`/);

const scenarioCoverage = {
  S1: [/设计系统审批/, /Figma.*审批/s, /禁止.*Figma 写入/s],
  S2: [/GitHub Releases/, /禁止使用 Figma MCP/, /figma-cli connect/, /figma-cli status/],
  S3: [/缺少当前任务规则/, /最小必要规范/, /等待明确批准/],
  S4: [/figma-cli --help/, /command\/group help/, /才允许使用 `eval\/run`/],
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

function assertNamingAndWorkflow(skill, runtimeMarkdown) {
  // Naming grammar markers (Sections 1-5 of the spec).
  for (const phrase of [
    /<Category>\/<Domain>\/<Component>\[?\/<Part>\.\.\.\]?\/?/,
    "Screen/<Platform>/<Domain>/<Flow>/<View>",
    "State=<State>",
    "Viewport=<Viewport>",
    "Role=<Role>",
    "Specimen/StateGallery",
    "Specimen/VariantMatrix",
    "Specimen/Properties",
    "Specimen/Usage",
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
      assert.match(skill, phrase, `naming marker missing: ${phrase}`);
    } else {
      assert.ok(skill.includes(phrase), `naming marker missing: ${phrase}`);
    }
  }

  // Workflow 0-11 markers.
  for (const workflow of [
    "Workflow 0",
    "Workflow 1",
    "Workflow 2",
    "Workflow 3",
    "Workflow 4",
    "Workflow 4A",
    "Workflow 4B",
    "Workflow 4C",
    "Workflow 4D",
    "Workflow 4E",
    "Workflow 4F",
    "Workflow 4G",
    "Workflow 4H",
    "Workflow 5",
    "Workflow 6",
    "Workflow 7",
    "Workflow 8",
    "Workflow 9",
    "Workflow 10",
    "Workflow 11",
  ]) {
    assert.ok(skill.includes(workflow), `workflow marker missing: ${workflow}`);
  }

  // Five required Mermaid graphs.
  for (const graph of [
    "Total Workflow Graph",
    "Task Entry and Reuse Graph",
    "Single-Direction Dependency Graph",
    "Validation Order Graph",
    "Page Architecture Graph",
  ]) {
    assert.ok(skill.includes(graph), `graph heading missing: ${graph}`);
  }

  // Forbidden-word negatives (re-asserted to catch regressions).
  for (const bad of ["Common", "General", "Misc", "Other"]) {
    const re = new RegExp(`^\\s*-\\s*${bad}\\s*$`, "m");
    assert.ok(!skill.match(re), `forbidden bucket listed as a category: ${bad}`);
  }

  assert.doesNotMatch(skill, /find the master by instance name/);
  assert.match(skill, /Workflow 0/);
}

function assertGeometryAndLookups(skill, runtimeMarkdown) {
  // Mandatory Lookups by Phase chapter (spec Section 5.1).
  assert.ok(skill.includes("## Mandatory Lookups by Phase"), "missing chapter: ## Mandatory Lookups by Phase");
  for (const row of [
    "references/installation.md",
    "references/design-system.md",
    "references/discovery-and-planning.md",
    "references/execution.md",
    "references/validation.md",
  ]) {
    assert.ok(skill.includes(row), `Mandatory Lookups row missing: ${row}`);
  }

  // Component Geometry Mandates chapter (spec Section 7).
  assert.ok(skill.includes("## Component Geometry Mandates"), "missing chapter: ## Component Geometry Mandates");
  for (const sub of [
    "### Auto Layout Mode Selection",
    "### Fixed Parent Clipping",
    "### Component Set Variant Baseline",
  ]) {
    assert.ok(skill.includes(sub), `Geometry sub-heading missing: ${sub}`);
  }

  // Six new Red Flags must appear in ## Red Flags — Stop section (spec Section 8).
  const redFlagsSection = skill.slice(skill.indexOf("## Red Flags — Stop"));
  const redFlagLines = redFlagsSection
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
  for (const flag of [
    "位置和上次差不多就行。",
    "这个组件不大，肯定不裁。",
    "变体形状应该一致。",
    "读完 spec 就能写，几何之后再说。",
    "引用文件太长，参考 SKILL.md 就行。",
    "父级默认就是 HUG，不用看。",
  ]) {
    assert.ok(
      redFlagLines.some((line) => line.includes(flag)),
      `Red flag missing in dedicated section: ${flag}`,
    );
  }

  // Mandatory Lookups rule must live inside ## Non-Negotiable Rules (spec Section 5.2).
  const nnrStart = skill.indexOf("## Non-Negotiable Rules");
  const nnrEnd = skill.indexOf("\n## ", nnrStart + 1);
  const nnrBlock = skill.slice(nnrStart, nnrEnd === -1 ? undefined : nnrEnd);
  assert.ok(
    nnrBlock.includes("每个 Workflow 阶段开始时必须先加载规定的 reference"),
    "Mandatory Lookups rule is not in ## Non-Negotiable Rules",
  );

  // Geometry-aware and Geometry Validation sections exist in references.
  assert.match(read("references/execution.md"), /## Geometry-aware Commands/);
  assert.match(read("references/validation.md"), /## Geometry Validation Checklist/);
}

assertNamingAndWorkflow(skill, runtimeMarkdown);
assertGeometryAndLookups(skill, runtimeMarkdown);
console.log("PASS: figma-skill structure, wording, S1-S8 rule coverage, naming + workflow markers, and v1.2 geometry + lookups");
