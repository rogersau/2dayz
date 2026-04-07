import { describe, expect, it } from "vitest";

import {
  ammoStackSchema,
  deathDropSchema,
  inventoryActionSchema,
  inventorySchema,
  inventorySlotSchema,
} from "./inventory";

describe("inventory contracts", () => {
  it("supports a compact inventory with item slots and ammo stacks", () => {
    expect(
      inventorySchema.parse({
        slots: [
          { itemId: "m9", quantity: 1 },
          { itemId: "bandage", quantity: 2 },
          null,
          null,
          null,
          null,
        ],
        equippedWeaponSlot: 0,
        ammoStacks: [
          { ammoItemId: "9mm-rounds", quantity: 24 },
          { ammoItemId: "12g-shells", quantity: 8 },
        ],
      }),
    ).toMatchObject({ equippedWeaponSlot: 0 });

    expect(
      inventorySlotSchema.parse({
        itemId: "bandage",
        quantity: 1,
      }),
    ).toMatchObject({ itemId: "bandage", quantity: 1 });

    expect(
      ammoStackSchema.parse({
        ammoItemId: "9mm-rounds",
        quantity: 12,
      }),
    ).toMatchObject({ ammoItemId: "9mm-rounds", quantity: 12 });
  });

  it("supports pickup actions and death-drop payloads", () => {
    expect(
      inventoryActionSchema.parse({
        type: "pickup",
        pickupEntityId: "loot_001",
        toSlot: 2,
      }),
    ).toMatchObject({ type: "pickup", toSlot: 2 });

    expect(
      inventoryActionSchema.parse({
        type: "equip",
        toSlot: 1,
      }),
    ).toMatchObject({ type: "equip", toSlot: 1 });

    expect(
      deathDropSchema.parse({
        ownerEntityId: "player_1",
        roomId: "room_alpha",
        inventory: {
          slots: [
            { itemId: "m9", quantity: 1 },
            null,
            null,
            null,
            null,
            null,
          ],
          equippedWeaponSlot: 0,
          ammoStacks: [{ ammoItemId: "9mm-rounds", quantity: 10 }],
        },
        position: { x: 22, y: 18 },
      }),
    ).toMatchObject({ ownerEntityId: "player_1", roomId: "room_alpha" });
  });

  it("rejects invalid inventory payloads", () => {
    expect(() =>
      inventorySchema.parse({
        slots: [{ itemId: "m9", quantity: 1 }],
        equippedWeaponSlot: 4,
        ammoStacks: [],
      }),
    ).toThrow();

    expect(() =>
      inventoryActionSchema.parse({
        type: "pickup",
        pickupEntityId: "",
        toSlot: -1,
      }),
    ).toThrow();

    expect(() =>
      deathDropSchema.parse({
        ownerEntityId: "player_1",
        roomId: "room_alpha",
        inventory: {
          slots: [null, null, null, null, null, null],
          equippedWeaponSlot: 9,
          ammoStacks: [],
        },
        position: { x: 22 },
      }),
    ).toThrow();
  });
});
