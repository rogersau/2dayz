import { hasLineOfSight } from "../../world/lineOfSight";
import type { RoomSimulationState, SimZombie } from "../state";

const targetLossMs = 1_500;
const attackCooldownMs = 500;

const createZombieEntity = (state: RoomSimulationState, sourceZoneId: string, archetypeId: string, position: { x: number; y: number }): SimZombie => {
  const archetype = state.zombieArchetypes.get(archetypeId);
  if (!archetype) {
    throw new Error(`unknown zombie archetype ${archetypeId}`);
  }

  state.nextZombieEntitySequence += 1;

  return {
    entityId: `zombie_${state.roomId.replace(/^room_/, "")}-${state.nextZombieEntitySequence}`,
    archetypeId,
    transform: {
      x: position.x,
      y: position.y,
      rotation: 0,
    },
    velocity: { x: 0, y: 0 },
    health: {
      current: archetype.maxHealth,
      max: archetype.maxHealth,
      isDead: false,
    },
    state: "idle",
    aggroTargetEntityId: null,
    attackCooldownRemainingMs: 0,
    lostTargetMs: 0,
    sourceZoneId,
  };
};

const spawnZombiesForZones = (state: RoomSimulationState): void => {
  const zones = state.world?.map.zombieSpawnZones ?? [];

  for (const zone of zones) {
    const aliveInZone = [...state.zombies.values()].filter(
      (zombie) => zombie.sourceZoneId === zone.zoneId && !zombie.health.isDead,
    ).length;

    for (let index = aliveInZone; index < Math.min(zone.maxAlive, state.config.maxZombies); index += 1) {
      const archetypeId = zone.archetypeIds[0];
      if (!archetypeId) {
        continue;
      }

      const zombie = createZombieEntity(state, zone.zoneId, archetypeId, zone.center);
      state.zombies.set(zombie.entityId, zombie);
    }
  }
};

const canSeeTarget = (state: RoomSimulationState, zombie: SimZombie, targetPosition: { x: number; y: number }): boolean => {
  if (!state.world) {
    return true;
  }

  return hasLineOfSight(state.world.collision, zombie.transform, targetPosition, 0.1);
};

export const createZombieSystem = () => {
  return {
    name: "zombie" as const,
    update(state: RoomSimulationState, deltaSeconds: number) {
      spawnZombiesForZones(state);

      for (const zombie of state.zombies.values()) {
        if (zombie.health.isDead) {
          continue;
        }

        const archetype = state.zombieArchetypes.get(zombie.archetypeId);
        if (!archetype) {
          continue;
        }

        zombie.attackCooldownRemainingMs = Math.max(0, zombie.attackCooldownRemainingMs - deltaSeconds * 1000);

        let target = zombie.aggroTargetEntityId ? state.players.get(zombie.aggroTargetEntityId) : undefined;
        if (!target || target.health.isDead) {
          target = [...state.players.values()].find((player) => {
            const distance = Math.hypot(player.transform.x - zombie.transform.x, player.transform.y - zombie.transform.y);
            return !player.health.isDead && distance <= archetype.aggroRadius && canSeeTarget(state, zombie, player.transform);
          });
        }

        if (!target) {
          zombie.aggroTargetEntityId = null;
          zombie.state = "idle";
          zombie.velocity = { x: 0, y: 0 };
          zombie.lostTargetMs = 0;
          continue;
        }

        const distance = Math.hypot(target.transform.x - zombie.transform.x, target.transform.y - zombie.transform.y);
        const stillHasAggro = distance <= archetype.aggroRadius * 1.5 && canSeeTarget(state, zombie, target.transform);

        if (!stillHasAggro) {
          zombie.lostTargetMs += deltaSeconds * 1000;
          if (zombie.lostTargetMs >= targetLossMs) {
            zombie.aggroTargetEntityId = null;
            zombie.state = "idle";
            zombie.velocity = { x: 0, y: 0 };
            zombie.lostTargetMs = 0;
            continue;
          }
        } else {
          zombie.aggroTargetEntityId = target.entityId;
          zombie.lostTargetMs = 0;
        }

        if (distance <= archetype.attackRange) {
          zombie.state = "attacking";
          zombie.velocity = { x: 0, y: 0 };

          if (zombie.attackCooldownRemainingMs === 0) {
            target.health.current = Math.max(0, target.health.current - archetype.attackDamage);
            target.health.isDead = target.health.current === 0;
            zombie.attackCooldownRemainingMs = attackCooldownMs;
            state.dirtyPlayerIds.add(target.entityId);
          }

          continue;
        }

        const direction = {
          x: (target.transform.x - zombie.transform.x) / distance,
          y: (target.transform.y - zombie.transform.y) / distance,
        };
        zombie.state = "chasing";
        zombie.velocity = {
          x: direction.x * archetype.moveSpeed,
          y: direction.y * archetype.moveSpeed,
        };
        zombie.transform = {
          x: zombie.transform.x + zombie.velocity.x * deltaSeconds,
          y: zombie.transform.y + zombie.velocity.y * deltaSeconds,
          rotation: Math.atan2(direction.y, direction.x),
        };
      }
    },
  };
};
