// Drive figma-cli to extract per-node JSX and a shared tokens.css.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

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

function safeName(id) {
  return id.replace(/[:]/g, '-');
}

export async function extract({ nodeIds, mode, workdir, runner = defaultRunner }) {
  const tmpDir = join(workdir, 'tmp');
  await mkdir(tmpDir, { recursive: true });

  // 1. tokens.css (once).
  const tokensResult = await runner(['export', 'css']);
  if (tokensResult.code !== 0) {
    throw new Error(`figma-cli export css failed: ${tokensResult.stderr || tokensResult.stdout}`);
  }
  const tokensFile = join(tmpDir, 'tokens.css');
  await writeFile(tokensFile, tokensResult.stdout, 'utf8');

  // 2. Per-node export-jsx.
  const jsxFiles = [];
  for (const id of nodeIds) {
    const result = await runner(['export-jsx', id, '--pretty']);
    if (result.code !== 0) {
      throw new Error(`figma-cli export-jsx ${id} failed: ${result.stderr || result.stdout}`);
    }
    const outPath = join(tmpDir, `${safeName(id)}.jsx`);
    await writeFile(outPath, result.stdout, 'utf8');
    jsxFiles.push(outPath);
  }

  return { jsxFiles, tokensFile, mode };
}
