import { describe, expect, it } from "vitest";

import { defaultWeapons } from "@2dayz/shared";

import { createRoomReplicationDelta, createRoomReplicationSnapshot } from "./query";
import { createRoomState, queueSpawnPlayer } from "./state";
import { createLifecycleSystem } from "./systems/lifecycleSystem";

describe("simulation query replication", () => {
  it("hydrates the authored shared weapons into the runtime weapon lookup", () => {
    const state = createRoomState({ roomId: "room_test" });

    expect([...state.weaponDefinitions.keys()]).toEqual(defaultWeapons.map((weapon) => weapon.itemId));
  });

  it("includes loot and zombies in authoritative snapshots and player starter weapon state in deltas", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);
    state.lastProcessedInputSequence.set("player_test-1", 3);

    state.loot.set("loot_test-1", {
      entityId: "loot_test-1",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 2, y: 2 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.zombies.set("zombie_test-1", {
      entityId: "zombie_test-1",
      archetypeId: "zombie_shambler",
      transform: { x: 3, y: 3, rotation: 0 },
      velocity: { x: 0.5, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "roaming",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.dirtyLootIds.add("loot_test-1");
    state.dirtyZombieIds.add("zombie_test-1");

    expect(createRoomReplicationSnapshot(state, "player_test-1")).toMatchObject({
      players: [
        {
          entityId: "player_test-1",
          inventory: {
            ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
            equippedWeaponSlot: 0,
            slots: [
              { itemId: "item_revolver", quantity: 1 },
              { itemId: "item_pipe", quantity: 1 },
              { itemId: "item_bandage", quantity: 1 },
              null,
              null,
              null,
            ],
          },
           stamina: { current: 10, max: 10 },
           weaponState: {
             weaponItemId: "item_revolver",
             weaponType: "firearm",
             magazineAmmo: 6,
             isBlocking: false,
             isReloading: false,
             reloadRemainingMs: 0,
             fireCooldownRemainingMs: 0,
          },
        },
      ],
      loot: [
        {
          entityId: "loot_test-1",
          itemId: "item_bandage",
          quantity: 1,
          position: { x: 2, y: 2 },
        },
      ],
      zombies: [
        {
          entityId: "zombie_test-1",
          archetypeId: "zombie_shambler",
          transform: { x: 3, y: 3, rotation: 0 },
          state: "roaming",
        },
      ],
    });

    expect(createRoomReplicationDelta(state)).toMatchObject({
      entityUpdates: [
        {
          entityId: "player_test-1",
          inventory: {
            ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
            equippedWeaponSlot: 0,
            slots: [
              { itemId: "item_revolver", quantity: 1 },
              { itemId: "item_pipe", quantity: 1 },
              { itemId: "item_bandage", quantity: 1 },
              null,
              null,
              null,
            ],
          },
          lastProcessedInputSequence: 3,
           stamina: { current: 10, max: 10 },
           transform: { x: 1, y: 1, rotation: 0 },
           weaponState: {
             weaponItemId: "item_revolver",
             weaponType: "firearm",
             magazineAmmo: 6,
             isBlocking: false,
             isReloading: false,
             reloadRemainingMs: 0,
             fireCooldownRemainingMs: 0,
          },
        },
        {
          entityId: "loot_test-1",
          itemId: "item_bandage",
          quantity: 1,
          position: { x: 2, y: 2 },
        },
        {
          entityId: "zombie_test-1",
          transform: { x: 3, y: 3, rotation: 0 },
          velocity: { x: 0.5, y: 0 },
          health: { current: 60, max: 60, isDead: false },
        },
      ],
    });
  });

  it("tracks loot and zombie removals through removedEntityIds", () => {
    const state = createRoomState({ roomId: "room_test" });

    state.removedEntityIds.add("loot_test-removed");
    state.removedEntityIds.add("zombie_test-removed");

    expect(createRoomReplicationDelta(state).removedEntityIds).toEqual([
      "loot_test-removed",
      "zombie_test-removed",
    ]);
  });

  it("includes dirty loot entities in deltas so incremental replication does not require a full snapshot", () => {
    const state = createRoomState({ roomId: "room_test" });

    state.loot.set("loot_test-drop", {
      entityId: "loot_test-drop",
      itemId: "item_revolver",
      quantity: 1,
      position: { x: 5, y: 6 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.dirtyLootIds.add("loot_test-drop");

    expect(createRoomReplicationDelta(state).entityUpdates).toContainEqual(
      expect.objectContaining({
        entityId: "loot_test-drop",
        itemId: "item_revolver",
        quantity: 1,
        position: { x: 5, y: 6 },
      }),
    );
  });

  it("includes dirty zombie state transitions in replication deltas", () => {
    const state = createRoomState({ roomId: "room_test" });

    state.zombies.set("zombie_test-searching", {
      entityId: "zombie_test-searching",
      archetypeId: "zombie_shambler",
      transform: { x: 3, y: 4, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "searching",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.dirtyZombieIds.add("zombie_test-searching");

    expect(createRoomReplicationDelta(state).entityUpdates).toContainEqual(
      expect.objectContaining({
        entityId: "zombie_test-searching",
        state: "searching",
      }),
    );
  });
});
