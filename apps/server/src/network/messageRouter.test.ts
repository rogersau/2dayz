import { describe, expect, it } from "vitest";
import { errorMessageSchema, roomJoinedMessageSchema } from "@2dayz/shared";

import { createMessageRouter } from "./messageRouter";
import type { RoomManager } from "../rooms/roomManager";
import type { SessionRegistry } from "./sessionRegistry";

type CapturingSocket = {
  sent: string[];
  send(payload: string): void;
};

const createSocket = (): CapturingSocket => {
  return {
    sent: [],
    send(payload) {
      this.sent.push(payload);
    },
  };
};

const createRoomManager = (): RoomManager => {
  return {
    assignPlayer() {
      return { roomId: "room_1", playerEntityId: "player_room-1" };
    },
    disconnectPlayer() {
      return true;
    },
    reclaimPlayer() {
      return { roomId: "room_1", playerEntityId: "player_room-1" };
    },
    releasePlayer() {
      return true;
    },
    tickAllRooms() {
      // no-op for tests
    },
    getRoomSummaries() {
      return [];
    },
    getRoomCount() {
      return 0;
    },
  };
};

const createSessionRegistry = (): SessionRegistry => {
  return {
    createSession() {
      return {
        sessionToken: "session_1",
        displayName: "Avery",
        roomId: "room_1",
        playerEntityId: "player_room-1",
      };
    },
    markDisconnected() {
      // no-op for tests
    },
    reclaim() {
      return {
        accepted: true,
        reservation: {
          sessionToken: "session_1",
          displayName: "Avery",
          roomId: "room_1",
          playerEntityId: "player_room-1",
        },
      };
    },
  };
};

describe("createMessageRouter", () => {
  it("contains join-path exceptions and emits a shared error message", () => {
    const socket = createSocket();
    const roomManager = createRoomManager();
    roomManager.assignPlayer = () => {
      throw new Error("join failure");
    };
    const router = createMessageRouter({ roomManager, sessionRegistry: createSessionRegistry() });

    expect(() => router.attach(socket).handleMessage('{"type":"join","displayName":"Avery"}')).not.toThrow();
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "internal-error",
    });
  });

  it("contains reclaim-path exceptions and emits a shared error message", () => {
    const socket = createSocket();
    const sessionRegistry = createSessionRegistry();
    sessionRegistry.reclaim = () => {
      throw new Error("reclaim failure");
    };
    const router = createMessageRouter({ roomManager: createRoomManager(), sessionRegistry });

    expect(() => router.attach(socket).handleMessage('{"type":"reconnect","sessionToken":"session_1"}')).not.toThrow();
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "internal-error",
    });
  });

  it("uses shared protocol messages for invalid requests and successful joins", () => {
    const socket = createSocket();
    const router = createMessageRouter({ roomManager: createRoomManager(), sessionRegistry: createSessionRegistry() });
    const connection = router.attach(socket);

    connection.handleMessage('{"type":"join","displayName":"  "}');
    connection.handleMessage('{"type":"join","displayName":"Avery"}');

    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "invalid-message",
    });
    expect(roomJoinedMessageSchema.parse(JSON.parse(socket.sent[1] ?? "null"))).toEqual({
      type: "room-joined",
      roomId: "room_1",
      playerEntityId: "player_room-1",
      sessionToken: "session_1",
    });
  });
});
