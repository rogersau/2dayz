import { createServer, type Server as HttpServer } from "node:http";

import type { RoomManager } from "../rooms/roomManager";
import { createRoomHealthSnapshot } from "../rooms/roomHealth";

type CreateHttpServerOptions = {
  roomManager: RoomManager;
  startedAt: number;
};

export const createHttpServer = ({ roomManager, startedAt }: CreateHttpServerOptions): HttpServer => {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const payload = createRoomHealthSnapshot(roomManager, Math.floor((Date.now() - startedAt) / 1000));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not-found" }));
  });
};
