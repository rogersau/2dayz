import { describe, expect, it } from "vitest";

import * as shared from "../index";
import { mapDefinitionSchema } from "./maps";

describe("thirdPersonSliceMap", () => {
  it("exports the shared third-person encounter map with the expected authored landmarks", () => {
    const map = mapDefinitionSchema.parse((shared as Record<string, unknown>).thirdPersonSliceMap);

    expect(map.mapId).toBe("map_third-person-yard");
    expect(map.collisionVolumes.map((volume) => volume.volumeId)).toEqual(
      expect.arrayContaining(["volume_north-barricade", "volume_central-truck", "volume_east-shed"]),
    );
    expect(map.zombieSpawnZones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          zoneId: "zone_north-lane",
          archetypeIds: expect.arrayContaining(["zombie_shambler", "zombie_runner"]),
        }),
        expect.objectContaining({
          zoneId: "zone_south-lane",
          archetypeIds: ["zombie_shambler"],
        }),
      ]),
    );
    expect(map.respawnPoints.map((point) => point.pointId)).toEqual(
      expect.arrayContaining([
        "point_respawn-west-entry",
        "point_respawn-south-entry",
        "point_respawn-east-entry",
        "point_respawn-north-entry",
      ]),
    );
    expect(map.interactablePlacements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementId: "placement_field-cache",
          kind: "crate",
          prompt: "Search cache",
        }),
      ]),
    );
    expect(map.navigation.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "node_west-entry", to: "node_north-lane", cost: 10 }),
        expect.objectContaining({ from: "node_north-lane", to: "node_center-east", cost: 14 }),
      ]),
    );
  });
});
