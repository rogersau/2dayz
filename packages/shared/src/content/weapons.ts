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
