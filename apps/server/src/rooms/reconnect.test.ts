import { describe, expect, it } from "vitest";

import { createReconnectRegistry } from "./reconnect";

describe("createReconnectRegistry", () => {
  it("reclaims the same reservation within the reclaim window with the same token", () => {
    const registry = createReconnectRegistry({ reclaimWindowMs: 30_000 });
    const reservation = registry.issueReservation({
      displayName: "Scout",
      roomId: "room_alpha",
      playerEntityId: "player_alpha",
      now: 1_000,
    });

    registry.markDisconnected(reservation.sessionToken, 2_000);

    expect(registry.reclaim(reservation.sessionToken, 10_000)).toEqual({
      accepted: true,
      reservation: {
        sessionToken: reservation.sessionToken,
        displayName: "Scout",
        roomId: "room_alpha",
        playerEntityId: "player_alpha",
      },
    });
  });

  it("rejects an expired token after the reclaim window elapses", () => {
    const registry = createReconnectRegistry({ reclaimWindowMs: 30_000 });
    const reservation = registry.issueReservation({
      displayName: "Scout",
      roomId: "room_alpha",
      playerEntityId: "player_alpha",
      now: 1_000,
    });

    registry.markDisconnected(reservation.sessionToken, 2_000);

    expect(registry.reclaim(reservation.sessionToken, 32_001)).toEqual({
      accepted: false,
      reason: "expired",
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
