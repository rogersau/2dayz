import type { Server as HttpServer } from "node:http";
import type { Socket } from "node:net";

import { WebSocketServer } from "ws";

import type { RoomManager } from "../rooms/roomManager";
import { SERVER_TICK_RATE } from "@2dayz/shared";
import type { SessionRegistry } from "./sessionRegistry";
import { createMessageRouter } from "./messageRouter";
import { createLogger } from "../telemetry/logger";
import { createMetricsTracker } from "../telemetry/metrics";

type CreateSocketServerOptions = {
  server: HttpServer;
  roomManager: RoomManager;
  sessionRegistry: SessionRegistry;
};

export type ManagedSocketServer = {
  close(): void;
  server: WebSocketServer;
};

export const createSocketServer = ({ server, roomManager, sessionRegistry }: CreateSocketServerOptions): ManagedSocketServer => {
  const webSocketServer = new WebSocketServer({ noServer: true });
  const router = createMessageRouter({ roomManager, sessionRegistry });
  const logger = createLogger();
  const metrics = createMetricsTracker(roomManager, { tickRateHz: SERVER_TICK_RATE });
  const sockets = new Set<Socket>();
  const originalTickAllRooms = roomManager.tickAllRooms.bind(roomManager);

  roomManager.tickAllRooms = () => {
    const startedAt = performance.now();

    try {
      originalTickAllRooms();
    } finally {
      metrics.recordTickDuration(performance.now() - startedAt);
    }
  };

  logger.info("server-telemetry", metrics.snapshot());
  const telemetryHandle = setInterval(() => {
    logger.info("server-telemetry", metrics.snapshot());
  }, 1_000);

  const describeDisconnectReason = (code: number, reason: Buffer): string => {
    const text = reason.toString().trim();
    if (text.length > 0) {
      return text;
    }

    if (code === 1000) {
      return "client-close";
    }

    return `ws-close-${code}`;
  };

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
        const disconnectReason = describeDisconnectReason(code, reason);
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
      roomManager.tickAllRooms = originalTickAllRooms;
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();
      webSocketServer.close();
    },
  };
};
