import type { Inventory } from "@2dayz/shared";

type QuickbarHudProps = {
  inventory: Inventory;
  onSelectSlot: (slotIndex: number) => void;
};

export const QuickbarHud = ({ inventory, onSelectSlot }: QuickbarHudProps) => {
  return (
    <section aria-label="Quickbar" className="quickbar-hud">
      {inventory.slots.map((slot, index) => {
        const itemLabel = slot ? `${slot.itemId} x${slot.quantity}` : "Empty";
        const isEquipped = inventory.equippedWeaponSlot === index;

        return (
          <button
            aria-label={`Quickbar slot ${index + 1}, ${itemLabel}, ${isEquipped ? "equipped" : "not equipped"}`}
            aria-pressed={isEquipped}
            className="quickbar-slot"
            data-equipped={isEquipped ? "true" : undefined}
            key={index}
            onClick={() => onSelectSlot(index)}
            type="button"
          >
            <span className="quickbar-slot-number">{index + 1}</span>
            <span className="quickbar-slot-item">{itemLabel}</span>
          </button>
        );
      })}
    </section>
  );
};
