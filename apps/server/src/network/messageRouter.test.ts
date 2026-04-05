import { describe, expect, it } from "vitest";
import { deltaMessageSchema, errorMessageSchema, roomJoinedMessageSchema, snapshotMessageSchema } from "@2dayz/shared";

import { createMessageRouter } from "./messageRouter";
import { createSessionRegistry } from "./sessionRegistry";
import type { RoomManager } from "../rooms/roomManager";
import type { RoomRuntime } from "../rooms/roomRuntime";
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
  let room: RoomRuntime;

  room = {
    roomId: "room_1",
    capacity: 8,
    status: "active",
    playerCount: 0,
    isHealthy() {
      return true;
    },
    canAcceptPlayers() {
      return true;
    },
    joinPlayer() {
      return { roomId: "room_1", playerEntityId: "player_room-1", runtime: room };
    },
    disconnectPlayer() {
      return true;
    },
    reclaimPlayer() {
      return { roomId: "room_1", playerEntityId: "player_room-1", runtime: room };
    },
    releasePlayer() {
      return true;
    },
    shutdown() {
      // no-op for tests
    },
    tick() {
      // no-op for tests
    },
    queueInput() {
      // no-op for tests
    },
    subscribePlayer() {
      return () => undefined;
    },
  };

  return {
    assignPlayer() {
      return { roomId: "room_1", playerEntityId: "player_room-1", runtime: room };
    },
    disconnectPlayer() {
      return true;
    },
    reclaimPlayer() {
      return { roomId: "room_1", playerEntityId: "player_room-1", runtime: room };
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
        roomId: "room_1",
        playerEntityId: "player_room-1",
        runtime: createStubRoomManager().assignPlayer({ displayName: "Avery" }).runtime,
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
      roomCapacity: 8,
      createRoom: createRoomFactory({ roomCapacity: 8 }),
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
      roomCapacity: 8,
      createRoom: createRoomFactory({ roomCapacity: 8 }),
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
        capacity: 8,
        status: "active",
      },
    ]);
  });

  it("routes joined player input into the room simulation and delivers snapshot and delta updates on tick", () => {
    const socket = createSocket();
    const roomManager = createRoomManager({
      roomCapacity: 8,
      createRoom: createRoomFactory({ roomCapacity: 8 }),
    });
    const sessionRegistry = createSessionRegistry({ roomManager });
    const connection = createMessageRouter({ roomManager, sessionRegistry }).attach(socket as never);

    connection.handleMessage('{"type":"join","displayName":"Avery"}' as never);
    connection.handleMessage(
      '{"type":"input","sequence":1,"movement":{"x":1,"y":0},"aim":{"x":1,"y":0},"actions":{}}' as never,
    );

    roomManager.tickAllRooms();

    expect(roomJoinedMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toMatchObject({
      roomId: "room_1",
      playerEntityId: "player_1-1",
    });
    expect(snapshotMessageSchema.parse(JSON.parse(socket.sent[1] ?? "null"))).toMatchObject({
      type: "snapshot",
      tick: 1,
      roomId: "room_1",
      playerEntityId: "player_1-1",
      players: [
        {
          entityId: "player_1-1",
          transform: { x: 7.2, y: 14, rotation: 0 },
          velocity: { x: 4, y: 0 },
        },
      ],
    });
    expect(deltaMessageSchema.parse(JSON.parse(socket.sent[2] ?? "null"))).toMatchObject({
      type: "delta",
      tick: 1,
      roomId: "room_1",
      entityUpdates: expect.arrayContaining([
        expect.objectContaining({
          entityId: "player_1-1",
          transform: { x: 7.2, y: 14, rotation: 0 },
          velocity: { x: 4, y: 0 },
        }),
      ]),
    });
  });
});
