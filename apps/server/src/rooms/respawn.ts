import type { RoomSimulationState } from "../sim/state";

const playerRespawnRadius = 0.5;

export const selectRespawnPoint = (state: RoomSimulationState): { x: number; y: number } => {
  const respawnPoints = state.world?.respawnPoints;
  if (!respawnPoints || respawnPoints.length === 0) {
    return { x: 0, y: 0 };
  }

  const [firstRespawnPoint] = respawnPoints;
  const occupiedPoints = [...state.players.values()].map((player) => ({ x: player.transform.x, y: player.transform.y }));

  const availablePoint = respawnPoints.find((point) => {
    return occupiedPoints.every((occupiedPoint) => {
      return Math.hypot(point.x - occupiedPoint.x, point.y - occupiedPoint.y) >= playerRespawnRadius * 2;
    });
  });

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

    player.transform = {
      x: respawn.position.x,
      y: respawn.position.y,
      rotation: 0,
    };
    player.velocity = { x: 0, y: 0 };
    player.health = {
      current: player.health.max,
      max: player.health.max,
      isDead: false,
    };

    state.handledDeathEntityIds.delete(player.entityId);
    state.dirtyPlayerIds.add(player.entityId);
  }
};
