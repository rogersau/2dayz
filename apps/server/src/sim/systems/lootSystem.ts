import type { LootTableEntry } from "@2dayz/shared";

import type { RoomSimulationState, SimLoot } from "../state";

const pickupRadius = 2;

const pickWeightedEntry = (entries: LootTableEntry[], random: number): LootTableEntry => {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random * totalWeight;

  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      return entry;
    }
  }

  return entries[entries.length - 1] ?? entries[0]!;
};

const createLootEntity = (
  state: RoomSimulationState,
  input: Omit<SimLoot, "entityId">,
): SimLoot => {
  state.nextLootEntitySequence += 1;
  return {
    entityId: `loot_${state.roomId.replace(/^room_/, "")}-${state.nextLootEntitySequence}`,
    ...input,
  };
};

export const canPlayerPickUpLoot = (
  state: RoomSimulationState,
  playerEntityId: string,
  lootEntityId: string,
): boolean => {
  const player = state.players.get(playerEntityId);
  const loot = state.loot.get(lootEntityId);

  if (!player || !loot) {
    return false;
  }

  if (loot.ownerEntityId !== null && loot.ownerEntityId !== playerEntityId) {
    return false;
  }

  return Math.hypot(player.transform.x - loot.position.x, player.transform.y - loot.position.y) <= pickupRadius;
};

export const createLootSystem = ({ random = Math.random }: { random?: () => number } = {}) => {
  return {
    name: "loot" as const,
    update(state: RoomSimulationState) {
      const lootPoints = state.world?.map.lootPoints ?? [];

      for (const point of lootPoints) {
        if (state.spawnedLootPointIds.has(point.pointId)) {
          continue;
        }

        const table = state.lootTables.get(point.tableId);
        if (!table) {
          continue;
        }

        const entry = pickWeightedEntry(table.entries, random());
        const quantityRoll = random();
        const quantity = entry.minQuantity + Math.floor(quantityRoll * (entry.maxQuantity - entry.minQuantity + 1));
        const loot = createLootEntity(state, {
          itemId: entry.itemId,
          quantity,
          position: point.position,
          ownerEntityId: null,
          sourcePointId: point.pointId,
        });

        state.spawnedLootPointIds.add(point.pointId);
        state.loot.set(loot.entityId, loot);
      }
    },
  };
};
