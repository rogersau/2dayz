import type { Inventory } from "@2dayz/shared";

type QuickbarHudProps = {
  inventory: Inventory;
  onSelectSlot: (slotIndex: number) => void;
};

export const QuickbarHud = ({ inventory, onSelectSlot }: QuickbarHudProps) => {
  return (
    <section aria-label="Quickbar" className="quickbar-hud">
      {inventory.slots.map((slot, index) => (
        <button
          aria-label={`Quickbar slot ${index + 1}`}
          className="quickbar-slot"
          data-equipped={inventory.equippedWeaponSlot === index ? "true" : undefined}
          key={index}
          onClick={() => onSelectSlot(index)}
          type="button"
        >
          <span className="quickbar-slot-number">{index + 1}</span>
          <span className="quickbar-slot-item">{slot ? `${slot.itemId} x${slot.quantity}` : "Empty"}</span>
        </button>
      ))}
    </section>
  );
};
