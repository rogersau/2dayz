import { z } from "zod";

export const weaponStateSchema = z
  .object({
    magazineAmmo: z.number().int().nonnegative(),
    isReloading: z.boolean(),
    reloadRemainingMs: z.number().int().nonnegative(),
    fireCooldownRemainingMs: z.number().int().nonnegative(),
  })
  .strict();

export type WeaponState = z.infer<typeof weaponStateSchema>;
