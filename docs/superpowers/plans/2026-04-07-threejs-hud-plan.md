# Three.js HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible joined-state HTML HUD with a screen-space Three.js HUD while keeping the inventory panel HTML and preserving the current join, reconnect, and gameplay flow.

**Architecture:** Keep the existing React shell, client store, and world render loop intact. Add a dedicated HUD derivation helper plus a new `createHudScene` runtime module, then render that HUD scene as a second orthographic pass after the world render in `boot.ts`. Shrink `Hud.tsx` down to the remaining HTML inventory wrapper and update app and browser tests to stop using DOM HUD selectors.

**Tech Stack:** TypeScript, React, Three.js, Vitest, Testing Library, Playwright, pnpm

---

## Worktree Context

Before execution, create or switch to a dedicated worktree for this feature using `superpowers:using-git-worktrees`. Run all commands from that worktree root. If execution must stay in the current checkout, do not disturb unrelated user changes.

## Planned File Changes

- Create: `apps/client/src/game/render/hudState.ts` - pure HUD derivation helper that turns client store state into display strings and structured HUD values.
- Create: `apps/client/src/game/render/hudState.test.ts` - focused Vitest coverage for HUD derivation behavior.
- Create: `apps/client/src/game/render/createHudScene.ts` - dedicated Three.js HUD scene, orthographic camera, resize logic, update logic, and cleanup.
- Modify: `apps/client/src/game/boot.ts` - create the HUD runtime, resize it with the canvas, update it each frame, and render it as a second pass.
- Modify: `apps/client/src/game/boot.test.ts` - verify the HUD runtime is created, updated, resized, rendered after the world scene, and disposed.
- Modify: `apps/client/src/game/ui/Hud.tsx` - remove visible HTML status HUD markup and keep only the HTML inventory wrapper.
- Delete: `apps/client/src/game/ui/Hud.test.tsx` - remove the obsolete DOM HUD test once coverage moves to `hudState.test.ts` and app-level assertions.
- Modify: `apps/client/src/App.tsx` - pass only inventory-related props to `Hud` or inline the inventory panel if that proves smaller.
- Modify: `apps/client/src/App.test.tsx` - replace DOM HUD assertions with joined-shell and inventory assertions, and explicitly assert the old DOM HUD is gone.
- Modify: `apps/client/e2e/join-and-spawn.spec.ts` - stop using `survival hud` selectors and use stable joined-state shell plus inventory selectors.
- Modify: `apps/client/e2e/reconnect-and-retry.spec.ts` - update reconnect selectors away from the removed DOM HUD.
- Modify: `apps/client/e2e/client-performance.spec.ts` - wait for the joined shell instead of the removed DOM HUD.

## Task 1: Add A Pure HUD State Derivation Layer

**Files:**
- Create: `apps/client/src/game/render/hudState.ts`
- Create: `apps/client/src/game/render/hudState.test.ts`

- [ ] **Step 1: Write the failing HUD derivation test**

Create `apps/client/src/game/render/hudState.test.ts` with a focused test that locks down the joined-state values the Three.js HUD must display.

```ts
import { describe, expect, it } from "vitest";

import { deriveHudState } from "./hudState";

describe("deriveHudState", () => {
  it("summarizes health, ammo, inventory, and metadata for the Three.js HUD", () => {
    const hud = deriveHudState({
      health: { current: 86, isDead: false, max: 100 },
      inventory: {
        ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 21 }],
        equippedWeaponSlot: 0,
        slots: [
          { itemId: "weapon_pistol", quantity: 1 },
          { itemId: "bandage", quantity: 2 },
          null,
          null,
          null,
          null,
        ],
      },
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
    });

    expect(hud.health.value).toBe("86/100");
    expect(hud.health.detail).toBe("Stable for now");
    expect(hud.ammo.value).toBe("21");
    expect(hud.ammo.detail).toBe("Weapon: weapon_pistol");
    expect(hud.inventory.value).toBe("2/6 slots filled");
    expect(hud.meta.player).toBe("Player: player_survivor");
    expect(hud.meta.room).toBe("Room: room_browser-v1");
  });
});
```

- [ ] **Step 2: Run the HUD derivation test to verify it fails**

Run: `pnpm test -- --run apps/client/src/game/render/hudState.test.ts`
Expected: FAIL with a module-not-found or missing-export error because `hudState.ts` does not exist yet.

- [ ] **Step 3: Write the minimal HUD derivation implementation**

Create `apps/client/src/game/render/hudState.ts` as a pure helper with a narrow input shape and explicit output structure.

```ts
import type { Health, Inventory } from "@2dayz/shared";

export type HudStateInput = {
  health: Health | null;
  inventory: Inventory;
  playerEntityId: string | null;
  roomId: string | null;
};

export const deriveHudState = ({ health, inventory, playerEntityId, roomId }: HudStateInput) => {
  const equippedWeapon = inventory.equippedWeaponSlot === null ? null : inventory.slots[inventory.equippedWeaponSlot];
  const totalAmmo = inventory.ammoStacks.reduce((count, stack) => count + stack.quantity, 0);
  const occupiedSlots = inventory.slots.filter((slot) => slot !== null).length;

  return {
    ammo: {
      detail: `Weapon: ${equippedWeapon?.itemId ?? "none"}`,
      value: String(totalAmmo),
    },
    health: {
      detail: health?.isDead ? "Vital signs lost" : "Stable for now",
      value: health ? `${health.current}/${health.max}` : "pending",
    },
    inventory: {
      detail: "Ready slots and field supplies",
      value: `${occupiedSlots}/${inventory.slots.length} slots filled`,
    },
    meta: {
      player: `Player: ${playerEntityId ?? "pending"}`,
      room: `Room: ${roomId ?? "pending"}`,
    },
  };
};
```

- [ ] **Step 4: Run the HUD derivation test again**

Run: `pnpm test -- --run apps/client/src/game/render/hudState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the HUD derivation layer**

```bash
git add apps/client/src/game/render/hudState.ts apps/client/src/game/render/hudState.test.ts
git commit -m "feat: derive threejs hud state"
```

## Task 2: Add The Three.js HUD Scene And Two-Pass Runtime

**Files:**
- Create: `apps/client/src/game/render/createHudScene.ts`
- Modify: `apps/client/src/game/boot.ts`
- Modify: `apps/client/src/game/boot.test.ts`
- Modify: `apps/client/src/game/render/hudState.ts`

- [ ] **Step 1: Write the failing runtime orchestration test**

Update `apps/client/src/game/boot.test.ts` to mock a new `createHudScene` module and assert the runtime renders the HUD after the world pass.

```ts
const {
  clearDepthMock,
  createHudSceneMock,
  hudDisposeMock,
  hudResizeMock,
  hudUpdateMock,
} = vi.hoisted(() => ({
  clearDepthMock: vi.fn(),
  createHudSceneMock: vi.fn(),
  hudDisposeMock: vi.fn(),
  hudResizeMock: vi.fn(),
  hudUpdateMock: vi.fn(),
}));

vi.mock("./render/createHudScene", () => ({
  createHudScene: (...args: unknown[]) => {
    createHudSceneMock(...args);
    return {
      camera: { kind: "hud-camera" },
      dispose: hudDisposeMock,
      resize: hudResizeMock,
      scene: { kind: "hud-scene" },
      update: hudUpdateMock,
    };
  },
}));

it("renders the HUD scene after the world pass and disposes it on teardown", () => {
  const canvas = document.createElement("canvas");
  const store = {
    getState: () => ({
      connectionState: { phase: "joined" },
      health: null,
      inventory: { ammoStacks: [], equippedWeaponSlot: null, slots: [null, null, null, null, null, null] },
      isDead: false,
      isInventoryOpen: false,
      latestTick: 0,
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
      worldEntities: { loot: [], players: [], zombies: [] },
    }),
    subscribe: () => () => {},
    toggleInventory: vi.fn(),
  };

  const dispose = bootGame({ canvas, socketClient: { sendInput: vi.fn() }, store: store as never });

  scheduledFrame?.(16);

  expect(hudUpdateMock).toHaveBeenCalled();
  expect(clearDepthMock).toHaveBeenCalledTimes(1);
  expect(renderMock).toHaveBeenLastCalledWith({ kind: "hud-scene" }, { kind: "hud-camera" });

  dispose();

  expect(hudDisposeMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the boot test to verify it fails**

Run: `pnpm test -- --run apps/client/src/game/boot.test.ts`
Expected: FAIL because `boot.ts` does not create or render a HUD scene and the renderer mock does not yet expose `clearDepth()`.

- [ ] **Step 3: Implement the minimal Three.js HUD scene**

Create `apps/client/src/game/render/createHudScene.ts` and update `boot.ts` to wire it into the existing runtime.

Implementation requirements:

- `createHudScene()` returns `{ scene, camera, resize, update, dispose }`
- the camera is `THREE.OrthographicCamera`
- the scene is separate from the world scene
- the HUD is visible only when `connectionState.phase === "joined"`; outside joined state, `boot.ts` must skip the HUD pass or `createHudScene.update()` must hide every HUD group before render
- `update(state)` calls `deriveHudState(state)` and only repaints HUD labels when a displayed value changed
- HUD groups are edge-anchored for health, ammo, inventory summary, and metadata
- each HUD module includes both text and a simple readable frame treatment, using at least a backplate plane plus a small accent bar or border plane behind the text
- `boot.ts` calls `renderer.clearDepth()` after `renderFrame(...)` and before `renderer.render(hudScene, hudCamera)`
- `boot.ts` resizes both the world camera/renderer and the HUD camera on window resize
- `boot.ts` disposes the HUD runtime during teardown

Use a minimal text strategy inside `createHudScene.ts`, for example a canvas-backed sprite label helper kept private to the file:

```ts
const createTextSprite = (text: string) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("HUD text canvas is unavailable");
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);

  return {
    dispose() {
      texture.dispose();
      material.dispose();
    },
    setText(nextText: string) {
      // draw nextText into the canvas and mark texture.needsUpdate = true
    },
    sprite,
  };
};
```

Keep this file focused. Do not move inventory interaction, death overlay behavior, or React state into the Three.js runtime.

When the client is not joined, the HUD must not appear as a pending-value overlay under the title menu, reconnect banner, or failure states. Keep the pre-join and failure views visually clean by making the HUD pass joined-only.

- [ ] **Step 4: Run the boot test again**

Run: `pnpm test -- --run apps/client/src/game/boot.test.ts`
Expected: PASS

- [ ] **Step 5: Run the focused HUD runtime tests together**

Run: `pnpm test -- --run apps/client/src/game/render/hudState.test.ts apps/client/src/game/boot.test.ts`
Expected: PASS

- [ ] **Step 6: Commit the HUD runtime wiring**

```bash
git add apps/client/src/game/render/hudState.ts apps/client/src/game/render/createHudScene.ts apps/client/src/game/boot.ts apps/client/src/game/boot.test.ts
git commit -m "feat: render the hud inside threejs"
```

## Task 3: Remove The Visible HTML HUD And Keep Only Inventory HTML

**Files:**
- Modify: `apps/client/src/game/ui/Hud.tsx`
- Delete: `apps/client/src/game/ui/Hud.test.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/App.test.tsx`

- [ ] **Step 1: Write the failing joined-shell test**

Update `apps/client/src/App.test.tsx` so joined-state assertions stop expecting a DOM HUD and instead prove the player reaches the joined shell while the HTML inventory controls remain available.

```tsx
it("renders the joined shell without the old html survival hud", async () => {
  render(<App />);

  fireEvent.change(screen.getByLabelText(/display name/i), {
    target: { value: "Survivor" },
  });
  fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
  fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

  await waitFor(() => {
    expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
  });

  expect(screen.queryByLabelText(/survival hud/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /open inventory/i })).toBeInTheDocument();
});
```

Also replace helper assertions such as `expectPendingSurvivalHud()` and `expectLoadedSurvivalHud()` with a joined-shell helper that checks:

- `aria-label="game shell"` is present
- the inventory toggle button is present
- the removed `survival hud` label is absent

- [ ] **Step 2: Run the app test to verify it fails**

Run: `pnpm test -- --run apps/client/src/App.test.tsx`
Expected: FAIL because the joined state still renders the old HTML HUD and the existing assertions still depend on `survival hud`.

- [ ] **Step 3: Implement the minimal DOM HUD removal**

Update `Hud.tsx` so it only renders `InventoryPanel`, and update `App.tsx` to pass only the inventory-related props that remain necessary.

```tsx
type HudProps = {
  inventory: Inventory;
  isInventoryOpen: boolean;
  onToggleInventory: () => void;
};

export const Hud = ({ inventory, isInventoryOpen, onToggleInventory }: HudProps) => {
  return <InventoryPanel inventory={inventory} isOpen={isInventoryOpen} onToggle={onToggleInventory} />;
};
```

Then remove `apps/client/src/game/ui/Hud.test.tsx`; its old DOM status assertions are now covered by `hudState.test.ts` and `App.test.tsx`.

- [ ] **Step 4: Run the app test again**

Run: `pnpm test -- --run apps/client/src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the inventory panel test to verify no regression**

Run: `pnpm test -- --run apps/client/src/game/ui/InventoryPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit the DOM HUD removal**

```bash
git add apps/client/src/game/ui/Hud.tsx apps/client/src/App.tsx apps/client/src/App.test.tsx apps/client/src/game/ui/InventoryPanel.test.tsx
git rm apps/client/src/game/ui/Hud.test.tsx
git commit -m "refactor: remove the html session hud"
```

## Task 4: Update Browser Selectors And Run Verification

**Files:**
- Modify: `apps/client/e2e/join-and-spawn.spec.ts`
- Modify: `apps/client/e2e/reconnect-and-retry.spec.ts`
- Modify: `apps/client/e2e/client-performance.spec.ts`

- [ ] **Step 1: Write the failing browser-selector update**

Update the Playwright tests so they no longer look for `page.getByLabel("survival hud")`. Because the HUD now renders inside WebGL, use stable DOM selectors that still represent successful join state.

Required replacements:

- use `page.getByLabel("game shell")` as the main joined-state selector
- keep `Open inventory` / `Collapse inventory` button assertions for HTML interaction coverage
- stop asserting visible HUD text like `Health` or `Ammo` from the DOM

Example update in `apps/client/e2e/join-and-spawn.spec.ts`:

```ts
await expect(page.getByLabel("game shell")).toBeVisible();
await expect(page.getByRole("button", { name: "Open inventory" })).toBeVisible();
```

- [ ] **Step 2: Run the browser tests to verify they fail before the selector change is applied everywhere**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts`
Expected: FAIL while any test still waits on `survival hud`.

- [ ] **Step 3: Finish the Playwright selector migration**

Update all joined-state helpers and assertions in:

- `apps/client/e2e/join-and-spawn.spec.ts`
- `apps/client/e2e/reconnect-and-retry.spec.ts`
- `apps/client/e2e/client-performance.spec.ts`

Implementation notes:

- rename `joinIntoHud(...)` to something like `joinIntoGameShell(...)`
- rename `readSessionHud(...)` to a name that reflects the remaining DOM source, or delete it if metadata is no longer available in HTML
- where a test only needs to know that join or reconnect completed, assert `game shell` plus inventory button visibility instead of HUD text

- [ ] **Step 4: Run the browser tests again**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts`
Expected: PASS

- [ ] **Step 5: Run the final client unit-test verification**

Run: `pnpm test -- --run apps/client/src/game/render/hudState.test.ts apps/client/src/game/boot.test.ts apps/client/src/App.test.tsx apps/client/src/game/ui/InventoryPanel.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the client build**

Run: `pnpm --filter @2dayz/client build`
Expected: PASS

- [ ] **Step 7: Commit the selector updates and verification pass**

```bash
git add apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts
git commit -m "test: update browser selectors for the threejs hud"
```

## Notes For The Implementer

- Do not reintroduce a visible HTML status HUD for testability.
- Keep `renderFrame.ts` focused on world rendering unless a tiny signature change is clearly cleaner than boot-level orchestration.
- If `createHudScene.ts` needs a couple of small private helpers for text sprites or module layout, keep them in the same file unless reuse becomes obvious.
- If `createHudScene.ts` becomes difficult to test directly, keep tests centered on the pure derivation helper and boot-level orchestration rather than adding test-only production APIs.
