# 2D DayZ Browser Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first playable browser version of a Three.js-powered, isometric DayZ-inspired survival game with instant name-only join, session-based multiplayer, zombies, loot, combat, and quick respawn.

**Architecture:** Use a TypeScript monorepo with a browser client, an authoritative Node game server, and a shared contracts package. Keep gameplay rules on the server, use typed DTOs between client and server, and make map/content definitions data-driven so the first room-based version can evolve without a rewrite.

**Tech Stack:** TypeScript, pnpm workspaces, Vite, React, Three.js, Node.js, ws, Vitest, Playwright, Zod, ESLint

---

## Planned File Structure

### Workspace root

- Create: `package.json` - workspace scripts and shared dev dependencies
- Create: `pnpm-workspace.yaml` - workspace package discovery
- Create: `tsconfig.base.json` - shared TypeScript settings
- Create: `.gitignore` - Node, build, and local runtime outputs
- Create: `README.md` - local development and deployment notes
- Create: `vitest.workspace.ts` - root test orchestration
- Create: `playwright.config.ts` - browser flow verification
- Create: `.eslintrc.cjs` - lint rules for client, server, and shared code

### Shared package

- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/ids.ts`
- Create: `packages/shared/src/protocol/messages.ts`
- Create: `packages/shared/src/protocol/events.ts`
- Create: `packages/shared/src/protocol/schemas.ts`
- Create: `packages/shared/src/world/entities.ts`
- Create: `packages/shared/src/world/components.ts`
- Create: `packages/shared/src/world/rooms.ts`
- Create: `packages/shared/src/world/inventory.ts`
- Create: `packages/shared/src/content/items.ts`
- Create: `packages/shared/src/content/weapons.ts`
- Create: `packages/shared/src/content/zombies.ts`
- Create: `packages/shared/src/content/maps.ts`
- Create: `packages/shared/src/content/loot.ts`
- Create: `packages/shared/src/content/spawns.ts`
- Test: `packages/shared/src/**/*.test.ts`

### Server app

- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/config.ts`
- Create: `apps/server/src/http/createHttpServer.ts`
- Create: `apps/server/src/network/createSocketServer.ts`
- Create: `apps/server/src/network/sessionRegistry.ts`
- Create: `apps/server/src/network/messageRouter.ts`
- Create: `apps/server/src/rooms/roomManager.ts`
- Create: `apps/server/src/rooms/roomRuntime.ts`
- Create: `apps/server/src/rooms/roomFactory.ts`
- Create: `apps/server/src/rooms/respawn.ts`
- Create: `apps/server/src/rooms/reconnect.ts`
- Create: `apps/server/src/rooms/roomHealth.ts`
- Create: `apps/server/src/rooms/roomIsolation.ts`
- Create: `apps/server/src/sim/gameLoop.ts`
- Create: `apps/server/src/sim/state.ts`
- Create: `apps/server/src/sim/query.ts`
- Create: `apps/server/src/sim/systems/movementSystem.ts`
- Create: `apps/server/src/sim/systems/combatSystem.ts`
- Create: `apps/server/src/sim/systems/lootSystem.ts`
- Create: `apps/server/src/sim/systems/zombieSystem.ts`
- Create: `apps/server/src/sim/systems/replicationSystem.ts`
- Create: `apps/server/src/sim/systems/lifecycleSystem.ts`
- Create: `apps/server/src/sim/systems/inventorySystem.ts`
- Create: `apps/server/src/world/loadMapDefinition.ts`
- Create: `apps/server/src/world/collision.ts`
- Create: `apps/server/src/world/navigation.ts`
- Create: `apps/server/src/world/lineOfSight.ts`
- Create: `apps/server/src/content/defaultTownMap.ts`
- Create: `apps/server/src/content/defaultLootTable.ts`
- Create: `apps/server/src/content/defaultItems.ts`
- Create: `apps/server/src/content/defaultZombies.ts`
- Create: `apps/server/src/telemetry/logger.ts`
- Create: `apps/server/src/telemetry/metrics.ts`
- Test: `apps/server/src/**/*.test.ts`

### Client app

- Create: `apps/client/package.json`
- Create: `apps/client/tsconfig.json`
- Create: `apps/client/index.html`
- Create: `apps/client/vite.config.ts`
- Create: `apps/client/src/main.tsx`
- Create: `apps/client/src/App.tsx`
- Create: `apps/client/src/styles.css`
- Create: `apps/client/src/game/boot.ts`
- Create: `apps/client/src/game/GameCanvas.tsx`
- Create: `apps/client/src/game/createRenderer.ts`
- Create: `apps/client/src/game/createScene.ts`
- Create: `apps/client/src/game/createCamera.ts`
- Create: `apps/client/src/game/input/inputController.ts`
- Create: `apps/client/src/game/input/keymap.ts`
- Create: `apps/client/src/game/net/socketClient.ts`
- Create: `apps/client/src/game/net/protocolStore.ts`
- Create: `apps/client/src/game/state/clientGameStore.ts`
- Create: `apps/client/src/game/render/entityViewStore.ts`
- Create: `apps/client/src/game/render/renderFrame.ts`
- Create: `apps/client/src/game/render/prediction.ts`
- Create: `apps/client/src/game/render/interpolation.ts`
- Create: `apps/client/src/game/ui/JoinScreen.tsx`
- Create: `apps/client/src/game/ui/ControlsOverlay.tsx`
- Create: `apps/client/src/game/ui/Hud.tsx`
- Create: `apps/client/src/game/ui/InventoryPanel.tsx`
- Create: `apps/client/src/game/ui/DeathOverlay.tsx`
- Create: `apps/client/src/game/ui/ConnectionBanner.tsx`
- Create: `apps/client/src/game/ui/useSessionToken.ts`
- Test: `apps/client/src/**/*.test.tsx`
- Test: `apps/client/e2e/join-and-spawn.spec.ts`

## Task 1: Bootstrap The Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.eslintrc.cjs`
- Create: `vitest.workspace.ts`
- Create: `README.md`

- [ ] **Step 1: Write the failing workspace smoke test**

Create `package.json` scripts that reference `pnpm -r test`, `pnpm -r build`, and `pnpm -r lint` before the packages exist.

- [ ] **Step 2: Run the workspace test command to verify it fails**

Run: `pnpm test`
Expected: FAIL because workspace packages are not defined yet.

- [ ] **Step 3: Add the minimal workspace files**

Create root workspace files with `apps/*` and `packages/*` discovery, strict TypeScript defaults, Node ignore rules, and a short README that explains `pnpm install` and the expected package layout.

- [ ] **Step 4: Run lint/type entry checks**

Run: `pnpm lint`
Expected: FAIL only because package-level configs and sources are not created yet.

- [ ] **Step 5: Commit the workspace bootstrap**

Run:

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .eslintrc.cjs vitest.workspace.ts README.md
git commit -m "chore: bootstrap TypeScript workspace"
```

## Task 2: Create Shared Contracts And Content Schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/ids.ts`
- Create: `packages/shared/src/protocol/messages.ts`
- Create: `packages/shared/src/protocol/events.ts`
- Create: `packages/shared/src/protocol/schemas.ts`
- Create: `packages/shared/src/world/entities.ts`
- Create: `packages/shared/src/world/components.ts`
- Create: `packages/shared/src/world/rooms.ts`
- Create: `packages/shared/src/world/inventory.ts`
- Create: `packages/shared/src/content/items.ts`
- Create: `packages/shared/src/content/weapons.ts`
- Create: `packages/shared/src/content/zombies.ts`
- Create: `packages/shared/src/content/maps.ts`
- Create: `packages/shared/src/content/loot.ts`
- Create: `packages/shared/src/content/spawns.ts`
- Test: `packages/shared/src/protocol/schemas.test.ts`
- Test: `packages/shared/src/content/maps.test.ts`
- Test: `packages/shared/src/world/inventory.test.ts`

- [ ] **Step 1: Write the failing protocol schema test**

Add `packages/shared/src/protocol/schemas.test.ts` with checks that valid join, reconnect, input, snapshot, delta, and death payloads parse successfully and invalid payloads fail.

- [ ] **Step 2: Run the shared protocol test to verify it fails**

Run: `pnpm --filter @2dayz/shared test -- schemas.test.ts`
Expected: FAIL because the shared package and schemas do not exist.

- [ ] **Step 3: Write the failing map metadata test**

Add `packages/shared/src/content/maps.test.ts` asserting that a map definition must include collision volumes, zombie spawn zones, loot points, respawn points, and navigation data.

- [ ] **Step 4: Write the failing inventory contract test**

Add `packages/shared/src/world/inventory.test.ts` asserting a compact inventory shape, ammo stacks, item slots, pickup actions, and death-drop payloads are all represented by shared types and schemas.

- [ ] **Step 5: Implement the minimal shared package**

Create the shared package with Zod-backed schemas, exported TypeScript types, stable entity and room identifiers, and typed data shapes for items, weapons, zombies, loot, and map metadata.

- [ ] **Step 6: Run shared tests to verify they pass**

Run: `pnpm --filter @2dayz/shared test`
Expected: PASS

- [ ] **Step 7: Run shared typecheck**

Run: `pnpm --filter @2dayz/shared exec tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit the shared contracts**

```bash
git add packages/shared
git commit -m "feat: add shared game contracts"
```

## Task 3: Build The Server Skeleton And Room Lifecycle

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/config.ts`
- Create: `apps/server/src/http/createHttpServer.ts`
- Create: `apps/server/src/network/createSocketServer.ts`
- Create: `apps/server/src/network/sessionRegistry.ts`
- Create: `apps/server/src/network/messageRouter.ts`
- Create: `apps/server/src/rooms/roomManager.ts`
- Create: `apps/server/src/rooms/roomRuntime.ts`
- Create: `apps/server/src/rooms/roomFactory.ts`
- Create: `apps/server/src/rooms/reconnect.ts`
- Create: `apps/server/src/rooms/roomHealth.ts`
- Create: `apps/server/src/telemetry/logger.ts`
- Create: `apps/server/src/telemetry/metrics.ts`
- Test: `apps/server/src/rooms/roomManager.test.ts`
- Test: `apps/server/src/rooms/reconnect.test.ts`
- Test: `apps/server/src/rooms/roomHealth.test.ts`
- Test: `apps/server/src/rooms/roomIsolation.test.ts`

- [ ] **Step 1: Write the failing room assignment test**

Add `apps/server/src/rooms/roomManager.test.ts` covering: create first room on first join, place later players into a healthy room until capacity, create a new room after the cap is reached.

- [ ] **Step 2: Run the room assignment test to verify it fails**

Run: `pnpm --filter @2dayz/server test -- roomManager.test.ts`
Expected: FAIL because the server package and room manager do not exist.

- [ ] **Step 3: Write the failing reconnect test**

Add `apps/server/src/rooms/reconnect.test.ts` covering reclaim-window behavior, same token reclaim, expired token rejection, and duplicate name acceptance without identity collision.

- [ ] **Step 4: Write the failing unhealthy-room routing test**

Add `apps/server/src/rooms/roomHealth.test.ts` covering room health checks, join rejection from unhealthy rooms, rerouting to a healthy room, and room shutdown cleanup when a room fails.

- [ ] **Step 5: Write the failing room-isolation test**

Add `apps/server/src/rooms/roomIsolation.test.ts` covering an unexpected room runtime exception, isolation of the failed room, continued health responses from the server process, and uninterrupted updates from an unaffected room.

- [ ] **Step 6: Implement the minimal server package**

Create the server entry point, config, a health endpoint, WebSocket bootstrapping, a room manager, and a session registry that issues tokens and supports a fixed reclaim window.

- [ ] **Step 7: Run the room, reconnect, health, and isolation tests**

Run: `pnpm --filter @2dayz/server test -- roomManager.test.ts reconnect.test.ts roomHealth.test.ts roomIsolation.test.ts`
Expected: PASS

- [ ] **Step 8: Start the server and verify health and room boot**

Run: `pnpm --filter @2dayz/server dev`
Expected: `GET /health` returns `200` with process uptime and `rooms: 0`, and a WebSocket listener is available on the configured port.

- [ ] **Step 9: Commit the server skeleton**

```bash
git add apps/server
git commit -m "feat: add room lifecycle server skeleton"
```

## Task 4: Add Authoritative Simulation State And Movement

**Files:**
- Create: `apps/server/src/sim/gameLoop.ts`
- Create: `apps/server/src/sim/state.ts`
- Create: `apps/server/src/sim/query.ts`
- Create: `apps/server/src/sim/systems/movementSystem.ts`
- Create: `apps/server/src/sim/systems/lifecycleSystem.ts`
- Modify: `apps/server/src/rooms/roomRuntime.ts`
- Test: `apps/server/src/sim/systems/movementSystem.test.ts`
- Test: `apps/server/src/sim/gameLoop.test.ts`
- Test: `apps/server/src/sim/performanceBudget.test.ts`

- [ ] **Step 1: Write the failing movement validation test**

Add `apps/server/src/sim/systems/movementSystem.test.ts` covering normalized input, max speed clamping, blocked collision movement, and authoritative position correction.

- [ ] **Step 2: Run the movement test to verify it fails**

Run: `pnpm --filter @2dayz/server test -- movementSystem.test.ts`
Expected: FAIL because the simulation state and movement system do not exist.

- [ ] **Step 3: Write the failing fixed-tick loop test**

Add `apps/server/src/sim/gameLoop.test.ts` ensuring a room runtime steps systems in deterministic order and emits snapshots/deltas on tick.

- [ ] **Step 4: Write the failing performance-budget test**

Add `apps/server/src/sim/performanceBudget.test.ts` asserting room config enforces the initial 8-12 player cap, a fixed 20-30 Hz tick config, and explicit zombie and dropped-item caps per room.

- [ ] **Step 5: Implement the minimal simulation core**

Add ECS-lite room state, entity stores, tick scheduling, spawn/despawn lifecycle hooks, and an authoritative movement system that consumes typed input intents.

- [ ] **Step 6: Run the simulation tests**

Run: `pnpm --filter @2dayz/server test -- movementSystem.test.ts gameLoop.test.ts performanceBudget.test.ts`
Expected: PASS

- [ ] **Step 7: Run server typecheck**

Run: `pnpm --filter @2dayz/server exec tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit movement and simulation state**

```bash
git add apps/server/src/sim apps/server/src/rooms/roomRuntime.ts
git commit -m "feat: add authoritative room simulation"
```

## Task 5: Implement World Data, Collision, Spawns, And Zombie Navigation

**Files:**
- Create: `apps/server/src/world/loadMapDefinition.ts`
- Create: `apps/server/src/world/collision.ts`
- Create: `apps/server/src/world/navigation.ts`
- Create: `apps/server/src/world/lineOfSight.ts`
- Create: `apps/server/src/content/defaultTownMap.ts`
- Create: `apps/server/src/content/defaultLootTable.ts`
- Create: `apps/server/src/content/defaultItems.ts`
- Create: `apps/server/src/content/defaultZombies.ts`
- Test: `apps/server/src/world/loadMapDefinition.test.ts`
- Test: `apps/server/src/world/collision.test.ts`
- Test: `apps/server/src/world/navigation.test.ts`

- [ ] **Step 1: Write the failing map loader test**

Add `apps/server/src/world/loadMapDefinition.test.ts` to verify the default map loads typed metadata for respawn points, loot points, zombie zones, obstacles, and navigation links.

- [ ] **Step 2: Run the map loader test to verify it fails**

Run: `pnpm --filter @2dayz/server test -- loadMapDefinition.test.ts`
Expected: FAIL because no world loader exists.

- [ ] **Step 3: Write the failing collision and navigation tests**

Add tests for blocked movement against collision volumes and path selection across a waypoint graph for zombies.

- [ ] **Step 4: Implement the world layer**

Create the default town-plus-outskirts content set, map loader, collision helpers, line-of-sight checks, and simple zombie navigation graph utilities.

- [ ] **Step 5: Run the world tests**

Run: `pnpm --filter @2dayz/server test -- loadMapDefinition.test.ts collision.test.ts navigation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the world data layer**

```bash
git add apps/server/src/world apps/server/src/content
git commit -m "feat: add typed world and content data"
```

## Task 6: Implement Combat, Loot, Zombies, Death, And Respawn

**Files:**
- Create: `apps/server/src/rooms/respawn.ts`
- Create: `apps/server/src/sim/systems/combatSystem.ts`
- Create: `apps/server/src/sim/systems/inventorySystem.ts`
- Create: `apps/server/src/sim/systems/lootSystem.ts`
- Create: `apps/server/src/sim/systems/zombieSystem.ts`
- Modify: `apps/server/src/sim/state.ts`
- Modify: `apps/server/src/sim/gameLoop.ts`
- Modify: `apps/server/src/network/messageRouter.ts`
- Test: `apps/server/src/sim/systems/combatSystem.test.ts`
- Test: `apps/server/src/sim/systems/inventorySystem.test.ts`
- Test: `apps/server/src/sim/systems/lootSystem.test.ts`
- Test: `apps/server/src/sim/systems/zombieSystem.test.ts`
- Test: `apps/server/src/rooms/respawn.test.ts`

- [ ] **Step 1: Write the failing combat test**

Add `combatSystem.test.ts` covering authoritative hitscan validation, ammo consumption, reload timing, damage application, and rejection of invalid fire requests.

- [ ] **Step 2: Run the combat test to verify it fails**

Run: `pnpm --filter @2dayz/server test -- combatSystem.test.ts`
Expected: FAIL because combat logic does not exist.

- [ ] **Step 3: Write the failing zombie and loot tests**

Add tests for zombie aggro acquisition/loss, chase behavior, attack timing, loot spawning from typed points, and validated pickup ownership.

- [ ] **Step 4: Write the failing inventory test**

Add `inventorySystem.test.ts` covering compact inventory capacity, ammo stacking, pickup validation, reload ammo consumption, and death gear drop behavior.

- [ ] **Step 5: Write the failing respawn test**

Add `respawn.test.ts` covering fast respawn with gear loss, valid spawn selection, and continued room state after death.

- [ ] **Step 6: Implement the minimal gameplay systems**

Add firearm combat, compact inventory validation, reload timers, zombie detection/chase/attack/drop-aggro behavior, room loot population, validated pickups, death events, dropped gear handling, and quick respawn into the live room.

- [ ] **Step 7: Run the gameplay system tests**

Run: `pnpm --filter @2dayz/server test -- combatSystem.test.ts inventorySystem.test.ts lootSystem.test.ts zombieSystem.test.ts respawn.test.ts`
Expected: PASS

- [ ] **Step 8: Run the full server test suite**

Run: `pnpm --filter @2dayz/server test`
Expected: PASS

- [ ] **Step 9: Commit the core gameplay systems**

```bash
git add apps/server/src/rooms/respawn.ts apps/server/src/sim
git commit -m "feat: add core survival gameplay systems"
```

## Task 7: Add Replication, Snapshots, And Server Telemetry

**Files:**
- Create: `apps/server/src/sim/systems/replicationSystem.ts`
- Modify: `apps/server/src/network/messageRouter.ts`
- Modify: `apps/server/src/network/createSocketServer.ts`
- Modify: `apps/server/src/telemetry/logger.ts`
- Modify: `apps/server/src/telemetry/metrics.ts`
- Test: `apps/server/src/sim/systems/replicationSystem.test.ts`
- Test: `apps/server/src/network/messageRouter.test.ts`

- [ ] **Step 1: Write the failing replication test**

Add `replicationSystem.test.ts` covering initial room snapshot, per-tick deltas, death/combat event emission, and capped payload shape for nearby entities.

- [ ] **Step 2: Run the replication test to verify it fails**

Run: `pnpm --filter @2dayz/server test -- replicationSystem.test.ts`
Expected: FAIL because no replication layer exists.

- [ ] **Step 3: Write the failing message router test**

Add `messageRouter.test.ts` covering typed join, reconnect, movement, fire, reload, interact, and invalid message rejection.

- [ ] **Step 4: Implement the replication and routing layer**

Emit typed snapshots and deltas, route validated client intents into room state, and track room/player/tick metrics for observability.

- [ ] **Step 5: Run the replication and router tests**

Run: `pnpm --filter @2dayz/server test -- replicationSystem.test.ts messageRouter.test.ts`
Expected: PASS

- [ ] **Step 6: Manually verify telemetry output**

Run: `pnpm --filter @2dayz/server dev`
Expected: room count, player count, tick timing, and disconnect reasons are logged or exposed.

- [ ] **Step 7: Commit replication and telemetry**

```bash
git add apps/server/src/network apps/server/src/sim/systems/replicationSystem.ts apps/server/src/telemetry
git commit -m "feat: add real-time replication and metrics"
```

## Task 8: Build The Client Join Flow And Socket Integration

**Files:**
- Create: `apps/client/package.json`
- Create: `apps/client/tsconfig.json`
- Create: `apps/client/index.html`
- Create: `apps/client/vite.config.ts`
- Create: `apps/client/src/main.tsx`
- Create: `apps/client/src/App.tsx`
- Create: `apps/client/src/styles.css`
- Create: `apps/client/src/game/net/socketClient.ts`
- Create: `apps/client/src/game/net/protocolStore.ts`
- Create: `apps/client/src/game/state/clientGameStore.ts`
- Create: `apps/client/src/game/ui/JoinScreen.tsx`
- Create: `apps/client/src/game/ui/ControlsOverlay.tsx`
- Create: `apps/client/src/game/ui/Hud.tsx`
- Create: `apps/client/src/game/ui/InventoryPanel.tsx`
- Create: `apps/client/src/game/ui/DeathOverlay.tsx`
- Create: `apps/client/src/game/ui/ConnectionBanner.tsx`
- Create: `apps/client/src/game/ui/useSessionToken.ts`
- Test: `apps/client/src/game/ui/JoinScreen.test.tsx`
- Test: `apps/client/src/game/ui/ControlsOverlay.test.tsx`
- Test: `apps/client/src/game/ui/ConnectionBanner.test.tsx`
- Test: `apps/client/src/game/ui/InventoryPanel.test.tsx`

- [ ] **Step 1: Write the failing join screen test**

Add `JoinScreen.test.tsx` covering required display name input, join button enablement, and submission to the socket client.

- [ ] **Step 2: Run the join screen test to verify it fails**

Run: `pnpm --filter @2dayz/client test -- JoinScreen.test.tsx`
Expected: FAIL because the client package and join UI do not exist.

- [ ] **Step 3: Write the failing controls overlay test**

Add `ControlsOverlay.test.tsx` covering first-join display, current-browser-session dismissal, and listed controls.

- [ ] **Step 4: Write the failing join-failure and reconnect banner test**

Add `ConnectionBanner.test.tsx` covering retryable join failure UI, reconnect-in-progress UI, and unhealthy-room retry messaging.

- [ ] **Step 5: Write the failing inventory panel test**

Add `InventoryPanel.test.tsx` covering compact inventory rendering, ammo counts, and open/close behavior from client state.

- [ ] **Step 6: Implement the minimal React shell**

Create the Vite client, UI shell, session-token local storage hook, socket client, and state store for join, reconnect, connection failure, and compact inventory UI state.

- [ ] **Step 7: Run the client UI tests**

Run: `pnpm --filter @2dayz/client test -- JoinScreen.test.tsx ControlsOverlay.test.tsx ConnectionBanner.test.tsx InventoryPanel.test.tsx`
Expected: PASS

- [ ] **Step 8: Start the client and verify the landing flow**

Run: `pnpm --filter @2dayz/client dev`
Expected: name-only join screen renders, the controls overlay appears before game entry, and simulated join failure shows a retryable banner.

- [ ] **Step 9: Commit the client shell**

```bash
git add apps/client
git commit -m "feat: add browser join flow and socket client"
```

## Task 9: Render The World With Three.js And Sync It To Server State

**Files:**
- Create: `apps/client/src/game/boot.ts`
- Create: `apps/client/src/game/GameCanvas.tsx`
- Create: `apps/client/src/game/createRenderer.ts`
- Create: `apps/client/src/game/createScene.ts`
- Create: `apps/client/src/game/createCamera.ts`
- Create: `apps/client/src/game/input/inputController.ts`
- Create: `apps/client/src/game/input/keymap.ts`
- Create: `apps/client/src/game/render/entityViewStore.ts`
- Create: `apps/client/src/game/render/renderFrame.ts`
- Create: `apps/client/src/game/render/prediction.ts`
- Create: `apps/client/src/game/render/interpolation.ts`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/game/state/clientGameStore.ts`
- Test: `apps/client/src/game/input/inputController.test.ts`
- Test: `apps/client/src/game/render/interpolation.test.ts`
- Test: `apps/client/src/game/render/prediction.test.ts`
- Test: `apps/client/src/game/state/clientGameStore.test.ts`

- [ ] **Step 1: Write the failing input controller test**

Add `inputController.test.ts` covering `WASD` movement vectors, mouse aim vector updates, fire input, reload input, and interact input.

- [ ] **Step 2: Run the input test to verify it fails**

Run: `pnpm --filter @2dayz/client test -- inputController.test.ts`
Expected: FAIL because the game runtime does not exist.

- [ ] **Step 3: Write the failing interpolation and prediction tests**

Add tests proving remote entity interpolation smooths snapshots and local prediction can reconcile to authoritative movement without losing the latest input.

- [ ] **Step 4: Write the failing client state sync test**

Add `clientGameStore.test.ts` covering snapshot ingestion, delta application, death overlay state, and inventory panel state updates from replicated server payloads.

- [ ] **Step 5: Implement the Three.js runtime**

Create the renderer, fixed isometric camera, simple low-poly placeholder scene, entity view store, local prediction, remote interpolation, and the in-game HUD mounted above the canvas.

- [ ] **Step 6: Run the client game runtime tests**

Run: `pnpm --filter @2dayz/client test -- inputController.test.ts interpolation.test.ts prediction.test.ts clientGameStore.test.ts`
Expected: PASS

- [ ] **Step 7: Verify local rendering and HUD state**

Run: `pnpm --filter @2dayz/client dev`
Expected: the canvas renders the world, accepts input, displays health/ammo/inventory state from mocked snapshots, and reflects replicated entities.

- [ ] **Step 8: Commit the Three.js client runtime**

```bash
git add apps/client/src/game apps/client/src/App.tsx
git commit -m "feat: render replicated game world in Three.js"
```

## Task 10: Add End-To-End Verification And Delivery Scripts

**Files:**
- Create: `apps/client/e2e/join-and-spawn.spec.ts`
- Create: `apps/client/e2e/reconnect-and-retry.spec.ts`
- Create: `apps/client/e2e/client-performance.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `apps/server/src/http/createHttpServer.ts`

- [ ] **Step 1: Write the failing end-to-end browser flow test**

Add `apps/client/e2e/join-and-spawn.spec.ts` covering: open landing page, enter display name, accept controls overlay, connect to the server, and reach an in-game HUD state.

- [ ] **Step 2: Write the failing reconnect and retry flow test**

Add `apps/client/e2e/reconnect-and-retry.spec.ts` covering reconnect inside the reclaim window, expired-token fallback to a fresh run, and retryable join failure messaging.

- [ ] **Step 3: Write the failing client performance smoke test**

Add `apps/client/e2e/client-performance.spec.ts` covering a connected in-game render session with an assertion that average frame time stays within a 60 fps target on the local reference environment, with the test reporting when the threshold is missed rather than silently passing.

- [ ] **Step 4: Run the end-to-end tests to verify they fail**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts`
Expected: FAIL until the client and server dev workflow is wired together.

- [ ] **Step 5: Add the minimal delivery scripts**

Wire root scripts for `dev:client`, `dev:server`, `build`, `test`, and `e2e`, plus any lightweight health/proxy behavior needed for local verification.

- [ ] **Step 6: Add measurable smoke verification commands**

Document and script smoke checks with exact commands and pass/fail thresholds:

- `pnpm verify:health` -> `curl` the server health endpoint and assert `200`
- `pnpm verify:room-cap` -> open enough synthetic joins to prove a room stops at the configured cap and new players are routed to a new room
- `pnpm verify:join-time` -> assert median landing-to-spawn time stays under 10 seconds in local healthy conditions
- `pnpm verify:reconnect-time` -> assert reconnect inside the reclaim window completes in under 5 seconds in local healthy conditions
- `pnpm verify:tick-rate` -> assert configured tick stays in the 20-30 Hz target range
- `pnpm verify:room-isolation` -> force one room runtime to crash and assert the process stays healthy while another room remains playable

- [ ] **Step 7: Update the README with exact local run steps**

Document how to install dependencies, run the client and server, execute tests, and verify the initial join flow.

- [ ] **Step 8: Run the full verification suite**

Run: `pnpm lint && pnpm test && pnpm exec playwright test && pnpm verify:health && pnpm verify:room-cap && pnpm verify:join-time && pnpm verify:reconnect-time && pnpm verify:tick-rate && pnpm verify:room-isolation`
Expected: PASS

- [ ] **Step 9: Build both apps**

Run: `pnpm build`
Expected: PASS with a production client bundle and a production server build.

- [ ] **Step 10: Commit the verification and delivery setup**

```bash
git add package.json README.md playwright.config.ts apps/client/e2e apps/server/src/http/createHttpServer.ts
git commit -m "chore: add end-to-end verification and delivery scripts"
```

## Implementation Notes

- Prefer small modules with one clear responsibility over large catch-all files.
- Keep render-only concerns out of authoritative server logic.
- Do not introduce accounts, persistence backends, melee, or advanced survival systems during the first pass.
- Keep reconnect identity token-based and short-lived; do not treat display names as identity.
- Use placeholder low-poly content first, but keep all item, zombie, loot, and map data driven.
- If a task reveals that one file is growing too fast, split it before adding more systems.

## Verification Checklist

- Shared protocol types are imported by both apps without duplication.
- A player can join with only a display name.
- Controls overlay appears briefly before gameplay.
- Client sends typed input intents over WebSocket.
- Server owns movement, combat, loot, zombies, death, and respawn.
- Server owns compact inventory state, pickup validation, reload ammo consumption, and death gear loss.
- Room state survives disconnect/reconnect inside the reclaim window.
- Room routing avoids unhealthy rooms and exposes retryable failure UX.
- Zombies, loot, and collisions come from typed content data.
- Initial room size cap, tick config, and entity budgets are enforced in code and tests.
- Reconnect inside the reclaim window is verified against the under-5-second target.
- A client performance smoke check exists for the 60 fps render target on the reference local environment.
- A forced room crash is contained without taking down the whole server process.
- Local movement feels responsive through prediction and correction.
- Remote entities render smoothly through interpolation.
- Full lint, unit test, and end-to-end verification passes.
