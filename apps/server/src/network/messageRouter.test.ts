import { describe, expect, it } from "vitest";
import {
  deltaMessageSchema,
  errorMessageSchema,
  roomJoinedMessageSchema,
  roomStatusMessageSchema,
  snapshotMessageSchema,
  type RoomStatusMessage,
  type DeltaMessage,
  type SnapshotMessage,
} from "@2dayz/shared";

import { createMessageRouter } from "./messageRouter";
import type { RoomManager } from "../rooms/roomManager";
import type { RoomRuntime } from "../rooms/roomRuntime";
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

const createStubRuntime = () => {
  let subscriptionHandlers:
    | {
        onSnapshot(snapshot: SnapshotMessage & { roomId: string }): void;
        onDelta(delta: DeltaMessage & { roomId: string }): void;
        onRoomStatus(message: RoomStatusMessage["room"]): void;
      }
    | null = null;
  const queuedInputs: Array<{
    playerEntityId: string;
    intent: {
      sequence: number;
      movement: { x: number; y: number };
      aim: { x: number; y: number };
      actions: {
        fire?: boolean;
        reload?: boolean;
        interact?: boolean;
        pickupEntityId?: string;
        inventory?: unknown;
      };
    };
  }> = [];

  const runtime: RoomRuntime = {
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
      return { roomId: "room_1", playerEntityId: "player_1-1", runtime };
    },
    disconnectPlayer() {
      return true;
    },
    reclaimPlayer() {
      return { roomId: "room_1", playerEntityId: "player_1-1", runtime };
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
    queueInput(playerEntityId, intent) {
      queuedInputs.push({ playerEntityId, intent });
    },
    subscribePlayer(_playerEntityId, handlers) {
      subscriptionHandlers = handlers as typeof subscriptionHandlers;
      return () => undefined;
    },
  };

  return {
    runtime,
    queuedInputs,
    emitSnapshot(snapshot: SnapshotMessage & { roomId: string }) {
      subscriptionHandlers?.onSnapshot(snapshot);
    },
    emitDelta(delta: DeltaMessage & { roomId: string }) {
      subscriptionHandlers?.onDelta(delta);
    },
    emitRoomStatus(message: RoomStatusMessage["room"]) {
      subscriptionHandlers?.onRoomStatus(message);
    },
  };
};

const createStubRoomManager = (runtime: RoomRuntime): RoomManager => {
  return {
    assignPlayer() {
      return { roomId: "room_1", playerEntityId: "player_1-1", runtime };
    },
    disconnectPlayer() {
      return true;
    },
    reclaimPlayer() {
      return { roomId: "room_1", playerEntityId: "player_1-1", runtime };
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

const createStubSessionRegistry = (runtime: RoomRuntime): SessionRegistry => {
  return {
    createSession() {
      return {
        sessionToken: "session_1",
        displayName: "Avery",
        roomId: "room_1",
        playerEntityId: "player_1-1",
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
        playerEntityId: "player_1-1",
        runtime,
        reservation: {
          sessionToken: "session_1",
          displayName: "Avery",
          roomId: "room_1",
          playerEntityId: "player_1-1",
        },
      };
    },
  };
};

describe("createMessageRouter", () => {
  it("emits a typed error when room assignment throws during join", () => {
    const socket = createSocket();
    const roomManager = createStubRoomManager(createStubRuntime().runtime);
    roomManager.assignPlayer = () => {
      throw new Error("join failure");
    };
    const router = createMessageRouter({ roomManager, sessionRegistry: createStubSessionRegistry(createStubRuntime().runtime) });

    expect(() => router.attach(socket).handleMessage('{"type":"join","displayName":"Avery"}')).not.toThrow();
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "internal-error",
    });
  });

  it("emits a typed error when reclaim throws during reconnect", () => {
    const socket = createSocket();
    const runtime = createStubRuntime();
    const sessionRegistry = createStubSessionRegistry(runtime.runtime);
    sessionRegistry.reclaim = () => {
      throw new Error("reclaim failure");
    };
    const router = createMessageRouter({ roomManager: createStubRoomManager(runtime.runtime), sessionRegistry });

    expect(() => router.attach(socket).handleMessage('{"type":"reconnect","sessionToken":"session_1"}')).not.toThrow();
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "internal-error",
    });
  });

  it("emits typed join and reconnect confirmations", () => {
    const socket = createSocket();
    const reconnectSocket = createSocket();
    const runtime = createStubRuntime();
    const roomManager = createStubRoomManager(runtime.runtime);
    const sessionRegistry = createStubSessionRegistry(runtime.runtime);

    createMessageRouter({ roomManager, sessionRegistry }).attach(socket).handleMessage('{"type":"join","displayName":"Avery"}');
    createMessageRouter({ roomManager, sessionRegistry }).attach(reconnectSocket).handleMessage(
      '{"type":"reconnect","sessionToken":"session_1"}',
    );

    expect(roomJoinedMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "room-joined",
      roomId: "room_1",
      playerEntityId: "player_1-1",
      sessionToken: "session_1",
    });
    expect(roomStatusMessageSchema.parse(JSON.parse(socket.sent[1] ?? "null"))).toMatchObject({
      type: "room-status",
      room: { roomId: "room_1", status: "active", capacity: 8 },
    });
    expect(roomJoinedMessageSchema.parse(JSON.parse(reconnectSocket.sent[0] ?? "null"))).toEqual({
      type: "room-joined",
      roomId: "room_1",
      playerEntityId: "player_1-1",
      sessionToken: "session_1",
    });
    expect(roomStatusMessageSchema.parse(JSON.parse(reconnectSocket.sent[1] ?? "null"))).toMatchObject({
      type: "room-status",
      room: { roomId: "room_1", status: "active", capacity: 8 },
    });
  });

  it("routes validated movement, fire, reload, and interact intents into the room simulation", () => {
    const socket = createSocket();
    const runtime = createStubRuntime();
    const connection = createMessageRouter({
      roomManager: createStubRoomManager(runtime.runtime),
      sessionRegistry: createStubSessionRegistry(runtime.runtime),
    }).attach(socket);

    connection.handleMessage('{"type":"join","displayName":"Avery"}');
    connection.handleMessage('{"type":"input","sequence":1,"movement":{"x":1,"y":0},"aim":{"x":1,"y":0},"actions":{}}');
    connection.handleMessage(
      '{"type":"input","sequence":2,"movement":{"x":0,"y":0},"aim":{"x":1,"y":0},"actions":{"fire":true}}',
    );
    connection.handleMessage(
      '{"type":"input","sequence":3,"movement":{"x":0,"y":0},"aim":{"x":1,"y":0},"actions":{"reload":true}}',
    );
    connection.handleMessage(
      '{"type":"input","sequence":4,"movement":{"x":0,"y":0},"aim":{"x":1,"y":0},"actions":{"interact":true}}',
    );

    expect(runtime.queuedInputs).toEqual([
      {
        playerEntityId: "player_1-1",
        intent: {
          sequence: 1,
          movement: { x: 1, y: 0 },
          aim: { x: 1, y: 0 },
          actions: {},
        },
      },
      {
        playerEntityId: "player_1-1",
        intent: {
          sequence: 2,
          movement: { x: 0, y: 0 },
          aim: { x: 1, y: 0 },
          actions: { fire: true },
        },
      },
      {
        playerEntityId: "player_1-1",
        intent: {
          sequence: 3,
          movement: { x: 0, y: 0 },
          aim: { x: 1, y: 0 },
          actions: { reload: true },
        },
      },
      {
        playerEntityId: "player_1-1",
        intent: {
          sequence: 4,
          movement: { x: 0, y: 0 },
          aim: { x: 1, y: 0 },
          actions: { interact: true },
        },
      },
    ]);
  });

  it("rejects invalid messages before and after a session becomes active", () => {
    const socket = createSocket();
    const runtime = createStubRuntime();
    const connection = createMessageRouter({
      roomManager: createStubRoomManager(runtime.runtime),
      sessionRegistry: createStubSessionRegistry(runtime.runtime),
    }).attach(socket);

    connection.handleMessage('{"type":"input","sequence":1,"movement":{"x":1,"y":0},"aim":{"x":1,"y":0},"actions":{}}');
    connection.handleMessage('{"type":"join","displayName":"Avery"}');
    connection.handleMessage('{"type":"unknown"}');

    expect(errorMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toEqual({
      type: "error",
      reason: "invalid-message",
    });
    expect(roomJoinedMessageSchema.parse(JSON.parse(socket.sent[1] ?? "null"))).toMatchObject({
      roomId: "room_1",
    });
    expect(roomStatusMessageSchema.parse(JSON.parse(socket.sent[2] ?? "null"))).toMatchObject({
      room: { roomId: "room_1" },
    });
    expect(errorMessageSchema.parse(JSON.parse(socket.sent[3] ?? "null"))).toEqual({
      type: "error",
      reason: "invalid-message",
    });
  });

  it("emits room status before the runtime's initial snapshot and later deltas", () => {
    const socket = createSocket();
    const runtime = createStubRuntime();
    const connection = createMessageRouter({
      roomManager: createStubRoomManager(runtime.runtime),
      sessionRegistry: createStubSessionRegistry(runtime.runtime),
    }).attach(socket);

    connection.handleMessage('{"type":"join","displayName":"Avery"}');
    runtime.emitSnapshot({
      type: "snapshot",
      roomId: "room_1",
      tick: 1,
      playerEntityId: "player_1-1",
      players: [],
      loot: [],
      zombies: [],
    });
    runtime.emitDelta({
      type: "delta",
      roomId: "room_1",
      tick: 1,
      entityUpdates: [],
      removedEntityIds: [],
      events: [],
    });
    runtime.emitDelta({
      type: "delta",
      roomId: "room_1",
      tick: 2,
      entityUpdates: [],
      removedEntityIds: [],
      events: [],
    });

    expect(roomJoinedMessageSchema.parse(JSON.parse(socket.sent[0] ?? "null"))).toMatchObject({ roomId: "room_1" });
    expect(roomStatusMessageSchema.parse(JSON.parse(socket.sent[1] ?? "null"))).toMatchObject({
      type: "room-status",
      room: { roomId: "room_1", status: "active" },
    });
    expect(snapshotMessageSchema.parse(JSON.parse(socket.sent[2] ?? "null"))).toMatchObject({
      type: "snapshot",
      tick: 1,
      roomId: "room_1",
    });
    expect(deltaMessageSchema.parse(JSON.parse(socket.sent[3] ?? "null"))).toMatchObject({
      type: "delta",
      tick: 1,
      roomId: "room_1",
    });
    expect(deltaMessageSchema.parse(JSON.parse(socket.sent[4] ?? "null"))).toMatchObject({
      type: "delta",
      tick: 2,
      roomId: "room_1",
    });
    expect(socket.sent).toHaveLength(5);
  });

  it("forwards room-status updates after the session is active", () => {
    const socket = createSocket();
    const runtime = createStubRuntime();
    const connection = createMessageRouter({
      roomManager: createStubRoomManager(runtime.runtime),
      sessionRegistry: createStubSessionRegistry(runtime.runtime),
    }).attach(socket);

    connection.handleMessage('{"type":"join","displayName":"Avery"}');
    runtime.emitRoomStatus({
      roomId: "room_1",
      name: "room_1",
      status: "full",
      playerCount: 8,
      capacity: 8,
    });

    expect(roomStatusMessageSchema.parse(JSON.parse(socket.sent[2] ?? "null"))).toEqual({
      type: "room-status",
      room: {
        roomId: "room_1",
        name: "room_1",
        status: "full",
        playerCount: 8,
        capacity: 8,
      },
    });
  });
});
