import { z } from "zod";

import { weaponTypeSchema } from "../content/weapons";
import { itemIdSchema } from "../ids";

export const weaponStateSchema = z
  .object({
    weaponItemId: itemIdSchema,
    weaponType: weaponTypeSchema,
    magazineAmmo: z.number().int().nonnegative(),
    isBlocking: z.boolean(),
    isReloading: z.boolean(),
    reloadRemainingMs: z.number().finite().nonnegative(),
    fireCooldownRemainingMs: z.number().finite().nonnegative(),
  })
  .strict();

export type WeaponState = z.infer<typeof weaponStateSchema>;
