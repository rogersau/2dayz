import { describe, expect, it } from "vitest";

import { createCollisionIndex, isCirclePositionBlocked } from "./collision";
import { loadMapDefinition } from "./loadMapDefinition";
import { hasLineOfSight } from "./lineOfSight";

describe("loadMapDefinition", () => {
  it("loads the default town map with typed world metadata", () => {
    const map = loadMapDefinition();

    expect(map.mapId).toBe("map_default-town");
    expect(map.name).toContain("Town");
    expect(map.respawnPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pointId: "point_respawn-main-road",
          position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        }),
      ]),
    );
    expect(map.lootPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pointId: "point_loot-market-shelves",
          tableId: "loot_residential",
        }),
      ]),
    );
    expect(map.zombieSpawnZones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          zoneId: "zone_town-center",
          archetypeIds: expect.arrayContaining(["zombie_shambler"]),
        }),
      ]),
    );
    expect(map.collisionVolumes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          volumeId: "volume_market",
          kind: "box",
        }),
      ]),
    );
    expect(map.navigation.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "node_square",
          to: "node_market",
          cost: expect.any(Number),
        }),
      ]),
    );
  });

  it("places default loot points on reachable walkable positions", () => {
    const map = loadMapDefinition();
    const collision = createCollisionIndex(map.collisionVolumes);

    for (const lootPoint of map.lootPoints) {
      expect(isCirclePositionBlocked(collision, lootPoint.position, 0.5)).toBe(false);
    }
  });

  it("places navigation nodes on walkable positions for zombie pathing", () => {
    const map = loadMapDefinition();
    const collision = createCollisionIndex(map.collisionVolumes);

    for (const node of map.navigation.nodes) {
      expect(isCirclePositionBlocked(collision, node.position, 0.5)).toBe(false);
    }
  });

  it("places interactable placements on reachable walkable positions", () => {
    const map = loadMapDefinition();
    const collision = createCollisionIndex(map.collisionVolumes);

    for (const placement of map.interactablePlacements) {
      expect(isCirclePositionBlocked(collision, placement.position, 0.5)).toBe(false);
    }
  });

  it("authors navigation links along traversable corridors", () => {
    const map = loadMapDefinition();
    const collision = createCollisionIndex(map.collisionVolumes);
    const nodesById = new Map(map.navigation.nodes.map((node) => [node.nodeId, node]));

    for (const link of map.navigation.links) {
      const from = nodesById.get(link.from);
      const to = nodesById.get(link.to);

      expect(from).toBeDefined();
      expect(to).toBeDefined();
      expect(hasLineOfSight(collision, from!.position, to!.position, 0.5)).toBe(true);
    }
  });

  it("rejects authored maps with blocked navigation corridors", () => {
    expect(() =>
      loadMapDefinition({
        mapId: "map_invalid-corridor",
        name: "Invalid Corridor",
        bounds: { width: 10, height: 10 },
        collisionVolumes: [
          {
            volumeId: "volume_wall",
            kind: "box",
            position: { x: 5, y: 5 },
            size: { width: 2, height: 6 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_test",
            center: { x: 1, y: 1 },
            radius: 1,
            maxAlive: 1,
            archetypeIds: ["zombie_shambler"],
          },
        ],
        lootPoints: [{ pointId: "point_loot-a", position: { x: 1, y: 1 }, tableId: "loot_residential" }],
        respawnPoints: [{ pointId: "point_respawn-a", position: { x: 1, y: 8 } }],
        interactablePlacements: [
          {
            placementId: "placement_crate-a",
            kind: "crate",
            position: { x: 1, y: 2 },
            interactionRadius: 1,
            prompt: "Search",
          },
        ],
        navigation: {
          nodes: [
            { nodeId: "node_a", position: { x: 2, y: 5 } },
            { nodeId: "node_b", position: { x: 8, y: 5 } },
          ],
          links: [{ from: "node_a", to: "node_b", cost: 6 }],
        },
      }),
    ).toThrow(/navigation link/i);
  });
});
