import { describe, expect, it } from "vitest";

import { createSessionRegistry } from "../network/sessionRegistry";
import { createRoomManager } from "./roomManager";
import { createReconnectRegistry } from "./reconnect";
import type { RoomRuntime } from "./roomRuntime";

const createRuntimeRoom = (roomId: string, capacity = 2): RoomRuntime => {
  const players = new Map<string, { displayName: string; connected: boolean }>();

  return {
    roomId,
    capacity,
    status: "active",
    get playerCount() {
      return players.size;
    },
    isHealthy() {
      return true;
    },
    canAcceptPlayers() {
      return players.size < capacity;
    },
    joinPlayer(player) {
      const playerEntityId = `${roomId}-player-${players.size + 1}`;
      players.set(playerEntityId, { displayName: player.displayName, connected: true });
      return { roomId, playerEntityId };
    },
    disconnectPlayer(playerEntityId) {
      const state = players.get(playerEntityId);
      if (!state) {
        return false;
      }

      state.connected = false;
      return true;
    },
    reclaimPlayer(playerEntityId) {
      const state = players.get(playerEntityId);
      if (!state || state.connected) {
        return null;
      }

      state.connected = true;
      return { roomId, playerEntityId };
    },
    releasePlayer(playerEntityId) {
      return players.delete(playerEntityId);
    },
    shutdown() {
      // no-op for tests
    },
  };
};

describe("createReconnectRegistry", () => {
  it("reclaims the same reserved room state within the reclaim window with the same token", () => {
    let now = 1_000;
    const roomManager = createRoomManager({
      roomCapacity: 2,
      createRoom: () => createRuntimeRoom("room_alpha"),
    });
    const sessionRegistry = createSessionRegistry({
      reclaimWindowMs: 30_000,
      roomManager,
      now: () => now,
    });
    const assignment = roomManager.assignPlayer({ displayName: "Scout" });
    const reservation = sessionRegistry.createSession({
      displayName: "Scout",
      roomId: assignment.roomId,
      playerEntityId: assignment.playerEntityId,
    });

    now = 2_000;
    sessionRegistry.markDisconnected(reservation.sessionToken);

    now = 10_000;
    expect(sessionRegistry.reclaim(reservation.sessionToken)).toEqual({
      accepted: true,
      reservation: {
        sessionToken: reservation.sessionToken,
        displayName: "Scout",
        roomId: "room_alpha",
        playerEntityId: assignment.playerEntityId,
      },
    });
  });

  it("rejects an expired token after the reclaim window elapses", () => {
    let now = 1_000;
    const roomManager = createRoomManager({
      roomCapacity: 2,
      createRoom: () => createRuntimeRoom("room_alpha"),
    });
    const sessionRegistry = createSessionRegistry({
      reclaimWindowMs: 30_000,
      roomManager,
      now: () => now,
    });
    const assignment = roomManager.assignPlayer({ displayName: "Scout" });
    const reservation = sessionRegistry.createSession({
      displayName: "Scout",
      roomId: assignment.roomId,
      playerEntityId: assignment.playerEntityId,
    });

    now = 2_000;
    sessionRegistry.markDisconnected(reservation.sessionToken);

    now = 32_001;
    expect(sessionRegistry.reclaim(reservation.sessionToken)).toEqual({
      accepted: false,
      reason: "expired",
    });
  });

  it("releases expired disconnected reservations before a new room assignment decision", () => {
    let now = 1_000;
    const roomManager = createRoomManager({
      roomCapacity: 1,
      createRoom: () => createRuntimeRoom(`room_${now}`),
    });
    const sessionRegistry = createSessionRegistry({
      reclaimWindowMs: 30_000,
      roomManager,
      now: () => now,
    });
    const first = roomManager.assignPlayer({ displayName: "Scout" });
    const reservation = sessionRegistry.createSession({
      displayName: "Scout",
      roomId: first.roomId,
      playerEntityId: first.playerEntityId,
    });

    now = 2_000;
    sessionRegistry.markDisconnected(reservation.sessionToken);

    now = 32_001;
    sessionRegistry.cleanupExpiredReservations();

    const replacement = roomManager.assignPlayer({ displayName: "Blair" });

    expect(replacement.roomId).toBe(first.roomId);
  });

  it("rejects a reconnect token once its reserved room has been removed", () => {
    let now = 1_000;
    const doomedRoom = createRuntimeRoom("room_alpha");
    doomedRoom.isHealthy = () => false;

    const roomManager = createRoomManager({
      roomCapacity: 2,
      createRoom: () => createRuntimeRoom("room_bravo"),
      initialRooms: [doomedRoom],
    });
    const sessionRegistry = createSessionRegistry({
      reclaimWindowMs: 30_000,
      roomManager,
      now: () => now,
    });
    const reservation = sessionRegistry.createSession({
      displayName: "Scout",
      roomId: "room_alpha",
      playerEntityId: "room_alpha-player-1",
    });

    now = 2_000;
    sessionRegistry.markDisconnected(reservation.sessionToken);
    roomManager.getRoomSummaries();

    now = 5_000;
    expect(sessionRegistry.reclaim(reservation.sessionToken)).toEqual({
      accepted: false,
      reason: "room-unavailable",
    });
  });

  it("accepts duplicate display names without colliding identities", () => {
    const registry = createReconnectRegistry({ reclaimWindowMs: 30_000 });
    const first = registry.issueReservation({
      displayName: "Rook",
      roomId: "room_alpha",
      playerEntityId: "player_alpha",
      now: 1_000,
    });
    const second = registry.issueReservation({
      displayName: "Rook",
      roomId: "room_bravo",
      playerEntityId: "player_bravo",
      now: 2_000,
    });

    registry.markDisconnected(first.sessionToken, 3_000);
    registry.markDisconnected(second.sessionToken, 4_000);

    expect(registry.reclaim(first.sessionToken, 5_000)).toEqual({
      accepted: true,
      reservation: {
        sessionToken: first.sessionToken,
        displayName: "Rook",
        roomId: "room_alpha",
        playerEntityId: "player_alpha",
      },
    });
    expect(registry.reclaim(second.sessionToken, 5_000)).toEqual({
      accepted: true,
      reservation: {
        sessionToken: second.sessionToken,
        displayName: "Rook",
        roomId: "room_bravo",
        playerEntityId: "player_bravo",
      },
    });
  });
});
