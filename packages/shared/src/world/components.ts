import { z } from "zod";

const finiteNumber = z.number().finite();

export const vector2Schema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict();

export const transformSchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
    rotation: finiteNumber,
  })
  .strict();

export const velocitySchema = z
  .object({
    x: finiteNumber,
    y: finiteNumber,
  })
  .strict();

export const healthSchema = z
  .object({
    current: z.number().nonnegative(),
    max: z.number().positive(),
    isDead: z.boolean(),
  })
  .strict()
  .refine((value) => value.current <= value.max, {
    message: "health current must be <= max",
  });

export const staminaSchema = z
  .object({
    current: finiteNumber.nonnegative(),
    max: finiteNumber.positive(),
  })
  .strict()
  .refine((value) => value.current <= value.max, {
    message: "stamina current must be <= max",
  });

export type Vector2 = z.infer<typeof vector2Schema>;
export type Transform = z.infer<typeof transformSchema>;
export type Velocity = z.infer<typeof velocitySchema>;
export type Health = z.infer<typeof healthSchema>;
export type Stamina = z.infer<typeof staminaSchema>;
