import type { CombatEvent, DeathEvent, ShotEvent, Transform } from "@2dayz/shared";
import * as THREE from "three";

import type { createEntityViewStore } from "./entityViewStore";

type ActiveEffect = {
  object: THREE.Object3D;
  remainingSeconds: number;
};

const EFFECT_HEIGHT = 0.75;
const MUZZLE_FLASH_DURATION_SECONDS = 0.06;
const TRACER_DURATION_SECONDS = 0.08;
const IMPACT_FLASH_DURATION_SECONDS = 0.12;

const createPlaneEffect = ({
  color,
  height,
  name,
  opacity,
  width,
}: {
  color: string;
  height: number;
  name: string;
  opacity: number;
  width: number;
}) => {
  const material = new THREE.MeshBasicMaterial({ color, opacity, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
};

const disposeEffectObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.dispose();

    if (Array.isArray(child.material)) {
      for (const material of child.material) {
        material.dispose();
      }
      return;
    }

    child.material.dispose();
  });
};

const addEffect = ({
  effects,
  object,
  root,
  seconds,
}: {
  effects: ActiveEffect[];
  object: THREE.Object3D;
  root: THREE.Group;
  seconds: number;
}) => {
  effects.push({ object, remainingSeconds: seconds });
  root.add(object);
};

const createMuzzleFlash = (transform: Transform) => {
  const flash = createPlaneEffect({
    color: "#ffcc7a",
    height: 0.5,
    name: "effect:muzzle-flash",
    opacity: 0.9,
    width: 0.5,
  });
  const offset = 0.8;

  flash.position.set(
    transform.x + Math.cos(transform.rotation) * offset,
    EFFECT_HEIGHT,
    transform.y + Math.sin(transform.rotation) * offset,
  );

  return flash;
};

const createTracer = ({
  aim,
  transform,
}: {
  aim: { x: number; y: number };
  transform: Transform;
}) => {
  const distance = Math.max(1, Math.min(6, Math.hypot(aim.x, aim.y) * 0.08));
  const tracer = createPlaneEffect({
    color: "#ffe2a8",
    height: 0.18,
    name: "effect:tracer",
    opacity: 0.85,
    width: distance,
  });
  const offset = distance / 2 + 0.9;

  tracer.position.set(
    transform.x + Math.cos(transform.rotation) * offset,
    EFFECT_HEIGHT,
    transform.y + Math.sin(transform.rotation) * offset,
  );
  tracer.rotation.z = -transform.rotation;

  return tracer;
};

const createImpactFlash = (hitPosition: { x: number; y: number }) => {
  const impact = createPlaneEffect({
    color: "#fff4cf",
    height: 0.55,
    name: "effect:impact-flash",
    opacity: 0.95,
    width: 0.55,
  });

  impact.position.set(hitPosition.x, EFFECT_HEIGHT, hitPosition.y);

  return impact;
};

export const createCombatEffectsView = (scene: THREE.Scene) => {
  const root = new THREE.Group();
  const activeEffects: ActiveEffect[] = [];

  root.name = "effects:combat";
  scene.add(root);

  return {
    dispose() {
      for (const effect of activeEffects.splice(0)) {
        root.remove(effect.object);
        disposeEffectObject(effect.object);
      }

      scene.remove(root);
    },
    update({
      deltaSeconds,
      entityViewStore,
      renderEvents,
      shooterTransforms,
    }: {
      deltaSeconds: number;
      entityViewStore: Pick<ReturnType<typeof createEntityViewStore>, "flashEntity">;
      renderEvents: Array<ShotEvent | CombatEvent | DeathEvent>;
      shooterTransforms: Map<string, Transform>;
    }) {
      for (const event of renderEvents) {
        if (event.type === "shot") {
          const shooterTransform = shooterTransforms.get(event.attackerEntityId);

          const shotTransform = {
            rotation: Math.atan2(event.aim.y, event.aim.x),
            x: event.origin.x,
            y: event.origin.y,
          };

          addEffect({
            effects: activeEffects,
            object: createMuzzleFlash(shotTransform),
            root,
            seconds: MUZZLE_FLASH_DURATION_SECONDS,
          });
          addEffect({
            effects: activeEffects,
            object: createTracer({ aim: event.aim, transform: shotTransform }),
            root,
            seconds: TRACER_DURATION_SECONDS,
          });

          if (shooterTransform) {
            shooterTransform.rotation = shotTransform.rotation;
          }
          continue;
        }

        if (event.type !== "combat") {
          continue;
        }

        entityViewStore.flashEntity(event.targetEntityId);
        addEffect({
          effects: activeEffects,
          object: createImpactFlash(event.hitPosition),
          root,
          seconds: IMPACT_FLASH_DURATION_SECONDS,
        });
      }

      for (let index = activeEffects.length - 1; index >= 0; index -= 1) {
        const effect = activeEffects[index];
        if (!effect) {
          continue;
        }

        effect.remainingSeconds -= deltaSeconds;

        if (effect.remainingSeconds > 0) {
          continue;
        }

        root.remove(effect.object);
        disposeEffectObject(effect.object);
        activeEffects.splice(index, 1);
      }
    },
  };
};
