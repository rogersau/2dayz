import { describe, expect, it } from "vitest";

import { createProtocolStore } from "./protocolStore";

describe("protocolStore", () => {
  it("retains the latest snapshot and ordered deltas after that snapshot tick", () => {
    const protocolStore = createProtocolStore();

    protocolStore.ingest({
      type: "snapshot",
      tick: 4,
      roomId: "room_browser-v1",
      playerEntityId: "player_self",
      players: [],
      loot: [],
      zombies: [],
    });
    protocolStore.ingest({
      type: "delta",
      tick: 5,
      roomId: "room_browser-v1",
      enteredEntities: [],
      entityUpdates: [],
      removedEntityIds: [],
      events: [],
    });
    protocolStore.ingest({
      type: "delta",
      tick: 6,
      roomId: "room_browser-v1",
      enteredEntities: [],
      entityUpdates: [],
      removedEntityIds: [],
      events: [],
    });
    protocolStore.ingest({
      type: "delta",
      tick: 3,
      roomId: "room_browser-v1",
      enteredEntities: [],
      entityUpdates: [],
      removedEntityIds: [],
      events: [],
    });

    expect(protocolStore.getState().snapshot?.tick).toBe(4);
    expect(protocolStore.getState().pendingDeltas.map((delta) => delta.tick)).toEqual([5, 6]);
  });
});
