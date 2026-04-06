import { describe, expect, it } from "vitest";

import { createRoomReplicationDelta } from "../query";
import { createRoomSimulationConfig, createRoomState, queueInputIntent, queueSpawnPlayer } from "../state";
import { createLifecycleSystem } from "./lifecycleSystem";
import { createMovementSystem } from "./movementSystem";

const defaultIntent = {
  sequence: 1,
  movement: { x: 0, y: 0 },
  aim: { x: 1, y: 0 },
  actions: {},
} as const;

describe("createMovementSystem", () => {
  it("normalizes diagonal input before applying max speed", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({ maxPlayerSpeed: 4 }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    queueInputIntent(state, "player_test-1", {
      ...defaultIntent,
      movement: { x: 1, y: 1 },
    });

    createMovementSystem().update(state, 1);

    const player = state.players.get("player_test-1");
    expect(player?.transform.x).toBeCloseTo(2.8284271247);
    expect(player?.transform.y).toBeCloseTo(2.8284271247);
    expect(Math.hypot(player?.velocity.x ?? 0, player?.velocity.y ?? 0)).toBeCloseTo(4);
  });

  it("clamps movement speed to the configured player max", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({ maxPlayerSpeed: 3 }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-2",
      displayName: "Blair",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    queueInputIntent(state, "player_test-2", {
      ...defaultIntent,
      movement: { x: 1, y: 0 },
    });

    createMovementSystem().update(state, 1);

    const player = state.players.get("player_test-2");
    expect(player?.transform.x).toBeCloseTo(3);
    expect(player?.transform.y).toBeCloseTo(0);
    expect(player?.velocity).toEqual({ x: 3, y: 0 });
  });

  it("blocks movement when the next authoritative position collides", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        maxPlayerSpeed: 4,
        isPositionBlocked: (position) => position.x >= 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-3",
      displayName: "Casey",
      position: { x: 0.5, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    queueInputIntent(state, "player_test-3", {
      ...defaultIntent,
      movement: { x: 1, y: 0 },
    });

    createMovementSystem().update(state, 1);

    const player = state.players.get("player_test-3");
    expect(player?.transform).toMatchObject({ x: 0.5, y: 0, rotation: 0 });
    expect(player?.velocity).toEqual({ x: 0, y: 0 });
  });

  it("emits authoritative transform corrections in the delta after blocked movement", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        maxPlayerSpeed: 4,
        isPositionBlocked: (position) => position.x >= 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-4",
      displayName: "Devon",
      position: { x: 0.5, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    queueInputIntent(state, "player_test-4", {
      ...defaultIntent,
      sequence: 2,
      movement: { x: 1, y: 0 },
    });

    createMovementSystem().update(state, 1);

    expect(createRoomReplicationDelta(state)).toMatchObject({
      entityUpdates: [
        {
          entityId: "player_test-4",
          transform: { x: 0.5, y: 0, rotation: 0 },
          velocity: { x: 0, y: 0 },
        },
      ],
    });
  });

  it("ignores stale input sequences after a newer authoritative intent has already been queued", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({ maxPlayerSpeed: 4 }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-5",
      displayName: "Elliot",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    queueInputIntent(state, "player_test-5", {
      ...defaultIntent,
      sequence: 2,
      movement: { x: 1, y: 0 },
    });
    queueInputIntent(state, "player_test-5", {
      ...defaultIntent,
      sequence: 1,
      movement: { x: 0, y: 1 },
    });

    createMovementSystem().update(state, 1);

    const player = state.players.get("player_test-5");
    expect(player?.transform).toMatchObject({ x: 4, y: 0, rotation: 0 });
    expect(player?.velocity).toEqual({ x: 4, y: 0 });
  });

  it("uses swept movement blocking instead of only end-position checks", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        maxPlayerSpeed: 8,
        isMovementBlocked: ({ from, to }) => from.x < 5 && to.x > 5,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-6",
      displayName: "Finley",
      position: { x: 2, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    queueInputIntent(state, "player_test-6", {
      ...defaultIntent,
      movement: { x: 1, y: 0 },
    });

    createMovementSystem().update(state, 1);

    const player = state.players.get("player_test-6");
    expect(player?.transform).toMatchObject({ x: 2, y: 0, rotation: 0 });
    expect(player?.velocity).toEqual({ x: 0, y: 0 });
  });

  it("does not process movement input for dead players before respawn", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({ maxPlayerSpeed: 4 }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-dead",
      displayName: "Gray",
      position: { x: 1, y: 1 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-dead");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.health = { current: 0, max: 100, isDead: true };
    queueInputIntent(state, "player_test-dead", {
      ...defaultIntent,
      sequence: 2,
      movement: { x: 1, y: 0 },
    });

    createMovementSystem().update(state, 1);

    expect(player.transform).toMatchObject({ x: 1, y: 1, rotation: 0 });
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(state.inputIntents.has("player_test-dead")).toBe(false);
  });
});
