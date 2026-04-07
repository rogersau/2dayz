import { z } from "zod";

import { entityIdSchema, itemIdSchema, roomIdSchema } from "../ids";
import { inventorySchema } from "../world/inventory";
import { vector2Schema } from "../world/components";

export const shotEventSchema = z
  .object({
    type: z.literal("shot"),
    roomId: roomIdSchema,
    attackerEntityId: entityIdSchema,
    weaponItemId: itemIdSchema,
    origin: vector2Schema,
    aim: vector2Schema,
  })
  .strict();

export const lootPickedUpEventSchema = z
  .object({
    type: z.literal("loot-picked-up"),
    entityId: entityIdSchema,
    pickerEntityId: entityIdSchema,
    itemId: itemIdSchema,
    quantity: z.number().int().positive(),
  })
  .strict();

export const combatEventSchema = z
  .object({
    type: z.literal("combat"),
    roomId: roomIdSchema,
    attackerEntityId: entityIdSchema,
    targetEntityId: entityIdSchema,
    weaponItemId: itemIdSchema,
    damage: z.number().positive(),
    remainingHealth: z.number().nonnegative(),
    hitPosition: vector2Schema,
  })
  .strict();

export const deathEventSchema = z
  .object({
    type: z.literal("death"),
    victimEntityId: entityIdSchema,
    killerEntityId: entityIdSchema.nullable(),
    roomId: roomIdSchema,
    droppedInventory: inventorySchema,
    respawnAt: vector2Schema,
  })
  .strict();

export const serverEventSchema = z.discriminatedUnion("type", [
  lootPickedUpEventSchema,
  shotEventSchema,
  combatEventSchema,
  deathEventSchema,
]);

export type LootPickedUpEvent = z.infer<typeof lootPickedUpEventSchema>;
export type ShotEvent = z.infer<typeof shotEventSchema>;
export type CombatEvent = z.infer<typeof combatEventSchema>;
export type DeathEvent = z.infer<typeof deathEventSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
