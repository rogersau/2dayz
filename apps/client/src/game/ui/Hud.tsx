import type { Inventory } from "@2dayz/shared";

import { InventoryPanel } from "./InventoryPanel";

type HudProps = {
  inventory: Inventory;
  isInventoryOpen: boolean;
  onToggleInventory: () => void;
};

export const Hud = ({ inventory, isInventoryOpen, onToggleInventory }: HudProps) => {
  return (
    <section className="hud-card survival-hud">
      <InventoryPanel inventory={inventory} isOpen={isInventoryOpen} onToggle={onToggleInventory} />
    </section>
  );
};
