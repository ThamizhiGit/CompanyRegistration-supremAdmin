import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'mocked-chromium',
      testIgnore: /integration[\\/]/,
      use: (() => {
        const { deviceScaleFactor, ...desktopChrome } = devices['Desktop Chrome'];
        return {
          ...desktopChrome,
          channel: 'chrome',
          viewport: null,
          launchOptions: {
            args: ['--start-maximized'],
          },
        };
      })(),
    },
    {
      name: 'real-backend-chromium',
      testMatch: /integration[\\/].*\.spec\.ts/,
      use: (() => {
        const { deviceScaleFactor, ...desktopChrome } = devices['Desktop Chrome'];
        return {
          ...desktopChrome,
          channel: 'chrome',
          viewport: null,
          launchOptions: {
            args: ['--start-maximized'],
          },
        };
      })(),
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_GRAPHQL_URI:
        process.env.SUPREME_E2E_GRAPHQL_URI || 'http://localhost:8000/graphql/',
    },
  },
});
