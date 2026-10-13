#!/usr/bin/env node
// Usage: node scripts/sync.mjs <templateDir> <targetDir>
// Copies shared config files and merges shared package.json fields into a target CLI.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const FILES = [
  'tsconfig.json',
  'commitlint.config.js',
  'eslint.config.js',
  '.prettierrc',
  '.prettierignore',
  '.npmrc.dist',
  '.nvmrc',
  '.husky/pre-push',
  '.husky/commit-msg',
  'vitest.config.js',
  'rolldown.config.js',
];

const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));

export function sync(templateDir, targetDir) {
  const ignorePath = join(targetDir, '.templateignore');
  const ignored = existsSync(ignorePath)
    ? readFileSync(ignorePath, 'utf-8')
        .split('\n')
        .map((l) => l.trim())
    : [];

  for (const file of FILES.filter((f) => !ignored.includes(f))) {
    mkdirSync(dirname(join(targetDir, file)), { recursive: true });
    copyFileSync(join(templateDir, file), join(targetDir, file));
  }

  const tpl = readJson(join(templateDir, 'package.json'));
  const pkgPath = join(targetDir, 'package.json');
  const pkg = readJson(pkgPath);

  pkg.dependencies ??= {};
  pkg.devDependencies ??= {};
  for (const section of ['dependencies', 'devDependencies']) {
    for (const [name, version] of Object.entries(tpl[section] ?? {})) {
      const owner = ['dependencies', 'devDependencies'].find((s) => name in pkg[s]);
      // Runtime deps are only bumped, never added: unused ones would fail knip.
      if (owner) pkg[owner][name] = version;
      else if (section === 'devDependencies') pkg.devDependencies[name] = version;
    }
  }
  pkg.scripts = { ...pkg.scripts, ...tpl.scripts };
  pkg.engines = tpl.engines;

  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [templateDir, targetDir] = process.argv.slice(2);
  if (!templateDir || !targetDir) {
    console.error('Usage: node scripts/sync.mjs <templateDir> <targetDir>');
    process.exit(1);
  }
  sync(templateDir, targetDir);
}
