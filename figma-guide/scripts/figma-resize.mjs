#!/usr/bin/env node
/**
 * figma-resize.mjs — 复合组件 resize 助手
 *
 * Figma MCP `set_node_properties` 只改父节点 w/h,不动子节点。
 * 子节点坐标是绝对的,父框缩小时右边/下边被裁,放大时空出。
 * 本脚本封装三种重算模式,所有 set_node_properties 批量下发。
 *
 * 用法:
 *   node figma-resize.mjs <nodeId> --w <px> --h <px> [--mode center|scale|anchor] [--anchor tl|tr|bl|br|c] [--fileKey <key>] [--config <json>]
 *
 * --config JSON 字段:
 *   {
 *     "parent": { "x":0, "y":0, "w":360, "h":40 },   // resize 前的父框 (从 get_node 拿)
 *     "newW": 300, "newH": 40,                        // resize 后的目标尺寸
 *     "mode": "center",
 *     "anchor": "tl",
 *     "children": [
 *       { "id":"47:239", "x":14, "y":8, "w":32, "h":24, "constraints": null }
 *     ]
 *   }
 *
 *   constraints 取值: "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r" | "scale" | null
 *   null = 不动;其它 = 按 Figma constraints 语义重算 (pin 哪边 / 等比缩放)
 *
 * 设计:
 *   - 所有计算 Math.round,统一像素精度
 *   - 输出 JSON,列出每个子节点的新 {x, y, w, h},供 Claude 直接喂给 mcp__figma-bridge__set_node_properties
 *   - 不直接调 MCP — 留在 Claude 侧执行,本脚本只做纯计算 + dry-run 校验
 */

import { readFileSync, writeFileSync } from "node:fs";
import { argv, exit } from "node:process";

// ---------- CLI 解析 ----------

function parseArgs() {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    printUsage();
    exit(0);
  }
  const nodeId = args[0];
  const opts = { mode: "center", anchor: "tl", w: null, h: null, fileKey: null, config: null };
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--w") opts.w = Number(args[++i]);
    else if (a === "--h") opts.h = Number(args[++i]);
    else if (a === "--mode") opts.mode = args[++i];
    else if (a === "--anchor") opts.anchor = args[++i];
    else if (a === "--fileKey") opts.fileKey = args[++i];
    else if (a === "--config") opts.config = args[++i];
    else {
      console.error(`Unknown arg: ${a}`);
      printUsage();
      exit(1);
    }
  }
  if (!nodeId) { console.error("nodeId required"); exit(1); }
  return { nodeId, opts };
}

function printUsage() {
  console.log(`Usage: node figma-resize.mjs <nodeId> [--w <px>] [--h <px>] [--mode center|scale|anchor] [--anchor tl|tr|bl|br|c] [--config <json>]`);
  console.log(`       --config 是 JSON,包含 parent + newW + newH + children (含 x/y/w/h/constraints)`);
}

// ---------- 核心算法 ----------

const VALID_MODES = ["center", "scale", "anchor"];
const VALID_ANCHORS = ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round(v) { return Math.round(v); }

/**
 * 单个子节点重算
 * @param {{x:number,y:number,w:number,h:number,constraints?:string|null}} c
 * @param {{x:number,y:number,w:number,h:number}} parent    resize 前父框
 * @param {{w:number,h:number}} newSize                     resize 后父框尺寸
 * @param {string} mode   center|scale|anchor
 * @param {string} anchor (anchor 模式生效)
 */
function recompute(c, parent, newSize, mode, anchor) {
  const cstr = c.constraints ?? "tl";

  // mode=center: 子节点相对父中心保持,旧距离映射新距离
  if (mode === "center") {
    const cxOld = c.x + c.w / 2;
    const cyOld = c.y + c.h / 2;
    const nxCenter = round((cxOld / parent.w) * newSize.w);
    const nyCenter = round((cyOld / parent.h) * newSize.h);
    return {
      x: clamp(round(nxCenter - c.w / 2), 0, newSize.w - c.w),
      y: clamp(round(nyCenter - c.h / 2), 0, newSize.h - c.h),
      w: c.w, h: c.h
    };
  }

  // mode=scale: 按新/旧比例等比缩放位置和尺寸
  if (mode === "scale") {
    const rx = newSize.w / parent.w;
    const ry = newSize.h / parent.h;
    return {
      x: clamp(round(c.x * rx), 0, newSize.w - round(c.w * rx)),
      y: clamp(round(c.y * ry), 0, newSize.h - round(c.h * ry)),
      w: round(c.w * rx),
      h: round(c.h * ry)
    };
  }

  // mode=anchor: 锚点位置不动,其余子节点按比例重新分布
  if (mode === "anchor") {
    const a = computeAnchor(anchor, parent);
    const aNew = computeAnchor(anchor, { x: 0, y: 0, w: newSize.w, h: newSize.h });
    const dx = aNew.x - c.x;  // 子锚点到父锚点的旧差
    const dy = aNew.y - c.y;
    // 重新表达: 子节点相对父锚点的位置 = (原相对位置) + (父锚点漂移 - 子节点移动)
    // 简化: 子节点相对父锚点的偏移 = 子锚点 - 父锚点(旧) = dx'(其中 dx' = c.x+c.w*kx - a.x)
    // 为此需要根据 cstr 选子节点上的锚点
    const childAnchor = computeAnchor(cstr, c);
    const dxOld = childAnchor.x - a.x;
    const dyOld = childAnchor.y - a.y;
    const rx = parent.w === 0 ? 1 : newSize.w / parent.w;
    const ry = parent.h === 0 ? 1 : newSize.h / parent.h;
    const newChildAnchor = {
      x: aNew.x + round(dxOld * rx),
      y: aNew.y + round(dyOld * ry)
    };
    return offsetByAnchor(c, cstr, newChildAnchor.x, newChildAnchor.y, newSize);
  }

  throw new Error(`Unknown mode: ${mode}`);
}

/** 给定节点 + 锚点关键字,返回该锚点像素坐标 */
function computeAnchor(name, rect) {
  switch (name) {
    case "tl": return { x: rect.x,            y: rect.y };
    case "t":  return { x: rect.x + rect.w/2, y: rect.y };
    case "tr": return { x: rect.x + rect.w,   y: rect.y };
    case "l":  return { x: rect.x,            y: rect.y + rect.h/2 };
    case "c":  return { x: rect.x + rect.w/2, y: rect.y + rect.h/2 };
    case "r":  return { x: rect.x + rect.w,   y: rect.y + rect.h/2 };
    case "bl": return { x: rect.x,            y: rect.y + rect.h };
    case "b":  return { x: rect.x + rect.w/2, y: rect.y + rect.h };
    case "br": return { x: rect.x + rect.w,   y: rect.y + rect.h };
    default:   return { x: rect.x,            y: rect.y };
  }
}

/** 已知子节点上的锚点像素位置 + 锚点关键字,反推子节点 x/y (保持 w/h 不变) */
function offsetByAnchor(c, name, ax, ay, newSize) {
  let x, y;
  switch (name) {
    case "tl": x = ax;                   y = ay;                   break;
    case "t":  x = round(ax - c.w/2);    y = ay;                   break;
    case "tr": x = round(ax - c.w);      y = ay;                   break;
    case "l":  x = ax;                   y = round(ay - c.h/2);    break;
    case "c":  x = round(ax - c.w/2);    y = round(ay - c.h/2);    break;
    case "r":  x = round(ax - c.w);      y = round(ay - c.h/2);    break;
    case "bl": x = ax;                   y = round(ay - c.h);      break;
    case "b":  x = round(ax - c.w/2);    y = round(ay - c.h);      break;
    case "br": x = round(ax - c.w);      y = round(ay - c.h);      break;
    default:   x = ax;                   y = ay;                   break;
  }
  return {
    x: clamp(x, 0, newSize.w - c.w),
    y: clamp(y, 0, newSize.h - c.h),
    w: c.w, h: c.h
  };
}

// ---------- 校验 + 输出 ----------

function validate(config) {
  if (!VALID_MODES.includes(config.mode)) throw new Error(`Invalid mode: ${config.mode}`);
  if (config.mode === "anchor" && !VALID_ANCHORS.includes(config.anchor))
    throw new Error(`Invalid anchor: ${config.anchor}`);
  if (!config.parent || typeof config.parent.w !== "number")
    throw new Error("parent.w required");
  if (typeof config.newW !== "number" || typeof config.newH !== "number")
    throw new Error("newW/newH required");
  if (!Array.isArray(config.children)) throw new Error("children array required");
}

function buildPlan(config) {
  const parent = config.parent;
  const newSize = { w: config.newW, h: config.newH };
  const rx = parent.w === 0 ? 1 : newSize.w / parent.w;
  const ry = parent.h === 0 ? 1 : newSize.h / parent.h;

  const plan = config.children.map(c => {
    const next = recompute(c, parent, newSize, config.mode, config.anchor);
    return {
      id: c.id,
      from: { x: c.x, y: c.y, w: c.w, h: c.h },
      to:   next,
      constraints: c.constraints ?? "tl",
      delta: { dx: next.x - c.x, dy: next.y - c.y, dw: next.w - c.w, dh: next.h - c.h },
      warnings: []
    };
  });

  // 校验: 是否有子节点超出新父框
  for (const p of plan) {
    if (p.to.x < 0) p.warnings.push("x<0 (超出左边界)");
    if (p.to.y < 0) p.warnings.push("y<0 (超出上边界)");
    if (p.to.x + p.to.w > config.newW) p.warnings.push(`x+w=${p.to.x + p.to.w}>newW=${config.newW} (超出右边界)`);
    if (p.to.y + p.to.h > config.newH) p.warnings.push(`y+h=${p.to.y + p.to.h}>newH=${config.newH} (超出下边界)`);
  }

  return { parent, newSize, ratio: { rx, ry }, plan };
}

// ---------- main ----------

function main() {
  const { nodeId, opts } = parseArgs();
  let config;

  if (opts.config) {
    if (opts.config.endsWith(".json")) {
      config = JSON.parse(readFileSync(opts.config, "utf8"));
    } else {
      config = JSON.parse(opts.config);
    }
    if (opts.w !== null) config.newW = opts.w;
    if (opts.h !== null) config.newH = opts.h;
  } else {
    // 仅给 --w/--h,没法算子节点,退化为 dry-run 提示
    if (opts.w === null && opts.h === null) {
      console.error("Need --w/--h or --config");
      exit(1);
    }
    config = {
      parent: { x: 0, y: 0, w: 0, h: 0 },  // 未知
      newW: opts.w ?? 0,
      newH: opts.h ?? 0,
      mode: opts.mode,
      anchor: opts.anchor,
      children: []
    };
    console.error("[warn] --w/--h 单独使用时无法计算子节点,提供 --config 才能输出完整 plan");
  }

  validate(config);

  const out = buildPlan(config);
  out.nodeId = nodeId;
  out.fileKey = opts.fileKey;
  out.mode = config.mode;
  out.anchor = config.anchor;

  console.log(JSON.stringify(out, null, 2));

  const warnings = out.plan.flatMap(p => p.warnings.map(w => `${p.id}: ${w}`));
  if (warnings.length) {
    console.error("\n[warnings]");
    warnings.forEach(w => console.error("  " + w));
    exit(2);
  }
}

main();