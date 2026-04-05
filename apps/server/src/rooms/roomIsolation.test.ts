import { describe, expect, it } from "vitest";

import { createRoomManager } from "./roomManager";
import { createRoomHealthSnapshot } from "./roomHealth";
import type { RoomRuntime } from "./roomRuntime";

type IsolationRoom = RoomRuntime & {
  updates: number;
};

const createIsolationRoom = (roomId: string, behavior: "throws" | "healthy"): IsolationRoom => {
  let room: IsolationRoom;

  room = {
    roomId,
    capacity: 2,
    status: "active",
    updates: 0,
    get playerCount() {
      return 1;
    },
    isHealthy() {
      return behavior === "healthy";
    },
    canAcceptPlayers() {
      return behavior === "healthy";
    },
    joinPlayer() {
      return {
        roomId,
        playerEntityId: `${roomId}-player-1`,
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
    tick() {
      if (behavior === "throws") {
        throw new Error("runtime failure");
      }

      this.updates += 1;
    },
    shutdown() {
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

describe("room isolation", () => {
  it("isolates a failed room while keeping health responses and other rooms alive", () => {
    const failedRoom = createIsolationRoom("room_bad", "throws");
    const healthyRoom = createIsolationRoom("room_good", "healthy");
    const manager = createRoomManager({
      roomCapacity: 2,
      createRoom: () => healthyRoom,
      initialRooms: [failedRoom, healthyRoom],
    });

    manager.tickAllRooms();

    expect(manager.getRoomSummaries()).toEqual([
      {
        roomId: "room_good",
        playerCount: 1,
        capacity: 2,
        status: "active",
      },
    ]);
    expect(createRoomHealthSnapshot(manager, 123).rooms).toEqual(1);
    expect(healthyRoom.updates).toBe(1);
  });
});
