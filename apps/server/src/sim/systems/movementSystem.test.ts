import { describe, expect, it } from "vitest";

import { createRoomReplicationDelta } from "../query";
import { createRoomSimulationConfig, createRoomState, queueInputIntent, queueSpawnPlayer } from "../state";
import { createLifecycleSystem } from "./lifecycleSystem";
import { createMovementSystem } from "./movementSystem";

const fillInventorySlots = (count: number, quantity = 1) => {
  return Array.from({ length: 6 }, (_, index) =>
    index < count
      ? {
          itemId: "item_bandage",
          quantity,
        }
      : null,
  );
};

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

  it("moves faster while sprinting than at base walking speed", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        maxPlayerSpeed: 4,
        sprintSpeedMultiplier: 1.5,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-sprint-speed",
      displayName: "Harper",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    queueInputIntent(state, "player_test-sprint-speed", {
      ...defaultIntent,
      movement: { x: 1, y: 0 },
      actions: { sprint: true },
    });

    createMovementSystem().update(state, 1);

    const player = state.players.get("player_test-sprint-speed");
    expect(player?.transform.x).toBeCloseTo(6);
    expect(player?.velocity).toEqual({ x: 6, y: 0 });
  });

  it("drains stamina only while sprinting and moving", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        staminaBaseline: 10,
        staminaFloor: 4,
        staminaDrainPerSecond: 2,
        staminaRegenPerSecond: 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-stamina-drain",
      displayName: "Indigo",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-stamina-drain");
    if (!player) {
      throw new Error("expected player to exist");
    }

    queueInputIntent(state, "player_test-stamina-drain", {
      ...defaultIntent,
      sequence: 1,
      movement: { x: 1, y: 0 },
      actions: { sprint: true },
    });
    createMovementSystem().update(state, 1);
    expect(player.stamina).toMatchObject({ current: 8, max: 10 });

    queueInputIntent(state, "player_test-stamina-drain", {
      ...defaultIntent,
      sequence: 2,
      movement: { x: 0, y: 0 },
      actions: { sprint: true },
    });
    createMovementSystem().update(state, 1);
    expect(player.stamina).toMatchObject({ current: 9, max: 10 });
  });

  it("does not drain stamina when sprinting into blocked movement", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        staminaBaseline: 10,
        staminaFloor: 4,
        staminaDrainPerSecond: 2,
        staminaRegenPerSecond: 1,
        isPositionBlocked: (position) => position.x >= 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-blocked-sprint",
      displayName: "Ira",
      position: { x: 0.5, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-blocked-sprint");
    if (!player) {
      throw new Error("expected player to exist");
    }

    queueInputIntent(state, "player_test-blocked-sprint", {
      ...defaultIntent,
      sequence: 1,
      movement: { x: 1, y: 0 },
      actions: { sprint: true },
    });

    createMovementSystem().update(state, 1);

    expect(player.transform).toMatchObject({ x: 0.5, y: 0, rotation: 0 });
    expect(player.velocity).toEqual({ x: 0, y: 0 });
    expect(player.stamina).toMatchObject({ current: 10, max: 10 });
  });

  it("regenerates stamina while not sprinting", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        staminaBaseline: 10,
        staminaFloor: 4,
        staminaDrainPerSecond: 2,
        staminaRegenPerSecond: 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-stamina-regen",
      displayName: "Jules",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-stamina-regen");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.stamina.current = 5;
    queueInputIntent(state, "player_test-stamina-regen", {
      ...defaultIntent,
      sequence: 1,
      movement: { x: 1, y: 0 },
    });

    createMovementSystem().update(state, 1);

    expect(player.stamina).toMatchObject({ current: 6, max: 10 });
  });

  it("reduces max stamina for heavier inventories including stacked slot quantities", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        staminaBaseline: 10,
        staminaFloor: 4,
        staminaLoadPenalty: 0.5,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-heavy-load",
      displayName: "Kai",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-heavy-load");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.inventory.slots = fillInventorySlots(1, 3);
    player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 30 }];
    queueInputIntent(state, "player_test-heavy-load", {
      ...defaultIntent,
      sequence: 1,
    });

    createMovementSystem().update(state, 0);

    expect(player.stamina.max).toBe(8.5);
    expect(player.stamina.current).toBe(8.5);
  });

  it("clamps current stamina down when inventory load increases after spawn", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        staminaBaseline: 10,
        staminaFloor: 4,
        staminaLoadPenalty: 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-stamina-clamp",
      displayName: "Lane",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-stamina-clamp");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.stamina.current = 9;
    player.inventory.slots = fillInventorySlots(3);
    player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 30 }];
    queueInputIntent(state, "player_test-stamina-clamp", {
      ...defaultIntent,
      sequence: 1,
    });

    createMovementSystem().update(state, 0);

    expect(player.stamina).toMatchObject({ current: 6, max: 6 });
  });

  it("falls back to normal walking speed when stamina is empty", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        maxPlayerSpeed: 4,
        sprintSpeedMultiplier: 1.5,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-zero-stamina",
      displayName: "Marlow",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-zero-stamina");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.stamina.current = 0;
    queueInputIntent(state, "player_test-zero-stamina", {
      ...defaultIntent,
      sequence: 1,
      movement: { x: 1, y: 0 },
      actions: { sprint: true },
    });

    createMovementSystem().update(state, 1);

    expect(player.transform.x).toBeCloseTo(4);
    expect(player.velocity).toEqual({ x: 4, y: 0 });
    expect(player.stamina.current).toBeGreaterThan(0);
  });

  it("recomputes stamina max from current carried items after inventory changes", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        staminaBaseline: 10,
        staminaFloor: 4,
        staminaLoadPenalty: 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-dynamic-load",
      displayName: "Nico",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-dynamic-load");
    if (!player) {
      throw new Error("expected player to exist");
    }

    expect(player.stamina).toMatchObject({ current: 10, max: 10 });

    player.inventory.slots = fillInventorySlots(1, 2);
    player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 15 }];
    queueInputIntent(state, "player_test-dynamic-load", {
      ...defaultIntent,
      sequence: 1,
    });
    createMovementSystem().update(state, 0);

    expect(player.stamina.max).toBeCloseTo(8);
    expect(player.stamina.current).toBeCloseTo(8);
  });

  it("recomputes and clamps stamina from inventory changes without movement input", () => {
    const state = createRoomState({
      roomId: "room_test",
      config: createRoomSimulationConfig({
        staminaBaseline: 10,
        staminaFloor: 4,
        staminaLoadPenalty: 1,
      }),
    });

    queueSpawnPlayer(state, {
      entityId: "player_test-passive-load",
      displayName: "Owen",
      position: { x: 0, y: 0 },
    });

    createLifecycleSystem().update(state, 0);
    const player = state.players.get("player_test-passive-load");
    if (!player) {
      throw new Error("expected player to exist");
    }

    player.stamina.current = 10;
    player.inventory.slots = fillInventorySlots(3);
    player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 30 }];

    createMovementSystem().update(state, 0);

    expect(player.stamina).toMatchObject({ current: 6, max: 6 });
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
