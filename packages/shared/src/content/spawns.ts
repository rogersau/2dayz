import { z } from "zod";

import { pointIdSchema, zombieArchetypeIdSchema, zoneIdSchema } from "../ids";
import { vector2Schema } from "../world/components";

export const respawnPointSchema = z
  .object({
    pointId: pointIdSchema,
    position: vector2Schema,
  })
  .strict();

export const zombieSpawnZoneSchema = z
  .object({
    zoneId: zoneIdSchema,
    center: vector2Schema,
    radius: z.number().positive(),
    maxAlive: z.number().int().positive(),
    archetypeIds: z.array(zombieArchetypeIdSchema).min(1),
  })
  .strict();

export type RespawnPoint = z.infer<typeof respawnPointSchema>;
export type ZombieSpawnZone = z.infer<typeof zombieSpawnZoneSchema>;
