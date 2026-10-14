import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const basePath = process.env.PLAYWRIGHT_BASE_PATH ?? '/';
const baseURL = `http://127.0.0.1:5174${basePath}`;
const preview = process.env.PLAYWRIGHT_PREVIEW === '1';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 30_000,
  use: { baseURL, trace: 'retain-on-failure', launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync(chrome) ? chrome : undefined) } },
  webServer: { command: preview ? 'npm run preview -- --port 5174 --strictPort' : 'npm run dev -- --port 5174 --strictPort --force', env: { VITE_BASE_PATH: basePath }, url: baseURL, reuseExistingServer: false },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }, { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } }],
});
