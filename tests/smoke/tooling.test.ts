import { it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Guards } from '../../src/shared/guards.ts';
it('locks CLI paths to files shipped by the installed dependency packages', () => {
  const lock: unknown = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  if (!Guards.record(lock) || !Guards.record(lock.packages))
    throw new Error('Invalid lockfile');
  for (const name of [
    'eslint',
    'vite',
    '@playwright/test',
    'playwright',
    'playwright-core',
    'tsx',
    'typescript',
    'prettier',
    'vitest',
  ]) {
    const path = `node_modules/${name}`,
      entry = lock.packages[path];
    if (!Guards.record(entry) || !Guards.record(entry.bin))
      throw new Error(`Missing CLI metadata: ${name}`);
    for (const target of Object.values(entry.bin)) {
      if (typeof target !== 'string')
        throw new Error(`Invalid CLI path: ${name}`);
      expect(existsSync(resolve(path, target)), `${name}: ${target}`).toBe(
        true,
      );
    }
  }
});
