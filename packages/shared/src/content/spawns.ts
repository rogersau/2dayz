import { z } from "zod";

import { zombieArchetypeIdSchema } from "../ids";
import { vector2Schema } from "../world/components";

export const respawnPointSchema = z
  .object({
    pointId: z.string().min(1),
    position: vector2Schema,
  })
  .strict();

export const zombieSpawnZoneSchema = z
  .object({
    zoneId: z.string().min(1),
    center: vector2Schema,
    radius: z.number().positive(),
    maxAlive: z.number().int().positive(),
    archetypeIds: z.array(zombieArchetypeIdSchema).min(1),
  })
  .strict();

export type RespawnPoint = z.infer<typeof respawnPointSchema>;
export type ZombieSpawnZone = z.infer<typeof zombieSpawnZoneSchema>;
