import { describe, expect, it } from "vitest";

import type { MapDefinition } from "@2dayz/shared";

import { createRoomFactory } from "./roomFactory";

const authoredTestMap: MapDefinition = {
  mapId: "map_test-live-room",
  name: "Test Live Room",
  bounds: { width: 20, height: 20 },
  collisionVolumes: [
    {
      volumeId: "volume_wall",
      kind: "box",
      position: { x: 6, y: 4 },
      size: { width: 2, height: 4 },
    },
  ],
  zombieSpawnZones: [
    {
      zoneId: "zone_test",
      center: { x: 12, y: 12 },
      radius: 2,
      maxAlive: 2,
      archetypeIds: ["zombie_shambler"],
    },
  ],
  lootPoints: [
    {
      pointId: "point_loot-a",
      position: { x: 2, y: 2 },
      tableId: "loot_residential",
    },
  ],
  respawnPoints: [
    { pointId: "point_respawn-a", position: { x: 4.4, y: 4 } },
    { pointId: "point_respawn-b", position: { x: 10, y: 10 } },
  ],
  interactablePlacements: [
    {
      placementId: "placement_crate-a",
      kind: "crate",
      position: { x: 3, y: 2 },
      interactionRadius: 1,
      prompt: "Search",
    },
  ],
  navigation: {
    nodes: [
      { nodeId: "node_a", position: { x: 2, y: 8 } },
      { nodeId: "node_b", position: { x: 10, y: 8 } },
    ],
    links: [
      { from: "node_a", to: "node_b", cost: 8 },
      { from: "node_b", to: "node_a", cost: 8 },
    ],
  },
};

const defaultIntent = {
  sequence: 1,
  movement: { x: 1, y: 0 },
  aim: { x: 1, y: 0 },
  actions: {},
} as const;

describe("createRoomFactory", () => {
  it("creates authoritative simulation room runtimes for live rooms", () => {
    const room = createRoomFactory({ roomCapacity: 12 })();

    expect(room).toHaveProperty("simulationState");
    expect(room).toHaveProperty("advance");
    expect(typeof room.queueInput).toBe("function");
    expect(typeof room.subscribePlayer).toBe("function");
    expect(room.capacity).toBe(12);
  });

  it("loads authored map data into live rooms for respawns, collision, and navigation", () => {
    const room = createRoomFactory({
      roomCapacity: 12,
      loadMap: () => authoredTestMap,
    })();

    const firstJoin = room.joinPlayer({ displayName: "Avery" });
    room.tick();

    expect(room.simulationState.players.get(firstJoin.playerEntityId)?.transform).toMatchObject({
      x: 4.4,
      y: 4,
    });

    room.queueInput(firstJoin.playerEntityId, defaultIntent);
    room.tick();

    expect(room.simulationState.players.get(firstJoin.playerEntityId)?.transform).toMatchObject({
      x: 4.4,
      y: 4,
    });

    const secondJoin = room.joinPlayer({ displayName: "Blair" });
    room.tick();

    expect(room.simulationState.players.get(secondJoin.playerEntityId)?.transform).toMatchObject({
      x: 10,
      y: 10,
    });
    expect(room.simulationState.world.map.mapId).toBe("map_test-live-room");
    expect(room.simulationState.world.navigation.nodes.get("node_a")?.position).toEqual({ x: 2, y: 8 });
  });
});
