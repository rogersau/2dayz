import { describe, expect, it } from "vitest";

import { createRoomManager } from "./roomManager";
import type { RoomRuntime } from "./roomRuntime";

type FakeRoom = RoomRuntime & {
  joinedNames: string[];
  disconnectedPlayerIds: Set<string>;
};

const createFakeRoom = (roomId: string, capacity: number): FakeRoom => {
  const joinedNames: string[] = [];

  return {
    roomId,
    capacity,
    status: "active",
    joinedNames,
    disconnectedPlayerIds: new Set<string>(),
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
      return { roomId, playerEntityId };
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
  };
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

    expect(first.roomId).toBe("room_1");
    expect(second.roomId).toBe("room_1");
    expect(third.roomId).toBe("room_2");
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
    expect(manager.reclaimPlayer(first.roomId, first.playerEntityId)).toEqual(first);
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
