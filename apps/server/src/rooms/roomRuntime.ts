import type { DeltaMessage, SnapshotMessage } from "@2dayz/shared";

import { createFixedTickGameLoop, type SimulationSystem } from "../sim/gameLoop";
import {
  clearTransientSimulationState,
  createDeltaMessage,
  createRoomSimulationConfig,
  createRoomState,
  createSnapshotMessage,
  queueDespawnEntity,
  queueInputIntent,
  queueSpawnPlayer,
  type PlayerInputIntent,
  type RoomSimulationConfig,
  type RoomSimulationState,
} from "../sim/state";
import { createLifecycleSystem } from "../sim/systems/lifecycleSystem";
import { createMovementSystem } from "../sim/systems/movementSystem";

export type RoomStatus = "active" | "full" | "unhealthy" | "shutting-down";

export type JoinPlayerInput = {
  displayName: string;
};

export type JoinPlayerResult = {
  roomId: string;
  playerEntityId: string;
};

export interface RoomRuntime {
  roomId: string;
  capacity: number;
  status: RoomStatus;
  playerCount: number;
  isHealthy(): boolean;
  canAcceptPlayers(): boolean;
  joinPlayer(player: JoinPlayerInput): JoinPlayerResult;
  disconnectPlayer(playerEntityId: string): boolean;
  reclaimPlayer(playerEntityId: string): JoinPlayerResult | null;
  releasePlayer(playerEntityId: string): boolean;
  shutdown(reason?: string): void;
  tick?(): void;
  queueInput?(playerEntityId: string, intent: PlayerInputIntent): void;
  subscribePlayerUpdates?(
    playerEntityId: string,
    handlers: {
      onSnapshot(snapshot: SnapshotMessage): void;
      onDelta(delta: DeltaMessage): void;
    },
  ): (() => void) | null;
}

export interface SimulationRoomRuntime extends RoomRuntime {
  simulationState: RoomSimulationState;
  advance(elapsedMs: number): void;
  queueInput(playerEntityId: string, intent: PlayerInputIntent): void;
}

type CreateSimulationRoomRuntimeOptions = {
  roomId: string;
  config?: Partial<Omit<RoomSimulationConfig, "isPositionBlocked">> & {
    isPositionBlocked?: RoomSimulationConfig["isPositionBlocked"];
  };
  systems?: SimulationSystem[];
  onSnapshot?(snapshot: SnapshotMessage): void;
  onDelta?(delta: DeltaMessage): void;
};

const createPlayerEntityId = (roomId: string, playerNumber: number): string => {
  return `player_${roomId.replace(/^room_/, "")}-${playerNumber}`;
};

export const createSimulationRoomRuntime = ({
  roomId,
  config: configOverrides,
  systems,
  onSnapshot,
  onDelta,
}: CreateSimulationRoomRuntimeOptions): SimulationRoomRuntime => {
  const config = createRoomSimulationConfig(configOverrides);
  const simulationState = createRoomState({ roomId, config });
  const activePlayers = new Set<string>();
  const knownPlayers = new Set<string>();
  const subscriptions = new Map<
    string,
    Set<{
      onSnapshot(snapshot: SnapshotMessage): void;
      onDelta(delta: DeltaMessage): void;
    }>
  >();
  const roomSystems = systems ?? [createLifecycleSystem(), createMovementSystem()];
  let playerSequence = 0;
  let healthy = true;
  let status: RoomStatus = "active";

  const loop = createFixedTickGameLoop({
    tickRateHz: config.tickRateHz,
    systems: roomSystems,
    onTick(state) {
      const delta = createDeltaMessage(state);

      for (const playerEntityId of activePlayers) {
        const snapshot = createSnapshotMessage(state, playerEntityId);
        onSnapshot?.(snapshot);

        for (const handlers of subscriptions.get(playerEntityId) ?? []) {
          handlers.onSnapshot(snapshot);
        }
      }

      onDelta?.(delta);
      for (const [playerEntityId, handlersSet] of subscriptions.entries()) {
        if (!activePlayers.has(playerEntityId)) {
          continue;
        }

        for (const handlers of handlersSet) {
          handlers.onDelta(delta);
        }
      }
      clearTransientSimulationState(state);
    },
  });

  const updateStatus = (): void => {
    status = !healthy ? "unhealthy" : knownPlayers.size >= config.playerCapacity ? "full" : "active";
  };

  return {
    roomId,
    capacity: config.playerCapacity,
    get status() {
      return status;
    },
    set status(nextStatus: RoomStatus) {
      status = nextStatus;
    },
    get playerCount() {
      return knownPlayers.size;
    },
    simulationState,
    isHealthy() {
      return healthy;
    },
    canAcceptPlayers() {
      return healthy && knownPlayers.size < config.playerCapacity;
    },
    joinPlayer(player) {
      if (!this.canAcceptPlayers()) {
        throw new Error("room cannot accept players");
      }

      playerSequence += 1;
      const playerEntityId = createPlayerEntityId(roomId, playerSequence);

      knownPlayers.add(playerEntityId);
      activePlayers.add(playerEntityId);
      queueSpawnPlayer(simulationState, {
        entityId: playerEntityId,
        displayName: player.displayName,
        position: { x: 0, y: 0 },
      });
      updateStatus();

      return { roomId, playerEntityId };
    },
    disconnectPlayer(playerEntityId) {
      if (!knownPlayers.has(playerEntityId)) {
        return false;
      }

      activePlayers.delete(playerEntityId);
      updateStatus();
      return true;
    },
    reclaimPlayer(playerEntityId) {
      if (!knownPlayers.has(playerEntityId) || activePlayers.has(playerEntityId) || !healthy) {
        return null;
      }

      activePlayers.add(playerEntityId);
      updateStatus();
      return { roomId, playerEntityId };
    },
    releasePlayer(playerEntityId) {
      if (!knownPlayers.delete(playerEntityId)) {
        return false;
      }

      activePlayers.delete(playerEntityId);
      subscriptions.delete(playerEntityId);
      queueDespawnEntity(simulationState, playerEntityId);
      updateStatus();
      return true;
    },
    shutdown() {
      healthy = false;
      status = "shutting-down";
    },
    tick() {
      this.advance(1000 / config.tickRateHz);
    },
    advance(elapsedMs) {
      if (!healthy) {
        throw new Error("room is unavailable");
      }

      loop.advance(simulationState, elapsedMs);
      updateStatus();
    },
    queueInput(playerEntityId, intent) {
      queueInputIntent(simulationState, playerEntityId, intent);
    },
    subscribePlayerUpdates(playerEntityId, handlers) {
      if (!knownPlayers.has(playerEntityId)) {
        return null;
      }

      const playerSubscriptions = subscriptions.get(playerEntityId) ?? new Set();
      playerSubscriptions.add(handlers);
      subscriptions.set(playerEntityId, playerSubscriptions);

      return () => {
        const currentSubscriptions = subscriptions.get(playerEntityId);
        if (!currentSubscriptions) {
          return;
        }

        currentSubscriptions.delete(handlers);
        if (currentSubscriptions.size === 0) {
          subscriptions.delete(playerEntityId);
        }
      };
    },
  };
}

export type ManagedRoom = {
  runtime: RoomRuntime;
};
