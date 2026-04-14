import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Load env files in the same order as mise (base .env first, then .env.local overrides)
loadEnv({ path: '.env', override: false });
loadEnv({ path: '.env.local', override: false });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // sequential — DB state must be predictable
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Dev server is started manually: `npm run dev`
  // Run tests with: `npm run e2e` or `npm run e2e:ui`
});
