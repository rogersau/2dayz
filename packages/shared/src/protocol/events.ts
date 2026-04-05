import { z } from "zod";

import { entityIdSchema, itemIdSchema, roomIdSchema } from "../ids";
import { inventorySchema } from "../world/inventory";
import { vector2Schema } from "../world/components";

export const lootPickedUpEventSchema = z
  .object({
    type: z.literal("loot-picked-up"),
    entityId: entityIdSchema,
    pickerEntityId: entityIdSchema,
    itemId: itemIdSchema,
    quantity: z.number().int().positive(),
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

export const serverEventSchema = z.discriminatedUnion("type", [lootPickedUpEventSchema, deathEventSchema]);

export type LootPickedUpEvent = z.infer<typeof lootPickedUpEventSchema>;
export type DeathEvent = z.infer<typeof deathEventSchema>;
export type ServerEvent = z.infer<typeof serverEventSchema>;
