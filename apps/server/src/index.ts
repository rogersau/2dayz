import { loadConfig } from "./config";
import { createHttpServer } from "./http/createHttpServer";
import { createSessionRegistry } from "./network/sessionRegistry";
import { createSocketServer } from "./network/createSocketServer";
import { createRoomFactory } from "./rooms/roomFactory";
import { createRoomManager } from "./rooms/roomManager";
import { createLogger } from "./telemetry/logger";

export const startServer = async () => {
  const config = loadConfig();
  const logger = createLogger();
  const roomManager = createRoomManager({
    roomCapacity: config.roomCapacity,
    createRoom: createRoomFactory({ roomCapacity: config.roomCapacity }),
  });
  const sessionRegistry = createSessionRegistry({ reclaimWindowMs: config.reclaimWindowMs });
  const server = createHttpServer({ roomManager, startedAt: Date.now() });

  createSocketServer({ server, roomManager, sessionRegistry });

  await new Promise<void>((resolve) => {
    server.listen(config.port, config.host, () => resolve());
  });

  logger.info("server-listening", { host: config.host, port: config.port });

  return { server, roomManager };
};

const isEntrypoint = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isEntrypoint) {
  void startServer();
}
