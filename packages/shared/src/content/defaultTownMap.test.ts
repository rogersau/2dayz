import { describe, expect, it } from "vitest";

import { mapDefinitionSchema } from "./maps";
import { defaultTownMap } from "./defaultTownMap";

describe("defaultTownMap", () => {
  it("exports the shared default town map with the expected landmark volumes", () => {
    const map = mapDefinitionSchema.parse(defaultTownMap);

    expect(map.mapId).toBe("map_default-town");
    expect(map.collisionVolumes.map((volume) => volume.volumeId)).toEqual(
      expect.arrayContaining(["volume_market", "volume_police-station", "volume_barn"]),
    );
    expect(map.interactablePlacements.map((placement) => placement.placementId)).toEqual(
      expect.arrayContaining(["placement_market-crate", "placement_police-door"]),
    );
  });
});
