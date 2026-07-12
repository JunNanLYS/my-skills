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

console.log("PASS: figma-skill structure, wording, and S1-S8 rule coverage");
