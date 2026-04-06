import { z } from "zod";

import { itemIdSchema, lootTableIdSchema } from "../ids";

export const lootTableEntrySchema = z
  .object({
    itemId: itemIdSchema,
    weight: z.number().positive(),
    minQuantity: z.number().int().positive(),
    maxQuantity: z.number().int().positive(),
  })
  .strict()
  .refine((value) => value.minQuantity <= value.maxQuantity, {
    message: "minQuantity must be <= maxQuantity",
  });

export const lootTableSchema = z
  .object({
    tableId: lootTableIdSchema,
    entries: z.array(lootTableEntrySchema).min(1),
  })
  .strict();

export type LootTableEntry = z.infer<typeof lootTableEntrySchema>;
export type LootTable = z.infer<typeof lootTableSchema>;
