import type { RawData, WebSocket } from "ws";
import {
  errorMessageSchema,
  joinRequestSchema,
  reconnectRequestSchema,
  roomJoinedMessageSchema,
  type ErrorReason,
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
  const sendError = (socket: WebSocket, reason: ErrorReason) => {
    const message = errorMessageSchema.parse({
      type: "error",
      reason,
    });

    socket.send(JSON.stringify(message));
  };

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
            sendError(socket, "invalid-message");
            return;
          }

          if (activeSessionToken) {
            sendError(socket, "session-active");
            return;
          }

          try {
            if (message.type === "join") {
              sessionRegistry.cleanupExpiredReservations();
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
              sendError(socket, reclaimResult.reason);
              return;
            }

            activeSessionToken = reclaimResult.reservation.sessionToken;
            sendRoomJoined(socket, {
              roomId: reclaimResult.reservation.roomId,
              playerEntityId: reclaimResult.reservation.playerEntityId,
              sessionToken: reclaimResult.reservation.sessionToken,
            });
          } catch {
            sendError(socket, "internal-error");
          }
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
