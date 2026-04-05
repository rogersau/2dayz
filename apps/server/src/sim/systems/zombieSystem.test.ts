import { describe, expect, it } from "vitest";

import { createLifecycleSystem } from "./lifecycleSystem";
import { createZombieSystem } from "./zombieSystem";
import { createRoomSimulationConfig, createRoomState, queueSpawnPlayer } from "../state";

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
});
