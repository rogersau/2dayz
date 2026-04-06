import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Hud } from "./Hud";

describe("Hud", () => {
  it("renders the survival HUD with primary stats and inventory summary", () => {
    render(
      <Hud
        health={{ current: 86, isDead: false, max: 100 }}
        inventory={{
          ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 21 }],
          equippedWeaponSlot: 0,
          slots: [
            { itemId: "weapon_pistol", quantity: 1 },
            { itemId: "bandage", quantity: 2 },
            null,
            null,
            null,
            null,
          ],
        }}
        isInventoryOpen={false}
        onToggleInventory={vi.fn()}
        playerEntityId="player_survivor"
        roomId="room_browser-v1"
      />,
    );

    const hud = screen.getByLabelText(/survival hud/i);

    expect(hud).toBeInTheDocument();
    expect(within(hud).getByText(/86\/100/)).toBeInTheDocument();
    expect(within(hud).getByText(/^ammo$/i)).toBeInTheDocument();
    expect(within(hud).getByText(/2\/6 slots filled/i)).toBeInTheDocument();
  });
});
