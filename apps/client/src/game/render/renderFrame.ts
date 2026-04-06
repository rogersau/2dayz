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
  predictionController,
  renderer,
  scene,
  store,
}: {
  camera: THREE.Camera;
  deltaSeconds: number;
  entityViewStore: ReturnType<typeof createEntityViewStore>;
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

    const localTransform = predictionController.advanceSmoothing(deltaSeconds);

    camera.position.x = localTransform.x + 18;
    camera.position.z = localTransform.y + 18;
    if ("lookAt" in camera && typeof camera.lookAt === "function") {
      camera.lookAt(localTransform.x, 0, localTransform.y);
    }

    localOverrides.set(selfPlayer.entityId, localTransform);
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
