import { INVENTORY_SLOT_COUNT, ROOM_PLAYER_CAPACITY, SERVER_TICK_RATE, type DeltaMessage, type Health, type InputMessage, type Inventory, type PlayerState, type ServerEvent, type SnapshotMessage, type Transform, type Vector2, type Velocity } from "@2dayz/shared";

export const MIN_ROOM_PLAYER_CAPACITY = 8;
export const MAX_ROOM_PLAYER_CAPACITY = 12;
export const MIN_TICK_RATE_HZ = 20;
export const MAX_TICK_RATE_HZ = 30;
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
  isPositionBlocked(position: Vector2, entityId: string): boolean;
};

export type SimPlayer = {
  entityId: string;
  displayName: string;
  transform: Transform;
  velocity: Velocity;
  health: Health;
  inventory: Inventory;
  pendingInput: PlayerInputIntent | null;
};

export type SpawnPlayerRequest = {
  entityId: string;
  displayName: string;
  position: Vector2;
};

export type RoomSimulationState = {
  roomId: string;
  tick: number;
  config: RoomSimulationConfig;
  players: Map<string, SimPlayer>;
  pendingSpawns: SpawnPlayerRequest[];
  pendingDespawns: string[];
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

const createPlayerState = (player: SimPlayer): PlayerState => {
  return {
    entityId: player.entityId,
    displayName: player.displayName,
    transform: player.transform,
    velocity: player.velocity,
    inventory: player.inventory,
    health: player.health,
  };
};

const createPlayerDelta = (player: SimPlayer): DeltaMessage["entityUpdates"][number] => {
  return {
    entityId: player.entityId,
    transform: player.transform,
    velocity: player.velocity,
    health: player.health,
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

export const createRoomSimulationConfig = (
  overrides: Partial<Omit<RoomSimulationConfig, "isPositionBlocked">> & {
    isPositionBlocked?: RoomSimulationConfig["isPositionBlocked"];
  } = {},
): RoomSimulationConfig => {
  const config: RoomSimulationConfig = {
    playerCapacity: overrides.playerCapacity ?? ROOM_PLAYER_CAPACITY,
    tickRateHz: overrides.tickRateHz ?? SERVER_TICK_RATE,
    maxZombies: overrides.maxZombies ?? DEFAULT_MAX_ZOMBIES,
    maxDroppedItems: overrides.maxDroppedItems ?? DEFAULT_MAX_DROPPED_ITEMS,
    maxPlayerSpeed: overrides.maxPlayerSpeed ?? DEFAULT_MAX_PLAYER_SPEED,
    isPositionBlocked: overrides.isPositionBlocked ?? (() => false),
  };

  assertInRange(config.playerCapacity, MIN_ROOM_PLAYER_CAPACITY, MAX_ROOM_PLAYER_CAPACITY, "player capacity");
  assertInRange(config.tickRateHz, MIN_TICK_RATE_HZ, MAX_TICK_RATE_HZ, "tick rate");
  assertPositive(config.maxZombies, "zombie cap");
  assertPositive(config.maxDroppedItems, "dropped item cap");
  assertPositive(config.maxPlayerSpeed, "player speed");

  return config;
};

export const createRoomState = ({
  roomId,
  config = createRoomSimulationConfig(),
}: {
  roomId: string;
  config?: RoomSimulationConfig;
}): RoomSimulationState => {
  return {
    roomId,
    tick: 0,
    config,
    players: new Map<string, SimPlayer>(),
    pendingSpawns: [],
    pendingDespawns: [],
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
  const player = state.players.get(entityId);
  if (!player) {
    return;
  }

  player.pendingInput = intent;
};

export const createSnapshotMessage = (state: RoomSimulationState, playerEntityId: string): SnapshotMessage => {
  return {
    type: "snapshot",
    tick: state.tick,
    roomId: state.roomId,
    playerEntityId,
    players: [...state.players.values()].map(createPlayerState),
    loot: [],
    zombies: [],
  };
};

export const createDeltaMessage = (state: RoomSimulationState): DeltaMessage => {
  return {
    type: "delta",
    tick: state.tick,
    roomId: state.roomId,
    entityUpdates: [...state.dirtyPlayerIds]
      .map((entityId) => state.players.get(entityId))
      .filter((player): player is SimPlayer => player !== undefined)
      .map(createPlayerDelta),
    removedEntityIds: [...state.removedEntityIds],
    events: [...state.events],
  };
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
    pendingInput: null,
  });
  state.dirtyPlayerIds.add(request.entityId);
};
