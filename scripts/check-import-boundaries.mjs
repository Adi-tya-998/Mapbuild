import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(root, 'src');
const config = JSON.parse(readFileSync(resolve(root, 'import-boundaries.json'), 'utf8'));
const allowed = new Set(config.allowedInternalImports.map(({ from, to }) => `${from} -> ${to}`));

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

function sourcePath(path) {
  return relative(root, path).split(sep).join('/');
}

function resolveImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')];
  return candidates.find((candidate) => {
    try { return statSync(candidate).isFile(); } catch { return false; }
  }) ?? null;
}

function featureOf(path) {
  const rel = relative(sourceRoot, path).split(sep);
  return rel[0] === 'features' && rel.length > 1 ? rel[1] : null;
}

function isShared(path) {
  return relative(sourceRoot, path).split(sep)[0] === 'shared';
}

function isAppModule(path) {
  const rel = relative(sourceRoot, path).split(sep);
  return rel[0] === 'app' || (rel.length === 1 && ['App.tsx', 'main.tsx'].includes(rel[0]));
}

function isFeatureEntry(path) {
  return /[\\/]features[\\/][^\\/]+[\\/]index\.tsx?$/.test(path);
}

const violations = [];
for (const file of sourceFiles(sourceRoot)) {
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const statement of ast.statements) {
    if ((!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) || !statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const target = resolveImport(file, statement.moduleSpecifier.text);
    if (!target) continue;

    const fromFeature = featureOf(file);
    const toFeature = featureOf(target);

    if (fromFeature && isAppModule(target)) {
      violations.push(`${sourcePath(file)} -> ${sourcePath(target)} (features must not import application modules)`);
      continue;
    }

    if (isShared(file) && toFeature) {
      violations.push(`${sourcePath(file)} -> ${sourcePath(target)} (shared code must not import features)`);
      continue;
    }

    if (!toFeature || isFeatureEntry(target) || fromFeature === toFeature) continue;

    const pair = `${sourcePath(file)} -> ${sourcePath(target)}`;
    if (!allowed.has(pair)) violations.push(`${pair} (import through src/features/${toFeature}/index.ts)`);
  }
}

assert.equal(
  violations.length,
  0,
  `${violations.length} feature boundary violation(s):\n${violations.map((violation) => `- ${violation}`).join('\n')}`,
);
process.stdout.write(`Feature import boundaries passed (${allowed.size} documented exception).\n`);
