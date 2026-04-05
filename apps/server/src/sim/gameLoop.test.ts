import { describe, expect, it } from "vitest";

import { createSimulationRoomRuntime } from "../rooms/roomRuntime";
import { createLifecycleSystem } from "./systems/lifecycleSystem";

describe("createSimulationRoomRuntime", () => {
  it("emits one initial snapshot to a subscriber and deltas on later ticks", () => {
    const callOrder: string[] = [];
    const snapshots: unknown[] = [];
    const deltas: unknown[] = [];
    const runtime = createSimulationRoomRuntime({
      roomId: "room_test",
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
    runtime.subscribePlayer(joined.playerEntityId, {
      onSnapshot(snapshot) {
        snapshots.push(snapshot);
      },
      onDelta(delta) {
        deltas.push(delta);
      },
    });

    runtime.advance(49);
    runtime.advance(1);
    runtime.advance(50);

    expect(joined).toMatchObject({ roomId: "room_test", playerEntityId: "player_test-1", runtime });
    expect(callOrder).toEqual(["movement", "movement"]);
    expect(snapshots).toHaveLength(1);
    expect(deltas).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
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
    expect(deltas).toMatchObject([{ tick: 1 }, { tick: 2 }]);
  });
});
