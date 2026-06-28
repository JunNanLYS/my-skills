#!/usr/bin/env node
/**
 * figma-validate-bounds.mjs — 子组件越界检测器
 *
 * 递归遍历根组件的整棵子树,检查每个父节点能否完全包住所有直接子节点。
 * 一旦发现 child 部分超出 parent bounds 即记录违规。
 *
 * 用法:
 *   node figma-validate-bounds.mjs <rootNodeId> [--config <json>] [--fileKey <key>] [--strict] [--tolerance <n>]
 *
 * --config JSON 字段:
 *   {
 *     "root": {
 *       "id": "47:212",
 *       "x": 0, "y": 0, "w": 360, "h": 40,             // 根节点当前 bounds
 *       "clipsContent": false,                          // 可选,根节点的 clipsContent
 *       "children": [                                   // 递归子树,每个节点都展开
 *         {
 *           "id": "47:239", "x": 14, "y": 8, "w": 32, "h": 24,
 *           "clipsContent": false,
 *           "children": [...]
 *         }
 *       ]
 *     }
 *   }
 *
 *   字段全名 = Figma REST API get_node 返回值,直接喂 Claude 抓的 JSON。
 *
 * 检测规则 (对每个 parent-child 对):
 *   child.x < parent.x                                 → left
 *   child.y < parent.y                                 → top
 *   child.x + child.w > parent.x + parent.w             → right
 *   child.y + child.h > parent.y + parent.h             → bottom
 *
 * 默认行为:
 *   - clipsContent=true 的父节点,即使子节点溢出也忽略 (设计意图就是裁)
 *   - 容差 0 (整数像素)
 *   - --strict 把 clipsContent=true 也算违规
 *
 * 设计: 纯计算,不调 MCP。Claude 侧负责:
 *   1) get_node 递归拿子树 (必要时多次调用 + 拼装)
 *   2) 组装 --config
 *   3) 跑脚本拿 violations
 *   4) 据此决定是 set_node_properties 修还是反向 absorb (扩父 / 加 clip)
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
  const opts = { config: null, fileKey: null, strict: false, tolerance: 0 };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--config") opts.config = args[++i];
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
  return { rootId, opts };
}

function printUsage() {
  console.log(`Usage: node figma-validate-bounds.mjs <rootNodeId> [--config <json>] [--strict] [--tolerance <n>]`);
  console.log(`       --config 是 JSON,包含 root.x/y/w/h/children (子树递归展开)`);
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

function loadConfig(opts) {
  if (!opts.config) {
    console.error("Need --config <json|path>");
    exit(1);
  }
  let raw;
  if (opts.config.endsWith(".json")) {
    raw = readFileSync(opts.config, "utf8");
  } else {
    raw = opts.config;
  }
  return JSON.parse(raw);
}

function countViolations(report) {
  let n = 0;
  n += report.violations.length;
  for (const c of report.childReports) n += countViolations(c);
  return n;
}

function flattenViolations(report, parentId, out = []) {
  // 当前 report.violations 记录的是 report 的子节点对它的违规,所以 parentId 是 report 自己
  // (因为从 walk 角度看,report 是 "parent",violations 字段名是 "childId ...")
  for (const v of report.violations) {
    out.push({ parentId: report.id, parentName: report.name, ...v });
  }
  // 子节点的 violations 是子节点的子对子的违规,parentId 应是子节点 id
  for (const c of report.childReports) {
    flattenViolations(c, c.id, out);
  }
  return out;
}

function main() {
  const { rootId, opts } = parseArgs();
  const config = loadConfig(opts);
  if (!config.root) { console.error("config.root required"); exit(1); }
  if (config.root.id !== rootId) {
    console.warn(`[warn] config.root.id (${config.root.id}) !== rootNodeId arg (${rootId})`);
  }

  // 应用全局 tolerance / strict
  const tol = opts.tolerance;
  const strict = opts.strict;

  const report = walk(config.root, tol, strict);
  const totalViolations = countViolations(report);
  const flat = flattenViolations(report, report.id);

  const out = {
    rootId,
    fileKey: opts.fileKey,
    strict,
    tolerance: tol,
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