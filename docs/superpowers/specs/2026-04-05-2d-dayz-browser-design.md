# 2D DayZ Browser Game Design

## Summary

Build a browser-first, isometric 2D survival game inspired by DayZ using Three.js, with instant join from the web, no downloads, and a minimal entry flow. Players enter only a display name, briefly see the controls, then spawn into a shared online session featuring scavenging, zombie pressure, PvP risk, quick respawns, and session-only persistence.

V1 prioritizes durable foundations in TypeScript across client and server so the game can grow from small 8-12 player rooms toward larger maps, stronger persistence, and eventually much higher player counts without discarding the core architecture.

## Goals

- Let players join quickly in a browser with no install and no account creation.
- Capture a compressed DayZ-like loop: spawn, scavenge, avoid or fight zombies, encounter players, die, respawn, repeat.
- Start with one map containing a town plus nearby outskirts, while keeping the architecture ready for larger regions.
- Keep zombies as a core threat in v1.
- Use session-only persistence first, with a clear upgrade path toward persistent characters later.
- Build around shared TypeScript contracts and stable subsystem boundaries to avoid a rewrite.

## Non-Goals For V1

- Permanent accounts or identity systems.
- Persistent characters across sessions.
- Full MMO-scale world simulation.
- Deep crafting, base building, vehicles, sickness, temperature, or complex survival simulation.
- Multiple biomes, multiple maps, or long-distance regional travel.

## Product Shape

The first playable version is a match-based survival-lite experience.

Players open the site, enter a display name, review a short controls overlay, and immediately join an active shared session. The world is an isometric map with one main town, a road, nearby woods, and a few outlying structures. Players scavenge for weapons, ammo, and consumables while navigating zombie threats and other players. Death resets the current run quickly through fast respawn into the same live session. The room persists while the server is alive, so dropped loot, zombie state, and local world activity can continue across player disconnects and rejoins.

## Architecture

### High-Level Structure

V1 uses three main parts:

- `web client`: browser app for rendering, input, UI, audio, and local presentation.
- `game server`: authoritative simulation for rooms, players, zombies, loot, combat, and replication.
- `session manager`: lightweight room lifecycle logic for routing players into active sessions and creating new rooms when needed.

This should be implemented as a TypeScript monorepo with at least:

- `apps/client`
- `apps/server`
- `packages/shared`

Optional future packages can be added for content, persistence, or tools without changing the core split.

### Type Safety Strategy

TypeScript is required across the entire stack.

`packages/shared` should define stable shared contracts for:

- network messages
- entity identifiers
- world snapshots and deltas
- player state
- item definitions
- combat events
- room metadata
- configuration constants used by both sides

The client and server should depend on these shared types rather than re-declare local copies. This keeps the network protocol explicit and reduces drift as the game grows.

### Authoritative Boundaries

The browser should never be trusted for simulation-critical decisions.

The client is responsible for:

- rendering with Three.js
- collecting player input
- lightweight client-side prediction for local feel
- interpolation of remote entities
- presenting UI and feedback

The server is responsible for:

- room simulation
- movement validation and correction
- zombie behavior
- combat and hit resolution
- loot spawning and pickup validation
- inventory truth
- health and death resolution
- session persistence while a room is alive

This separation preserves flexibility for later changes in hosting, transport, scale, or rendering.

## Core Technical Model

### Rendering And Client Runtime

Three.js should render the world as low-poly 3D content viewed through a fixed isometric camera. Gameplay reads as a 2D isometric survival game, but the content pipeline, collision, and scene layout should treat the world as simple 3D geometry from day one. This avoids ambiguity around sprite versus mesh rendering and keeps the door open for richer lighting, occlusion, and larger spaces later. V1 art direction should stay gritty and lightweight rather than photorealistic.

The client runtime should stay thin. It should turn server state into renderable scene objects, own HUD and overlays, and convert player input into typed input intents.

### Simulation Model

Use an ECS-lite approach rather than a large engine framework.

Core entity types:

- players
- zombies
- loot pickups
- projectiles
- world props

Core components can stay small:

- transform
- velocity
- health
- inventory
- aggro
- interactable
- weapon state

Core subsystems:

- movement
- combat
- loot
- zombie AI
- replication
- session lifecycle
- join flow and UI flow

This is enough structure to scale without overcommitting to a heavyweight architecture too early.

### Data-Driven Content

Core content should be data-driven from v1 rather than hardcoded into simulation logic.

At minimum, define typed content schemas for:

- items and weapon stats
- zombie archetypes
- loot tables
- map metadata
- spawn zones
- interactable placements

The server should load these definitions as content data, while simulation systems consume the typed results. This keeps balance and map iteration from forcing deep code edits.

### World Authoring Model

The authoritative world model should be defined explicitly for v1.

- Maps are authored as static low-poly scenes plus typed metadata layers.
- Collision uses simple primitives or baked collision volumes, not arbitrary render meshes.
- Navigation is driven by a lightweight walkable navigation representation or waypoint graph suitable for zombie movement.
- Line-of-sight and noise checks use the authoritative world representation, not client visuals.
- Spawn points, loot points, zombie spawn zones, and interaction anchors are stored as typed map metadata.

This gives a stable path from one handcrafted region to larger authored spaces later without rewriting core game rules.

## Gameplay Design

### Join Flow

The landing flow must stay minimal:

1. Player opens the site.
2. Player enters a display name.
3. Player sees a brief controls card.
4. Player joins an active room immediately.

The controls card should be short and skippable after first acknowledgment in the current browser session. It should explain:

- `WASD` move
- mouse aim
- click shoot
- interact
- reload
- inventory

No account creation, launcher, or extra onboarding should block entry.

### Identity And Reconnect Contract

V1 should keep identity lightweight without being undefined.

- The player enters a display name, but the server assigns a unique session token on successful join.
- Display names are not treated as secure identity and do not guarantee uniqueness.
- The browser stores the active session token locally for short reconnect attempts.
- On disconnect, the server keeps the player slot and inventory state reserved for a short reclaim window.
- If the same browser reconnects with a valid live token during that window, it reclaims the same character state in the same room.
- If the reclaim window expires, the player joins as a fresh run.

This provides a clean bridge from anonymous browser play toward later account-backed persistence without pretending the display name is identity.

### Core Loop

The target loop is:

spawn -> scout -> scavenge -> avoid/fight zombies -> risk player encounters -> upgrade gear -> die -> quick respawn

The first few minutes should produce immediate tension. Players should quickly find basic points of interest, hear or see danger, and make meaningful choices around risk versus reward.

### Survival Scope

V1 should keep survival mechanics compact and readable:

- health
- damage pressure
- limited ammo
- simple consumables
- compact inventory

Potential additions such as hunger, thirst, temperature, sickness, and crafting should remain out of initial scope unless needed later to support retention.

### Death And Respawn

Death should reset the run quickly.

- Player loses their current gear.
- Respawn is fast.
- Respawn point is selected from valid spawn locations in the live session.
- The room continues running and other players remain in the world.

This fits the short-session browser requirement better than harsh downtime.

### Combat Contract

Combat needs a concrete v1 contract so networking and simulation do not drift.

- Firearms are the primary weapon type in the first milestone.
- Gunfire should use authoritative hitscan resolution first, with typed weapon stats for damage, range, spread, fire rate, magazine size, and reload time.
- Melee can be deferred until after the first playable slice unless it is needed for spawn viability.
- The client may present immediate fire feedback, but the server decides whether a shot is valid and what it hit.
- Reload timing and weapon state are server authoritative.
- Latency handling should stay simple in v1: no advanced lag compensation beyond reasonable reconciliation and anti-spam validation.

This keeps combat readable and stable while preserving room to add projectiles or more nuanced weapon handling later.

## World And Content

### Initial Map

The first map should be a single handcrafted region containing:

- one main town
- forested outskirts
- road connections
- a few remote structures

This should feel large enough for stalking, looting, and disengagement, but small enough to keep encounter frequency healthy for low player counts.

The content pipeline should assume that larger regions may come later. Avoid hardcoding map assumptions into game rules where possible.

### Items And Inventory

V1 item categories:

- firearms
- ammo
- healing items
- simple utility items

Inventory should be gridless or otherwise intentionally compact for v1. The goal is readable decision-making, not deep item tetris.

### Zombies

Zombies are a core feature in v1.

Their initial behavior should be simple and legible:

- idle roam
- noise or line-of-sight detection
- chase
- attack
- drop aggro after losing target

The implementation should favor consistency and server performance over complex behavior trees in the first version.

## Networking And Session Model

### Transport

Use WebSockets for real-time communication.

Client-to-server messages should be input-oriented, such as:

- movement intent
- aim vector
- fire request
- reload request
- interact request
- inventory actions

Server-to-client messages should be state-oriented, such as:

- room join confirmation
- initial snapshot
- state deltas
- combat events
- death events
- loot updates
- room status updates

### Simulation Tick

The server should simulate on a fixed tick. The client should interpolate remote state and predict the local player where useful, with correction when authoritative updates differ.

### Session Strategy

V1 should use room-based shards with session-only persistence.

- A room remains alive while the server keeps it active.
- Loot, dropped items, zombie state, and room-local changes persist for the life of the room.
- Players can join and leave without requiring accounts.
- New players are assigned to an available room or a new room is created.

This supports the immediate join experience now while leaving room for stronger persistence later.

### Future Scale Path

The architecture should explicitly avoid coupling simulation state to one transport implementation or one permanent room format. That gives a path toward:

- bigger maps
- more simultaneous rooms
- stronger persistence
- reconnectable characters
- eventually larger player counts per world region

V1 does not need cross-room movement or regional handoff yet. Instead, it should create the extension seams for them:

- room simulation state is isolated behind typed room interfaces
- persistence is a separate concern from room runtime memory
- map and spawn metadata are not hardcoded to one region shape
- network DTOs are versionable and transport-agnostic

V1 should target roughly 8-12 players per room first, even though the long-term ambition is much larger. The design should claim scalability only to the extent these seams are preserved.

## UI And UX

### Presentation

The visual target is gritty low-poly isometric survival. The interface should stay sparse and readable, not arcade-bright.

### Required Screens

- landing screen with name input and join action
- brief controls overlay
- in-game HUD
- death screen with quick respawn

### HUD Scope

V1 HUD should show only what the player needs immediately:

- health
- ammo / weapon state
- inventory access
- interaction prompts
- optional minimal session status text

Avoid front-loading menus or social systems.

## Error Handling And Resilience

The player experience should degrade cleanly.

- If room join fails, show a short retryable error state.
- If the socket disconnects, preserve the player name locally and offer fast reconnect.
- If client prediction diverges, smooth correction rather than abrupt snapping where possible.
- If a room is full or unhealthy, route the player into another room.

The server should isolate room failures so one bad room does not take down the whole service.

## Performance Budgets And Acceptance Criteria

V1 should define concrete budgets so the foundation can be evaluated early.

- target room size: 8-12 concurrent players
- target server simulation rate: fixed tick in the 20-30 Hz range
- target client render rate: 60 fps on a typical modern desktop browser, with graceful degradation below that
- target join time from landing screen to spawn: under 10 seconds in healthy conditions
- target reconnect time during reclaim window: under 5 seconds in healthy conditions
- initial zombie budget: enough to maintain pressure without exceeding room tick budget, likely tens of zombies rather than hundreds
- initial dropped item and loot budget: capped per room and per zone to avoid unbounded replication growth

These numbers are not final tuning values, but they should act as design constraints for implementation and testing.

## Testing Strategy

Testing should focus first on correctness in server simulation and shared contracts.

### High-Value Automated Tests

- deterministic movement rules
- combat resolution
- zombie aggro transitions
- loot spawn rules
- pickup validation
- room lifecycle behavior
- network contract validation for shared message types

### Client Tests

- join flow UI
- controls overlay behavior
- HUD state smoke tests
- client boot and connection smoke coverage

### Manual Testing

- multi-client join and disconnect
- latency and reconnect behavior
- zombie pressure in dense spaces
- spawn distribution and pacing
- death and respawn loop feel

## Delivery Strategy

Deploy as:

- static browser client
- hosted Node game server

Keep infrastructure modest in v1. The focus is getting a playable online loop into the browser quickly, with enough observability to guide iteration.

### Operational Visibility

Track at least:

- active rooms
- players per room
- server tick time
- disconnect reasons
- room creation and shutdown
- runtime errors

## Risks And Mitigations

### Risk: Prototype Architecture Becomes Disposable

Mitigation:

- shared TypeScript contracts from day one
- clear client/server authority boundaries
- subsystem-based simulation design

### Risk: V1 Feels Too Thin Compared To DayZ

Mitigation:

- keep zombie pressure and scavenging central
- use map composition and scarcity to create tension
- compress the loop instead of copying every survival mechanic

### Risk: Browser Multiplayer Feels Laggy

Mitigation:

- fixed server tick
- client-side prediction for local movement
- interpolation for remote entities
- early performance instrumentation

### Risk: Scope Expands Too Early

Mitigation:

- single map
- one room type
- session-only persistence
- limited item and survival systems

## Recommended First Milestone

The first milestone should produce a playable vertical slice with:

- browser join flow with name input
- controls overlay
- isometric map with town plus outskirts
- player movement and aiming
- zombies with simple aggro and attacks
- loot pickup and basic weapons
- health, death, and quick respawn
- multiplayer rooms with session-only persistence

That milestone is enough to validate whether the game feels like a browser-accessible DayZ-inspired experience before adding deeper systems.
