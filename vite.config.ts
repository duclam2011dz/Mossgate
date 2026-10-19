import { defineConfig } from 'vitest/config';
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { menu: 'index.html', editor: 'editor.html', game: 'game.html' },
    },
  },
  test: { include: ['tests/unit/**/*.test.ts', 'tests/smoke/**/*.test.ts'] },
});
