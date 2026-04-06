import type { RoomSimulationState } from "./state";
import { processPendingRespawns } from "../rooms/respawn";

export type SimulationSystem = {
  name: string;
  update(state: RoomSimulationState, deltaSeconds: number): void;
};

export const createFixedTickGameLoop = ({
  tickRateHz,
  systems,
  onTick,
}: {
  tickRateHz: number;
  systems: SimulationSystem[];
  onTick(state: RoomSimulationState): void;
}) => {
  const tickIntervalMs = 1000 / tickRateHz;
  let accumulatorMs = 0;

  return {
    advance(state: RoomSimulationState, elapsedMs: number) {
      accumulatorMs += elapsedMs;

      while (accumulatorMs >= tickIntervalMs) {
        accumulatorMs -= tickIntervalMs;
        state.elapsedMs += tickIntervalMs;

        for (const system of systems) {
          system.update(state, tickIntervalMs / 1000);
        }

        processPendingRespawns(state);

        state.tick += 1;
        onTick(state);
      }
    },
  };
};
