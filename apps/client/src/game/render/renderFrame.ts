import type { InputMessage } from "@2dayz/shared";
import type * as THREE from "three";

import { applyPredictedInput, createPredictionState } from "./prediction";
import type { ClientGameStore, RenderLootEntity, RenderPlayerEntity, RenderZombieEntity } from "../state/clientGameStore";
import type { createEntityViewStore } from "./entityViewStore";

const toRenderableEntities = ({
  loot,
  players,
  zombies,
}: {
  loot: RenderLootEntity[];
  players: RenderPlayerEntity[];
  zombies: RenderZombieEntity[];
}) => {
  return [...players, ...zombies, ...loot];
};

export const renderFrame = ({
  camera,
  deltaSeconds,
  entityViewStore,
  input,
  renderer,
  scene,
  store,
}: {
  camera: THREE.Camera;
  deltaSeconds: number;
  entityViewStore: ReturnType<typeof createEntityViewStore>;
  input: InputMessage;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  store: ClientGameStore;
}) => {
  const state = store.getState();
  const latestTick = state.latestTick ?? 0;
  const renderableEntities = toRenderableEntities(state.worldEntities);
  const localOverrides = new Map<string, { rotation: number; x: number; y: number }>();
  const selfPlayer = state.worldEntities.players.find((entity) => entity.entityId === state.playerEntityId);

  if (selfPlayer) {
    const predicted = applyPredictedInput(createPredictionState(selfPlayer.transform), {
      deltaSeconds,
      movement: input.movement,
      sequence: input.sequence,
    });
    localOverrides.set(selfPlayer.entityId, predicted.transform);
  }

  entityViewStore.render({
    entities: renderableEntities,
    latestTick,
    localOverrides,
    playerEntityId: state.playerEntityId,
    renderTick: Math.max(latestTick - 0.35, 0),
  });

  renderer.render(scene, camera);
};
