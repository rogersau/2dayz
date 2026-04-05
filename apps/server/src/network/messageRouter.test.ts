import { describe, expect, it } from "vitest";
import { errorMessageSchema, roomJoinedMessageSchema } from "@2dayz/shared";

import { createMessageRouter } from "./messageRouter";
import { createSessionRegistry } from "./sessionRegistry";
import type { RoomManager } from "../rooms/roomManager";
import type { SessionRegistry } from "./sessionRegistry";
import { createRoomManager } from "../rooms/roomManager";
import { createRoomFactory } from "../rooms/roomFactory";

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

const createStubRoomManager = (): RoomManager => {
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

const createStubSessionRegistry = (): SessionRegistry => {
  return {
    createSession() {
      return {
        sessionToken: "session_1",
        displayName: "Avery",
        roomId: "room_1",
        playerEntityId: "player_room-1",
      };
    },
    cleanupExpiredReservations() {
      // no-op for tests
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
    const roomManager = createStubRoomManager();
    roomManager.assignPlayer = () => {
      throw new Error("join failure");
    };
    const router = createMessageRouter({ roomManager, sessionRegistry: createStubSessionRegistry() });

    expect(() => router.attach(socket).handleMessage('{"type":"join","displayName":"Avery"}')).not.toThrow();
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "internal-error",
    });
  });

  it("contains reclaim-path exceptions and emits a shared error message", () => {
    const socket = createSocket();
    const sessionRegistry = createStubSessionRegistry();
    sessionRegistry.reclaim = () => {
      throw new Error("reclaim failure");
    };
    const router = createMessageRouter({ roomManager: createStubRoomManager(), sessionRegistry });

    expect(() => router.attach(socket).handleMessage('{"type":"reconnect","sessionToken":"session_1"}')).not.toThrow();
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "internal-error",
    });
  });

  it("uses shared protocol messages for invalid requests and successful joins", () => {
    const socket = createSocket();
    const router = createMessageRouter({ roomManager: createStubRoomManager(), sessionRegistry: createStubSessionRegistry() });
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

  it("cleans expired reservations before assigning a room to a later join", () => {
    let now = 1_000;
    const roomManager = createRoomManager({
      roomCapacity: 1,
      createRoom: createRoomFactory({ roomCapacity: 1 }),
    });
    const sessionRegistry = createSessionRegistry({
      roomManager,
      reclaimWindowMs: 30_000,
      now: () => now,
    });
    const firstSocket = createSocket();
    const secondSocket = createSocket();

    const firstConnection = createMessageRouter({ roomManager, sessionRegistry }).attach(firstSocket as never);
    firstConnection.handleMessage('{"type":"join","displayName":"Avery"}' as never);

    firstConnection.handleClose();
    now = 32_001;

    const secondConnection = createMessageRouter({ roomManager, sessionRegistry }).attach(secondSocket as never);
    secondConnection.handleMessage('{"type":"join","displayName":"Blair"}' as never);

    expect(roomJoinedMessageSchema.parse(JSON.parse(secondSocket.sent[0] ?? "null"))).toMatchObject({
      roomId: "room_1",
    });
  });

  it("rejects repeated join attempts on the same socket while a session is already active", () => {
    const socket = createSocket();
    const roomManager = createRoomManager({
      roomCapacity: 1,
      createRoom: createRoomFactory({ roomCapacity: 1 }),
    });
    const sessionRegistry = createSessionRegistry({ roomManager });
    const connection = createMessageRouter({ roomManager, sessionRegistry }).attach(socket as never);

    connection.handleMessage('{"type":"join","displayName":"Avery"}' as never);
    connection.handleMessage('{"type":"join","displayName":"Blair"}' as never);

    expect(roomJoinedMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toMatchObject({
      roomId: "room_1",
    });
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[1] ?? "null"))).toEqual({
      type: "error",
      reason: "session-active",
    });
    expect(roomManager.getRoomSummaries()).toEqual([
      {
        roomId: "room_1",
        playerCount: 1,
        capacity: 1,
        status: "full",
      },
    ]);
  });
});
