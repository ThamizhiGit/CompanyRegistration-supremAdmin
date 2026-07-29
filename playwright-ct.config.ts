import { defineConfig, devices } from '@playwright/experimental-ct-react';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './component-tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  outputDir: 'test-results/ct',
  reporter: [['html', { outputFolder: 'playwright-report/ct', open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ctPort: 3100,
    ctViteConfig: {
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': configDirectory,
        },
      },
    },
  },
});
