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

import { createDeltaMessage, createSnapshotMessage } from "./roomMessages";
import type { RoomManager } from "../rooms/roomManager";
import type { RoomRuntime } from "../rooms/roomRuntime";
import type { SessionRegistry } from "./sessionRegistry";
import { createReplicationSystem } from "../sim/systems/replicationSystem";

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
  const replication = createReplicationSystem();

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
      let activePlayerEntityId: string | null = null;
      let activeRoom: RoomRuntime | null = null;
      let unsubscribeRoomUpdates: (() => void) | null = null;
      let initialSnapshotSent = false;

      const subscribeToRoomUpdates = (room: RoomRuntime, playerEntityId: string): void => {
        unsubscribeRoomUpdates?.();
        unsubscribeRoomUpdates = null;
        initialSnapshotSent = false;

        unsubscribeRoomUpdates = room.subscribePlayer(playerEntityId, {
          onSnapshot(snapshot) {
            if (initialSnapshotSent) {
              return;
            }

            initialSnapshotSent = true;
            socket.send(JSON.stringify(createSnapshotMessage(room.roomId, replication.createInitialSnapshot(snapshot))));
          },
          onDelta(delta) {
            socket.send(JSON.stringify(createDeltaMessage(room.roomId, replication.createDelta(delta))));
          },
        });
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
              activePlayerEntityId = assignment.playerEntityId;
              activeRoom = assignment.runtime;
              sendRoomJoined(socket, {
                roomId: assignment.roomId,
                playerEntityId: assignment.playerEntityId,
                sessionToken: session.sessionToken,
              });
              subscribeToRoomUpdates(assignment.runtime, assignment.playerEntityId);
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
              activePlayerEntityId = reclaimResult.reservation.playerEntityId;
              activeRoom = reclaimResult.runtime;
              sendRoomJoined(socket, {
                roomId: reclaimResult.roomId,
                playerEntityId: reclaimResult.playerEntityId,
                sessionToken: reclaimResult.reservation.sessionToken,
              });
              subscribeToRoomUpdates(reclaimResult.runtime, reclaimResult.playerEntityId);
              return;
            }

            if (!activeSessionToken || !activeRoom || !activePlayerEntityId) {
              sendError(socket, "invalid-message");
              return;
            }

            activeRoom.queueInput(activePlayerEntityId, {
              sequence: message.sequence,
              movement: message.movement,
              aim: message.aim,
              actions: message.actions,
            });
          } catch {
            sendError(socket, "internal-error");
          }
        },
        handleClose(_reason) {
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
