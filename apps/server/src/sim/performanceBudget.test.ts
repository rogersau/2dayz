import { describe, expect, it } from "vitest";

import { createRoomSimulationConfig } from "./state";

describe("createRoomSimulationConfig", () => {
  it("keeps room budgets inside the v1 player, tick, zombie, and dropped-item limits", () => {
    expect(createRoomSimulationConfig()).toMatchObject({
      playerCapacity: 12,
      tickRateHz: 20,
      maxZombies: 24,
      maxDroppedItems: 64,
    });

    expect(() => createRoomSimulationConfig({ playerCapacity: 7 })).toThrow(/player capacity/i);
    expect(() => createRoomSimulationConfig({ playerCapacity: 13 })).toThrow(/player capacity/i);
    expect(() => createRoomSimulationConfig({ tickRateHz: 19 })).toThrow(/tick rate/i);
    expect(() => createRoomSimulationConfig({ tickRateHz: 31 })).toThrow(/tick rate/i);
    expect(() => createRoomSimulationConfig({ maxZombies: 0 })).toThrow(/zombie/i);
    expect(() => createRoomSimulationConfig({ maxDroppedItems: 0 })).toThrow(/dropped item/i);
  });
});
