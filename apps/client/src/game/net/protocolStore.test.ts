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

  it("drains a snapshot once so later deltas do not reapply stale snapshot state", () => {
    const protocolStore = createProtocolStore();

    protocolStore.ingest({
      type: "snapshot",
      tick: 10,
      roomId: "room_browser-v1",
      playerEntityId: "player_self",
      players: [
        {
          displayName: "Survivor",
          entityId: "player_self",
          inventory: {
            ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 18 }],
            equippedWeaponSlot: 0,
            slots: [{ itemId: "weapon_pistol", quantity: 1 }, null, null, null, null, null],
          },
          stamina: { current: 10, max: 10 },
          transform: { rotation: 0, x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
      loot: [
        {
          entityId: "loot_shells",
          itemId: "ammo_shells",
          position: { x: 5, y: 4 },
          quantity: 12,
        },
      ],
      zombies: [],
    });

    expect(protocolStore.drainWorldUpdates()).toMatchObject({
      deltas: [],
      snapshot: { tick: 10 },
    });
    expect(protocolStore.drainWorldUpdates()).toEqual({
      deltas: [],
      snapshot: null,
    });

    protocolStore.ingest({
      type: "delta",
      tick: 11,
      roomId: "room_browser-v1",
      enteredEntities: [],
      entityUpdates: [
        {
          entityId: "player_self",
          inventory: {
            ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 6 }],
            equippedWeaponSlot: 0,
            slots: [
              { itemId: "weapon_pistol", quantity: 1 },
              { itemId: "bandage", quantity: 1 },
              null,
              null,
              null,
              null,
            ],
          },
        },
      ],
      removedEntityIds: ["loot_shells"],
      events: [],
    });
    protocolStore.ingest({
      type: "delta",
      tick: 12,
      roomId: "room_browser-v1",
      enteredEntities: [
        {
          entityId: "loot_medkit",
          itemId: "medkit",
          kind: "loot",
          position: { x: 2, y: 9 },
          quantity: 1,
        },
      ],
      entityUpdates: [],
      removedEntityIds: [],
      events: [],
    });

    expect(protocolStore.drainWorldUpdates()).toMatchObject({
      deltas: [
        {
          tick: 11,
          removedEntityIds: ["loot_shells"],
        },
        {
          tick: 12,
          enteredEntities: [{ entityId: "loot_medkit" }],
        },
      ],
      snapshot: null,
    });
  });
});
