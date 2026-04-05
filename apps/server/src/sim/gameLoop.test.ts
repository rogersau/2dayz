import { describe, expect, it } from "vitest";

import { serverMessageSchema } from "@2dayz/shared";

import { createSimulationRoomRuntime } from "../rooms/roomRuntime";
import { createLifecycleSystem } from "./systems/lifecycleSystem";

describe("createSimulationRoomRuntime", () => {
  it("steps systems in deterministic fixed-tick order and emits snapshot and delta messages", () => {
    const callOrder: string[] = [];
    const snapshots: unknown[] = [];
    const deltas: unknown[] = [];
    const runtime = createSimulationRoomRuntime({
      roomId: "room_test",
      onSnapshot(snapshot) {
        snapshots.push(snapshot);
      },
      onDelta(delta) {
        deltas.push(delta);
      },
      systems: [
        createLifecycleSystem(),
        {
          name: "movement",
          update() {
            callOrder.push("movement");
          },
        },
      ],
    });

    const joined = runtime.joinPlayer({ displayName: "Avery" });

    runtime.advance(49);
    runtime.advance(1);

    expect(joined).toEqual({ roomId: "room_test", playerEntityId: "player_test-1" });
    expect(callOrder).toEqual(["movement"]);
    expect(snapshots).toHaveLength(1);
    expect(deltas).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      type: "snapshot",
      roomId: "room_test",
      tick: 1,
      playerEntityId: "player_test-1",
      players: [
        {
          entityId: "player_test-1",
          transform: { x: 0, y: 0, rotation: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
    });
    expect(deltas[0]).toMatchObject({
      type: "delta",
      roomId: "room_test",
      tick: 1,
    });
    expect(serverMessageSchema.parse(snapshots[0])).toMatchObject({
      type: "snapshot",
      players: [
        {
          entityId: "player_test-1",
          transform: { x: 0, y: 0, rotation: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
    });
  });
});
