import type { Health, Inventory } from "@2dayz/shared";

import { InventoryPanel } from "./InventoryPanel";

type HudProps = {
  health: Health | null;
  inventory: Inventory;
  isInventoryOpen: boolean;
  onToggleInventory: () => void;
  playerEntityId: string | null;
  roomId: string | null;
};

export const Hud = ({ health, inventory, isInventoryOpen, onToggleInventory, playerEntityId, roomId }: HudProps) => {
  const equippedWeapon = inventory.equippedWeaponSlot === null ? null : inventory.slots[inventory.equippedWeaponSlot];
  const totalAmmo = inventory.ammoStacks.reduce((count, stack) => count + stack.quantity, 0);

  return (
    <section className="hud-card">
      <h2>Session HUD</h2>
      <div className="status-row">
        <span className="status-pill">Health: {health ? `${health.current}/${health.max}` : "pending"}</span>
        <span className="status-pill">Weapon: {equippedWeapon?.itemId ?? "none"}</span>
        <span className="status-pill">Ammo: {totalAmmo}</span>
        <span className="status-pill">Player: {playerEntityId ?? "pending"}</span>
        <span className="status-pill">Room: {roomId ?? "pending"}</span>
      </div>
      <InventoryPanel inventory={inventory} isOpen={isInventoryOpen} onToggle={onToggleInventory} />
    </section>
  );
};
