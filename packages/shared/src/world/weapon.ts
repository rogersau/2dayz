import { z } from "zod";

export const weaponStateSchema = z
  .object({
    magazineAmmo: z.number().int().nonnegative(),
    isReloading: z.boolean(),
    reloadRemainingMs: z.number().finite().nonnegative(),
    fireCooldownRemainingMs: z.number().finite().nonnegative(),
  })
  .strict();

export type WeaponState = z.infer<typeof weaponStateSchema>;
