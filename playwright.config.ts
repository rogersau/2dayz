import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

const requestedClientPort = Number(process.env.CLIENT_PORT ?? 3200);
const requestedServerPort = Number(process.env.PORT ?? 3201);

const listListeningPorts = () => {
  const output = execFileSync("ss", ["-H", "-ltn"], { encoding: "utf8" });
  const ports = new Set<number>();

  for (const line of output.split("\n")) {
    const columns = line.trim().split(/\s+/);
    const localAddress = columns[3];

    if (!localAddress) {
      continue;
    }

    const port = Number(localAddress.slice(localAddress.lastIndexOf(":") + 1));

    if (Number.isFinite(port)) {
      ports.add(port);
    }
  }

  return ports;
};

const resolvePortPair = () => {
  if (process.env.CLIENT_PORT && process.env.PORT) {
    return {
      clientPort: requestedClientPort,
      serverPort: requestedServerPort,
    };
  }

  if (process.env.CLIENT_PORT) {
    const listeningPorts = listListeningPorts();

    for (let candidate = requestedServerPort; candidate < requestedServerPort + 50; candidate += 1) {
      if (candidate !== requestedClientPort && !listeningPorts.has(candidate)) {
        return {
          clientPort: requestedClientPort,
          serverPort: candidate,
        };
      }
    }

    throw new Error("No open server port available for Playwright.");
  }

  if (process.env.PORT) {
    const listeningPorts = listListeningPorts();

    for (let candidate = requestedClientPort; candidate < requestedClientPort + 50; candidate += 1) {
      if (candidate !== requestedServerPort && !listeningPorts.has(candidate)) {
        return {
          clientPort: candidate,
          serverPort: requestedServerPort,
        };
      }
    }

    throw new Error("No open client port available for Playwright.");
  }

  const listeningPorts = listListeningPorts();

  if (!listeningPorts.has(requestedClientPort) && !listeningPorts.has(requestedServerPort)) {
    return {
      clientPort: requestedClientPort,
      serverPort: requestedServerPort,
    };
  }

  const fallbackBase = 43_000 + ((process.ppid % 1000) * 2);

  for (let offset = 0; offset < 100; offset += 2) {
    const clientPort = fallbackBase + offset;
    const serverPort = clientPort + 1;

    if (!listeningPorts.has(clientPort) && !listeningPorts.has(serverPort)) {
      return { clientPort, serverPort };
    }
  }

  throw new Error("No open client/server port pair available.");
};

const portsStateFile = process.env._2DAYZ_PLAYWRIGHT_PORTS_FILE
  ?? join(tmpdir(), `2dayz-playwright-ports-${process.pid}.json`);

const resolvedPorts = (() => {
  if (process.env.CLIENT_PORT && process.env.PORT) {
    return {
      clientPort: Number(process.env.CLIENT_PORT),
      serverPort: Number(process.env.PORT),
    };
  }

  if (existsSync(portsStateFile)) {
    const parsed = JSON.parse(readFileSync(portsStateFile, "utf8")) as {
      clientPort: number;
      serverPort: number;
    };

    return parsed;
  }

  const ports = resolvePortPair();
  writeFileSync(portsStateFile, JSON.stringify(ports), "utf8");
  return ports;
})();

process.env._2DAYZ_PLAYWRIGHT_PORTS_FILE = portsStateFile;
process.env.CLIENT_PORT ??= String(resolvedPorts.clientPort);
process.env.PORT ??= String(resolvedPorts.serverPort);

const clientPort = Number(process.env.CLIENT_PORT);
const serverPort = Number(process.env.PORT);
const baseURL = `http://127.0.0.1:${serverPort}`;
const serialiseForPerformanceSpec = process.argv.some((argument) => argument.includes("client-performance.spec.ts"));

export default defineConfig({
  testDir: "./apps/client/e2e",
  timeout: 30_000,
  workers: serialiseForPerformanceSpec ? 1 : undefined,
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
