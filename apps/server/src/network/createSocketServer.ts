import type { Server as HttpServer } from "node:http";
import type { Socket } from "node:net";

import { WebSocketServer } from "ws";

import type { RoomManager } from "../rooms/roomManager";
import type { SessionRegistry } from "./sessionRegistry";
import { createMessageRouter } from "./messageRouter";
import type { Logger } from "../telemetry/logger";
import type { createMetricsTracker } from "../telemetry/metrics";
import { normalizeDisconnectReason } from "../telemetry/metrics";

type CreateSocketServerOptions = {
  server: HttpServer;
  roomManager: RoomManager;
  sessionRegistry: SessionRegistry;
  logger: Logger;
  metrics: ReturnType<typeof createMetricsTracker>;
  telemetryIntervalMs?: number;
};

export type ManagedSocketServer = {
  close(): void;
  server: WebSocketServer;
};

export const createSocketServer = ({ server, roomManager, sessionRegistry, logger, metrics, telemetryIntervalMs = 1_000 }: CreateSocketServerOptions): ManagedSocketServer => {
  const webSocketServer = new WebSocketServer({ noServer: true });
  const router = createMessageRouter({ roomManager, sessionRegistry });
  const sockets = new Set<Socket>();

  logger.info("server-telemetry", metrics.snapshot());
  const telemetryHandle = setInterval(() => {
    logger.info("server-telemetry", metrics.snapshot());
  }, telemetryIntervalMs);

  const handleUpgrade = (request: Parameters<HttpServer["emit"]>[1] & { url?: string }, socket: Socket, head: Buffer) => {
    if (request.url !== "/ws") {
      metrics.recordDisconnect("invalid-upgrade-path");
      socket.destroy();
      return;
    }

    sockets.add(socket);
    socket.on("close", () => {
      sockets.delete(socket);
    });

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      const connection = router.attach(webSocket);
      webSocket.on("message", (raw) => connection.handleMessage(raw));
      webSocket.on("close", (code, reason) => {
        const disconnectReason = normalizeDisconnectReason({ code, reason });
        metrics.recordDisconnect(disconnectReason);
        connection.handleClose(disconnectReason);
      });
    });
  };

  server.on("upgrade", handleUpgrade);

  return {
    server: webSocketServer,
    close() {
      server.off("upgrade", handleUpgrade);
      clearInterval(telemetryHandle);
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();
      webSocketServer.close();
    },
  };
};
