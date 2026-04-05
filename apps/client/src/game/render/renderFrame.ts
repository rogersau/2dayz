import type { InputMessage } from "@2dayz/shared";
import type * as THREE from "three";

import type { PredictionController } from "./prediction";
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
  predictionController,
  renderer,
  scene,
  store,
}: {
  camera: THREE.Camera;
  deltaSeconds: number;
  entityViewStore: ReturnType<typeof createEntityViewStore>;
  input: InputMessage;
  predictionController: PredictionController;
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
    const reconciledTransform = predictionController.reconcile({
      authoritativeTransform: selfPlayer.transform,
      lastProcessedSequence: selfPlayer.lastProcessedInputSequence ?? -1,
    });

    const predictedTransform = input.movement.x !== 0 || input.movement.y !== 0
      ? predictionController.applyInput({
        deltaSeconds,
        movement: input.movement,
        sequence: input.sequence,
      })
      : reconciledTransform;

    localOverrides.set(selfPlayer.entityId, predictedTransform);
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
