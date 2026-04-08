import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Health, WeaponState } from "@2dayz/shared";

import { CombatHud } from "./CombatHud";

describe("CombatHud", () => {
  it("renders the combat hud crosshair, health, and ammo summary", () => {
    const health: Health = { current: 72, isDead: false, max: 100 };
    const weaponState: WeaponState = {
      fireCooldownRemainingMs: 0,
      isReloading: false,
      magazineAmmo: 5,
      reloadRemainingMs: 0,
    };

    render(<CombatHud health={health} inventoryAmmo={12} weaponState={weaponState} />);

    expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
    expect(screen.getByText(/health 72\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/ammo 5\/12/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/crosshair/i)).toBeInTheDocument();
  });
});
