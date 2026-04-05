import type { DeltaMessage, PlayerState, ServerEvent } from "@2dayz/shared";

import type { RoomSimulationState, SimPlayer } from "./state";

export type RoomReplicationSnapshot = {
  tick: number;
  playerEntityId: string;
  players: PlayerState[];
  loot: [];
  zombies: [];
};

export type RoomReplicationDelta = {
  tick: number;
  entityUpdates: DeltaMessage["entityUpdates"];
  removedEntityIds: string[];
  events: ServerEvent[];
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

export const getPlayer = (state: RoomSimulationState, entityId: string): SimPlayer | undefined => {
  return state.players.get(entityId);
};

export const getPlayers = (state: RoomSimulationState): SimPlayer[] => {
  return [...state.players.values()];
};

export const createRoomReplicationSnapshot = (
  state: RoomSimulationState,
  playerEntityId: string,
): RoomReplicationSnapshot => {
  return {
    tick: state.tick,
    playerEntityId,
    players: getPlayers(state).map(createPlayerState),
    loot: [],
    zombies: [],
  };
};

export const createRoomReplicationDelta = (state: RoomSimulationState): RoomReplicationDelta => {
  return {
    tick: state.tick,
    entityUpdates: [...state.dirtyPlayerIds]
      .map((entityId) => state.players.get(entityId))
      .filter((player): player is SimPlayer => player !== undefined)
      .map(createPlayerDelta),
    removedEntityIds: [...state.removedEntityIds],
    events: [...state.events],
  };
};
