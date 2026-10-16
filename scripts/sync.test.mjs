import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { FILES, sync } from './sync.mjs';

test('sync bumps shared versions and keeps project-specific bits', () => {
  const tpl = mkdtempSync(join(tmpdir(), 'tpl-'));
  const target = mkdtempSync(join(tmpdir(), 'target-'));
  const write = (dir, file, content) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  };

  for (const file of FILES) write(tpl, file, `template ${file}`);
  write(target, 'vitest.config.js', 'custom');
  write(target, '.templateignore', 'vitest.config.js\n.husky/pre-push\n.husky/commit-msg\n');
  write(
    tpl,
    'package.json',
    JSON.stringify({
      dependencies: { cac: '2.0.0', picocolors: '1.0.0' },
      devDependencies: { vitest: '5.0.0', husky: '9.0.0' },
      scripts: { test: 'vitest run' },
      engines: { node: '>=22' },
      exports: { '.': { import: './lib/index.js' } },
      main: './lib/index.js',
    })
  );
  write(
    target,
    'package.json',
    JSON.stringify({
      dependencies: { cac: '1.0.0', textlint: '15.0.0' },
      devDependencies: { vitest: '4.0.0' },
      scripts: { test: 'old', dev: 'node .' },
      exports: { '.': { import: './lib/index.mjs', require: './lib/index.cjs' } },
      main: './lib/index.cjs',
      module: './lib/index.mjs',
    })
  );

  sync(tpl, target);

  const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf-8'));
  assert.deepEqual(pkg.dependencies, { cac: '2.0.0', textlint: '15.0.0' });
  assert.deepEqual(pkg.devDependencies, { vitest: '5.0.0', husky: '9.0.0' });
  assert.deepEqual(pkg.scripts, { test: 'vitest run', dev: 'node .' });
  assert.deepEqual(pkg.engines, { node: '>=22' });
  assert.deepEqual(pkg.exports, { '.': { import: './lib/index.js' } });
  assert.equal(pkg.main, './lib/index.js');
  assert.equal('module' in pkg, false);
  assert.equal(readFileSync(join(target, 'vitest.config.js'), 'utf-8'), 'custom');
  assert.equal(readFileSync(join(target, 'tsconfig.json'), 'utf-8'), 'template tsconfig.json');
  assert.equal(
    readFileSync(join(target, '.github/workflows/main.yml'), 'utf-8'),
    'template .github/workflows/main.yml'
  );
});
