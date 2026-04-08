import type { WeaponDefinition } from "@2dayz/shared";

import { hasLineOfSight } from "../../world/lineOfSight";
import type { RoomSimulationState, SimPlayer, SimZombie } from "../state";
import { resolveActiveWeaponDefinition } from "../weapons";
import { consumeAmmoForReload } from "./inventorySystem";

const hitRadius = 0.75;

type HitTarget = {
  forwardDistance: number;
  entityId: string;
  position: { x: number; y: number };
  apply(damage: number): void;
  healthCurrent(): number;
  markDirty(): void;
};

const getActiveWeapon = (state: RoomSimulationState, player: SimPlayer) => {
  const weaponDefinition = resolveActiveWeaponDefinition(state.weaponDefinitions, player.inventory);
  return {
    itemId: weaponDefinition.itemId,
    weaponDefinition,
  };
};

const applyDamage = (target: SimPlayer | SimZombie, damage: number, attackerEntityId: string): void => {
  target.health.current = Math.max(0, target.health.current - damage);
  target.health.isDead = target.health.current === 0;

  if ("inventory" in target) {
    target.lastDamagedByEntityId = attackerEntityId;
  }
};

const applySpreadToAim = (aim: { x: number; y: number }, spread: number, random: () => number): { x: number; y: number } => {
  const magnitude = Math.hypot(aim.x, aim.y);
  if (magnitude === 0 || spread === 0) {
    return aim;
  }

  const baseAngle = Math.atan2(aim.y, aim.x);
  const offset = (random() * 2 - 1) * spread;
  const finalAngle = baseAngle + offset;

  return {
    x: Math.cos(finalAngle) * magnitude,
    y: Math.sin(finalAngle) * magnitude,
  };
};

const findHitTarget = (
  state: RoomSimulationState,
  attacker: SimPlayer,
  aim: { x: number; y: number },
  range: number,
): HitTarget | null => {
  const magnitude = Math.hypot(aim.x, aim.y);
  if (magnitude === 0) {
    return null;
  }

  const direction = {
    x: aim.x / magnitude,
    y: aim.y / magnitude,
  };
  let closest: HitTarget | null = null;

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

    if (!closest || forwardDistance < closest.forwardDistance) {
      closest = {
        forwardDistance,
        entityId,
        position,
        apply(damage) {
          applyDamage(target, damage, attacker.entityId);
        },
        healthCurrent() {
          return target.health.current;
        },
        markDirty() {
          if (state.players.has(entityId)) {
            state.dirtyPlayerIds.add(entityId);
            return;
          }

          state.dirtyZombieIds.add(entityId);
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

    const weapon = getActiveWeapon(state, player);
    if (weapon.weaponDefinition.weaponType === "firearm") {
      consumeAmmoForReload(player, weapon.weaponDefinition.ammoItemId, weapon.weaponDefinition.magazineSize);
    }

    player.weaponState.isReloading = false;
    player.weaponState.reloadRemainingMs = 0;
    state.dirtyPlayerIds.add(player.entityId);
  }
};

const canFireAttack = (player: SimPlayer, weaponDefinition: WeaponDefinition, aim: { x: number; y: number }): boolean => {
  if (player.weaponState.isReloading || player.weaponState.fireCooldownRemainingMs > 0 || Math.hypot(aim.x, aim.y) === 0) {
    return false;
  }

  if (weaponDefinition.weaponType !== "firearm") {
    return true;
  }

  return player.weaponState.magazineAmmo > 0;
};

export const createCombatSystem = ({ random = Math.random }: { random?: () => number } = {}) => {
  return {
    name: "combat" as const,
    update(state: RoomSimulationState, deltaSeconds: number) {
      for (const player of state.players.values()) {
        const intent = state.inputIntents.get(player.entityId);
        if (!intent || player.health.isDead) {
          continue;
        }

        const weapon = getActiveWeapon(state, player);

        const weaponDefinition = weapon.weaponDefinition;

        if (
          weaponDefinition.weaponType === "firearm" &&
          intent.actions.reload &&
          !player.weaponState.isReloading &&
          player.weaponState.magazineAmmo < weaponDefinition.magazineSize &&
          player.inventory.ammoStacks.some((stack) => stack.ammoItemId === weaponDefinition.ammoItemId && stack.quantity > 0)
        ) {
          player.weaponState.isReloading = true;
          player.weaponState.reloadRemainingMs = weaponDefinition.reloadTimeMs;
          state.dirtyPlayerIds.add(player.entityId);
        }

        if (intent.actions.fire && canFireAttack(player, weaponDefinition, intent.aim)) {
          if (weaponDefinition.weaponType === "firearm") {
            player.weaponState.magazineAmmo -= 1;
            player.weaponState.fireCooldownRemainingMs = 1000 / weaponDefinition.fireRate;
          } else {
            player.weaponState.fireCooldownRemainingMs = weaponDefinition.swingDurationMs;
          }

          state.dirtyPlayerIds.add(player.entityId);

          const resolvedAim =
            weaponDefinition.weaponType === "firearm"
              ? applySpreadToAim(intent.aim, weaponDefinition.spread, random)
              : intent.aim;

          if (weaponDefinition.weaponType === "firearm") {
            state.events.push({
              type: "shot",
              roomId: state.roomId,
              attackerEntityId: player.entityId,
              weaponItemId: weapon.itemId,
              origin: {
                x: player.transform.x,
                y: player.transform.y,
              },
              aim: resolvedAim,
            });
          }

          const hitTarget = findHitTarget(state, player, resolvedAim, weaponDefinition.range);
          if (hitTarget) {
            hitTarget.apply(weaponDefinition.damage);
            state.events.push({
              type: "combat",
              roomId: state.roomId,
              attackerEntityId: player.entityId,
              targetEntityId: hitTarget.entityId,
              weaponItemId: weapon.itemId,
              damage: weaponDefinition.damage,
              remainingHealth: hitTarget.healthCurrent(),
              hitPosition: hitTarget.position,
            });
            hitTarget.markDirty();
          }
        }

        intent.actions.fire = undefined;
        intent.actions.reload = undefined;
      }

      updateWeaponTimers(state, deltaSeconds);
    },
  };
};
