import { describe, expect, it } from "vitest";

import { createRoomManager } from "./roomManager";
import type { RoomRuntime } from "./roomRuntime";

type HealthRoom = RoomRuntime & {
  health: boolean;
  shutdownCalls: number;
};

const createHealthRoom = (roomId: string, health: boolean, joinedNames: string[] = []): HealthRoom => {
  let room: HealthRoom;

  room = {
    roomId,
    capacity: 2,
    status: health ? "active" : "unhealthy",
    health,
    shutdownCalls: 0,
    get playerCount() {
      return joinedNames.length;
    },
    isHealthy() {
      return this.health;
    },
    canAcceptPlayers() {
      return this.health && joinedNames.length < 2;
    },
    joinPlayer(player) {
      if (!this.health) {
        throw new Error("unhealthy rooms cannot accept joins");
      }

      joinedNames.push(player.displayName);

      return {
        roomId,
        playerEntityId: `${roomId}-player-${joinedNames.length}`,
        runtime: room,
      };
    },
    disconnectPlayer() {
      return true;
    },
    reclaimPlayer(playerEntityId) {
      return { roomId, playerEntityId, runtime: room };
    },
    releasePlayer() {
      return true;
    },
    shutdown() {
      this.shutdownCalls += 1;
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

  return room;
};

describe("room health routing", () => {
  it("rejects unhealthy rooms, reroutes joins to a healthy room, and cleans up failed rooms", () => {
    const unhealthy = createHealthRoom("room_bad", false, ["Taken"]);
    const healthy = createHealthRoom("room_good", true, []);
    const manager = createRoomManager({
      roomCapacity: 2,
      createRoom: () => healthy,
      initialRooms: [unhealthy],
    });

    const assignment = manager.assignPlayer({ displayName: "Fresh" });

    expect(assignment.roomId).toBe("room_good");
    expect(unhealthy.shutdownCalls).toBe(1);
    expect(manager.getRoomSummaries()).toEqual([
      {
        roomId: "room_good",
        playerCount: 1,
        capacity: 2,
        status: "active",
      },
    ]);
  });
});
