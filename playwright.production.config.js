import { defineConfig } from '@playwright/test';
const review = process.env.MOSSGATE_REVIEW_BROWSERS === '1';
export default defineConfig({
  testDir: './tests/production',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4183/mossgate/',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(review
      ? [
          { name: 'firefox', use: { browserName: 'firefox' } },
          { name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run preview -- --port 4183 --strictPort --base /mossgate/',
    url: 'http://127.0.0.1:4183/mossgate/',
    reuseExistingServer: false,
  },
});
