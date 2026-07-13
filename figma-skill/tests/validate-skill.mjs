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
assert.match(skill, /^version: \d+\.\d+(?:\.\d+)?$/m);

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

function assertConnectStatusGate(skill, runtimeMarkdown) {
  // Part I, assertion 1: Workflow 1 mentions `status` before the first `connect`.
  const wf1Start = skill.indexOf("### Workflow 1");
  assert.ok(wf1Start !== -1, "Workflow 1 heading not found in SKILL.md");
  const wf1End = skill.indexOf("### Workflow 2", wf1Start + 1);
  const wf1Block = wf1End === -1 ? skill.slice(wf1Start) : skill.slice(wf1Start, wf1End);
  const statusIdx = wf1Block.indexOf("status");
  const connectIdx = wf1Block.indexOf("connect");
  assert.ok(
    statusIdx !== -1 && connectIdx !== -1 && statusIdx < connectIdx,
    "Workflow 1 must mention status before connect",
  );

  // Part I, assertion 2: Workflow 1 contains the prohibition.
  assert.ok(
    wf1Block.includes("禁止在 status 之前调用 connect"),
    "Workflow 1 missing prohibition: 禁止在 status 之前调用 connect",
  );

  // Part I, assertion 3: Workflow 1 forbids daemon restart.
  assert.ok(
    wf1Block.includes("daemon restart"),
    "Workflow 1 must forbid daemon restart / stop / reconnect",
  );

  // Part I, assertion 4: Yolo Connection Gate step 1 is figma-cli status.
  const installation = read("references/installation.md");
  const yoloStart = installation.indexOf("## Yolo Connection Gate");
  assert.ok(yoloStart !== -1, "Yolo Connection Gate section not found");
  const yoloEnd = installation.indexOf("\n## ", yoloStart + 1);
  const yoloBlock = yoloEnd === -1 ? installation.slice(yoloStart) : installation.slice(yoloStart, yoloEnd);
  assert.match(yoloBlock, /^1\.\s*`?figma-cli status`?/m);

  // Part I, assertion 5: negative — no Concurrent Agent Connection section.
  assert.doesNotMatch(
    installation,
    /^##\s+Concurrent Agent Connection\s*$/m,
    "references/installation.md must not contain a Concurrent Agent Connection section",
  );
}

function assertHelpDiscoveryGate(skill, runtimeMarkdown) {
  // Part III.1 / Section 9 assertion 1: NNR contains both required sentences.
  const nnrStart = skill.indexOf("## Non-Negotiable Rules");
  const nnrEnd = skill.indexOf("\n## ", nnrStart + 1);
  const nnrBlock = nnrEnd === -1 ? skill.slice(nnrStart) : skill.slice(nnrStart, nnrEnd);
  assert.ok(
    nnrBlock.includes("禁止凭旧记忆、第三方文档或示例代码推断 figma-cli 命令"),
    "NNR must require --help lookup on first use",
  );
  assert.ok(
    nnrBlock.includes("figma-cli 之外的运行时"),
    "NNR must gate non-CLI runtimes via eval/run gate",
  );

  // Section 9 assertion 2: Help Discovery Gate chapter exists.
  assert.ok(skill.includes("## Help Discovery Gate"), "missing chapter: ## Help Discovery Gate");

  // Section 9 assertion 3: Workflow 8 batch loop mentions --help first-use.
  const w8Start = skill.indexOf("### Workflow 8");
  const w8End = skill.indexOf("### Workflow 9", w8Start + 1);
  const w8Block = w8End === -1 ? skill.slice(w8Start) : skill.slice(w8Start, w8End);
  assert.ok(
    w8Block.includes("figma-cli <command> --help"),
    "Workflow 8 must mention first-use help lookup",
  );

  // Section 9 assertion 4: Workflow 11 delivery report contains HelpEvidence.
  const w11Start = skill.indexOf("### Workflow 11");
  const w11End = skill.indexOf("## Diagrams", w11Start + 1);
  const w11Block = w11End === -1 ? skill.slice(w11Start) : skill.slice(w11Start, w11End);
  assert.ok(w11Block.includes("HelpEvidence"), "Workflow 11 must contain HelpEvidence field");

  // Section 9 assertion 5: Red Flag surfaces missing CLI evidence.
  const rfStart = skill.indexOf("## Red Flags — Stop");
  const rfBlock = skill.slice(rfStart);
  assert.ok(
    rfBlock.includes("figma-cli 没这个能力，写个脚本就行。"),
    "Red Flags must include the bypass-by-script flag",
  );

  // Section 9 assertion 6: references/execution.md teaches recursive help discovery.
  assert.match(
    read("references/execution.md"),
    /figma-cli create frame --help/,
    "references/execution.md must teach subcommand second-pass help lookup",
  );
}

assertNamingAndWorkflow(skill, runtimeMarkdown);
assertGeometryAndLookups(skill, runtimeMarkdown);
assertConnectStatusGate(skill, runtimeMarkdown);
assertHelpDiscoveryGate(skill, runtimeMarkdown);
console.log("PASS: figma-skill structure, wording, S1-S8 rule coverage, naming + workflow markers, v1.2 geometry + lookups, v1.2.1 connect-status gate, and v1.2.3 help-discovery gate");
