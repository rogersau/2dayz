import type { ZombieArchetype } from "@2dayz/shared";

export const defaultZombieArchetypes: ZombieArchetype[] = [
  {
    archetypeId: "zombie_shambler",
    name: "Shambler",
    maxHealth: 60,
    moveSpeed: 1.6,
    aggroRadius: 10,
    attackRange: 1.25,
    attackDamage: 12,
  },
  {
    archetypeId: "zombie_runner",
    name: "Runner",
    maxHealth: 45,
    moveSpeed: 2.4,
    aggroRadius: 13,
    attackRange: 1.1,
    attackDamage: 10,
  },
];
