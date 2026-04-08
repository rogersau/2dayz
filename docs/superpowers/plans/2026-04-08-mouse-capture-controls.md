# Mouse Capture Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make third-person mouse controls work through pointer capture: first click captures the mouse, mouse movement always drives look while captured, right mouse only toggles the tighter aim posture, and pointer-lock exit clears stale aim/fire state.

**Architecture:** Keep the change localized to the existing input controller and controls overlay. Treat pointer capture and aim posture as separate concerns: pointer lock gates mouse look, while right mouse only controls the `aiming` action and tighter camera posture. Use `pointerlockchange` as the single source of truth for capture exit, including native `Escape` release.

**Tech Stack:** TypeScript, Vitest, React Testing Library, DOM Pointer Lock API

---

### Task 1: Capture Pointer Lock On First Gameplay Click

**Files:**
- Modify: `apps/client/src/game/input/inputController.test.ts`
- Modify: `apps/client/src/game/input/inputController.ts`
- Test: `apps/client/src/game/input/inputController.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test near the existing pointer-lock tests in `apps/client/src/game/input/inputController.test.ts`:

```ts
it("captures pointer lock on left click and uses mousemove for look without right-click aim", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const { requestPointerLock } = installPointerLockMocks(element);

  const controller = createInputController({ element });

  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  document.dispatchEvent(createPointerLockMouseMoveEvent({ movementX: 30, movementY: -10 }));

  expect(requestPointerLock).toHaveBeenCalledTimes(1);
  expect(controller.getViewState()).toEqual({
    isAiming: false,
    pitch: 0.1,
    yaw: 0.3,
  });
  expect(controller.pollInput(1)).toEqual({
    actions: { fire: true },
    aim: {
      x: Math.cos(0.3),
      y: Math.sin(0.3),
    },
    movement: { x: 0, y: 0 },
    sequence: 1,
    type: "input",
  });

  controller.destroy();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/input/inputController.test.ts -t "captures pointer lock on left click and uses mousemove for look without right-click aim"
```

Expected: FAIL because `requestPointerLock` is not called on left click and the view state stays at `pitch: 0, yaw: 0`.

- [ ] **Step 3: Write the minimal implementation**

Update `handleMouseDown` in `apps/client/src/game/input/inputController.ts` so left click can capture the pointer, but only right click toggles `isAiming`:

```ts
const requestPointerCapture = () => {
  if (document.pointerLockElement !== element) {
    element.requestPointerLock?.();
  }
};

const handleMouseDown = (event: MouseEvent) => {
  if (!canCaptureInput()) {
    return;
  }

  if (event.button === 0) {
    isFiring = true;
    requestPointerCapture();
  }

  if (event.button === 2) {
    event.preventDefault();
    isAiming = true;
    requestPointerCapture();
  }
};
```

Keep `handleMouseMove` gated on `document.pointerLockElement === element` so mouse look only updates while captured.

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test -- --run src/game/input/inputController.test.ts -t "captures pointer lock on left click and uses mousemove for look without right-click aim"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/game/input/inputController.ts apps/client/src/game/input/inputController.test.ts
git commit -m "fix: capture mouse on first gameplay click"
```

### Task 2: Keep Capture Active After Releasing Aim And Clear State On Escape Exit

**Files:**
- Modify: `apps/client/src/game/input/inputController.test.ts`
- Modify: `apps/client/src/game/input/inputController.ts`
- Test: `apps/client/src/game/input/inputController.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests in `apps/client/src/game/input/inputController.test.ts`:

```ts
it("keeps pointer lock after right mouse is released so mouse look can continue", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const { exitPointerLock } = installPointerLockMocks(element);

  const controller = createInputController({ element });

  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));
  window.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 2 }));
  document.dispatchEvent(createPointerLockMouseMoveEvent({ movementX: 25, movementY: 0 }));

  expect(exitPointerLock).not.toHaveBeenCalled();
  expect(controller.getViewState()).toEqual({
    isAiming: false,
    pitch: 0,
    yaw: 0.25,
  });

  controller.destroy();
});

it("clears aiming and held fire when pointer lock is lost", () => {
  const element = document.createElement("div");
  document.body.append(element);
  installPointerLockMocks(element);

  const controller = createInputController({ element });

  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));

  setPointerLockElement(null);

  expect(controller.getViewState()).toEqual({
    isAiming: false,
    pitch: 0,
    yaw: 0,
  });
  expect(controller.pollInput(2)).toEqual({
    actions: {},
    aim: { x: 1, y: 0 },
    movement: { x: 0, y: 0 },
    sequence: 2,
    type: "input",
  });

  controller.destroy();
});
```

These tests model the native `Escape` release path by driving `pointerlockchange` through `setPointerLockElement(null)`, which is the observable signal the browser produces after `Escape` exits pointer lock.

- [ ] **Step 2: Run the tests to verify they fail**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/input/inputController.test.ts -t "keeps pointer lock after right mouse is released so mouse look can continue|clears aiming and held fire when pointer lock is lost"
```

Expected: FAIL because right mouse release currently calls `document.exitPointerLock()` and pointer-lock loss only clears `isAiming`, leaving held fire latched.

- [ ] **Step 3: Write the minimal implementation**

In `apps/client/src/game/input/inputController.ts`, remove the forced pointer-lock exit from right mouse release and centralize loss cleanup in `handlePointerLockChange`:

```ts
const clearPointerCaptureState = () => {
  isAiming = false;
  isFiring = false;
};

const handleMouseUp = (event: MouseEvent) => {
  if (!canCaptureInput()) {
    return;
  }

  if (event.button === 0) {
    isFiring = false;
  }

  if (event.button === 2) {
    isAiming = false;
  }
};

const handlePointerLockChange = () => {
  if (document.pointerLockElement !== element) {
    clearPointerCaptureState();
  }
};
```

Keep `clearDisabledState()` calling `document.exitPointerLock?.()` when the game is disabled, but let the pointer-lock change event handle the gameplay-state cleanup.

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm test -- --run src/game/input/inputController.test.ts -t "keeps pointer lock after right mouse is released so mouse look can continue|clears aiming and held fire when pointer lock is lost"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/game/input/inputController.ts apps/client/src/game/input/inputController.test.ts
git commit -m "fix: separate pointer capture from aim posture"
```

### Task 3: Update The Controls Overlay Copy To Match Runtime Behavior

**Files:**
- Modify: `apps/client/src/game/ui/ControlsOverlay.test.tsx`
- Modify: `apps/client/src/game/ui/ControlsOverlay.tsx`
- Test: `apps/client/src/game/ui/ControlsOverlay.test.tsx`

- [ ] **Step 1: Write the failing test**

Update the copy assertions in `apps/client/src/game/ui/ControlsOverlay.test.tsx` to match the new control model:

```ts
expect(screen.getByText(/click to capture mouse/i)).toBeInTheDocument();
expect(screen.getByText(/mouse aim/i)).toBeInTheDocument();
expect(screen.getByText(/left click fire/i)).toBeInTheDocument();
expect(screen.getByText(/right click aim/i)).toBeInTheDocument();
expect(screen.getByText(/esc release mouse/i)).toBeInTheDocument();
```

Leave the existing `WASD`, `E`, `R`, and `Tab` assertions in place.

- [ ] **Step 2: Run the test to verify it fails**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/ui/ControlsOverlay.test.tsx
```

Expected: FAIL because the component still renders `Click shoot` and does not mention capture or `Esc`.

- [ ] **Step 3: Write the minimal implementation**

Update the list in `apps/client/src/game/ui/ControlsOverlay.tsx` to:

```tsx
<ul>
  <li>Click to capture mouse</li>
  <li>Mouse aim</li>
  <li>Left click fire</li>
  <li>Right click aim</li>
  <li>Esc release mouse</li>
  <li>WASD move</li>
  <li>E interact</li>
  <li>R reload</li>
  <li>Tab inventory</li>
</ul>
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test -- --run src/game/ui/ControlsOverlay.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/game/ui/ControlsOverlay.tsx apps/client/src/game/ui/ControlsOverlay.test.tsx
git commit -m "docs: align control overlay with mouse capture"
```

### Task 4: Run The Focused Client Regression Suite

**Files:**
- Verify only: `apps/client/src/game/input/inputController.test.ts`
- Verify only: `apps/client/src/game/thirdPersonMath.test.ts`
- Verify only: `apps/client/src/game/ui/ControlsOverlay.test.tsx`
- Verify only: `apps/client/src/game/boot.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/input/inputController.test.ts src/game/thirdPersonMath.test.ts src/game/ui/ControlsOverlay.test.tsx src/game/boot.test.ts
```

Expected: PASS with `0 failed`, confirming the input-controller changes did not regress the existing third-person math, overlay rendering, or boot-time input loop behavior.

- [ ] **Step 2: Record any unexpected failures before broadening scope**

If the command fails, stop and debug the failing file before running any broader suite. Do not add unrelated refactors in response.

- [ ] **Step 3: Commit the verified feature branch state**

```bash
git add apps/client/src/game/input/inputController.ts apps/client/src/game/input/inputController.test.ts apps/client/src/game/ui/ControlsOverlay.tsx apps/client/src/game/ui/ControlsOverlay.test.tsx
git commit -m "fix: support captured mouse look for third-person controls"
```
