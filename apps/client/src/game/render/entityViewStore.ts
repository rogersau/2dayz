import { SERVER_TICK_RATE, type Transform } from "@2dayz/shared";
import * as THREE from "three";

import type {
  RenderLootEntity,
  RenderPlayerEntity,
  RenderZombieEntity,
} from "../state/clientGameStore";
import { sampleInterpolatedTransform } from "./interpolation";

type RenderEntity = RenderLootEntity | RenderPlayerEntity | RenderZombieEntity;

type EntityView = {
  current: { tick: number; transform: Transform };
  previous: { tick: number; transform: Transform };
  object: THREE.Object3D;
  materials: THREE.MeshLambertMaterial[];
  flashRemainingMs: number;
  isDying: boolean;
  deathRemainingMs: number;
  removeWhenFinished: boolean;
  kind: RenderEntity["kind"];
};

type RecentCombatHit = {
  remainingMs: number;
};

const ENTITY_HEIGHT = 0.6;
const FLASH_DURATION_MS = 120;
const DEATH_DURATION_MS = 300;
const RECENT_HIT_DURATION_MS = 250;
const FLASH_EMISSIVE = new THREE.Color("#fff4cf");
const NO_EMISSIVE = new THREE.Color("#000000");

const cloneTransform = (transform: Transform): Transform => ({ ...transform });

const createMaterial = (color: string, baseColor?: string) => {
  const material = new THREE.MeshLambertMaterial({ color });
  if (baseColor) {
    material.userData.baseColor = baseColor;
  }
  return material;
};

const createPart = ({
  depth,
  height,
  material,
  name,
  width,
  x = 0,
  y,
  z = 0,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
}: {
  depth: number;
  height: number;
  material: THREE.MeshLambertMaterial;
  name: string;
  width: number;
  x?: number;
  y: number;
  z?: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
}) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.rotation.set(rotationX, rotationY, rotationZ);
  mesh.userData.baseColor = material.userData.baseColor ?? `#${material.color.getHexString()}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const createPlayerObject = (entity: RenderPlayerEntity, isSelf: boolean) => {
  const group = new THREE.Group();
  group.name = `entity:${entity.entityId}`;

  const torsoColor = isSelf ? "#e5bf7a" : "#6f97d6";
  const limbColor = isSelf ? "#c98a57" : "#405e94";
  const headColor = isSelf ? "#f1d1a0" : "#aebfdd";

  const torsoMaterial = createMaterial(torsoColor, torsoColor);
  const limbMaterial = createMaterial(limbColor, limbColor);
  const headMaterial = createMaterial(headColor, headColor);

  group.add(createPart({ depth: 0.55, height: 0.9, material: torsoMaterial, name: "survivor-torso", width: 0.75, y: 1.1 }));
  group.add(createPart({ depth: 0.45, height: 0.38, material: headMaterial, name: "survivor-head", width: 0.45, y: 1.82 }));
  group.add(createPart({ depth: 0.28, height: 0.7, material: limbMaterial, name: "survivor-arm-left", width: 0.2, x: -0.56, y: 1.08, rotationZ: 0.16 }));
  group.add(createPart({ depth: 0.28, height: 0.7, material: limbMaterial, name: "survivor-arm-right", width: 0.2, x: 0.56, y: 1.08, rotationZ: -0.16 }));
  group.add(createPart({ depth: 0.32, height: 0.78, material: limbMaterial, name: "survivor-leg-left", width: 0.24, x: -0.2, y: 0.38, rotationZ: 0.04 }));
  group.add(createPart({ depth: 0.32, height: 0.78, material: limbMaterial, name: "survivor-leg-right", width: 0.24, x: 0.2, y: 0.38, rotationZ: -0.04 }));

  return {
    materials: [torsoMaterial, limbMaterial, headMaterial],
    object: group,
  };
};

const createZombieObject = (entity: RenderZombieEntity) => {
  const group = new THREE.Group();
  group.name = `entity:${entity.entityId}`;

  const hunchMaterial = createMaterial("#7f9d58", "#7f9d58");
  const limbMaterial = createMaterial("#566f39", "#566f39");
  const headMaterial = createMaterial("#9bb579", "#9bb579");

  group.add(
    createPart({
      depth: 0.72,
      height: 0.88,
      material: hunchMaterial,
      name: "zombie-hunch",
      width: 0.86,
      y: 1.04,
      z: -0.08,
      rotationX: -0.3,
    }),
  );
  group.add(createPart({ depth: 0.46, height: 0.36, material: headMaterial, name: "zombie-head", width: 0.44, y: 1.7, z: 0.14, rotationX: 0.18 }));
  group.add(createPart({ depth: 0.24, height: 0.78, material: limbMaterial, name: "zombie-arm-left", width: 0.2, x: -0.58, y: 1.02, z: 0.12, rotationX: 0.5, rotationZ: 0.18 }));
  group.add(createPart({ depth: 0.24, height: 0.78, material: limbMaterial, name: "zombie-arm-right", width: 0.2, x: 0.58, y: 1.02, z: 0.12, rotationX: 0.46, rotationZ: -0.18 }));
  group.add(createPart({ depth: 0.28, height: 0.82, material: limbMaterial, name: "zombie-leg-left", width: 0.24, x: -0.18, y: 0.38, rotationX: 0.1, rotationZ: 0.08 }));
  group.add(createPart({ depth: 0.28, height: 0.82, material: limbMaterial, name: "zombie-leg-right", width: 0.24, x: 0.18, y: 0.38, rotationX: -0.04, rotationZ: -0.08 }));

  return {
    materials: [hunchMaterial, limbMaterial, headMaterial],
    object: group,
  };
};

const createLootObject = (entity: RenderLootEntity) => {
  const group = new THREE.Group();
  group.name = `entity:${entity.entityId}`;

  const bodyMaterial = createMaterial("#c56a55", "#c56a55");
  const accentMaterial = createMaterial("#e3b07d", "#e3b07d");

  group.add(createPart({ depth: 0.7, height: 0.3, material: bodyMaterial, name: "loot-crate", width: 0.7, y: 0.2 }));
  group.add(createPart({ depth: 0.5, height: 0.08, material: accentMaterial, name: "loot-band", width: 0.74, y: 0.34 }));

  return {
    materials: [bodyMaterial, accentMaterial],
    object: group,
  };
};

const createEntityObject = (entity: RenderEntity, playerEntityId: string | null) => {
  if (entity.kind === "player") {
    return createPlayerObject(entity, entity.entityId === playerEntityId);
  }

  if (entity.kind === "zombie") {
    return createZombieObject(entity);
  }

  return createLootObject(entity);
};

const applyObjectTransform = (object: THREE.Object3D, transform: Transform) => {
  object.position.set(transform.x, ENTITY_HEIGHT, transform.y);
  object.rotation.y = -transform.rotation;
};

const disposeObject = (object: THREE.Object3D, materials: THREE.MeshLambertMaterial[]) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.dispose();
  });

  for (const material of materials) {
    material.dispose();
  }
};

const getEntityTransform = (entity: RenderEntity): Transform => {
  if (entity.kind === "loot") {
    return { rotation: 0, x: entity.position.x, y: entity.position.y };
  }

  return entity.transform;
};

const isZombieDead = (entity: RenderEntity) => {
  return entity.kind === "zombie" && entity.health?.isDead === true;
};

const updateMaterialState = (view: EntityView) => {
  const flashProgress = Math.min(1, view.flashRemainingMs / FLASH_DURATION_MS);
  const deathProgress = view.isDying ? 1 - view.deathRemainingMs / DEATH_DURATION_MS : 0;

  for (const material of view.materials) {
    const baseColorValue = material.userData.baseColor ?? `#${material.color.getHexString()}`;
    const baseColor = new THREE.Color(baseColorValue);
    const targetColor = flashProgress > 0 ? baseColor.clone().lerp(FLASH_EMISSIVE, flashProgress * 0.7) : baseColor;

    material.color.copy(targetColor);
    material.emissive.copy(flashProgress > 0 ? FLASH_EMISSIVE.clone().multiplyScalar(flashProgress * 0.55) : NO_EMISSIVE);
    material.opacity = view.isDying ? Math.max(0.2, 1 - deathProgress * 0.8) : 1;
    material.transparent = material.opacity < 1;
  }

  view.object.position.y = ENTITY_HEIGHT - deathProgress * 0.35;
  view.object.rotation.z = view.isDying ? -deathProgress * 0.35 : 0;
};

const startDeathAnimation = (view: EntityView) => {
  if (view.isDying) {
    return;
  }

  view.isDying = true;
  view.deathRemainingMs = DEATH_DURATION_MS;
  view.flashRemainingMs = Math.max(view.flashRemainingMs, FLASH_DURATION_MS);
};

const tickViewState = (view: EntityView, deltaMs: number) => {
  if (view.flashRemainingMs > 0) {
    view.flashRemainingMs = Math.max(0, view.flashRemainingMs - deltaMs);
  }

  if (view.isDying) {
    view.deathRemainingMs = Math.max(0, view.deathRemainingMs - deltaMs);
  }

  updateMaterialState(view);
};

export const createEntityViewStore = (scene: THREE.Scene) => {
  const entityViews = new Map<string, EntityView>();
  const recentCombatHits = new Map<string, RecentCombatHit>();
  let renderTick = 0;
  let latestKnownTick: number | null = null;

  const removeView = (entityId: string, view: EntityView) => {
    scene.remove(view.object);
    disposeObject(view.object, view.materials);
    entityViews.delete(entityId);
  };

  return {
    dispose() {
      for (const [entityId, view] of entityViews.entries()) {
        removeView(entityId, view);
      }
      recentCombatHits.clear();
    },
    flashEntity(entityId: string) {
      const view = entityViews.get(entityId);
      if (view) {
        view.flashRemainingMs = FLASH_DURATION_MS;
      }
    },
    markRecentCombatHit(entityId: string) {
      recentCombatHits.set(entityId, { remainingMs: RECENT_HIT_DURATION_MS });
      this.flashEntity(entityId);
    },
    render({
      entities,
      deltaSeconds,
      latestTick,
      localOverrides,
      playerEntityId,
    }: {
      entities: RenderEntity[];
      deltaSeconds: number;
      latestTick: number;
      localOverrides: Map<string, Transform>;
      playerEntityId: string | null;
    }) {
      if (latestKnownTick === null || latestTick < latestKnownTick) {
        renderTick = latestTick;
      } else {
        renderTick = Math.min(renderTick + deltaSeconds * SERVER_TICK_RATE, latestTick);
      }
      latestKnownTick = latestTick;

      const activeIds = new Set(entities.map((entity) => entity.entityId));
      const deltaMs = deltaSeconds * 1000;

      for (const [entityId, hit] of recentCombatHits.entries()) {
        hit.remainingMs -= deltaMs;
        if (hit.remainingMs <= 0) {
          recentCombatHits.delete(entityId);
        }
      }

      for (const entity of entities) {
        const nextTransform = getEntityTransform(entity);
        const existingView = entityViews.get(entity.entityId);

        if (!existingView) {
          const created = createEntityObject(entity, playerEntityId);
          applyObjectTransform(created.object, nextTransform);
          scene.add(created.object);
          const view: EntityView = {
            current: { tick: latestTick, transform: cloneTransform(nextTransform) },
            previous: { tick: latestTick, transform: cloneTransform(nextTransform) },
            object: created.object,
            materials: created.materials,
            flashRemainingMs: 0,
            isDying: false,
            deathRemainingMs: 0,
            kind: entity.kind,
            removeWhenFinished: false,
          };
          if (isZombieDead(entity)) {
            startDeathAnimation(view);
          }
          tickViewState(view, deltaMs);
          entityViews.set(entity.entityId, view);
          continue;
        }

        if (
          existingView.current.tick !== latestTick &&
          (existingView.current.transform.x !== nextTransform.x ||
            existingView.current.transform.y !== nextTransform.y ||
            existingView.current.transform.rotation !== nextTransform.rotation)
        ) {
          existingView.previous = {
            tick: existingView.current.tick,
            transform: cloneTransform(existingView.current.transform),
          };
          existingView.current = {
            tick: latestTick,
            transform: cloneTransform(nextTransform),
          };
        }

        if (isZombieDead(entity)) {
          startDeathAnimation(existingView);
        }

        const localTransform = playerEntityId === entity.entityId ? localOverrides.get(entity.entityId) : null;
        const resolvedTransform = localTransform
          ?? sampleInterpolatedTransform(existingView.previous, existingView.current, renderTick);
        applyObjectTransform(existingView.object, resolvedTransform);
        existingView.removeWhenFinished = false;
        tickViewState(existingView, deltaMs);
      }

      for (const [entityId, view] of entityViews.entries()) {
        if (activeIds.has(entityId)) {
          continue;
        }

        if (!activeIds.has(entityId)) {
          if (view.kind === "zombie" && !view.isDying && recentCombatHits.has(entityId)) {
            startDeathAnimation(view);
          }

          if (view.isDying) {
            view.removeWhenFinished = true;
          } else {
            removeView(entityId, view);
            continue;
          }
        }

        const resolvedTransform = sampleInterpolatedTransform(view.previous, view.current, renderTick);
        applyObjectTransform(view.object, resolvedTransform);
        tickViewState(view, deltaMs);

        if (view.removeWhenFinished && view.deathRemainingMs <= 0) {
          removeView(entityId, view);
        }
      }
    },
  };
};
