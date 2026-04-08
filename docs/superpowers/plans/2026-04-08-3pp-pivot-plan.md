# Third-Person Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current top-down browser loop with a playable third-person survival-action slice: compact 3D encounter space, chase camera, camera-relative keyboard and mouse controls, one authoritative firearm loop, and zombies tuned for the new view.

**Architecture:** Keep the existing monorepo, multiplayer authority, and fixed-tick simulation, but reinterpret the game as a 2.5D authoritative plane with a true third-person Three.js presentation. Shared contracts add optional aiming and weapon-state support, the server spawns players with a starter firearm and replicates weapon state, and the client replaces cursor-relative aiming with pointer-lock camera math, a perspective chase camera, refreshed world and actor presentation, and a minimal combat HUD.

**Tech Stack:** TypeScript, React, Three.js, Vitest, Testing Library, Playwright, pnpm

---

## Worktree Context

Before execution, create or switch to a dedicated worktree for this feature using `superpowers:using-git-worktrees`. Run all commands from that worktree root. If execution must stay in the current checkout, do not disturb unrelated user changes already present in the worktree.

Use `superpowers:test-driven-development` for each code task below and `superpowers:verification-before-completion` before claiming the pivot is done.

## Scope Check

This stays as one implementation plan because the approved spec is one tightly coupled vertical slice. The shared contracts, server rules, camera, controls, presentation, and HUD all exist to prove the same one-weapon third-person loop, so splitting them into separate plans would create fake integration boundaries instead of working software.

## Planned File Changes

- Create: `packages/shared/src/world/weapon.ts` - shared weapon-state schema and type used by server replication and client HUD.
- Modify: `packages/shared/src/protocol/messages.ts` - add optional `actions.aiming` and optional replicated `weaponState` on player payloads.
- Modify: `packages/shared/src/world/entities.ts` - add optional `weaponState` to player delta payloads.
- Modify: `packages/shared/src/index.ts` - export the new shared weapon and encounter-map modules.
- Modify: `packages/shared/src/protocol/schemas.test.ts` - lock down the new shared schema behavior.
- Create: `packages/shared/src/content/thirdPersonSliceMap.ts` - compact encounter-focused map for the pivot slice.
- Create: `packages/shared/src/content/thirdPersonSliceMap.test.ts` - regression test for the authored slice map.
- Modify: `apps/server/src/world/loadMapDefinition.ts` - load the new encounter map by default.
- Modify: `apps/server/src/world/loadMapDefinition.test.ts` - validate the new map and keep authored-world invariants covered.
- Modify: `apps/server/src/sim/state.ts` - spawn players with a starter revolver loadout and loaded weapon state.
- Modify: `apps/server/src/sim/query.ts` - include optional `weaponState` in snapshots and deltas.
- Modify: `apps/server/src/sim/query.test.ts` - prove snapshots and deltas carry starter loadout weapon state.
- Modify: `apps/server/src/sim/systems/movementSystem.ts` - suppress sprint while aiming and keep facing authoritative from aim direction.
- Modify: `apps/server/src/sim/systems/movementSystem.test.ts` - cover aim-mode movement rules.
- Modify: `apps/server/src/sim/systems/combatSystem.ts` - preserve authoritative weapon consumption and expose current weapon state cleanly.
- Modify: `apps/server/src/sim/systems/combatSystem.test.ts` - verify starter loadout firing and replicated magazine behavior.
- Modify: `apps/server/src/sim/systems/zombieSystem.ts` - retune hearing and pressure for the compact third-person encounter.
- Modify: `apps/server/src/sim/systems/zombieSystem.test.ts` - cover the updated pressure and hearing behavior.
- Modify: `apps/server/src/content/defaultZombies.ts` - retune archetype speeds, aggro, and attack ranges for the slice.
- Create: `apps/client/src/game/thirdPersonMath.ts` - pure math helpers for camera-relative movement, projected aim, and chase-camera pose.
- Create: `apps/client/src/game/thirdPersonMath.test.ts` - focused math coverage for the third-person helpers.
- Modify: `apps/client/src/game/input/inputController.ts` - replace cursor-relative aiming with pointer-lock third-person input.
- Modify: `apps/client/src/game/input/inputController.test.ts` - verify pointer-lock, camera-relative movement, and aiming behavior.
- Modify: `apps/client/src/game/createCamera.ts` - switch from orthographic framing to a perspective chase camera.
- Modify: `apps/client/src/game/createCamera.test.ts` - lock down the new camera type and tuning.
- Modify: `apps/client/src/game/render/renderFrame.ts` - drive the camera from predicted local movement plus current look state.
- Modify: `apps/client/src/game/render/renderFrame.test.ts` - verify the resolved local transform and look state produce the expected chase view.
- Modify: `apps/client/src/game/boot.ts` - pass third-person look state through the runtime and swap the static world import to the new encounter map.
- Modify: `apps/client/src/game/boot.test.ts` - cover runtime orchestration for the new camera and look-state flow.
- Modify: `apps/client/src/game/createRenderer.ts` - enable renderer settings suited to the new perspective scene.
- Modify: `apps/client/src/game/createScene.ts` - retune scene fog and lighting for third-person readability.
- Modify: `apps/client/src/game/render/createWorldView.ts` - render the new compact encounter space with stronger cover and ground readability.
- Modify: `apps/client/src/game/render/createWorldView.test.ts` - verify the new world geometry is built and cleaned up.
- Modify: `apps/client/src/game/render/entityViewStore.ts` - make player and zombie silhouettes read correctly from behind the player.
- Modify: `apps/client/src/game/render/entityViewStore.test.ts` - cover the new body-part naming and weapon/readability affordances.
- Modify: `apps/client/src/game/state/clientGameStore.ts` - store optional replicated weapon state for the local player.
- Modify: `apps/client/src/game/state/clientGameStore.test.ts` - verify snapshot and delta application preserves weapon state.
- Create: `apps/client/src/game/ui/CombatHud.tsx` - minimal joined-state combat HUD with crosshair, health, and ammo.
- Create: `apps/client/src/game/ui/CombatHud.test.tsx` - focused coverage for HUD display behavior.
- Modify: `apps/client/src/App.tsx` - render the combat HUD, remove the old joined-state inventory shell, and default dev runs to real WebSocket mode.
- Modify: `apps/client/src/App.test.tsx` - update joined-shell expectations around the combat HUD and removed quickbar/inventory UI.
- Modify: `apps/client/src/styles.css` - support the new combat HUD, crosshair, and cleaner joined-state layout.
- Modify: `apps/client/e2e/join-and-spawn.spec.ts` - assert the third-person combat shell instead of the old quickbar flow.
- Modify: `apps/client/e2e/reconnect-and-retry.spec.ts` - reconnect into the new joined shell.
- Modify: `apps/client/e2e/client-performance.spec.ts` - wait for the new combat HUD selector.

## Task 1: Add Shared Third-Person Gameplay Contracts

**Files:**
- Create: `packages/shared/src/world/weapon.ts`
- Modify: `packages/shared/src/protocol/messages.ts`
- Modify: `packages/shared/src/world/entities.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/protocol/schemas.test.ts`

- [ ] **Step 1: Write the failing shared-schema test**

Update `packages/shared/src/protocol/schemas.test.ts` to prove the client can send `actions.aiming` and that player payloads may carry replicated `weaponState`.

```ts
import { describe, expect, it } from "vitest";

import { inputMessageSchema, playerStateSchema } from "./schemas";

describe("protocol schemas", () => {
  it("parses third-person aiming input and optional player weapon state", () => {
    expect(
      inputMessageSchema.parse({
        type: "input",
        sequence: 7,
        movement: { x: 0, y: -1 },
        aim: { x: 1, y: 0 },
        actions: {
          aiming: true,
          fire: true,
        },
      }),
    ).toMatchObject({
      actions: { aiming: true, fire: true },
      type: "input",
    });

    expect(
      playerStateSchema.parse({
        entityId: "player_1",
        displayName: "Scout",
        transform: { x: 10, y: 5, rotation: 0.4 },
        velocity: { x: 0, y: 0 },
        stamina: { current: 8, max: 10 },
        inventory: {
          slots: [
            { itemId: "item_revolver", quantity: 1 },
            null,
            null,
            null,
            null,
            null,
          ],
          equippedWeaponSlot: 0,
          ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 12 }],
        },
        weaponState: {
          magazineAmmo: 6,
          isReloading: false,
          reloadRemainingMs: 0,
          fireCooldownRemainingMs: 0,
        },
      }),
    ).toMatchObject({
      weaponState: { magazineAmmo: 6 },
    });
  });
});
```

- [ ] **Step 2: Run the shared schema test to verify it fails**

Run: `pnpm --filter @2dayz/shared test -- src/protocol/schemas.test.ts`
Expected: FAIL because `actions.aiming` and `weaponState` are not part of the shared schemas yet.

- [ ] **Step 3: Implement the shared third-person contract additions**

Create `packages/shared/src/world/weapon.ts` and wire it into the existing message and entity schemas.

```ts
import { z } from "zod";

export const weaponStateSchema = z
  .object({
    magazineAmmo: z.number().int().nonnegative(),
    isReloading: z.boolean(),
    reloadRemainingMs: z.number().int().nonnegative(),
    fireCooldownRemainingMs: z.number().int().nonnegative(),
  })
  .strict();

export type WeaponState = z.infer<typeof weaponStateSchema>;
```

Update `packages/shared/src/protocol/messages.ts` and `packages/shared/src/world/entities.ts` like this:

```ts
import { weaponStateSchema } from "../world/weapon";

actions: z
  .object({
    fire: z.boolean().optional(),
    aiming: z.boolean().optional(),
    sprint: z.boolean().optional(),
    reload: z.boolean().optional(),
    interact: z.boolean().optional(),
    pickupEntityId: entityIdSchema.optional(),
    inventory: inventoryActionSchema.optional(),
  })
  .strict(),

export const playerStateSchema = z
  .object({
    entityId: entityIdSchema,
    displayName: z.string().min(1),
    transform: transformSchema,
    velocity: velocitySchema,
    stamina: staminaSchema,
    inventory: inventorySchema,
    weaponState: weaponStateSchema.optional(),
    lastProcessedInputSequence: z.number().int().nonnegative().optional(),
    health: healthSchema.optional(),
  })
  .strict();

weaponState: weaponStateSchema.optional(),
```

Export `weaponStateSchema` and `WeaponState` from `packages/shared/src/index.ts`.

- [ ] **Step 4: Re-run the shared schema test**

Run: `pnpm --filter @2dayz/shared test -- src/protocol/schemas.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the shared contract work**

```bash
git add packages/shared/src/world/weapon.ts packages/shared/src/protocol/messages.ts packages/shared/src/world/entities.ts packages/shared/src/index.ts packages/shared/src/protocol/schemas.test.ts
git commit -m "feat: add third-person gameplay contracts"
```

## Task 2: Author The Encounter Map And Make It The Runtime Default

**Files:**
- Create: `packages/shared/src/content/thirdPersonSliceMap.ts`
- Create: `packages/shared/src/content/thirdPersonSliceMap.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/server/src/world/loadMapDefinition.ts`
- Modify: `apps/server/src/world/loadMapDefinition.test.ts`

- [ ] **Step 1: Write the failing encounter-map tests**

Create `packages/shared/src/content/thirdPersonSliceMap.test.ts` and update `apps/server/src/world/loadMapDefinition.test.ts` to expect the new slice map.

```ts
import { describe, expect, it } from "vitest";

import { mapDefinitionSchema } from "./maps";
import { thirdPersonSliceMap } from "./thirdPersonSliceMap";

describe("thirdPersonSliceMap", () => {
  it("exports a compact encounter map with cover, spawns, and navigation lanes", () => {
    const map = mapDefinitionSchema.parse(thirdPersonSliceMap);

    expect(map.mapId).toBe("map_third-person-yard");
    expect(map.collisionVolumes.map((volume) => volume.volumeId)).toEqual(
      expect.arrayContaining(["volume_north-barricade", "volume_central-truck", "volume_east-shed"]),
    );
    expect(map.respawnPoints).toHaveLength(4);
    expect(map.zombieSpawnZones).toHaveLength(2);
  });
});
```

Update the first test in `apps/server/src/world/loadMapDefinition.test.ts` so it imports `thirdPersonSliceMap` from `@2dayz/shared` and expects `map.mapId` to be `"map_third-person-yard"`.

- [ ] **Step 2: Run the focused map tests to verify they fail**

Run:
- `pnpm --filter @2dayz/shared test -- src/content/thirdPersonSliceMap.test.ts`
- `pnpm --filter @2dayz/server test -- src/world/loadMapDefinition.test.ts`

Expected: FAIL because `thirdPersonSliceMap.ts` does not exist yet and the server test still expects the old default town.

- [ ] **Step 3: Implement the compact third-person encounter map**

Create `packages/shared/src/content/thirdPersonSliceMap.ts` with an authored map that favors readable lanes, flanks, and cover instead of town-scale traversal.

```ts
import type { MapDefinition } from "./maps";

export const thirdPersonSliceMap: MapDefinition = {
  mapId: "map_third-person-yard",
  name: "South Yard",
  bounds: { width: 36, height: 28 },
  collisionVolumes: [
    {
      volumeId: "volume_north-barricade",
      kind: "box",
      position: { x: 18, y: 5 },
      size: { width: 18, height: 2 },
    },
    {
      volumeId: "volume_central-truck",
      kind: "box",
      position: { x: 18, y: 14 },
      size: { width: 6, height: 3 },
    },
    {
      volumeId: "volume_east-shed",
      kind: "box",
      position: { x: 29, y: 18 },
      size: { width: 6, height: 6 },
    },
  ],
  zombieSpawnZones: [
    {
      zoneId: "zone_north-lane",
      center: { x: 28, y: 7 },
      radius: 3,
      maxAlive: 3,
      archetypeIds: ["zombie_shambler", "zombie_runner"],
    },
    {
      zoneId: "zone_south-lane",
      center: { x: 8, y: 23 },
      radius: 3,
      maxAlive: 2,
      archetypeIds: ["zombie_shambler"],
    },
  ],
  lootPoints: [
    {
      pointId: "point_loot-field-cache",
      position: { x: 18, y: 9 },
      tableId: "loot_police",
    },
  ],
  respawnPoints: [
    { pointId: "point_respawn-west-entry", position: { x: 4, y: 14 } },
    { pointId: "point_respawn-south-entry", position: { x: 12, y: 25 } },
    { pointId: "point_respawn-east-entry", position: { x: 32, y: 14 } },
    { pointId: "point_respawn-north-entry", position: { x: 20, y: 3 } },
  ],
  interactablePlacements: [
    {
      placementId: "placement_field-cache",
      kind: "crate",
      position: { x: 18, y: 9 },
      interactionRadius: 1.5,
      prompt: "Search cache",
    },
  ],
  navigation: {
    nodes: [
      { nodeId: "node_west-entry", position: { x: 4, y: 14 } },
      { nodeId: "node_north-lane", position: { x: 12, y: 8 } },
      { nodeId: "node_center-west", position: { x: 12, y: 16 } },
      { nodeId: "node_center-east", position: { x: 24, y: 16 } },
      { nodeId: "node_east-lane", position: { x: 31, y: 14 } },
      { nodeId: "node_south-lane", position: { x: 10, y: 23 } },
    ],
    links: [
      { from: "node_west-entry", to: "node_north-lane", cost: 10 },
      { from: "node_north-lane", to: "node_west-entry", cost: 10 },
      { from: "node_west-entry", to: "node_center-west", cost: 8 },
      { from: "node_center-west", to: "node_west-entry", cost: 8 },
      { from: "node_center-west", to: "node_center-east", cost: 12 },
      { from: "node_center-east", to: "node_center-west", cost: 12 },
      { from: "node_center-east", to: "node_east-lane", cost: 7 },
      { from: "node_east-lane", to: "node_center-east", cost: 7 },
      { from: "node_center-west", to: "node_south-lane", cost: 8 },
      { from: "node_south-lane", to: "node_center-west", cost: 8 },
      { from: "node_north-lane", to: "node_center-east", cost: 14 },
      { from: "node_center-east", to: "node_north-lane", cost: 14 },
    ],
  },
};
```

Then export it from `packages/shared/src/index.ts` and switch `apps/server/src/world/loadMapDefinition.ts` to default to `thirdPersonSliceMap`:

```ts
import { mapDefinitionSchema, thirdPersonSliceMap, type MapDefinition } from "@2dayz/shared";

export const loadMapDefinition = (definition: MapDefinition = thirdPersonSliceMap): MapDefinition => {
  const map = mapDefinitionSchema.parse(definition);
  assertSpatialInvariants(map);
  return map;
};
```

- [ ] **Step 4: Re-run the focused map tests**

Run:
- `pnpm --filter @2dayz/shared test -- src/content/thirdPersonSliceMap.test.ts`
- `pnpm --filter @2dayz/server test -- src/world/loadMapDefinition.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the encounter-map foundation**

```bash
git add packages/shared/src/content/thirdPersonSliceMap.ts packages/shared/src/content/thirdPersonSliceMap.test.ts packages/shared/src/index.ts apps/server/src/world/loadMapDefinition.ts apps/server/src/world/loadMapDefinition.test.ts
git commit -m "feat: author the third-person encounter map"
```

## Task 3: Spawn Players With A Starter Firearm And Replicate Weapon State

**Files:**
- Modify: `apps/server/src/sim/state.ts`
- Modify: `apps/server/src/sim/query.ts`
- Modify: `apps/server/src/sim/query.test.ts`
- Modify: `apps/server/src/sim/systems/combatSystem.test.ts`

- [ ] **Step 1: Write the failing server-state tests**

Update `apps/server/src/sim/query.test.ts` and `apps/server/src/sim/systems/combatSystem.test.ts` to prove spawned players have a starter revolver and that replication includes `weaponState`.

```ts
it("includes starter weapon state in snapshots and deltas", () => {
  const state = createRoomState({ roomId: "room_test" });

  queueSpawnPlayer(state, {
    entityId: "player_test-1",
    displayName: "Avery",
    position: { x: 1, y: 1 },
  });
  createLifecycleSystem().update(state, 0);

  expect(createRoomReplicationSnapshot(state, "player_test-1")).toMatchObject({
    players: [
      {
        entityId: "player_test-1",
        inventory: {
          equippedWeaponSlot: 0,
          slots: [expect.objectContaining({ itemId: "item_revolver" })],
        },
        weaponState: {
          magazineAmmo: 6,
          isReloading: false,
        },
      },
    ],
  });
});
```

Add a companion assertion in `combatSystem.test.ts` that a freshly spawned player fires once without hand-editing inventory and leaves `magazineAmmo` at `5`.

- [ ] **Step 2: Run the focused server tests to verify they fail**

Run:
- `pnpm --filter @2dayz/server test -- src/sim/query.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/combatSystem.test.ts`

Expected: FAIL because players currently spawn with an empty inventory and snapshots do not include `weaponState`.

- [ ] **Step 3: Implement starter loadout and weapon-state replication**

Update `apps/server/src/sim/state.ts` to spawn players with the slice loadout and loaded magazine, then update `apps/server/src/sim/query.ts` to replicate it.

```ts
const createStarterInventory = (): Inventory => {
  return {
    ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
    equippedWeaponSlot: 0,
    slots: [
      { itemId: "item_revolver", quantity: 1 },
      { itemId: "item_bandage", quantity: 1 },
      null,
      null,
      null,
      null,
    ],
  };
};

const createStarterWeaponState = (): WeaponState => {
  return {
    magazineAmmo: 6,
    isReloading: false,
    reloadRemainingMs: 0,
    fireCooldownRemainingMs: 0,
  };
};

state.players.set(request.entityId, {
  entityId: request.entityId,
  displayName: request.displayName,
  transform: { x: request.position.x, y: request.position.y, rotation: 0 },
  velocity: { x: 0, y: 0 },
  health: createDefaultHealth(),
  stamina: { current: staminaMax, max: staminaMax },
  inventory: createStarterInventory(),
  weaponState: createStarterWeaponState(),
  lastDamagedByEntityId: null,
});
```

Replicate it in `apps/server/src/sim/query.ts`:

```ts
return {
  entityId: player.entityId,
  displayName: player.displayName,
  transform: player.transform,
  velocity: player.velocity,
  stamina: player.stamina,
  inventory: player.inventory,
  weaponState: player.weaponState,
  lastProcessedInputSequence: state.lastProcessedInputSequence.get(player.entityId),
  health: player.health,
};
```

- [ ] **Step 4: Re-run the focused server tests**

Run:
- `pnpm --filter @2dayz/server test -- src/sim/query.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/combatSystem.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the starter-loadout work**

```bash
git add apps/server/src/sim/state.ts apps/server/src/sim/query.ts apps/server/src/sim/query.test.ts apps/server/src/sim/systems/combatSystem.test.ts
git commit -m "feat: spawn players with a replicated starter weapon"
```

## Task 4: Retune Authoritative Movement And Zombie Pressure For Aiming Mode

**Files:**
- Modify: `apps/server/src/sim/systems/movementSystem.ts`
- Modify: `apps/server/src/sim/systems/movementSystem.test.ts`
- Modify: `apps/server/src/sim/systems/zombieSystem.ts`
- Modify: `apps/server/src/sim/systems/zombieSystem.test.ts`
- Modify: `apps/server/src/content/defaultZombies.ts`

- [ ] **Step 1: Write the failing movement and zombie tests**

Add one movement test for aim-mode sprint suppression and one zombie test that locks down the compact-slice hearing reach.

```ts
it("does not apply sprint speed while the player is aiming", () => {
  const state = createRoomState({
    roomId: "room_test",
    config: createRoomSimulationConfig({ maxPlayerSpeed: 4, sprintSpeedMultiplier: 1.5 }),
  });

  queueSpawnPlayer(state, {
    entityId: "player_test-aim-walk",
    displayName: "Avery",
    position: { x: 0, y: 0 },
  });
  createLifecycleSystem().update(state, 0);

  queueInputIntent(state, "player_test-aim-walk", {
    sequence: 1,
    movement: { x: 1, y: 0 },
    aim: { x: 1, y: 0 },
    actions: { aiming: true, sprint: true },
  });

  createMovementSystem().update(state, 1);

  expect(state.players.get("player_test-aim-walk")?.velocity).toEqual({ x: 4, y: 0 });
});
```

```ts
it("ignores a shot that lands outside the compact hearing radius", () => {
  const state = createRoomState({ roomId: "room_test" });

  spawnPlayer(state, "player_far-shot", "Blair", { x: 15, y: 0 });
  state.zombies.set("zombie_compact-radius", {
    entityId: "zombie_compact-radius",
    archetypeId: "zombie_shambler",
    transform: { x: 0, y: 0, rotation: 0 },
    velocity: { x: 0, y: 0 },
    health: { current: 60, max: 60, isDead: false },
    state: "idle",
    aggroTargetEntityId: null,
    attackCooldownRemainingMs: 0,
    lostTargetMs: 0,
  });
  state.events.push({
    type: "shot",
    roomId: state.roomId,
    attackerEntityId: "player_far-shot",
    weaponItemId: "item_revolver",
    origin: { x: 15, y: 0 },
    aim: { x: 1, y: 0 },
  });

  createZombieSystem().update(state, 0.1);

  expect(state.zombies.get("zombie_compact-radius")?.state).toBe("idle");
});
```

- [ ] **Step 2: Run the focused authoritative-behavior tests to verify they fail**

Run:
- `pnpm --filter @2dayz/server test -- src/sim/systems/movementSystem.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/zombieSystem.test.ts`

Expected: FAIL because the movement system still allows sprint while aiming and the zombie hearing constants still match the larger top-down map.

- [ ] **Step 3: Implement the third-person authoritative tuning**

Update `apps/server/src/sim/systems/movementSystem.ts`, `apps/server/src/sim/systems/zombieSystem.ts`, and `apps/server/src/content/defaultZombies.ts`.

```ts
const aiming = Boolean(intent.actions.aiming);
const sprinting = Boolean(intent.actions.sprint) && !aiming && moving && player.stamina.current > 0;
const speed = sprinting
  ? state.config.maxPlayerSpeed * state.config.sprintSpeedMultiplier
  : state.config.maxPlayerSpeed;
```

```ts
const soundReachByType = {
  shot: 10,
  sprint: 5,
} as const;

const targetLossMs = 2_000;
```

```ts
export const defaultZombieArchetypes: ZombieArchetype[] = [
  {
    archetypeId: "zombie_shambler",
    name: "Shambler",
    maxHealth: 60,
    moveSpeed: 1.9,
    aggroRadius: 9,
    attackRange: 1.4,
    attackDamage: 12,
  },
  {
    archetypeId: "zombie_runner",
    name: "Runner",
    maxHealth: 45,
    moveSpeed: 2.8,
    aggroRadius: 11,
    attackRange: 1.2,
    attackDamage: 10,
  },
];
```

Keep the AI model small. Do not add new zombie states; retune the existing chase, search, and attack behavior for the compact encounter instead.

- [ ] **Step 4: Re-run the focused authoritative-behavior tests**

Run:
- `pnpm --filter @2dayz/server test -- src/sim/systems/movementSystem.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/zombieSystem.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the server tuning**

```bash
git add apps/server/src/sim/systems/movementSystem.ts apps/server/src/sim/systems/movementSystem.test.ts apps/server/src/sim/systems/zombieSystem.ts apps/server/src/sim/systems/zombieSystem.test.ts apps/server/src/content/defaultZombies.ts
git commit -m "feat: retune movement and zombies for third-person combat"
```

## Task 5: Add Pure Third-Person Math And Rebuild The Input Controller Around It

**Files:**
- Create: `apps/client/src/game/thirdPersonMath.ts`
- Create: `apps/client/src/game/thirdPersonMath.test.ts`
- Modify: `apps/client/src/game/input/inputController.ts`
- Modify: `apps/client/src/game/input/inputController.test.ts`

- [ ] **Step 1: Write the failing third-person math and input tests**

Create `apps/client/src/game/thirdPersonMath.test.ts` and extend `apps/client/src/game/input/inputController.test.ts` so the client proves camera-relative movement, projected aim, and chase-camera pose math.

```ts
import { describe, expect, it } from "vitest";

import { resolveCameraPose, resolveCameraRelativeMovement, resolveProjectedAim } from "./thirdPersonMath";

describe("thirdPersonMath", () => {
  it("converts WASD axes into ground-plane movement relative to camera yaw", () => {
    expect(resolveCameraRelativeMovement({ x: 0, y: -1 }, Math.PI / 2)).toEqual({ x: 0, y: 1 });
    expect(resolveCameraRelativeMovement({ x: 1, y: 0 }, 0)).toEqual({ x: 0, y: -1 });
  });

  it("projects camera look into a stable ground-plane aim vector", () => {
    expect(resolveProjectedAim({ yaw: 0, pitch: -0.4 })).toEqual({ x: 1, y: 0 });
  });

  it("tightens the chase camera while aiming without moving the look target", () => {
    const hipFirePose = resolveCameraPose({
      target: { rotation: 0, x: 10, y: 8 },
      yaw: 0.4,
      pitch: -0.35,
      isAiming: false,
    });
    const aimingPose = resolveCameraPose({
      target: { rotation: 0, x: 10, y: 8 },
      yaw: 0.4,
      pitch: -0.35,
      isAiming: true,
    });

    expect(aimingPose.distance).toBeLessThan(hipFirePose.distance);
    expect(aimingPose.lookAt).toEqual(hipFirePose.lookAt);
  });
});
```

Add a controller test like this:

```ts
it("uses pointer-lock look state to emit camera-relative movement and aiming", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const controller = createInputController({ element });

  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    value: element,
  });
  document.dispatchEvent(new Event("pointerlockchange"));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
  element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: 24, movementY: -8 }));
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));

  expect(controller.pollInput(1)).toEqual(
    expect.objectContaining({
      actions: expect.objectContaining({ aiming: true }),
      aim: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      movement: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    }),
  );

  controller.destroy();
});
```

- [ ] **Step 2: Run the focused client-input tests to verify they fail**

Run:
- `pnpm --filter @2dayz/client test -- src/game/thirdPersonMath.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/input/inputController.test.ts`

Expected: FAIL because the math helper file does not exist and the controller still uses screen-space cursor aim instead of pointer-lock look state.

- [ ] **Step 3: Implement the pure third-person math helper and new controller behavior**

Create `apps/client/src/game/thirdPersonMath.ts` and refactor `apps/client/src/game/input/inputController.ts` to use it.

```ts
const normalize = (vector: { x: number; y: number }) => {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return { x: vector.x / magnitude, y: vector.y / magnitude };
};

export const resolveCameraRelativeMovement = (movement: { x: number; y: number }, yaw: number) => {
  const forward = { x: Math.cos(yaw), y: Math.sin(yaw) };
  const right = { x: Math.cos(yaw - Math.PI / 2), y: Math.sin(yaw - Math.PI / 2) };

  return normalize({
    x: right.x * movement.x + forward.x * -movement.y,
    y: right.y * movement.x + forward.y * -movement.y,
  });
};

export const resolveProjectedAim = ({ yaw }: { yaw: number; pitch: number }) => {
  return { x: Math.cos(yaw), y: Math.sin(yaw) };
};

export const resolveCameraPose = ({
  target,
  yaw,
  pitch,
  isAiming,
}: {
  target: { x: number; y: number };
  yaw: number;
  pitch: number;
  isAiming: boolean;
}) => {
  const distance = isAiming ? 4.2 : 6.6;
  const height = isAiming ? 2.1 : 2.8;
  const shoulderOffset = isAiming ? 0.75 : 0.35;
  const lookAt = { x: target.x, y: 1.25, z: target.y };

  return {
    distance,
    lookAt,
    position: {
      x: target.x - Math.cos(yaw) * distance - Math.sin(yaw) * shoulderOffset,
      y: height - Math.sin(pitch) * 1.5,
      z: target.y - Math.sin(yaw) * distance + Math.cos(yaw) * shoulderOffset,
    },
  };
};
```

```ts
let yaw = 0;
let pitch = -0.35;
let isAiming = false;

const handleMouseMove = (event: MouseEvent) => {
  if (!canCaptureInput() || document.pointerLockElement !== element) {
    return;
  }

  yaw -= event.movementX * 0.0035;
  pitch = Math.max(-0.9, Math.min(-0.15, pitch - event.movementY * 0.0025));
};

const handlePointerLockChange = () => {
  if (document.pointerLockElement !== element) {
    isAiming = false;
  }
};

document.addEventListener("pointerlockchange", handlePointerLockChange);

const handleMouseDown = (event: MouseEvent) => {
  if (!canCaptureInput()) {
    return;
  }

  if (event.button === 2) {
    event.preventDefault();
    isAiming = true;
    element.requestPointerLock?.();
    return;
  }

  if (event.button === 0) {
    isFiring = true;
  }
};

const handleMouseUp = (event: MouseEvent) => {
  if (event.button === 2) {
    isAiming = false;
    document.exitPointerLock?.();
    return;
  }

  if (event.button === 0) {
    isFiring = false;
  }
};

getViewState() {
  return { isAiming, pitch, yaw };
},

const movement = resolveCameraRelativeMovement(rawMovement, yaw);
const aim = resolveProjectedAim({ yaw, pitch });
```

Keep `Tab`, `reload`, `interact`, and `reset()` behavior intact while swapping only the look and movement model.

- [ ] **Step 4: Re-run the focused client-input tests**

Run:
- `pnpm --filter @2dayz/client test -- src/game/thirdPersonMath.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/input/inputController.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the third-person input layer**

```bash
git add apps/client/src/game/thirdPersonMath.ts apps/client/src/game/thirdPersonMath.test.ts apps/client/src/game/input/inputController.ts apps/client/src/game/input/inputController.test.ts
git commit -m "feat: add third-person input controls"
```

## Task 6: Switch The Runtime To A Perspective Chase Camera

**Files:**
- Modify: `apps/client/src/game/createCamera.ts`
- Modify: `apps/client/src/game/createCamera.test.ts`
- Modify: `apps/client/src/game/render/renderFrame.ts`
- Modify: `apps/client/src/game/render/renderFrame.test.ts`
- Modify: `apps/client/src/game/boot.ts`
- Modify: `apps/client/src/game/boot.test.ts`

- [ ] **Step 1: Write the failing chase-camera tests**

Update `apps/client/src/game/createCamera.test.ts`, `apps/client/src/game/render/renderFrame.test.ts`, and `apps/client/src/game/boot.test.ts` so the runtime now expects a perspective chase camera and current look state.

```ts
it("creates a perspective camera for the third-person chase view", () => {
  const canvas = document.createElement("canvas");
  const { camera } = createCamera(canvas);

  expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
  expect((camera as THREE.PerspectiveCamera).fov).toBe(60);
  expect(camera.position.y).toBeGreaterThan(1);
});
```

```ts
expect(renderFrameMock).toHaveBeenCalledWith(
  expect.objectContaining({
    viewState: { isAiming: true, pitch: -0.35, yaw: 0.4 },
  }),
);
```

```ts
expect(camera.position.x).not.toBe(30);
expect(camera.position.y).toBeGreaterThan(2);
expect(camera.lookAt).toHaveBeenCalledWith(expect.any(Number), 1.25, expect.any(Number));
```

- [ ] **Step 2: Run the focused chase-camera tests to verify they fail**

Run:
- `pnpm --filter @2dayz/client test -- src/game/createCamera.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/renderFrame.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/boot.test.ts`

Expected: FAIL because the runtime still builds an orthographic camera and does not pass third-person look state through the frame loop.

- [ ] **Step 3: Implement the perspective chase-camera runtime**

Update `apps/client/src/game/createCamera.ts`, `apps/client/src/game/render/renderFrame.ts`, and `apps/client/src/game/boot.ts`.

```ts
export const createCamera = (canvas: HTMLCanvasElement) => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 120);
  camera.position.set(0, 4.5, 7.5);

  const resize = () => {
    const width = canvas.clientWidth || canvas.width || 960;
    const height = canvas.clientHeight || canvas.height || 540;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  resize();

  return { camera, resize };
};
```

```ts
const pose = resolveCameraPose({
  target: localTransform,
  yaw: viewState.yaw,
  pitch: viewState.pitch,
  isAiming: viewState.isAiming,
});

const chaseOffset = new THREE.Vector3(
  pose.position.x - pose.lookAt.x,
  pose.position.y - pose.lookAt.y,
  pose.position.z - pose.lookAt.z,
);
const chaseRay = new THREE.Raycaster(
  new THREE.Vector3(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z),
  chaseOffset.clone().normalize(),
  0.1,
  pose.distance,
);
const chaseHit = chaseRay.intersectObjects(scene.children, true)[0];
const resolvedPosition = chaseHit
  ? new THREE.Vector3()
      .copy(chaseRay.ray.origin)
      .add(chaseRay.ray.direction.clone().multiplyScalar(Math.max(1.2, chaseHit.distance - 0.25)))
  : new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z);

camera.position.set(resolvedPosition.x, resolvedPosition.y, resolvedPosition.z);
camera.lookAt(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
```

```ts
renderFrame({
  camera,
  combatEffectsView,
  deltaSeconds,
  entityViewStore,
  predictionController,
  renderer,
  scene,
  store,
  viewState: inputController.getViewState(),
});
```

Also swap `boot.ts` from `defaultTownMap` to `thirdPersonSliceMap` so the runtime and server talk about the same encounter layout.

- [ ] **Step 4: Re-run the focused chase-camera tests**

Run:
- `pnpm --filter @2dayz/client test -- src/game/createCamera.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/renderFrame.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/boot.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the chase-camera runtime**

```bash
git add apps/client/src/game/createCamera.ts apps/client/src/game/createCamera.test.ts apps/client/src/game/render/renderFrame.ts apps/client/src/game/render/renderFrame.test.ts apps/client/src/game/boot.ts apps/client/src/game/boot.test.ts
git commit -m "feat: switch the runtime to a chase camera"
```

## Task 7: Refresh The World, Lighting, And Actor Silhouettes For Third-Person Readability

**Files:**
- Modify: `apps/client/src/game/createRenderer.ts`
- Modify: `apps/client/src/game/createScene.ts`
- Modify: `apps/client/src/game/render/createWorldView.ts`
- Modify: `apps/client/src/game/render/createWorldView.test.ts`
- Modify: `apps/client/src/game/render/entityViewStore.ts`
- Modify: `apps/client/src/game/render/entityViewStore.test.ts`

- [ ] **Step 1: Write the failing presentation tests**

Update the world-view and entity-view tests to expect the new encounter landmarks and behind-the-player readability affordances.

```ts
it("builds the third-person encounter cover set from the new slice map", () => {
  const scene = new THREE.Scene();
  const worldView = createWorldView({ map: thirdPersonSliceMap, scene });

  expect(scene.getObjectByName("building:volume_central-truck")).toBeTruthy();
  expect(scene.getObjectByName("building:volume_east-shed")).toBeTruthy();

  worldView.dispose();

  expect(scene.getObjectByName("world:static")).toBeUndefined();
});
```

```ts
expect(scene.getObjectByName("entity:player_self")?.getObjectByName("survivor-weapon")).toBeTruthy();
expect(scene.getObjectByName("entity:zombie_1")?.getObjectByName("zombie-shoulders")).toBeTruthy();
```

- [ ] **Step 2: Run the focused presentation tests to verify they fail**

Run:
- `pnpm --filter @2dayz/client test -- src/game/render/createWorldView.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/entityViewStore.test.ts`

Expected: FAIL because the current world builder and actor meshes are still tuned for the top-down read.

- [ ] **Step 3: Implement the minimal presentation refresh**

Update renderer, scene, world view, and actor view code while keeping the abstractions already in the repo.

```ts
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

```ts
const hemi = new THREE.HemisphereLight("#9aa89a", "#283022", 1.2);
const sun = new THREE.DirectionalLight("#f3e7bf", 1.6);
sun.position.set(12, 24, 10);
sun.castShadow = true;
scene.add(hemi, sun);
scene.fog = new THREE.Fog("#1a1d17", 16, 44);
```

```ts
group.add(createPart({ depth: 0.9, height: 0.26, material: weaponMaterial, name: "survivor-weapon", width: 0.95, x: 0.38, y: 1.16, z: 0.34, rotationY: -0.18 }));
group.add(createPart({ depth: 0.8, height: 0.28, material: hunchMaterial, name: "zombie-shoulders", width: 0.92, y: 1.18, z: -0.04, rotationX: -0.22 }));
```

Keep this pass disciplined:
- no skeletal animation system
- no GLTF loaders yet
- no post-processing beyond basic renderer tone mapping
- only map-driven cover, stronger materials, and more legible silhouettes

- [ ] **Step 4: Re-run the focused presentation tests**

Run:
- `pnpm --filter @2dayz/client test -- src/game/render/createWorldView.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/render/entityViewStore.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the presentation refresh**

```bash
git add apps/client/src/game/createRenderer.ts apps/client/src/game/createScene.ts apps/client/src/game/render/createWorldView.ts apps/client/src/game/render/createWorldView.test.ts apps/client/src/game/render/entityViewStore.ts apps/client/src/game/render/entityViewStore.test.ts
git commit -m "feat: refresh the third-person world presentation"
```

## Task 8: Ship The Combat HUD, Clean Up The Joined Shell, And Re-Verify The Flow

**Files:**
- Modify: `apps/client/src/game/state/clientGameStore.ts`
- Modify: `apps/client/src/game/state/clientGameStore.test.ts`
- Create: `apps/client/src/game/ui/CombatHud.tsx`
- Create: `apps/client/src/game/ui/CombatHud.test.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/App.test.tsx`
- Modify: `apps/client/src/styles.css`
- Modify: `apps/client/e2e/join-and-spawn.spec.ts`
- Modify: `apps/client/e2e/reconnect-and-retry.spec.ts`
- Modify: `apps/client/e2e/client-performance.spec.ts`

- [ ] **Step 1: Write the failing store, HUD, and app-shell tests**

First, add a client-store regression test for replicated `weaponState`.

```ts
it("stores replicated weapon state from snapshots and deltas", () => {
  const store = createClientGameStore();

  store.completeJoin({
    displayName: "Survivor",
    playerEntityId: "player_self",
    roomId: "room_browser-v1",
  });

  store.applySnapshot({
    type: "snapshot",
    tick: 1,
    roomId: "room_browser-v1",
    playerEntityId: "player_self",
    players: [
      {
        entityId: "player_self",
        displayName: "Survivor",
        transform: { x: 0, y: 0, rotation: 0 },
        velocity: { x: 0, y: 0 },
        stamina: { current: 10, max: 10 },
        inventory: {
          ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
          equippedWeaponSlot: 0,
          slots: [{ itemId: "item_revolver", quantity: 1 }, null, null, null, null, null],
        },
        weaponState: {
          magazineAmmo: 6,
          isReloading: false,
          reloadRemainingMs: 0,
          fireCooldownRemainingMs: 0,
        },
      },
    ],
    loot: [],
    zombies: [],
  });

  expect(store.getState().weaponState).toMatchObject({ magazineAmmo: 6 });
});
```

Then create `apps/client/src/game/ui/CombatHud.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CombatHud } from "./CombatHud";

describe("CombatHud", () => {
  it("renders crosshair, health, and magazine or reserve ammo", () => {
    render(
      <CombatHud
        health={{ current: 86, isDead: false, max: 100 }}
        inventory={{
          ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 12 }],
          equippedWeaponSlot: 0,
          slots: [{ itemId: "item_revolver", quantity: 1 }, null, null, null, null, null],
        }}
        weaponState={{
          magazineAmmo: 5,
          isReloading: false,
          reloadRemainingMs: 0,
          fireCooldownRemainingMs: 0,
        }}
      />,
    );

    expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
    expect(screen.getByText(/health 86\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/ammo 5\/12/i)).toBeInTheDocument();
  });
});
```

Finally, update `apps/client/src/App.test.tsx` to assert the joined shell shows the combat HUD and no longer shows the quickbar or inventory button.

```tsx
await waitFor(() => {
  expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
});

expect(screen.queryByRole("button", { name: /quickbar slot 1/i })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: /open inventory/i })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused client-shell tests to verify they fail**

Run:
- `pnpm --filter @2dayz/client test -- src/game/state/clientGameStore.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/ui/CombatHud.test.tsx`
- `pnpm --filter @2dayz/client test -- src/App.test.tsx`

Expected: FAIL because the client store does not track `weaponState`, `CombatHud.tsx` does not exist, and the app still renders the old quickbar and inventory controls in joined state.

- [ ] **Step 3: Implement the client HUD state and joined-shell cleanup**

Update the client store and add the new combat HUD.

```ts
type ClientGameState = {
  connectionState: ConnectionState;
  health: Health | null;
  inventory: Inventory;
  isDead: boolean;
  isInventoryOpen: boolean;
  lastJoinDisplayName: string;
  latestTick: number | null;
  playerEntityId: string | null;
  roomId: string | null;
  stamina: Stamina | null;
  weaponState: WeaponState | null;
  worldEntities: WorldEntities;
};
```

```ts
health: selfPlayer?.health ?? current.health,
inventory: selfPlayer?.inventory ?? current.inventory,
stamina: selfPlayer?.stamina ?? current.stamina,
weaponState: selfPlayer?.weaponState ?? current.weaponState,
```

Create `apps/client/src/game/ui/CombatHud.tsx`:

```tsx
import type { Health, Inventory, WeaponState } from "@2dayz/shared";

export const CombatHud = ({
  health,
  inventory,
  weaponState,
}: {
  health: Health | null;
  inventory: Inventory;
  weaponState: WeaponState | null;
}) => {
  const reserveAmmo = inventory.ammoStacks.reduce((total, stack) => total + stack.quantity, 0);

  return (
    <>
      <div aria-hidden="true" className="combat-crosshair" />
      <section aria-label="combat hud" className="combat-hud">
        <p className="combat-chip">{`Health ${health ? `${health.current}/${health.max}` : "--"}`}</p>
        <p className="combat-chip">{`Ammo ${weaponState ? `${weaponState.magazineAmmo}/${reserveAmmo}` : `--/${reserveAmmo}`}`}</p>
      </section>
    </>
  );
};
```

Update `apps/client/src/App.tsx` so joined state renders `CombatHud` and no longer renders `Hud`:

```tsx
const [socketClient] = useState(() =>
  createSocketClient({
    mode: import.meta.env.DEV && import.meta.env.VITE_CLIENT_SOCKET_MODE === "mock" ? "mock" : "ws",
    protocolStore,
  }),
);
```

```tsx
<header className="hero-copy">
  <p className="eyebrow">Browser V2</p>
  <h1>2DayZ</h1>
  <p className="hero-body">Push through the yard, hold your nerve, and stay ahead of the infected.</p>
</header>
```

```tsx
{isConnected ? (
  <section className="game-shell" aria-label="game shell">
    <CombatHud health={state.health} inventory={state.inventory} weaponState={state.weaponState} />
  </section>
) : null}
```

Update `apps/client/src/styles.css` with fixed-position HUD styles rather than bottom-anchored inventory styling.

- [ ] **Step 4: Re-run the focused client-shell tests**

Run:
- `pnpm --filter @2dayz/client test -- src/game/state/clientGameStore.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/ui/CombatHud.test.tsx`
- `pnpm --filter @2dayz/client test -- src/App.test.tsx`

Expected: PASS

- [ ] **Step 5: Update the end-to-end selectors and run the flow checks**

Update the Playwright specs so they key off the new combat shell instead of the quickbar.

Use these selector helpers:

```ts
const combatHud = (page: import("@playwright/test").Page) => page.getByLabel("combat hud");
```

Replace quickbar assertions with:

```ts
await expect(combatHud(page)).toBeVisible();
await expect(page.getByRole("button", { name: /open inventory/i })).toHaveCount(0);
```

Run:
- `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts`
- `pnpm exec playwright test apps/client/e2e/reconnect-and-retry.spec.ts`
- `pnpm exec playwright test apps/client/e2e/client-performance.spec.ts`

Expected: PASS

- [ ] **Step 6: Run final lint, unit, and build verification**

Run:
- `pnpm lint`
- `pnpm test`
- `pnpm build`

Expected: PASS

- [ ] **Step 7: Commit the completed client shell**

```bash
git add apps/client/src/game/state/clientGameStore.ts apps/client/src/game/state/clientGameStore.test.ts apps/client/src/game/ui/CombatHud.tsx apps/client/src/game/ui/CombatHud.test.tsx apps/client/src/App.tsx apps/client/src/App.test.tsx apps/client/src/styles.css apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts
git commit -m "feat: ship the third-person combat shell"
```
