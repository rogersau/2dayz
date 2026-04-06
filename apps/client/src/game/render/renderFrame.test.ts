import { describe, expect, it, vi } from "vitest";

import { renderFrame } from "./renderFrame";

describe("renderFrame", () => {
  it("uses the same resolved local transform for the camera and local player rendering", () => {
    const camera = {
      lookAt: vi.fn(),
      position: { x: 18, y: 22, z: 18 },
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
  });
});
