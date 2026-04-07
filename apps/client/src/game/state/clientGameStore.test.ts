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
          stamina: { current: 8, max: 10 },
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
          stamina: { current: 10, max: 10 },
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
      stamina: { current: 8, max: 10 },
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
          stamina: { current: 9, max: 10 },
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
          stamina: { current: 5, max: 8 },
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
      stamina: { current: 5, max: 8 },
    });
    expect(store.getState().worldEntities.players[0]).toMatchObject({
      lastProcessedInputSequence: 4,
      stamina: { current: 5, max: 8 },
      transform: { rotation: 0.2, x: 1, y: 0 },
    });
  });

  it("queues shot, combat, and death render events while preserving existing state updates", () => {
    const store = createClientGameStore();

    store.completeJoin({
      displayName: "Survivor",
      playerEntityId: "player_self",
      roomId: "room_browser-v1",
    });

    store.applyDelta({
      enteredEntities: [],
      entityUpdates: [],
      events: [
        {
          attackerEntityId: "player_self",
          aim: { x: 1, y: 0 },
          origin: { x: 4, y: 6 },
          roomId: "room_browser-v1",
          type: "shot",
          weaponItemId: "weapon_pistol",
        },
        {
          attackerEntityId: "player_self",
          damage: 12,
          hitPosition: { x: 18, y: 20 },
          remainingHealth: 28,
          roomId: "room_browser-v1",
          targetEntityId: "zombie_1",
          type: "combat",
          weaponItemId: "weapon_pistol",
        },
        {
          droppedInventory: {
            ammoStacks: [],
            equippedWeaponSlot: null,
            slots: [null, null, null, null, null, null],
          },
          killerEntityId: "zombie_1",
          respawnAt: { x: 7, y: 14 },
          roomId: "room_browser-v1",
          type: "death",
          victimEntityId: "player_self",
        },
      ],
      removedEntityIds: [],
      roomId: "room_browser-v1",
      tick: 2,
      type: "delta",
    });

    expect(store.getState().isDead).toBe(true);
    expect(store.drainRenderEvents()).toEqual([
      expect.objectContaining({
        aim: { x: 1, y: 0 },
        attackerEntityId: "player_self",
        origin: { x: 4, y: 6 },
        type: "shot",
      }),
      expect.objectContaining({
        attackerEntityId: "player_self",
        damage: 12,
        targetEntityId: "zombie_1",
        type: "combat",
      }),
      expect.objectContaining({
        killerEntityId: "zombie_1",
        respawnAt: { x: 7, y: 14 },
        type: "death",
        victimEntityId: "player_self",
      }),
    ]);
    expect(store.drainRenderEvents()).toEqual([]);
  });

  it("clears queued render events when the store resets session lifecycle state", () => {
    const store = createClientGameStore();

    store.completeJoin({
      displayName: "Survivor",
      playerEntityId: "player_self",
      roomId: "room_browser-v1",
    });
    store.applyDelta({
      enteredEntities: [],
      entityUpdates: [],
      events: [
        {
          attackerEntityId: "player_self",
          aim: { x: 1, y: 0 },
          origin: { x: 4, y: 6 },
          roomId: "room_browser-v1",
          type: "shot",
          weaponItemId: "weapon_pistol",
        },
        {
          attackerEntityId: "player_self",
          damage: 12,
          hitPosition: { x: 18, y: 20 },
          remainingHealth: 28,
          roomId: "room_browser-v1",
          targetEntityId: "zombie_1",
          type: "combat",
          weaponItemId: "weapon_pistol",
        },
      ],
      removedEntityIds: [],
      roomId: "room_browser-v1",
      tick: 2,
      type: "delta",
    });

    store.failConnection("internal-error");

    expect(store.drainRenderEvents()).toEqual([]);
  });

  it("updates equippedWeaponSlot when selecting an occupied inventory slot", () => {
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
              { itemId: "weapon_shotgun", quantity: 1 },
              null,
              null,
              null,
              null,
            ],
          },
          transform: { rotation: 0, x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
      roomId: "room_browser-v1",
      tick: 30,
      type: "snapshot",
      zombies: [],
    });

    const initialInventory = store.getState().inventory;

    store.selectInventorySlot(1);

    expect(initialInventory.equippedWeaponSlot).toBe(0);
    expect(initialInventory.slots[1]).toEqual({ itemId: "weapon_shotgun", quantity: 1 });
    expect(store.getState().inventory).toMatchObject({
      equippedWeaponSlot: 1,
      slots: [
        { itemId: "weapon_pistol", quantity: 1 },
        { itemId: "weapon_shotgun", quantity: 1 },
        null,
        null,
        null,
        null,
      ],
    });
  });

  it("leaves state unchanged when selecting an empty inventory slot", () => {
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
          transform: { rotation: 0, x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
      roomId: "room_browser-v1",
      tick: 30,
      type: "snapshot",
      zombies: [],
    });

    const initialState = store.getState();

    store.selectInventorySlot(1);

    expect(store.getState()).toBe(initialState);
  });

  it("leaves state unchanged when selecting an out-of-range inventory slot", () => {
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
              { itemId: "weapon_shotgun", quantity: 1 },
              null,
              null,
              null,
              null,
            ],
          },
          transform: { rotation: 0, x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
      roomId: "room_browser-v1",
      tick: 30,
      type: "snapshot",
      zombies: [],
    });

    const initialState = store.getState();

    store.selectInventorySlot(99);

    expect(store.getState()).toBe(initialState);
  });

  it("resets stale HUD state when a completed join resolves to a different player identity", () => {
    const store = createClientGameStore();

    store.completeJoin({
      displayName: "Saved Survivor",
      playerEntityId: "player_old",
      roomId: "room_browser-v1",
    });
    store.applySnapshot({
      loot: [],
      playerEntityId: "player_old",
      players: [
        {
          displayName: "Saved Survivor",
          entityId: "player_old",
          health: { current: 86, isDead: false, max: 100 },
          inventory: {
            ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 21 }],
            equippedWeaponSlot: 0,
            slots: [
              { itemId: "weapon_pistol", quantity: 1 },
              { itemId: "bandage", quantity: 2 },
              null,
              null,
              null,
              null,
            ],
          },
          transform: { rotation: 0, x: 0, y: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
      roomId: "room_browser-v1",
      tick: 1,
      type: "snapshot",
      zombies: [],
    });

    store.completeJoin({
      displayName: "Fresh Survivor",
      playerEntityId: "player_new",
      roomId: "room_browser-v1",
    });

    expect(store.getState()).toMatchObject({
      health: null,
      inventory: {
        ammoStacks: [],
        equippedWeaponSlot: null,
        slots: [null, null, null, null, null, null],
      },
      isDead: false,
      latestTick: null,
      playerEntityId: "player_new",
      roomId: "room_browser-v1",
      worldEntities: {
        loot: [],
        players: [],
        zombies: [],
      },
    });
  });

  it("clears session-derived HUD and world state when returning to idle", () => {
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
      ],
      roomId: "room_browser-v1",
      tick: 20,
      type: "snapshot",
      zombies: [],
    });

    store.resetToIdle();

    expect(store.getState()).toMatchObject({
      connectionState: { phase: "idle" },
      health: null,
      inventory: {
        ammoStacks: [],
        equippedWeaponSlot: null,
        slots: [null, null, null, null, null, null],
      },
      isDead: false,
      latestTick: null,
      playerEntityId: null,
      roomId: null,
      worldEntities: {
        loot: [],
        players: [],
        zombies: [],
      },
    });
  });
});
