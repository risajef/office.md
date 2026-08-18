import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const configuredChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH
const localChromium = existsSync('/snap/bin/chromium')
  ? '/snap/bin/chromium'
  : undefined
const executablePath = configuredChromium || localChromium

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    acceptDownloads: true,
    headless: true,
    launchOptions: {
      executablePath,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
