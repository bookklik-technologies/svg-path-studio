import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { log } from 'node:console';

const packageDirectory = fileURLToPath(new URL('../packages/core/', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../packages/core/package.json', import.meta.url), 'utf8'));
const [packed] = JSON.parse(execSync('npm pack --dry-run --json --ignore-scripts', {
  cwd: packageDirectory,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit']
}));
const files = new Set(packed.files.map(({ path }) => path));

assert.equal(manifest.private, undefined, 'The core must be publishable');
assert.equal(manifest.publishConfig.access, 'public');
for (const required of ['README.md', 'LICENSE', 'package.json', manifest.main.slice(2), manifest.types.slice(2)]) {
  assert.ok(files.has(required), `Missing package file: ${required}`);
}
function checkExports(value) {
  if (typeof value === 'string') {
    assert.ok(files.has(value.slice(2)), `Export target is missing: ${value}`);
  } else {
    for (const target of Object.values(value)) checkExports(target);
  }
}
checkExports(manifest.exports);
for (const path of files) {
  assert.ok(path.startsWith('dist/') || ['README.md', 'LICENSE', 'package.json'].includes(path),
    `Unexpected package file: ${path}`);
}
for (const dependencies of [manifest.dependencies, manifest.optionalDependencies, manifest.peerDependencies]) {
  for (const version of Object.values(dependencies ?? {})) {
    assert.ok(!/^(workspace:|file:|link:)/.test(version), `Local dependency cannot be published: ${version}`);
  }
}
log(`Package ready: ${packed.name}@${packed.version} (${files.size} files, ${packed.size} bytes packed)`);
log('Dry run only; nothing was published.');
