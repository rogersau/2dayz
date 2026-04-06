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

  it("applies nearby replication caps to live subscriber snapshots", () => {
    const snapshots: Array<{
      playerEntityId: string;
      players: Array<{ entityId: string }>;
      loot: Array<{ entityId: string }>;
      zombies: Array<{ entityId: string }>;
    }> = [];
    const runtime = createSimulationRoomRuntime({
      roomId: "room_test",
      systems: [createLifecycleSystem()],
      replication: {
        nearbyRadius: 10,
        maxNearbyPlayers: 2,
        maxNearbyLoot: 1,
        maxNearbyZombies: 1,
      },
    });

    const joined = runtime.joinPlayer({ displayName: "Avery" });
    runtime.joinPlayer({ displayName: "Blair" });
    runtime.joinPlayer({ displayName: "Casey" });
    runtime.joinPlayer({ displayName: "Devon" });

    runtime.tick();

    runtime.simulationState.players.get("player_test-2")!.transform = { x: 2, y: 0, rotation: 0 };
    runtime.simulationState.players.get("player_test-3")!.transform = { x: 4, y: 0, rotation: 0 };
    runtime.simulationState.players.get("player_test-4")!.transform = { x: 30, y: 0, rotation: 0 };
    runtime.simulationState.loot.set("loot_test-near", {
      entityId: "loot_test-near",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 3, y: 0 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    runtime.simulationState.loot.set("loot_test-far", {
      entityId: "loot_test-far",
      itemId: "item_bandage",
      quantity: 1,
      position: { x: 30, y: 0 },
      ownerEntityId: null,
      sourcePointId: null,
    });
    runtime.simulationState.zombies.set("zombie_test-near", {
      entityId: "zombie_test-near",
      archetypeId: "zombie_shambler",
      transform: { x: 5, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });
    runtime.simulationState.zombies.set("zombie_test-far", {
      entityId: "zombie_test-far",
      archetypeId: "zombie_shambler",
      transform: { x: 40, y: 0, rotation: 0 },
      velocity: { x: 0, y: 0 },
      health: { current: 60, max: 60, isDead: false },
      state: "idle",
      aggroTargetEntityId: null,
      attackCooldownRemainingMs: 0,
      lostTargetMs: 0,
    });

    runtime.subscribePlayer(joined.playerEntityId, {
      onSnapshot(snapshot) {
        snapshots.push(snapshot as typeof snapshots[number]);
      },
      onDelta() {
        // not needed here
      },
    });

    expect(snapshots[0]).toMatchObject({
      playerEntityId: joined.playerEntityId,
      players: [
        { entityId: "player_test-1" },
        { entityId: "player_test-2" },
      ],
      loot: [{ entityId: "loot_test-near" }],
      zombies: [{ entityId: "zombie_test-near" }],
    });
  });

  it("does not re-emit snapshot entities as entered on the first post-join delta", () => {
    const snapshots: Array<{ players: Array<{ entityId: string }> }> = [];
    const deltas: Array<{ enteredEntities: Array<{ entityId: string }> }> = [];
    const runtime = createSimulationRoomRuntime({
      roomId: "room_test",
      systems: [createLifecycleSystem()],
      replication: {
        nearbyRadius: 10,
        maxNearbyPlayers: 2,
      },
    });

    const joined = runtime.joinPlayer({ displayName: "Avery" });
    runtime.joinPlayer({ displayName: "Blair" });
    runtime.subscribePlayer(joined.playerEntityId, {
      onSnapshot(snapshot) {
        snapshots.push(snapshot as typeof snapshots[number]);
      },
      onDelta(delta) {
        deltas.push(delta as typeof deltas[number]);
      },
    });

    runtime.tick();

    expect(snapshots[0]).toMatchObject({
      players: [{ entityId: "player_test-1" }, { entityId: "player_test-2" }],
    });
    expect(deltas[0]).toMatchObject({ enteredEntities: [] });
  });
});
