import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const skillDirectory = resolve(testDirectory, '..');
const skillPath = join(skillDirectory, 'SKILL.md');
const skill = await readFile(skillPath, 'utf8');

assert.ok(skill.startsWith('---\n'), 'SKILL.md must start with YAML frontmatter');

const frontmatterEnd = skill.indexOf('\n---\n', 4);
assert.notEqual(frontmatterEnd, -1, 'SKILL.md frontmatter must close');

const frontmatter = skill.slice(4, frontmatterEnd);
const body = skill.slice(frontmatterEnd + 5);

const getField = (name) => {
  const match = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'));
  assert.ok(match, `frontmatter must include ${name}`);
  return match[1].trim();
};

const name = getField('name');
const description = getField('description');
const version = getField('version');

assert.match(name, /^[a-z0-9-]+$/, 'name must use lowercase letters, digits, and hyphens');
assert.equal(name, 'engineering-react-interfaces');
assert.ok(description.startsWith('Use when '), 'description must start with “Use when”');
assert.ok(!/\b(I|we|you)\b/i.test(description), 'description must remain third person');
assert.ok(description.length <= 500, 'description should remain concise');
assert.match(version, /^\d+\.\d+$/, 'version must use major.minor format');
assert.ok(frontmatter.length <= 1024, 'frontmatter must stay under 1024 characters');
assert.ok(body.split('\n').length < 500, 'SKILL.md body must stay under 500 lines');

const requiredPhrases = [
  'React',
  'TypeScript',
  'responsive',
  'overflow',
  'clipping',
  'accessibility',
  'performance',
  'Implemented — validation pending',
  'Partially verified',
  'Accepted',
  'Red flags',
  'Quick reference',
  'Rationalizations',
];

for (const phrase of requiredPhrases) {
  assert.ok(body.toLowerCase().includes(phrase.toLowerCase()), `SKILL.md must include ${phrase}`);
}

const markdownLinks = [...skill.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)].map((match) => match[1]);
assert.ok(markdownLinks.length >= 7, 'SKILL.md should expose references, example, and evaluations directly');

for (const relativePath of markdownLinks) {
  const targetPath = join(skillDirectory, relativePath);
  const target = await stat(targetPath);
  assert.ok(target.isFile(), `${relativePath} must exist`);

  const content = await readFile(targetPath, 'utf8');
  if (content.split('\n').length > 100) {
    assert.match(content, /## Contents/, `${relativePath} must include a table of contents`);
  }
}

const requiredLinks = [
  'references/visual-direction.md',
  'references/layout-and-responsive.md',
  'references/react-typescript-performance.md',
  'references/accessibility-and-interaction.md',
  'references/acceptance.md',
  'examples/resilient-catalog.md',
  'tests/evaluations.md',
];

for (const requiredLink of requiredLinks) {
  assert.ok(markdownLinks.includes(requiredLink), `${requiredLink} must be linked directly from SKILL.md`);
}

const bannedWindowsLink = /\]\([^)]*\\[^)]*\)/;
assert.ok(!bannedWindowsLink.test(skill), 'markdown links must use forward slashes');

console.log('engineering-react-interfaces structure: PASS');
