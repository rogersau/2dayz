import type { Server as HttpServer } from "node:http";

import { SERVER_TICK_RATE } from "@2dayz/shared";

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
  onTickDuration?: (durationMs: number) => void;
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
  tickIntervalMs = 1_000 / SERVER_TICK_RATE,
  onTickDuration,
}: CreateServerRuntimeOptions): ServerRuntime => {
  let server: HttpServer | null = null;
  let socketServer: ManagedSocketServer | null = null;
  let tickHandle: ReturnType<typeof setInterval> | null = null;

  const stopTicking = (): void => {
    if (tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  };

  return {
    async start() {
      server = (createHttpServer ?? (() => buildHttpServer({ roomManager, startedAt: Date.now() })))();
      socketServer = createSocketServer(server);

      try {
        await new Promise<void>((resolve, reject) => {
          const handleError = (error: Error) => {
            server?.off("error", handleError);
            reject(error);
          };

          server?.once("error", handleError);
          server?.listen(config.port, config.host, () => {
            server?.off("error", handleError);
            resolve();
          });
        });

        tickHandle = setInterval(() => {
          const startedAt = performance.now();

          try {
            roomManager.tickAllRooms();
          } finally {
            onTickDuration?.(performance.now() - startedAt);
          }
        }, tickIntervalMs);

        return { server, socketServer };
      } catch (error) {
        stopTicking();
        socketServer.close();
        try {
          await closeHttpServer(server);
        } catch {
          // ignore close errors during startup rollback
        }
        socketServer = null;
        server = null;
        throw error;
      }
    },
    async stop() {
      stopTicking();

      if (!server || !socketServer) {
        return;
      }

      socketServer.close();
      await closeHttpServer(server);
      socketServer = null;
      server = null;
    },
  };
};
