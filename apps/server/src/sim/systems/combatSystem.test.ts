import { describe, expect, it } from "vitest";

import { createCollisionIndex } from "../../world/collision";
import { createLifecycleSystem } from "./lifecycleSystem";
import { createCombatSystem } from "./combatSystem";
import { createInventorySystem } from "./inventorySystem";
import { createRoomState, queueInputIntent, queueSpawnPlayer } from "../state";

const spawnPlayer = (state: ReturnType<typeof createRoomState>, entityId: string, displayName: string, x: number, y: number) => {
  queueSpawnPlayer(state, {
    entityId,
    displayName,
    position: { x, y },
  });
  createLifecycleSystem().update(state, 0);

  const player = state.players.get(entityId);
  if (!player) {
    throw new Error(`expected player ${entityId} to exist`);
  }

  player.inventory.slots[0] = { itemId: "item_revolver", quantity: 1 };
  player.inventory.equippedWeaponSlot = 0;
  player.inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 12 }];
  player.weaponState = {
    magazineAmmo: 6,
    isReloading: false,
    reloadRemainingMs: 0,
    fireCooldownRemainingMs: 0,
  };

  return player;
};

describe("createCombatSystem", () => {
  it("lets a freshly spawned player fire once without test-only inventory setup", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-starter-1",
      displayName: "Avery",
      position: { x: 0, y: 0 },
    });
    createLifecycleSystem().update(state, 0);

    const attacker = state.players.get("player_test-starter-1");
    if (!attacker) {
      throw new Error("expected spawned player");
    }

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);

    expect(attacker.weaponState.magazineAmmo).toBe(5);
  });

  it("applies authoritative hitscan damage and consumes ammo when a valid shot lands", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-1", "Avery", 0, 0);
    const target = spawnPlayer(state, "player_test-2", "Blair", 4, 0);

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);

    expect(attacker.weaponState?.magazineAmmo).toBe(5);
    expect(target.health.current).toBe(65);
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "shot",
        attackerEntityId: attacker.entityId,
        aim: { x: 1, y: 0 },
        origin: { x: attacker.transform.x, y: attacker.transform.y },
        weaponItemId: "item_revolver",
      }),
    );
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "combat",
        attackerEntityId: attacker.entityId,
        targetEntityId: target.entityId,
        weaponItemId: "item_revolver",
        damage: 35,
      }),
    );
  });

  it("emits the current authoritative aim vector on shot events", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-aim-1", "Avery", 0, 0);

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 12, y: -4 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);

    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "shot",
        aim: { x: 12, y: -4 },
      }),
    );
  });

  it("does not emit a shot event or consume ammo when fire input has zero aim", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-aim-2", "Blair", 0, 0);

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);

    expect(attacker.weaponState.magazineAmmo).toBe(6);
    expect(state.events).toEqual([]);
  });

  it("rejects blocked or otherwise invalid fire requests without consuming ammo", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-3", "Casey", 0, 0);
    const target = spawnPlayer(state, "player_test-4", "Devon", 4, 0);

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
      actions: { fire: true },
    });
    createCombatSystem().update(state, 0.1);

    attacker.weaponState = {
      magazineAmmo: 0,
      isReloading: true,
      reloadRemainingMs: 500,
      fireCooldownRemainingMs: 0,
    };
    queueInputIntent(state, attacker.entityId, {
      sequence: 2,
      movement: { x: 0, y: 0 },
      aim: { x: 0, y: 0 },
      actions: { fire: true },
    });
    createCombatSystem().update(state, 0.1);

    expect(attacker.weaponState?.magazineAmmo).toBe(0);
    expect(target.health.current).toBe(100);
    expect(state.events).toHaveLength(0);
  });

  it("consumes ammo and applies fire-rate cooldown when a valid shot misses", () => {
    const state = createRoomState({
      roomId: "room_test",
      world: {
        map: {
          mapId: "map_test",
          name: "Test",
          bounds: { width: 20, height: 20 },
          collisionVolumes: [],
          zombieSpawnZones: [],
          lootPoints: [],
          respawnPoints: [],
          interactablePlacements: [],
          navigation: {
            nodes: [{ nodeId: "node_a", position: { x: 0, y: 0 } }],
            links: [{ from: "node_a", to: "node_a", cost: 1 }],
          },
        },
        collision: createCollisionIndex([
          {
            volumeId: "volume_wall",
            kind: "box",
            position: { x: 2, y: 0 },
            size: { width: 1, height: 4 },
          },
        ]),
        navigation: {
          nodes: new Map(),
          neighbors: new Map(),
        },
        respawnPoints: [],
      },
    });
    const attacker = spawnPlayer(state, "player_test-6", "Finley", 0, 0);
    spawnPlayer(state, "player_test-7", "Gray", 4, 0);

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);

    expect(attacker.weaponState.magazineAmmo).toBe(5);
    expect(attacker.weaponState.fireCooldownRemainingMs).toBeGreaterThan(0);
    expect(state.events).toEqual([
      expect.objectContaining({
        type: "shot",
        attackerEntityId: attacker.entityId,
        aim: { x: 1, y: 0 },
        origin: { x: attacker.transform.x, y: attacker.transform.y },
        weaponItemId: "item_revolver",
      }),
    ]);

    queueInputIntent(state, attacker.entityId, {
      sequence: 2,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);

    expect(attacker.weaponState.magazineAmmo).toBe(5);
  });

  it("keeps reload timing authoritative and refills the magazine from carried ammo", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-5", "Elliot", 0, 0);

    attacker.weaponState = {
      magazineAmmo: 0,
      isReloading: false,
      reloadRemainingMs: 0,
      fireCooldownRemainingMs: 0,
    };

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { reload: true },
    });

    const combatSystem = createCombatSystem();
    combatSystem.update(state, 0.5);
    expect(attacker.weaponState).toMatchObject({
      magazineAmmo: 0,
      isReloading: true,
    });

    combatSystem.update(state, 0.7);
    expect(attacker.weaponState).toMatchObject({
      magazineAmmo: 6,
      isReloading: false,
      reloadRemainingMs: 0,
    });
    expect(attacker.inventory.ammoStacks).toEqual([{ ammoItemId: "item_pistol-ammo", quantity: 6 }]);
  });

  it("uses the weapon spread stat when resolving hitscan aim", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-spread-1", "Avery", 0, 0);
    const target = spawnPlayer(state, "player_test-spread-2", "Blair", 4, 0.8);

    const weaponDefinition = state.weaponDefinitions.get("item_revolver");
    if (!weaponDefinition) {
      throw new Error("expected revolver definition");
    }

    weaponDefinition.spread = 0.2;

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem({ random: () => 1 }).update(state, 0.1);

    expect(target.health.current).toBe(65);
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "shot",
        attackerEntityId: attacker.entityId,
        aim: expect.objectContaining({
          x: expect.closeTo(Math.cos(0.2), 5),
          y: expect.closeTo(Math.sin(0.2), 5),
        }),
      }),
    );
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "combat",
        attackerEntityId: attacker.entityId,
        targetEntityId: target.entityId,
      }),
    );
  });

  it("preserves firearm killer attribution on the resulting death event", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-kill-1", "Avery", 0, 0);
    const target = spawnPlayer(state, "player_test-kill-2", "Blair", 4, 0);
    target.health.current = 35;

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);
    createInventorySystem().update(state);

    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "death",
        victimEntityId: target.entityId,
        killerEntityId: attacker.entityId,
      }),
    );
  });

  it("emits shot origin from the fire tick even if the attacker moves before render", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-origin-1", "Avery", 2, 3);

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 0, y: 1 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);
    attacker.transform.x = 9;
    attacker.transform.y = 11;

    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "shot",
        attackerEntityId: attacker.entityId,
        origin: { x: 2, y: 3 },
      }),
    );
  });

  it("hits the nearest valid target when multiple entities overlap the same firing lane", () => {
    const state = createRoomState({ roomId: "room_test" });
    const attacker = spawnPlayer(state, "player_test-lane-1", "Avery", 0, 0);
    const nearTarget = spawnPlayer(state, "player_test-lane-2", "Blair", 3, 0.6);
    const farTarget = spawnPlayer(state, "player_test-lane-3", "Casey", 3.05, 0);

    queueInputIntent(state, attacker.entityId, {
      sequence: 1,
      movement: { x: 0, y: 0 },
      aim: { x: 1, y: 0 },
      actions: { fire: true },
    });

    createCombatSystem().update(state, 0.1);

    expect(nearTarget.health.current).toBe(65);
    expect(farTarget.health.current).toBe(100);
    expect(state.events).toContainEqual(
      expect.objectContaining({
        type: "combat",
        attackerEntityId: attacker.entityId,
        targetEntityId: nearTarget.entityId,
      }),
    );
  });
});
