import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Inventory } from "@2dayz/shared";

import { QuickbarHud } from "./QuickbarHud";

afterEach(() => {
  cleanup();
});

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
  it("renders six quickbar slots with semantic names and selects a slot when clicked", () => {
    const onSelectSlot = vi.fn();

    render(<QuickbarHud inventory={inventory} onSelectSlot={onSelectSlot} />);

    const slotOne = screen.getByRole("button", { name: /quickbar slot 1, weapon_rifle x1, not equipped/i });
    const slotTwo = screen.getByRole("button", { name: /quickbar slot 2, bandage x2, equipped/i });
    const slotThree = screen.getByRole("button", { name: /quickbar slot 3, empty, not equipped/i });
    const slotFour = screen.getByRole("button", { name: /quickbar slot 4, water x1, not equipped/i });
    const slotFive = screen.getByRole("button", { name: /quickbar slot 5, empty, not equipped/i });
    const slotSix = screen.getByRole("button", { name: /quickbar slot 6, empty, not equipped/i });

    expect(slotOne).toHaveTextContent("1");
    expect(slotOne).toHaveTextContent("weapon_rifle");
    expect(slotTwo).toHaveTextContent("2");
    expect(slotTwo).toHaveTextContent("bandage x2");
    expect(slotOne).toHaveAttribute("aria-pressed", "false");
    expect(slotTwo).toHaveAttribute("aria-pressed", "true");
    expect(slotThree).toHaveTextContent("3");
    expect(slotThree).toHaveTextContent("Empty");
    expect(slotFour).toHaveTextContent("water");
    expect(slotFive).toBeInTheDocument();
    expect(slotSix).toBeInTheDocument();

    fireEvent.click(slotFour);

    expect(onSelectSlot).toHaveBeenCalledWith(3);
  });

  it("shows a stowed state when no quickbar slot is equipped", () => {
    render(
      <QuickbarHud
        inventory={{
          ...inventory,
          equippedWeaponSlot: null,
        }}
        onSelectSlot={vi.fn()}
      />,
    );

    expect(screen.getByText(/stowed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quickbar slot 1, weapon_rifle x1, not equipped/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders the status pill outside the slot row", () => {
    const { container } = render(<QuickbarHud inventory={inventory} onSelectSlot={vi.fn()} />);

    const quickbar = container.querySelector(".quickbar-hud");
    const status = screen.getByText(/active slot 2/i);
    const slots = container.querySelector(".quickbar-slots");

    expect(quickbar).not.toBeNull();
    expect(status.parentElement).toBe(quickbar);
    expect(slots).toBeInTheDocument();
    expect(slots?.children).toHaveLength(6);
  });
});
