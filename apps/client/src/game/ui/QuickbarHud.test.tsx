import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Inventory } from "@2dayz/shared";

import { QuickbarHud } from "./QuickbarHud";

const inventory: Inventory = {
  slots: [
    { itemId: "weapon_rifle", quantity: 1 },
    { itemId: "bandage", quantity: 2 },
    null,
    { itemId: "water", quantity: 1 },
    null,
    null,
  ],
  equippedWeaponSlot: 1,
  ammoStacks: [],
};

describe("QuickbarHud", () => {
  it("renders six quickbar slots and selects a slot when clicked", () => {
    const onSelectSlot = vi.fn();

    render(<QuickbarHud inventory={inventory} onSelectSlot={onSelectSlot} />);

    const slotOne = screen.getByRole("button", { name: "Quickbar slot 1" });
    const slotTwo = screen.getByRole("button", { name: "Quickbar slot 2" });
    const slotThree = screen.getByRole("button", { name: "Quickbar slot 3" });
    const slotFour = screen.getByRole("button", { name: "Quickbar slot 4" });
    const slotFive = screen.getByRole("button", { name: "Quickbar slot 5" });
    const slotSix = screen.getByRole("button", { name: "Quickbar slot 6" });

    expect(slotOne).toHaveTextContent("1");
    expect(slotOne).toHaveTextContent("weapon_rifle");
    expect(slotTwo).toHaveTextContent("2");
    expect(slotTwo).toHaveTextContent("bandage x2");
    expect(slotTwo).toHaveAttribute("data-equipped", "true");
    expect(slotThree).toHaveTextContent("3");
    expect(slotThree).toHaveTextContent("Empty");
    expect(slotFour).toHaveTextContent("water");
    expect(slotFive).toBeInTheDocument();
    expect(slotSix).toBeInTheDocument();

    fireEvent.click(slotFour);

    expect(onSelectSlot).toHaveBeenCalledWith(3);
  });
});
