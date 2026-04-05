import { describe, expect, it } from "vitest";

import { createRoomFactory } from "./roomFactory";

describe("createRoomFactory", () => {
  it("creates authoritative simulation room runtimes for live rooms", () => {
    const room = createRoomFactory({ roomCapacity: 12 })();

    expect(room).toHaveProperty("simulationState");
    expect(room).toHaveProperty("advance");
    expect(typeof room.queueInput).toBe("function");
    expect(typeof room.subscribePlayer).toBe("function");
    expect(room.capacity).toBe(12);
  });
});
