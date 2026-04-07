import type * as THREE from "three";

import type { PredictionController } from "./prediction";
import type { createCombatEffectsView } from "./combatEffectsView";
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
  combatEffectsView,
  deltaSeconds,
  entityViewStore,
  predictionController,
  renderer,
  scene,
  store,
}: {
  camera: THREE.Camera;
  combatEffectsView: ReturnType<typeof createCombatEffectsView>;
  deltaSeconds: number;
  entityViewStore: ReturnType<typeof createEntityViewStore>;
  predictionController: PredictionController;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  store: ClientGameStore;
}) => {
  const state = store.getState();
  const renderEvents = store.drainRenderEvents();
  const latestTick = state.latestTick ?? 0;
  const renderableEntities = toRenderableEntities(state.worldEntities);
  const localOverrides = new Map<string, { rotation: number; x: number; y: number }>();
  const selfPlayer = state.worldEntities.players.find((entity) => entity.entityId === state.playerEntityId);
  let localPlayerTransform: { rotation: number; x: number; y: number } | null = null;

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
    localPlayerTransform = localTransform;
  }

  for (const event of renderEvents) {
    if (event.type === "combat") {
      entityViewStore.markRecentCombatHit(event.targetEntityId);
    }
  }

  entityViewStore.render({
    deltaSeconds,
    entities: renderableEntities,
    latestTick,
    localOverrides,
    playerEntityId: state.playerEntityId,
  });

  combatEffectsView.update({
    deltaSeconds,
    entityViewStore,
    localPlayerTransform,
    renderEvents,
  });

  renderer.render(scene, camera);
};
