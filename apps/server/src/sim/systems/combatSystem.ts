import { hasLineOfSight } from "../../world/lineOfSight";
import type { RoomSimulationState, SimPlayer, SimZombie } from "../state";
import { consumeAmmoForReload } from "./inventorySystem";

const hitRadius = 0.75;

const getEquippedWeapon = (state: RoomSimulationState, player: SimPlayer) => {
  const slotIndex = player.inventory.equippedWeaponSlot;
  if (slotIndex === null) {
    return null;
  }

  const slot = player.inventory.slots[slotIndex];
  if (!slot) {
    return null;
  }

  const weaponDefinition = state.weaponDefinitions.get(slot.itemId);
  if (!weaponDefinition) {
    return null;
  }

  return {
    itemId: slot.itemId,
    weaponDefinition,
  };
};

const applyDamage = (target: SimPlayer | SimZombie, damage: number): void => {
  target.health.current = Math.max(0, target.health.current - damage);
  target.health.isDead = target.health.current === 0;
};

const findHitTarget = (state: RoomSimulationState, attacker: SimPlayer, aim: { x: number; y: number }, range: number) => {
  const magnitude = Math.hypot(aim.x, aim.y);
  if (magnitude === 0) {
    return null;
  }

  const direction = {
    x: aim.x / magnitude,
    y: aim.y / magnitude,
  };
  let closest:
    | { entityId: string; position: { x: number; y: number }; apply(damage: number): void; healthCurrent(): number }
    | null = null;

  const considerTarget = (
    entityId: string,
    position: { x: number; y: number },
    target: SimPlayer | SimZombie,
  ): void => {
    if (target.health.isDead) {
      return;
    }

    const relative = {
      x: position.x - attacker.transform.x,
      y: position.y - attacker.transform.y,
    };
    const forwardDistance = relative.x * direction.x + relative.y * direction.y;
    if (forwardDistance < 0 || forwardDistance > range) {
      return;
    }

    const projected = {
      x: direction.x * forwardDistance,
      y: direction.y * forwardDistance,
    };
    const lateralDistance = Math.hypot(relative.x - projected.x, relative.y - projected.y);
    if (lateralDistance > hitRadius) {
      return;
    }

    if (state.world && !hasLineOfSight(state.world.collision, attacker.transform, position, 0.1)) {
      return;
    }

    if (!closest || forwardDistance < Math.hypot(closest.position.x - attacker.transform.x, closest.position.y - attacker.transform.y)) {
      closest = {
        entityId,
        position,
        apply(damage) {
          applyDamage(target, damage);
        },
        healthCurrent() {
          return target.health.current;
        },
      };
    }
  };

  for (const player of state.players.values()) {
    if (player.entityId === attacker.entityId) {
      continue;
    }

    considerTarget(player.entityId, player.transform, player);
  }

  for (const zombie of state.zombies.values()) {
    considerTarget(zombie.entityId, zombie.transform, zombie);
  }

  return closest;
};

const updateWeaponTimers = (state: RoomSimulationState, deltaSeconds: number): void => {
  for (const player of state.players.values()) {
    player.weaponState.fireCooldownRemainingMs = Math.max(0, player.weaponState.fireCooldownRemainingMs - deltaSeconds * 1000);

    if (!player.weaponState.isReloading) {
      continue;
    }

    player.weaponState.reloadRemainingMs = Math.max(0, player.weaponState.reloadRemainingMs - deltaSeconds * 1000);
    if (player.weaponState.reloadRemainingMs > 0) {
      continue;
    }

    const weapon = getEquippedWeapon(state, player);
    if (weapon) {
      consumeAmmoForReload(player, weapon.weaponDefinition.ammoItemId, weapon.weaponDefinition.magazineSize);
    }

    player.weaponState.isReloading = false;
    player.weaponState.reloadRemainingMs = 0;
    state.dirtyPlayerIds.add(player.entityId);
  }
};

const canFireShot = (player: SimPlayer, aim: { x: number; y: number }): boolean => {
  return !player.weaponState.isReloading && player.weaponState.fireCooldownRemainingMs === 0 && player.weaponState.magazineAmmo > 0 && Math.hypot(aim.x, aim.y) > 0;
};

export const createCombatSystem = () => {
  return {
    name: "combat" as const,
    update(state: RoomSimulationState, deltaSeconds: number) {
      for (const player of state.players.values()) {
        const intent = state.inputIntents.get(player.entityId);
        if (!intent || player.health.isDead) {
          continue;
        }

        const weapon = getEquippedWeapon(state, player);
        if (!weapon) {
          intent.actions.fire = undefined;
          intent.actions.reload = undefined;
          continue;
        }

        if (
          intent.actions.reload &&
          !player.weaponState.isReloading &&
          player.weaponState.magazineAmmo < weapon.weaponDefinition.magazineSize &&
          player.inventory.ammoStacks.some((stack) => stack.ammoItemId === weapon.weaponDefinition.ammoItemId && stack.quantity > 0)
        ) {
          player.weaponState.isReloading = true;
          player.weaponState.reloadRemainingMs = weapon.weaponDefinition.reloadTimeMs;
          state.dirtyPlayerIds.add(player.entityId);
        }

        if (intent.actions.fire && canFireShot(player, intent.aim)) {
          player.weaponState.magazineAmmo -= 1;
          player.weaponState.fireCooldownRemainingMs = 1000 / weapon.weaponDefinition.fireRate;
          state.dirtyPlayerIds.add(player.entityId);

          const hitTarget = findHitTarget(state, player, intent.aim, weapon.weaponDefinition.range);
          if (hitTarget) {
            hitTarget.apply(weapon.weaponDefinition.damage);
            state.events.push({
              type: "combat",
              roomId: state.roomId,
              attackerEntityId: player.entityId,
              targetEntityId: hitTarget.entityId,
              weaponItemId: weapon.itemId,
              damage: weapon.weaponDefinition.damage,
              remainingHealth: hitTarget.healthCurrent(),
              hitPosition: hitTarget.position,
            });
            state.dirtyPlayerIds.add(hitTarget.entityId);
          }
        }

        intent.actions.fire = undefined;
        intent.actions.reload = undefined;
      }

      updateWeaponTimers(state, deltaSeconds);
    },
  };
};
