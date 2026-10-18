import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { menu: 'index.html', editor: 'editor.html', game: 'game.html' },
    },
  },
  test: { include: ['tests/unit/**/*.test.js', 'tests/smoke/**/*.test.js'] },
});
