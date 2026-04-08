import { z } from "zod";

import { INVENTORY_SLOT_COUNT } from "../constants";
import { entityIdSchema, itemIdSchema, roomIdSchema } from "../ids";
import { vector2Schema } from "./components";

const slotIndexSchema = z.number().int().min(0).max(INVENTORY_SLOT_COUNT - 1);

export const inventorySlotSchema = z
  .object({
    itemId: itemIdSchema,
    quantity: z.number().int().positive(),
  })
  .strict();

export const ammoStackSchema = z
  .object({
    ammoItemId: itemIdSchema,
    quantity: z.number().int().positive(),
  })
  .strict();

export const inventorySchema = z
  .object({
    slots: z.array(inventorySlotSchema.nullable()).length(INVENTORY_SLOT_COUNT),
    equippedWeaponSlot: slotIndexSchema.nullable(),
    ammoStacks: z.array(ammoStackSchema),
  })
  .strict();

export const pickupInventoryActionSchema = z
  .object({
    type: z.literal("pickup"),
    pickupEntityId: entityIdSchema,
    toSlot: slotIndexSchema,
  })
  .strict();

export const moveInventoryActionSchema = z
  .object({
    type: z.literal("move"),
    fromSlot: slotIndexSchema,
    toSlot: slotIndexSchema,
  })
  .strict();

export const equipInventoryActionSchema = z
  .object({
    type: z.literal("equip"),
    toSlot: slotIndexSchema,
  })
  .strict();

export const dropInventoryActionSchema = z
  .object({
    type: z.literal("drop"),
    fromSlot: slotIndexSchema,
    quantity: z.number().int().positive().optional(),
  })
  .strict();

export const stowInventoryActionSchema = z
  .object({
    type: z.literal("stow"),
  })
  .strict();

export const inventoryActionSchema = z.discriminatedUnion("type", [
  pickupInventoryActionSchema,
  moveInventoryActionSchema,
  equipInventoryActionSchema,
  dropInventoryActionSchema,
  stowInventoryActionSchema,
]);

export const deathDropSchema = z
  .object({
    ownerEntityId: entityIdSchema,
    roomId: roomIdSchema,
    inventory: inventorySchema,
    position: vector2Schema,
  })
  .strict();

export type InventorySlot = z.infer<typeof inventorySlotSchema>;
export type AmmoStack = z.infer<typeof ammoStackSchema>;
export type Inventory = z.infer<typeof inventorySchema>;
export type InventoryAction = z.infer<typeof inventoryActionSchema>;
export type DeathDrop = z.infer<typeof deathDropSchema>;
