import type { ItemDefinition } from "@2dayz/shared";

export const defaultItems: ItemDefinition[] = [
  {
    itemId: "item_bandage",
    name: "Bandage",
    category: "healing",
    stackable: true,
    maxStack: 3,
  },
  {
    itemId: "item_water-bottle",
    name: "Water Bottle",
    category: "utility",
    stackable: false,
    maxStack: 1,
  },
  {
    itemId: "item_pistol-ammo",
    name: "9mm Ammo",
    category: "ammo",
    stackable: true,
    maxStack: 30,
  },
  {
    itemId: "item_revolver",
    name: "Civilian Revolver",
    category: "firearm",
    stackable: false,
    maxStack: 1,
  },
  {
    itemId: "item_pipe",
    name: "Pipe",
    category: "melee",
    stackable: false,
    maxStack: 1,
  },
  {
    itemId: "item_unarmed",
    name: "Fists",
    category: "unarmed",
    stackable: false,
    maxStack: 1,
  },
];
