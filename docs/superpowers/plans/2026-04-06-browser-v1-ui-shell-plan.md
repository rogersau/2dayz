# Browser V1 UI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the browser client into a full-screen, Project Zomboid-inspired game shell using `Rubik`, a title-menu overlay over the live scene, and a survival-focused HUD without changing gameplay, join, or reconnect behavior.

**Architecture:** Keep the existing React state flow and Three.js runtime intact, but restructure `App` so `GameCanvas` becomes the persistent scene layer for both pre-join and joined states. Concentrate the redesign in `apps/client/src/styles.css` and a small set of UI components, then update the targeted Vitest and Playwright coverage that currently asserts the old centered-card layout and `Session HUD` copy.

**Tech Stack:** TypeScript, React, Vite, Three.js, Vitest, Testing Library, Playwright, pnpm

---

## Worktree Context

Run all commands from `/home/james/git/2dayz/.worktrees/browser-v1` and edit the files in that worktree, not the repo root checkout.

## Planned File Changes

- Modify: `apps/client/src/App.tsx` - render a persistent scene layer, route the title menu and joined HUD as overlay layers, and keep the existing join/reconnect state logic intact.
- Modify: `apps/client/src/styles.css` - import `Rubik`, replace the centered panel layout with a full-screen shell, and define the brutalist/worn-survival visual system plus responsive rules.
- Modify: `apps/client/src/game/ui/JoinScreen.tsx` - convert the current join card into a title-menu panel with game-like copy and stable accessibility labels.
- Modify: `apps/client/src/game/ui/ControlsOverlay.tsx` - convert the controls card into a field briefing panel inside the same menu shell.
- Modify: `apps/client/src/game/ui/Hud.tsx` - rebuild the HUD as edge-anchored survival modules centered on health, ammo, and inventory summary.
- Modify: `apps/client/src/game/ui/InventoryPanel.tsx` - keep the existing inventory toggle behavior but restyle it as a compact framed module with a clear summary.
- Modify: `apps/client/src/game/ui/ConnectionBanner.tsx` - restyle reconnect and failure messaging as game-state alerts without changing retry behavior.
- Modify: `apps/client/src/game/ui/DeathOverlay.tsx` - restyle the death state as a stronger interruption overlay.
- Modify: `apps/client/src/App.test.tsx` - cover the full-screen title menu, updated controls flow, and new joined-shell selectors.
- Create: `apps/client/src/game/ui/Hud.test.tsx` - focused HUD rendering assertions so HUD layout changes do not have to be tested only through `App.test.tsx`.
- Modify: `apps/client/e2e/join-and-spawn.spec.ts` - update the join flow to the new title-menu/briefing copy and add a narrow-viewport usability check.
- Modify: `apps/client/e2e/reconnect-and-retry.spec.ts` - update pre-join and joined selectors to the new title menu and HUD labels.
- Modify: `apps/client/e2e/client-performance.spec.ts` - swap the old `Session HUD` selector for the redesigned joined-shell selector.

## Task 1: Establish The Full-Screen Scene Shell

**Files:**
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/styles.css`
- Modify: `apps/client/src/App.test.tsx`

- [ ] **Step 1: Write the failing scene-first shell test**

Add a new test to `apps/client/src/App.test.tsx` that proves the landing experience renders the live scene immediately and exposes a stable title-menu container before any join call happens.

```tsx
it("shows the title menu over the live scene before join", () => {
  render(<App />);

  expect(screen.getByLabelText(/game world/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/title menu/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `pnpm test -- --run apps/client/src/App.test.tsx`
Expected: FAIL because the current landing state does not mount `GameCanvas` and does not expose a `title menu` shell.

- [ ] **Step 3: Implement the minimal full-screen shell**

Update `apps/client/src/App.tsx` and `apps/client/src/styles.css` so that:

- `GameCanvas` is mounted as the base scene layer before join and after join.
- The old centered `app-panel` composition is replaced with full-screen scene, shell, and interrupt layers.
- The pre-join wrapper uses `aria-label="title menu"`.
- The existing join/reconnect/controls branching logic stays intact.

Use the existing runtime behavior to keep this small: `renderFrame` already handles `playerEntityId === null`, so the idle camera can continue showing the authored scene without new simulation work.

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `pnpm test -- --run apps/client/src/App.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the shell restructure**

```bash
git add apps/client/src/App.tsx apps/client/src/styles.css apps/client/src/App.test.tsx
git commit -m "feat: make the browser client a full-screen shell"
```

## Task 2: Redesign The Title Menu, Briefing, And Join Alerts

**Files:**
- Modify: `apps/client/src/game/ui/JoinScreen.tsx`
- Modify: `apps/client/src/game/ui/ControlsOverlay.tsx`
- Modify: `apps/client/src/game/ui/ConnectionBanner.tsx`
- Modify: `apps/client/src/styles.css`
- Modify: `apps/client/src/App.test.tsx`
- Modify: `apps/client/e2e/join-and-spawn.spec.ts`
- Modify: `apps/client/e2e/reconnect-and-retry.spec.ts`

- [ ] **Step 1: Write the failing title-menu and briefing tests**

Update `apps/client/src/App.test.tsx` so the first-join flow expects game-like copy and button labels instead of the old card language, and keep explicit coverage that the controls step is skipped on a later same-session join after dismissal.

```tsx
it("shows the field briefing before the first join", async () => {
  render(<App />);

  fireEvent.change(screen.getByLabelText(/display name/i), {
    target: { value: "Survivor" },
  });

  fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));

  expect(screen.getByRole("heading", { name: /field briefing/i })).toBeInTheDocument();
});

it("skips the field briefing on a later same-session join after dismissal", async () => {
  // Update the existing same-session dismissal test to the new CTA and heading names.
});
```

- [ ] **Step 2: Run the unit test to verify it fails**

Run: `pnpm test -- --run apps/client/src/App.test.tsx`
Expected: FAIL because the current join flow still uses `Continue`, `Before you drop in`, and `Continue to session`.

- [ ] **Step 3: Implement the menu and briefing redesign**

Update `JoinScreen.tsx`, `ControlsOverlay.tsx`, `ConnectionBanner.tsx`, and `styles.css` so that:

- the title menu keeps `2D DayZ` as the main heading
- the join copy reads like a game entry point, not a website card
- the primary CTA becomes `Review briefing`
- the controls step becomes a `Field briefing` panel with an `Enter session` CTA
- the `Display name` label remains stable for usability and autofill
- same-session controls dismissal still bypasses the briefing after the first acknowledgement in the current browser session
- reconnect/failure alerts keep their existing behavior but are visually anchored as edge alerts instead of boxed cards

Keep `Retry join` unchanged unless a test or accessibility issue forces a rename.

- [ ] **Step 4: Update the join-flow Playwright assertions**

Update `apps/client/e2e/join-and-spawn.spec.ts` and `apps/client/e2e/reconnect-and-retry.spec.ts` to follow the renamed controls flow. Keep the same-session controls-dismissal coverage in `App.test.tsx`; do not drop that scenario while renaming the UI.

```ts
await expect(page.getByLabel("title menu")).toBeVisible();
await page.getByRole("button", { name: "Review briefing" }).click();
await expect(page.getByRole("heading", { name: "Field briefing" })).toBeVisible();
await page.getByRole("button", { name: "Enter session" }).click();
```

- [ ] **Step 5: Run the unit test again**

Run: `pnpm test -- --run apps/client/src/App.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the updated join-flow browser test**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts`
Expected: PASS

- [ ] **Step 7: Run the reconnect browser test**

Run: `pnpm exec playwright test apps/client/e2e/reconnect-and-retry.spec.ts`
Expected: PASS

- [ ] **Step 8: Commit the title-menu redesign**

```bash
git add apps/client/src/game/ui/JoinScreen.tsx apps/client/src/game/ui/ControlsOverlay.tsx apps/client/src/game/ui/ConnectionBanner.tsx apps/client/src/styles.css apps/client/src/App.test.tsx apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts
git commit -m "style: redesign the browser title menu"
```

## Task 3: Rebuild The Joined HUD And Death Overlay

**Files:**
- Create: `apps/client/src/game/ui/Hud.test.tsx`
- Modify: `apps/client/src/game/ui/Hud.tsx`
- Modify: `apps/client/src/game/ui/InventoryPanel.tsx`
- Modify: `apps/client/src/game/ui/DeathOverlay.tsx`
- Modify: `apps/client/src/styles.css`
- Modify: `apps/client/src/App.test.tsx`
- Modify: `apps/client/e2e/join-and-spawn.spec.ts`
- Modify: `apps/client/e2e/reconnect-and-retry.spec.ts`
- Modify: `apps/client/e2e/client-performance.spec.ts`

- [ ] **Step 1: Write the failing focused HUD test**

Create `apps/client/src/game/ui/Hud.test.tsx` with a focused render that asserts the redesigned HUD exposes a stable accessibility label and emphasizes health, ammo, and inventory summary.

```tsx
it("renders the survival HUD with primary stats and inventory summary", () => {
  render(
    <Hud
      health={{ current: 86, isDead: false, max: 100 }}
      inventory={{
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
      }}
      isInventoryOpen={false}
      onToggleInventory={vi.fn()}
      playerEntityId="player_survivor"
      roomId="room_browser-v1"
    />,
  );

  expect(screen.getByLabelText(/survival hud/i)).toBeInTheDocument();
  expect(screen.getByText(/86\/100/)).toBeInTheDocument();
  expect(screen.getByText(/ammo/i)).toBeInTheDocument();
  expect(screen.getByText(/inventory/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the HUD test to verify it fails**

Run: `pnpm test -- --run apps/client/src/game/ui/Hud.test.tsx`
Expected: FAIL because the current HUD has no `survival hud` label and still presents as a single `Session HUD` card.

- [ ] **Step 3: Implement the HUD and overlay redesign**

Update `Hud.tsx`, `InventoryPanel.tsx`, `DeathOverlay.tsx`, and `styles.css` so that:

- the HUD uses `aria-label="survival hud"`
- health, weapon/ammo, and inventory summary become the primary visible modules
- player and room metadata, if kept, move into a clearly secondary strip or summary area
- inventory stays toggleable but reads like an in-game module instead of a generic card
- the death overlay becomes a high-contrast interruption panel layered over the scene

Do not change inventory state, death state, or reconnect logic.

- [ ] **Step 4: Update joined-state tests to use the new HUD selector**

Replace old `Session HUD` assertions in `App.test.tsx`, `apps/client/e2e/join-and-spawn.spec.ts`, `apps/client/e2e/reconnect-and-retry.spec.ts`, and `apps/client/e2e/client-performance.spec.ts` with the new `survival hud` selector plus the visible survival stats.

- [ ] **Step 5: Run the focused HUD test again**

Run: `pnpm test -- --run apps/client/src/game/ui/Hud.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the app flow unit test again**

Run: `pnpm test -- --run apps/client/src/App.test.tsx`
Expected: PASS

- [ ] **Step 7: Run the joined-state browser tests**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts`
Expected: PASS

- [ ] **Step 8: Run the reconnect and performance browser tests**

Run: `pnpm exec playwright test apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts`
Expected: PASS

- [ ] **Step 9: Commit the in-session UI redesign**

```bash
git add apps/client/src/game/ui/Hud.tsx apps/client/src/game/ui/InventoryPanel.tsx apps/client/src/game/ui/DeathOverlay.tsx apps/client/src/game/ui/Hud.test.tsx apps/client/src/styles.css apps/client/src/App.test.tsx apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts
git commit -m "style: rebuild the in-session survival hud"
```

## Task 4: Add Narrow-Viewport Coverage And Run Final Verification

**Files:**
- Modify: `apps/client/src/styles.css`
- Modify: `apps/client/e2e/join-and-spawn.spec.ts`

- [ ] **Step 1: Write the failing narrow-viewport browser test**

Add a Playwright test to `apps/client/e2e/join-and-spawn.spec.ts` that proves the title menu remains usable on a phone-sized viewport and does not introduce horizontal overflow.

```ts
test("keeps the title menu usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByLabel("title menu")).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByRole("button", { name: "Review briefing" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
```

- [ ] **Step 2: Run the narrow-viewport test to verify it fails**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts --grep "narrow viewport"`
Expected: FAIL until the full-screen shell compresses correctly on smaller widths.

- [ ] **Step 3: Implement the responsive CSS pass**

Refine `apps/client/src/styles.css` so that:

- the title menu stacks cleanly on narrow screens
- the live scene remains visible under a stronger dim/backplate treatment when space is tight
- alerts and the survival HUD do not overflow the viewport
- the layout uses `100dvh`/`100vh` behavior instead of collapsing back into a centered card

- [ ] **Step 4: Run the narrow-viewport test again**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts --grep "narrow viewport"`
Expected: PASS

- [ ] **Step 5: Run the final unit-test verification**

Run: `pnpm test -- --run apps/client/src/App.test.tsx apps/client/src/game/ui/Hud.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the final browser-test verification**

Run: `pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts`
Expected: PASS

- [ ] **Step 7: Run the client build**

Run: `pnpm --filter @2dayz/client build`
Expected: PASS

- [ ] **Step 8: Commit the responsive pass and verification updates**

```bash
git add apps/client/src/styles.css apps/client/e2e/join-and-spawn.spec.ts apps/client/src/App.test.tsx apps/client/src/game/ui/Hud.test.tsx apps/client/e2e/reconnect-and-retry.spec.ts apps/client/e2e/client-performance.spec.ts
git commit -m "test: verify the browser v1 ui shell"
```
