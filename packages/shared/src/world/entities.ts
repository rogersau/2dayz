import { z } from "zod";

import { entityIdSchema, itemIdSchema, zombieArchetypeIdSchema } from "../ids";
import { healthSchema, staminaSchema, transformSchema, vector2Schema, velocitySchema } from "./components";
import { inventorySchema } from "./inventory";

export const entityKindSchema = z.enum(["player", "zombie", "loot"]);

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
    lastProcessedInputSequence: z.number().int().nonnegative().optional(),
    inventory: inventorySchema.optional(),
    stamina: staminaSchema.optional(),
    transform: transformSchema.optional(),
    velocity: velocitySchema.optional(),
    health: healthSchema.optional(),
    itemId: itemIdSchema.optional(),
    quantity: z.number().int().positive().optional(),
    position: vector2Schema.optional(),
  })
  .strict()
  .refine((value) => {
    return (
      value.transform !== undefined ||
      value.velocity !== undefined ||
      value.health !== undefined ||
      value.stamina !== undefined ||
      value.inventory !== undefined ||
      value.lastProcessedInputSequence !== undefined ||
      value.itemId !== undefined ||
      value.quantity !== undefined ||
      value.position !== undefined
    );
  }, {
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
