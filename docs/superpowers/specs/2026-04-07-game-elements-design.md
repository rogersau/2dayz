# Game Elements Rendering Design

## Summary

Replace the current placeholder Three.js scene and box-based entity presentation with a readable stylized low-poly combat space. Buildings should derive from shared authored map content so visuals match gameplay collision, players and zombies should render as distinct silhouettes, and shooting zombies should become legible through immediate fire feedback plus authoritative hit and death presentation.

This pass stays inside the current authoritative model. The server remains responsible for movement, hit resolution, zombie behavior, and death state. The client upgrades how the world and combat are presented.

## Goals

- Make buildings, players, and zombies instantly distinguishable at the default camera distance.
- Drive building placement and footprint from shared map data so rendered structures match blocking collision.
- Preserve the current authoritative combat and input flow while making gunfire, hits, and zombie deaths readable.
- Keep the current orthographic tactical read and existing prediction and interpolation behavior.
- Keep scope focused on the default town map and the current single-map product shape.

## Non-Goals

- Adding map rotation, map selection, or multi-map protocol support.
- Adding new combat mechanics such as projectiles, melee, or advanced lag compensation.
- Introducing skeletal animation, imported character assets, or photoreal presentation.
- Reworking HTML overlays such as inventory, join, death, or connection UI.
- Moving gameplay-critical decisions from server authority into the client.

## Chosen Direction

Use shared authored map content plus client-side scene builders.

The current client already has a stable render loop, orthographic camera, entity interpolation, and authoritative fire input. The structural gap is that the real world layout exists only in server content while the client scene still uses placeholder props. The recommended direction is to move the default town map into `packages/shared`, let both server and client consume that same authored map, and then build readable low-poly world geometry and combat presentation on top of the current runtime.

Alternatives considered:

- Keep buildings client-only: fastest to sketch, but visuals drift from authoritative collision.
- Add a full replicated world payload: more general, but unnecessary for the repo's current single-map scope.

## Product Choices Locked In

- Visual direction: stylized low-poly
- Camera/readability target: mid-zoom tactical
- Combat presentation: include muzzle flash, tracer or shot line, hit feedback, and death presentation in this pass
- Building source: shared map data, not hand-placed client-only props

## Scope

### Shared Map Content

- Move `defaultTownMap` from `apps/server/src/content/defaultTownMap.ts` to `packages/shared/src/content/defaultTownMap.ts`.
- Re-export the map from `packages/shared/src/index.ts`.
- Update server imports and tests to consume the shared export.
- Keep using the existing `MapDefinition` shape for this pass. Prefer deriving building massing from existing `collisionVolumes` instead of expanding the schema immediately.

Because the game currently runs one authored map and the network protocol does not replicate `mapId`, the client can import the shared default map directly in this pass. If multi-map work starts later, protocol work should add explicit map identity before generalizing the renderer.

### Client World Rendering

- Replace the fixed placeholder props in `apps/client/src/game/createScene.ts` with a static world builder that consumes the shared map definition.
- Render a ground plane from map bounds.
- Render major building shells from `collisionVolumes` so footprint and blocking stay aligned.
- Add simple roof caps, trim, and building accents inferred from `volumeId` and nearby interactables where useful.
- Keep optional non-blocking dressing out by default. Only add a road strip or landmark prop if readability acceptance criteria cannot be met with building massing, ground treatment, and character silhouettes alone. Any such prop must still derive from the shared map import rather than becoming a second hand-authored world layout in the client.

### Entity Rendering

- Replace single box meshes for players and zombies with grouped low-poly shapes.
- Player silhouette should read as a survivor: torso, head, lower body, and a clear facing or weapon cue.
- Self player should use a warmer and brighter palette than other players.
- Remote players should keep a readable but less prominent palette.
- Zombies should read as hunched, desaturated, and more aggressive than players from silhouette alone.
- Loot can remain simple in this pass unless minor adjustments are needed for consistency.

### Camera

- Keep the existing orthographic camera model.
- Preserve the mid-zoom tactical read rather than switching to a tight character view or a very wide overview.
- Adjust `VIEW_SIZE` and camera position only as needed to keep the player, nearby buildings, and nearby zombies readable together.
- Do not switch to perspective or add cinematic camera behavior in this pass.

### Combat Presentation

- Keep current authoritative fire input and server hitscan damage resolution.
- Spawn local muzzle flash and tracer-style shot feedback immediately when the local player fires so the weapon feels responsive.
- Consume replicated `combat` events to spawn hit flashes or impact effects at `hitPosition`.
- If the hit target is visible, briefly pulse or tint the target mesh to confirm impact.
- Keep all combat effects cosmetic. They must never influence gameplay state.

Zombie death needs one special rule: the server currently emits `death` events for players, not zombies. For this pass, the client should trigger zombie death presentation once when a visible zombie first transitions to `health.current === 0` or `health.isDead === true`. If that transition is not observed, removal may trigger the same death presentation only as a fallback when the zombie was the target of a replicated `combat` hit within a short bounded window, such as the current tick or the immediately following render window, and only if no death presentation has already fired for that entity.

Minimum acceptable zombie death presentation in this pass:

- brief damage flash at death
- short collapse, sink, or fade-style visual resolution
- cleanup within a short fixed lifetime rather than a long animation system

Player deaths should continue to drive the existing death overlay through the current store path. Optional short world-space death presentation for players may be added from replicated player `death` events, but it must not block the existing overlay flow.

## Architecture

### Static World Layer

Keep `createScene()` responsible for scene-level concerns such as background, fog, and lighting. Move authored world geometry into a dedicated render module under `apps/client/src/game/render/`, such as `createWorldView.ts`, that:

- accepts a shared `MapDefinition`
- builds static Three.js objects once at boot
- attaches them to the main world scene
- owns their cleanup on dispose

This keeps static world generation separate from dynamic entity interpolation.

### Dynamic Entity Layer

`entityViewStore.ts` should continue to own players, zombies, and loot, but its view model should no longer assume every entity is a single `THREE.Mesh`.

Expected change:

- store a `THREE.Object3D` per entity rather than a bare mesh
- keep transform interpolation and local-player override logic as-is
- keep enough material references to support temporary hit flash or damage tinting

This is the smallest structural change that supports low-poly grouped characters without rewriting the interpolation path.

### Combat Effects Layer

Add a small transient effects module under `apps/client/src/game/render/`, such as `combatEffectsView.ts`, that:

- spawns short-lived muzzle flashes, tracers, hit flashes, and death effects
- updates effect lifetimes each frame
- removes and disposes expired objects

This layer should stay separate from entity views so temporary effects do not complicate replicated entity state.

## Data Flow

### Boot-Time World Setup

- `boot.ts` creates the renderer, camera, scene, input controller, and existing entity view store as it does now.
- During boot, it also creates the new static world layer from the shared map definition.
- The world layer is built once per runtime start, not rebuilt every frame.

### Replicated Entity Flow

- Snapshot and delta handling remain authoritative sources for players, zombies, and loot.
- `renderFrame.ts` continues to drive interpolation and local-player prediction using the current store state.
- No gameplay state should be inferred from local visual effects.

### Replicated Event Flow

The client currently receives `combat` and player `death` events inside deltas, but only uses death events to mark the local player dead. This pass should preserve that behavior and add a render-facing event path for transient world feedback.

Recommended shape:

- extend the client store with a small render event queue or recent-event buffer
- append combat events and player death events during `applyDelta`
- let the combat effects layer consume those events and manage visual lifetimes locally

This keeps the authoritative state model intact while giving the render layer enough information to create short-lived effects.

## Visual Rules

- Buildings should read heavier and more static than characters through scale, palette, and height.
- Players and zombies must stay readable without relying on labels.
- The player silhouette should communicate facing and weapon use.
- Zombie silhouettes should communicate threat from shape and posture even at mid zoom.
- Effects should be brief and high-contrast enough to clarify combat without obscuring gameplay.
- The overall world should stay restrained and survival-oriented rather than bright arcade presentation.

## Error Handling And Boundaries

- If the shared map import or static world build fails, boot should throw and continue using the existing runtime error handling path in `GameCanvas.tsx`.
- If an effect references an entity that is no longer visible, the client should render a position-based effect if possible and then expire it normally.
- Avoid protocol changes unless implementation reveals a real correctness gap.
- Do not alter server combat authority, zombie AI, replication filtering, or input schemas just to simplify rendering.

## Testing Strategy

Implementation should follow TDD.

Minimum test coverage should include:

- shared tests proving the default town map is exported from `packages/shared` and still validates through the existing server loader
- client tests for static world generation from map collision volumes
- client tests proving player and zombie views build distinct grouped objects rather than indistinguishable boxes
- client tests for render-event buffering so combat events can drive transient effects without breaking existing self-death handling
- client tests for combat effect spawn and expiry behavior
- regression coverage around boot, prediction, input loop timing, and teardown

Tests do not need to assert pixel-perfect rendering. They should prove that the right scene objects, data paths, and visual lifetimes are created and cleaned up correctly.

## Acceptance Criteria

- The client renders building geometry from shared default town map data instead of hard-coded placeholder structures.
- Buildings align with authoritative blocking footprints for the default town map.
- Players and zombies are visually distinct at the default camera distance.
- The local player can shoot zombies using the existing authoritative input and combat flow.
- Gunfire produces immediate local feedback plus authoritative hit confirmation.
- Zombies present readable hit feedback and a visible death effect when killed.
- Existing inventory, death overlay, join, reconnect, and prediction behavior continue to work.
- No gameplay-critical simulation responsibility moves from server to client.
