import { hasLineOfSight } from "../../world/lineOfSight";
import type { RoomSimulationState, SimZombie } from "../state";

const targetLossMs = 1_500;
const attackCooldownMs = 500;

const getAliveZombieCount = (state: RoomSimulationState): number => {
  return [...state.zombies.values()].filter((zombie) => !zombie.health.isDead).length;
};

const moveToward = (zombie: SimZombie, targetPosition: { x: number; y: number }, speed: number, deltaSeconds: number): void => {
  const distance = Math.hypot(targetPosition.x - zombie.transform.x, targetPosition.y - zombie.transform.y);
  if (distance === 0) {
    zombie.velocity = { x: 0, y: 0 };
    return;
  }

  const direction = {
    x: (targetPosition.x - zombie.transform.x) / distance,
    y: (targetPosition.y - zombie.transform.y) / distance,
  };
  zombie.velocity = {
    x: direction.x * speed,
    y: direction.y * speed,
  };
  zombie.transform = {
    x: zombie.transform.x + zombie.velocity.x * deltaSeconds,
    y: zombie.transform.y + zombie.velocity.y * deltaSeconds,
    rotation: Math.atan2(direction.y, direction.x),
  };
};

const roamWhileIdle = (state: RoomSimulationState, zombie: SimZombie, deltaSeconds: number, speed: number): void => {
  const graph = state.world?.navigation;
  const nodes = graph ? [...graph.nodes.values()] : [];

  if (nodes.length === 0) {
    zombie.state = "idle";
    zombie.velocity = { x: 0, y: 0 };
    return;
  }

  const nearestNode = nodes.reduce((closest, node) => {
    const closestDistance = Math.hypot(closest.position.x - zombie.transform.x, closest.position.y - zombie.transform.y);
    const nodeDistance = Math.hypot(node.position.x - zombie.transform.x, node.position.y - zombie.transform.y);
    return nodeDistance < closestDistance ? node : closest;
  });
  const neighbors = graph?.neighbors.get(zombie.roamingTargetNodeId ?? nearestNode.nodeId) ?? [];
  const targetNodeId = neighbors[0]?.nodeId ?? nearestNode.nodeId;
  const targetNode = graph?.nodes.get(targetNodeId);

  if (!targetNode) {
    zombie.state = "idle";
    zombie.velocity = { x: 0, y: 0 };
    return;
  }

  zombie.roamingTargetNodeId = targetNode.nodeId;
  zombie.state = "roaming";
  moveToward(zombie, targetNode.position, speed * 0.5, deltaSeconds);

  if (Math.hypot(targetNode.position.x - zombie.transform.x, targetNode.position.y - zombie.transform.y) <= 0.2) {
    const nextNeighbors = graph?.neighbors.get(targetNode.nodeId) ?? [];
    zombie.roamingTargetNodeId = nextNeighbors[0]?.nodeId ?? nearestNode.nodeId;
  }
};

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
    roamingTargetNodeId: undefined,
  };
};

const spawnZombiesForZones = (state: RoomSimulationState): void => {
  const zones = state.world?.map.zombieSpawnZones ?? [];

  for (const zone of zones) {
    if (getAliveZombieCount(state) >= state.config.maxZombies) {
      break;
    }

    const aliveInZone = [...state.zombies.values()].filter(
      (zombie) => zombie.sourceZoneId === zone.zoneId && !zombie.health.isDead,
    ).length;

    const roomCapacityRemaining = state.config.maxZombies - getAliveZombieCount(state);
    for (let index = aliveInZone; index < aliveInZone + Math.min(zone.maxAlive - aliveInZone, roomCapacityRemaining); index += 1) {
      const archetypeId = zone.archetypeIds[0];
      if (!archetypeId) {
        continue;
      }

      const zombie = createZombieEntity(state, zone.zoneId, archetypeId, zone.center);
      state.zombies.set(zombie.entityId, zombie);
      state.dirtyZombieIds.add(zombie.entityId);
    }
  }
};

const cleanupDeadZombies = (state: RoomSimulationState): void => {
  for (const zombie of state.zombies.values()) {
    if (!zombie.health.isDead) {
      continue;
    }

    state.zombies.delete(zombie.entityId);
    state.dirtyZombieIds.delete(zombie.entityId);
    state.removedEntityIds.add(zombie.entityId);
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
      cleanupDeadZombies(state);
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
          zombie.lostTargetMs = 0;
          roamWhileIdle(state, zombie, deltaSeconds, archetype.moveSpeed);
          state.dirtyZombieIds.add(zombie.entityId);
          continue;
        }

        const distance = Math.hypot(target.transform.x - zombie.transform.x, target.transform.y - zombie.transform.y);
        const stillHasAggro = distance <= archetype.aggroRadius * 1.5 && canSeeTarget(state, zombie, target.transform);

        if (!stillHasAggro) {
          zombie.lostTargetMs += deltaSeconds * 1000;
          if (zombie.lostTargetMs >= targetLossMs) {
            zombie.aggroTargetEntityId = null;
            zombie.lostTargetMs = 0;
            roamWhileIdle(state, zombie, deltaSeconds, archetype.moveSpeed);
            state.dirtyZombieIds.add(zombie.entityId);
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
            state.dirtyZombieIds.add(zombie.entityId);
          }

          continue;
        }

        zombie.state = "chasing";
        moveToward(zombie, target.transform, archetype.moveSpeed, deltaSeconds);
        state.dirtyZombieIds.add(zombie.entityId);
      }
    },
  };
};
