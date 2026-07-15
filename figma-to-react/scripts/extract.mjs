// Drive figma-cli to extract per-node JSX and a shared tokens.css.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

// Locate figma-cli executable. PATH probe first, then common npm-global paths.
function locateFigmaCli() {
  // 1. PATH probe via `where` (Windows) / `which` (POSIX).
  const isWin = process.platform === 'win32';
  const probe = isWin ? 'where' : 'which';
  const r = spawnSync(probe, ['figma-cli'], {
    encoding: 'utf8',
    shell: isWin,
  });
  if (r.status === 0 && r.stdout && r.stdout.trim()) {
    return r.stdout.trim().split(/\r?\n/)[0];
  }

  // 2. Fallback candidates. All `--version`-verified before being returned.
  const candidates = [
    process.env.npm_config_prefix && `${process.env.npm_config_prefix}${isWin ? '\\' : '/'}node_modules${isWin ? '\\' : '/'}.bin${isWin ? '\\' : '/'}figma-cli${isWin ? '.cmd' : ''}`,
    isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli.cmd`,
    isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli`,
    !isWin && process.env.HOME && `${process.env.HOME}/.npm-global/bin/figma-cli`,
    `${process.cwd()}/node_modules/.bin/figma-cli${isWin ? '.cmd' : ''}`,
  ].filter(Boolean);

  for (const c of candidates) {
    const v = spawnSync(c, ['--version'], { encoding: 'utf8', stdio: 'ignore' });
    if (v.status === 0) return c;
  }
  return null;
}

function figmaCliNotFoundError(triedPaths) {
  return new Error(
    'figma-to-react cannot locate figma-cli.\n\n' +
      'Tried:\n' +
      triedPaths.map((p) => `  • ${p}`).join('\n') +
      '\n\nFix: npm install -g figma-cli, then verify with:\n' +
      '  figma-cli --version\n\n' +
      'If figma-cli is already installed, ensure it is on PATH or ' +
      'in one of the locations searched above.'
  );
}

export function defaultRunner(args) {
  const isWin = process.platform === 'win32';
  const located = locateFigmaCli();
  if (!located) {
    const allTried = [
      `${isWin ? 'where' : 'which'} figma-cli (PATH)`,
      process.env.npm_config_prefix && `${process.env.npm_config_prefix}${isWin ? '\\' : '/'}node_modules/.bin/figma-cli`,
      isWin && process.env.APPDATA && `${process.env.APPDATA}\\npm\\figma-cli.cmd`,
      !isWin && process.env.HOME && `${process.env.HOME}/.npm-global/bin/figma-cli`,
      `${process.cwd()}/node_modules/.bin/figma-cli`,
    ].filter(Boolean);
    return Promise.reject(figmaCliNotFoundError(allTried));
  }
  return new Promise((resolve, reject) => {
    // Windows: shell:true so .cmd / .ps1 get the right interpreter.
    const proc = spawn(located, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWin,
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => resolve({ code, stdout, stderr }));
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
