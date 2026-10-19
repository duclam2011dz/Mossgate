import ts from 'typescript';
import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { PNG } from 'pngjs';
const sourceRoot = resolve('src');
const files: string[] = [];
function collect(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) files.push(path);
  }
}
collect(sourceRoot);
it('keeps source dependencies acyclic and simulation independent of browser pages', () => {
  const graph = new Map(
    files.map((file) => [
      file,
      ts
        .createSourceFile(
          file,
          readFileSync(file, 'utf8'),
          ts.ScriptTarget.Latest,
          true,
        )
        .statements.filter(ts.isImportDeclaration)
        .filter((statement) => !statement.importClause?.isTypeOnly)
        .map((statement) =>
          ts.isStringLiteral(statement.moduleSpecifier)
            ? statement.moduleSpecifier.text
            : '',
        )
        .filter((path) => path.startsWith('.'))
        .map((path) => resolve(dirname(file), path))
        .filter((path) => path.endsWith('.ts')),
    ]),
  );
  const visiting = new Set(),
    visited = new Set();
  const visit = (file: string) => {
    expect(
      visiting.has(file),
      relative(sourceRoot, file) + ' import cycle',
    ).toBe(false);
    if (visited.has(file)) return;
    visiting.add(file);
    for (const next of graph.get(file) || []) visit(next);
    visiting.delete(file);
    visited.add(file);
  };
  for (const file of files) {
    visit(file);
    const name = relative(sourceRoot, file).replaceAll('\\', '/');
    if (/^(domain|simulation|shared)\//.test(name)) {
      for (const next of graph.get(file) || [])
        expect(relative(sourceRoot, next).replaceAll('\\', '/')).not.toMatch(
          /^(pages|editor|infrastructure|rendering)\//,
        );
      expect(readFileSync(file, 'utf8')).not.toMatch(
        /\b(document|window|CanvasRenderingContext2D|sessionStorage)\b/,
      );
    }
    if (name.startsWith('domain/'))
      for (const next of graph.get(file) || [])
        expect(relative(sourceRoot, next)).not.toMatch(/^simulation/);
  }
  expect(readdirSync(sourceRoot).filter((f) => f.endsWith('.ts'))).toEqual([]);
});
it('ships separate page entrypoints and horizontally matching forest edges', () => {
  for (const [file, page] of [
    ['index.html', 'menu'],
    ['editor.html', 'editor'],
    ['game.html', 'game'],
  ] satisfies [string, string][]) {
    const html = readFileSync(file, 'utf8');
    expect(html).toContain(`/src/pages/${page}/entry.ts`);
    expect(html).toContain(`/src/pages/${page}/style.css`);
  }
  for (const layer of ['sky', 'distant', 'midground', 'near']) {
    const image = PNG.sync.read(
      readFileSync(`public/assets/background-${layer}.png`),
    );
    for (let y = 0; y < image.height; y++)
      expect(
        image.data.subarray(y * image.width * 4, y * image.width * 4 + 4),
      ).toEqual(
        image.data.subarray(
          (y * image.width + image.width - 1) * 4,
          (y * image.width + image.width) * 4,
        ),
      );
  }
});

it('has no forgotten JavaScript and checks every TypeScript file', () => {
  const owned: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (
        [
          'node_modules',
          'dist',
          '.git',
          'output',
          'test-results',
          'playwright-report',
        ].includes(entry.name)
      )
        continue;
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:[cm]?js|ts)$/.test(path)) owned.push(path);
    }
  };
  walk('.');
  expect(owned.filter((file) => /\.[cm]?js$/.test(file))).toEqual([]);
  const covered = new Set<string>();
  for (const name of ['domain', 'browser', 'tooling']) {
    const file = `tsconfig.${name}.json`,
      config = ts.readConfigFile(file, (path) => ts.sys.readFile(path));
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
    expect(parsed.errors).toEqual([]);
    for (const path of parsed.fileNames) covered.add(resolve(path));
    expect(parsed.options.strict).toBe(true);
    expect(parsed.options.skipLibCheck).toBe(false);
  }
  expect(
    owned.filter((file) => file.endsWith('.ts') && !covered.has(file)),
  ).toEqual([]);
});

it('keeps asset generator groups independent above their shared core', () => {
  for (const name of [
    'terrain',
    'player',
    'effects',
    'background',
    'entities',
  ]) {
    const file = readFileSync(`scripts/assets/${name}.ts`, 'utf8');
    const imports = ts
      .createSourceFile(name, file, ts.ScriptTarget.Latest, true)
      .statements.filter(ts.isImportDeclaration);
    for (const statement of imports)
      if (ts.isStringLiteral(statement.moduleSpecifier)) {
        const path = statement.moduleSpecifier.text;
        if (path.startsWith('.'))
          expect(path).toMatch(/^(\.\/core\/|\.\.\/\.\.\/src\/shared\/)/);
      }
  }
});
