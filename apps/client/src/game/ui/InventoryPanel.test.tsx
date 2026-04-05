import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Inventory } from "@2dayz/shared";

import { InventoryPanel } from "./InventoryPanel";

const inventory: Inventory = {
  slots: [
    { itemId: "weapon_rifle", quantity: 1 },
    { itemId: "bandage", quantity: 2 },
    null,
    { itemId: "water", quantity: 1 },
    null,
    null,
  ],
  equippedWeaponSlot: 0,
  ammoStacks: [
    { ammoItemId: "ammo_9mm", quantity: 24 },
    { ammoItemId: "ammo_556", quantity: 12 },
  ],
};

const InventoryHarness = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <InventoryPanel
      inventory={inventory}
      isOpen={isOpen}
      onToggle={() => setIsOpen((value) => !value)}
    />
  );
};

describe("InventoryPanel", () => {
  it("renders a compact inventory with ammo counts and toggles open and closed from client state", () => {
    render(<InventoryHarness />);

    const toggleButton = screen.getByRole("button", { name: /inventory/i });
    expect(screen.queryByText(/slot 1/i)).not.toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.getByText(/slot 1/i)).toBeInTheDocument();
    expect(screen.getByText(/weapon_rifle x1/i)).toBeInTheDocument();
    expect(screen.getByText(/bandage x2/i)).toBeInTheDocument();
    expect(screen.getByText(/ammo_9mm: 24/i)).toBeInTheDocument();
    expect(screen.getByText(/ammo_556: 12/i)).toBeInTheDocument();

    fireEvent.click(toggleButton);

    expect(screen.queryByText(/slot 1/i)).not.toBeInTheDocument();
  });
});
