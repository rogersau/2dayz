import { describe, expect, it } from "vitest";

import { createInventorySystem } from "../sim/systems/inventorySystem";
import { createLifecycleSystem } from "../sim/systems/lifecycleSystem";
import { createRoomState, queueSpawnPlayer } from "../sim/state";
import { processPendingRespawns, queuePlayerRespawn } from "./respawn";

describe("respawn helpers", () => {
  it("respawns dead players quickly at a valid live-room spawn after gear loss while room state continues", () => {
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
          respawnPoints: [
            { pointId: "point_respawn-a", position: { x: 2, y: 2 } },
            { pointId: "point_respawn-b", position: { x: 8, y: 8 } },
          ],
          interactablePlacements: [],
          navigation: {
            nodes: [{ nodeId: "node_a", position: { x: 1, y: 1 } }],
            links: [{ from: "node_a", to: "node_a", cost: 1 }],
          },
        },
        collision: { volumes: [] },
        navigation: { nodes: new Map(), neighbors: new Map() },
        respawnPoints: [
          { x: 2, y: 2 },
          { x: 8, y: 8 },
        ],
      },
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 2, y: 2 },
    });
    queueSpawnPlayer(state, {
      entityId: "player_test-2",
      displayName: "Blair",
      position: { x: 12, y: 12 },
    });
    createLifecycleSystem().update(state, 0);

    state.zombies.set("zombie_test-1", {
      entityId: "zombie_test-1",
      archetypeId: "zombie_shambler",
      transform: { x: 6, y: 6, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    const player = state.players.get("player_test-1");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.inventory.slots[0] = { itemId: "item_revolver", quantity: 1 };
    player.health = { current: 0, max: 100, isDead: true };

    createInventorySystem().update(state, 0);
    queuePlayerRespawn(state, player.entityId, 250);

    state.elapsedMs = 200;
    processPendingRespawns(state);
    expect(player.health.isDead).toBe(true);

    state.elapsedMs = 250;
    processPendingRespawns(state);

    expect(player.health).toEqual({ current: 100, max: 100, isDead: false });
    expect(player.transform).toMatchObject({ x: 8, y: 8 });
    expect(player.inventory.slots[0]).toBeNull();
    expect(state.zombies.has("zombie_test-1")).toBe(true);
    expect(state.loot.size).toBe(1);
  });

  it("uses the same selected respawn point for the death event and the actual respawn", () => {
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
          respawnPoints: [
            { pointId: "point_respawn-a", position: { x: 2, y: 2 } },
            { pointId: "point_respawn-b", position: { x: 8, y: 8 } },
          ],
          interactablePlacements: [],
          navigation: {
            nodes: [{ nodeId: "node_a", position: { x: 1, y: 1 } }],
            links: [{ from: "node_a", to: "node_a", cost: 1 }],
          },
        },
        collision: { volumes: [] },
        navigation: { nodes: new Map(), neighbors: new Map() },
        respawnPoints: [
          { x: 2, y: 2 },
          { x: 8, y: 8 },
        ],
      },
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 2, y: 2 },
    });
    queueSpawnPlayer(state, {
      entityId: "player_test-2",
      displayName: "Blair",
      position: { x: 12, y: 12 },
    });
    createLifecycleSystem().update(state, 0);

    const player = state.players.get("player_test-1");
    const otherPlayer = state.players.get("player_test-2");
    if (!player || !otherPlayer) {
      throw new Error("expected players to exist");
    }

    player.health = { current: 0, max: 100, isDead: true };
    createInventorySystem().update(state, 0);

    const deathEvent = state.events.find((event) => event.type === "death");
    if (!deathEvent || deathEvent.type !== "death") {
      throw new Error("expected death event");
    }

    otherPlayer.transform = { x: 8, y: 8, rotation: 0 };
    state.elapsedMs = 250;
    processPendingRespawns(state);

    expect(player.transform).toMatchObject(deathEvent.respawnAt);
  });
});
