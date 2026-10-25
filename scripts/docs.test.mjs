import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(run) {
  const folder = await mkdtemp(path.join(tmpdir(), 'flowlab-docs-test-'));
  try {
    await cp(root, folder, { recursive: true, filter: filename => !path.relative(root, filename).split(path.sep).some(part => ['.git', 'node_modules', 'dist', '.DS_Store', 'coverage'].includes(part) || part.endsWith('.tsbuildinfo')) });
    await symlink(path.join(root, 'node_modules'), path.join(folder, 'node_modules'), 'dir');
    await run(folder);
  } finally { await rm(folder, { recursive: true, force: true }); }
}
function execute(folder, mode = 'check') {
  return spawnSync(process.execPath, ['scripts/docs.mjs', mode], { cwd: folder, encoding: 'utf8' });
}
async function change(folder, file, transform) {
  const filename = path.join(folder, file); await writeFile(filename, transform(await readFile(filename, 'utf8')));
}
test('documentation builds are reproducible and self-contained', async () => fixture(async folder => {
  const first = execute(folder, 'build'); assert.equal(first.status, 0, first.stderr);
  const html = await readFile(path.join(folder, 'dist/developer-guide/index.html'), 'utf8');
  assert.match(html, /章节导航/); assert.match(html, /flow-diagram/); assert.match(html, /hljs/); assert.match(html, /data-theme/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  const second = execute(folder, 'build'); assert.equal(second.status, 0, second.stderr);
  assert.equal(await readFile(path.join(folder, 'dist/developer-guide/index.html'), 'utf8'), html);
}));
test('missing local links fail in every Markdown file', async () => fixture(async folder => {
  await change(folder, 'README.md', source => source + '\n[Broken](src/missing.ts)\n');
  assert.notEqual(execute(folder).status, 0);
}));
test('missing heading anchors fail', async () => fixture(async folder => {
  await change(folder, 'docs/developer-guide.md', source => source + '\n[Broken](#missing-heading)\n');
  assert.notEqual(execute(folder).status, 0);
}));
test('missing code symbols fail', async () => fixture(async folder => {
  await change(folder, 'docs/developer-guide.md', source => source.replace('#evaluateWaf -->', '#missingFunction -->'));
  const result = execute(folder); assert.notEqual(result.status, 0); assert.match(result.stderr, /Missing code symbol/);
}));
test('stale project tree fails', async () => fixture(async folder => {
  await writeFile(path.join(folder, 'unlisted.txt'), 'fixture');
  const result = execute(folder); assert.notEqual(result.status, 0); assert.match(result.stderr, /Project tree is stale/);
}));
