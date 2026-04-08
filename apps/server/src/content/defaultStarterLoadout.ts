import type { Inventory } from "@2dayz/shared";

export const defaultStarterLoadout: Inventory = {
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
};
