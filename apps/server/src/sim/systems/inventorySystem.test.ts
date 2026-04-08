import { describe, expect, it } from "vitest";

import { createLifecycleSystem } from "./lifecycleSystem";
import { consumeAmmoForReload, createInventorySystem } from "./inventorySystem";
import { createRoomSimulationConfig, createRoomState, queueInputIntent, queueSpawnPlayer } from "../state";

describe("createInventorySystem", () => {
  it("keeps a compact inventory, stacks ammo, and validates nearby pickup ownership", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    state.loot.set("loot_test-ammo", {
      entityId: "loot_test-ammo",
      itemId: "item_pistol-ammo",
      quantity: 12,
      position: { x: 1.5, y: 1 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.loot.set("loot_test-gun", {
      entityId: "loot_test-gun",
      itemId: "item_revolver",
      quantity: 1,
      position: { x: 3, y: 1 },
      ownerEntityId: "player_other-1",
      sourcePointId: null,
    });

    queueInputIntent(state, "player_test-1", {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: {
        inventory: {
          type: "pickup",
          pickupEntityId: "loot_test-ammo",
          toSlot: 0,
        },
      },
    });
    createInventorySystem().update(state, 0);

    expect(state.players.get("player_test-1")?.inventory.ammoStacks).toEqual([{ ammoItemId: "item_pistol-ammo", quantity: 30 }]);
    expect(state.loot.has("loot_test-ammo")).toBe(false);

    queueInputIntent(state, "player_test-1", {
      sequence: 2,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: {
        inventory: {
          type: "pickup",
          pickupEntityId: "loot_test-gun",
          toSlot: 0,
        },
      },
    });
    createInventorySystem().update(state, 0);

    expect(state.players.get("player_test-1")?.inventory.slots[0]).toEqual({ itemId: "item_revolver", quantity: 1 });
    expect(state.loot.has("loot_test-gun")).toBe(true);
  });

  it("equips a looted firearm into the chosen slot so it can be used immediately", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-equip",
      displayName: "Avery",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    state.loot.set("loot_test-revolver", {
      entityId: "loot_test-revolver",
      itemId: "item_revolver",
      quantity: 1,
      position: { x: 1.5, y: 1 },
      ownerEntityId: null,
      sourcePointId: null,
    });

    queueInputIntent(state, "player_test-equip", {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: {
        inventory: {
          type: "pickup",
          pickupEntityId: "loot_test-revolver",
          toSlot: 2,
        },
      },
    });

    createInventorySystem().update(state, 0);

    expect(state.players.get("player_test-equip")?.inventory.slots[2]).toEqual({ itemId: "item_revolver", quantity: 1 });
    expect(state.players.get("player_test-equip")?.inventory.equippedWeaponSlot).toBe(2);
    expect(state.dirtyPlayerIds.has("player_test-equip")).toBe(true);
  });

  it("equips an occupied carried slot through the authoritative inventory action path", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-select",
      displayName: "Avery",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    const player = state.players.get("player_test-select");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.inventory.slots[0] = { itemId: "item_revolver", quantity: 1 };
    player.inventory.slots[1] = { itemId: "item_bandage", quantity: 2 };
    player.inventory.equippedWeaponSlot = 0;
    state.dirtyPlayerIds.clear();

    queueInputIntent(state, "player_test-select", {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: {
        inventory: {
          type: "equip",
          toSlot: 1,
        },
      },
    });

    createInventorySystem().update(state, 0);

    expect(player.inventory.equippedWeaponSlot).toBe(1);
    expect(state.dirtyPlayerIds.has("player_test-select")).toBe(true);
  });

  it("consumes reserve ammo to refill a magazine and leaves leftovers stacked", () => {
    const state = createRoomState({ roomId: "room_test" });
    queueSpawnPlayer(state, {
      entityId: "player_test-2",
      displayName: "Blair",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    const player = state.players.get("player_test-2");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 8 }];
    player.weaponState = {
      magazineAmmo: 0,
      isReloading: false,
      reloadRemainingMs: 0,
      fireCooldownRemainingMs: 0,
    };

    expect(consumeAmmoForReload(player, "item_pistol-ammo", 6)).toBe(6);
    expect(player.weaponState?.magazineAmmo).toBe(6);
    expect(player.inventory.ammoStacks).toEqual([{ ammoItemId: "item_pistol-ammo", quantity: 2 }]);
  });

  it("drops carried gear into world loot when a player dies", () => {
    const state = createRoomState({ roomId: "room_test" });
    queueSpawnPlayer(state, {
      entityId: "player_test-3",
      displayName: "Casey",
      position: { x: 4, y: 5 },
    });
    createLifecycleSystem().update(state, 0);

    const player = state.players.get("player_test-3");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.inventory.slots[0] = { itemId: "item_revolver", quantity: 1 };
    player.inventory.slots[1] = { itemId: "item_bandage", quantity: 2 };
    player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 10 }];
    player.health = { current: 0, max: 100, isDead: true };

    createInventorySystem().update(state, 0);

    expect(player.inventory.slots.every((slot) => slot === null)).toBe(true);
    expect(player.inventory.ammoStacks).toEqual([]);
    expect([...state.loot.values()].map((loot) => ({ itemId: loot.itemId, quantity: loot.quantity }))).toEqual([
      { itemId: "item_revolver", quantity: 1 },
      { itemId: "item_bandage", quantity: 2 },
      { itemId: "item_pistol-ammo", quantity: 10 },
    ]);
  });

  it("limits death drops to maxDroppedItems so room loot stays bounded", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({ maxDroppedItems: 2 }),
    });
    queueSpawnPlayer(state, {
      entityId: "player_test-4",
      displayName: "Devon",
      position: { x: 4, y: 5 },
    });
    createLifecycleSystem().update(state, 0);

    const player = state.players.get("player_test-4");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.inventory.slots[0] = { itemId: "item_revolver", quantity: 1 };
    player.inventory.slots[1] = { itemId: "item_bandage", quantity: 2 };
    player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 10 }];
    player.health = { current: 0, max: 100, isDead: true };

    createInventorySystem().update(state, 0);

    expect(state.loot.size).toBe(2);
    expect([...state.loot.values()].map((loot) => loot.itemId)).toEqual(["item_revolver", "item_bandage"]);
  });

  it("does not allow dead players to pick up loot before respawn", () => {
    const state = createRoomState({ roomId: "room_test" });
    queueSpawnPlayer(state, {
      entityId: "player_test-dead",
      displayName: "Harper",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    const player = state.players.get("player_test-dead");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.health = { current: 0, max: 100, isDead: true };
    state.loot.set("loot_test-bandage", {
      entityId: "loot_test-bandage",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 1.2, y: 1 },
      ownerEntityId: null,
      sourcePointId: null,
    });

    queueInputIntent(state, "player_test-dead", {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: {
        inventory: {
          type: "pickup",
          pickupEntityId: "loot_test-bandage",
          toSlot: 0,
        },
      },
    });

    createInventorySystem().update(state, 0);

    expect(player.inventory.slots[0]).toBeNull();
    expect(state.loot.has("loot_test-bandage")).toBe(true);
  });

  it("marks players dirty when pickups mutate inventory state", () => {
    const state = createRoomState({ roomId: "room_test" });
    queueSpawnPlayer(state, {
      entityId: "player_test-dirty",
      displayName: "Avery",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);
    state.dirtyPlayerIds.clear();

    state.loot.set("loot_test-ammo", {
      entityId: "loot_test-ammo",
      itemId: "item_pistol-ammo",
      quantity: 12,
      position: { x: 1.2, y: 1 },
      ownerEntityId: null,
      sourcePointId: null,
    });

    queueInputIntent(state, "player_test-dirty", {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: {
        inventory: {
          type: "pickup",
          pickupEntityId: "loot_test-ammo",
          toSlot: 0,
        },
      },
    });

    createInventorySystem().update(state, 0);

    expect(state.dirtyPlayerIds.has("player_test-dirty")).toBe(true);
  });
});
