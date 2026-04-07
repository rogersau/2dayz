import type { Health, Inventory } from "@2dayz/shared";

export type HudStateInput = {
  health: Health | null;
  inventory: Pick<Inventory, "ammoStacks" | "equippedWeaponSlot" | "slots">;
  playerEntityId: string | null;
  roomId: string | null;
};

export type HudState = {
  ammoValue: string;
  equippedWeaponDetail: string;
  healthDetail: string;
  healthValue: string;
  inventorySummary: string;
  playerLabel: string;
  roomLabel: string;
};

export const deriveHudState = ({ health, inventory, playerEntityId, roomId }: HudStateInput): HudState => {
  const equippedWeapon = inventory.equippedWeaponSlot === null ? null : inventory.slots[inventory.equippedWeaponSlot];
  const totalAmmo = inventory.ammoStacks.reduce((count, stack) => count + stack.quantity, 0);
  const occupiedSlots = inventory.slots.filter((slot) => slot !== null).length;

  return {
    ammoValue: String(totalAmmo),
    equippedWeaponDetail: `Weapon: ${equippedWeapon?.itemId ?? "none"}`,
    healthDetail: health?.isDead ? "Vital signs lost" : "Stable for now",
    healthValue: health ? `${health.current}/${health.max}` : "pending",
    inventorySummary: `${occupiedSlots}/${inventory.slots.length} slots filled`,
    playerLabel: `Player: ${playerEntityId ?? "pending"}`,
    roomLabel: `Room: ${roomId ?? "pending"}`,
  };
};
