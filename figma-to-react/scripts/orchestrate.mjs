#!/usr/bin/env node
// End-to-end entry: resolve input → extract → transform → render → build preview → report.
import { resolveInput } from './resolve-input.mjs';
import { extract } from './extract.mjs';
import { transformJsx } from './transform.mjs';
import { parseTokensCss } from './tokens.mjs';
import { renderReactComponent } from './render-react.mjs';
import { collectBridges } from './bridges.mjs';
import { buildPreview } from './build-preview.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') flags.url = argv[++i];
    else if (a === '--file-key') flags.fileKey = argv[++i];
    else if (a === '--node') flags.node = argv[++i];
    else if (a === '--from-find') flags.fromFind = argv[++i];
    else if (a === '--selection') flags.selection = true;
    else if (a === '--workdir') flags.workdir = argv[++i];
    else if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return flags;
}

function printHelp() {
  console.log(`figma-to-react — convert Figma components into React + unified preview

Usage:
  figma-to-react --url <figma-url>
  figma-to-react --file-key <key> --node <id>
  figma-to-react --from-find <name>
  figma-to-react --selection

Options:
  --workdir <dir>    Output directory (default: current directory)
`);
}

function pascalCase(name) {
  const parts = String(name).split(/[^A-Za-z0-9]+/).filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') || 'Component';
}

function defaultRunner(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('figma-cli', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => resolve({ code, stdout, stderr }));
  });
}

export async function main(argv = process.argv.slice(2), { runner = defaultRunner } = {}) {
  const flags = parseArgs(argv);
  const workdir = flags.workdir || process.cwd();

  console.log('→ Resolving input...');
  const { mode, nodeIds } = await resolveInput(flags, { runner });
  console.log(`  mode=${mode}, nodeIds=${nodeIds.join(', ')}`);

  console.log('→ Extracting from Figma...');
  const { jsxFiles, tokensFile } = await extract({ nodeIds, mode, workdir, runner });
  const tokens = parseTokensCss(await readFile(tokensFile, 'utf8'));

  console.log('→ Transforming + rendering components...');
  for (const jsxPath of jsxFiles) {
    const source = await readFile(jsxPath, 'utf8');
    const id = basename(jsxPath, '.jsx');
    // Try to infer a friendly name from the IR's root name, fallback to NodeId.
    const ir = await transformJsx(source, { name: id, nodeId: id.replace('-', ':') });
    const compName = pascalCase(ir.root.name || ir.name);
    const code = renderReactComponent({ ...ir, name: compName }, tokens);
    const outDir = join(workdir, 'dist', compName);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, `${compName}.jsx`), code, 'utf8');
    const bridges = collectBridges({ ...ir, name: compName });
    await writeFile(join(outDir, `${compName}.figma-bridges.json`), JSON.stringify(bridges, null, 2), 'utf8');
    if (tokens.size > 0) {
      const tokensBlock = `:root {\n${[...tokens.entries()].map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n`;
      await writeFile(join(outDir, 'tokens.css'), tokensBlock, 'utf8');
    }
    console.log(`  • dist/${compName}/${compName}.jsx (bridges: ${bridges.bridges.length})`);
  }

  console.log('→ Building unified preview...');
  const { components, outputDir } = await buildPreview({ workdir });
  console.log(`  • ${outputDir}/index.html`);

  console.log('');
  console.log('Done. To preview:');
  console.log(`  cd "${workdir}" && npx serve .`);
  console.log('  or: cd "' + workdir + '" && python -m http.server 8000');
  console.log('');
  console.log(`Components: ${components.join(', ')}`);
}

const invokedDirectly = import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (invokedDirectly) {
  main().catch(err => {
    console.error('figma-to-react failed:', err.message);
    process.exitCode = 1;
  });
}
