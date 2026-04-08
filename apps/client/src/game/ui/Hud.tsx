import type { Inventory } from "@2dayz/shared";

import { InventoryPanel } from "./InventoryPanel";
import { QuickbarHud } from "./QuickbarHud";

type HudProps = {
  inventory: Inventory;
  isInventoryOpen: boolean;
  onSelectSlot: (slotIndex: number) => void;
  onToggleInventory: () => void;
};

export const Hud = ({ inventory, isInventoryOpen, onSelectSlot, onToggleInventory }: HudProps) => {
  return (
    <div className="joined-hud-layout">
      <QuickbarHud inventory={inventory} onSelectSlot={onSelectSlot} />
      <InventoryPanel inventory={inventory} isOpen={isInventoryOpen} onToggle={onToggleInventory} />
    </div>
  );
};
