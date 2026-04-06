import { z } from "zod";

import { zombieArchetypeIdSchema } from "../ids";

export const zombieArchetypeSchema = z
  .object({
    archetypeId: zombieArchetypeIdSchema,
    name: z.string().min(1),
    maxHealth: z.number().positive(),
    moveSpeed: z.number().positive(),
    aggroRadius: z.number().positive(),
    attackRange: z.number().positive(),
    attackDamage: z.number().positive(),
  })
  .strict();

export type ZombieArchetype = z.infer<typeof zombieArchetypeSchema>;
