import type { RawData, WebSocket } from "ws";

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

type JoinMessage = {
  type: "join";
  displayName: string;
};

type ReconnectMessage = {
  type: "reconnect";
  sessionToken: string;
};

const parseMessage = (raw: RawData): JoinMessage | ReconnectMessage | null => {
  if (typeof raw !== "string" && !Buffer.isBuffer(raw)) {
    return null;
  }

  try {
    const message = JSON.parse(raw.toString()) as { type?: string; displayName?: string; sessionToken?: string };

    if (message.type === "join" && typeof message.displayName === "string" && message.displayName.trim().length > 0) {
      return { type: "join", displayName: message.displayName.trim() };
    }

    if (message.type === "reconnect" && typeof message.sessionToken === "string") {
      return { type: "reconnect", sessionToken: message.sessionToken };
    }
  } catch {
    return null;
  }

  return null;
};

export const createMessageRouter = ({ roomManager, sessionRegistry }: MessageRouterOptions) => {
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
            socket.send(JSON.stringify({
              type: "room-joined",
              roomId: assignment.roomId,
              playerEntityId: assignment.playerEntityId,
              sessionToken: session.sessionToken,
            }));
            return;
          }

          const reclaimResult = sessionRegistry.reclaim(message.sessionToken);
          if (!reclaimResult.accepted) {
            socket.send(JSON.stringify({ type: "error", reason: reclaimResult.reason }));
            return;
          }

          activeSessionToken = reclaimResult.reservation.sessionToken;
          socket.send(JSON.stringify({
            type: "room-joined",
            roomId: reclaimResult.reservation.roomId,
            playerEntityId: reclaimResult.reservation.playerEntityId,
            sessionToken: reclaimResult.reservation.sessionToken,
          }));
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
