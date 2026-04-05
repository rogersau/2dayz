import { describe, expect, it } from "vitest";

import { createCollisionIndex, isCirclePositionBlocked } from "./collision";
import { loadMapDefinition } from "./loadMapDefinition";

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
});
