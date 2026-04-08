# Weapon System Design

## Summary

Expand the current firearm-only combat model into a full weapon system that supports configurable firearms, found melee weapons, and explicit unarmed combat. Players should still spawn with a starter revolver, spare ammo, and one melee weapon, but that starter loadout must move behind a simple config so it can be tuned without changing spawn logic.

This design keeps the existing authoritative server model, slot-based inventory, and quickbar flow. The main change is that weapon handling becomes type-driven instead of assuming every equipped weapon is a firearm.

## Goals

- Add a shared weapon model that supports firearm, melee, and unarmed combat.
- Make firearm balance configurable through weapon data, including damage per shot and shots per second.
- Let players find ammo and one melee weapon type in world loot.
- Let players punch and block zombie attacks when unarmed.
- Require intentional player choice when a gun runs dry instead of auto-falling back to punching.
- Keep starter equipment configurable so the initial loadout can be tuned later.

## Non-Goals

- Building a full long-term arsenal or attachment system.
- Adding complex stamina, durability, combo, or directional-parry systems.
- Letting firearms block in this pass.
- Redesigning the inventory into separate equipment paper-doll slots.
- Changing combat authority away from the server.

## Chosen Direction

Use a unified weapon-definition model with explicit weapon types and shared combat entry points.

This is preferred over extending the current firearm path with special-case melee and punch logic because the project now needs multiple weapon classes and clear user agency around switching states. It is also preferred over a full inventory redesign because the current quickbar and slot system already supports the minimum flow needed for this slice.

## Weapon Model

### Shared definitions

Shared content contracts in `packages/shared` should represent weapons as data instead of implicitly treating all equipped items as firearms.

- `weaponType: "firearm" | "melee" | "unarmed"`
- shared identity fields already used for items such as `itemId`, `name`, `stackable`, and `maxStack`
- a per-type config payload for combat tuning

Firearm config should include:

- `damagePerShot`
- `shotsPerSecond`
- `magazineSize`
- `reloadTimeMs`
- `ammoItemId`
- `range`
- `spread`

Melee config should include:

- `damagePerHit`
- `swingsPerSecond`
- `range`
- whether the weapon can block

Unarmed should also have a real authored definition so punch and block can run through the same combat resolution path. Its tuning should stay simple: punch damage, punch rate, short range, and block capability.

### Starter loadout config

Starter gear should move into a small server-side config module instead of being hard-coded inside player spawn helpers.

The initial config should spawn each player with:

- one revolver
- spare revolver ammo
- one melee weapon
- existing non-weapon starter supplies only if they are still part of the intended spawn

The design should keep this config intentionally simple: item ids, slot placement, equipped slot, and ammo quantities. It does not need a content authoring UI.

## Inventory And Equip Model

The current quickbar and inventory slot structure should remain in place.

- A non-empty slot may contain a firearm, melee weapon, or non-weapon item.
- The player has one active weapon state derived from the current equipped slot.
- `null` equipped slot means the player is intentionally unarmed.
- Selecting an empty quickbar slot should resolve to unarmed.
- A dedicated stow action should also clear the equipped slot and enter unarmed mode.

This preserves user agency:

- if a firearm is equipped and empty, left click still attempts to use that firearm
- the game does not automatically punch for the player
- the player must switch to melee or unarmed by stowing or selecting another slot

Ammo should remain in `ammoStacks` because the current model already separates ammo from quickbar items and works for the first firearm set.

## Input Model

The input layer should add explicit actions for the expanded weapon states.

- `Left click`: primary attack using the currently active weapon state
- `Right click`: aim when a firearm is active, block when melee or unarmed is active
- `R`: reload, but only when the active weapon type is firearm
- `stow weapon` key: clear equipped slot and enter unarmed mode
- existing quickbar selection continues to drive weapon switching

The important rule is that inputs remain intentional and type-aware. The client may show that a firearm is empty, but the server remains authoritative about whether the requested action is valid.

## Combat Resolution

The combat system should stay server-authoritative and branch by weapon type inside one combat pipeline.

### Firearms

- Validate that the equipped item is a firearm.
- Use weapon-definition config for `damagePerShot`, `shotsPerSecond`, `magazineSize`, `reloadTimeMs`, `range`, and `spread`.
- Preserve the current hitscan-style targeting model and shot/combat events.
- Continue to consume magazine ammo on valid shots and reserve ammo on reload.
- Keep rate-of-fire and reload timers authoritative on the server.

### Melee

- Validate that the equipped item is a melee weapon.
- Use melee config for hit damage, swing cadence, and range.
- Resolve hits at short range using a simple forward attack test consistent with current server-side combat authority.
- Emit combat events using the melee weapon item id.
- Do not use ammo or reload state.

### Unarmed

- Treat unarmed as a real weapon state, not a fallback hack.
- Allow primary attack to resolve as a punch when the player is intentionally unarmed.
- Use short-range unarmed config for damage and cadence.
- Allow blocking while unarmed.

## Blocking And Zombie Damage

Blocking should only be available when the active weapon state is melee or unarmed.

- Firearms cannot block.
- Zombie attack resolution should check whether the target player is actively blocking with an allowed weapon state.
- Blocking only needs to affect zombie attacks in this pass.
- Melee and unarmed weapon definitions should include a `blockedZombieDamageMultiplier`, and zombie attacks should multiply incoming damage by that value while block is held.

This keeps the first defensive pass narrow and aligned with the requested behavior without opening a broader player-versus-player defense model.

## Loot And Content

The world loot loop should expand just enough to support the new weapon system.

- Ammo remains lootable through existing ammo stack behavior.
- Add one simple melee weapon item to default content.
- Add one melee weapon definition to default weapon content.
- Add that melee weapon to the relevant loot tables so it can be found in the world.

The first melee weapon should be a single straightforward option such as a bat or pipe. This pass does not need light/heavy subclasses or multiple melee archetypes.

## Replication And Client State

Replication should continue sending the data the client needs to present the player state, but it must no longer assume firearm-only combat.

- Player replication should expose enough active-weapon state for the HUD to distinguish firearm, melee, and unarmed modes.
- Firearm-specific state such as magazine ammo and reload timers should still replicate when relevant.
- Block state should replicate only if the client needs it for visible feedback; otherwise it can remain server-local until a presentation need appears.

The client store and UI should derive active combat presentation from replicated player state rather than duplicating local weapon rules.

## HUD And UX

The HUD should stay minimal but become weapon-aware.

- Show the active weapon name or state.
- Show ammo counts only when a firearm is active.
- Show melee or unarmed state clearly when not using a firearm.
- Indicate when block is available.
- Make stowed or empty-slot unarmed state legible in the quickbar.

The quickbar does not need a visual overhaul. It only needs to make the active selection and unarmed behavior understandable.

## Error Handling And State Integrity

- Invalid reload requests on melee or unarmed state should be ignored safely.
- Fire requests with an empty firearm should not auto-convert into punches.
- Block requests while a firearm is active should be ignored safely.
- Weapon switching, death drops, and respawn should leave the player in a coherent weapon state.
- Starter loadout config should fail loudly if it references missing items, invalid slots, or incompatible ammo.

## Testing Strategy

Implementation should follow TDD.

Minimum coverage should include:

- shared schema tests for the new weapon-definition model and input additions
- server tests for starter loadout config application
- server tests proving firearm damage and shot cadence come from config
- server tests for reload behavior staying firearm-only
- server tests for melee pickup, equip, swing cadence, and damage
- server tests for unarmed punch after stowing or selecting an empty slot
- server tests proving an empty firearm does not auto-punch
- server tests for block reducing zombie attack damage only when unarmed or melee is active
- client tests for the new stow and block input mapping
- client tests for quickbar empty-slot-to-unarmed behavior
- client tests for HUD state across firearm, melee, and unarmed modes

## Implementation Boundaries

- Prefer extending the current authoritative combat system over adding parallel combat subsystems.
- Keep the existing slot inventory and ammo-stack model unless a direct requirement forces change.
- Keep starter loadout config small and local to the server runtime.
- Avoid broad UI redesign while introducing the new weapon states.
- Add only one found melee weapon type in this pass.

## Acceptance Criteria

- Players spawn from configurable starter loadout data with revolver, spare ammo, and one melee weapon.
- Firearm behavior uses authored weapon config for damage and fire cadence.
- Ammo can be found and collected in the world.
- One melee weapon can be found, equipped, and used in combat.
- Players can intentionally stow to unarmed and punch when out of ammo.
- Players can block zombie attacks only while unarmed or using melee.
- Empty firearms do not automatically fall back to punch.
- HUD and quickbar clearly communicate active weapon state and firearm ammo.
