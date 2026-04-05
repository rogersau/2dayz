import { loadConfig } from "./config";
import { createSocketServer } from "./network/createSocketServer";
import { createSessionRegistry } from "./network/sessionRegistry";
import { createRoomFactory } from "./rooms/roomFactory";
import { createRoomManager } from "./rooms/roomManager";
import { createServerRuntime } from "./runtime/serverRuntime";
import { createLogger } from "./telemetry/logger";

export const startServer = async () => {
  const config = loadConfig();
  const logger = createLogger();
  const roomManager = createRoomManager({
    roomCapacity: config.roomCapacity,
    createRoom: createRoomFactory({ roomCapacity: config.roomCapacity }),
  });
  const sessionRegistry = createSessionRegistry({ reclaimWindowMs: config.reclaimWindowMs, roomManager });
  const runtime = createServerRuntime({
    config,
    roomManager,
    createSocketServer: (server) => createSocketServer({ server, roomManager, sessionRegistry }),
  });
  const { server, socketServer } = await runtime.start();

  const shutdown = () => {
    void runtime.stop();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  logger.info("server-listening", { host: config.host, port: config.port });

  return { server, socketServer, roomManager, stop: runtime.stop };
};

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isEntrypoint) {
  void startServer();
}
