#!/usr/bin/env node
/**
 * figma-validate-bounds.mjs — 子节点越界检测器
 *
 * 递归遍历根节点的整棵子树，检查每个父节点是否能完全包住所有直接子节点。
 * 一旦发现 child 部分超出 parent bounds，即记录违规。
 *
 * 用法:
 *   node figma-validate-bounds.mjs <rootNodeId> [--config <json>] [--figma-json <json>] [--strict] [--tolerance <n>]
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
 *   ↑ 当已有批量节点数据时，直接按 id 索引组织即可，无需二次拼树
 *
 * 检测规则（对每个 parent-child 对）：
 *   child.x < 0                            → left
 *   child.y < 0                            → top
 *   child.x + child.w > parent.w           → right
 *   child.y + child.h > parent.h           → bottom
 *
 * 默认行为:
 *   - clipsContent=true 的父节点，即使子节点溢出也忽略（设计意图就是裁）
 *   - 容差 0（整数像素）
 *   - --strict 把 clipsContent=true 也算违规
 *
 * 设计:
 *   - 只做纯计算，不连接 Figma
 *   - 调用方负责采集节点数据、组装 JSON、并决定如何应用修复
 */

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";

// ---------- CLI ----------

function parseArgs() {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    printUsage();
    exit(0);
  }
  const rootId = args[0];
  const opts = { config: null, figmaJson: null, fileKey: null, strict: false, tolerance: 0 };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--config") opts.config = args[++i];
    else if (a === "--figma-json") opts.figmaJson = args[++i];
    else if (a === "--fileKey") opts.fileKey = args[++i];
    else if (a === "--strict") opts.strict = true;
    else if (a === "--tolerance") opts.tolerance = Number(args[++i]);
    else {
      console.error(`Unknown arg: ${a}`);
      printUsage();
      exit(1);
    }
  }
  if (!rootId) { console.error("rootNodeId required"); exit(1); }
  if (opts.config && opts.figmaJson) {
    console.error("--config and --figma-json are mutually exclusive");
    exit(2);
  }
  if (!opts.config && !opts.figmaJson) {
    console.error("Need either --config or --figma-json");
    exit(2);
  }
  return { rootId, opts };
}

function printUsage() {
  console.log(`Usage: node figma-validate-bounds.mjs <rootNodeId> [--config <json>] [--figma-json <json>] [--strict] [--tolerance <n>]`);
  console.log(`       --config     递归树,字段: root.x/y/w/h/children(嵌套)`);
  console.log(`       --figma-json 平铺字典,字段: rootId + nodes[id].x/y/w/h/children[ids]`);
}

// ---------- 输入适配 ----------

/**
 * 从 --config 读取 root
 */
function loadFromConfig(opts) {
  const raw = readIfPath(opts.config);
  const parsed = JSON.parse(raw);
  if (!parsed.root) { console.error("config.root required"); exit(2); }
  return parsed.root;
}

/**
 * 从 --figma-json 平铺字典构建递归树
 *
 * 输入: { rootId, nodes: { id: {id, x, y, w, h, clipsContent?, children:[ids]} } }
 * 输出: 嵌套递归树,根节点的 id === rootId
 *
 * 缺失节点的 children 视为空数组(不报错,只当叶子)。
 * children 数组里引用了 nodes 里没有的 id → 警告但继续(避免一个坏引用让整棵树挂掉)。
 */
function loadFromFigmaJson(opts, rootId) {
  const raw = readIfPath(opts.figmaJson);
  const parsed = JSON.parse(raw);
  if (!parsed.nodes) { console.error("figma-json.nodes required"); exit(2); }
  if (parsed.rootId && parsed.rootId !== rootId) {
    console.warn(`[warn] figma-json.rootId (${parsed.rootId}) !== rootNodeId arg (${rootId})`);
  }
  const nodes = parsed.nodes;
  const missing = [];
  const built = new Map();

  function build(id) {
    if (built.has(id)) return built.get(id);
    const n = nodes[id];
    if (!n) {
      missing.push(id);
      return null;
    }
    const childIds = Array.isArray(n.children) ? n.children : [];
    const children = [];
    for (const cid of childIds) {
      const c = build(cid);
      if (c) children.push(c);
    }
    const treeNode = {
      id: n.id ?? id,
      name: n.name ?? null,
      type: n.type ?? null,
      x: n.x ?? 0,
      y: n.y ?? 0,
      w: n.w ?? 0,
      h: n.h ?? 0,
      clipsContent: n.clipsContent === true,
      children
    };
    built.set(id, treeNode);
    return treeNode;
  }

  const root = build(rootId);
  if (!root) {
    console.error(`rootId ${rootId} not found in figma-json.nodes`);
    exit(2);
  }
  if (missing.length > 0) {
    console.warn(`[warn] ${missing.length} child id(s) referenced but missing from nodes: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "..." : ""}`);
  }
  return root;
}

function readIfPath(s) {
  if (s.endsWith(".json")) return readFileSync(s, "utf8");
  return s;
}

// ---------- 检测核心 ----------

function boxOf(node) {
  return { x: node.x, y: node.y, w: node.w, h: node.h };
}

/**
 * 检查单个 child 是否落在 parent bounds 内
 *
 * 关键约定: child.x/y 是相对 parent 的局部坐标 (Figma REST API 默认行为)
 * 所以参考原点是 (0, 0),parent 自己的 x/y 不参与计算
 * 只有 parent 自身的 w/h 用于判定 child 是否越界
 *
 * @returns {Array<{side:string, overflow:number, childBox, parentBox}>} 违规列表 (空 = 通过)
 */
function checkChild(parent, child, tolerance, strict) {
  const violations = [];

  // clipsContent=true 的父节点: 子溢出被裁,默认不算违规
  if (!strict && parent.clipsContent === true) return violations;

  const tol = tolerance;
  const pw = parent.w, ph = parent.h;
  const cx = child.x, cy = child.y;
  const cr = cx + child.w, cb_ = cy + child.h;

  if (cx < -tol) {
    violations.push({
      side: "left",
      overflow: -cx,                      // 正数 = 溢出多少 px
      childBox: { x: cx, y: cy, w: child.w, h: child.h },
      parentBox: { w: pw, h: ph }
    });
  }
  if (cy < -tol) {
    violations.push({
      side: "top",
      overflow: -cy,
      childBox: { x: cx, y: cy, w: child.w, h: child.h },
      parentBox: { w: pw, h: ph }
    });
  }
  if (cr > pw + tol) {
    violations.push({
      side: "right",
      overflow: cr - pw,
      childBox: { x: cx, y: cy, w: child.w, h: child.h },
      parentBox: { w: pw, h: ph }
    });
  }
  if (cb_ > ph + tol) {
    violations.push({
      side: "bottom",
      overflow: cb_ - ph,
      childBox: { x: cx, y: cy, w: child.w, h: child.h },
      parentBox: { w: pw, h: ph }
    });
  }
  return violations;
}

/**
 * 递归遍历,返回违规树
 * @param {object} node 当前节点(含 children)
 * @param {number} tolerance 容差 (px)
 * @param {boolean} strict 是否把 clipsContent=true 也算违规
 */
function walk(node, tolerance, strict) {
  const childReports = [];
  const violations = [];

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const cv = checkChild(node, child, tolerance, strict);
      if (cv.length > 0) {
        violations.push({
          childId: child.id,
          childName: child.name ?? null,
          childType: child.type ?? null,
          issues: cv
        });
      }
      childReports.push(walk(child, tolerance, strict));
    }
  }

  return { id: node.id, name: node.name ?? null, type: node.type ?? null, childReports, violations };
}

// ---------- 主流程 ----------

function main() {
  const { rootId, opts } = parseArgs();
  const root = opts.figmaJson
    ? loadFromFigmaJson(opts, rootId)
    : loadFromConfig(opts);

  // 应用全局 tolerance / strict
  const tol = opts.tolerance;
  const strict = opts.strict;

  const report = walk(root, tol, strict);
  const totalViolations = countViolations(report);
  const flat = flattenViolations(report, report.id);

  const out = {
    rootId,
    fileKey: opts.fileKey,
    strict,
    tolerance: tol,
    inputFormat: opts.figmaJson ? "figma-json" : "config",
    summary: {
      nodesVisited: countNodes(report),
      violations: totalViolations,
      parentsWithIssues: countParentsWithIssues(report)
    },
    violations: flat,
    tree: report
  };

  console.log(JSON.stringify(out, null, 2));

  if (totalViolations > 0) {
    console.error(`\n[FAIL] ${totalViolations} violation(s) found across ${out.summary.parentsWithIssues} parent(s)`);
    exit(1);
  } else {
    console.error("\n[OK] All children within parent bounds");
    exit(0);
  }
}

function countViolations(report) {
  let n = 0;
  n += report.violations.length;
  for (const c of report.childReports) n += countViolations(c);
  return n;
}

function flattenViolations(report, parentId, out = []) {
  for (const v of report.violations) {
    out.push({ parentId: report.id, parentName: report.name, ...v });
  }
  for (const c of report.childReports) {
    flattenViolations(c, c.id, out);
  }
  return out;
}

function countNodes(report) {
  let n = 1;
  for (const c of report.childReports) n += countNodes(c);
  return n;
}

function countParentsWithIssues(report) {
  let n = report.violations.length > 0 ? 1 : 0;
  for (const c of report.childReports) n += countParentsWithIssues(c);
  return n;
}

main();