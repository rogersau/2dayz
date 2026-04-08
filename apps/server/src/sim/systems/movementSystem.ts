import { getPlayers } from "../query";
import type { PlayerInputIntent, RoomSimulationState, SimPlayer } from "../state";

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

const getInventoryLoad = (state: RoomSimulationState, player: SimPlayer): number => {
  const occupiedSlots = player.inventory.slots.reduce((count, slot) => count + (slot ? 1 : 0), 0);
  const slotStackLoad = player.inventory.slots.reduce((total, slot) => {
    if (!slot) {
      return total;
    }

    return total + Math.max(0, slot.quantity - 1) / 2;
  }, 0);
  const ammoLoad = player.inventory.ammoStacks.reduce((total, stack) => {
    const item = state.itemDefinitions.get(stack.ammoItemId);
    if (!item || item.category !== "ammo") {
      return total;
    }

    return total + stack.quantity / 30;
  }, 0);

  return occupiedSlots + slotStackLoad + ammoLoad;
};

const getStaminaMax = (state: RoomSimulationState, player: SimPlayer): number => {
  const load = getInventoryLoad(state, player);
  return Math.max(state.config.staminaFloor, state.config.staminaBaseline - load * state.config.staminaLoadPenalty);
};

export const createMovementSystem = (): MovementSystem => {
  return {
    name: "movement",
    update(state, deltaSeconds) {
      for (const player of getPlayers(state)) {
        const previousStamina = {
          current: player.stamina.current,
          max: player.stamina.max,
        };
        const staminaMax = getStaminaMax(state, player);
        player.stamina.max = staminaMax;
        player.stamina.current = Math.min(player.stamina.current, staminaMax);
        const staminaChanged =
          player.stamina.current !== previousStamina.current || player.stamina.max !== previousStamina.max;

        const intent = state.inputIntents.get(player.entityId);
        if (!intent) {
          player.stamina.current = Math.min(player.stamina.max, player.stamina.current + state.config.staminaRegenPerSecond * deltaSeconds);
          if (staminaChanged || player.stamina.current !== previousStamina.current) {
            state.dirtyPlayerIds.add(player.entityId);
          }
          continue;
        }

        if (player.health.isDead) {
          player.velocity = { x: 0, y: 0 };
          state.inputIntents.delete(player.entityId);
          state.lastProcessedInputSequence.set(player.entityId, intent.sequence);
          if (staminaChanged) {
            state.dirtyPlayerIds.add(player.entityId);
          }
          continue;
        }

        const direction = normalizeMovement(intent.movement);
        const moving = direction.x !== 0 || direction.y !== 0;
        const sprinting =
          Boolean(intent.actions.sprint) && !Boolean(intent.actions.aiming) && moving && player.stamina.current > 0;
        const speed = sprinting
          ? state.config.maxPlayerSpeed * state.config.sprintSpeedMultiplier
          : state.config.maxPlayerSpeed;
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
        const blocked = state.config.isMovementBlocked(
          {
            from: { x: player.transform.x, y: player.transform.y },
            to: nextPosition,
            radius: 0.5,
          },
          player.entityId,
        );

        player.transform = {
          x: blocked ? player.transform.x : nextPosition.x,
          y: blocked ? player.transform.y : nextPosition.y,
          rotation,
        };
        player.velocity = blocked ? { x: 0, y: 0 } : velocity;
        const sprintRequested = Boolean(intent.actions.sprint) && moving;
        const consumedSprintMovement = sprinting && !blocked;
        if (consumedSprintMovement) {
          state.sprintNoiseEvents.push({
            playerEntityId: player.entityId,
            position: { x: player.transform.x, y: player.transform.y },
          });
        }
        if (consumedSprintMovement) {
          player.stamina.current = Math.max(0, player.stamina.current - state.config.staminaDrainPerSecond * deltaSeconds);
        } else if (!sprintRequested) {
          player.stamina.current = Math.min(player.stamina.max, player.stamina.current + state.config.staminaRegenPerSecond * deltaSeconds);
        }
        state.inputIntents.delete(player.entityId);
        state.lastProcessedInputSequence.set(player.entityId, intent.sequence);
        state.dirtyPlayerIds.add(player.entityId);
      }
    },
  };
};
