import type { ZombieArchetype } from "@2dayz/shared";

export const defaultZombieArchetypes: ZombieArchetype[] = [
  {
    archetypeId: "zombie_shambler",
    name: "Shambler",
    maxHealth: 60,
    moveSpeed: 1.9,
    aggroRadius: 9,
    attackRange: 1.4,
    attackDamage: 12,
  },
  {
    archetypeId: "zombie_runner",
    name: "Runner",
    maxHealth: 45,
    moveSpeed: 2.8,
    aggroRadius: 11,
    attackRange: 1.2,
    attackDamage: 10,
  },
];
