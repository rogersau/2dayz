# Game Elements Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the default town as readable map-driven Three.js buildings, upgrade players and zombies into distinct low-poly silhouettes, and add visible zombie-shooting feedback without changing server gameplay authority.

**Architecture:** Share the authored default town map from `packages/shared` so both server and client consume the same world definition. Keep static world geometry, dynamic entity views, and transient combat effects as separate render layers inside the existing client runtime: `createWorldView` builds map-derived buildings once, `entityViewStore` owns interpolated players and zombies, and `combatEffectsView` handles muzzle flashes, tracers, impacts, and short-lived death presentation.

**Tech Stack:** TypeScript, Three.js, React, Vitest, Testing Library, pnpm

---

## Worktree Context

Before execution, create or switch to a dedicated worktree with `@superpowers/using-git-worktrees`. Run all commands from that worktree root. If execution must stay in the current checkout, do not disturb unrelated user changes already present in the worktree.

Use `@superpowers/test-driven-development` for each code task below and `@superpowers/verification-before-completion` before claiming the feature is done.

## Planned File Changes

- Create: `packages/shared/src/content/defaultTownMap.ts` - shared authored default town map definition consumed by both client and server.
- Create: `packages/shared/src/content/defaultTownMap.test.ts` - regression test for the shared map export and landmark data.
- Modify: `packages/shared/src/index.ts` - export the shared default map.
- Modify: `apps/server/src/world/loadMapDefinition.ts` - import the default map from `@2dayz/shared` instead of server-local content.
- Modify: `apps/server/src/world/loadMapDefinition.test.ts` - prove the server still validates and loads the shared map.
- Delete: `apps/server/src/content/defaultTownMap.ts` - remove the old server-local copy once the shared version is live.
- Create: `apps/client/src/game/render/createWorldView.ts` - build static ground and building geometry from the shared map.
- Create: `apps/client/src/game/render/createWorldView.test.ts` - verify static world objects are created and cleaned up from map data.
- Modify: `apps/client/src/game/createScene.ts` - keep only scene-level lighting, fog, and background responsibilities.
- Modify: `apps/client/src/game/createCamera.ts` - retune the orthographic camera for the approved mid-zoom tactical read.
- Modify: `apps/client/src/game/boot.ts` - create and dispose the world and combat-effects layers alongside the existing runtime.
- Modify: `apps/client/src/game/boot.test.ts` - cover world-layer and combat-effects lifecycle plus local fire feedback queuing.
- Modify: `apps/client/src/game/render/entityViewStore.ts` - replace single meshes with grouped `Object3D` views, hit flash support, and short zombie death animation handling.
- Create: `apps/client/src/game/render/entityViewStore.test.ts` - cover silhouette creation, hit flash hooks, and delayed zombie cleanup.
- Modify: `apps/client/src/game/state/clientGameStore.ts` - add a private render-event queue for replicated combat and death events.
- Modify: `apps/client/src/game/state/clientGameStore.test.ts` - prove render events are queued and drained without breaking existing state behavior.
- Create: `apps/client/src/game/render/combatEffectsView.ts` - own muzzle flashes, tracers, impact flashes, and optional player-death bursts.
- Create: `apps/client/src/game/render/combatEffectsView.test.ts` - verify effect spawn and expiry behavior.
- Modify: `apps/client/src/game/render/renderFrame.ts` - feed the combat-effects layer with resolved local transforms and drained render events before rendering the scene.
- Modify: `apps/client/src/game/render/renderFrame.test.ts` - verify render-frame integration with combat effects.
- Modify: `apps/client/src/game/net/socketClient.ts` - keep mock-mode positions aligned with the shared map and emit simple mock combat updates so `pnpm dev` still demonstrates the feature.
- Modify: `apps/client/src/game/net/socketClient.test.ts` - cover mock map alignment and mock zombie shooting feedback.

## Task 1: Share The Authored Default Town Map

**Files:**
- Create: `packages/shared/src/content/defaultTownMap.ts`
- Create: `packages/shared/src/content/defaultTownMap.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/server/src/world/loadMapDefinition.ts`
- Modify: `apps/server/src/world/loadMapDefinition.test.ts`
- Delete: `apps/server/src/content/defaultTownMap.ts`

- [ ] **Step 1: Write the failing shared-map test**

Create `packages/shared/src/content/defaultTownMap.test.ts` with a focused regression test for the map export and the specific authored landmarks the client world builder will rely on.

```ts
import { describe, expect, it } from "vitest";

import { mapDefinitionSchema } from "./maps";
import { defaultTownMap } from "./defaultTownMap";

describe("defaultTownMap", () => {
  it("exports the shared default town map with the expected landmark volumes", () => {
    const map = mapDefinitionSchema.parse(defaultTownMap);

    expect(map.mapId).toBe("map_default-town");
    expect(map.collisionVolumes.map((volume) => volume.volumeId)).toEqual(
      expect.arrayContaining(["volume_market", "volume_police-station", "volume_barn"]),
    );
    expect(map.interactablePlacements.map((placement) => placement.placementId)).toEqual(
      expect.arrayContaining(["placement_market-crate", "placement_police-door"]),
    );
  });
});
```

Also update `apps/server/src/world/loadMapDefinition.test.ts` so its first happy-path test calls `loadMapDefinition(defaultTownMap)` after importing `defaultTownMap` from `@2dayz/shared`. That locks the server to the shared source of truth instead of a server-local file.

- [ ] **Step 2: Run the focused map tests to verify they fail**

Run:
- `pnpm --filter @2dayz/shared test -- src/content/defaultTownMap.test.ts`
- `pnpm --filter @2dayz/server test -- src/world/loadMapDefinition.test.ts`

Expected: FAIL because `packages/shared/src/content/defaultTownMap.ts` does not exist yet and the server test import cannot resolve the shared map.

- [ ] **Step 3: Move the map definition into `packages/shared` with the smallest possible code change**

Create `packages/shared/src/content/defaultTownMap.ts` by moving the contents of the current server-local map file unchanged. Then export it from `packages/shared/src/index.ts` and update `apps/server/src/world/loadMapDefinition.ts` to import it from `@2dayz/shared`.

```ts
import { defaultTownMap, mapDefinitionSchema, type MapDefinition } from "@2dayz/shared";

export const loadMapDefinition = (definition: MapDefinition = defaultTownMap): MapDefinition => {
  const map = mapDefinitionSchema.parse(definition);
  assertSpatialInvariants(map);
  return map;
};
```

Delete `apps/server/src/content/defaultTownMap.ts` after the shared import is live.

- [ ] **Step 4: Re-run the shared and server map tests**

Run:
- `pnpm --filter @2dayz/shared test -- src/content/defaultTownMap.test.ts`
- `pnpm --filter @2dayz/server test -- src/world/loadMapDefinition.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the shared map move**

```bash
git add packages/shared/src/content/defaultTownMap.ts packages/shared/src/content/defaultTownMap.test.ts packages/shared/src/index.ts apps/server/src/world/loadMapDefinition.ts apps/server/src/world/loadMapDefinition.test.ts
git rm apps/server/src/content/defaultTownMap.ts
git commit -m "refactor: share the default town map definition"
```

## Task 2: Build A Static World View From Shared Map Data

**Files:**
- Create: `apps/client/src/game/render/createWorldView.ts`
- Create: `apps/client/src/game/render/createWorldView.test.ts`

- [ ] **Step 1: Write the failing world-view test**

Create `apps/client/src/game/render/createWorldView.test.ts` with a focused test that proves the client can build a ground plane and named building groups directly from `defaultTownMap`.

```ts
import { defaultTownMap } from "@2dayz/shared";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createWorldView } from "./createWorldView";

describe("createWorldView", () => {
  it("builds static ground and building groups from collision volumes", () => {
    const scene = new THREE.Scene();
    const worldView = createWorldView({ map: defaultTownMap, scene });

    expect(scene.getObjectByName("world:static")).toBeInstanceOf(THREE.Group);
    expect(scene.getObjectByName("building:volume_market")).toBeTruthy();
    expect(scene.getObjectByName("building:volume_police-station")).toBeTruthy();
    expect(scene.getObjectByName("building:volume_barn")).toBeTruthy();

    worldView.dispose();

    expect(scene.getObjectByName("world:static")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the world-view test to verify it fails**

Run: `pnpm --filter @2dayz/client test -- src/game/render/createWorldView.test.ts`

Expected: FAIL with a module-not-found error because `createWorldView.ts` does not exist yet.

- [ ] **Step 3: Implement the smallest map-driven world builder**

Create `apps/client/src/game/render/createWorldView.ts` with one static root group plus a small internal registry of geometries and materials to dispose.

Implementation requirements:

- Create a root `THREE.Group` named `world:static`.
- Build one ground mesh from `map.bounds`.
- Build one named building group per `collisionVolume` using `x -> x`, `y -> z`, and a fixed readable height.
- Keep styling simple: one roof or cap mesh and one body mesh per building are enough.
- Use `volumeId` naming to allow later tests and debugging.

```ts
export const createWorldView = ({ map, scene }: { map: MapDefinition; scene: THREE.Scene }) => {
  const root = new THREE.Group();
  root.name = "world:static";
  const disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(map.bounds.width, 0.5, map.bounds.height),
    new THREE.MeshLambertMaterial({ color: "#34412b" }),
  );
  ground.name = "ground:map-bounds";
  ground.position.set(map.bounds.width / 2, -0.25, map.bounds.height / 2);
  root.add(ground);

  for (const volume of map.collisionVolumes) {
    const building = new THREE.Group();
    building.name = `building:${volume.volumeId}`;
    // body mesh + roof mesh using volume.position and volume.size
    root.add(building);
  }

  scene.add(root);

  return {
    dispose() {
      scene.remove(root);
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
};
```

Do not add roads or extra landmark props yet. Keep this task focused on map-derived ground and buildings only.

- [ ] **Step 4: Re-run the world-view test**

Run: `pnpm --filter @2dayz/client test -- src/game/render/createWorldView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the static world builder**

```bash
git add apps/client/src/game/render/createWorldView.ts apps/client/src/game/render/createWorldView.test.ts
git commit -m "feat: build the world view from shared map data"
```

## Task 3: Wire The Shared World Layer Into The Runtime And Retune The Camera

**Files:**
- Modify: `apps/client/src/game/createScene.ts`
- Modify: `apps/client/src/game/createCamera.ts`
- Modify: `apps/client/src/game/boot.ts`
- Modify: `apps/client/src/game/boot.test.ts`
- Modify: `apps/client/src/game/render/createWorldView.test.ts`

- [ ] **Step 1: Write the failing boot orchestration test**

Update `apps/client/src/game/boot.test.ts` to mock `createWorldView` and assert that boot creates the shared world layer once and disposes it during teardown.

```ts
const {
  createWorldViewMock,
  worldViewDisposeMock,
} = vi.hoisted(() => ({
  createWorldViewMock: vi.fn(),
  worldViewDisposeMock: vi.fn(),
}));

vi.mock("./render/createWorldView", () => ({
  createWorldView: (...args: unknown[]) => {
    createWorldViewMock(...args);
    return { dispose: worldViewDisposeMock };
  },
}));

it("creates and disposes the shared world view alongside the main scene", () => {
  const dispose = bootGame({
    canvas: document.createElement("canvas"),
    socketClient: { sendInput: vi.fn() },
    store: { getState: () => createStoreState(), subscribe: () => () => {} } as never,
  });

  expect(createWorldViewMock).toHaveBeenCalledTimes(1);

  dispose();

  expect(worldViewDisposeMock).toHaveBeenCalledTimes(1);
});
```

Extend `apps/client/src/game/render/createWorldView.test.ts` with one more assertion that the world root sits in positive-map space, for example `ground.position.x === map.bounds.width / 2`.

- [ ] **Step 2: Run the runtime tests to verify they fail**

Run:
- `pnpm --filter @2dayz/client test -- src/game/boot.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/createWorldView.test.ts`

Expected: FAIL because `boot.ts` does not create `createWorldView(...)` yet.

- [ ] **Step 3: Wire the world layer into boot and slim `createScene()` down to scene-level concerns**

Update `createScene.ts` so it only owns background, fog, and lights. Move the placeholder road, shack, silo, and ground meshes out entirely. Then update `boot.ts` to create the shared world layer after scene creation.

```ts
const { dispose: disposeScene, scene } = createScene();
const worldView = createWorldView({ map: defaultTownMap, scene });

return () => {
  worldView.dispose();
  disposeScene();
  renderer.dispose();
};
```

Retune the camera for the approved mid-zoom tactical read in `createCamera.ts`. Start with a slightly wider orthographic size than the current `18`, such as `22`, and raise the camera enough to keep nearby buildings and zombies readable together. Keep the camera orthographic and keep the existing follow logic in `renderFrame.ts` unchanged.

- [ ] **Step 4: Re-run the boot and world-view tests**

Run:
- `pnpm --filter @2dayz/client test -- src/game/boot.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/createWorldView.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the world-layer wiring**

```bash
git add apps/client/src/game/createScene.ts apps/client/src/game/createCamera.ts apps/client/src/game/boot.ts apps/client/src/game/boot.test.ts apps/client/src/game/render/createWorldView.test.ts
git commit -m "feat: render the shared town layout in the client"
```

## Task 4: Upgrade Entity Views For Readability, Hit Flash, And Zombie Death Animation

**Files:**
- Modify: `apps/client/src/game/render/entityViewStore.ts`
- Create: `apps/client/src/game/render/entityViewStore.test.ts`

- [ ] **Step 1: Write the failing entity-view tests**

Create `apps/client/src/game/render/entityViewStore.test.ts` with one test for silhouette construction and one for zombie death cleanup.

```ts
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
          transform: { rotation: 0, x: 12, y: 20 },
          velocity: { x: 0, y: 0 },
        },
        {
          displayName: "Bandit",
          entityId: "player_other",
          inventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
          kind: "player",
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
      deltaSeconds: 0.4,
      entities: [],
      latestTick: 3,
      localOverrides: new Map(),
      playerEntityId: null,
    });

    expect(scene.getObjectByName("entity:zombie_1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the entity-view tests to verify they fail**

Run: `pnpm --filter @2dayz/client test -- src/game/render/entityViewStore.test.ts`

Expected: FAIL because `entityViewStore.ts` still creates one box mesh per entity and has no grouped names or zombie death window.

- [ ] **Step 3: Refactor `entityViewStore` from single meshes to grouped entity objects**

Keep this change inside `entityViewStore.ts` rather than creating more helper files unless the file becomes unmanageable.

Implementation requirements:

- Change `EntityView.mesh` to `EntityView.object: THREE.Object3D`.
- Build players and zombies as named `THREE.Group` hierarchies.
- Give the self player a warmer and brighter base palette than remote players, and keep that palette data reachable in tests via `userData.baseColor` or an equivalent stable field on the key torso mesh.
- Track an array of materials per entity so hit flashes and death fades can update all visible parts together.
- Add a small `flashEntity(entityId: string)` method that starts a short emissive or color flash timer.
- Start zombie death animation once when `health.isDead` becomes true.
- If a zombie is removed while its death timer is active, keep it in the scene until the timer completes, then dispose it.
- Add a fallback path for the spec-required authoritative timing gap: if a zombie is removed before the renderer ever observed `health.isDead === true`, trigger the same short death presentation once only when that zombie was the target of a recent replicated `combat` hit and no death presentation has already fired.

```ts
type EntityView = {
  current: { tick: number; transform: Transform };
  previous: { tick: number; transform: Transform };
  object: THREE.Object3D;
  materials: THREE.MeshLambertMaterial[];
  flashRemainingMs: number;
  isDying: boolean;
  deathRemainingMs: number;
  removeWhenFinished: boolean;
};

flashEntity(entityId: string) {
  const view = entityViews.get(entityId);
  if (view) {
    view.flashRemainingMs = 120;
  }
}
```

Keep loot rendering simple unless a small palette change is needed for consistency. Do not add imported models or skeletal animation.

- [ ] **Step 4: Re-run the entity-view tests**

Run: `pnpm --filter @2dayz/client test -- src/game/render/entityViewStore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the entity-view upgrade**

```bash
git add apps/client/src/game/render/entityViewStore.ts apps/client/src/game/render/entityViewStore.test.ts
git commit -m "feat: give players and zombies readable low-poly silhouettes"
```

## Task 5: Add A Private Render-Event Queue To The Client Store

**Files:**
- Modify: `apps/client/src/game/state/clientGameStore.ts`
- Modify: `apps/client/src/game/state/clientGameStore.test.ts`

- [ ] **Step 1: Write the failing render-event queue test**

Add a focused test to `apps/client/src/game/state/clientGameStore.test.ts` that proves combat and death events are queued for the renderer without breaking the existing self-death state transition.

```ts
it("queues combat and death render events while preserving existing state updates", () => {
  const store = createClientGameStore();

  store.completeJoin({
    displayName: "Survivor",
    playerEntityId: "player_self",
    roomId: "room_browser-v1",
  });

  store.applyDelta({
    enteredEntities: [],
    entityUpdates: [],
    events: [
      {
        attackerEntityId: "player_self",
        damage: 12,
        hitPosition: { x: 18, y: 20 },
        remainingHealth: 28,
        roomId: "room_browser-v1",
        targetEntityId: "zombie_1",
        type: "combat",
        weaponItemId: "weapon_pistol",
      },
      {
        droppedInventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
        killerEntityId: "zombie_1",
        respawnAt: { x: 7, y: 14 },
        roomId: "room_browser-v1",
        type: "death",
        victimEntityId: "player_self",
      },
    ],
    removedEntityIds: [],
    roomId: "room_browser-v1",
    tick: 2,
    type: "delta",
  });

  expect(store.getState().isDead).toBe(true);
  expect(store.drainRenderEvents()).toEqual([
    expect.objectContaining({ type: "combat" }),
    expect.objectContaining({ type: "death" }),
  ]);
  expect(store.drainRenderEvents()).toEqual([]);
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `pnpm --filter @2dayz/client test -- src/game/state/clientGameStore.test.ts`

Expected: FAIL because the store has no `drainRenderEvents()` method and does not queue replicated events for the renderer.

- [ ] **Step 3: Add a private render-event queue modeled after `queuedInventoryAction`**

Keep the queue outside reactive state to avoid emitting frame-time store updates.

```ts
import type { CombatEvent, DeathEvent } from "@2dayz/shared";

export type ClientRenderEvent = CombatEvent | DeathEvent;

let queuedRenderEvents: ClientRenderEvent[] = [];

for (const event of delta.events) {
  if (event.type === "combat" || event.type === "death") {
    queuedRenderEvents.push(event);
  }

  if (event.type === "death" && event.victimEntityId === current.playerEntityId) {
    nextState = { ...nextState, isDead: true };
  }
}

drainRenderEvents() {
  const events = queuedRenderEvents;
  queuedRenderEvents = [];
  return events;
}
```

Do not move combat or death authority into the client. This queue exists only to let the renderer spawn short-lived visuals.

- [ ] **Step 4: Re-run the store test**

Run: `pnpm --filter @2dayz/client test -- src/game/state/clientGameStore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the render-event queue**

```bash
git add apps/client/src/game/state/clientGameStore.ts apps/client/src/game/state/clientGameStore.test.ts
git commit -m "feat: queue combat events for client rendering"
```

## Task 6: Add Combat Effects And Wire Them Into Boot And The Render Loop

**Files:**
- Create: `apps/client/src/game/render/combatEffectsView.ts`
- Create: `apps/client/src/game/render/combatEffectsView.test.ts`
- Modify: `apps/client/src/game/render/renderFrame.ts`
- Modify: `apps/client/src/game/render/renderFrame.test.ts`
- Modify: `apps/client/src/game/boot.ts`
- Modify: `apps/client/src/game/boot.test.ts`

- [ ] **Step 1: Write the failing combat-effects tests**

Create `apps/client/src/game/render/combatEffectsView.test.ts` and extend `renderFrame.test.ts` and `boot.test.ts` to cover effect spawning, render-frame integration, and local fire queuing.

`combatEffectsView.test.ts` should assert that local shots and replicated combat events create short-lived scene objects and call `entityViewStore.flashEntity(...)` for visible hits.

Add one more focused assertion, either in `combatEffectsView.test.ts` or `entityViewStore.test.ts`, that proves a recently hit zombie still receives a single death presentation when it disappears through `removedEntityIds` without an observed dead-state frame.

```ts
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { createCombatEffectsView } from "./combatEffectsView";

describe("createCombatEffectsView", () => {
  it("spawns and expires local shots and authoritative hit effects", () => {
    const scene = new THREE.Scene();
    const effects = createCombatEffectsView(scene);
    const entityViewStore = { flashEntity: vi.fn() };

    effects.queueLocalShot({ aim: { x: 12, y: 0 } });
    effects.update({
      deltaSeconds: 1 / 20,
      entityViewStore: entityViewStore as never,
      localPlayerTransform: { rotation: 0, x: 12, y: 20 },
      renderEvents: [
        {
          attackerEntityId: "player_self",
          damage: 12,
          hitPosition: { x: 18, y: 20 },
          remainingHealth: 28,
          roomId: "room_browser-v1",
          targetEntityId: "zombie_1",
          type: "combat",
          weaponItemId: "weapon_pistol",
        },
      ],
    });

    expect(entityViewStore.flashEntity).toHaveBeenCalledWith("zombie_1");
    expect(scene.children.some((child) => child.name.startsWith("effect:"))).toBe(true);

    effects.update({
      deltaSeconds: 1,
      entityViewStore: entityViewStore as never,
      localPlayerTransform: null,
      renderEvents: [],
    });

    expect(scene.children.some((child) => child.name.startsWith("effect:"))).toBe(false);
  });
});
```

Add one integration assertion to `renderFrame.test.ts` that `combatEffectsView.update(...)` receives the resolved local transform and `store.drainRenderEvents()` output, and one assertion to `boot.test.ts` that `queueLocalShot(...)` fires when `sendInput` sends a joined-state fire packet.

- [ ] **Step 2: Run the focused combat-feedback tests to verify they fail**

Run:
- `pnpm --filter @2dayz/client test -- src/game/render/combatEffectsView.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/renderFrame.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/boot.test.ts`

Expected: FAIL because `combatEffectsView.ts` does not exist and neither `renderFrame.ts` nor `boot.ts` integrates combat feedback yet.

- [ ] **Step 3: Implement the combat-effects layer with one queued local-shot path and one replicated-event path**

Create `combatEffectsView.ts` with a tiny API:

```ts
export const createCombatEffectsView = (scene: THREE.Scene) => {
  const root = new THREE.Group();
  root.name = "effects:combat";
  const queuedLocalShots: Array<{ aim: { x: number; y: number } }> = [];

  scene.add(root);

  return {
    queueLocalShot(shot: { aim: { x: number; y: number } }) {
      queuedLocalShots.push(shot);
    },
    update({ deltaSeconds, entityViewStore, localPlayerTransform, renderEvents }) {
      // consume queuedLocalShots and renderEvents
      // spawn muzzle flash + tracer from localPlayerTransform
      // spawn impact flash for combat events and call entityViewStore.flashEntity(...)
      // age and dispose expired effects
    },
    dispose() {
      scene.remove(root);
      // dispose geometries and materials
    },
  };
};
```

Wire it like this:

- `boot.ts` creates and disposes the combat-effects view.
- In `boot.ts::sendInput`, after `socketClient.sendInput(nextInput)`, call `combatEffectsView.queueLocalShot({ aim: nextInput.aim })` only when joined and `nextInput.actions.fire` is present.
- `renderFrame.ts` resolves the local predicted transform as it already does, then calls `combatEffectsView.update({ deltaSeconds, entityViewStore, localPlayerTransform, renderEvents: store.drainRenderEvents() })` before `renderer.render(scene, camera)`.

To support the zombie-removal fallback, the implementation may either:

- let `combatEffectsView` track recent `combat.targetEntityId` hits and notify `entityViewStore` about removal-triggered death fallback, or
- keep the recent-hit bookkeeping inside `entityViewStore` and have `renderFrame.ts` pass the drained render events there before removal cleanup.

Pick the smaller of those two approaches during implementation, but do not skip the fallback behavior.

Keep the effects short and simple:

- muzzle flash: small warm plane or sprite near the player
- tracer: thin line or stretched plane from player toward aim direction
- impact flash: short bright marker at `combat.hitPosition`
- optional player death burst: only if it stays tiny and does not interfere with the existing death overlay

- [ ] **Step 4: Re-run the focused combat-feedback tests**

Run:
- `pnpm --filter @2dayz/client test -- src/game/render/combatEffectsView.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/renderFrame.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/boot.test.ts`

Expected: PASS

- [ ] **Step 5: Run the broader client runtime tests together**

Run:
- `pnpm --filter @2dayz/client test -- src/game/render/entityViewStore.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/state/clientGameStore.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/combatEffectsView.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/renderFrame.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/boot.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the combat-effects runtime**

```bash
git add apps/client/src/game/render/combatEffectsView.ts apps/client/src/game/render/combatEffectsView.test.ts apps/client/src/game/render/renderFrame.ts apps/client/src/game/render/renderFrame.test.ts apps/client/src/game/boot.ts apps/client/src/game/boot.test.ts
git commit -m "feat: add combat feedback to the threejs scene"
```

## Task 7: Keep Mock Dev Mode Aligned With The Shared Map And Basic Zombie Shooting

**Files:**
- Modify: `apps/client/src/game/net/socketClient.ts`
- Modify: `apps/client/src/game/net/socketClient.test.ts`

- [ ] **Step 1: Write the failing mock-world tests**

Add two focused tests to `apps/client/src/game/net/socketClient.test.ts`:

- one that proves the mock snapshot now spawns players and the zombie at positive coordinates inside the shared town layout
- one that proves repeated fire input emits a mock `combat` event and eventually removes `zombie_1`

```ts
it("places the mock world inside the shared default town coordinates", async () => {
  const protocolStore = createProtocolStore();
  const socketClient = createSocketClient({ mode: "mock", protocolStore });

  await socketClient.join({ displayName: "Survivor" });

  const { snapshot } = protocolStore.drainWorldUpdates();
  const self = snapshot?.players.find((player) => player.entityId === "player_survivor");
  const zombie = snapshot?.zombies.find((entity) => entity.entityId === "zombie_1");

  expect(self?.transform.x).toBeGreaterThan(5);
  expect(self?.transform.y).toBeGreaterThan(5);
  expect(zombie?.transform.x).toBeGreaterThan(self?.transform.x ?? 0);
});

it("emits mock combat deltas and eventually removes the mock zombie", async () => {
  const protocolStore = createProtocolStore();
  const socketClient = createSocketClient({ mode: "mock", protocolStore });

  await socketClient.join({ displayName: "Survivor" });
  protocolStore.drainWorldUpdates();

  socketClient.sendInput(inputMessageSchema.parse({
    actions: { fire: true },
    aim: { x: 1, y: 0 },
    movement: { x: 0, y: 0 },
    sequence: 1,
    type: "input",
  }));

  const { deltas } = protocolStore.drainWorldUpdates();

  expect(deltas[0]?.events).toEqual(
    expect.arrayContaining([expect.objectContaining({ type: "combat", targetEntityId: "zombie_1" })]),
  );
});
```

- [ ] **Step 2: Run the mock-world tests to verify they fail**

Run: `pnpm --filter @2dayz/client test -- src/game/net/socketClient.test.ts`

Expected: FAIL because the mock world still lives around the origin and does not emit combat events or zombie removal.

- [ ] **Step 3: Move the mock world onto the shared town map and add one tiny mock combat loop**

Update `socketClient.ts` so mock mode imports `defaultTownMap` and seeds the snapshot near the town center instead of around `(0, 0)`. Add minimal zombie combat bookkeeping to `MockWorldState`.

```ts
type MockWorldState = {
  ammoReserve: number;
  equippedWeaponSlot: number | null;
  lastProcessedInputSequence: number;
  localInventorySlotOne: { itemId: string; quantity: number } | null;
  localTransform: { rotation: number; x: number; y: number };
  zombieHealth: number;
  zombieIsAlive: boolean;
  zombieTransform: { rotation: number; x: number; y: number };
};
```

Implementation rules:

- seed the local player, bandit, and zombie near the default town map's usable area
- on fire input, if the mock zombie is still alive and in front of the player, subtract health, emit a `combat` event, and once health reaches zero emit a delta with `health.isDead = true` followed by `removedEntityIds: ["zombie_1"]`
- keep this mock loop intentionally tiny; do not try to recreate the full server combat system inside the client mock

- [ ] **Step 4: Re-run the mock-world tests**

Run: `pnpm --filter @2dayz/client test -- src/game/net/socketClient.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the mock-mode alignment**

```bash
git add apps/client/src/game/net/socketClient.ts apps/client/src/game/net/socketClient.test.ts
git commit -m "feat: align mock combat with the shared town map"
```

## Task 8: Final Verification

**Files:**
- No new files

- [ ] **Step 1: Run the full unit test suite**

Run: `pnpm test`

Expected: PASS across shared, server, and client packages.

- [ ] **Step 2: Run the full build**

Run: `pnpm build`

Expected: PASS

- [ ] **Step 3: Manually verify the real authoritative path over WebSocket**

Run: `VITE_CLIENT_SOCKET_MODE=ws pnpm dev`

Then verify in the browser at `http://127.0.0.1:3200`:

- buildings appear at the market, police station, and barn footprints rather than the old placeholder props
- the local player reads differently from other players and zombies
- zombies move through the rendered world and remain readable at mid zoom
- clicking fire produces muzzle flash and a tracer immediately
- hitting a zombie produces an impact flash and target hit confirmation
- killing a zombie produces a short death resolution before cleanup

- [ ] **Step 4: Manually verify the default mock path still demonstrates the feature**

Run: `pnpm dev`

Then verify that the mock world still spawns inside the rendered town and that the mock zombie can be shot for local visual smoke testing.

- [ ] **Step 5: If any verification fails, fix the issue before handing off**

Do not mark the feature complete until the failing verification has a corresponding code fix and the relevant command has been re-run successfully.
