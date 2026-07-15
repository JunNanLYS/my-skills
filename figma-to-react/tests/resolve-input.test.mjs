import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInput } from '../scripts/resolve-input.mjs';

// A runner that pretends daemon is up and find returns two ids.
const daemonRunner = {
  async run(_args) {
    if (_args[0] === 'status') return { stdout: 'daemon-running\n' };
    if (_args[0] === 'config') return { stdout: 'token=***\n' };
    if (_args[0] === 'find') return { stdout: JSON.stringify([{ id: '1:1' }, { id: '1:2' }]) };
    return { stdout: '' };
  },
};
const noDaemonRunner = {
  async run(_args) {
    if (_args[0] === 'status') return { stdout: 'daemon-stopped\n' };
    if (_args[0] === 'config') return { stdout: 'token=***\n' };
    if (_args[0] === 'find') return { stdout: JSON.stringify([{ id: '2:5' }]) };
    return { stdout: '' };
  },
};

test('resolveInput parses --url into fileKey + nodeId and uses daemon mode', async () => {
  const r = await resolveInput(
    { url: 'https://www.figma.com/file/ABC123/MyFile?node-id=1-23' },
    { runner: daemonRunner }
  );
  assert.equal(r.mode, 'daemon');
  assert.deepEqual(r.nodeIds, ['1:23']);
});

test('resolveInput rejects --url without node-id', async () => {
  await assert.rejects(
    () => resolveInput({ url: 'https://www.figma.com/file/ABC123/MyFile' }, { runner: daemonRunner }),
    /URL must include a node-id parameter/
  );
});

test('resolveInput uses --file-key + --node directly', async () => {
  const r = await resolveInput(
    { fileKey: 'XYZ', node: '4:5' },
    { runner: daemonRunner }
  );
  assert.deepEqual(r.nodeIds, ['4:5']);
});

test('resolveInput expands --from-find into multiple NodeIds', async () => {
  const r = await resolveInput({ fromFind: 'Button' }, { runner: daemonRunner });
  assert.equal(r.mode, 'daemon');
  assert.deepEqual(r.nodeIds, ['1:1', '1:2']);
});

test('resolveInput falls back to PAT mode when daemon is down', async () => {
  const r = await resolveInput({ fromFind: 'X' }, { runner: noDaemonRunner });
  assert.equal(r.mode, 'pat');
  assert.deepEqual(r.nodeIds, ['2:5']);
});

test('resolveInput throws when both daemon and token are unavailable', async () => {
  const emptyRunner = { async run() { return { stdout: '' }; } };
  await assert.rejects(
    () => resolveInput({ fromFind: 'X' }, { runner: emptyRunner }),
    /figma-cli connect|set-token/
  );
});
