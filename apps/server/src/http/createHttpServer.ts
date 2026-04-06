import { createServer, request as makeRequest, type IncomingMessage, type RequestOptions, type Server as HttpServer, type ServerResponse } from "node:http";

import { SERVER_TICK_RATE } from "@2dayz/shared";
import type { RoomManager } from "../rooms/roomManager";
import { createRoomHealthSnapshot } from "../rooms/roomHealth";

type CreateHttpServerOptions = {
  clientOrigin?: string;
  roomManager: RoomManager;
  startedAt: number;
};

const getProxyRequestOptions = (request: IncomingMessage, clientOrigin: URL): RequestOptions => {
  return {
    hostname: clientOrigin.hostname,
    port: clientOrigin.port,
    protocol: clientOrigin.protocol,
    method: request.method,
    path: request.url,
    headers: request.headers,
  };
};

const pipeProxyResponse = (proxyResponse: IncomingMessage, response: ServerResponse): void => {
  response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
  proxyResponse.pipe(response);
};

const proxyToClient = (request: IncomingMessage, response: ServerResponse, clientOrigin: URL): void => {
  const proxyRequest = makeRequest(getProxyRequestOptions(request, clientOrigin), (proxyResponse) => {
    pipeProxyResponse(proxyResponse, response);
  });

  proxyRequest.on("error", () => {
    response.writeHead(502, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "client-unavailable" }));
  });

  request.pipe(proxyRequest);
};

export const createHttpServer = ({ clientOrigin = process.env.CLIENT_ORIGIN, roomManager, startedAt }: CreateHttpServerOptions): HttpServer => {
  const resolvedClientOrigin = clientOrigin ? new URL(clientOrigin) : null;

  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const payload = {
        ...createRoomHealthSnapshot(roomManager, Math.floor((Date.now() - startedAt) / 1000)),
        roomCount: roomManager.getRoomCount(),
        rooms: roomManager.getRoomSummaries(),
        tickRateHz: SERVER_TICK_RATE,
      };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
      return;
    }

    if (resolvedClientOrigin && request.url !== "/ws") {
      proxyToClient(request, response, resolvedClientOrigin);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not-found" }));
  });
};
