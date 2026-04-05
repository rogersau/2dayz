import { INVENTORY_SLOT_COUNT, ROOM_PLAYER_CAPACITY, SERVER_TICK_RATE, type Health, type InputMessage, type Inventory, type MapDefinition, type ServerEvent, type Transform, type Vector2, type Velocity } from "@2dayz/shared";

import type { CollisionIndex } from "../world/collision";
import type { NavigationGraph } from "../world/navigation";

export const MIN_ROOM_PLAYER_CAPACITY = 8;
export const MAX_ROOM_PLAYER_CAPACITY = 12;
export const DEFAULT_MAX_ZOMBIES = 24;
export const DEFAULT_MAX_DROPPED_ITEMS = 64;
export const DEFAULT_MAX_PLAYER_SPEED = 4;

export type PlayerInputIntent = Omit<InputMessage, "type">;

export type RoomSimulationConfig = {
  playerCapacity: number;
  tickRateHz: number;
  maxZombies: number;
  maxDroppedItems: number;
  maxPlayerSpeed: number;
  isMovementBlocked(movement: { from: Vector2; to: Vector2; radius: number }, entityId: string): boolean;
  isPositionBlocked(position: Vector2, entityId: string): boolean;
};

export type SimPlayer = {
  entityId: string;
  displayName: string;
  transform: Transform;
  velocity: Velocity;
  health: Health;
  inventory: Inventory;
};

export type SpawnPlayerRequest = {
  entityId: string;
  displayName: string;
  position: Vector2;
};

export type RoomWorldState = {
  map: MapDefinition;
  collision: CollisionIndex;
  navigation: NavigationGraph;
  respawnPoints: Vector2[];
};

export type RoomSimulationState = {
  roomId: string;
  tick: number;
  config: RoomSimulationConfig;
  world: RoomWorldState | null;
  players: Map<string, SimPlayer>;
  pendingSpawns: SpawnPlayerRequest[];
  pendingDespawns: string[];
  inputIntents: Map<string, PlayerInputIntent>;
  lastProcessedInputSequence: Map<string, number>;
  dirtyPlayerIds: Set<string>;
  removedEntityIds: Set<string>;
  events: ServerEvent[];
};

const createEmptyInventory = (): Inventory => {
  return {
    slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => null),
    equippedWeaponSlot: null,
    ammoStacks: [],
  };
};

const createDefaultHealth = (): Health => {
  return {
    current: 100,
    max: 100,
    isDead: false,
  };
};

const assertInRange = (value: number, min: number, max: number, label: string): void => {
  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
};

const assertPositive = (value: number, label: string): void => {
  if (value <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
};

const assertFixedTickRate = (value: number): void => {
  if (value !== SERVER_TICK_RATE) {
    throw new Error(`fixed tick rate must be ${SERVER_TICK_RATE}`);
  }
};

export const createRoomSimulationConfig = (
  overrides: Partial<Omit<RoomSimulationConfig, "tickRateHz" | "isPositionBlocked" | "isMovementBlocked">> & {
    tickRateHz?: number;
    isMovementBlocked?: RoomSimulationConfig["isMovementBlocked"];
    isPositionBlocked?: RoomSimulationConfig["isPositionBlocked"];
  } = {},
): RoomSimulationConfig => {
  const config: RoomSimulationConfig = {
    playerCapacity: overrides.playerCapacity ?? ROOM_PLAYER_CAPACITY,
    tickRateHz: overrides.tickRateHz ?? SERVER_TICK_RATE,
    maxZombies: overrides.maxZombies ?? DEFAULT_MAX_ZOMBIES,
    maxDroppedItems: overrides.maxDroppedItems ?? DEFAULT_MAX_DROPPED_ITEMS,
    maxPlayerSpeed: overrides.maxPlayerSpeed ?? DEFAULT_MAX_PLAYER_SPEED,
    isMovementBlocked:
      overrides.isMovementBlocked ??
      ((movement, entityId) => {
        return (overrides.isPositionBlocked ?? (() => false))(movement.to, entityId);
      }),
    isPositionBlocked: overrides.isPositionBlocked ?? (() => false),
  };

  assertInRange(config.playerCapacity, MIN_ROOM_PLAYER_CAPACITY, MAX_ROOM_PLAYER_CAPACITY, "player capacity");
  assertFixedTickRate(config.tickRateHz);
  assertPositive(config.maxZombies, "zombie cap");
  assertPositive(config.maxDroppedItems, "dropped item cap");
  assertPositive(config.maxPlayerSpeed, "player speed");

  return config;
};

export const createRoomState = ({
  roomId,
  config = createRoomSimulationConfig(),
  world = null,
}: {
  roomId: string;
  config?: RoomSimulationConfig;
  world?: RoomWorldState | null;
}): RoomSimulationState => {
  return {
    roomId,
    tick: 0,
    config,
    world,
    players: new Map<string, SimPlayer>(),
    pendingSpawns: [],
    pendingDespawns: [],
    inputIntents: new Map<string, PlayerInputIntent>(),
    lastProcessedInputSequence: new Map<string, number>(),
    dirtyPlayerIds: new Set<string>(),
    removedEntityIds: new Set<string>(),
    events: [],
  };
};

export const queueSpawnPlayer = (state: RoomSimulationState, request: SpawnPlayerRequest): void => {
  state.pendingSpawns.push(request);
};

export const queueDespawnEntity = (state: RoomSimulationState, entityId: string): void => {
  state.pendingDespawns.push(entityId);
};

export const queueInputIntent = (state: RoomSimulationState, entityId: string, intent: PlayerInputIntent): void => {
  const queuedIntent = state.inputIntents.get(entityId);
  const lastProcessedSequence = state.lastProcessedInputSequence.get(entityId) ?? -1;

  if (intent.sequence <= lastProcessedSequence) {
    return;
  }

  if (queuedIntent && intent.sequence <= queuedIntent.sequence) {
    return;
  }

  state.inputIntents.set(entityId, intent);
};

export const clearTransientSimulationState = (state: RoomSimulationState): void => {
  state.dirtyPlayerIds.clear();
  state.removedEntityIds.clear();
  state.events.length = 0;
};

export const spawnPlayerNow = (state: RoomSimulationState, request: SpawnPlayerRequest): void => {
  state.players.set(request.entityId, {
    entityId: request.entityId,
    displayName: request.displayName,
    transform: {
      x: request.position.x,
      y: request.position.y,
      rotation: 0,
    },
    velocity: { x: 0, y: 0 },
    health: createDefaultHealth(),
    inventory: createEmptyInventory(),
  });
  state.dirtyPlayerIds.add(request.entityId);
};
