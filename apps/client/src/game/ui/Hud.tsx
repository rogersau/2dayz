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
  const occupiedSlots = inventory.slots.filter((slot) => slot !== null).length;
  const inventorySummary = `${occupiedSlots}/${inventory.slots.length} slots filled`;

  return (
    <section aria-label="survival hud" className="hud-card survival-hud">
      <div className="hud-primary-grid">
        <article className="hud-module hud-module-critical">
          <span className="hud-module-label">Health</span>
          <strong className="hud-module-value">{health ? `${health.current}/${health.max}` : "pending"}</strong>
          <span className="hud-module-detail">{health?.isDead ? "Vital signs lost" : "Stable for now"}</span>
        </article>

        <article className="hud-module">
          <span className="hud-module-label">Ammo</span>
          <strong className="hud-module-value">{totalAmmo}</strong>
          <span className="hud-module-detail">Weapon: {equippedWeapon?.itemId ?? "none"}</span>
        </article>

        <article className="hud-module">
          <span className="hud-module-label">Inventory</span>
          <strong className="hud-module-value">{inventorySummary}</strong>
          <span className="hud-module-detail">Ready slots and field supplies</span>
        </article>
      </div>

      <div className="hud-secondary-strip" aria-label="session metadata">
        <span className="status-pill">Player: {playerEntityId ?? "pending"}</span>
        <span className="status-pill">Room: {roomId ?? "pending"}</span>
      </div>

      <InventoryPanel inventory={inventory} isOpen={isInventoryOpen} onToggle={onToggleInventory} />
    </section>
  );
};
