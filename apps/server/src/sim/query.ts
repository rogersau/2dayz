import type { DeltaMessage, LootEntity, PlayerState, ServerEvent, ZombieEntity } from "@2dayz/shared";

import type { RoomSimulationState, SimLoot, SimPlayer, SimZombie } from "./state";

export type RoomReplicationSnapshot = {
  tick: number;
  playerEntityId: string;
  players: PlayerState[];
  loot: LootEntity[];
  zombies: ZombieEntity[];
};

export type RoomReplicationDelta = {
  tick: number;
  enteredEntities: DeltaMessage["enteredEntities"];
  entityUpdates: DeltaMessage["entityUpdates"];
  removedEntityIds: string[];
  events: ServerEvent[];
};

const createPlayerState = (state: RoomSimulationState, player: SimPlayer): PlayerState => {
  return {
    entityId: player.entityId,
    displayName: player.displayName,
    transform: player.transform,
    velocity: player.velocity,
    stamina: player.stamina,
    inventory: player.inventory,
    lastProcessedInputSequence: state.lastProcessedInputSequence.get(player.entityId),
    health: player.health,
  };
};

const createPlayerDelta = (state: RoomSimulationState, player: SimPlayer): DeltaMessage["entityUpdates"][number] => {
  return {
    entityId: player.entityId,
    inventory: player.inventory,
    lastProcessedInputSequence: state.lastProcessedInputSequence.get(player.entityId),
    stamina: player.stamina,
    transform: player.transform,
    velocity: player.velocity,
    health: player.health,
  };
};

const createLootEntity = (loot: SimLoot): LootEntity => {
  return {
    entityId: loot.entityId,
    itemId: loot.itemId,
    quantity: loot.quantity,
    position: loot.position,
  };
};

const createZombieEntity = (zombie: SimZombie): ZombieEntity => {
  return {
    entityId: zombie.entityId,
    archetypeId: zombie.archetypeId,
    transform: zombie.transform,
    state: zombie.state,
  };
};

const createZombieDelta = (zombie: SimZombie): DeltaMessage["entityUpdates"][number] => {
  return {
    entityId: zombie.entityId,
    transform: zombie.transform,
    velocity: zombie.velocity,
    health: zombie.health,
    state: zombie.state,
  };
};

const createLootDelta = (loot: SimLoot): DeltaMessage["entityUpdates"][number] => {
  return {
    entityId: loot.entityId,
    itemId: loot.itemId,
    quantity: loot.quantity,
    position: loot.position,
  };
};

export const getPlayer = (state: RoomSimulationState, entityId: string): SimPlayer | undefined => {
  return state.players.get(entityId);
};

export const getPlayers = (state: RoomSimulationState): SimPlayer[] => {
  return [...state.players.values()];
};

export const getLoot = (state: RoomSimulationState): SimLoot[] => {
  return [...state.loot.values()];
};

export const getZombies = (state: RoomSimulationState): SimZombie[] => {
  return [...state.zombies.values()];
};

export const createRoomReplicationSnapshot = (
  state: RoomSimulationState,
  playerEntityId: string,
): RoomReplicationSnapshot => {
  return {
    tick: state.tick,
    playerEntityId,
    players: getPlayers(state).map((player) => createPlayerState(state, player)),
    loot: getLoot(state).map(createLootEntity),
    zombies: getZombies(state).map(createZombieEntity),
  };
};

export const createRoomReplicationDelta = (state: RoomSimulationState): RoomReplicationDelta => {
  return {
    tick: state.tick,
    enteredEntities: [],
    entityUpdates: [
      ...[...state.dirtyPlayerIds]
        .map((entityId) => state.players.get(entityId))
        .filter((player): player is SimPlayer => player !== undefined)
        .map((player) => createPlayerDelta(state, player)),
      ...[...state.dirtyLootIds]
        .map((entityId) => state.loot.get(entityId))
        .filter((loot): loot is SimLoot => loot !== undefined)
        .map(createLootDelta),
      ...[...state.dirtyZombieIds]
        .map((entityId) => state.zombies.get(entityId))
        .filter((zombie): zombie is SimZombie => zombie !== undefined)
        .map(createZombieDelta),
    ],
    removedEntityIds: [...state.removedEntityIds],
    events: [...state.events],
  };
};
