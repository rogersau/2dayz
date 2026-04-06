import type { Inventory } from "@2dayz/shared";

type InventoryPanelProps = {
  inventory: Inventory;
  isOpen: boolean;
  onToggle: () => void;
};

export const InventoryPanel = ({ inventory, isOpen, onToggle }: InventoryPanelProps) => {
  const occupiedSlots = inventory.slots.filter((slot) => slot !== null).length;
  const panelContentId = "inventory-panel-content";

  return (
    <section className="inventory-card">
      <div className="inventory-panel-header">
        <div>
          <p className="inventory-kicker">Field kit</p>
          <h2>Inventory</h2>
          <p className="inventory-summary">{occupiedSlots}/{inventory.slots.length} slots carrying supplies</p>
        </div>
        <button
          aria-controls={panelContentId}
          aria-expanded={isOpen}
          className="secondary-button"
          onClick={onToggle}
          type="button"
        >
          {isOpen ? "Collapse inventory" : "Open inventory"}
        </button>
      </div>

      {isOpen ? (
        <div data-testid={panelContentId} id={panelContentId}>
          <div className="inventory-grid">
            {inventory.slots.map((slot, index) => (
              <article className="inventory-slot" key={index}>
                <strong>{`Slot ${index + 1}`}</strong>
                <span>{slot ? `${slot.itemId} x${slot.quantity}` : "Empty"}</span>
              </article>
            ))}
          </div>
          <div className="ammo-list" aria-label="ammo inventory">
            {inventory.ammoStacks.map((stack) => (
              <div className="ammo-pill" key={stack.ammoItemId}>{`${stack.ammoItemId}: ${stack.quantity}`}</div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
};
