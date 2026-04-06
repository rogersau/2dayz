import type { RoomSimulationState } from "../sim/state";

const playerRespawnRadius = 0.5;

const isRespawnPointValid = (state: RoomSimulationState, entityId: string | null, position: { x: number; y: number }): boolean => {
  const occupiedPoints = [...state.players.values()]
    .filter((player) => player.entityId !== entityId)
    .map((player) => ({ x: player.transform.x, y: player.transform.y }));

  if (state.config.isPositionBlocked(position, entityId ?? "respawn_probe")) {
    return false;
  }

  return occupiedPoints.every((occupiedPoint) => {
    return Math.hypot(position.x - occupiedPoint.x, position.y - occupiedPoint.y) >= playerRespawnRadius * 2;
  });
};

export const selectRespawnPoint = (state: RoomSimulationState): { x: number; y: number } => {
  const respawnPoints = state.world?.respawnPoints;
  if (!respawnPoints || respawnPoints.length === 0) {
    return { x: 0, y: 0 };
  }

  const [firstRespawnPoint] = respawnPoints;
  const availablePoint = respawnPoints.find((point) => isRespawnPointValid(state, null, point));

  return availablePoint ?? firstRespawnPoint ?? { x: 0, y: 0 };
};

export const queuePlayerRespawn = (state: RoomSimulationState, entityId: string, delayMs = 0): void => {
  if (state.pendingRespawns.some((respawn) => respawn.entityId === entityId)) {
    return;
  }

  const position = selectRespawnPoint(state);

  state.pendingRespawns.push({
    entityId,
    respawnAtMs: state.elapsedMs + delayMs,
    position,
  });
};

export const processPendingRespawns = (state: RoomSimulationState): void => {
  const dueRespawns = state.pendingRespawns.filter((respawn) => respawn.respawnAtMs <= state.elapsedMs);
  state.pendingRespawns = state.pendingRespawns.filter((respawn) => respawn.respawnAtMs > state.elapsedMs);

  for (const respawn of dueRespawns) {
    const player = state.players.get(respawn.entityId);
    if (!player) {
      continue;
    }

    const position = isRespawnPointValid(state, player.entityId, respawn.position)
      ? respawn.position
      : selectRespawnPoint({
          ...state,
          players: new Map(
            [...state.players.entries()].filter(([entityId]) => entityId !== player.entityId),
          ),
        });

    player.transform = {
      x: position.x,
      y: position.y,
      rotation: 0,
    };
    player.velocity = { x: 0, y: 0 };
    player.health = {
      current: player.health.max,
      max: player.health.max,
      isDead: false,
    };
    player.lastDamagedByEntityId = null;

    state.handledDeathEntityIds.delete(player.entityId);
    state.dirtyPlayerIds.add(player.entityId);
  }
};
