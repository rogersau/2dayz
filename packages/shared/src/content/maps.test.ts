import { describe, expect, it } from "vitest";

import { mapDefinitionSchema } from "./maps";

describe("mapDefinitionSchema", () => {
  it("requires collision, zombie spawns, loot points, respawn points, interactables, and navigation", () => {
    expect(
      mapDefinitionSchema.parse({
        mapId: "starter-town",
        name: "Starter Town",
        bounds: { width: 512, height: 512 },
        collisionVolumes: [
          {
            volumeId: "volume_wall-1",
            kind: "box",
            position: { x: 10, y: 12 },
            size: { width: 4, height: 2 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_street-pack",
            center: { x: 40, y: 20 },
            radius: 12,
            maxAlive: 6,
            archetypeIds: ["walker"],
          },
        ],
        lootPoints: [
          {
            pointId: "point_house-loot-1",
            position: { x: 14, y: 16 },
            tableId: "residential-basic",
          },
        ],
        respawnPoints: [
          {
            pointId: "point_spawn-1",
            position: { x: 6, y: 6 },
          },
        ],
        interactablePlacements: [
          {
            placementId: "placement_door-1",
            kind: "door",
            position: { x: 18, y: 14 },
            interactionRadius: 1.5,
            prompt: "Open door",
          },
        ],
        navigation: {
          nodes: [
            { nodeId: "node_n1", position: { x: 6, y: 6 } },
            { nodeId: "node_n2", position: { x: 20, y: 20 } },
          ],
          links: [{ from: "node_n1", to: "node_n2", cost: 20 }],
        },
      }),
    ).toMatchObject({ mapId: "starter-town", name: "Starter Town" });
  });

  it("rejects map definitions missing required metadata layers", () => {
    expect(() =>
      mapDefinitionSchema.parse({
        mapId: "starter-town",
        name: "Starter Town",
        bounds: { width: 512, height: 512 },
        collisionVolumes: [],
        zombieSpawnZones: [],
        lootPoints: [],
        respawnPoints: [],
        interactablePlacements: [],
      }),
    ).toThrow();
  });

  it("rejects map metadata with ids that do not match shared identifier contracts", () => {
    expect(() =>
      mapDefinitionSchema.parse({
        mapId: "starter-town",
        name: "Starter Town",
        bounds: { width: 512, height: 512 },
        collisionVolumes: [
          {
            volumeId: "wall_1",
            kind: "box",
            position: { x: 10, y: 12 },
            size: { width: 4, height: 2 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "street_pack",
            center: { x: 40, y: 20 },
            radius: 12,
            maxAlive: 6,
            archetypeIds: ["walker"],
          },
        ],
        lootPoints: [
          {
            pointId: "house_loot_1",
            position: { x: 14, y: 16 },
            tableId: "residential-basic",
          },
        ],
        respawnPoints: [
          {
            pointId: "spawn_1",
            position: { x: 6, y: 6 },
          },
        ],
        interactablePlacements: [
          {
            placementId: "door_1",
            kind: "door",
            position: { x: 18, y: 14 },
            interactionRadius: 1.5,
            prompt: "Open door",
          },
        ],
        navigation: {
          nodes: [
            { nodeId: "n1", position: { x: 6, y: 6 } },
            { nodeId: "n2", position: { x: 20, y: 20 } },
          ],
          links: [{ from: "n1", to: "n2", cost: 20 }],
        },
      }),
    ).toThrow();
  });
});
