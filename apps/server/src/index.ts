import { loadConfig } from "./config";
import { createSocketServer } from "./network/createSocketServer";
import { createSessionRegistry } from "./network/sessionRegistry";
import { createRoomFactory } from "./rooms/roomFactory";
import { createRoomManager } from "./rooms/roomManager";
import { createServerRuntime } from "./runtime/serverRuntime";
import { createLogger } from "./telemetry/logger";
import type { Logger } from "./telemetry/logger";
import type { ServerConfig } from "./config";
import type { ServerRuntime } from "./runtime/serverRuntime";

type SignalProcess = Pick<NodeJS.Process, "once" | "off">;

type StartServerDependencies = {
  config?: ServerConfig;
  logger?: Logger;
  signalProcess?: SignalProcess;
  createRuntime?: (options: {
    config: ServerConfig;
    roomManager: ReturnType<typeof createRoomManager>;
    createSocketServer: Parameters<typeof createServerRuntime>[0]["createSocketServer"];
  }) => ServerRuntime;
};

export const startServer = async ({
  config = loadConfig(),
  logger = createLogger(),
  signalProcess = process,
  createRuntime = createServerRuntime,
}: StartServerDependencies = {}) => {
  const roomManager = createRoomManager({
    roomCapacity: config.roomCapacity,
    createRoom: createRoomFactory({ roomCapacity: config.roomCapacity }),
  });
  const sessionRegistry = createSessionRegistry({ reclaimWindowMs: config.reclaimWindowMs, roomManager });
  const runtime = createRuntime({
    config,
    roomManager,
    createSocketServer: (server) => createSocketServer({ server, roomManager, sessionRegistry }),
  });
  const { server, socketServer } = await runtime.start();

  let stopped = false;

  const stop = async () => {
    if (stopped) {
      return;
    }

    stopped = true;
    signalProcess.off("SIGINT", shutdown);
    signalProcess.off("SIGTERM", shutdown);
    await runtime.stop();
  };

  const shutdown = () => {
    void stop();
  };

  signalProcess.once("SIGINT", shutdown);
  signalProcess.once("SIGTERM", shutdown);

  logger.info("server-listening", { host: config.host, port: config.port });

  return { server, socketServer, roomManager, stop };
};

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isEntrypoint) {
  void startServer();
}
