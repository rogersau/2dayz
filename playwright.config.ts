import { execFileSync } from "node:child_process";

import { defineConfig } from "@playwright/test";

const requestedClientPort = Number(process.env.CLIENT_PORT ?? 3200);
const requestedServerPort = Number(process.env.PORT ?? 3201);

const findOpenPort = (startPort: number, blockedPorts: Set<number>) => {
  const blockedPortList = [...blockedPorts].join(",");
  const script = `
const net = require("node:net");

const startPort = Number(process.argv[1]);
const blockedPorts = new Set((process.argv[2] || "").split(",").filter(Boolean).map(Number));

const tryPort = (port) => {
  if (port >= startPort + 50) {
    process.exit(1);
  }

  if (blockedPorts.has(port)) {
    tryPort(port + 1);
    return;
  }

  const server = net.createServer();
  server.unref();
  server.once("error", () => tryPort(port + 1));
  server.listen({ host: "127.0.0.1", port }, () => {
    server.close(() => process.stdout.write(String(port)));
  });
};

tryPort(startPort);
`;

  const result = execFileSync(process.execPath, ["-e", script, String(startPort), blockedPortList], {
    encoding: "utf8",
  }).trim();

  if (!result) {
    throw new Error(`No open local port found starting at ${startPort}.`);
  }

  return Number(result);
};

const resolvePortPair = () => {
  if (process.env.CLIENT_PORT && process.env.PORT) {
    return {
      clientPort: requestedClientPort,
      serverPort: requestedServerPort,
    };
  }

  if (process.env.CLIENT_PORT) {
    return {
      clientPort: requestedClientPort,
      serverPort: findOpenPort(requestedServerPort, new Set([requestedClientPort])),
    };
  }

  if (process.env.PORT) {
    return {
      clientPort: findOpenPort(requestedClientPort, new Set([requestedServerPort])),
      serverPort: requestedServerPort,
    };
  }

  for (let clientStart = requestedClientPort; clientStart < requestedClientPort + 50; clientStart += 2) {
    const clientPort = findOpenPort(clientStart, new Set());
    const serverPort = findOpenPort(requestedServerPort, new Set([clientPort]));

    if (serverPort !== clientPort) {
      return { clientPort, serverPort };
    }
  }

  throw new Error("No open client/server port pair available.");
};

const resolvedPorts = resolvePortPair();

process.env.CLIENT_PORT ??= String(resolvedPorts.clientPort);
process.env.PORT ??= String(resolvedPorts.serverPort);

const clientPort = Number(process.env.CLIENT_PORT);
const serverPort = Number(process.env.PORT);
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
