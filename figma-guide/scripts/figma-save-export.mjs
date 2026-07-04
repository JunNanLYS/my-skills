#!/usr/bin/env node
/**
 * figma-save-export.mjs — figma_export_node base64 → PNG 写盘助手
 *
 * `mcp__figma-mcp-bridge__figma_export_node` 返回的 `data` 字段是 PNG 的 base64 字符串,
 * 工具自身不写盘。本脚本接收 base64,自动:
 *   1. mkdir -p 目标目录
 *   2. base64 解码
 *   3. 校验 PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)
 *   4. 写到磁盘
 *   5. 打印绝对路径 + 字节数,供 Claude 立即 Read
 *
 * 用法:
 *   # 1. 命令行参数(base64 短时推荐)
 *   node figma-save-export.mjs --base64 "<data>" --out <absPath> [--name <file.png>]
 *
 *   # 2. stdin(长 base64 避免命令行溢出)
 *   echo "<data>" | node figma-save-export.mjs --stdin --out <absPath> [--name <file.png>]
 *
 *   # 3. 从 JSON 文件读(适合 export_node 结果直接 dump 到文件)
 *   node figma-save-export.mjs --in <result.json> --out <absPath> [--name <file.png>]
 *
 * 必选:
 *   --base64 <data>  |  --stdin  |  --in <file>
 *   --out   <absDir>           输出目录(必须绝对路径或相对 cwd)
 *
 * 可选:
 *   --name  <file.png>         文件名(默认:figma-export-{YYYYMMDD-HHMMSS}-{random4}.png)
 *   --overwrite                允许覆盖同名文件(默认:同名存在则 exit 3)
 *
 * 退出码:
 *   0  成功
 *   1  参数错误
 *   2  base64 解码失败
 *   3  文件已存在且未传 --overwrite
 *   4  PNG magic bytes 校验失败(说明给的 data 不是 PNG)
 *
 * 设计:
 *   - 不调 MCP,只做 IO + 校验
 *   - 输入数据可来自 stdin(适合 MCP tool result 直接 pipe)
 *   - 自动校验 PNG magic,避免把 base64 写到一个空 / 错误文件上
 */

import { mkdirSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { argv, exit, stdin } from "node:process";
import { createHash } from "node:crypto";

// ---------- CLI 解析 ----------

function parseArgs() {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") {
    printUsage();
    exit(0);
  }
  const opts = { base64: null, stdin: false, in: null, out: null, name: null, overwrite: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--base64") opts.base64 = args[++i];
    else if (a === "--stdin") opts.stdin = true;
    else if (a === "--in") opts.in = args[++i];
    else if (a === "--out") opts.out = args[++i];
    else if (a === "--name") opts.name = args[++i];
    else if (a === "--overwrite") opts.overwrite = true;
    else {
      console.error(`Unknown arg: ${a}`);
      printUsage();
      exit(1);
    }
  }
  // 校验:三选一必给,out 必给
  const sources = [opts.base64, opts.stdin, opts.in].filter((x) => x !== null && x !== false);
  if (sources.length !== 1) {
    console.error("Error: 必须三选一指定 base64 来源:--base64 / --stdin / --in");
    printUsage();
    exit(1);
  }
  if (!opts.out) {
    console.error("Error: 缺少 --out <absDir>");
    printUsage();
    exit(1);
  }
  return opts;
}

function printUsage() {
  console.log(`figma-save-export.mjs — figma_export_node base64 → PNG 写盘

用法:
  node figma-save-export.mjs --base64 "<data>" --out <absDir> [--name <file.png>]
  node figma-save-export.mjs --stdin                  --out <absDir> [--name <file.png>]
  node figma-save-export.mjs --in <result.json>       --out <absDir> [--name <file.png>]

可选:
  --name <file.png>         文件名(默认带时间戳 + 随机)
  --overwrite               允许覆盖同名

退出码:0 成功 / 1 参数 / 2 base64 解码 / 3 文件已存在 / 4 PNG magic 校验失败`);
}

// ---------- 输入读取 ----------

async function readBase64(opts) {
  if (opts.base64) return opts.base64;
  if (opts.stdin) {
    // 收集 stdin 全部内容,trim 末尾空白
    return await new Promise((resolveP, rejectP) => {
      let buf = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (buf += chunk));
      stdin.on("end", () => resolveP(buf.trim()));
      stdin.on("error", rejectP);
    });
  }
  if (opts.in) {
    const raw = readFileSync(resolve(opts.in), "utf8").trim();
    // 兼容两种输入:
    //   A. 纯 base64 字符串
    //   B. JSON 形态(直接 dump tool result): {"data": "iVBOR...", "format": "PNG", ...}
    if (raw.startsWith("{")) {
      try {
        const j = JSON.parse(raw);
        if (typeof j.data === "string") return j.data;
        console.error(`Error: --in 文件 JSON 缺少 data 字段`);
        exit(1);
      } catch (e) {
        console.error(`Error: --in 文件 JSON 解析失败: ${e.message}`);
        exit(1);
      }
    }
    return raw;
  }
  // 不该到这里(parseArgs 已拦截)
  console.error("Error: 没有 base64 来源");
  exit(1);
}

// ---------- PNG 校验 ----------

function assertPngMagic(buf) {
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) return false;
  }
  return true;
}

// ---------- 主流程 ----------

function defaultName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `figma-export-${ts}-${rand}.png`;
}

function ensurePngExt(name) {
  return name.toLowerCase().endsWith(".png") ? name : `${name}.png`;
}

async function main() {
  const opts = parseArgs();
  const b64 = await readBase64(opts);

  // base64 解码
  let buf;
  try {
    buf = Buffer.from(b64, "base64");
  } catch (e) {
    console.error(`Error: base64 解码失败: ${e.message}`);
    exit(2);
  }
  if (buf.length === 0) {
    console.error(`Error: base64 解码后为空(输入是不是 base64?)`);
    exit(2);
  }

  // PNG magic 校验
  if (!assertPngMagic(buf)) {
    console.error(`Error: 解码结果不是 PNG(magic bytes 校验失败)。可能输入了非 PNG 的 data,例如 SVG/JPG。`);
    console.error(`       前 8 字节: ${Array.from(buf.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);
    exit(4);
  }

  // 解析输出路径
  const outDir = resolve(opts.out);
  mkdirSync(outDir, { recursive: true });
  const fileName = ensurePngExt(opts.name || defaultName());
  const outPath = join(outDir, fileName);

  // 同名检查
  if (existsSync(outPath) && !opts.overwrite) {
    console.error(`Error: 文件已存在 ${outPath}(传 --overwrite 允许覆盖)`);
    exit(3);
  }

  // 写盘
  writeFileSync(outPath, buf);
  const size = statSync(outPath).size;

  // 输出 JSON,便于 Claude 解析
  console.log(JSON.stringify({
    success: true,
    path: outPath,
    name: fileName,
    bytes: size,
    sha256_prefix: createHash("sha256").update(buf).digest("hex").slice(0, 12),
  }, null, 2));

  exit(0);
}

// ESM top-level await 走 main
await main();