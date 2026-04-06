import { z } from "zod";

import { itemIdSchema } from "../ids";

export const itemCategorySchema = z.enum(["firearm", "ammo", "healing", "utility"]);

export const itemDefinitionSchema = z
  .object({
    itemId: itemIdSchema,
    name: z.string().min(1),
    category: itemCategorySchema,
    stackable: z.boolean(),
    maxStack: z.number().int().positive(),
  })
  .strict();

export type ItemCategory = z.infer<typeof itemCategorySchema>;
export type ItemDefinition = z.infer<typeof itemDefinitionSchema>;
