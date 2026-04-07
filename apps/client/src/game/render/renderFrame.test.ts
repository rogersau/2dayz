import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "./renderFrame";

describe("renderFrame", () => {
  it("uses the same resolved local transform for the camera and local player rendering", () => {
    const camera = {
      lookAt: vi.fn(),
      position: { x: 18, y: 22, z: 18 },
    };
    const combatEffectsView = {
      update: vi.fn(),
    };
    const entityViewStore = {
      render: vi.fn(),
    };
    const predictionController = {
      advanceSmoothing: vi.fn().mockReturnValue({ rotation: 0.3, x: 12, y: -6 }),
      syncAuthoritative: vi.fn(),
    };
    const renderer = {
      render: vi.fn(),
    };
    const scene = {};
    const store = {
      drainRenderEvents: vi.fn().mockReturnValue([]),
      getState: () => ({
        latestTick: 10,
        playerEntityId: "player_self",
        worldEntities: {
          loot: [],
          players: [
            {
              displayName: "Survivor",
              entityId: "player_self",
              inventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
              kind: "player",
              stamina: { current: 8, max: 10 },
              transform: { rotation: 0.1, x: 3, y: 4 },
              velocity: { x: 0, y: 0 },
            },
          ],
          zombies: [],
        },
      }),
    };

    renderFrame({
      camera: camera as never,
      combatEffectsView: combatEffectsView as never,
      deltaSeconds: 1 / 20,
      entityViewStore: entityViewStore as never,
      predictionController: predictionController as never,
      renderer: renderer as never,
      scene: scene as never,
      store: store as never,
    });

    expect(camera.position.x).toBe(30);
    expect(camera.position.z).toBe(12);
    expect(camera.lookAt).toHaveBeenCalledWith(12, 0, -6);
    expect(entityViewStore.render).toHaveBeenCalledWith(
      expect.objectContaining({
        localOverrides: new Map([["player_self", { rotation: 0.3, x: 12, y: -6 }]]),
      }),
    );
    expect(predictionController.syncAuthoritative).toHaveBeenCalledWith({
      authoritativeStamina: { current: 8, max: 10 },
      authoritativeTransform: { rotation: 0.1, x: 3, y: 4 },
      entityId: "player_self",
      lastProcessedSequence: -1,
    });
  });

  it("passes the resolved local transform and drained render events into combat effects", () => {
    const camera = {
      lookAt: vi.fn(),
      position: { x: 18, y: 22, z: 18 },
    };
    const combatEffectsView = {
      update: vi.fn(),
    };
    const entityViewStore = {
      markRecentCombatHit: vi.fn(),
      render: vi.fn(),
    };
    const drainedEvents = [
      {
        attackerEntityId: "player_self",
        aim: { x: 1, y: 0 },
        origin: { x: 3, y: 4 },
        roomId: "room_browser-v1",
        type: "shot",
        weaponItemId: "weapon_pistol",
      },
      {
        attackerEntityId: "player_self",
        damage: 12,
        hitPosition: { x: 18, y: 20 },
        remainingHealth: 28,
        roomId: "room_browser-v1",
        targetEntityId: "zombie_1",
        type: "combat",
        weaponItemId: "weapon_pistol",
      },
    ];
    const predictionController = {
      advanceSmoothing: vi.fn().mockReturnValue({ rotation: 0.3, x: 12, y: -6 }),
      syncAuthoritative: vi.fn(),
    };
    const renderer = {
      render: vi.fn(),
    };
    const scene = {};
    const store = {
      drainRenderEvents: vi.fn().mockReturnValue(drainedEvents),
      getState: () => ({
        latestTick: 10,
        playerEntityId: "player_self",
        worldEntities: {
          loot: [],
          players: [
            {
              displayName: "Survivor",
              entityId: "player_self",
              inventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
              kind: "player",
              stamina: { current: 7, max: 10 },
              transform: { rotation: 0.1, x: 3, y: 4 },
              velocity: { x: 0, y: 0 },
            },
          ],
          zombies: [],
        },
      }),
    };

    renderFrame({
      camera: camera as never,
      combatEffectsView: combatEffectsView as never,
      deltaSeconds: 1 / 20,
      entityViewStore: entityViewStore as never,
      predictionController: predictionController as never,
      renderer: renderer as never,
      scene: scene as never,
      store: store as never,
    });

    expect(store.drainRenderEvents).toHaveBeenCalledTimes(1);
    expect(entityViewStore.markRecentCombatHit).toHaveBeenCalledWith("zombie_1");
    expect(combatEffectsView.update).toHaveBeenCalledWith({
      deltaSeconds: 1 / 20,
      entityViewStore,
      renderEvents: drainedEvents,
      shooterTransforms: new Map([["player_self", { rotation: 0.3, x: 12, y: -6 }]]),
    });
  });
});
