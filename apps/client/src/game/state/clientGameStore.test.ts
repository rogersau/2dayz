import { describe, expect, it } from "vitest";

import { createClientGameStore } from "./clientGameStore";

describe("clientGameStore", () => {
  it("ingests snapshots, applies deltas, updates replicated inventory, and marks the player dead", () => {
    const store = createClientGameStore();

    store.completeJoin({
      displayName: "Survivor",
      playerEntityId: "player_self",
      roomId: "room_browser-v1",
    });

    store.applySnapshot({
      loot: [
        {
          entityId: "loot_shells",
          itemId: "ammo_shells",
          position: { x: 8, y: 5 },
          quantity: 12,
        },
      ],
      playerEntityId: "player_self",
      players: [
        {
          displayName: "Survivor",
          entityId: "player_self",
          health: { current: 72, isDead: false, max: 100 },
          inventory: {
            ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 18 }],
            equippedWeaponSlot: 0,
            slots: [
              { itemId: "weapon_pistol", quantity: 1 },
              null,
              null,
              null,
              null,
              null,
            ],
          },
          transform: { rotation: 0, x: 4, y: 6 },
          velocity: { x: 0, y: 0 },
        },
        {
          displayName: "Bandit",
          entityId: "player_other",
          inventory: {
            ammoStacks: [],
            equippedWeaponSlot: null,
            slots: [null, null, null, null, null, null],
          },
          transform: { rotation: 0, x: 10, y: 2 },
          velocity: { x: 0, y: 0 },
        },
      ],
      roomId: "room_browser-v1",
      tick: 20,
      type: "snapshot",
      zombies: [
        {
          archetypeId: "zombie_walker",
          entityId: "zombie_1",
          state: "roaming",
          transform: { rotation: 0.1, x: 12, y: 3 },
        },
      ],
    });

    store.toggleInventory();

    store.applyDelta({
      enteredEntities: [
        {
          entityId: "loot_medkit",
          itemId: "medkit",
          kind: "loot",
          position: { x: 2, y: 9 },
          quantity: 1,
        },
      ],
      entityUpdates: [
        {
          entityId: "player_other",
          health: { current: 55, isDead: false, max: 100 },
          transform: { rotation: 0.2, x: 11, y: 2 },
          velocity: { x: 1, y: 0 },
        },
      ],
      events: [
        {
          droppedInventory: {
            ammoStacks: [],
            equippedWeaponSlot: null,
            slots: [null, null, null, null, null, null],
          },
          killerEntityId: "player_other",
          respawnAt: { x: 0, y: 0 },
          roomId: "room_browser-v1",
          type: "death",
          victimEntityId: "player_self",
        },
      ],
      removedEntityIds: ["loot_shells"],
      roomId: "room_browser-v1",
      tick: 21,
      type: "delta",
    });

    expect(store.getState()).toMatchObject({
      health: { current: 72, isDead: false, max: 100 },
      inventory: {
        ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 18 }],
        equippedWeaponSlot: 0,
      },
      isDead: true,
      isInventoryOpen: true,
      latestTick: 21,
    });
    expect(store.getState().worldEntities.loot.map((entity) => entity.entityId)).toEqual(["loot_medkit"]);
    expect(store.getState().worldEntities.players.find((entity) => entity.entityId === "player_other")).toMatchObject({
      health: { current: 55, isDead: false, max: 100 },
      transform: { rotation: 0.2, x: 11, y: 2 },
      velocity: { x: 1, y: 0 },
    });
  });

  it("updates the local HUD inventory and ammo state from replicated player deltas", () => {
    const store = createClientGameStore();

    store.completeJoin({
      displayName: "Survivor",
      playerEntityId: "player_self",
      roomId: "room_browser-v1",
    });

    store.applySnapshot({
      loot: [],
      playerEntityId: "player_self",
      players: [
        {
          displayName: "Survivor",
          entityId: "player_self",
          health: { current: 90, isDead: false, max: 100 },
          inventory: {
            ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 18 }],
            equippedWeaponSlot: 0,
            slots: [
              { itemId: "weapon_pistol", quantity: 1 },
              null,
              null,
              null,
              null,
              null,
            ],
          },
          lastProcessedInputSequence: 2,
          transform: { rotation: 0, x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
      roomId: "room_browser-v1",
      tick: 30,
      type: "snapshot",
      zombies: [],
    });

    store.applyDelta({
      enteredEntities: [],
      entityUpdates: [
        {
          entityId: "player_self",
          health: { current: 64, isDead: false, max: 100 },
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
          lastProcessedInputSequence: 4,
          transform: { rotation: 0.2, x: 1, y: 0 },
          velocity: { x: 1, y: 0 },
        },
      ],
      events: [],
      removedEntityIds: [],
      roomId: "room_browser-v1",
      tick: 31,
      type: "delta",
    });

    expect(store.getState()).toMatchObject({
      health: { current: 64, isDead: false, max: 100 },
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
    });
    expect(store.getState().worldEntities.players[0]).toMatchObject({
      lastProcessedInputSequence: 4,
      transform: { rotation: 0.2, x: 1, y: 0 },
    });
  });
});
