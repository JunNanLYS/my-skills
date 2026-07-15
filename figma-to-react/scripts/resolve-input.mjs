// Resolve user-supplied input flags into a final list of NodeIds + execution mode.
import { spawn } from 'node:child_process';

const FIGMA_URL_RE = /^https?:\/\/(?:www\.)?figma\.com\/(?:file|design)\/([A-Za-z0-9]+)\/[^?]*\?(?:[^#]*&)?node-id=([0-9]+-[0-9]+)/;

function nodeIdFromUrl(url) {
  const m = FIGMA_URL_RE.exec(url);
  if (!m) return null;
  return m[2].replace('-', ':');
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

const runnerAdapter = {
  async run(args) {
    return defaultRunner(args);
  },
};

export async function resolveInput(flags, { runner = runnerAdapter } = {}) {
  // 1. Detect mode.
  const status = await runner.run(['status']);
  const daemonUp = /daemon-running|connected-to-figma/i.test(status.stdout);
  const config = await runner.run(['config']);
  const hasToken = /token=\S+/i.test(config.stdout);
  const mode = daemonUp ? 'daemon' : (hasToken ? 'pat' : null);
  if (!mode) {
    throw new Error('figma-cli is not connected. Run `figma-cli connect` or `figma-cli config set-token <TOKEN>`.');
  }

  // 2. Translate flags → NodeId list.
  if (flags.url) {
    const id = nodeIdFromUrl(flags.url);
    if (!id) {
      throw new Error('URL must include a node-id parameter, or use --from-find <name> instead.');
    }
    return { mode, nodeIds: [id] };
  }
  if (flags.fileKey && flags.node) {
    return { mode, nodeIds: [flags.node] };
  }
  if (flags.fromFind) {
    const result = await runner.run(['find', flags.fromFind]);
    let parsed;
    try { parsed = JSON.parse(result.stdout); } catch { parsed = []; }
    const ids = Array.isArray(parsed) ? parsed.map(x => x && x.id).filter(Boolean) : [];
    if (ids.length === 0) {
      throw new Error(`figma-cli find "${flags.fromFind}" returned no matches.`);
    }
    return { mode, nodeIds: ids };
  }
  if (flags.selection) {
    if (mode !== 'daemon') {
      throw new Error('--selection requires the desktop daemon (PAT mode has no live selection).');
    }
    const result = await runner.run(['get']);
    let parsed;
    try { parsed = JSON.parse(result.stdout); } catch { parsed = null; }
    if (!parsed || !parsed.id) {
      throw new Error('No current selection in Figma. Click a node first.');
    }
    return { mode, nodeIds: [parsed.id] };
  }

  throw new Error('No input provided. Use --url, --file-key + --node, --from-find, or --selection.');
}
