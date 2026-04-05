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
    predictionController.syncAuthoritative({
      authoritativeTransform: selfPlayer.transform,
      entityId: selfPlayer.entityId,
      lastProcessedSequence: selfPlayer.lastProcessedInputSequence ?? -1,
    });

    if (input.movement.x !== 0 || input.movement.y !== 0) {
      predictionController.applyInput({
        deltaSeconds,
        movement: input.movement,
        sequence: input.sequence,
      });
    }

    localOverrides.set(selfPlayer.entityId, predictionController.advanceSmoothing(deltaSeconds));
  }

  entityViewStore.render({
    deltaSeconds,
    entities: renderableEntities,
    latestTick,
    localOverrides,
    playerEntityId: state.playerEntityId,
  });

  renderer.render(scene, camera);
};
