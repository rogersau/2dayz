import { describe, expect, it } from "vitest";

import { createRoomReplicationDelta, createRoomReplicationSnapshot } from "./query";
import { createRoomState, queueSpawnPlayer } from "./state";
import { createLifecycleSystem } from "./systems/lifecycleSystem";

describe("simulation query replication", () => {
  it("includes loot and zombies in authoritative snapshots and player inventory/input acks in deltas", () => {
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
            ammoStacks: [],
            equippedWeaponSlot: null,
            slots: [null, null, null, null, null, null],
          },
          lastProcessedInputSequence: 3,
          transform: { x: 1, y: 1, rotation: 0 },
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
});
