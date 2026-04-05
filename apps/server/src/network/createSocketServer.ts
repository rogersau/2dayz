import type { Server as HttpServer } from "node:http";
import type { Socket } from "node:net";

import { WebSocketServer } from "ws";

import type { RoomManager } from "../rooms/roomManager";
import type { SessionRegistry } from "./sessionRegistry";
import { createMessageRouter } from "./messageRouter";

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
  const sockets = new Set<Socket>();

  const handleUpgrade = (request: Parameters<HttpServer["emit"]>[1] & { url?: string }, socket: Socket, head: Buffer) => {
    if (request.url !== "/ws") {
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
      webSocket.on("close", () => connection.handleClose());
    });
  };

  server.on("upgrade", handleUpgrade);

  return {
    server: webSocketServer,
    close() {
      server.off("upgrade", handleUpgrade);
      for (const socket of sockets) {
        socket.destroy();
      }
      sockets.clear();
      webSocketServer.close();
    },
  };
};
