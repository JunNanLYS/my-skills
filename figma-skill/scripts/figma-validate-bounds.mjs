#!/usr/bin/env node
/**
 * figma-validate-bounds.mjs — 子节点越界检测器
 *
 * 递归遍历根节点的整棵子树，检查每个父节点是否能完全包住所有直接子节点。
 * 一旦发现 child 部分超出 parent bounds，即记录违规。
 *
 * 用法:
 *   node figma-validate-bounds.mjs <rootNodeId> [--config <json|path>] [--figma-json <json|path>] [--strict] [--tolerance <n>]
 *
 * 两种输入格式（二选一）：
 *
 * (1) --config（递归树）:
 *   {
 *     "root": {
 *       "id": "47:212",
 *       "x": 0, "y": 0, "w": 360, "h": 40,
 *       "clipsContent": false,
 *       "children": [
 *         { "id": "47:239", "x": 14, "y": 8, "w": 32, "h": 24, "clipsContent": false, "children": [...] }
 *       ]
 *     }
 *   }
 *
 * (2) --figma-json（id-indexed 平铺字典）:
 *   {
 *     "rootId": "47:212",
 *     "nodes": {
 *       "47:212": { "id": "47:212", "x": 0, "y": 0, "w": 360, "h": 40, "clipsContent": false, "children": ["47:239", "47:300"] },
 *       "47:239": { "id": "47:239", "x": 14, "y": 8, "w": 32, "h": 24, "clipsContent": false, "children": [] },
 *       "47:300": { "id": "47:300", "x": 100, "y": 50, "w": 200, "h": 30, "clipsContent": false, "children": [] }
 *     }
 *   }
 *
 * 检测规则（对每个 parent-child 对）：
 *   child.x < 0                  → left
 *   child.y < 0                  → top
 *   child.x + child.w > parent.w → right
 *   child.y + child.h > parent.h → bottom
 *
 * 默认行为:
 *   - clipsContent=true 的父节点，即使子节点溢出也忽略（设计意图就是裁切）
 *   - 容差 0（整数像素）
 *   - --strict 把 clipsContent=true 也算违规
 *
 * 退出码:
 *   0  全部通过
 *   1  发现越界
 *   2  参数错误 / 输入 JSON 不合法 / 节点数据不合法
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv, exit } from "node:process";

function fail(message, code = 2) {
  console.error(message);
  exit(code);
}

function printUsage() {
  console.log(`Usage: node figma-validate-bounds.mjs <rootNodeId> [--config <json|path>] [--figma-json <json|path>] [--strict] [--tolerance <n>]
       --config     递归树,字段: root.x/y/w/h/children(嵌套)
       --figma-json 平铺字典,字段: rootId + nodes[id].x/y/w/h/children[ids]

Exit codes:
  0  all clear
  1  violations found
  2  invalid args / invalid input`);
}

function parseNumberArg(name, raw, { min = null } = {}) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    fail(`Invalid ${name}: ${raw}`);
  }
  if (min !== null && value < min) {
    fail(`${name} must be >= ${min}, got ${value}`);
  }
  return value;
}

function parseArgs() {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    printUsage();
    exit(0);
  }

  const rootId = args[0];
  if (!rootId) {
    fail("rootNodeId required");
  }

  const opts = {
    config: null,
    figmaJson: null,
    fileKey: null,
    strict: false,
    tolerance: 0,
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--config") opts.config = args[++i];
    else if (arg === "--figma-json") opts.figmaJson = args[++i];
    else if (arg === "--fileKey") opts.fileKey = args[++i];
    else if (arg === "--strict") opts.strict = true;
    else if (arg === "--tolerance") opts.tolerance = parseNumberArg("tolerance", args[++i], { min: 0 });
    else fail(`Unknown arg: ${arg}`);
  }

  if (opts.config && opts.figmaJson) {
    fail("--config and --figma-json are mutually exclusive");
  }
  if (!opts.config && !opts.figmaJson) {
    fail("Need either --config or --figma-json");
  }

  return { rootId, opts };
}

function readInput(source, label) {
  if (typeof source !== "string" || source.trim() === "") {
    fail(`${label} cannot be empty`);
  }

  const trimmed = source.trim();
  const resolved = resolve(trimmed);
  if (existsSync(resolved)) {
    return readFileSync(resolved, "utf8");
  }
  return trimmed;
}

function parseJsonInput(source, label) {
  try {
    return JSON.parse(readInput(source, label));
  } catch (error) {
    fail(`Invalid ${label} JSON: ${error.message}`);
  }
}

function finiteNumber(value, path) {
  if (!Number.isFinite(value)) {
    fail(`${path} must be a finite number, got ${value}`);
  }
  return value;
}

function finiteNonNegative(value, path) {
  if (!Number.isFinite(value)) {
    fail(`${path} must be a finite number, got ${value}`);
  }
  if (value < 0) {
    fail(`${path} must be non-negative, got ${value}`);
  }
  return value;
}

function normalizeNode(node, path) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    fail(`${path} must be an object`);
  }

  const children = node.children == null ? [] : node.children;
  if (!Array.isArray(children)) {
    fail(`${path}.children must be an array`);
  }

  return {
    id: node.id ?? null,
    name: node.name ?? null,
    type: node.type ?? null,
    x: finiteNumber(node.x ?? 0, `${path}.x`),
    y: finiteNumber(node.y ?? 0, `${path}.y`),
    w: finiteNonNegative(node.w ?? 0, `${path}.w`),
    h: finiteNonNegative(node.h ?? 0, `${path}.h`),
    clipsContent: node.clipsContent === true,
    children: children.map((child, index) => normalizeNode(child, `${path}.children[${index}]`)),
  };
}

function loadFromConfig(opts, rootId) {
  const parsed = parseJsonInput(opts.config, "config");
  if (!parsed.root) {
    fail("config.root required");
  }

  const root = normalizeNode(parsed.root, "config.root");
  if (root.id && root.id !== rootId) {
    fail(`config.root.id (${root.id}) !== rootNodeId arg (${rootId})`);
  }
  return root;
}

function loadFromFigmaJson(opts, rootId) {
  const parsed = parseJsonInput(opts.figmaJson, "figma-json");
  if (!parsed.nodes || typeof parsed.nodes !== "object" || Array.isArray(parsed.nodes)) {
    fail("figma-json.nodes required");
  }
  if (parsed.rootId && parsed.rootId !== rootId) {
    fail(`figma-json.rootId (${parsed.rootId}) !== rootNodeId arg (${rootId})`);
  }

  const nodes = parsed.nodes;
  const built = new Map();
  const visiting = new Set();

  function build(id) {
    if (built.has(id)) return built.get(id);
    if (visiting.has(id)) {
      fail(`Cycle detected while expanding node tree at ${id}`);
    }

    const rawNode = nodes[id];
    if (!rawNode) {
      fail(`Node ${JSON.stringify(id)} referenced as child but missing from figma-json.nodes`);
    }

    visiting.add(id);
    const childIds = rawNode.children == null ? [] : rawNode.children;
    if (!Array.isArray(childIds)) {
      fail(`figma-json.nodes[${JSON.stringify(id)}].children must be an array`);
    }

    const children = [];
    for (const childId of childIds) {
      children.push(build(childId));
    }

    visiting.delete(id);

    const node = {
      id: rawNode.id ?? id,
      name: rawNode.name ?? null,
      type: rawNode.type ?? null,
      x: finiteNumber(rawNode.x ?? 0, `figma-json.nodes[${JSON.stringify(id)}].x`),
      y: finiteNumber(rawNode.y ?? 0, `figma-json.nodes[${JSON.stringify(id)}].y`),
      w: finiteNonNegative(rawNode.w ?? 0, `figma-json.nodes[${JSON.stringify(id)}].w`),
      h: finiteNonNegative(rawNode.h ?? 0, `figma-json.nodes[${JSON.stringify(id)}].h`),
      clipsContent: rawNode.clipsContent === true,
      children,
    };

    built.set(id, node);
    return node;
  }

  const root = build(rootId);
  if (!root) {
    fail(`rootId ${rootId} not found in figma-json.nodes`);
  }

  return root;
}

function checkChild(parent, child, tolerance) {
  const violations = [];
  const right = child.x + child.w;
  const bottom = child.y + child.h;

  if (child.x < -tolerance) {
    violations.push({
      side: "left",
      overflow: -child.x,
      childBox: { x: child.x, y: child.y, w: child.w, h: child.h },
      parentBox: { w: parent.w, h: parent.h },
    });
  }
  if (child.y < -tolerance) {
    violations.push({
      side: "top",
      overflow: -child.y,
      childBox: { x: child.x, y: child.y, w: child.w, h: child.h },
      parentBox: { w: parent.w, h: parent.h },
    });
  }
  if (right > parent.w + tolerance) {
    violations.push({
      side: "right",
      overflow: right - parent.w,
      childBox: { x: child.x, y: child.y, w: child.w, h: child.h },
      parentBox: { w: parent.w, h: parent.h },
    });
  }
  if (bottom > parent.h + tolerance) {
    violations.push({
      side: "bottom",
      overflow: bottom - parent.h,
      childBox: { x: child.x, y: child.y, w: child.w, h: child.h },
      parentBox: { w: parent.w, h: parent.h },
    });
  }

  return violations;
}

function walk(node, tolerance, strict) {
  const violations = [];
  const childReports = [];
  const skipByClipping = node.clipsContent === true && !strict;

  for (const child of node.children) {
    if (!skipByClipping) {
      const issues = checkChild(node, child, tolerance);
      if (issues.length > 0) {
        violations.push({
          childId: child.id,
          childName: child.name ?? null,
          childType: child.type ?? null,
          issueCount: issues.length,
          issues,
        });
      }
    }
    childReports.push(walk(child, tolerance, strict));
  }

  return {
    id: node.id,
    name: node.name ?? null,
    type: node.type ?? null,
    clipsContent: node.clipsContent === true,
    skippedChildrenBecauseClipped: skipByClipping ? node.children.length : 0,
    childReports,
    violations,
  };
}

function countNodes(report) {
  let total = 1;
  for (const child of report.childReports) {
    total += countNodes(child);
  }
  return total;
}

function countParentChildPairs(report) {
  let total = report.childReports.length;
  for (const child of report.childReports) {
    total += countParentChildPairs(child);
  }
  return total;
}

function countViolationEdges(report) {
  let total = report.violations.length;
  for (const child of report.childReports) {
    total += countViolationEdges(child);
  }
  return total;
}

function countTotalIssues(report) {
  let total = report.violations.reduce((sum, violation) => sum + violation.issueCount, 0);
  for (const child of report.childReports) {
    total += countTotalIssues(child);
  }
  return total;
}

function countParentsWithIssues(report) {
  let total = report.violations.length > 0 ? 1 : 0;
  for (const child of report.childReports) {
    total += countParentsWithIssues(child);
  }
  return total;
}

function countSkippedClippedPairs(report) {
  let total = report.skippedChildrenBecauseClipped;
  for (const child of report.childReports) {
    total += countSkippedClippedPairs(child);
  }
  return total;
}

function flattenViolations(report, out = []) {
  for (const violation of report.violations) {
    out.push({
      parentId: report.id,
      parentName: report.name,
      parentType: report.type,
      ...violation,
    });
  }
  for (const child of report.childReports) {
    flattenViolations(child, out);
  }
  return out;
}

function main() {
  const { rootId, opts } = parseArgs();
  const warnings = [];
  const root = opts.figmaJson
    ? loadFromFigmaJson(opts, rootId)
    : loadFromConfig(opts, rootId);

  const tree = walk(root, opts.tolerance, opts.strict);
  const violations = flattenViolations(tree);
  const summary = {
    nodesVisited: countNodes(tree),
    parentChildPairs: countParentChildPairs(tree),
    violationEdges: countViolationEdges(tree),
    totalIssues: countTotalIssues(tree),
    parentsWithIssues: countParentsWithIssues(tree),
    skippedClippedPairs: countSkippedClippedPairs(tree),
  };

  const output = {
    rootId,
    fileKey: opts.fileKey,
    strict: opts.strict,
    tolerance: opts.tolerance,
    inputFormat: opts.figmaJson ? "figma-json" : "config",
    warnings,
    summary,
    violations,
    tree,
  };

  console.log(JSON.stringify(output, null, 2));

  for (const warning of warnings) {
    console.error(`[warn] ${warning}`);
  }

  if (summary.totalIssues > 0) {
    console.error(`\n[FAIL] ${summary.totalIssues} issue(s) across ${summary.violationEdges} parent-child edge(s)`);
    exit(1);
  }

  console.error("\n[OK] All checked children within parent bounds");
  exit(0);
}

main();
