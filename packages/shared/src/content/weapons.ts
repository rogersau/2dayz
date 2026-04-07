import { z } from "zod";

import { itemDefinitionSchema } from "./items";

export const weaponDefinitionSchema = itemDefinitionSchema
  .extend({
    category: z.literal("firearm"),
    damage: z.number().positive(),
    range: z.number().positive(),
    spread: z.number().nonnegative(),
    fireRate: z.number().positive(),
    magazineSize: z.number().int().positive(),
    reloadTimeMs: z.number().int().positive(),
    ammoItemId: z.string().min(1),
  })
  .strict();

export type WeaponDefinition = z.infer<typeof weaponDefinitionSchema>;

export const sharedWeaponDefinitions: WeaponDefinition[] = [
  {
    ammoItemId: "ammo_9mm",
    category: "firearm",
    damage: 35,
    fireRate: 2,
    itemId: "weapon_pistol",
    magazineSize: 6,
    maxStack: 1,
    name: "Pistol",
    range: 8,
    reloadTimeMs: 1_200,
    spread: 0,
    stackable: false,
  },
  {
    ammoItemId: "ammo_shells",
    category: "firearm",
    damage: 70,
    fireRate: 1,
    itemId: "weapon_shotgun",
    magazineSize: 2,
    maxStack: 1,
    name: "Shotgun",
    range: 6,
    reloadTimeMs: 1_500,
    spread: 0.2,
    stackable: false,
  },
  {
    ammoItemId: "ammo_556",
    category: "firearm",
    damage: 28,
    fireRate: 4,
    itemId: "weapon_rifle",
    magazineSize: 20,
    maxStack: 1,
    name: "Rifle",
    range: 12,
    reloadTimeMs: 1_800,
    spread: 0.05,
    stackable: false,
  },
];

export const sharedWeaponDefinitionsById = new Map(
  sharedWeaponDefinitions.map((weapon) => [weapon.itemId, weapon] as const),
);
