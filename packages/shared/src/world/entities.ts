import { z } from "zod";

import { entityIdSchema, itemIdSchema, zombieArchetypeIdSchema } from "../ids";
import { healthSchema, transformSchema, vector2Schema, velocitySchema } from "./components";

export const entityKindSchema = z.enum(["player", "zombie", "loot", "projectile", "prop"]);

export const entitySnapshotSchema = z
  .object({
    entityId: entityIdSchema,
    kind: entityKindSchema,
    transform: transformSchema,
    velocity: velocitySchema.optional(),
    health: healthSchema.optional(),
  })
  .strict();

export const entityDeltaSchema = z
  .object({
    entityId: entityIdSchema,
    transform: transformSchema.optional(),
    velocity: velocitySchema.optional(),
    health: healthSchema.optional(),
  })
  .strict()
  .refine((value) => value.transform !== undefined || value.velocity !== undefined || value.health !== undefined, {
    message: "entity delta requires at least one update",
  });

export const lootEntitySchema = z
  .object({
    entityId: entityIdSchema,
    itemId: itemIdSchema,
    quantity: z.number().int().positive(),
    position: vector2Schema,
  })
  .strict();

export const zombieEntitySchema = z
  .object({
    entityId: entityIdSchema,
    archetypeId: zombieArchetypeIdSchema,
    transform: transformSchema,
    state: z.enum(["idle", "roaming", "chasing", "attacking", "searching"]),
  })
  .strict();

export type EntityKind = z.infer<typeof entityKindSchema>;
export type EntitySnapshot = z.infer<typeof entitySnapshotSchema>;
export type EntityDelta = z.infer<typeof entityDeltaSchema>;
export type LootEntity = z.infer<typeof lootEntitySchema>;
export type ZombieEntity = z.infer<typeof zombieEntitySchema>;
