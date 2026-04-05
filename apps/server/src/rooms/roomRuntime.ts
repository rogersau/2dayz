import { createFixedTickGameLoop, type SimulationSystem } from "../sim/gameLoop";
import {
  clearTransientSimulationState,
  createRoomSimulationConfig,
  createRoomState,
  queueDespawnEntity,
  queueInputIntent,
  queueSpawnPlayer,
  type PlayerInputIntent,
  type RoomSimulationConfig,
  type RoomSimulationState,
  type RoomWorldState,
} from "../sim/state";
import { createRoomReplicationDelta, createRoomReplicationSnapshot, type RoomReplicationDelta, type RoomReplicationSnapshot } from "../sim/query";
import { createLifecycleSystem } from "../sim/systems/lifecycleSystem";
import { createMovementSystem } from "../sim/systems/movementSystem";
import { createCombatSystem } from "../sim/systems/combatSystem";
import { createInventorySystem } from "../sim/systems/inventorySystem";
import { createLootSystem } from "../sim/systems/lootSystem";
import { createZombieSystem } from "../sim/systems/zombieSystem";
import type { Vector2 } from "@2dayz/shared";

export type RoomStatus = "active" | "full" | "unhealthy" | "shutting-down";

const playerRespawnRadius = 0.5;

export type JoinPlayerInput = {
  displayName: string;
};

export type JoinPlayerResult = {
  roomId: string;
  playerEntityId: string;
  runtime: RoomRuntime;
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
  tick(): void;
  queueInput(playerEntityId: string, intent: PlayerInputIntent): void;
  subscribePlayer(
    playerEntityId: string,
    handlers: {
      onSnapshot(snapshot: RoomReplicationSnapshot): void;
      onDelta(delta: RoomReplicationDelta): void;
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
  world?: RoomWorldState | null;
  config?: Partial<Omit<RoomSimulationConfig, "tickRateHz" | "isPositionBlocked" | "isMovementBlocked">> & {
    isMovementBlocked?: RoomSimulationConfig["isMovementBlocked"];
    isPositionBlocked?: RoomSimulationConfig["isPositionBlocked"];
  };
  systems?: SimulationSystem[];
  onSnapshot?(snapshot: RoomReplicationSnapshot): void;
  onDelta?(delta: RoomReplicationDelta): void;
};

type PlayerSession = {
  displayName: string;
  connected: boolean;
  subscriptions: Set<{
    onSnapshot(snapshot: RoomReplicationSnapshot): void;
    onDelta(delta: RoomReplicationDelta): void;
    initialSnapshotSent: boolean;
  }>;
};

const createPlayerEntityId = (roomId: string, playerNumber: number): string => {
  return `player_${roomId.replace(/^room_/, "")}-${playerNumber}`;
};

export const createSimulationRoomRuntime = ({
  roomId,
  world,
  config: configOverrides,
  systems,
  onSnapshot,
  onDelta,
}: CreateSimulationRoomRuntimeOptions): SimulationRoomRuntime => {
  const config = createRoomSimulationConfig(configOverrides);
  const simulationState = createRoomState({ roomId, config, world });
  const playerSessions = new Map<string, PlayerSession>();
  const roomSystems = systems ?? [
    createLifecycleSystem(),
    createCombatSystem(),
    createInventorySystem(),
    createMovementSystem(),
    createZombieSystem(),
    createLootSystem(),
  ];
  let playerSequence = 0;
  let healthy = true;
  let status: RoomStatus = "active";

  const getNextRespawnPoint = () => {
    const respawnPoints = simulationState.world?.respawnPoints;
    if (!respawnPoints || respawnPoints.length === 0) {
      return { x: 0, y: 0 };
    }

    const [firstRespawnPoint] = respawnPoints;
    if (!firstRespawnPoint) {
      return { x: 0, y: 0 };
    }

    const occupiedPoints: Vector2[] = [
      ...[...simulationState.players.values()].map((player) => ({ x: player.transform.x, y: player.transform.y })),
      ...simulationState.pendingSpawns.map((spawn) => spawn.position),
    ];

    const availablePoint = respawnPoints.find((point) => {
      return occupiedPoints.every((occupiedPoint) => {
        return Math.hypot(point.x - occupiedPoint.x, point.y - occupiedPoint.y) >= playerRespawnRadius * 2;
      });
    });

    return availablePoint ?? firstRespawnPoint;
  };

  const getConnectedPlayerIds = (): string[] => {
    return [...playerSessions.entries()]
      .filter(([, session]) => session.connected)
      .map(([playerEntityId]) => playerEntityId);
  };

  const loop = createFixedTickGameLoop({
    tickRateHz: config.tickRateHz,
    systems: roomSystems,
    onTick(state) {
      const delta = createRoomReplicationDelta(state);

      for (const playerEntityId of getConnectedPlayerIds()) {
        for (const handlers of playerSessions.get(playerEntityId)?.subscriptions ?? []) {
          if (handlers.initialSnapshotSent) {
            continue;
          }

          const snapshot = createRoomReplicationSnapshot(state, playerEntityId);
          handlers.onSnapshot(snapshot);
          handlers.initialSnapshotSent = true;
          onSnapshot?.(snapshot);
        }
      }

      onDelta?.(delta);
      for (const [playerEntityId, session] of playerSessions.entries()) {
        if (!session.connected) {
          continue;
        }

        for (const handlers of session.subscriptions) {
          handlers.onDelta(delta);
        }
      }
      clearTransientSimulationState(state);
    },
  });

  const updateStatus = (): void => {
    status = !healthy ? "unhealthy" : playerSessions.size >= config.playerCapacity ? "full" : "active";
  };

  let runtime: SimulationRoomRuntime;

  runtime = {
    roomId,
    capacity: config.playerCapacity,
    get status() {
      return status;
    },
    set status(nextStatus: RoomStatus) {
      status = nextStatus;
    },
    get playerCount() {
      return playerSessions.size;
    },
    simulationState,
    isHealthy() {
      return healthy;
    },
    canAcceptPlayers() {
      return healthy && playerSessions.size < config.playerCapacity;
    },
    joinPlayer(player) {
      if (!runtime.canAcceptPlayers()) {
        throw new Error("room cannot accept players");
      }

      playerSequence += 1;
      const playerEntityId = createPlayerEntityId(roomId, playerSequence);

      playerSessions.set(playerEntityId, {
        displayName: player.displayName,
        connected: true,
        subscriptions: new Set(),
      });
      queueSpawnPlayer(simulationState, {
        entityId: playerEntityId,
        displayName: player.displayName,
        position: getNextRespawnPoint(),
      });
      updateStatus();

      return { roomId, playerEntityId, runtime };
    },
    disconnectPlayer(playerEntityId) {
      const session = playerSessions.get(playerEntityId);
      if (!session) {
        return false;
      }

      session.connected = false;
      updateStatus();
      return true;
    },
    reclaimPlayer(playerEntityId) {
      const session = playerSessions.get(playerEntityId);
      if (!session || session.connected || !healthy) {
        return null;
      }

      session.connected = true;
      updateStatus();
      return { roomId, playerEntityId, runtime };
    },
    releasePlayer(playerEntityId) {
      if (!playerSessions.delete(playerEntityId)) {
        return false;
      }

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
    subscribePlayer(playerEntityId, handlers) {
      const session = playerSessions.get(playerEntityId);
      if (!session) {
        return null;
      }

      const subscription = {
        ...handlers,
        initialSnapshotSent: false,
      };

      if (simulationState.players.has(playerEntityId)) {
        const snapshot = createRoomReplicationSnapshot(simulationState, playerEntityId);
        subscription.onSnapshot(snapshot);
        subscription.initialSnapshotSent = true;
        onSnapshot?.(snapshot);
      }

      session.subscriptions.add(subscription);

      return () => {
        session.subscriptions.delete(subscription);
      };
    },
  };

  return runtime;
}

export type ManagedRoom = {
  runtime: RoomRuntime;
};
