import type { Health, Inventory } from "@2dayz/shared";
import { describe, expect, it } from "vitest";

import { deriveHudState } from "./hudState";

const createInventory = (overrides: Partial<Inventory> = {}): Inventory => ({
  ammoStacks: [],
  equippedWeaponSlot: null,
  slots: [null, null, null, null, null, null],
  ...overrides,
});

describe("deriveHudState", () => {
  it("derives hud values for populated and fallback player state", () => {
    const healthyHudState = deriveHudState({
      health: { current: 86, isDead: false, max: 100 },
      inventory: createInventory({
        ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 21 }],
        equippedWeaponSlot: 0,
        slots: [
          { itemId: "weapon_pistol", quantity: 1 },
          { itemId: "bandage", quantity: 2 },
          null,
          null,
          null,
          null,
        ],
      }),
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
    });

    expect(healthyHudState).toEqual({
      ammoValue: "21",
      equippedWeaponDetail: "Weapon: weapon_pistol",
      healthDetail: "Stable for now",
      healthValue: "86/100",
      inventorySummary: "2/6 slots filled",
      playerLabel: "Player: player_survivor",
      roomLabel: "Room: room_browser-v1",
    });

    const deadHudState = deriveHudState({
      health: { current: 0, isDead: true, max: 100 } satisfies Health,
      inventory: createInventory(),
      playerEntityId: null,
      roomId: null,
    });

    expect(deadHudState).toEqual({
      ammoValue: "0",
      equippedWeaponDetail: "Weapon: none",
      healthDetail: "Vital signs lost",
      healthValue: "0/100",
      inventorySummary: "0/6 slots filled",
      playerLabel: "Player: pending",
      roomLabel: "Room: pending",
    });

    const pendingHudState = deriveHudState({
      health: null,
      inventory: createInventory(),
      playerEntityId: null,
      roomId: null,
    });

    expect(pendingHudState.healthValue).toBe("pending");
    expect(pendingHudState.healthDetail).toBe("Stable for now");
  });
});
