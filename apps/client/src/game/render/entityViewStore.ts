import type { Transform } from "@2dayz/shared";
import * as THREE from "three";

import type {
  RenderLootEntity,
  RenderPlayerEntity,
  RenderZombieEntity,
} from "../state/clientGameStore";
import { sampleInterpolatedTransform } from "./interpolation";

type RenderEntity = RenderLootEntity | RenderPlayerEntity | RenderZombieEntity;

type EntityView = {
  current: { receivedAtMs: number; tick: number; transform: Transform };
  mesh: THREE.Mesh;
  previous: { receivedAtMs: number; tick: number; transform: Transform };
};

const cloneTransform = (transform: Transform): Transform => ({ ...transform });

const applyMeshTransform = (mesh: THREE.Mesh, transform: Transform) => {
  mesh.position.set(transform.x, 0.6, transform.y);
  mesh.rotation.y = -transform.rotation;
};

const disposeMeshMaterial = (mesh: THREE.Mesh) => {
  const material = mesh.material;

  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }

  material.dispose();
};

const createEntityMesh = (entity: RenderEntity) => {
  if (entity.kind === "player") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.5, 1.1),
      new THREE.MeshLambertMaterial({ color: entity.entityId.includes("self") ? "#d8b980" : "#6f97d6" }),
    );
  }

  if (entity.kind === "zombie") {
    return new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.4, 1),
      new THREE.MeshLambertMaterial({ color: "#7f9d58" }),
    );
  }

  return new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.5, 0.7),
    new THREE.MeshLambertMaterial({ color: "#c56a55" }),
  );
};

export const createEntityViewStore = (scene: THREE.Scene) => {
  const entityViews = new Map<string, EntityView>();

  return {
    dispose() {
      for (const view of entityViews.values()) {
        scene.remove(view.mesh);
        view.mesh.geometry.dispose();
        disposeMeshMaterial(view.mesh);
      }
      entityViews.clear();
    },
    render({
      entities,
      latestTick,
      localOverrides,
      playerEntityId,
      renderTimeMs,
      renderTick,
    }: {
      entities: RenderEntity[];
      latestTick: number;
      localOverrides: Map<string, Transform>;
      playerEntityId: string | null;
      renderTimeMs: number;
      renderTick: number;
    }) {
      const activeIds = new Set(entities.map((entity) => entity.entityId));

      for (const entity of entities) {
        const existingView = entityViews.get(entity.entityId);

        if (!existingView) {
          const mesh = createEntityMesh(entity);
          const initialTransform = entity.kind === "loot"
            ? { rotation: 0, x: entity.position.x, y: entity.position.y }
            : entity.transform;
          applyMeshTransform(mesh, initialTransform);
          scene.add(mesh);
          entityViews.set(entity.entityId, {
            current: { receivedAtMs: renderTimeMs, tick: latestTick, transform: cloneTransform(initialTransform) },
            mesh,
            previous: { receivedAtMs: renderTimeMs, tick: latestTick, transform: cloneTransform(initialTransform) },
          });
          continue;
        }

        const nextTransform = entity.kind === "loot"
          ? { rotation: 0, x: entity.position.x, y: entity.position.y }
          : entity.transform;

        if (
          existingView.current.tick !== latestTick &&
          (existingView.current.transform.x !== nextTransform.x ||
            existingView.current.transform.y !== nextTransform.y ||
            existingView.current.transform.rotation !== nextTransform.rotation)
        ) {
          existingView.previous = {
            receivedAtMs: existingView.current.receivedAtMs,
            tick: existingView.current.tick,
            transform: cloneTransform(existingView.current.transform),
          };
          existingView.current = {
            receivedAtMs: renderTimeMs,
            tick: latestTick,
            transform: cloneTransform(nextTransform),
          };
        }

        const localTransform = playerEntityId === entity.entityId ? localOverrides.get(entity.entityId) : null;
        const resolvedTransform = localTransform
          ?? sampleInterpolatedTransform(existingView.previous, existingView.current, renderTimeMs);
        applyMeshTransform(existingView.mesh, resolvedTransform);
      }

      for (const [entityId, view] of entityViews.entries()) {
        if (activeIds.has(entityId)) {
          continue;
        }

        scene.remove(view.mesh);
        view.mesh.geometry.dispose();
        disposeMeshMaterial(view.mesh);
        entityViews.delete(entityId);
      }
    },
  };
};
