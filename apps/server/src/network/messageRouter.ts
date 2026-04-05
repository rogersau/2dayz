import type { RawData, WebSocket } from "ws";
import {
  joinRequestSchema,
  reconnectRequestSchema,
  roomJoinedMessageSchema,
  type JoinRequest,
  type ReconnectRequest,
} from "@2dayz/shared";

import type { RoomManager } from "../rooms/roomManager";
import type { SessionRegistry } from "./sessionRegistry";

type MessageRouterOptions = {
  roomManager: RoomManager;
  sessionRegistry: SessionRegistry;
};

type RouterConnection = {
  handleMessage(raw: RawData): void;
  handleClose(): void;
};

const parseMessage = (raw: RawData): JoinRequest | ReconnectRequest | null => {
  if (typeof raw !== "string" && !Buffer.isBuffer(raw)) {
    return null;
  }

  try {
    const message = JSON.parse(raw.toString()) as unknown;
    const parsedJoin = joinRequestSchema.safeParse(message);
    if (parsedJoin.success) {
      return parsedJoin.data;
    }

    const parsedReconnect = reconnectRequestSchema.safeParse(message);
    if (parsedReconnect.success) {
      return parsedReconnect.data;
    }
  } catch {
    return null;
  }

  return null;
};

export const createMessageRouter = ({ roomManager, sessionRegistry }: MessageRouterOptions) => {
  const sendRoomJoined = (socket: WebSocket, payload: {
    roomId: string;
    playerEntityId: string;
    sessionToken: string;
  }) => {
    const message = roomJoinedMessageSchema.parse({
      type: "room-joined",
      roomId: payload.roomId,
      playerEntityId: payload.playerEntityId,
      sessionToken: payload.sessionToken,
    });

    socket.send(JSON.stringify(message));
  };

  return {
    attach(socket: WebSocket): RouterConnection {
      let activeSessionToken: string | null = null;

      return {
        handleMessage(raw) {
          const message = parseMessage(raw);
          if (!message) {
            socket.send(JSON.stringify({ type: "error", reason: "invalid-message" }));
            return;
          }

          if (message.type === "join") {
            const assignment = roomManager.assignPlayer({ displayName: message.displayName });
            const session = sessionRegistry.createSession({
              displayName: message.displayName,
              roomId: assignment.roomId,
              playerEntityId: assignment.playerEntityId,
            });

            activeSessionToken = session.sessionToken;
            sendRoomJoined(socket, {
              roomId: assignment.roomId,
              playerEntityId: assignment.playerEntityId,
              sessionToken: session.sessionToken,
            });
            return;
          }

          const reclaimResult = sessionRegistry.reclaim(message.sessionToken);
          if (!reclaimResult.accepted) {
            socket.send(JSON.stringify({ type: "error", reason: reclaimResult.reason }));
            return;
          }

          activeSessionToken = reclaimResult.reservation.sessionToken;
          sendRoomJoined(socket, {
            roomId: reclaimResult.reservation.roomId,
            playerEntityId: reclaimResult.reservation.playerEntityId,
            sessionToken: reclaimResult.reservation.sessionToken,
          });
        },
        handleClose() {
          if (activeSessionToken) {
            sessionRegistry.markDisconnected(activeSessionToken);
          }
        },
      };
    },
  };
};
