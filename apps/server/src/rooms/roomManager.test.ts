import { describe, expect, it } from "vitest";

import { createRoomManager } from "./roomManager";
import type { RoomRuntime } from "./roomRuntime";

type FakeRoom = RoomRuntime & {
  joinedNames: string[];
  disconnectedPlayerIds: Set<string>;
  subscriptions: Map<string, Set<unknown>>;
};

const createFakeRoom = (roomId: string, capacity: number): FakeRoom => {
  const joinedNames: string[] = [];
  const room: FakeRoom = {
    roomId,
    capacity,
    status: "active",
    joinedNames,
    disconnectedPlayerIds: new Set<string>(),
    subscriptions: new Map<string, Set<unknown>>(),
    get playerCount() {
      return joinedNames.length;
    },
    isHealthy() {
      return true;
    },
    canAcceptPlayers() {
      return joinedNames.length < capacity;
    },
    joinPlayer(player) {
      joinedNames.push(player.displayName);

      return {
        roomId,
        playerEntityId: `${roomId}-player-${joinedNames.length}`,
        runtime: room,
      };
    },
    disconnectPlayer(playerEntityId) {
      this.disconnectedPlayerIds.add(playerEntityId);
      return true;
    },
    reclaimPlayer(playerEntityId) {
      if (!this.disconnectedPlayerIds.has(playerEntityId)) {
        return null;
      }

      this.disconnectedPlayerIds.delete(playerEntityId);
      return { roomId, playerEntityId, runtime: room };
    },
    releasePlayer(playerEntityId) {
      const playerIndex = Number(playerEntityId.split("-").at(-1) ?? 0) - 1;
      if (playerIndex < 0 || playerIndex >= joinedNames.length) {
        return false;
      }

      joinedNames.splice(playerIndex, 1);
      this.disconnectedPlayerIds.delete(playerEntityId);
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
    subscribePlayer(playerEntityId, handlers) {
      const subscriptions = this.subscriptions.get(playerEntityId) ?? new Set();
      subscriptions.add(handlers);
      this.subscriptions.set(playerEntityId, subscriptions);

      return () => {
        subscriptions.delete(handlers);
        if (subscriptions.size === 0) {
          this.subscriptions.delete(playerEntityId);
        }
      };
    },
  };

  return room;
};

describe("createRoomManager", () => {
  it("creates the first room on the first join, fills a healthy room to capacity, then creates a new room", () => {
    let roomSequence = 0;

    const manager = createRoomManager({
      roomCapacity: 2,
      createRoom: () => {
        roomSequence += 1;
        return createFakeRoom(`room_${roomSequence}`, 2);
      },
    });

    const first = manager.assignPlayer({ displayName: "Avery" });
    const second = manager.assignPlayer({ displayName: "Blair" });
    const third = manager.assignPlayer({ displayName: "Casey" });

    expect(first).toMatchObject({ roomId: "room_1" });
    expect(second).toMatchObject({ roomId: "room_1" });
    expect(third).toMatchObject({ roomId: "room_2" });
    expect(first.runtime).toBeDefined();
    expect(second.runtime).toBe(first.runtime);
    expect(third.runtime).not.toBe(first.runtime);
    expect(manager.getRoomSummaries()).toEqual([
      {
        roomId: "room_1",
        playerCount: 2,
        capacity: 2,
        status: "full",
      },
      {
        roomId: "room_2",
        playerCount: 1,
        capacity: 2,
        status: "active",
      },
    ]);
  });

  it("keeps a disconnected player slot reserved until that player reclaims it", () => {
    const room = createFakeRoom("room_1", 1);
    const manager = createRoomManager({
      roomCapacity: 1,
      createRoom: () => createFakeRoom("room_2", 1),
      initialRooms: [room],
    });

    const first = manager.assignPlayer({ displayName: "Avery" });

    expect(manager.disconnectPlayer(first.roomId, first.playerEntityId)).toBe(true);

    const replacement = manager.assignPlayer({ displayName: "Blair" });

    expect(replacement.roomId).toBe("room_2");
    expect(manager.reclaimPlayer(first.roomId, first.playerEntityId)).toMatchObject(first);
  });

  it("keeps an empty room alive so later joins can reuse it", () => {
    const room = createFakeRoom("room_1", 2);
    const manager = createRoomManager({
      roomCapacity: 2,
      createRoom: () => createFakeRoom("room_2", 2),
      initialRooms: [room],
    });

    const first = manager.assignPlayer({ displayName: "Avery" });

    expect(manager.releasePlayer(first.roomId, first.playerEntityId)).toBe(true);
    expect(manager.getRoomSummaries()).toEqual([
      {
        roomId: "room_1",
        playerCount: 0,
        capacity: 2,
        status: "active",
      },
    ]);

    const second = manager.assignPlayer({ displayName: "Blair" });

    expect(second.roomId).toBe("room_1");
  });
});
