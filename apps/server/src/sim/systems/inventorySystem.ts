import { INVENTORY_SLOT_COUNT } from "@2dayz/shared";

import { queuePlayerRespawn, selectRespawnPoint } from "../../rooms/respawn";
import type { RoomSimulationState, SimPlayer } from "../state";
import { canPlayerPickUpLoot, hasLootCapacity } from "./lootSystem";

const dropOffsetStep = 0.15;

const createDroppedLootEntityId = (state: RoomSimulationState): string => {
  state.nextLootEntitySequence += 1;
  return `loot_${state.roomId.replace(/^room_/, "")}-${state.nextLootEntitySequence}`;
};

const addAmmoToInventory = (player: SimPlayer, ammoItemId: string, quantity: number): void => {
  const existing = player.inventory.ammoStacks.find((stack) => stack.ammoItemId === ammoItemId);
  if (existing) {
    existing.quantity += quantity;
    return;
  }

  player.inventory.ammoStacks.push({ ammoItemId, quantity });
};

export const consumeAmmoForReload = (player: SimPlayer, ammoItemId: string, magazineSize: number): number => {
  const weaponState = player.weaponState;
  const missingAmmo = Math.max(0, magazineSize - weaponState.magazineAmmo);

  if (missingAmmo === 0) {
    return 0;
  }

  const ammoStack = player.inventory.ammoStacks.find((stack) => stack.ammoItemId === ammoItemId);
  if (!ammoStack) {
    return 0;
  }

  const loadedRounds = Math.min(missingAmmo, ammoStack.quantity);
  weaponState.magazineAmmo += loadedRounds;
  ammoStack.quantity -= loadedRounds;

  if (ammoStack.quantity === 0) {
    player.inventory.ammoStacks = player.inventory.ammoStacks.filter((stack) => stack.quantity > 0);
  }

  return loadedRounds;
};

const handlePickupAction = (state: RoomSimulationState, player: SimPlayer): void => {
  const action = state.inputIntents.get(player.entityId)?.actions.inventory;
  if (!action || action.type !== "pickup") {
    return;
  }

  const loot = state.loot.get(action.pickupEntityId);
  if (!loot || !canPlayerPickUpLoot(state, player.entityId, loot.entityId)) {
    return;
  }

  const itemDefinition = state.itemDefinitions.get(loot.itemId);
  if (!itemDefinition) {
    return;
  }

  if (itemDefinition.category === "ammo") {
    addAmmoToInventory(player, loot.itemId, loot.quantity);
    state.loot.delete(loot.entityId);
    state.dirtyLootIds.delete(loot.entityId);
    state.removedEntityIds.add(loot.entityId);
    return;
  }

  const slotIndex = action.toSlot;
  if (slotIndex < 0 || slotIndex >= INVENTORY_SLOT_COUNT || player.inventory.slots[slotIndex] !== null) {
    return;
  }

  player.inventory.slots[slotIndex] = {
    itemId: loot.itemId,
    quantity: loot.quantity,
  };

  if (itemDefinition.category === "firearm") {
    player.inventory.equippedWeaponSlot = slotIndex;
  }

  state.loot.delete(loot.entityId);
  state.dirtyLootIds.delete(loot.entityId);
  state.removedEntityIds.add(loot.entityId);
};

const handleDeathDrops = (state: RoomSimulationState, player: SimPlayer): void => {
  if (!player.health.isDead || state.handledDeathEntityIds.has(player.entityId)) {
    return;
  }

  const droppedInventory = {
    slots: player.inventory.slots.map((slot) => (slot ? { ...slot } : null)),
    equippedWeaponSlot: player.inventory.equippedWeaponSlot,
    ammoStacks: player.inventory.ammoStacks.map((stack) => ({ ...stack })),
  };
  let dropOffset = 0;

  for (const slot of player.inventory.slots) {
    if (!hasLootCapacity(state)) {
      break;
    }

    if (!slot) {
      continue;
    }

    const entityId = createDroppedLootEntityId(state);

    state.loot.set(entityId, {
      entityId,
      itemId: slot.itemId,
      quantity: slot.quantity,
      position: {
        x: player.transform.x + dropOffset,
        y: player.transform.y,
      },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.dirtyLootIds.add(entityId);
    dropOffset += dropOffsetStep;
  }

  for (const ammoStack of player.inventory.ammoStacks) {
    if (!hasLootCapacity(state)) {
      break;
    }

    const entityId = createDroppedLootEntityId(state);

    state.loot.set(entityId, {
      entityId,
      itemId: ammoStack.ammoItemId,
      quantity: ammoStack.quantity,
      position: {
        x: player.transform.x + dropOffset,
        y: player.transform.y,
      },
      ownerEntityId: null,
      sourcePointId: null,
    });
    state.dirtyLootIds.add(entityId);
    dropOffset += dropOffsetStep;
  }

  player.inventory.slots = Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
  player.inventory.equippedWeaponSlot = null;
  player.inventory.ammoStacks = [];
  player.weaponState.magazineAmmo = 0;
  player.weaponState.isReloading = false;
  player.weaponState.reloadRemainingMs = 0;
  player.weaponState.fireCooldownRemainingMs = 0;

  const respawnAt = selectRespawnPoint(state);
  state.events.push({
    type: "death",
    victimEntityId: player.entityId,
    killerEntityId: player.lastDamagedByEntityId,
    roomId: state.roomId,
    droppedInventory,
    respawnAt,
  });
  queuePlayerRespawn(state, player.entityId, 250);
  state.handledDeathEntityIds.add(player.entityId);
  state.dirtyPlayerIds.add(player.entityId);
};

export const createInventorySystem = () => {
  return {
    name: "inventory" as const,
    update(state: RoomSimulationState) {
      for (const player of state.players.values()) {
        handleDeathDrops(state, player);

        if (!player.health.isDead) {
          handlePickupAction(state, player);
        }

        const intent = state.inputIntents.get(player.entityId);
        if (intent) {
          intent.actions.inventory = undefined;
          intent.actions.pickupEntityId = undefined;
        }
      }
    },
  };
};
