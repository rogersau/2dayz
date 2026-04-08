import { hasLineOfSight } from "../../world/lineOfSight";
import { findNextNavigationStep } from "../../world/navigation";
import type { RoomSimulationState, SimZombie } from "../state";

const targetLossMs = 1_500;
const attackCooldownMs = 500;
const soundReachByType = {
  shot: 14,
  sprint: 8,
} as const;
const searchArrivalDistance = 0.25;

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

const findNearestNodeId = (
  state: RoomSimulationState,
  position: { x: number; y: number },
): string | null => {
  const nodes = state.world ? [...state.world.navigation.nodes.values()] : [];
  if (nodes.length === 0) {
    return null;
  }

  return nodes.reduce((closestNode, candidate) => {
    if (!closestNode) {
      return candidate.nodeId;
    }

    const closest = state.world?.navigation.nodes.get(closestNode);
    if (!closest) {
      return candidate.nodeId;
    }

    const closestDistance = Math.hypot(closest.position.x - position.x, closest.position.y - position.y);
    const candidateDistance = Math.hypot(candidate.position.x - position.x, candidate.position.y - position.y);
    return candidateDistance < closestDistance ? candidate.nodeId : closestNode;
  }, null as string | null);
};

const moveZombieTowardTarget = (
  state: RoomSimulationState,
  zombie: SimZombie,
  targetPosition: { x: number; y: number },
  speed: number,
  deltaSeconds: number,
): void => {
  const directDistance = Math.hypot(targetPosition.x - zombie.transform.x, targetPosition.y - zombie.transform.y);
  if (directDistance === 0) {
    zombie.velocity = { x: 0, y: 0 };
    return;
  }

  const directDirection = {
    x: (targetPosition.x - zombie.transform.x) / directDistance,
    y: (targetPosition.y - zombie.transform.y) / directDistance,
  };
  const directNextPosition = {
    x: zombie.transform.x + directDirection.x * speed * deltaSeconds,
    y: zombie.transform.y + directDirection.y * speed * deltaSeconds,
  };

  if (!state.config.isMovementBlocked({ from: zombie.transform, to: directNextPosition, radius: 0.5 }, zombie.entityId)) {
    moveToward(zombie, targetPosition, speed, deltaSeconds);
    return;
  }

  const startNodeId = findNearestNodeId(state, zombie.transform);
  const targetNodeId = findNearestNodeId(state, targetPosition);
  if (!state.world || !startNodeId || !targetNodeId) {
    zombie.velocity = { x: 0, y: 0 };
    return;
  }

  const nextStep = findNextNavigationStep(state.world.navigation, startNodeId, targetNodeId);
  if (!nextStep) {
    zombie.velocity = { x: 0, y: 0 };
    return;
  }

  moveToward(zombie, nextStep.position, speed, deltaSeconds);
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
    heardTargetEntityId: null,
    heardPosition: null,
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

type HeardStimulus = {
  sourceEntityId: string | null;
  position: { x: number; y: number };
  grantsImmediateAggroFromPosition: boolean;
};

const findNearestHeardStimulus = (state: RoomSimulationState, zombie: SimZombie): HeardStimulus | null => {
  let nearestStimulus: HeardStimulus | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const event of state.events) {
    if (event.type !== "shot") {
      continue;
    }

    const distance = Math.hypot(event.origin.x - zombie.transform.x, event.origin.y - zombie.transform.y);
    if (distance > soundReachByType.shot || distance >= nearestDistance) {
      continue;
    }

    nearestStimulus = {
      sourceEntityId: event.attackerEntityId,
      position: event.origin,
      grantsImmediateAggroFromPosition: true,
    };
    nearestDistance = distance;
  }

  for (const sprintNoise of state.sprintNoiseEvents) {
    const distance = Math.hypot(sprintNoise.position.x - zombie.transform.x, sprintNoise.position.y - zombie.transform.y);
    if (distance > soundReachByType.sprint || distance >= nearestDistance) {
      continue;
    }

    nearestStimulus = {
      sourceEntityId: sprintNoise.playerEntityId,
      position: sprintNoise.position,
      grantsImmediateAggroFromPosition: false,
    };
    nearestDistance = distance;
  }

  return nearestStimulus;
};

const clearSearchState = (zombie: SimZombie): void => {
  zombie.heardTargetEntityId = null;
  zombie.heardPosition = null;
};

const beginSearching = (zombie: SimZombie, sourceEntityId: string | null, position: { x: number; y: number }): void => {
  zombie.aggroTargetEntityId = null;
  zombie.lostTargetMs = 0;
  zombie.heardTargetEntityId = sourceEntityId;
  zombie.heardPosition = { x: position.x, y: position.y };
  zombie.state = "searching";
};

const lockAggroToTarget = (zombie: SimZombie, targetEntityId: string): void => {
  zombie.aggroTargetEntityId = targetEntityId;
  zombie.lostTargetMs = 0;
  clearSearchState(zombie);
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

        const trackedAggroTarget = zombie.aggroTargetEntityId ? state.players.get(zombie.aggroTargetEntityId) : undefined;
        const trackedTargetStillAlive = Boolean(trackedAggroTarget && !trackedAggroTarget.health.isDead);
        const currentTargetHasAggro = Boolean(
          trackedAggroTarget &&
            !trackedAggroTarget.health.isDead &&
            Math.hypot(trackedAggroTarget.transform.x - zombie.transform.x, trackedAggroTarget.transform.y - zombie.transform.y) <=
              archetype.aggroRadius * 1.5 &&
            canSeeTarget(state, zombie, trackedAggroTarget.transform),
        );
        let target = trackedTargetStillAlive ? trackedAggroTarget : undefined;
        let pendingHiddenStimulus: HeardStimulus | null = null;

        const heardStimulus = findNearestHeardStimulus(state, zombie);
        if (heardStimulus) {
          const heardPlayer = heardStimulus.sourceEntityId ? state.players.get(heardStimulus.sourceEntityId) : undefined;
          const canSeeStimulus = canSeeTarget(state, zombie, heardStimulus.position);

          if (heardPlayer && !heardPlayer.health.isDead && heardStimulus.grantsImmediateAggroFromPosition && canSeeStimulus) {
            lockAggroToTarget(zombie, heardPlayer.entityId);
            target = heardPlayer;
          } else if (trackedTargetStillAlive && !currentTargetHasAggro) {
            pendingHiddenStimulus = heardStimulus;
          } else if (!currentTargetHasAggro) {
            beginSearching(zombie, heardStimulus.sourceEntityId, heardStimulus.position);
            pendingHiddenStimulus = heardStimulus;
          }
        }

        if (!target || target.health.isDead) {
          target = [...state.players.values()].find((player) => {
            const distance = Math.hypot(player.transform.x - zombie.transform.x, player.transform.y - zombie.transform.y);
            return !player.health.isDead && distance <= archetype.aggroRadius && canSeeTarget(state, zombie, player.transform);
          });
        }

        const reacquiredVisibleTarget =
          target &&
          !target.health.isDead &&
          (!zombie.aggroTargetEntityId || zombie.aggroTargetEntityId !== target.entityId);

        if (reacquiredVisibleTarget && target) {
          lockAggroToTarget(zombie, target.entityId);
        } else if (zombie.heardTargetEntityId) {
          const heardTarget = state.players.get(zombie.heardTargetEntityId);
          if (heardTarget && !heardTarget.health.isDead && canSeeTarget(state, zombie, heardTarget.transform)) {
            lockAggroToTarget(zombie, heardTarget.entityId);
            target = heardTarget;
          }
        }

        if (!target && zombie.heardPosition) {
          const distanceToHeardPosition = Math.hypot(
            zombie.heardPosition.x - zombie.transform.x,
            zombie.heardPosition.y - zombie.transform.y,
          );

          if (distanceToHeardPosition <= searchArrivalDistance) {
            clearSearchState(zombie);
            roamWhileIdle(state, zombie, deltaSeconds, archetype.moveSpeed);
            state.dirtyZombieIds.add(zombie.entityId);
            continue;
          }

          zombie.state = "searching";
          moveZombieTowardTarget(state, zombie, zombie.heardPosition, archetype.moveSpeed, deltaSeconds);
          state.dirtyZombieIds.add(zombie.entityId);
          continue;
        }

        if (!target) {
          zombie.aggroTargetEntityId = null;
          zombie.lostTargetMs = 0;
          clearSearchState(zombie);
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
            if (pendingHiddenStimulus) {
              beginSearching(zombie, pendingHiddenStimulus.sourceEntityId, pendingHiddenStimulus.position);
              moveZombieTowardTarget(state, zombie, pendingHiddenStimulus.position, archetype.moveSpeed, deltaSeconds);
              state.dirtyZombieIds.add(zombie.entityId);
              continue;
            }
            clearSearchState(zombie);
            roamWhileIdle(state, zombie, deltaSeconds, archetype.moveSpeed);
            state.dirtyZombieIds.add(zombie.entityId);
            continue;
          }
        } else {
          lockAggroToTarget(zombie, target.entityId);
        }

        if (distance <= archetype.attackRange) {
          zombie.state = "attacking";
          zombie.velocity = { x: 0, y: 0 };
          state.dirtyZombieIds.add(zombie.entityId);

          if (zombie.attackCooldownRemainingMs === 0) {
            target.health.current = Math.max(0, target.health.current - archetype.attackDamage);
            target.health.isDead = target.health.current === 0;
            target.lastDamagedByEntityId = zombie.entityId;
            zombie.attackCooldownRemainingMs = attackCooldownMs;
            state.dirtyPlayerIds.add(target.entityId);
          }

          continue;
        }

        zombie.state = "chasing";
        moveZombieTowardTarget(state, zombie, target.transform, archetype.moveSpeed, deltaSeconds);
        state.dirtyZombieIds.add(zombie.entityId);
      }
    },
  };
};
