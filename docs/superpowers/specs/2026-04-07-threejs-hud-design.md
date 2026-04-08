# Three.js HUD Design

## Summary

This spec replaces the current joined-state status HUD in `apps/client/src/game/ui/Hud.tsx` with a Three.js-rendered overlay. The new HUD should no longer be a visible HTML element. Instead, it should render inside the existing WebGL runtime as a screen-space overlay that stays pinned to the viewport while the world scene continues to render underneath it.

This pass only moves the always-visible, display-only status HUD into Three.js. Interactive overlays such as the inventory panel remain HTML for now.

## Goals

- Remove the visible joined-state status HUD from the DOM.
- Render the main status HUD inside Three.js as part of the game runtime.
- Keep the HUD fixed to the viewport rather than placing it in world space.
- Preserve the current joined-state information hierarchy: health, ammo, inventory summary, and session metadata.
- Keep the implementation small and aligned with the current client architecture.

## Non-Goals

- Moving the inventory panel into Three.js in this pass.
- Making the Three.js HUD interactive.
- Reworking the death overlay, join flow, controls overlay, or connection banner.
- Changing gameplay, networking, state contracts, or store shape.
- Introducing a large new UI or text rendering framework.

## Chosen Direction

Use a dedicated HUD scene rendered as a second Three.js pass.

The client already owns a single renderer, a world scene, and a frame loop in `boot.ts`. The lowest-risk way to add a Three.js-native HUD is to keep the world scene intact, then render a separate HUD scene after the world render using an orthographic camera sized to the canvas. This keeps the HUD screen-pinned, avoids perspective distortion, and avoids coupling status elements to the main world camera.

Alternatives considered:

- `camera-attached HUD meshes` in the world scene: simpler on paper, but more fragile under camera changes and more prone to depth or positioning drift.
- `single full-screen HUD texture`: simpler draw order, but much less composable and awkward for independently updated modules.

## Scope

### Move Into Three.js

The new HUD pass should render these display-only modules:

- health value and status text
- ammo count and equipped weapon label
- inventory summary
- player and room metadata

### Stay In HTML

These elements remain React/HTML in this pass:

- `InventoryPanel`
- `DeathOverlay`
- `ControlsOverlay`
- `JoinScreen`
- `ConnectionBanner`

This keeps the change focused on replacing the visible joined-state HUD while leaving existing interactive overlays alone.

## Architecture

### Render Pipeline

The runtime should become a two-pass renderer:

1. render the existing world scene with the existing camera
2. clear depth without clearing color
3. render the HUD scene with an orthographic camera

The HUD scene should always draw on top of the world scene without affecting world rendering order. `renderer.clearDepth()` between passes is the expected mechanism.

### HUD Runtime Module

Add a dedicated HUD runtime module under `apps/client/src/game/render/`, named for the repo's existing conventions, such as `createHudScene.ts`.

That module should return:

- `scene`
- `camera`
- `resize(width, height)`
- `update(state)`
- `dispose()`

The module should fully own Three.js HUD construction and cleanup so `boot.ts` only coordinates lifecycle and rendering.

### Internal HUD Structure

The HUD scene should be composed from a small set of focused groups rather than one large mesh:

- top-left health module
- top-right ammo module
- lower-edge inventory summary module
- secondary metadata module for player and room identifiers

Each module should use simple Three.js primitives such as flat planes, accent bars, and text objects or sprites. The goal is a clear, maintainable HUD scene graph rather than a texture-heavy or shader-heavy solution.

## Data Flow

### Source Of Truth

The client game store remains the only source of truth. The HUD must not introduce duplicate React state or a second HUD store.

### Update Model

The HUD controller should read from the existing client store during the animation loop and maintain a tiny internal cache of the last displayed values. When derived HUD values change, it updates the corresponding HUD objects.

This is preferred over introducing a separate store subscription because:

- the game already has a central render tick
- HUD updates are tightly coupled to the render runtime
- it keeps the new logic local to the Three.js layer

### Derived Values

The HUD runtime should derive the same values currently computed in `Hud.tsx`:

- `health.current / health.max` or pending state
- alive/dead status text
- total ammo across ammo stacks
- equipped weapon label
- occupied inventory slots summary
- player identifier label
- room identifier label

## Component Responsibilities

### `apps/client/src/game/boot.ts`

- create the HUD scene module during runtime boot
- resize the HUD camera when the canvas size changes
- call HUD `update()` during the frame loop
- render the HUD scene after the world scene
- dispose HUD resources during teardown

### `apps/client/src/game/render/renderFrame.ts`

- either remain world-only and let `boot.ts` coordinate the HUD pass, or accept HUD runtime dependencies if that produces a cleaner separation
- avoid mixing detailed HUD construction into the world-entity render logic

The preferred boundary is to keep `renderFrame.ts` focused on world rendering and let `boot.ts` orchestrate the second pass.

### `apps/client/src/game/ui/Hud.tsx`

This file should stop rendering the visible status HUD markup.

Two acceptable outcomes:

- keep `Hud.tsx` as a thin wrapper around `InventoryPanel`
- remove `Hud.tsx` entirely and render `InventoryPanel` directly from `App.tsx`

The preferred option is to keep `Hud.tsx` as a thin inventory wrapper for a smaller transition.

### `apps/client/src/App.tsx`

- stop relying on `Hud.tsx` for the visible joined-state status layer
- keep HTML inventory behavior unchanged
- preserve joined-state branching logic and existing interrupt overlays

## Visual And Layout Rules

- The HUD is screen-space, not world-space.
- HUD modules should anchor to viewport edges rather than the center.
- Visual treatment should follow the existing survival-shell language rather than reverting to plain debug labels.
- HUD elements should remain readable over the world scene through backplates, contrast, and draw ordering.
- Because this pass is display-only, the HUD should not capture pointer interaction.

## Text Rendering

The implementation should choose the smallest Three.js-compatible text approach that fits the current repo.

Preferred order:

1. reuse an existing lightweight text path if the repo already has one
2. otherwise use a minimal canvas-to-texture or sprite-text approach

The implementation should avoid introducing a heavy text system unless the current codebase truly requires it.

## Error Handling And State Integrity

This redesign must not change the contracts for:

- join and reconnect state handling
- store updates from snapshots and deltas
- inventory toggling
- death overlay visibility
- existing canvas boot and teardown behavior

If the HUD runtime cannot initialize, the existing canvas runtime error handling in `GameCanvas.tsx` should remain the guardrail.

## Testing Strategy

Follow TDD during implementation.

Minimum test coverage should include:

- a failing test for the new HUD runtime's derived display values or update behavior
- a failing test for the joined UI no longer rendering the old status HUD DOM structure
- verification that the inventory panel still renders and toggles as before
- verification that joined-state rendering still works after the HUD pipeline change

Rendering tests do not need to prove pixel-perfect layout. They should focus on:

- HUD runtime lifecycle
- correct derived text/value updates
- correct app-level removal of the old visible HTML HUD
- no regression in existing interactive inventory behavior

## Implementation Boundaries

- Prefer a small, dedicated HUD scene module over broad renderer refactors.
- Reuse the existing renderer and frame loop.
- Keep the world scene, camera, and entity rendering behavior intact.
- Avoid moving unrelated overlays into Three.js during this work.
- Keep new abstractions narrowly scoped to this HUD pass.

## Acceptance Criteria

- The visible joined-state status HUD is no longer rendered as HTML.
- The main status HUD renders from Three.js as a screen-space overlay.
- Health, ammo, inventory summary, and session metadata remain visible in joined state.
- The inventory panel remains HTML and keeps its existing interaction behavior.
- The HUD stays pinned to the viewport during camera movement and resize.
- The world scene continues to render correctly underneath the HUD.
