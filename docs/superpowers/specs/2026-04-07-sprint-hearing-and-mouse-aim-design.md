## Summary

Add three gameplay changes to the current authoritative client/server simulation:

1. Shots should continue to follow the current mouse aim direction.
2. Players should be able to sprint with `Shift`, but sprinting should consume stamina instead of being unlimited.
3. Sprint stamina capacity should shrink as the player carries more inventory, and zombies should react to sound from sprinting and gunfire.

The design keeps the existing architecture intact by extending shared input and server-side simulation rather than introducing a new client-only movement or AI model.

## Goals

- Preserve a single authoritative aim path so player facing and bullets align with the latest mouse position.
- Add intentional, player-controlled sprinting without allowing permanent top-speed travel.
- Make carrying more loot meaningfully affect mobility by reducing total sprint capacity.
- Let zombies respond to sound in a way that distinguishes direct sight from indirect investigation.
- Reuse existing zombie navigation and state patterns where possible.

## Non-Goals

- No new stealth meter or explicit noise HUD in this iteration.
- No full physical weight simulation for inventory.
- No redesign of combat hit detection or rendering.
- No global AI rewrite beyond adding hearing/search behavior to the current zombie logic.

## Current Context

The current code already has the pieces needed for a minimal extension:

- The client input controller computes `aim` from mouse position relative to the game canvas.
- The authoritative movement system rotates the player from `intent.aim` and applies one configured player speed.
- The authoritative combat system fires shots from `intent.aim`.
- The zombie system already supports line-of-sight aggro, chasing, navigation-assisted movement, roaming, and a shared schema that includes a `searching` state.

Because of that, the smallest correct implementation is to extend the input schema, movement system, player simulation state, and zombie system rather than introducing parallel systems.

## Design Overview

### 1. Mouse Aim and Shot Direction

The existing authoritative aim flow should remain the single source of truth:

- The client keeps sending the latest mouse-derived `aim` vector each tick.
- The movement system continues to rotate the player based on that same `aim` vector.
- The combat system continues to use that `aim` vector to fire shots.

No separate bullet-targeting logic should be added. The desired outcome is simply that firing always respects the latest mouse movement already flowing through the shared input path.

### 2. Sprint Input

Add a `sprint` action to the shared input schema and bind it to holding `Shift` in the client input controller.

Behavior:

- Sprint only applies while `Shift` is held.
- Sprint only increases speed while the player is moving.
- Sprint only works while stamina is above zero.
- When stamina reaches zero, movement falls back to normal walking speed until stamina recovers.

This keeps sprinting authoritative and avoids a client/server mismatch in speed.

### 3. Sprint Stamina Model

Add server-side stamina state to players. The model should stay simple and predictable:

- Each player has `staminaCurrent` and `staminaMax` values.
- Sprinting while moving drains `staminaCurrent` over time.
- Not sprinting regenerates stamina over time.
- `staminaCurrent` is clamped between `0` and `staminaMax`.

The player can sprint whenever:

- sprint input is held,
- movement intent is non-zero,
- and `staminaCurrent > 0`.

If any of those are false, walking speed applies.

### 4. Inventory Load Reduces Sprint Capacity

Inventory affects stamina by reducing the maximum available sprint pool rather than reducing sprint speed directly.

Rule:

- More carried inventory means less `staminaMax`.
- Lighter inventory means more `staminaMax`.

For this iteration, load should be derived from existing carried inventory data with a simple heuristic, not a full item-weight system. The simplest acceptable approach is to combine:

- occupied carried slots,
- stack quantities for ammunition/consumable-like entries,
- and equipped/carried weapon presence if needed for balance.

This should produce a single load score that maps to `staminaMax`.

Important behaviors:

- If inventory changes, recalculate `staminaMax` on the server.
- Clamp `staminaCurrent` down if the new maximum is lower than the current value.
- Avoid making the player unable to sprint at all from normal loadouts unless intentionally tuned that way.

The tuning should prioritize clarity over realism.

### 5. Zombie Hearing Model

Add hearing as a second perception path beside sight.

Sound sources for this feature:

- gunshots,
- active sprinting.

Each sound source has a hearing radius. Zombies within that radius can react even without line of sight.

Two outcomes are possible:

- If the zombie hears the player and has line of sight, it immediately locks onto the player and uses normal chase behavior.
- If the zombie hears the player but does not have line of sight, it investigates the last heard position.

This matches the intended mix of direct aggro and sound investigation.

### 6. Zombie Search / Investigate Behavior

When a zombie hears a sound without seeing the player, it should:

- store the heard world position,
- switch to `searching`,
- use existing direct movement and navigation pathing to move toward that location.

While searching:

- If the zombie gains line of sight to the player, it upgrades to normal chase and stores the player as the aggro target.
- If another sound refreshes the investigation, update the heard position.
- If it reaches the heard position without reacquiring the player, it returns to roaming/idle behavior.

This is intentionally lighter than a full sound-memory system and reuses existing pathing logic.

## Data Model Changes

### Shared Input Schema

Extend `inputMessageSchema.actions` with:

- `sprint?: boolean`

This allows the existing authoritative input flow to carry sprint intent.

### Server Player Simulation State

Add stamina-related fields to simulated player state. Exact naming can follow existing conventions, but the state needs at least:

- current stamina,
- max stamina.

Optionally, derived/load-related values can remain computed rather than persisted if that keeps the implementation smaller.

### Server Zombie Simulation State

Add investigation state to zombies. The minimum required data is:

- last heard position,
- optionally the last heard player entity id if useful for upgrades to chase,
- any timer/flag needed to exit search cleanly.

The shared schema already supports a `searching` zombie state, so network-visible zombie state can use that existing value.

## System Changes

### Client Input Controller

- Detect `Shift` key down/up.
- Include `actions.sprint` while held.
- Preserve the current mouse aim update path so firing continues to follow mouse movement.

### Movement System

- Read sprint input.
- Determine whether the player can sprint from movement intent and stamina.
- Apply walking or sprinting speed accordingly.
- Drain stamina while sprinting and moving.
- Regenerate stamina otherwise.
- Recalculate stamina max from current inventory load and clamp current stamina if necessary.

### Combat System

- Preserve the existing use of authoritative `intent.aim` for shots.
- When a shot is fired, expose enough information for zombie hearing to react to the shot origin as a sound source.

The minimal implementation can use current state/events instead of inventing a separate sound queue if that keeps coupling reasonable.

### Zombie System

- Continue existing sight-based aggro checks.
- Evaluate nearby gunshot and sprint-noise stimuli.
- If hearing occurs with line of sight, aggro and chase.
- If hearing occurs without line of sight, store the heard position and enter `searching`.
- While searching, move toward the stored position using existing movement/pathing helpers.
- Exit search when the location is reached and no target is reacquired.

## Tuning Guidelines

These values should remain config-driven or easy to adjust in one place:

- walk speed,
- sprint speed multiplier or absolute sprint speed,
- stamina drain rate,
- stamina regeneration rate,
- baseline max stamina,
- inventory load to stamina-max mapping,
- gunshot hearing radius,
- sprint hearing radius.

Gunshots should likely be much louder than sprinting. Sprint hearing should be strong enough to matter nearby, but not map-wide.

## Error Handling and Edge Cases

- Zero stamina should never block normal walking.
- Standing still while holding sprint should not drain stamina.
- Inventory changes while sprinting should immediately update stamina max and clamp current stamina.
- Shot direction must still ignore fire input when `aim` is zero.
- Searching zombies should not get stuck permanently if they cannot reacquire the player.
- Sight-based aggro should continue to work as it does today.

## Testing Strategy

Add focused tests in the existing unit-test style:

### Input

- `Shift` sets sprint action while held.
- Releasing `Shift` clears sprint action.

### Movement

- Sprinting moves faster than walking.
- Sprinting drains stamina only while moving.
- Walking/idling regenerates stamina.
- Higher inventory load reduces stamina max.
- Lowering stamina max clamps current stamina.
- Zero stamina falls back to walking speed.

### Combat / Aim

- Firing continues to use the current authoritative aim vector.
- Zero-aim fire still does not produce a shot.

### Zombie AI

- Zombies hearing a shot without line of sight enter `searching` and path to the shot position.
- Zombies hearing a shot with line of sight immediately chase the player.
- Zombies hearing sprint noise without line of sight investigate the last heard position.
- Searching zombies upgrade to chasing when they gain sight.
- Searching zombies return to roaming when they reach the heard location without reacquiring a target.

## Implementation Notes

Favor the smallest extension of current code paths:

- reuse the existing input/action flow,
- keep sprint authoritative on the server,
- keep shot direction tied to the existing aim vector,
- reuse zombie pathing helpers for searching.

Avoid adding UI work unless needed for debugging or the next task explicitly requests stamina display.
