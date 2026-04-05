import { defineConfig } from "@playwright/test";

const clientPort = Number(process.env.CLIENT_PORT ?? 3200);
const serverPort = Number(process.env.PORT ?? 3201);
const baseURL = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  testDir: "./apps/client/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `VITE_CLIENT_SOCKET_MODE=ws pnpm --filter @2dayz/client exec vite --config vite.config.ts --host 127.0.0.1 --port ${clientPort}`,
      url: `http://127.0.0.1:${clientPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @2dayz/server exec tsx src/index.ts`,
      url: `${baseURL}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        CLIENT_ORIGIN: `http://127.0.0.1:${clientPort}`,
        HOST: "127.0.0.1",
        PORT: String(serverPort),
      },
    },
  ],
});
