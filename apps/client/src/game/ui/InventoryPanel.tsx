import type { Inventory } from "@2dayz/shared";

type InventoryPanelProps = {
  inventory: Inventory;
  isOpen: boolean;
  onToggle: () => void;
};

export const InventoryPanel = ({ inventory, isOpen, onToggle }: InventoryPanelProps) => {
  return (
    <section className="inventory-card">
      <button
        aria-expanded={isOpen}
        className="secondary-button"
        onClick={onToggle}
        type="button"
      >
        Inventory
      </button>

      {isOpen ? (
        <>
          <div className="inventory-grid">
            {inventory.slots.map((slot, index) => (
              <article className="inventory-slot" key={index}>
                <strong>{`Slot ${index + 1}`}</strong>
                <span>{slot ? `${slot.itemId} x${slot.quantity}` : "Empty"}</span>
              </article>
            ))}
          </div>
          <div className="ammo-list">
            {inventory.ammoStacks.map((stack) => (
              <div className="ammo-pill" key={stack.ammoItemId}>{`${stack.ammoItemId}: ${stack.quantity}`}</div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
};
