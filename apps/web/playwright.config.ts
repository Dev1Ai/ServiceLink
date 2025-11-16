import { defineConfig } from "@playwright/test";

process.env.E2E_API_PORT = process.env.E2E_API_PORT ?? "3001";
process.env.E2E_API_BASE =
  process.env.E2E_API_BASE ?? `http://127.0.0.1:${process.env.E2E_API_PORT}`;

export default defineConfig({
  testDir: "./tests",
  retries: process.env.CI ? 1 : 0, // retry once in CI, none locally
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: process.env.CI ? "only-on-failure" : "off",
    video: process.env.CI ? "retain-on-failure" : "off",
    trace: process.env.CI ? "retain-on-failure" : "off",
  },
  webServer: [
    {
      command: "pnpm --filter api dev",
      env: {
        NODE_ENV: "test",
        PORT: process.env.E2E_API_PORT ?? "3001",
        DATABASE_URL:
          process.env.E2E_DATABASE_URL ??
          process.env.DATABASE_URL ??
          "postgresql://postgres:postgres@localhost:5432/servicelink",
        JWT_SECRET: process.env.E2E_JWT_SECRET ?? "playwright-secret",
        REMINDER_WORKER_ENABLED: "false",
        SEARCH_RATE_DISABLE: "true",
        AUTH_LOGIN_RATE_LIMIT: process.env.E2E_AUTH_LOGIN_LIMIT ?? "1",
      },
      port: Number(process.env.E2E_API_PORT ?? 3001),
      reuseExistingServer: !process.env.CI,
      timeout: 180 * 1000,
    },
    {
      // run the production server under strict CSP for parity with hosting
      command: "pnpm start",
      env: {
        HOST: "127.0.0.1",
        PORT: "3100",
        ENABLE_STRICT_CSP: "true",
        CSP_ALLOW_HTTP: "true",
        SEARCH_RATE_DISABLE: "true",
        NEXT_PUBLIC_API_BASE_URL:
          process.env.E2E_API_BASE ?? "http://127.0.0.1:3001",
      },
      port: 3100,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
