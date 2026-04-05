import type { Server as HttpServer } from "node:http";

import { WebSocketServer } from "ws";

import type { RoomManager } from "../rooms/roomManager";
import type { SessionRegistry } from "./sessionRegistry";
import { createMessageRouter } from "./messageRouter";

type CreateSocketServerOptions = {
  server: HttpServer;
  roomManager: RoomManager;
  sessionRegistry: SessionRegistry;
};

export const createSocketServer = ({ server, roomManager, sessionRegistry }: CreateSocketServerOptions): WebSocketServer => {
  const webSocketServer = new WebSocketServer({ noServer: true });
  const router = createMessageRouter({ roomManager, sessionRegistry });

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/ws") {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      const connection = router.attach(webSocket);
      webSocket.on("message", (raw) => connection.handleMessage(raw));
      webSocket.on("close", () => connection.handleClose());
    });
  });

  return webSocketServer;
};
