import { describe, expect, it } from "vitest";

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
});
