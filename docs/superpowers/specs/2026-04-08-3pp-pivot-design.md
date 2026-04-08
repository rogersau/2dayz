# Third-Person Pivot Design

## Summary

Pivot the current browser game from a top-down presentation and combat loop into a third-person survival action slice. The first slice should prove a complete moment-to-moment loop: move through a compact 3D space, align a dynamic chase camera, aim over the shoulder, fire one dependable weapon, and survive pressure from zombies tuned for third-person readability.

The project remains a multiplayer client/server game in the current monorepo. The client rendering and input model, shared contracts, and server-side gameplay rules are all allowed to change when the current top-down assumptions conflict with the new slice.

The Three.js client design should follow the local guidance in `.claude/skills`, especially the fundamentals, interaction, and lighting references.

## Goals

- Deliver a playable third-person vertical slice inside the current repo.
- Make the game feel like tense survival action rather than a top-down game viewed from behind the player.
- Support keyboard and mouse controls with a dynamic chase camera that tightens while aiming.
- Prove one end-to-end ranged weapon loop with clear feedback and authoritative resolution.
- Tune zombie behavior for frontal pressure, spacing, and third-person readability.
- Use lightweight stylized placeholder 3D actors and environment geometry rather than final art.

## Non-Goals

- Shipping the final long-term content model, world scope, or art direction.
- Supporting gamepad in the first slice.
- Preserving the full top-down gameplay loop if it conflicts with the new third-person feel.
- Rebuilding every survival subsystem at once.
- Treating the current inventory and broad loot loop as required if they do not help the slice.

## Chosen Direction

Use a vertical-slice rebuild on top of the current repo.

The client should keep the existing browser runtime, React shell, and multiplayer wiring where they still help, but the gameplay-facing runtime should be reoriented around third-person controls and presentation. The server should stay authoritative, but its combat and zombie rules can be reshaped instead of forcing top-down logic to survive under a new camera.

This is preferred over a client-only feel prototype because the requested slice needs honest combat pressure and multiplayer-safe authority. It is preferred over a full system reset because the repo already has useful workspace, networking, and testing structure that should not be discarded.

## Slice Definition

The first slice should cover:

- one controllable survivor archetype
- one reliable ranged weapon loop
- zombies that pressure positioning and retreat timing
- a compact encounter space built for third-person combat readability
- a minimal HUD for health, ammo, crosshair, connection state, and death state

The first slice should not expand into full-system parity. Inventory, broad loot, and large-map traversal should only survive if they directly support the weapon loop and encounter pacing.

Success means a player can join, move in 3D, aim, fire, receive clear combat feedback, and either survive or die in a way that already feels like the intended game direction.

## Runtime Architecture

### Client Runtime

The Three.js client should move from a mostly top-down entity viewer to a presentation runtime built around third-person play. It should be organized into focused modules with clear ownership:

- `world scene`: static environment, ground plane, obstacles, encounter props, fog, and lighting
- `actor presentation`: survivor and zombie scene nodes, state-driven visuals, hit reactions, muzzle flashes, and death presentation
- `camera rig`: follow target, yaw/pitch controls, dynamic distance, aim shoulder bias, and basic collision-safe shortening
- `input pipeline`: keyboard and mouse movement, look delta, aim/fire/reload/sprint actions, and pointer-lock lifecycle
- `local feel layer`: immediate facing updates, camera response, recoil kick, shot feedback, and short-lived presentation-side prediction
- `net reconciliation layer`: snapshot/delta application and smoothing against local presentation state

The current boot flow can remain the coordinator, but world rendering, camera behavior, and actor presentation should become explicitly third-person modules instead of growing inside the existing top-down view code.

### Server Runtime

The server remains authoritative and should own the gameplay state that matters to combat and AI:

- position and velocity
- character facing and aim direction
- weapon fire validation and hit resolution
- zombie aggro, pursuit, attack windows, and death state
- encounter rules needed to keep the slice coherent under multiplayer conditions

This design assumes the server is free to replace rules that only made sense in a top-down view. The goal is not to preserve behavior for compatibility; it is to produce correct third-person gameplay authority.

### Shared Contracts

Shared protocol and world contracts should be reduced to the state third-person play actually needs:

- transform state such as position, velocity, and facing
- player aim state or aim direction
- weapon action requests from the client
- server-confirmed shot and hit outcomes for feedback
- zombie state transitions needed for readable client presentation

Avoid carrying forward top-down-only state if it exists only to support the previous loop.

## Controls, Camera, And Combat Feel

### Controls

The control model should be hybrid survival action:

- `WASD` moves relative to camera facing
- mouse movement controls camera yaw and pitch
- right mouse enters aim mode
- left mouse fires the primary weapon
- sprint and reload remain conventional only if they support the slice and do not bloat it

Character orientation should follow combat intent rather than blindly mirroring movement direction. The player must be able to strafe, reposition, and keep threats framed without fighting the camera.

### Camera

The camera should prioritize awareness while preserving aim pressure:

- default to a mid-distance chase view during traversal
- pull back slightly while moving and exploring
- tighten into an over-the-shoulder framing while aiming
- clamp pitch for readability and control
- shorten boom distance when geometry would otherwise clip through the camera

The design should use standard Three.js third-person camera patterns from the local skill guidance: a dedicated rig, controlled yaw/pitch, and renderer/camera resize handling that preserves aspect correctness.

### Combat Feel

The first slice should center on one dependable firearm with moderate commitment. It should not feel like a twitch arena shooter, but it also should not inherit sluggish top-down combat assumptions.

Required readability cues:

- immediate aim alignment feedback
- muzzle flash and firing impulse
- visible shot confirmation cues such as impacts or tracers
- hit reactions on zombies
- readable zombie attack tells and pressure states

Melee should only exist as a fallback if strictly necessary for completeness. It should not become a second primary combat system in this slice.

## Content And Presentation

### Environment

Build the slice in a compact combat-ready test space rather than trying to preserve broad map coverage. The environment should favor readable lanes, obstacles, approach angles, and retreat decisions over realism.

This space can borrow from current world content only where reuse helps, but it should be designed as a third-person encounter space first.

### Actors

Player and zombie visuals should use lightweight stylized placeholder 3D meshes. They need enough shape and silhouette to judge readability, distance, and threat, but should avoid pulling the slice into full asset production.

Greybox capsules are too abstract for this pivot, while final character models are too expensive for the first slice.

### Lighting

Use a simple outdoor-friendly lighting setup consistent with the local Three.js guidance:

- a cheap ambient or hemisphere fill for base readability
- one directional light for time-of-day shape and shadowing if performance allows
- fog or distance treatment to support atmosphere and keep the compact space visually coherent

Lighting should serve combat legibility first. High-cost post-processing or cinematic lighting should not be required for the first slice.

## UI

The joined-state experience should be dominated by the 3D action view rather than an HTML-first shell.

The HUD should stay minimal and only expose information that supports the core loop:

- health or survivability state
- current ammo and weapon label
- crosshair or aim indicator
- connection state
- death state

Inventory and broader survival UI should be hidden, stubbed, or removed from the joined-state surface unless directly required for the weapon loop. Join flow can remain simple, but once connected the screen should belong to the third-person runtime.

## Error Handling And State Integrity

- Pointer-lock loss should exit aim cleanly and leave controls in a consistent state.
- Reconnect and disconnect handling should remain clear to the player without corrupting local camera or actor presentation state.
- Snapshot corrections should be smoothed in presentation where possible rather than producing harsh visible snapping.
- Missing or placeholder-quality assets must not block playability; stylized fallback meshes are the default content path.
- If a third-person presentation module fails to initialize, the client should fail loudly and locally rather than silently desynchronizing state.

## Testing Strategy

Implementation should follow TDD.

Minimum coverage for the slice should include:

- client tests for keyboard and mouse input mapping into third-person actions
- client tests for camera math and aim-state transitions
- client tests for state-driven HUD behavior
- server tests for shot validation, facing or aim rules, and zombie attack behavior
- server tests for zombie pressure and pursuit state transitions under the new combat model
- one end-to-end happy path proving join, movement, aim, fire, combat feedback, and death or survival flow

Tests do not need to prove pixel-perfect visuals. They should prove that the third-person runtime, contracts, and authoritative combat rules behave as designed.

## Implementation Boundaries

- Prefer replacing top-down-specific client modules over layering compatibility logic on top of them.
- Keep the existing monorepo structure, browser entry points, and test harnesses where they still help.
- Avoid broad unrelated refactors that do not directly serve the third-person slice.
- Keep new abstractions narrowly aligned with camera, actor presentation, input, and combat authority.
- Treat current inventory and broad survival systems as optional support systems, not fixed requirements.

## Acceptance Criteria

- The joined client presents a real third-person camera and actor view rather than the top-down presentation.
- Movement feels camera-relative and readable with keyboard and mouse.
- Aiming tightens the camera and supports an over-the-shoulder combat posture.
- One ranged weapon loop is playable end to end with authoritative server resolution.
- Zombies create readable third-person pressure through pursuit and attack behavior.
- The HUD is reduced to information needed for the core slice.
- The slice runs inside the existing repo and preserves multiplayer authority.
