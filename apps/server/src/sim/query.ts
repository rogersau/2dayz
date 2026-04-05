import type { RoomSimulationState, SimPlayer } from "./state";

export const getPlayer = (state: RoomSimulationState, entityId: string): SimPlayer | undefined => {
  return state.players.get(entityId);
};

export const getPlayers = (state: RoomSimulationState): SimPlayer[] => {
  return [...state.players.values()];
};
