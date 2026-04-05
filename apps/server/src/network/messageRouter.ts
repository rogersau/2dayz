import type { RawData, WebSocket } from "ws";
import {
  inputMessageSchema,
  errorMessageSchema,
  joinRequestSchema,
  reconnectRequestSchema,
  roomJoinedMessageSchema,
  type ErrorReason,
  type InputMessage,
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

const parseMessage = (raw: RawData): JoinRequest | ReconnectRequest | InputMessage | null => {
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

    const parsedInput = inputMessageSchema.safeParse(message);
    if (parsedInput.success) {
      return parsedInput.data;
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
      let activeRoomId: string | null = null;
      let activePlayerEntityId: string | null = null;
      let unsubscribeRoomUpdates: (() => void) | null = null;

      const subscribeToRoomUpdates = (roomId: string, playerEntityId: string): void => {
        unsubscribeRoomUpdates?.();
        unsubscribeRoomUpdates = null;

        const room = roomManager.getRoomRuntime(roomId);
        unsubscribeRoomUpdates = room?.subscribePlayerUpdates?.(playerEntityId, {
          onSnapshot(snapshot) {
            socket.send(JSON.stringify(snapshot));
          },
          onDelta(delta) {
            socket.send(JSON.stringify(delta));
          },
        }) ?? null;
      };

      return {
        handleMessage(raw) {
          const message = parseMessage(raw);
          if (!message) {
            sendError(socket, "invalid-message");
            return;
          }

          try {
            if (message.type === "join") {
              if (activeSessionToken) {
                sendError(socket, "session-active");
                return;
              }

              sessionRegistry.cleanupExpiredReservations();
              const assignment = roomManager.assignPlayer({ displayName: message.displayName });
              const session = sessionRegistry.createSession({
                displayName: message.displayName,
                roomId: assignment.roomId,
                playerEntityId: assignment.playerEntityId,
              });

              activeSessionToken = session.sessionToken;
              activeRoomId = assignment.roomId;
              activePlayerEntityId = assignment.playerEntityId;
              sendRoomJoined(socket, {
                roomId: assignment.roomId,
                playerEntityId: assignment.playerEntityId,
                sessionToken: session.sessionToken,
              });
              subscribeToRoomUpdates(assignment.roomId, assignment.playerEntityId);
              return;
            }

            if (message.type === "reconnect") {
              if (activeSessionToken) {
                sendError(socket, "session-active");
                return;
              }

              const reclaimResult = sessionRegistry.reclaim(message.sessionToken);
              if (!reclaimResult.accepted) {
                sendError(socket, reclaimResult.reason);
                return;
              }

              activeSessionToken = reclaimResult.reservation.sessionToken;
              activeRoomId = reclaimResult.reservation.roomId;
              activePlayerEntityId = reclaimResult.reservation.playerEntityId;
              sendRoomJoined(socket, {
                roomId: reclaimResult.reservation.roomId,
                playerEntityId: reclaimResult.reservation.playerEntityId,
                sessionToken: reclaimResult.reservation.sessionToken,
              });
              subscribeToRoomUpdates(reclaimResult.reservation.roomId, reclaimResult.reservation.playerEntityId);
              return;
            }

            if (!activeSessionToken || !activeRoomId || !activePlayerEntityId) {
              sendError(socket, "invalid-message");
              return;
            }

            const room = roomManager.getRoomRuntime(activeRoomId);
            room?.queueInput?.(activePlayerEntityId, {
              sequence: message.sequence,
              movement: message.movement,
              aim: message.aim,
              actions: message.actions,
            });
          } catch {
            sendError(socket, "internal-error");
          }
        },
        handleClose() {
          unsubscribeRoomUpdates?.();
          unsubscribeRoomUpdates = null;
          if (activeSessionToken) {
            sessionRegistry.markDisconnected(activeSessionToken);
          }
        },
      };
    },
  };
};
