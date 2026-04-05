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
import type { CreateRoom } from "./rooms/roomFactory";

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

const createTelemetryRoomFactory = (createRoom: CreateRoom, logger: Logger): CreateRoom => {
  return () => {
    const room = createRoom();
    let shutdownLogged = false;
    const originalShutdown = room.shutdown.bind(room);
    const originalTick = room.tick.bind(room);

    logger.info("room-created", {
      roomId: room.roomId,
      capacity: room.capacity,
    });

    room.shutdown = (reason) => {
      if (!shutdownLogged) {
        shutdownLogged = true;
        logger.info("room-shutdown", {
          roomId: room.roomId,
          reason: reason ?? "unspecified",
          playerCount: room.playerCount,
          status: room.status,
        });
      }

      originalShutdown(reason);
    };

    room.tick = () => {
      try {
        originalTick();
      } catch (error) {
        logger.error("room-runtime-error", {
          roomId: room.roomId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };

    return room;
  };
};

export const startServer = async ({
  config = loadConfig(),
  logger = createLogger(),
  signalProcess = process,
  createRuntime = createServerRuntime,
}: StartServerDependencies = {}) => {
  const createRoom = createTelemetryRoomFactory(createRoomFactory({ roomCapacity: config.roomCapacity }), logger);
  const roomManager = createRoomManager({
    roomCapacity: config.roomCapacity,
    createRoom,
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
