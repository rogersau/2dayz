import * as THREE from "three";

import type { PredictionController } from "./prediction";
import type { createCombatEffectsView } from "./combatEffectsView";
import type { ClientGameStore, RenderLootEntity, RenderPlayerEntity, RenderZombieEntity } from "../state/clientGameStore";
import type { createEntityViewStore } from "./entityViewStore";
import { resolveCameraPose } from "../thirdPersonMath";

const CAMERA_COLLISION_PADDING = 0.25;

export type CameraViewState = {
  isAiming: boolean;
  pitch: number;
  yaw: number;
};

const resolveCameraPosition = ({
  desiredPosition,
  lookAt,
  scene,
}: {
  desiredPosition: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
  scene: THREE.Scene;
}) => {
  if (scene.children.length === 0) {
    return desiredPosition;
  }

  const origin = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);
  const offset = new THREE.Vector3(
    desiredPosition.x - lookAt.x,
    desiredPosition.y - lookAt.y,
    desiredPosition.z - lookAt.z,
  );
  const distance = offset.length();

  if (distance === 0) {
    return desiredPosition;
  }

  offset.normalize();

   const staticWorldRoot = scene.getObjectByName("world:static");
   const occluders = staticWorldRoot ? [staticWorldRoot] : scene.children;

  const raycaster = new THREE.Raycaster(origin, offset, 0, distance);
  const blockingHit = raycaster.intersectObjects(occluders, true)[0];

  if (!blockingHit) {
    return desiredPosition;
  }

  const resolvedDistance = Math.max(blockingHit.distance - CAMERA_COLLISION_PADDING, 0);

  return {
    x: lookAt.x + offset.x * resolvedDistance,
    y: lookAt.y + offset.y * resolvedDistance,
    z: lookAt.z + offset.z * resolvedDistance,
  };
};

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
  viewState,
}: {
  camera: THREE.Camera;
  combatEffectsView: ReturnType<typeof createCombatEffectsView>;
  deltaSeconds: number;
  entityViewStore: ReturnType<typeof createEntityViewStore>;
  predictionController: PredictionController;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  store: ClientGameStore;
  viewState: CameraViewState;
}) => {
  const state = store.getState();
  const renderEvents = store.drainRenderEvents();
  const latestTick = state.latestTick ?? 0;
  const renderableEntities = toRenderableEntities(state.worldEntities);
  const localOverrides = new Map<string, { rotation: number; x: number; y: number }>();
  const shooterTransforms = new Map<string, { rotation: number; x: number; y: number }>();
  const selfPlayer = state.worldEntities.players.find((entity) => entity.entityId === state.playerEntityId);

  for (const player of state.worldEntities.players) {
    shooterTransforms.set(player.entityId, player.transform);
  }

  if (selfPlayer) {
    predictionController.syncAuthoritative({
      authoritativeStamina: selfPlayer.stamina,
      authoritativeTransform: selfPlayer.transform,
      entityId: selfPlayer.entityId,
      lastProcessedSequence: selfPlayer.lastProcessedInputSequence ?? -1,
    });

    const localTransform = predictionController.advanceSmoothing(deltaSeconds);
    const cameraPose = resolveCameraPose({
      isAiming: viewState.isAiming,
      pitch: viewState.pitch,
      target: { x: localTransform.x, y: 0, z: localTransform.y },
      yaw: viewState.yaw,
    });
    const resolvedCameraPosition = resolveCameraPosition({
      desiredPosition: cameraPose.position,
      lookAt: cameraPose.lookAt,
      scene,
    });

    camera.position.x = resolvedCameraPosition.x;
    camera.position.y = resolvedCameraPosition.y;
    camera.position.z = resolvedCameraPosition.z;
    if ("lookAt" in camera && typeof camera.lookAt === "function") {
      camera.lookAt(cameraPose.lookAt.x, cameraPose.lookAt.y, cameraPose.lookAt.z);
    }

    localOverrides.set(selfPlayer.entityId, localTransform);
    shooterTransforms.set(selfPlayer.entityId, localTransform);
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
    renderEvents,
    shooterTransforms,
  });

  renderer.render(scene, camera);
};
