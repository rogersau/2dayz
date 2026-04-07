import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createEntityViewStore } from "./entityViewStore";

describe("createEntityViewStore", () => {
  it("renders players and zombies as distinct grouped silhouettes", () => {
    const scene = new THREE.Scene();
    const store = createEntityViewStore(scene);

    store.render({
      deltaSeconds: 1 / 20,
      entities: [
        {
          displayName: "Survivor",
          entityId: "player_self",
          inventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
          kind: "player",
          stamina: { current: 10, max: 10 },
          transform: { rotation: 0, x: 12, y: 20 },
          velocity: { x: 0, y: 0 },
        },
        {
          displayName: "Bandit",
          entityId: "player_other",
          inventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
          kind: "player",
          stamina: { current: 10, max: 10 },
          transform: { rotation: 0, x: 10, y: 18 },
          velocity: { x: 0, y: 0 },
        },
        {
          archetypeId: "zombie_shambler",
          entityId: "zombie_1",
          health: { current: 40, isDead: false, max: 40 },
          kind: "zombie",
          state: "chasing",
          transform: { rotation: 0, x: 15, y: 20 },
          velocity: { x: 0, y: 0 },
        },
      ],
      latestTick: 1,
      localOverrides: new Map(),
      playerEntityId: "player_self",
    });

    expect(scene.getObjectByName("entity:player_self")?.getObjectByName("survivor-torso")).toBeTruthy();
    expect(scene.getObjectByName("entity:zombie_1")?.getObjectByName("zombie-hunch")).toBeTruthy();
    expect(
      scene.getObjectByName("entity:player_self")?.getObjectByName("survivor-torso")?.userData.baseColor,
    ).not.toEqual(
      scene.getObjectByName("entity:player_other")?.getObjectByName("survivor-torso")?.userData.baseColor,
    );
  });

  it("keeps a dead zombie visible for a short death window before removing it", () => {
    const scene = new THREE.Scene();
    const store = createEntityViewStore(scene);

    store.render({
      deltaSeconds: 1 / 20,
      entities: [
        {
          archetypeId: "zombie_shambler",
          entityId: "zombie_1",
          health: { current: 40, isDead: false, max: 40 },
          kind: "zombie",
          state: "chasing",
          transform: { rotation: 0, x: 15, y: 20 },
          velocity: { x: 0, y: 0 },
        },
      ],
      latestTick: 1,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    store.render({
      deltaSeconds: 1 / 20,
      entities: [
        {
          archetypeId: "zombie_shambler",
          entityId: "zombie_1",
          health: { current: 0, isDead: true, max: 40 },
          kind: "zombie",
          state: "attacking",
          transform: { rotation: 0, x: 15, y: 20 },
          velocity: { x: 0, y: 0 },
        },
      ],
      latestTick: 2,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    store.render({
      deltaSeconds: 0.2,
      entities: [],
      latestTick: 3,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    expect(scene.getObjectByName("entity:zombie_1")).toBeTruthy();

    store.render({
      deltaSeconds: 0.4,
      entities: [],
      latestTick: 4,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    expect(scene.getObjectByName("entity:zombie_1")).toBeUndefined();
  });

  it("does not apply the recent-hit death fallback to removed non-zombies", () => {
    const scene = new THREE.Scene();
    const store = createEntityViewStore(scene);

    store.render({
      deltaSeconds: 1 / 20,
      entities: [
        {
          displayName: "Survivor",
          entityId: "player_other",
          inventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
          kind: "player",
          stamina: { current: 10, max: 10 },
          transform: { rotation: 0, x: 10, y: 18 },
          velocity: { x: 0, y: 0 },
        },
      ],
      latestTick: 1,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    store.markRecentCombatHit("player_other");

    store.render({
      deltaSeconds: 1 / 20,
      entities: [],
      latestTick: 2,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    expect(scene.getObjectByName("entity:player_other")).toBeUndefined();
  });

  it("does not extend the recent-hit death fallback across repeated removal frames", () => {
    const scene = new THREE.Scene();
    const store = createEntityViewStore(scene);

    store.render({
      deltaSeconds: 1 / 20,
      entities: [
        {
          archetypeId: "zombie_shambler",
          entityId: "zombie_1",
          health: { current: 40, isDead: false, max: 40 },
          kind: "zombie",
          state: "chasing",
          transform: { rotation: 0, x: 15, y: 20 },
          velocity: { x: 0, y: 0 },
        },
      ],
      latestTick: 1,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    store.markRecentCombatHit("zombie_1");

    store.render({
      deltaSeconds: 1 / 20,
      entities: [],
      latestTick: 2,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    const zombieAfterRemoval = scene.getObjectByName("entity:zombie_1");

    expect(zombieAfterRemoval).toBeTruthy();

    store.render({
      deltaSeconds: 0.2,
      entities: [],
      latestTick: 3,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    expect(scene.getObjectByName("entity:zombie_1")).toBe(zombieAfterRemoval);

    store.render({
      deltaSeconds: 0.06,
      entities: [],
      latestTick: 4,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    expect(scene.getObjectByName("entity:zombie_1")).toBeUndefined();
  });
});
