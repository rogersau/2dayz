import { describe, expect, it } from "vitest";

import { createRoomManager } from "./roomManager";
import type { RoomRuntime } from "./roomRuntime";

type FakeRoom = RoomRuntime & {
  joinedNames: string[];
};

const createFakeRoom = (roomId: string, capacity: number): FakeRoom => {
  const joinedNames: string[] = [];

  return {
    roomId,
    capacity,
    status: "active",
    joinedNames,
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
});
