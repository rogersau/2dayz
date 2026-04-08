import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Health, WeaponState } from "@2dayz/shared";

import { CombatHud } from "./CombatHud";

afterEach(() => {
  cleanup();
});

describe("CombatHud", () => {
  it("renders the combat hud crosshair, health, and ammo summary", () => {
    const health: Health = { current: 72, isDead: false, max: 100 };
    const weaponState: WeaponState = {
      weaponItemId: "weapon_pistol",
      weaponType: "firearm",
      fireCooldownRemainingMs: 0,
      isBlocking: false,
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

  it("hides ammo readouts when the active weapon is not a firearm", () => {
    const health: Health = { current: 72, isDead: false, max: 100 };
    const weaponState: WeaponState = {
      weaponItemId: "weapon_hatchet",
      weaponType: "melee",
      fireCooldownRemainingMs: 0,
      isBlocking: true,
      isReloading: false,
      magazineAmmo: 0,
      reloadRemainingMs: 0,
    };

    render(<CombatHud health={health} inventoryAmmo={12} weaponState={weaponState} />);

    expect(screen.getByText(/health 72\/100/i)).toBeInTheDocument();
    expect(screen.queryByText(/ammo/i)).not.toBeInTheDocument();
  });
});
