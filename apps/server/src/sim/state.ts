import {
  INVENTORY_SLOT_COUNT,
  ROOM_PLAYER_CAPACITY,
  SERVER_TICK_RATE,
  SPRINT_SPEED_MULTIPLIER,
  STAMINA_DRAIN_PER_SECOND,
  type Health,
  type InputMessage,
  type Inventory,
  type ItemDefinition,
  type LootTable,
  type MapDefinition,
  type ServerEvent,
  type Transform,
  type Vector2,
  type Velocity,
  type WeaponDefinition,
  type ZombieArchetype,
} from "@2dayz/shared";

import { defaultItems } from "../content/defaultItems";
import { defaultLootTables } from "../content/defaultLootTable";
import { defaultZombieArchetypes } from "../content/defaultZombies";
import type { CollisionIndex } from "../world/collision";
import type { NavigationGraph } from "../world/navigation";

export const MIN_ROOM_PLAYER_CAPACITY = 8;
export const MAX_ROOM_PLAYER_CAPACITY = 12;
export const DEFAULT_MAX_ZOMBIES = 24;
export const DEFAULT_MAX_DROPPED_ITEMS = 64;
export const DEFAULT_MAX_PLAYER_SPEED = 4;
export const DEFAULT_SPRINT_SPEED_MULTIPLIER = SPRINT_SPEED_MULTIPLIER;
export const DEFAULT_STAMINA_BASELINE = 10;
export const DEFAULT_STAMINA_FLOOR = 4;
export const DEFAULT_STAMINA_DRAIN_PER_SECOND = STAMINA_DRAIN_PER_SECOND;
export const DEFAULT_STAMINA_REGEN_PER_SECOND = 1;
export const DEFAULT_STAMINA_LOAD_PENALTY = 1;

export type PlayerInputIntent = Omit<InputMessage, "type">;

export type RoomSimulationConfig = {
  playerCapacity: number;
  tickRateHz: number;
  maxZombies: number;
  maxDroppedItems: number;
  maxPlayerSpeed: number;
   sprintSpeedMultiplier: number;
   staminaBaseline: number;
   staminaFloor: number;
   staminaDrainPerSecond: number;
   staminaRegenPerSecond: number;
   staminaLoadPenalty: number;
  isMovementBlocked(movement: { from: Vector2; to: Vector2; radius: number }, entityId: string): boolean;
  isPositionBlocked(position: Vector2, entityId: string): boolean;
};

export type StaminaState = {
  current: number;
  max: number;
};

export type SimPlayer = {
  entityId: string;
  displayName: string;
  transform: Transform;
  velocity: Velocity;
  health: Health;
  stamina: StaminaState;
  inventory: Inventory;
  weaponState: WeaponState;
  lastDamagedByEntityId: string | null;
};

export type WeaponState = {
  magazineAmmo: number;
  isReloading: boolean;
  reloadRemainingMs: number;
  fireCooldownRemainingMs: number;
};

export type SimLoot = {
  entityId: string;
  itemId: string;
  quantity: number;
  position: Vector2;
  ownerEntityId: string | null;
  sourcePointId: string | null;
};

export type SimZombie = {
  entityId: string;
  archetypeId: string;
  transform: Transform;
  velocity: Velocity;
  health: Health;
  state: "idle" | "roaming" | "chasing" | "attacking" | "searching";
  aggroTargetEntityId: string | null;
  heardTargetEntityId?: string | null;
  heardPosition?: Vector2 | null;
  attackCooldownRemainingMs: number;
  lostTargetMs: number;
  sourceZoneId?: string;
  roamingTargetNodeId?: string;
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
  elapsedMs: number;
  config: RoomSimulationConfig;
  world: RoomWorldState | null;
  players: Map<string, SimPlayer>;
  loot: Map<string, SimLoot>;
  zombies: Map<string, SimZombie>;
  pendingSpawns: SpawnPlayerRequest[];
  pendingDespawns: string[];
  pendingRespawns: Array<{ entityId: string; respawnAtMs: number; position: Vector2 }>;
  inputIntents: Map<string, PlayerInputIntent>;
  lastProcessedInputSequence: Map<string, number>;
  dirtyPlayerIds: Set<string>;
  dirtyLootIds: Set<string>;
  dirtyZombieIds: Set<string>;
  removedEntityIds: Set<string>;
  handledDeathEntityIds: Set<string>;
  spawnedLootPointIds: Set<string>;
  nextLootEntitySequence: number;
  nextZombieEntitySequence: number;
  itemDefinitions: Map<string, ItemDefinition>;
  lootTables: Map<string, LootTable>;
  weaponDefinitions: Map<string, WeaponDefinition>;
  zombieArchetypes: Map<string, ZombieArchetype>;
  events: ServerEvent[];
  sprintNoiseEvents: Array<{ playerEntityId: string; position: Vector2 }>;
};

const defaultWeaponDefinitions: WeaponDefinition[] = [
  {
    itemId: "item_revolver",
    name: "Civilian Revolver",
    category: "firearm",
    stackable: false,
    maxStack: 1,
    damage: 35,
    range: 8,
    spread: 0,
    fireRate: 2,
    magazineSize: 6,
    reloadTimeMs: 1_200,
    ammoItemId: "item_pistol-ammo",
  },
];

const createEmptyInventory = (): Inventory => {
  return {
    slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => null),
    equippedWeaponSlot: null,
    ammoStacks: [],
  };
};

const createStarterInventory = (): Inventory => {
  const inventory = createEmptyInventory();

  inventory.slots[0] = { itemId: "item_revolver", quantity: 1 };
  inventory.slots[1] = { itemId: "item_bandage", quantity: 1 };
  inventory.equippedWeaponSlot = 0;
  inventory.ammoStacks = [{ ammoItemId: "item_pistol-ammo", quantity: 18 }];

  return inventory;
};

const createDefaultHealth = (): Health => {
  return {
    current: 100,
    max: 100,
    isDead: false,
  };
};

export const createDefaultWeaponState = (): WeaponState => {
  return {
    magazineAmmo: 6,
    isReloading: false,
    reloadRemainingMs: 0,
    fireCooldownRemainingMs: 0,
  };
};

const assertInRange = (value: number, min: number, max: number, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }

  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
};

const assertPositive = (value: number, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }

  if (value <= 0) {
    throw new Error(`${label} must be greater than 0`);
  }
};

const assertGreaterThan = (value: number, minimum: number, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }

  if (value <= minimum) {
    throw new Error(`${label} must be greater than ${minimum}`);
  }
};

const assertNotGreaterThan = (value: number, maximum: number, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite`);
  }

  if (value > maximum) {
    throw new Error(`${label} must be less than or equal to ${maximum}`);
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
    sprintSpeedMultiplier: overrides.sprintSpeedMultiplier ?? DEFAULT_SPRINT_SPEED_MULTIPLIER,
    staminaBaseline: overrides.staminaBaseline ?? DEFAULT_STAMINA_BASELINE,
    staminaFloor: overrides.staminaFloor ?? DEFAULT_STAMINA_FLOOR,
    staminaDrainPerSecond: overrides.staminaDrainPerSecond ?? DEFAULT_STAMINA_DRAIN_PER_SECOND,
    staminaRegenPerSecond: overrides.staminaRegenPerSecond ?? DEFAULT_STAMINA_REGEN_PER_SECOND,
    staminaLoadPenalty: overrides.staminaLoadPenalty ?? DEFAULT_STAMINA_LOAD_PENALTY,
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
  assertGreaterThan(config.sprintSpeedMultiplier, 1, "sprint speed multiplier");
  assertPositive(config.staminaBaseline, "stamina baseline");
  assertPositive(config.staminaFloor, "stamina floor");
  assertNotGreaterThan(config.staminaFloor, config.staminaBaseline, "stamina floor");
  assertPositive(config.staminaDrainPerSecond, "stamina drain");
  assertPositive(config.staminaRegenPerSecond, "stamina regen");
  assertPositive(config.staminaLoadPenalty, "stamina load penalty");

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
    elapsedMs: 0,
    config,
    world,
    players: new Map<string, SimPlayer>(),
    loot: new Map(),
    zombies: new Map(),
    pendingSpawns: [],
    pendingDespawns: [],
    pendingRespawns: [],
    inputIntents: new Map<string, PlayerInputIntent>(),
    lastProcessedInputSequence: new Map<string, number>(),
    dirtyPlayerIds: new Set<string>(),
    dirtyLootIds: new Set<string>(),
    dirtyZombieIds: new Set<string>(),
    removedEntityIds: new Set<string>(),
    handledDeathEntityIds: new Set<string>(),
    spawnedLootPointIds: new Set<string>(),
    nextLootEntitySequence: 0,
    nextZombieEntitySequence: 0,
    itemDefinitions: new Map(defaultItems.map((item) => [item.itemId, item])),
    lootTables: new Map(defaultLootTables.map((table) => [table.tableId, table])),
    weaponDefinitions: new Map(defaultWeaponDefinitions.map((weapon) => [weapon.itemId, { ...weapon }])),
    zombieArchetypes: new Map(defaultZombieArchetypes.map((zombie) => [zombie.archetypeId, zombie])),
    events: [],
    sprintNoiseEvents: [],
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
  state.dirtyLootIds.clear();
  state.dirtyZombieIds.clear();
  state.removedEntityIds.clear();
  state.events.length = 0;
  state.sprintNoiseEvents.length = 0;
};

export const spawnPlayerNow = (state: RoomSimulationState, request: SpawnPlayerRequest): void => {
  const staminaMax = state.config.staminaBaseline;

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
    stamina: { current: staminaMax, max: staminaMax },
    inventory: createStarterInventory(),
    weaponState: createDefaultWeaponState(),
    lastDamagedByEntityId: null,
  });
  state.dirtyPlayerIds.add(request.entityId);
};
