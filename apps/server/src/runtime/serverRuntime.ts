import type { Server as HttpServer } from "node:http";

import type { ServerConfig } from "../config";
import { createHttpServer as buildHttpServer } from "../http/createHttpServer";
import type { ManagedSocketServer } from "../network/createSocketServer";
import type { RoomManager } from "../rooms/roomManager";

type CreateServerRuntimeOptions = {
  config: ServerConfig;
  roomManager: RoomManager;
  createSocketServer: (server: HttpServer) => ManagedSocketServer;
  createHttpServer?: () => HttpServer;
  tickIntervalMs?: number;
};

export type StartedServerRuntime = {
  server: HttpServer;
  socketServer: ManagedSocketServer;
};

export type ServerRuntime = {
  start(): Promise<StartedServerRuntime>;
  stop(): Promise<void>;
};

const closeHttpServer = async (server: HttpServer): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

export const createServerRuntime = ({
  config,
  roomManager,
  createSocketServer,
  createHttpServer,
  tickIntervalMs = 1_000,
}: CreateServerRuntimeOptions): ServerRuntime => {
  const server = (createHttpServer ?? (() => buildHttpServer({ roomManager, startedAt: Date.now() })))();
  const socketServer = createSocketServer(server);
  let tickHandle: ReturnType<typeof setInterval> | null = null;

  return {
    async start() {
      await new Promise<void>((resolve) => {
        server.listen(config.port, config.host, () => resolve());
      });

      tickHandle = setInterval(() => {
        roomManager.tickAllRooms();
      }, tickIntervalMs);

      return { server, socketServer };
    },
    async stop() {
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }

      socketServer.close();
      await closeHttpServer(server);
    },
  };
};
