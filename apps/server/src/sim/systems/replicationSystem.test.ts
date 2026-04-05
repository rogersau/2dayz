import { describe, expect, it } from "vitest";

import { deltaMessageSchema, snapshotMessageSchema } from "@2dayz/shared";

import { createRoomReplicationDelta, createRoomReplicationSnapshot } from "../query";
import { createRoomState, queueSpawnPlayer } from "../state";
import { createLifecycleSystem } from "./lifecycleSystem";
import { createReplicationSystem } from "./replicationSystem";

const spawnPlayer = (state: ReturnType<typeof createRoomState>, entityId: string, displayName: string, x: number, y: number) => {
  queueSpawnPlayer(state, {
    entityId,
    displayName,
    position: { x, y },
  });

  createLifecycleSystem().update(state, 0);
};

describe("createReplicationSystem", () => {
  it("creates an initial typed room snapshot for the subscribed player", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    spawnPlayer(state, "player_test-2", "Blair", 4, 0);

    const rawSnapshot = createRoomReplicationSnapshot(state, "player_test-1");
    const replication = createReplicationSystem();

    expect(
      snapshotMessageSchema.parse({
        type: "snapshot",
        roomId: state.roomId,
        ...replication.createInitialSnapshot(rawSnapshot),
      }),
    ).toMatchObject({
      type: "snapshot",
      roomId: "room_test",
      playerEntityId: "player_test-1",
      players: expect.arrayContaining([
        expect.objectContaining({ entityId: "player_test-1" }),
        expect.objectContaining({ entityId: "player_test-2" }),
      ]),
    });
  });

  it("creates per-tick deltas that preserve authoritative combat and death events", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);

    state.events.push(
      {
        type: "combat",
        roomId: "room_test",
        attackerEntityId: "player_test-1",
        targetEntityId: "zombie_test-1",
        weaponItemId: "item_revolver",
        damage: 35,
        remainingHealth: 25,
        hitPosition: { x: 3, y: 0 },
      },
      {
        type: "death",
        roomId: "room_test",
        victimEntityId: "player_test-2",
        killerEntityId: "player_test-1",
        droppedInventory: {
          slots: [null, null, null, null, null, null],
          equippedWeaponSlot: null,
          ammoStacks: [],
        },
        respawnAt: { x: 10, y: 10 },
      },
    );

    const rawDelta = createRoomReplicationDelta(state);
    const replication = createReplicationSystem();

    expect(
      deltaMessageSchema.parse({
        type: "delta",
        roomId: state.roomId,
        ...replication.createDelta(rawDelta),
      }),
    ).toMatchObject({
      type: "delta",
      roomId: "room_test",
      events: [
        expect.objectContaining({ type: "combat", attackerEntityId: "player_test-1" }),
        expect.objectContaining({ type: "death", victimEntityId: "player_test-2" }),
      ],
    });
  });

  it("caps nearby snapshot payloads while keeping the subscribed player in view", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    spawnPlayer(state, "player_test-2", "Blair", 2, 0);
    spawnPlayer(state, "player_test-3", "Casey", 4, 0);
    spawnPlayer(state, "player_test-4", "Devon", 25, 0);

    state.loot.set("loot_test-near", {
      entityId: "loot_test-near",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 3, y: 0 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.loot.set("loot_test-far", {
      entityId: "loot_test-far",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 30, y: 0 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.zombies.set("zombie_test-near", {
      entityId: "zombie_test-near",
      archetypeId: "zombie_shambler",
      transform: { x: 5, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.zombies.set("zombie_test-far", {
      entityId: "zombie_test-far",
      archetypeId: "zombie_shambler",
      transform: { x: 40, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    const rawSnapshot = createRoomReplicationSnapshot(state, "player_test-1");
    const replication = createReplicationSystem({
      nearbyRadius: 10,
      maxNearbyPlayers: 2,
      maxNearbyLoot: 1,
      maxNearbyZombies: 1,
    });

    expect(replication.createInitialSnapshot(rawSnapshot)).toMatchObject({
      playerEntityId: "player_test-1",
      players: [
        expect.objectContaining({ entityId: "player_test-1" }),
        expect.objectContaining({ entityId: "player_test-2" }),
      ],
      loot: [expect.objectContaining({ entityId: "loot_test-near" })],
      zombies: [expect.objectContaining({ entityId: "zombie_test-near" })],
    });
  });

  it("caps per-subscriber deltas to nearby entity updates while preserving visible removals", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    spawnPlayer(state, "player_test-2", "Blair", 2, 0);
    spawnPlayer(state, "player_test-3", "Casey", 4, 0);
    spawnPlayer(state, "player_test-4", "Devon", 30, 0);

    state.loot.set("loot_test-near", {
      entityId: "loot_test-near",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 3, y: 0 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.loot.set("loot_test-far", {
      entityId: "loot_test-far",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 30, y: 0 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.zombies.set("zombie_test-near", {
      entityId: "zombie_test-near",
      archetypeId: "zombie_shambler",
      transform: { x: 5, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.zombies.set("zombie_test-far", {
      entityId: "zombie_test-far",
      archetypeId: "zombie_shambler",
      transform: { x: 40, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    state.dirtyPlayerIds.add("player_test-2");
    state.dirtyPlayerIds.add("player_test-3");
    state.dirtyPlayerIds.add("player_test-4");
    state.dirtyLootIds.add("loot_test-near");
    state.dirtyLootIds.add("loot_test-far");
    state.dirtyZombieIds.add("zombie_test-near");
    state.dirtyZombieIds.add("zombie_test-far");
    state.removedEntityIds.add("loot_test-near");
    state.removedEntityIds.add("loot_test-far");

    const rawDelta = createRoomReplicationDelta(state);
    const replication = createReplicationSystem({
      nearbyRadius: 10,
      maxNearbyPlayers: 2,
      maxNearbyLoot: 1,
      maxNearbyZombies: 1,
    });

    expect(
      replication.createDeltaForPlayer({
        delta: rawDelta,
        state,
        playerEntityId: "player_test-1",
        visibleEntityIds: new Set(["player_test-1", "player_test-2", "loot_test-near", "zombie_test-near"]),
      }),
    ).toMatchObject({
      delta: {
        entityUpdates: expect.arrayContaining([
          expect.objectContaining({ entityId: "player_test-2" }),
          expect.objectContaining({ entityId: "loot_test-near" }),
          expect.objectContaining({ entityId: "zombie_test-near" }),
        ]),
        removedEntityIds: ["loot_test-near"],
      },
    });
    expect(
      replication.createDeltaForPlayer({
        delta: rawDelta,
        state,
        playerEntityId: "player_test-1",
        visibleEntityIds: new Set(["player_test-1", "player_test-2", "loot_test-near", "zombie_test-near"]),
      }).delta.entityUpdates.map((update) => update.entityId),
    ).not.toContain("player_test-4");
  });

  it("includes newly visible entities in a subscriber delta even when they were not globally dirty", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    spawnPlayer(state, "player_test-2", "Blair", 25, 0);

    state.dirtyPlayerIds.clear();

    const rawDelta = createRoomReplicationDelta(state);
    const replication = createReplicationSystem({
      nearbyRadius: 10,
      maxNearbyPlayers: 2,
    });

    state.players.get("player_test-2")!.transform = { x: 2, y: 0, rotation: 0 };

    expect(
      replication.createDeltaForPlayer({
        delta: rawDelta,
        state,
        playerEntityId: "player_test-1",
        visibleEntityIds: new Set(["player_test-1"]),
      }).delta.enteredEntities,
    ).toEqual([
      expect.objectContaining({
        kind: "player",
        entityId: "player_test-2",
        displayName: "Blair",
        transform: { x: 2, y: 0, rotation: 0 },
      }),
    ]);
  });

  it("includes newly visible zombies as typed entered entities", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    state.zombies.set("zombie_test-1", {
      entityId: "zombie_test-1",
      archetypeId: "zombie_shambler",
      transform: { x: 25, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.dirtyZombieIds.clear();

    const rawDelta = createRoomReplicationDelta(state);
    const replication = createReplicationSystem({ nearbyRadius: 10, maxNearbyZombies: 1 });

    state.zombies.get("zombie_test-1")!.transform = { x: 5, y: 0, rotation: 0 };

    expect(
      replication.createDeltaForPlayer({
        delta: rawDelta,
        state,
        playerEntityId: "player_test-1",
        visibleEntityIds: new Set(["player_test-1"]),
      }).delta.enteredEntities,
    ).toEqual([
      expect.objectContaining({
        kind: "zombie",
        entityId: "zombie_test-1",
        archetypeId: "zombie_shambler",
        state: "idle",
      }),
    ]);
  });

  it("keeps enter-range entities out of ordinary dirty updates", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    spawnPlayer(state, "player_test-2", "Blair", 25, 0);

    state.dirtyPlayerIds.clear();

    const rawDelta = createRoomReplicationDelta(state);
    const replication = createReplicationSystem({ nearbyRadius: 10, maxNearbyPlayers: 2 });

    state.players.get("player_test-2")!.transform = { x: 2, y: 0, rotation: 0 };

    expect(
      replication.createDeltaForPlayer({
        delta: rawDelta,
        state,
        playerEntityId: "player_test-1",
        visibleEntityIds: new Set(["player_test-1"]),
      }).delta.entityUpdates.map((update) => update.entityId),
    ).not.toContain("player_test-2");
  });

  it("emits a synthetic removal when a previously visible entity leaves range", () => {
    const state = createRoomState({ roomId: "room_test" });
    spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    spawnPlayer(state, "player_test-2", "Blair", 2, 0);

    state.dirtyPlayerIds.clear();

    const rawDelta = createRoomReplicationDelta(state);
    const replication = createReplicationSystem({
      nearbyRadius: 10,
      maxNearbyPlayers: 2,
    });

    state.players.get("player_test-2")!.transform = { x: 25, y: 0, rotation: 0 };

    expect(
      replication.createDeltaForPlayer({
        delta: rawDelta,
        state,
        playerEntityId: "player_test-1",
        visibleEntityIds: new Set(["player_test-1", "player_test-2"]),
      }).delta.removedEntityIds,
    ).toContain("player_test-2");
  });
});
