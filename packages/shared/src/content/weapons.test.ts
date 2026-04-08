import { describe, expect, it } from "vitest";

import { itemIdSchema } from "../ids";
import { defaultWeapons, weaponDefinitionSchema } from "../index";

describe("weapon content", () => {
  it("defines the authored default firearm, melee, and unarmed weapons", () => {
    const definitions = defaultWeapons.map((weapon) => weaponDefinitionSchema.parse(weapon));

    expect(definitions).toHaveLength(3);
    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: "item_revolver",
          category: "firearm",
          weaponType: "firearm",
          ammoItemId: "item_pistol-ammo",
        }),
        expect.objectContaining({
          itemId: "item_pipe",
          category: "melee",
          weaponType: "melee",
        }),
        expect.objectContaining({
          itemId: "item_unarmed",
          category: "unarmed",
          weaponType: "unarmed",
        }),
      ]),
    );
  });

  it("accepts the specific fields for each weapon type", () => {
    expect(
      weaponDefinitionSchema.parse({
        itemId: "item_revolver",
        name: "Civilian Revolver",
        category: "firearm",
        stackable: false,
        maxStack: 1,
        weaponType: "firearm",
        damage: 35,
        range: 8,
        spread: 0,
        fireRate: 2,
        magazineSize: 6,
        reloadTimeMs: 1200,
        ammoItemId: "item_pistol-ammo",
      }),
    ).toMatchObject({ weaponType: "firearm", ammoItemId: "item_pistol-ammo" });

    expect(
      weaponDefinitionSchema.parse({
        itemId: "item_pipe",
        name: "Pipe",
        category: "melee",
        stackable: false,
        maxStack: 1,
        weaponType: "melee",
        damage: 20,
        range: 1.5,
        swingDurationMs: 450,
        staminaCost: 10,
      }),
    ).toMatchObject({ weaponType: "melee", swingDurationMs: 450 });

    expect(
      weaponDefinitionSchema.parse({
        itemId: "item_unarmed",
        name: "Fists",
        category: "unarmed",
        stackable: false,
        maxStack: 1,
        weaponType: "unarmed",
        damage: 8,
        range: 1,
        swingDurationMs: 300,
        staminaCost: 4,
      }),
    ).toMatchObject({ weaponType: "unarmed", staminaCost: 4 });
  });

  it("rejects mismatched item categories and weapon payloads", () => {
    expect(() =>
      weaponDefinitionSchema.parse({
        itemId: "item_revolver",
        name: "Civilian Revolver",
        category: "firearm",
        stackable: false,
        maxStack: 1,
        weaponType: "melee",
        damage: 35,
        range: 8,
        swingDurationMs: 450,
        staminaCost: 10,
      }),
    ).toThrow();

    expect(() =>
      weaponDefinitionSchema.parse({
        itemId: "item_pipe",
        name: "Pipe",
        category: "melee",
        stackable: false,
        maxStack: 1,
        weaponType: "firearm",
        damage: 20,
        range: 1.5,
        spread: 0,
        fireRate: 2,
        magazineSize: 6,
        reloadTimeMs: 1200,
        ammoItemId: "item_pistol-ammo",
      }),
    ).toThrow();
  });

  it("validates firearm ammo item ids with the shared item id contract", () => {
    expect(() =>
      weaponDefinitionSchema.parse({
        itemId: "item_revolver",
        name: "Civilian Revolver",
        category: "firearm",
        stackable: false,
        maxStack: 1,
        weaponType: "firearm",
        damage: 35,
        range: 8,
        spread: 0,
        fireRate: 2,
        magazineSize: 6,
        reloadTimeMs: 1200,
        ammoItemId: "",
      }),
    ).toThrow();

    const revolver = defaultWeapons.find((weapon) => weapon.weaponType === "firearm");

    expect(revolver).toBeDefined();
    expect(itemIdSchema.parse(revolver?.ammoItemId)).toBe("item_pistol-ammo");
  });
});
