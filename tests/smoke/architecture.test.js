import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { PNG } from 'pngjs';
const sourceRoot = resolve('src');
const files = [];
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (path.endsWith('.js')) files.push(path);
  }
}
collect(sourceRoot);
it('keeps source dependencies acyclic and simulation independent of browser pages', () => {
  const graph = new Map(
    files.map((file) => [
      file,
      [
        ...readFileSync(file, 'utf8').matchAll(
          /(?:from\s*|import\s*)['"]([^'"]+)['"]/g,
        ),
      ]
        .map((m) => m[1])
        .filter((s) => s.startsWith('.'))
        .map((s) => resolve(dirname(file), s))
        .filter((p) => p.endsWith('.js')),
    ]),
  );
  const visiting = new Set(),
    visited = new Set();
  const visit = (file) => {
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
  expect(readdirSync(sourceRoot).filter((f) => f.endsWith('.js'))).toEqual([]);
});
it('ships separate page entrypoints and horizontally matching forest edges', () => {
  for (const [file, page] of [
    ['index.html', 'menu'],
    ['editor.html', 'editor'],
    ['game.html', 'game'],
  ]) {
    const html = readFileSync(file, 'utf8');
    expect(html).toContain(`/src/pages/${page}/entry.js`);
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
