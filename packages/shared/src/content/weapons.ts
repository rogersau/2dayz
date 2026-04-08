import { z } from "zod";

import { itemIdSchema } from "../ids";
import { itemDefinitionSchema } from "./items";

export const weaponTypeSchema = z.enum(["firearm", "melee", "unarmed"]);

const firearmWeaponDefinitionSchema = itemDefinitionSchema
  .extend({
    category: z.literal("firearm"),
    weaponType: z.literal("firearm"),
    damage: z.number().positive(),
    range: z.number().positive(),
    spread: z.number().nonnegative(),
    fireRate: z.number().positive(),
    magazineSize: z.number().int().positive(),
    reloadTimeMs: z.number().int().positive(),
    ammoItemId: itemIdSchema,
  })
  .strict();

const meleeWeaponDefinitionSchema = itemDefinitionSchema
  .extend({
    category: z.literal("melee"),
    weaponType: z.literal("melee"),
    damage: z.number().positive(),
    range: z.number().positive(),
    swingDurationMs: z.number().int().positive(),
    staminaCost: z.number().positive(),
  })
  .strict();

const unarmedWeaponDefinitionSchema = itemDefinitionSchema
  .extend({
    category: z.literal("unarmed"),
    weaponType: z.literal("unarmed"),
    damage: z.number().positive(),
    range: z.number().positive(),
    swingDurationMs: z.number().int().positive(),
    staminaCost: z.number().positive(),
  })
  .strict();

export const weaponDefinitionSchema = z.discriminatedUnion("weaponType", [
  firearmWeaponDefinitionSchema,
  meleeWeaponDefinitionSchema,
  unarmedWeaponDefinitionSchema,
]);

export type WeaponDefinition = z.infer<typeof weaponDefinitionSchema>;
export type WeaponType = z.infer<typeof weaponTypeSchema>;
