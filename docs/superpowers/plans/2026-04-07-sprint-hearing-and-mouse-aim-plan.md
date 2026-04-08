# Sprint, Hearing, And Mouse Aim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shift-to-sprint movement with inventory-scaled stamina, preserve authoritative mouse-aim shooting, and let zombies investigate or chase players based on sprint and gunshot noise.

**Architecture:** Extend the existing shared input schema and authoritative server simulation instead of adding parallel client-only systems. Keep shot direction on the current `aim` vector path, add stamina/load logic directly to player simulation and movement, and layer zombie hearing/search on top of the existing line-of-sight aggro and navigation helpers.

**Tech Stack:** TypeScript, React, Three.js, Vitest, Testing Library, pnpm

---

## Worktree Context

Before execution, create or switch to a dedicated worktree with `superpowers:using-git-worktrees`. Run all commands from that worktree root. If execution must stay in the current checkout, do not disturb unrelated user changes already present in the worktree.

Use `superpowers:test-driven-development` for each code task below and `superpowers:verification-before-completion` before claiming the feature is done.

## Planned File Changes

- Modify: `packages/shared/src/protocol/messages.ts` - add `actions.sprint` to the shared authoritative input schema.
- Modify: `apps/client/src/game/input/keymap.ts` - define the `Shift` sprint binding alongside the existing action keys.
- Modify: `apps/client/src/game/input/inputController.ts` - capture held sprint state and include it in outgoing input payloads.
- Modify: `apps/client/src/game/input/inputController.test.ts` - cover sprint key capture and release without breaking existing fire/reload/interact behavior.
- Modify: `apps/server/src/sim/state.ts` - add player stamina state, optional sprint/hearing config knobs, and zombie heard-position/search bookkeeping.
- Modify: `apps/server/src/sim/performanceBudget.test.ts` - lock down any new positive config defaults added to simulation config.
- Modify: `apps/server/src/sim/systems/movementSystem.ts` - apply sprint speed, drain/regenerate stamina, and recompute stamina max from current inventory load.
- Modify: `apps/server/src/sim/systems/movementSystem.test.ts` - prove sprint speed, stamina drain/recovery, load scaling, and walk fallback at zero stamina.
- Modify: `apps/server/src/sim/query.ts` - include any new replicated player stamina fields if implementation chooses to surface them later; otherwise leave unchanged.
- Modify: `apps/server/src/sim/systems/combatSystem.test.ts` - add regression coverage that shot events continue to use the current authoritative `aim` vector and still reject zero-aim fire.
- Modify: `apps/server/src/sim/systems/zombieSystem.ts` - add hearing-based search/chase behavior on top of the current sight/pathing logic.
- Modify: `apps/server/src/sim/systems/zombieSystem.test.ts` - cover shot-hearing search, sight-upgraded chase, sprint-hearing investigation, and search exit behavior.
- Modify: `apps/server/src/rooms/roomRuntime.ts` - keep system ordering correct if zombie hearing relies on shot events emitted earlier in the tick.

## Task 1: Extend Authoritative Input With Sprint

**Files:**
- Modify: `packages/shared/src/protocol/messages.ts`
- Modify: `apps/client/src/game/input/keymap.ts`
- Modify: `apps/client/src/game/input/inputController.ts`
- Modify: `apps/client/src/game/input/inputController.test.ts`

- [ ] **Step 1: Write the failing sprint-input test**

Update `apps/client/src/game/input/inputController.test.ts` with a focused case that presses `Shift`, polls once while held, releases `Shift`, and polls again.

```ts
it("emits sprint while shift is held and clears it on release", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const controller = createInputController({ element });

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
  expect(controller.pollInput(1)).toEqual(
    expect.objectContaining({
      actions: { sprint: true },
      movement: { x: 0, y: 0 },
    }),
  );

  window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
  expect(controller.pollInput(2)).toEqual(
    expect.objectContaining({
      actions: {},
    }),
  );

  controller.destroy();
});
```

Also extend the existing happy-path input test so the combined action payload includes `sprint: true` when `Shift` is held with movement and fire.

- [ ] **Step 2: Run the client input test to verify it fails**

Run: `pnpm --filter @2dayz/client test -- src/game/input/inputController.test.ts`

Expected: FAIL because `actions.sprint` is not allowed by the shared input schema and the input controller does not emit it.

- [ ] **Step 3: Implement the smallest shared-input sprint path**

Make these minimal code changes:

- In `packages/shared/src/protocol/messages.ts`, add `sprint: z.boolean().optional()` inside `inputMessageSchema.actions`.
- In `apps/client/src/game/input/keymap.ts`, add `sprint: ["shift"]` to `ACTION_KEYS`.
- In `apps/client/src/game/input/inputController.ts`, latch sprint from held keys and include it in `pollInput()` the same way fire is emitted while held.

Keep sprint as a held action, not a queued action, so it behaves like fire and does not introduce toggle state.

```ts
const isSprinting = ACTION_KEYS.sprint.some((key) => pressedKeys.has(key));

const nextInput = inputMessageSchema.parse({
  actions: {
    ...(isFiring ? { fire: true } : {}),
    ...(isSprinting ? { sprint: true } : {}),
    ...(queuedActions.interact ? { interact: true } : {}),
    ...(queuedActions.reload ? { reload: true } : {}),
  },
  aim,
  movement,
  sequence,
  type: "input",
});
```

- [ ] **Step 4: Re-run the client input test**

Run: `pnpm --filter @2dayz/client test -- src/game/input/inputController.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the sprint input path**

```bash
git add packages/shared/src/protocol/messages.ts apps/client/src/game/input/keymap.ts apps/client/src/game/input/inputController.ts apps/client/src/game/input/inputController.test.ts
git commit -m "feat: add sprint input to the control path"
```

## Task 2: Add Player Stamina State And Inventory-Scaled Sprinting

**Files:**
- Modify: `apps/server/src/sim/state.ts`
- Modify: `apps/server/src/sim/performanceBudget.test.ts`
- Modify: `apps/server/src/sim/systems/movementSystem.ts`
- Modify: `apps/server/src/sim/systems/movementSystem.test.ts`

- [ ] **Step 1: Write the failing movement/stamina tests**

Extend `apps/server/src/sim/systems/movementSystem.test.ts` with focused cases for:

- sprint moves faster than base walking speed
- sprint drains stamina only while moving
- stamina regenerates while not sprinting
- heavier inventory reduces max stamina
- current stamina clamps down when inventory load increases
- zero stamina falls back to normal walking speed

Use small isolated fixtures, for example:

```ts
it("moves faster while sprinting when stamina is available", () => {
  const state = createRoomState({
    roomId: "room_test",
    config: createRoomSimulationConfig({ maxPlayerSpeed: 4 }),
  });

  queueSpawnPlayer(state, {
    entityId: "player_test-sprint",
    displayName: "Avery",
    position: { x: 0, y: 0 },
  });
  createLifecycleSystem().update(state, 0);

  queueInputIntent(state, "player_test-sprint", {
    sequence: 1,
    movement: { x: 1, y: 0 },
    aim: { x: 1, y: 0 },
    actions: { sprint: true },
  });

  createMovementSystem().update(state, 1);

  expect(state.players.get("player_test-sprint")?.transform.x).toBeGreaterThan(4);
});
```

Add one test that mutates inventory after spawn to prove the stamina max calculation responds to current carried items, not only the spawn loadout.

- [ ] **Step 2: Run the focused server movement tests to verify they fail**

Run: `pnpm --filter @2dayz/server test -- src/sim/systems/movementSystem.test.ts`

Expected: FAIL because players do not yet have stamina state, sprint is ignored, and inventory load does not influence movement.

- [ ] **Step 3: Add the minimal stamina and sprint implementation**

Update `apps/server/src/sim/state.ts` first:

- add a `stamina` object to `SimPlayer` with at least `current` and `max`
- add positive config defaults for sprint speed and stamina tuning
- initialize stamina in `spawnPlayerNow()`

Suggested shape:

```ts
export type StaminaState = {
  current: number;
  max: number;
};

export type SimPlayer = {
  // existing fields...
  stamina: StaminaState;
};
```

Then update `apps/server/src/sim/systems/movementSystem.ts` to:

- compute inventory load from occupied slots and stack quantities already present in `inventory`
- map that load to a clamped stamina max
- clamp `player.stamina.current` down to the recalculated max
- treat sprint as active only when `intent.actions.sprint`, movement magnitude is non-zero, and stamina is above zero
- use sprint speed only when sprint is active
- drain stamina while sprinting and moving
- regenerate stamina otherwise

Keep the load heuristic intentionally simple and deterministic. A good starting rule for the plan is:

- each occupied inventory slot adds `1` load
- each ammo stack contributes a small fractional load from quantity, for example `quantity / 30`
- each point of load subtracts a fixed amount from baseline stamina, clamped to a floor so normal loadouts still allow some sprinting

Use helper functions inside `movementSystem.ts` if needed, but keep them local to the file unless reuse becomes obvious.

- [ ] **Step 4: Update the config-budget test and re-run movement coverage**

First update `apps/server/src/sim/performanceBudget.test.ts` to assert any new positive config defaults you add, for example sprint speed or baseline stamina values.

Then run:

- `pnpm --filter @2dayz/server test -- src/sim/performanceBudget.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/movementSystem.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the stamina-backed sprint implementation**

```bash
git add apps/server/src/sim/state.ts apps/server/src/sim/performanceBudget.test.ts apps/server/src/sim/systems/movementSystem.ts apps/server/src/sim/systems/movementSystem.test.ts
git commit -m "feat: add stamina-based sprinting"
```

## Task 3: Lock Down Mouse-Aim Shooting As A Regression

**Files:**
- Modify: `apps/server/src/sim/systems/combatSystem.test.ts`

- [ ] **Step 1: Write the failing combat regression tests**

Add two focused cases in `apps/server/src/sim/systems/combatSystem.test.ts`:

- one that fires with a non-axis-aligned `aim` vector and asserts the authoritative `shot` event preserves that exact direction
- one that sends `actions.fire: true` with `aim: { x: 0, y: 0 }` and asserts no `shot` event is emitted and no ammo is consumed

```ts
it("emits the current authoritative aim vector on shot events", () => {
  const state = createRoomState({ roomId: "room_test" });
  const attacker = spawnPlayer(state, "player_test-aim-1", "Avery", 0, 0);

  queueInputIntent(state, attacker.entityId, {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 12, y: -4 },
    actions: { fire: true },
  });

  createCombatSystem().update(state, 0.1);

  expect(state.events).toContainEqual(
    expect.objectContaining({
      type: "shot",
      aim: { x: 12, y: -4 },
    }),
  );
});

it("does not emit a shot event or consume ammo when fire input has zero aim", () => {
  const state = createRoomState({ roomId: "room_test" });
  const attacker = spawnPlayer(state, "player_test-aim-2", "Blair", 0, 0);

  queueInputIntent(state, attacker.entityId, {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    actions: { fire: true },
  });

  createCombatSystem().update(state, 0.1);

  expect(attacker.weaponState.magazineAmmo).toBe(6);
  expect(state.events).toEqual([]);
});
```

This is a regression-protection task, so keep it narrow and do not invent new combat behavior.

- [ ] **Step 2: Run the combat test file**

Run: `pnpm --filter @2dayz/server test -- src/sim/systems/combatSystem.test.ts`

Expected: PASS if the existing authoritative path already behaves correctly. If it passes immediately, keep the new test as the regression guard and move on without changing implementation.

- [ ] **Step 3: Only make code changes if the new regression test exposed a real bug**

If the new test fails, fix the smallest possible bug in the authoritative aim path inside `apps/server/src/sim/systems/combatSystem.ts`. Otherwise, do not modify implementation code.

- [ ] **Step 4: Re-run the combat tests**

Run: `pnpm --filter @2dayz/server test -- src/sim/systems/combatSystem.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the combat regression coverage**

```bash
git add apps/server/src/sim/systems/combatSystem.test.ts apps/server/src/sim/systems/combatSystem.ts
git commit -m "test: lock down authoritative mouse aim shots"
```

If no implementation file changed, omit `apps/server/src/sim/systems/combatSystem.ts` from `git add`.

## Task 4: Add Zombie Hearing And Search Behavior

**Files:**
- Modify: `apps/server/src/sim/state.ts`
- Modify: `apps/server/src/sim/systems/zombieSystem.ts`
- Modify: `apps/server/src/sim/systems/zombieSystem.test.ts`
- Modify: `apps/server/src/sim/systems/movementSystem.ts`
- Modify: `apps/server/src/rooms/roomRuntime.ts`

- [ ] **Step 1: Write the failing zombie-hearing tests**

Extend `apps/server/src/sim/systems/zombieSystem.test.ts` with focused scenarios for:

- hearing a gunshot without line of sight -> zombie enters `searching` and moves toward the shot origin
- hearing a gunshot with line of sight -> zombie sets `aggroTargetEntityId` and enters `chasing`
- hearing sprint noise without line of sight -> zombie investigates the last heard player position
- reaching the heard position without reacquiring -> zombie returns to roaming or idle

Use the existing blocker/pathing test style to make sight vs hearing deterministic. For the shot-hearing test, seed a `shot` event into `state.events` before `createZombieSystem().update(...)` runs.

```ts
state.events.push({
  type: "shot",
  roomId: state.roomId,
  attackerEntityId: player.entityId,
  weaponItemId: "item_revolver",
  origin: { x: player.transform.x, y: player.transform.y },
  aim: { x: 1, y: 0 },
});
```

For sprint hearing, queue an input intent with `actions: { sprint: true }` and non-zero movement on the player before the zombie update.

Because the real runtime runs `movement` before `zombie` and `movementSystem` consumes input intents, also add or update at least one integration-style test that runs the same tick order as `roomRuntime` and proves sprint hearing survives after movement processing.

- [ ] **Step 2: Run the zombie-system tests to verify they fail**

Run: `pnpm --filter @2dayz/server test -- src/sim/systems/zombieSystem.test.ts`

Expected: FAIL because zombies currently only acquire targets through line of sight and do not remember heard positions.

- [ ] **Step 3: Implement the minimal hearing/search state**

First extend `apps/server/src/sim/state.ts` so `SimZombie` can remember hearing context, for example:

```ts
export type SimZombie = {
  // existing fields...
  heardTargetEntityId: string | null;
  heardPosition: Vector2 | null;
};
```

Then update `apps/server/src/sim/systems/zombieSystem.ts` to:

- scan `state.events` for `shot` events during the current tick
- consume an explicit sprint-noise signal that survives until zombie update in the real tick order
- use hearing radii from config or local constants
- choose the nearest valid sound when multiple are in range so behavior stays deterministic
- if the heard player is visible, set `aggroTargetEntityId` and chase immediately
- if not visible, store the heard position, set state to `searching`, and path toward that position
- while searching, upgrade to `chasing` when line of sight is gained
- clear heard-position state when the zombie reaches that location without reacquiring

Keep the implementation inside the zombie system unless a helper is clearly reused. Reuse `moveZombieTowardTarget()` for both chasing and searching so pathing stays consistent.

Make the sprint-noise handoff explicit in server state instead of relying on live input intents after movement. The smallest acceptable implementation is:

- add a transient per-tick sprint-noise collection to `RoomSimulationState`, for example `sprintNoiseEvents: Array<{ playerEntityId: string; position: Vector2 }>`
- clear it in `clearTransientSimulationState()`
- have `movementSystem` push one entry when sprint is active and movement is non-zero
- have `zombieSystem` consume that collection during its update

This matches the real room tick order and avoids a test-only implementation.

Treat sprint noise refresh as a coarse periodic stimulus derived from the current tick, not a permanent omniscient lock. One sprint-noise sample per movement update is enough for this version.

- [ ] **Step 4: Verify system ordering and re-run the zombie tests**

Check `apps/server/src/rooms/roomRuntime.ts` after the implementation. The current order runs `combat` before `movement` before `zombie`, which is likely correct because it lets zombies hear `shot` events in the same tick. Only change ordering if your implementation reveals a real sequencing bug.

Then run:

- `pnpm --filter @2dayz/server test -- src/sim/systems/zombieSystem.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/combatSystem.test.ts`

Expected: PASS

- [ ] **Step 5: Commit the zombie hearing behavior**

```bash
git add apps/server/src/sim/state.ts apps/server/src/sim/systems/movementSystem.ts apps/server/src/sim/systems/zombieSystem.ts apps/server/src/sim/systems/zombieSystem.test.ts apps/server/src/rooms/roomRuntime.ts
git commit -m "feat: add zombie hearing and search behavior"
```

If `apps/server/src/rooms/roomRuntime.ts` does not change, omit it from `git add`.

## Task 5: End-To-End Verification

**Files:**
- No new files required beyond the tasks above.

- [ ] **Step 1: Run the focused package test suites**

Run:

- `pnpm --filter @2dayz/shared test -- src/protocol/schemas.test.ts`
- `pnpm --filter @2dayz/client test -- src/game/input/inputController.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/performanceBudget.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/movementSystem.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/combatSystem.test.ts`
- `pnpm --filter @2dayz/server test -- src/sim/systems/zombieSystem.test.ts`

Expected: PASS

- [ ] **Step 2: Run broader package test sweeps**

Run:

- `pnpm --filter @2dayz/shared test`
- `pnpm --filter @2dayz/client test`
- `pnpm --filter @2dayz/server test`

Expected: PASS

- [ ] **Step 3: Run production builds**

Run:

- `pnpm --filter @2dayz/shared build`
- `pnpm --filter @2dayz/client build`
- `pnpm --filter @2dayz/server build`

Expected: PASS

- [ ] **Step 4: Review the final diff before handoff**

Run:

- `git status --short`
- `git diff --stat`

Confirm only the intended input, movement, combat-regression, zombie-AI, and plan/spec files changed.

- [ ] **Step 5: Commit any final verification-only adjustments**

If verification exposed issues that required code changes after the earlier commits, make one final commit with a message that matches the fix, for example:

```bash
git add <updated-files>
git commit -m "fix: tune sprint hearing and stamina edge cases"
```

If no additional changes were needed, skip this commit.
