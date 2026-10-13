import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { FILES, sync } from './sync.mjs';

test('sync bumps shared versions and keeps project-specific bits', () => {
  const tpl = mkdtempSync(join(tmpdir(), 'tpl-'));
  const target = mkdtempSync(join(tmpdir(), 'target-'));
  const write = (dir, file, content) => writeFileSync(join(dir, file), content);

  for (const file of FILES.filter((f) => !f.includes('/'))) write(tpl, file, `template ${file}`);
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
    })
  );
  write(
    target,
    'package.json',
    JSON.stringify({
      dependencies: { cac: '1.0.0', textlint: '15.0.0' },
      devDependencies: { vitest: '4.0.0' },
      scripts: { test: 'old', dev: 'node .' },
    })
  );

  sync(tpl, target);

  const pkg = JSON.parse(readFileSync(join(target, 'package.json'), 'utf-8'));
  assert.deepEqual(pkg.dependencies, { cac: '2.0.0', textlint: '15.0.0' });
  assert.deepEqual(pkg.devDependencies, { vitest: '5.0.0', husky: '9.0.0' });
  assert.deepEqual(pkg.scripts, { test: 'vitest run', dev: 'node .' });
  assert.deepEqual(pkg.engines, { node: '>=22' });
  assert.equal(readFileSync(join(target, 'vitest.config.js'), 'utf-8'), 'custom');
  assert.equal(readFileSync(join(target, 'tsconfig.json'), 'utf-8'), 'template tsconfig.json');
});
