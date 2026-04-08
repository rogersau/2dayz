import type { LootTable } from "@2dayz/shared";

export const defaultLootTables: LootTable[] = [
  {
    tableId: "loot_residential",
    entries: [
      {
        itemId: "item_bandage",
        weight: 5,
        minQuantity: 1,
        maxQuantity: 2,
      },
      {
        itemId: "item_water-bottle",
        weight: 3,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "item_pistol-ammo",
        weight: 2,
        minQuantity: 6,
        maxQuantity: 18,
      },
      {
        itemId: "item_pipe",
        weight: 1,
        minQuantity: 1,
        maxQuantity: 1,
      },
    ],
  },
  {
    tableId: "loot_police",
    entries: [
      {
        itemId: "item_pistol-ammo",
        weight: 5,
        minQuantity: 12,
        maxQuantity: 24,
      },
      {
        itemId: "item_revolver",
        weight: 1,
        minQuantity: 1,
        maxQuantity: 1,
      },
      {
        itemId: "item_bandage",
        weight: 2,
        minQuantity: 1,
        maxQuantity: 2,
      },
    ],
  },
];
