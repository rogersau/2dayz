import { describe, expect, it } from "vitest";

import { createLifecycleSystem } from "./systems/lifecycleSystem";
import { createRoomState, queueSpawnPlayer } from "./state";

describe("simulation state starter loadout", () => {
  it("spawns players with the configured starter loadout and active revolver state", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-starter-loadout",
      displayName: "Avery",
      position: { x: 1, y: 2 },
    });
    createLifecycleSystem().update(state, 0);

    expect(state.players.get("player_test-starter-loadout")).toMatchObject({
      inventory: {
        slots: [
          { itemId: "item_revolver", quantity: 1 },
          { itemId: "item_pipe", quantity: 1 },
          { itemId: "item_bandage", quantity: 1 },
          null,
          null,
          null,
        ],
        equippedWeaponSlot: 0,
        ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
      },
      weaponState: {
        weaponItemId: "item_revolver",
        weaponType: "firearm",
        magazineAmmo: 6,
        isBlocking: false,
        isReloading: false,
        reloadRemainingMs: 0,
        fireCooldownRemainingMs: 0,
      },
    });
  });

  it("derives spawned starter firearm state from the authored starter weapon definition", () => {
    const state = createRoomState({ roomId: "room_test" });
    const revolverDefinition = state.weaponDefinitions.get("item_revolver");

    if (!revolverDefinition || revolverDefinition.weaponType !== "firearm") {
      throw new Error("expected authored firearm revolver definition");
    }

    revolverDefinition.magazineSize = 4;

    queueSpawnPlayer(state, {
      entityId: "player_test-authored-starter",
      displayName: "Blair",
      position: { x: 3, y: 4 },
    });
    createLifecycleSystem().update(state, 0);

    expect(state.players.get("player_test-authored-starter")?.weaponState.magazineAmmo).toBe(4);
  });
});
