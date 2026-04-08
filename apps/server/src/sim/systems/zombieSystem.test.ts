import { describe, expect, it } from "vitest";

import { createCollisionIndex } from "../../world/collision";
import { createSimulationRoomRuntime } from "../../rooms/roomRuntime";
import { createLifecycleSystem } from "./lifecycleSystem";
import { createInventorySystem } from "./inventorySystem";
import { createMovementSystem } from "./movementSystem";
import { createZombieSystem } from "./zombieSystem";
import { createRoomSimulationConfig, createRoomState, queueInputIntent, queueSpawnPlayer } from "../state";
import { createNavigationGraph } from "../../world/navigation";

const createBlockedHearingWorld = () => {
  const wallVolume = {
    kind: "box" as const,
    volumeId: "wall_center",
    position: { x: 5, y: 2 },
    size: { width: 1, height: 4 },
  };
  const navigation = {
    nodes: [
      { nodeId: "node_left", position: { x: 2, y: 2 } },
      { nodeId: "node_top-left", position: { x: 2, y: 8 } },
      { nodeId: "node_top-right", position: { x: 8, y: 8 } },
      { nodeId: "node_right", position: { x: 8, y: 2 } },
    ],
    links: [
      { from: "node_left", to: "node_top-left", cost: 6 },
      { from: "node_top-left", to: "node_left", cost: 6 },
      { from: "node_top-left", to: "node_top-right", cost: 6 },
      { from: "node_top-right", to: "node_top-left", cost: 6 },
      { from: "node_top-right", to: "node_right", cost: 6 },
      { from: "node_right", to: "node_top-right", cost: 6 },
    ],
  };

  return {
    map: {
      mapId: "map_test",
      name: "Test",
      bounds: { width: 20, height: 20 },
      collisionVolumes: [wallVolume],
      zombieSpawnZones: [],
      lootPoints: [],
      respawnPoints: [],
      interactablePlacements: [],
      navigation,
    },
    collision: createCollisionIndex([wallVolume]),
    navigation: createNavigationGraph(navigation),
    respawnPoints: [],
  };
};

const spawnPlayer = (
  state: ReturnType<typeof createRoomState>,
  entityId: string,
  displayName: string,
  position: { x: number; y: number },
) => {
  queueSpawnPlayer(state, {
    entityId,
    displayName,
    position,
  });
  createLifecycleSystem().update(state, 0);

  const player = state.players.get(entityId);
  if (!player) {
    throw new Error(`expected player ${entityId} to exist`);
  }

  return player;
};

const asHearingZombie = (zombie: unknown) => {
  return zombie as {
    heardTargetEntityId?: string | null;
    heardPosition?: { x: number; y: number } | null;
  };
};

describe("createZombieSystem", () => {
  it("spawns zombies from typed zones, acquires aggro, chases, and later drops aggro", () => {
    const state = createRoomState({
      roomId: "room_test",
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [
            {
              zoneId: "zone_test",
              center: { x: 1, y: 1 },
              radius: 2,
              maxAlive: 1,
              archetypeIds: ["zombie_shambler"],
            },
          ],
          lootPoints: [],
          respawnPoints: [],
          interactablePlacements: [],
          navigation: {
            nodes: [{ nodeId: "node_a", position: { x: 1, y: 1 } }],
            links: [{ from: "node_a", to: "node_a", cost: 1 }],
          },
        },
        collision: { volumes: [] },
        navigation: { nodes: new Map(), neighbors: new Map() },
        respawnPoints: [],
      },
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 3, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    const zombieSystem = createZombieSystem();
    zombieSystem.update(state, 0.5);

    const zombie = [...state.zombies.values()][0];
    if (!zombie) {
      throw new Error("expected zombie to spawn");
    }

    expect(zombie.aggroTargetEntityId).toBe("player_test-1");
    expect(zombie.state).toBe("chasing");
    expect(zombie.transform.x).toBeGreaterThan(1);

    state.players.get("player_test-1")!.transform.x = 19;
    state.players.get("player_test-1")!.transform.y = 19;
    zombieSystem.update(state, 3);

    expect(zombie.aggroTargetEntityId).toBeNull();
    expect(zombie.state).toBe("idle");
  });

  it("drops aggro after repeated fixed ticks once sight or range is lost", () => {
    const state = createRoomState({
      roomId: "room_test",
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [
            {
              zoneId: "zone_test",
              center: { x: 1, y: 1 },
              radius: 2,
              maxAlive: 1,
              archetypeIds: ["zombie_shambler"],
            },
          ],
          lootPoints: [],
          respawnPoints: [],
          interactablePlacements: [],
          navigation: {
            nodes: [{ nodeId: "node_a", position: { x: 1, y: 1 } }],
            links: [{ from: "node_a", to: "node_a", cost: 1 }],
          },
        },
        collision: { volumes: [] },
        navigation: { nodes: new Map(), neighbors: new Map() },
        respawnPoints: [],
      },
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-fixed-tick-loss",
      displayName: "Avery",
      position: { x: 3, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    const zombieSystem = createZombieSystem();
    zombieSystem.update(state, 0.1);

    const zombie = [...state.zombies.values()][0];
    if (!zombie) {
      throw new Error("expected zombie to spawn");
    }

    state.players.get("player_test-fixed-tick-loss")!.transform = { x: 19, y: 19, rotation: 0 };

    for (let index = 0; index < 16; index += 1) {
      zombieSystem.update(state, 0.1);
    }

    expect(zombie.aggroTargetEntityId).toBeNull();
    expect(["idle", "roaming"]).toContain(zombie.state);
  });

  it("expires stale aggro under repeated hidden sounds and then searches the freshest heard position", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: createBlockedHearingWorld(),
    });

    const staleTarget = spawnPlayer(state, "player_test-stale-hidden", "Avery", { x: 8, y: 2 });
    const hiddenNoisemaker = spawnPlayer(state, "player_test-fresh-hidden", "Blair", { x: 8, y: 3.5 });
    state.zombies.set("zombie_test-hidden-grace", {
      entityId: "zombie_test-hidden-grace",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "chasing",
      aggroTargetEntityId: staleTarget.entityId,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    const zombieSystem = createZombieSystem();
    staleTarget.transform = { x: 8, y: 3.5, rotation: 0 };

    for (let index = 0; index < 16; index += 1) {
      const heardPosition = { x: 8, y: 3.5 + index * 0.1 };
      hiddenNoisemaker.transform = { ...heardPosition, rotation: 0 };
      state.sprintNoiseEvents.push({
        playerEntityId: hiddenNoisemaker.entityId,
        position: heardPosition,
      });
      zombieSystem.update(state, 0.1);
      state.sprintNoiseEvents.length = 0;
    }

    const zombie = state.zombies.get("zombie_test-hidden-grace");
    expect(zombie?.aggroTargetEntityId).toBeNull();
    expect(zombie?.state).toBe("searching");
    expect(asHearingZombie(zombie)?.heardTargetEntityId).toBe(hiddenNoisemaker.entityId);
    expect(asHearingZombie(zombie)?.heardPosition).toEqual({ x: 8, y: 5 });
  });

  it("applies zombie attack damage on a cooldown instead of every tick", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-2",
      displayName: "Blair",
      position: { x: 1.5, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    state.zombies.set("zombie_test-1", {
      entityId: "zombie_test-1",
      archetypeId: "zombie_shambler",
      transform: { x: 1, y: 1, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    const zombieSystem = createZombieSystem();
    zombieSystem.update(state, 0.1);
    zombieSystem.update(state, 0.1);

    expect(state.players.get("player_test-2")?.health.current).toBe(88);

    zombieSystem.update(state, 0.5);
    expect(state.players.get("player_test-2")?.health.current).toBe(76);
  });

  it("marks a zombie dirty when it re-enters attack range during cooldown", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-cooldown-attack",
      displayName: "Blair",
      position: { x: 3, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    state.zombies.set("zombie_test-cooldown-attack", {
      entityId: "zombie_test-cooldown-attack",
      archetypeId: "zombie_shambler",
      transform: { x: 1, y: 1, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "chasing",
      aggroTargetEntityId: "player_test-cooldown-attack",
      attackCooldownRemainingMs: 200,
      lostTargetMs: 0,
    });
    state.players.get("player_test-cooldown-attack")!.transform = { x: 2.2, y: 1, rotation: 0 };

    const zombieSystem = createZombieSystem();
    zombieSystem.update(state, 0.05);

    const zombie = state.zombies.get("zombie_test-cooldown-attack");
    expect(zombie?.state).toBe("attacking");
    expect(zombie?.velocity).toEqual({ x: 0, y: 0 });
    expect(state.dirtyZombieIds.has("zombie_test-cooldown-attack")).toBe(true);
  });

  it("hears a gunshot without line of sight and searches toward the shot origin", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: createBlockedHearingWorld(),
    });

    spawnPlayer(state, "player_test-heard-shot", "Avery", { x: 8, y: 2 });
    state.zombies.set("zombie_test-heard-shot", {
      entityId: "zombie_test-heard-shot",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.events.push({
      type: "shot",
      roomId: state.roomId,
      attackerEntityId: "player_test-heard-shot",
      weaponItemId: "item_revolver",
      origin: { x: 8, y: 2 },
      aim: { x: 1, y: 0 },
    });

    createZombieSystem().update(state, 3);

    const zombie = state.zombies.get("zombie_test-heard-shot");
    expect(zombie?.state).toBe("searching");
    expect(zombie?.aggroTargetEntityId).toBeNull();
    expect(zombie?.transform.x).toBe(2);
    expect(zombie?.transform.y).toBeGreaterThan(2);
    expect(asHearingZombie(zombie)?.heardPosition).toEqual({ x: 8, y: 2 });
  });

  it("hears a gunshot with line of sight and immediately chases the shooter", () => {
    const state = createRoomState({ roomId: "room_test" });

    spawnPlayer(state, "player_test-visible-shot", "Avery", { x: 11, y: 0 });
    state.zombies.set("zombie_test-visible-shot", {
      entityId: "zombie_test-visible-shot",
      archetypeId: "zombie_shambler",
      transform: { x: 0, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.events.push({
      type: "shot",
      roomId: state.roomId,
      attackerEntityId: "player_test-visible-shot",
      weaponItemId: "item_revolver",
      origin: { x: 11, y: 0 },
      aim: { x: 1, y: 0 },
    });

    createZombieSystem().update(state, 0.5);

    const zombie = state.zombies.get("zombie_test-visible-shot");
    expect(zombie?.aggroTargetEntityId).toBe("player_test-visible-shot");
    expect(zombie?.state).toBe("chasing");
    expect(zombie?.transform.x).toBeGreaterThan(0);
  });

  it("keeps chasing a visible shot origin even if the shooter moves behind cover before the zombie tick", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: createBlockedHearingWorld(),
    });

    const player = spawnPlayer(state, "player_test-shot-origin", "Avery", { x: 4, y: 2 });
    state.zombies.set("zombie_test-shot-origin", {
      entityId: "zombie_test-shot-origin",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.events.push({
      type: "shot",
      roomId: state.roomId,
      attackerEntityId: player.entityId,
      weaponItemId: "item_revolver",
      origin: { x: 4, y: 2 },
      aim: { x: 1, y: 0 },
    });

    player.transform = { x: 8, y: 2, rotation: 0 };

    createZombieSystem().update(state, 0.5);

    const zombie = state.zombies.get("zombie_test-shot-origin");
    expect(zombie?.aggroTargetEntityId).toBe(player.entityId);
    expect(zombie?.state).toBe("chasing");
    expect(asHearingZombie(zombie)?.heardPosition).toBeNull();
  });

  it("hears sprint noise without line of sight and investigates the player's last heard position", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: createBlockedHearingWorld(),
    });

    const player = spawnPlayer(state, "player_test-sprint-heard", "Avery", { x: 8, y: 2 });
    state.zombies.set("zombie_test-sprint-heard", {
      entityId: "zombie_test-sprint-heard",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    queueInputIntent(state, player.entityId, {
      sequence: 1,
      movement: { x: 1, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { sprint: true },
    });

    createMovementSystem().update(state, 0.1);
    createZombieSystem().update(state, 0.1);

    const zombie = state.zombies.get("zombie_test-sprint-heard");
    expect(zombie?.state).toBe("searching");
    expect(zombie?.aggroTargetEntityId).toBeNull();
    expect(asHearingZombie(zombie)?.heardTargetEntityId).toBe(player.entityId);
    expect(asHearingZombie(zombie)?.heardPosition).toEqual({ x: player.transform.x, y: player.transform.y });
  });

  it("keeps the last heard hidden sprint position until a new sound is produced", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: createBlockedHearingWorld(),
    });

    const player = spawnPlayer(state, "player_test-heard-frozen", "Avery", { x: 8, y: 2 });
    state.zombies.set("zombie_test-heard-frozen", {
      entityId: "zombie_test-heard-frozen",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    queueInputIntent(state, player.entityId, {
      sequence: 1,
      movement: { x: 1, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { sprint: true },
    });

    const movementSystem = createMovementSystem();
    const zombieSystem = createZombieSystem();
    movementSystem.update(state, 0.1);
    zombieSystem.update(state, 0.1);

    const zombie = state.zombies.get("zombie_test-heard-frozen");
    const firstHeardPosition = asHearingZombie(zombie)?.heardPosition;
    expect(firstHeardPosition).toEqual({ x: player.transform.x, y: player.transform.y });

    state.sprintNoiseEvents.length = 0;
    player.transform = { x: 8, y: 3.5, rotation: player.transform.rotation };
    player.velocity = { x: 0, y: 0 };

    zombieSystem.update(state, 0.1);

    expect(asHearingZombie(zombie)?.heardPosition).toEqual(firstHeardPosition);
    expect(asHearingZombie(zombie)?.heardPosition).not.toEqual({ x: player.transform.x, y: player.transform.y });
  });

  it("does not abandon an existing chase when a different hidden target makes noise", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: createBlockedHearingWorld(),
    });

    const chasingTarget = spawnPlayer(state, "player_test-chase-a", "Avery", { x: 8, y: 2 });
    const hiddenNoisemaker = spawnPlayer(state, "player_test-chase-b", "Blair", { x: 8, y: 3.5 });
    state.zombies.set("zombie_test-preserve-chase", {
      entityId: "zombie_test-preserve-chase",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "chasing",
      aggroTargetEntityId: chasingTarget.entityId,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 250,
    });
    state.sprintNoiseEvents.push({
      playerEntityId: hiddenNoisemaker.entityId,
      position: { x: hiddenNoisemaker.transform.x, y: hiddenNoisemaker.transform.y },
    });

    createZombieSystem().update(state, 0.1);

    const zombie = state.zombies.get("zombie_test-preserve-chase");
    expect(zombie?.aggroTargetEntityId).toBe(chasingTarget.entityId);
    expect(zombie?.state).toBe("chasing");
    expect(asHearingZombie(zombie)?.heardTargetEntityId ?? null).toBeNull();
    expect(asHearingZombie(zombie)?.heardPosition ?? null).toBeNull();
  });

  it("searches when a stale chase target expires on the same tick a new hidden sound is heard", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: createBlockedHearingWorld(),
    });

    const staleTarget = spawnPlayer(state, "player_test-stale-target", "Avery", { x: 8, y: 2 });
    const hiddenNoisemaker = spawnPlayer(state, "player_test-expiring-noise", "Blair", { x: 8, y: 3.5 });
    state.zombies.set("zombie_test-expiring-chase", {
      entityId: "zombie_test-expiring-chase",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "chasing",
      aggroTargetEntityId: staleTarget.entityId,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 1_450,
    });
    staleTarget.health.isDead = true;
    state.sprintNoiseEvents.push({
      playerEntityId: hiddenNoisemaker.entityId,
      position: { x: hiddenNoisemaker.transform.x, y: hiddenNoisemaker.transform.y },
    });

    createZombieSystem().update(state, 0.1);

    const zombie = state.zombies.get("zombie_test-expiring-chase");
    expect(zombie?.aggroTargetEntityId).toBeNull();
    expect(zombie?.state).toBe("searching");
    expect(asHearingZombie(zombie)?.heardTargetEntityId).toBe(hiddenNoisemaker.entityId);
    expect(asHearingZombie(zombie)?.heardPosition).toEqual({ x: 8, y: 3.5 });
  });

  it("returns to roaming or idle after reaching a heard position without reacquiring a target", () => {
    const state = createRoomState({
      roomId: "room_test",
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [],
          lootPoints: [],
          respawnPoints: [],
          interactablePlacements: [],
          navigation: {
            nodes: [
              { nodeId: "node_a", position: { x: 2, y: 2 } },
              { nodeId: "node_b", position: { x: 3, y: 2 } },
            ],
            links: [
              { from: "node_a", to: "node_b", cost: 1 },
              { from: "node_b", to: "node_a", cost: 1 },
            ],
          },
        },
        collision: createCollisionIndex([]),
        navigation: createNavigationGraph({
          nodes: [
            { nodeId: "node_a", position: { x: 2, y: 2 } },
            { nodeId: "node_b", position: { x: 3, y: 2 } },
          ],
          links: [
            { from: "node_a", to: "node_b", cost: 1 },
            { from: "node_b", to: "node_a", cost: 1 },
          ],
        }),
        respawnPoints: [],
      },
    });

    state.zombies.set(
      "zombie_test-search-finished",
      {
        entityId: "zombie_test-search-finished",
        archetypeId: "zombie_shambler",
        transform: { x: 2, y: 2, rotation: 0 },
        velocity: { x: 0, y: 0 },
        health: { current: 60, max: 60, isDead: false },
        state: "searching",
        aggroTargetEntityId: null,
        attackCooldownRemainingMs: 0,
        lostTargetMs: 0,
        heardTargetEntityId: "player_missing",
        heardPosition: { x: 2.05, y: 2 },
      } as never,
    );

    createZombieSystem().update(state, 0.5);

    const zombie = state.zombies.get("zombie_test-search-finished");
    expect(["roaming", "idle"]).toContain(zombie?.state);
    expect(asHearingZombie(zombie)?.heardTargetEntityId).toBeNull();
    expect(asHearingZombie(zombie)?.heardPosition).toBeNull();
  });

  it("hears sprint noise in the same tick order used by room runtime", () => {
    const runtime = createSimulationRoomRuntime({
      roomId: "room_test",
      config: {
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      },
      world: createBlockedHearingWorld(),
    });

    const joined = runtime.joinPlayer({ displayName: "Avery" });
    runtime.tick();
    runtime.simulationState.players.get(joined.playerEntityId)!.transform = { x: 8, y: 2, rotation: 0 };
    runtime.simulationState.zombies.set("zombie_test-runtime-sprint", {
      entityId: "zombie_test-runtime-sprint",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    runtime.queueInput(joined.playerEntityId, {
      sequence: 1,
      movement: { x: 1, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { sprint: true },
    });

    runtime.tick();

    const zombie = runtime.simulationState.zombies.get("zombie_test-runtime-sprint");
    expect(zombie?.state).toBe("searching");
    expect(asHearingZombie(zombie)?.heardTargetEntityId).toBe(joined.playerEntityId);
    expect(asHearingZombie(zombie)?.heardPosition?.x).toBeGreaterThan(8);
  });

  it("enforces maxZombies as a room-wide cap across spawn zones", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({ maxZombies: 2 }),
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [
            {
              zoneId: "zone_a",
              center: { x: 1, y: 1 },
              radius: 2,
              maxAlive: 2,
              archetypeIds: ["zombie_shambler"],
            },
            {
              zoneId: "zone_b",
              center: { x: 10, y: 10 },
              radius: 2,
              maxAlive: 2,
              archetypeIds: ["zombie_shambler"],
            },
          ],
          lootPoints: [],
          respawnPoints: [],
          interactablePlacements: [],
          navigation: {
            nodes: [{ nodeId: "node_a", position: { x: 1, y: 1 } }],
            links: [{ from: "node_a", to: "node_a", cost: 1 }],
          },
        },
        collision: { volumes: [] },
        navigation: { nodes: new Map(), neighbors: new Map() },
        respawnPoints: [],
      },
    });

    createZombieSystem().update(state, 0.1);

    expect(state.zombies.size).toBe(2);
  });

  it("roams while idle when no player has aggro", () => {
    const state = createRoomState({
      roomId: "room_test",
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [
            {
              zoneId: "zone_test",
              center: { x: 5, y: 5 },
              radius: 2,
              maxAlive: 1,
              archetypeIds: ["zombie_shambler"],
            },
          ],
          lootPoints: [],
          respawnPoints: [],
          interactablePlacements: [],
          navigation: {
            nodes: [
              { nodeId: "node_a", position: { x: 5, y: 5 } },
              { nodeId: "node_b", position: { x: 6, y: 5 } },
            ],
            links: [
              { from: "node_a", to: "node_b", cost: 1 },
              { from: "node_b", to: "node_a", cost: 1 },
            ],
          },
        },
        collision: { volumes: [] },
        navigation: {
          nodes: new Map([
            ["node_a", { nodeId: "node_a", position: { x: 5, y: 5 } }],
            ["node_b", { nodeId: "node_b", position: { x: 6, y: 5 } }],
          ]),
          neighbors: new Map([
            ["node_a", [{ nodeId: "node_b", cost: 1 }]],
            ["node_b", [{ nodeId: "node_a", cost: 1 }]],
          ]),
        },
        respawnPoints: [],
      },
    });

    const zombieSystem = createZombieSystem();
    zombieSystem.update(state, 0.5);

    const zombie = [...state.zombies.values()][0];
    expect(zombie?.state).toBe("roaming");
    expect(zombie?.transform.x).toBeGreaterThan(5);
  });

  it("removes dead zombies and marks them as removed for replication", () => {
    const state = createRoomState({ roomId: "room_test" });

    state.zombies.set("zombie_test-dead", {
      entityId: "zombie_test-dead",
      archetypeId: "zombie_shambler",
      transform: { x: 1, y: 1, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 0, max: 60, isDead: true },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    state.dirtyZombieIds.add("zombie_test-dead");

    createZombieSystem().update(state, 0.1);

    expect(state.zombies.has("zombie_test-dead")).toBe(false);
    expect(state.removedEntityIds.has("zombie_test-dead")).toBe(true);
    expect(state.dirtyZombieIds.has("zombie_test-dead")).toBe(false);
  });

  it("uses authored pathing instead of moving straight through blockers while chasing", () => {
    const navigation = {
      nodes: [
        { nodeId: "node_left", position: { x: 2, y: 2 } },
        { nodeId: "node_top-left", position: { x: 2, y: 8 } },
        { nodeId: "node_top-right", position: { x: 8, y: 8 } },
        { nodeId: "node_right", position: { x: 8, y: 2 } },
      ],
      links: [
        { from: "node_left", to: "node_top-left", cost: 6 },
        { from: "node_top-left", to: "node_left", cost: 6 },
        { from: "node_top-left", to: "node_top-right", cost: 6 },
        { from: "node_top-right", to: "node_top-left", cost: 6 },
        { from: "node_top-right", to: "node_right", cost: 6 },
        { from: "node_right", to: "node_top-right", cost: 6 },
      ],
    };
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5 && from.y <= 3 && to.y <= 3,
      }),
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [],
          lootPoints: [],
          respawnPoints: [],
          interactablePlacements: [],
          navigation,
        },
        collision: createCollisionIndex([]),
        navigation: createNavigationGraph(navigation),
        respawnPoints: [],
      },
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-path",
      displayName: "Avery",
      position: { x: 8, y: 2 },
    });
    createLifecycleSystem().update(state, 0);

    state.zombies.set("zombie_test-path", {
      entityId: "zombie_test-path",
      archetypeId: "zombie_shambler",
      transform: { x: 2, y: 2, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    createZombieSystem().update(state, 3);

    const zombie = state.zombies.get("zombie_test-path");
    expect(zombie?.transform.x).toBe(2);
    expect(zombie?.transform.y).toBeGreaterThan(2);
  });

  it("preserves zombie killer attribution on the resulting death event", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-zkill",
      displayName: "Avery",
      position: { x: 1.5, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    const player = state.players.get("player_test-zkill");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.health.current = 12;
    state.zombies.set("zombie_test-killer", {
      entityId: "zombie_test-killer",
      archetypeId: "zombie_shambler",
      transform: { x: 1, y: 1, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    createZombieSystem().update(state, 0.1);
    createInventorySystem().update(state);

    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "death",
        victimEntityId: player.entityId,
        killerEntityId: "zombie_test-killer",
      }),
    );
  });
});
