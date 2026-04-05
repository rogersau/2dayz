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

  it("places zombie spawn zones on walkable positions within map bounds", () => {
    const map = loadMapDefinition();
    const collision = createCollisionIndex(map.collisionVolumes);

    for (const zone of map.zombieSpawnZones) {
      expect(zone.center.x).toBeGreaterThanOrEqual(zone.radius);
      expect(zone.center.y).toBeGreaterThanOrEqual(zone.radius);
      expect(zone.center.x).toBeLessThanOrEqual(map.bounds.width - zone.radius);
      expect(zone.center.y).toBeLessThanOrEqual(map.bounds.height - zone.radius);
      expect(isCirclePositionBlocked(collision, zone.center, 0.5)).toBe(false);
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

  it("rejects zombie spawn zones outside map bounds or inside blocking collision", () => {
    expect(() =>
      loadMapDefinition({
        mapId: "map_invalid-zones",
        name: "Invalid Zones",
        bounds: { width: 10, height: 10 },
        collisionVolumes: [
          {
            volumeId: "volume_wall",
            kind: "box",
            position: { x: 5, y: 5 },
            size: { width: 2, height: 2 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_blocked",
            center: { x: 5, y: 5 },
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
            { nodeId: "node_a", position: { x: 1, y: 4 } },
            { nodeId: "node_b", position: { x: 1, y: 8 } },
          ],
          links: [{ from: "node_a", to: "node_b", cost: 4 }],
        },
      }),
    ).toThrow(/zombie spawn zone/i);

    expect(() =>
      loadMapDefinition({
        mapId: "map_out-of-bounds-zone",
        name: "Out Of Bounds Zone",
        bounds: { width: 10, height: 10 },
        collisionVolumes: [
          {
            volumeId: "volume_wall",
            kind: "box",
            position: { x: 8, y: 8 },
            size: { width: 1, height: 1 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_oob",
            center: { x: 9.5, y: 5 },
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
            { nodeId: "node_a", position: { x: 1, y: 4 } },
            { nodeId: "node_b", position: { x: 1, y: 8 } },
          ],
          links: [{ from: "node_a", to: "node_b", cost: 4 }],
        },
      }),
    ).toThrow(/zombie spawn zone/i);
  });

  it("rejects zombie spawn zones without usable walkable spawn area beyond the center point", () => {
    expect(() =>
      loadMapDefinition({
        mapId: "map_trapped-zone",
        name: "Trapped Zone",
        bounds: { width: 20, height: 20 },
        collisionVolumes: [
          {
            volumeId: "volume_north",
            kind: "box",
            position: { x: 10, y: 12 },
            size: { width: 4, height: 2 },
          },
          {
            volumeId: "volume_south",
            kind: "box",
            position: { x: 10, y: 8 },
            size: { width: 4, height: 2 },
          },
          {
            volumeId: "volume_east",
            kind: "box",
            position: { x: 12, y: 10 },
            size: { width: 2, height: 4 },
          },
          {
            volumeId: "volume_west",
            kind: "box",
            position: { x: 8, y: 10 },
            size: { width: 2, height: 4 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_trapped",
            center: { x: 10, y: 10 },
            radius: 4,
            maxAlive: 1,
            archetypeIds: ["zombie_shambler"],
          },
        ],
        lootPoints: [{ pointId: "point_loot-a", position: { x: 2, y: 2 }, tableId: "loot_residential" }],
        respawnPoints: [{ pointId: "point_respawn-a", position: { x: 2, y: 4 } }],
        interactablePlacements: [
          {
            placementId: "placement_crate-a",
            kind: "crate",
            position: { x: 2, y: 6 },
            interactionRadius: 1,
            prompt: "Search",
          },
        ],
        navigation: {
          nodes: [
            { nodeId: "node_a", position: { x: 2, y: 8 } },
            { nodeId: "node_b", position: { x: 6, y: 8 } },
          ],
          links: [
            { from: "node_a", to: "node_b", cost: 4 },
            { from: "node_b", to: "node_a", cost: 4 },
          ],
        },
      }),
    ).toThrow(/zombie spawn zone/i);
  });

  it("rejects authored points and navigation nodes outside map bounds", () => {
    expect(() =>
      loadMapDefinition({
        mapId: "map_out-of-bounds-points",
        name: "Out Of Bounds Points",
        bounds: { width: 10, height: 10 },
        collisionVolumes: [
          {
            volumeId: "volume_safe",
            kind: "box",
            position: { x: 8, y: 8 },
            size: { width: 1, height: 1 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_ok",
            center: { x: 5, y: 5 },
            radius: 1,
            maxAlive: 1,
            archetypeIds: ["zombie_shambler"],
          },
        ],
        lootPoints: [{ pointId: "point_loot-a", position: { x: 11, y: 1 }, tableId: "loot_residential" }],
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
            { nodeId: "node_a", position: { x: 1, y: 4 } },
            { nodeId: "node_b", position: { x: 1, y: 8 } },
          ],
          links: [{ from: "node_a", to: "node_b", cost: 4 }],
        },
      }),
    ).toThrow(/loot point/i);

    expect(() =>
      loadMapDefinition({
        mapId: "map_out-of-bounds-nav",
        name: "Out Of Bounds Nav",
        bounds: { width: 10, height: 10 },
        collisionVolumes: [
          {
            volumeId: "volume_safe",
            kind: "box",
            position: { x: 8, y: 8 },
            size: { width: 1, height: 1 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_ok",
            center: { x: 5, y: 5 },
            radius: 1,
            maxAlive: 1,
            archetypeIds: ["zombie_shambler"],
          },
        ],
        lootPoints: [{ pointId: "point_loot-a", position: { x: 1, y: 1 }, tableId: "loot_residential" }],
        respawnPoints: [{ pointId: "point_respawn-a", position: { x: 11, y: 8 } }],
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
            { nodeId: "node_a", position: { x: 1, y: 4 } },
            { nodeId: "node_b", position: { x: 12, y: 8 } },
          ],
          links: [{ from: "node_a", to: "node_b", cost: 4 }],
        },
      }),
    ).toThrow(/respawn point|navigation node/i);
  });

  it("rejects duplicate navigation node ids before graph loading", () => {
    expect(() =>
      loadMapDefinition({
        mapId: "map_duplicate-nav-nodes",
        name: "Duplicate Nav Nodes",
        bounds: { width: 10, height: 10 },
        collisionVolumes: [
          {
            volumeId: "volume_safe",
            kind: "box",
            position: { x: 8, y: 8 },
            size: { width: 1, height: 1 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_ok",
            center: { x: 5, y: 5 },
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
            { nodeId: "node_dup", position: { x: 1, y: 4 } },
            { nodeId: "node_dup", position: { x: 1, y: 8 } },
          ],
          links: [{ from: "node_dup", to: "node_dup", cost: 4 }],
        },
      }),
    ).toThrow(/duplicate navigation node/i);
  });

  it("rejects collision volumes that extend outside map bounds", () => {
    expect(() =>
      loadMapDefinition({
        mapId: "map_out-of-bounds-collision",
        name: "Out Of Bounds Collision",
        bounds: { width: 10, height: 10 },
        collisionVolumes: [
          {
            volumeId: "volume_oob",
            kind: "box",
            position: { x: 1, y: 5 },
            size: { width: 4, height: 2 },
          },
        ],
        zombieSpawnZones: [
          {
            zoneId: "zone_ok",
            center: { x: 6, y: 6 },
            radius: 1,
            maxAlive: 1,
            archetypeIds: ["zombie_shambler"],
          },
        ],
        lootPoints: [{ pointId: "point_loot-a", position: { x: 6, y: 2 }, tableId: "loot_residential" }],
        respawnPoints: [{ pointId: "point_respawn-a", position: { x: 6, y: 8 } }],
        interactablePlacements: [
          {
            placementId: "placement_crate-a",
            kind: "crate",
            position: { x: 7, y: 2 },
            interactionRadius: 1,
            prompt: "Search",
          },
        ],
        navigation: {
          nodes: [
            { nodeId: "node_a", position: { x: 6, y: 4 } },
            { nodeId: "node_b", position: { x: 8, y: 4 } },
          ],
          links: [
            { from: "node_a", to: "node_b", cost: 2 },
            { from: "node_b", to: "node_a", cost: 2 },
          ],
        },
      }),
    ).toThrow(/collision volume/i);
  });
});
