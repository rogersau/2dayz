import { getPlayers } from "../query";
import type { PlayerInputIntent, RoomSimulationState } from "../state";

export type MovementSystem = {
  name: "movement";
  update(state: RoomSimulationState, deltaSeconds: number): void;
};

const normalizeMovement = (intent: PlayerInputIntent["movement"]): { x: number; y: number } => {
  const magnitude = Math.hypot(intent.x, intent.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: intent.x / magnitude,
    y: intent.y / magnitude,
  };
};

export const createMovementSystem = (): MovementSystem => {
  return {
    name: "movement",
    update(state, deltaSeconds) {
      for (const player of getPlayers(state)) {
        const intent = state.inputIntents.get(player.entityId);
        if (!intent) {
          continue;
        }

        const direction = normalizeMovement(intent.movement);
        const speed = state.config.maxPlayerSpeed;
        const velocity = {
          x: direction.x * speed,
          y: direction.y * speed,
        };
        const nextPosition = {
          x: player.transform.x + velocity.x * deltaSeconds,
          y: player.transform.y + velocity.y * deltaSeconds,
        };
        const aimMagnitude = Math.hypot(intent.aim.x, intent.aim.y);
        const rotation = aimMagnitude > 0 ? Math.atan2(intent.aim.y, intent.aim.x) : player.transform.rotation;
        const blocked = state.config.isPositionBlocked(nextPosition, player.entityId);

        player.transform = {
          x: blocked ? player.transform.x : nextPosition.x,
          y: blocked ? player.transform.y : nextPosition.y,
          rotation,
        };
        player.velocity = blocked ? { x: 0, y: 0 } : velocity;
        state.inputIntents.delete(player.entityId);
        state.dirtyPlayerIds.add(player.entityId);
      }
    },
  };
};
