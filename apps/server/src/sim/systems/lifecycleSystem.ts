import { queueDespawnEntity, spawnPlayerNow, type RoomSimulationState } from "../state";

export type LifecycleSystem = {
  name: "lifecycle";
  update(state: RoomSimulationState, deltaSeconds: number): void;
};

export const createLifecycleSystem = (): LifecycleSystem => {
  return {
    name: "lifecycle",
    update(state) {
      for (const request of state.pendingSpawns.splice(0)) {
        spawnPlayerNow(state, request);
      }

      for (const entityId of state.pendingDespawns.splice(0)) {
        if (!state.players.delete(entityId)) {
          continue;
        }

        state.inputIntents.delete(entityId);
        state.dirtyPlayerIds.delete(entityId);
        state.removedEntityIds.add(entityId);
      }
    },
  };
};
