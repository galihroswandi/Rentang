import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env['CI'])

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      // The built app: what ships.
      name: 'build',
      testIgnore: 'dev-server.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
    },
    {
      // The Vite dev server: what `pnpm dev` serves. Dependencies are loaded unbundled there,
      // so a package that breaks only in the browser shows up here and not in the build.
      name: 'dev-server',
      testMatch: 'dev-server.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5175' },
    },
  ],
  webServer: [
    {
      command: 'pnpm build && pnpm preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !isCI,
    },
    {
      command: 'pnpm dev --port 5175 --strictPort',
      url: 'http://localhost:5175',
      reuseExistingServer: !isCI,
    },
  ],
})
