# Weapon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full weapon system with configurable firearms, one found melee weapon, explicit unarmed punch/block behavior, and a configurable starter loadout.

**Architecture:** Keep the current authoritative client/server loop and slot inventory model, but make combat resolve by weapon type instead of assuming every equipped item is a firearm. Put weapon tuning in shared content, move starter gear into a small server config, reuse the existing combat/zombie/input systems, and restore a minimal joined-state quickbar so players can intentionally switch or stow into unarmed.

**Tech Stack:** TypeScript, Zod, Vitest, React, React Testing Library, Playwright

---

## File Map

### Shared contracts and content

- Create: `packages/shared/src/content/defaultWeapons.ts`
  Exports authored default firearm, melee, and unarmed weapon definitions used by both server and client.
- Create: `packages/shared/src/content/weapons.test.ts`
  Covers discriminated weapon-definition parsing and the new block config fields.
- Modify: `packages/shared/src/content/items.ts`
  Adds the `melee` item category so melee loot can exist as a normal inventory item.
- Modify: `packages/shared/src/content/weapons.ts`
  Replaces the firearm-only schema with a discriminated union for firearm, melee, and unarmed definitions.
- Modify: `packages/shared/src/world/weapon.ts`
  Extends replicated weapon state so the client can tell firearm, melee, and unarmed modes apart.
- Modify: `packages/shared/src/world/inventory.ts`
  Adds the `stow` inventory action for explicit unarmed switching.
- Modify: `packages/shared/src/world/inventory.test.ts`
  Verifies `stow` inventory actions parse correctly.
- Modify: `packages/shared/src/protocol/messages.ts`
  Adds the `block` input action and keeps the rest of the protocol stable.
- Modify: `packages/shared/src/protocol/schemas.test.ts`
  Verifies the new input and replicated weapon state payloads.
- Modify: `packages/shared/src/index.ts`
  Re-exports shared weapon content so the client can use authored weapon metadata.

### Server content and runtime

- Create: `apps/server/src/content/defaultStarterLoadout.ts`
  Stores the starter revolver, ammo, melee weapon, and equipped slot in one editable place.
- Create: `apps/server/src/sim/weapons.ts`
  Central weapon helpers: resolve active weapon, build default weapon state, sync state after equip/stow/death, and read zombie block multipliers.
- Create: `apps/server/src/sim/state.test.ts`
  Covers starter loadout application and spawn-time weapon state.
- Modify: `apps/server/src/sim/state.ts`
  Uses shared default weapons and starter loadout config when spawning players.
- Modify: `apps/server/src/sim/query.ts`
  Replicates the richer weapon state shape.
- Modify: `apps/server/src/sim/query.test.ts`
  Verifies snapshots and deltas now include weapon identity and type.
- Modify: `apps/server/src/sim/systems/combatSystem.ts`
  Branches primary attack and reload handling by weapon type.
- Modify: `apps/server/src/sim/systems/combatSystem.test.ts`
  Covers firearm tuning, melee swings, unarmed punches, and empty-gun non-fallback.
- Modify: `apps/server/src/sim/systems/inventorySystem.ts`
  Handles `stow`, weapon-only equip resolution, and syncs weapon state when gear changes.
- Modify: `apps/server/src/sim/systems/inventorySystem.test.ts`
  Covers stowing, empty-slot unarmed selection, and melee pickup/equip.
- Modify: `apps/server/src/sim/systems/zombieSystem.ts`
  Applies block reduction only for melee and unarmed states.
- Modify: `apps/server/src/sim/systems/zombieSystem.test.ts`
  Covers blocked zombie attacks and invalid firearm block attempts.
- Modify: `apps/server/src/sim/systems/lootSystem.test.ts`
  Verifies melee loot can spawn from authored tables.
- Modify: `apps/server/src/content/defaultItems.ts`
  Adds the found melee item.
- Modify: `apps/server/src/content/defaultLootTable.ts`
  Adds the melee weapon to the authored police loot table and keeps residential ammo/bandage drops intact.
- Modify: `apps/server/src/rooms/respawn.ts`
  Resets dead players to coherent unarmed weapon state after gear drops.
- Modify: `apps/server/src/rooms/respawn.test.ts`
  Verifies respawn clears stale reload/block state and restores unarmed state.
- Modify: `apps/server/src/sim/systems/replicationSystem.test.ts`
  Updates nearby-entity expectations to the richer starter loadout and weapon state.

### Client runtime, UI, and test fallout

- Modify: `apps/client/src/game/input/keymap.ts`
  Adds the dedicated stow key.
- Modify: `apps/client/src/game/input/inputController.ts`
  Maps right-click to aim for firearms and block for melee/unarmed, and queues stow on key press.
- Modify: `apps/client/src/game/input/inputController.test.ts`
  Covers firearm aim, melee/unarmed block, and stow input.
- Modify: `apps/client/src/game/boot.ts`
  Passes active weapon type and stow callbacks into the input controller.
- Modify: `apps/client/src/game/boot.test.ts`
  Updates the boot harness for the new input-controller contract and stow queueing.
- Modify: `apps/client/src/game/state/clientGameStore.ts`
  Makes empty-slot selection resolve to unarmed and adds a local stow helper.
- Modify: `apps/client/src/game/state/clientGameStore.test.ts`
  Covers empty-slot-to-unarmed and replicated weapon-type HUD state.
- Modify: `apps/client/src/App.tsx`
  Uses shared weapon metadata to render active weapon info, ammo only for firearms, and reintroduces the quickbar/inventory HUD.
- Modify: `apps/client/src/App.test.tsx`
  Updates joined-shell assertions for the restored weapon-selection HUD.
- Modify: `apps/client/src/game/ui/CombatHud.tsx`
  Shows weapon label/type, ammo only for firearms, and block availability.
- Modify: `apps/client/src/game/ui/CombatHud.test.tsx`
  Covers firearm vs melee/unarmed HUD states.
- Modify: `apps/client/src/game/ui/QuickbarHud.tsx`
  Shows when empty slots mean unarmed and when no slot is equipped because the player is stowed.
- Modify: `apps/client/src/game/ui/QuickbarHud.test.tsx`
  Covers empty-slot semantics and stowed-state accessibility labels.
- Modify: `apps/client/src/game/ui/Hud.tsx`
  Becomes the joined-state wrapper for `QuickbarHud` and `InventoryPanel`.
- Modify: `apps/client/src/game/ui/ControlsOverlay.tsx`
  Updates control copy with `X stow weapon` and `Right click aim/block`.
- Modify: `apps/client/src/game/ui/ControlsOverlay.test.tsx`
  Updates the control list assertion.
- Modify: `apps/client/src/styles.css`
  Adds small joined-state layout rules for the restored quickbar and weapon-aware HUD.
- Modify: `apps/client/src/game/net/socketClient.ts`
  Updates mock world state to the richer weapon state and real shared item ids.
- Modify: `apps/client/src/game/net/socketClient.test.ts`
  Covers stow/equip behavior and real authored ids in the mock transport.
- Modify: `apps/client/src/game/net/protocolStore.test.ts`
  Updates snapshot/delta fixtures to the new weapon state shape.
- Modify: `apps/client/e2e/join-and-spawn.spec.ts`
  Updates the websocket init script and joined-shell assertions for the restored quickbar and weapon-aware HUD.

## Implementation Notes

- Keep `actions.fire` as the network name for primary attack to avoid a repo-wide rename; melee and unarmed should still use that action on the wire.
- Keep `fireCooldownRemainingMs` in replicated weapon state for now to minimize churn, even though melee and unarmed will also use it as a generic attack cooldown.
- Use `item_unarmed` as the authored unarmed weapon id in shared weapon content. It is a weapon definition, not a lootable item.
- Use `item_pipe` as the first found melee weapon id.
- Use `X` as the dedicated stow key.
- Treat empty-slot selection and selecting a non-weapon slot as `stow` on the client and authoritative unarmed on the server.

### Task 1: Add Shared Weapon Contracts And Authored Weapon Data

**Files:**
- Create: `packages/shared/src/content/defaultWeapons.ts`
- Create: `packages/shared/src/content/weapons.test.ts`
- Modify: `packages/shared/src/content/items.ts`
- Modify: `packages/shared/src/content/weapons.ts`
- Modify: `packages/shared/src/world/weapon.ts`
- Modify: `packages/shared/src/world/inventory.ts`
- Modify: `packages/shared/src/world/inventory.test.ts`
- Modify: `packages/shared/src/protocol/messages.ts`
- Modify: `packages/shared/src/protocol/schemas.test.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/content/weapons.test.ts`
- Test: `packages/shared/src/world/inventory.test.ts`
- Test: `packages/shared/src/protocol/schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/shared/src/content/weapons.test.ts` with this coverage:

```ts
import { describe, expect, it } from "vitest";

import { defaultWeapons } from "./defaultWeapons";
import {
  firearmWeaponDefinitionSchema,
  meleeWeaponDefinitionSchema,
  unarmedWeaponDefinitionSchema,
  weaponDefinitionSchema,
} from "./weapons";

describe("weapon content contracts", () => {
  it("parses firearm, melee, and unarmed weapon definitions", () => {
    expect(firearmWeaponDefinitionSchema.parse({
      itemId: "item_revolver",
      name: "Civilian Revolver",
      stackable: false,
      maxStack: 1,
      weaponType: "firearm",
      category: "firearm",
      config: {
        ammoItemId: "item_pistol-ammo",
        damagePerShot: 35,
        magazineSize: 6,
        range: 8,
        reloadTimeMs: 1_200,
        shotsPerSecond: 2,
        spread: 0,
      },
    })).toMatchObject({ weaponType: "firearm" });

    expect(meleeWeaponDefinitionSchema.parse({
      itemId: "item_pipe",
      name: "Steel Pipe",
      stackable: false,
      maxStack: 1,
      weaponType: "melee",
      category: "melee",
      config: {
        blockedZombieDamageMultiplier: 0.35,
        canBlock: true,
        damagePerHit: 20,
        range: 1.6,
        swingsPerSecond: 1.4,
      },
    })).toMatchObject({ weaponType: "melee" });

    expect(unarmedWeaponDefinitionSchema.parse({
      itemId: "item_unarmed",
      name: "Bare Hands",
      stackable: false,
      maxStack: 1,
      weaponType: "unarmed",
      category: "unarmed",
      config: {
        blockedZombieDamageMultiplier: 0.55,
        canBlock: true,
        damagePerHit: 8,
        range: 1.1,
        swingsPerSecond: 1.8,
      },
    })).toMatchObject({ weaponType: "unarmed" });
  });

  it("exports authored default weapon definitions for server and client consumers", () => {
    expect(defaultWeapons.map((weapon) => weapon.itemId)).toEqual([
      "item_revolver",
      "item_pipe",
      "item_unarmed",
    ]);
    expect(defaultWeapons.every((weapon) => weaponDefinitionSchema.safeParse(weapon).success)).toBe(true);
  });
});
```

Update `packages/shared/src/world/inventory.test.ts` to cover the new inventory action:

```ts
expect(
  inventoryActionSchema.parse({
    type: "stow",
  }),
).toMatchObject({ type: "stow" });
```

Update `packages/shared/src/protocol/schemas.test.ts` so the valid input payload includes `block: true` and the valid replicated player payload includes richer weapon state:

```ts
expect(
  clientMessageSchema.parse({
    type: "input",
    sequence: 17,
    movement: { x: 1, y: -1 },
    aim: { x: 0.25, y: 0.75 },
    actions: {
      aiming: true,
      block: true,
      fire: true,
      inventory: {
        type: "stow",
      },
      interact: true,
      reload: false,
    },
  }),
).toMatchObject({ type: "input", sequence: 17 });
```

And use this weapon state shape in the snapshot fixture:

```ts
weaponState: {
  fireCooldownRemainingMs: 120,
  isBlocking: false,
  isReloading: false,
  magazineAmmo: 12,
  reloadRemainingMs: 0,
  weaponItemId: "item_revolver",
  weaponType: "firearm",
},
```

- [ ] **Step 2: Run the shared tests to verify they fail**

Run from `packages/shared`:

```bash
pnpm test -- --run src/content/weapons.test.ts src/world/inventory.test.ts src/protocol/schemas.test.ts
```

Expected: FAIL because `defaultWeapons.ts` and `weapons.test.ts` do not exist yet, `inventoryActionSchema` does not know `stow`, `itemCategorySchema` does not allow `melee`, `clientMessageSchema` does not allow `block`, and `weaponStateSchema` does not include `weaponItemId` or `weaponType`.

- [ ] **Step 3: Write the minimal implementation**

Update `packages/shared/src/content/items.ts` so melee and unarmed weapon definitions are valid content categories:

```ts
export const itemCategorySchema = z.enum(["firearm", "melee", "unarmed", "ammo", "healing", "utility"]);
```

Replace `packages/shared/src/content/weapons.ts` with discriminated weapon-definition schemas:

```ts
import { z } from "zod";

import { itemIdSchema } from "../ids";

const weaponBaseSchema = z.object({
  itemId: itemIdSchema,
  name: z.string().min(1),
  stackable: z.boolean(),
  maxStack: z.number().int().positive(),
});

const firearmWeaponConfigSchema = z.object({
  ammoItemId: itemIdSchema,
  damagePerShot: z.number().positive(),
  magazineSize: z.number().int().positive(),
  range: z.number().positive(),
  reloadTimeMs: z.number().int().positive(),
  shotsPerSecond: z.number().positive(),
  spread: z.number().nonnegative(),
}).strict();

const blockingConfigSchema = z.object({
  blockedZombieDamageMultiplier: z.number().min(0).max(1),
  canBlock: z.boolean(),
}).strict();

const meleeWeaponConfigSchema = blockingConfigSchema.extend({
  damagePerHit: z.number().positive(),
  range: z.number().positive(),
  swingsPerSecond: z.number().positive(),
}).strict();

const unarmedWeaponConfigSchema = blockingConfigSchema.extend({
  damagePerHit: z.number().positive(),
  range: z.number().positive(),
  swingsPerSecond: z.number().positive(),
}).strict();

export const firearmWeaponDefinitionSchema = weaponBaseSchema.extend({
  category: z.literal("firearm"),
  weaponType: z.literal("firearm"),
  config: firearmWeaponConfigSchema,
}).strict();

export const meleeWeaponDefinitionSchema = weaponBaseSchema.extend({
  category: z.literal("melee"),
  weaponType: z.literal("melee"),
  config: meleeWeaponConfigSchema,
}).strict();

export const unarmedWeaponDefinitionSchema = weaponBaseSchema.extend({
  category: z.literal("unarmed"),
  weaponType: z.literal("unarmed"),
  config: unarmedWeaponConfigSchema,
}).strict();

export const weaponDefinitionSchema = z.discriminatedUnion("weaponType", [
  firearmWeaponDefinitionSchema,
  meleeWeaponDefinitionSchema,
  unarmedWeaponDefinitionSchema,
]);

export type FirearmWeaponDefinition = z.infer<typeof firearmWeaponDefinitionSchema>;
export type MeleeWeaponDefinition = z.infer<typeof meleeWeaponDefinitionSchema>;
export type UnarmedWeaponDefinition = z.infer<typeof unarmedWeaponDefinitionSchema>;
export type WeaponDefinition = z.infer<typeof weaponDefinitionSchema>;
export type WeaponType = WeaponDefinition["weaponType"];
```

Create `packages/shared/src/content/defaultWeapons.ts`:

```ts
import type { WeaponDefinition } from "./weapons";

export const defaultWeapons: WeaponDefinition[] = [
  {
    itemId: "item_revolver",
    name: "Civilian Revolver",
    stackable: false,
    maxStack: 1,
    weaponType: "firearm",
    category: "firearm",
    config: {
      ammoItemId: "item_pistol-ammo",
      damagePerShot: 35,
      magazineSize: 6,
      range: 8,
      reloadTimeMs: 1_200,
      shotsPerSecond: 2,
      spread: 0,
    },
  },
  {
    itemId: "item_pipe",
    name: "Steel Pipe",
    stackable: false,
    maxStack: 1,
    weaponType: "melee",
    category: "melee",
    config: {
      blockedZombieDamageMultiplier: 0.35,
      canBlock: true,
      damagePerHit: 20,
      range: 1.6,
      swingsPerSecond: 1.4,
    },
  },
  {
    itemId: "item_unarmed",
    name: "Bare Hands",
    stackable: false,
    maxStack: 1,
    weaponType: "unarmed",
    category: "unarmed",
    config: {
      blockedZombieDamageMultiplier: 0.55,
      canBlock: true,
      damagePerHit: 8,
      range: 1.1,
      swingsPerSecond: 1.8,
    },
  },
];
```

Extend `packages/shared/src/world/weapon.ts`:

```ts
import { z } from "zod";

import { itemIdSchema } from "../ids";

export const weaponTypeSchema = z.enum(["firearm", "melee", "unarmed"]);

export const weaponStateSchema = z.object({
  fireCooldownRemainingMs: z.number().finite().nonnegative(),
  isBlocking: z.boolean(),
  isReloading: z.boolean(),
  magazineAmmo: z.number().int().nonnegative(),
  reloadRemainingMs: z.number().finite().nonnegative(),
  weaponItemId: itemIdSchema,
  weaponType: weaponTypeSchema,
}).strict();

export type WeaponType = z.infer<typeof weaponTypeSchema>;
export type WeaponState = z.infer<typeof weaponStateSchema>;
```

Extend `packages/shared/src/world/inventory.ts` with `stow`:

```ts
export const stowInventoryActionSchema = z.object({
  type: z.literal("stow"),
}).strict();

export const inventoryActionSchema = z.discriminatedUnion("type", [
  pickupInventoryActionSchema,
  moveInventoryActionSchema,
  equipInventoryActionSchema,
  dropInventoryActionSchema,
  stowInventoryActionSchema,
]);
```

Extend `packages/shared/src/protocol/messages.ts` with `block`:

```ts
actions: z.object({
  aiming: z.boolean().optional(),
  block: z.boolean().optional(),
  fire: z.boolean().optional(),
  sprint: z.boolean().optional(),
  reload: z.boolean().optional(),
  interact: z.boolean().optional(),
  pickupEntityId: entityIdSchema.optional(),
  inventory: inventoryActionSchema.optional(),
}).strict(),
```

And export the new authored weapon content in `packages/shared/src/index.ts`:

```ts
export * from "./content/defaultWeapons";
```

- [ ] **Step 4: Run the shared tests to verify they pass**

Run from `packages/shared`:

```bash
pnpm test -- --run src/content/weapons.test.ts src/world/inventory.test.ts src/protocol/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/content/defaultWeapons.ts packages/shared/src/content/weapons.test.ts packages/shared/src/content/items.ts packages/shared/src/content/weapons.ts packages/shared/src/world/weapon.ts packages/shared/src/world/inventory.ts packages/shared/src/world/inventory.test.ts packages/shared/src/protocol/messages.ts packages/shared/src/protocol/schemas.test.ts packages/shared/src/index.ts
git commit -m "feat: add shared weapon type contracts"
```

### Task 2: Move Starter Gear Into Config And Spawn Weapon State From It

**Files:**
- Create: `apps/server/src/content/defaultStarterLoadout.ts`
- Create: `apps/server/src/sim/weapons.ts`
- Create: `apps/server/src/sim/state.test.ts`
- Modify: `apps/server/src/sim/state.ts`
- Modify: `apps/server/src/sim/query.ts`
- Modify: `apps/server/src/sim/query.test.ts`
- Modify: `apps/server/src/sim/systems/replicationSystem.test.ts`
- Test: `apps/server/src/sim/state.test.ts`
- Test: `apps/server/src/sim/query.test.ts`
- Test: `apps/server/src/sim/systems/replicationSystem.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/server/src/sim/state.test.ts` with these expectations:

```ts
import { describe, expect, it } from "vitest";

import { createRoomState, queueSpawnPlayer } from "./state";
import { createLifecycleSystem } from "./systems/lifecycleSystem";

describe("simulation state", () => {
  it("spawns the configured starter loadout with revolver, pipe, ammo, and firearm weapon state", () => {
    const state = createRoomState({ roomId: "room_test" });

    queueSpawnPlayer(state, {
      entityId: "player_test-1",
      displayName: "Avery",
      position: { x: 1, y: 1 },
    });
    createLifecycleSystem().update(state, 0);

    expect(state.players.get("player_test-1")).toMatchObject({
      inventory: {
        ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
        equippedWeaponSlot: 0,
        slots: [
          { itemId: "item_revolver", quantity: 1 },
          { itemId: "item_pipe", quantity: 1 },
          { itemId: "item_bandage", quantity: 1 },
          null,
          null,
          null,
        ],
      },
      weaponState: {
        fireCooldownRemainingMs: 0,
        isBlocking: false,
        isReloading: false,
        magazineAmmo: 6,
        reloadRemainingMs: 0,
        weaponItemId: "item_revolver",
        weaponType: "firearm",
      },
    });
  });
});
```

Update `apps/server/src/sim/query.test.ts` starter expectations to include the pipe and richer weapon state:

```ts
inventory: {
  ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
  equippedWeaponSlot: 0,
  slots: [
    { itemId: "item_revolver", quantity: 1 },
    { itemId: "item_pipe", quantity: 1 },
    { itemId: "item_bandage", quantity: 1 },
    null,
    null,
    null,
  ],
},
weaponState: {
  fireCooldownRemainingMs: 0,
  isBlocking: false,
  isReloading: false,
  magazineAmmo: 6,
  reloadRemainingMs: 0,
  weaponItemId: "item_revolver",
  weaponType: "firearm",
},
```

Update `apps/server/src/sim/systems/replicationSystem.test.ts` in the same way for entered nearby players.

- [ ] **Step 2: Run the server tests to verify they fail**

Run from `apps/server`:

```bash
pnpm test -- --run src/sim/state.test.ts src/sim/query.test.ts src/sim/systems/replicationSystem.test.ts
```

Expected: FAIL because the starter loadout config file and weapon helpers do not exist, spawned players still only get revolver plus bandage, and replicated weapon state does not include `weaponItemId` or `weaponType`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/server/src/content/defaultStarterLoadout.ts`:

```ts
export const defaultStarterLoadout = {
  ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
  equippedWeaponSlot: 0,
  slots: [
    { itemId: "item_revolver", quantity: 1, slotIndex: 0 },
    { itemId: "item_pipe", quantity: 1, slotIndex: 1 },
    { itemId: "item_bandage", quantity: 1, slotIndex: 2 },
  ],
} as const;
```

Create `apps/server/src/sim/weapons.ts`:

```ts
import type { WeaponDefinition, WeaponState } from "@2dayz/shared";

import type { RoomSimulationState, SimPlayer } from "./state";

export const UNARMED_WEAPON_ITEM_ID = "item_unarmed";

export const getWeaponDefinition = (state: RoomSimulationState, itemId: string | null): WeaponDefinition | null => {
  if (!itemId) {
    return state.weaponDefinitions.get(UNARMED_WEAPON_ITEM_ID) ?? null;
  }

  return state.weaponDefinitions.get(itemId) ?? state.weaponDefinitions.get(UNARMED_WEAPON_ITEM_ID) ?? null;
};

export const getActiveWeaponDefinition = (state: RoomSimulationState, player: SimPlayer): WeaponDefinition | null => {
  const slotIndex = player.inventory.equippedWeaponSlot;
  const slotItemId = slotIndex === null ? null : player.inventory.slots[slotIndex]?.itemId ?? null;
  return getWeaponDefinition(state, slotItemId);
};

export const createWeaponStateForDefinition = (weapon: WeaponDefinition): WeaponState => ({
  fireCooldownRemainingMs: 0,
  isBlocking: false,
  isReloading: false,
  magazineAmmo: weapon.weaponType === "firearm" ? weapon.config.magazineSize : 0,
  reloadRemainingMs: 0,
  weaponItemId: weapon.itemId,
  weaponType: weapon.weaponType,
});

export const syncPlayerWeaponState = (state: RoomSimulationState, player: SimPlayer) => {
  const activeWeapon = getActiveWeaponDefinition(state, player);
  if (!activeWeapon) {
    return;
  }

  const previous = player.weaponState;
  if (previous?.weaponItemId === activeWeapon.itemId && previous.weaponType === activeWeapon.weaponType) {
    previous.isBlocking = false;
    return;
  }

  player.weaponState = createWeaponStateForDefinition(activeWeapon);
};

export const getBlockedZombieDamageMultiplier = (state: RoomSimulationState, player: SimPlayer) => {
  if (!player.weaponState.isBlocking) {
    return 1;
  }

  const activeWeapon = getActiveWeaponDefinition(state, player);
  if (!activeWeapon || activeWeapon.weaponType === "firearm" || !activeWeapon.config.canBlock) {
    return 1;
  }

  return activeWeapon.config.blockedZombieDamageMultiplier;
};
```

Update `apps/server/src/sim/state.ts` to use shared default weapons and starter loadout:

```ts
import { INVENTORY_SLOT_COUNT, SERVER_TICK_RATE, defaultWeapons, type Health, type InputMessage, type Inventory, type ItemDefinition, type LootTable, type MapDefinition, type ServerEvent, type Transform, type Vector2, type Velocity, type WeaponDefinition, type ZombieArchetype } from "@2dayz/shared";

import { defaultStarterLoadout } from "../content/defaultStarterLoadout";
import { createWeaponStateForDefinition, getWeaponDefinition, UNARMED_WEAPON_ITEM_ID } from "./weapons";

const createStarterInventory = (): Inventory => {
  const inventory = createEmptyInventory();

  for (const slot of defaultStarterLoadout.slots) {
    inventory.slots[slot.slotIndex] = { itemId: slot.itemId, quantity: slot.quantity };
  }

  inventory.equippedWeaponSlot = defaultStarterLoadout.equippedWeaponSlot;
  inventory.ammoStacks = defaultStarterLoadout.ammoStacks.map((stack) => ({ ...stack }));

  return inventory;
};

export const createDefaultWeaponState = (weaponDefinitions: Map<string, WeaponDefinition>) => {
  const starterWeapon = weaponDefinitions.get("item_revolver") ?? weaponDefinitions.get(UNARMED_WEAPON_ITEM_ID);
  if (!starterWeapon) {
    throw new Error("starter weapon definition missing");
  }
  return createWeaponStateForDefinition(starterWeapon);
};

weaponDefinitions: new Map(defaultWeapons.map((weapon) => [weapon.itemId, { ...weapon }])),
```

Update `spawnPlayerNow` in `apps/server/src/sim/state.ts` to build `inventory` first, resolve the starter weapon from `state.weaponDefinitions`, and then create the player:

```ts
const inventory = createStarterInventory();
const starterWeapon = getWeaponDefinition(state, inventory.slots[inventory.equippedWeaponSlot ?? 0]?.itemId ?? null);
if (!starterWeapon) {
  throw new Error("starter weapon definition missing");
}

state.players.set(request.entityId, {
  entityId: request.entityId,
  displayName: request.displayName,
  transform: {
    x: request.position.x,
    y: request.position.y,
    rotation: 0,
  },
  velocity: { x: 0, y: 0 },
  health: createDefaultHealth(),
  stamina: { current: staminaMax, max: staminaMax },
  inventory,
  weaponState: createWeaponStateForDefinition(starterWeapon),
  lastDamagedByEntityId: null,
});
```

`apps/server/src/sim/query.ts` does not need new branching logic; keep returning `player.weaponState` exactly as authored by the runtime.

- [ ] **Step 4: Run the server tests to verify they pass**

Run from `apps/server`:

```bash
pnpm test -- --run src/sim/state.test.ts src/sim/query.test.ts src/sim/systems/replicationSystem.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/content/defaultStarterLoadout.ts apps/server/src/sim/weapons.ts apps/server/src/sim/state.test.ts apps/server/src/sim/state.ts apps/server/src/sim/query.ts apps/server/src/sim/query.test.ts apps/server/src/sim/systems/replicationSystem.test.ts
git commit -m "feat: configure starter loadout and weapon state"
```

### Task 3: Make Combat Resolve Firearm, Melee, And Unarmed Attacks

**Files:**
- Modify: `apps/server/src/sim/systems/combatSystem.ts`
- Modify: `apps/server/src/sim/systems/combatSystem.test.ts`
- Test: `apps/server/src/sim/systems/combatSystem.test.ts`

- [ ] **Step 1: Write the failing combat tests**

Add these tests in `apps/server/src/sim/systems/combatSystem.test.ts`:

```ts
it("uses firearm config damage and shot cadence from authored weapon definitions", () => {
  const state = createRoomState({ roomId: "room_test" });
  const attacker = spawnPlayer(state, "player_test-config-1", "Avery", 0, 0);
  const target = spawnPlayer(state, "player_test-config-2", "Blair", 4, 0);

  const revolver = state.weaponDefinitions.get("item_revolver");
  if (!revolver || revolver.weaponType !== "firearm") {
    throw new Error("expected revolver definition");
  }

  revolver.config.damagePerShot = 22;
  revolver.config.shotsPerSecond = 4;

  queueInputIntent(state, attacker.entityId, {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    actions: { fire: true },
  });

  createCombatSystem().update(state, 0.1);

  expect(target.health.current).toBe(78);
  expect(attacker.weaponState.fireCooldownRemainingMs).toBe(250);
});

it("uses equipped melee weapon stats when the player attacks in melee range", () => {
  const state = createRoomState({ roomId: "room_test" });
  const attacker = spawnPlayer(state, "player_test-melee-1", "Avery", 0, 0);
  const target = spawnPlayer(state, "player_test-melee-2", "Blair", 1.2, 0);

  attacker.inventory.equippedWeaponSlot = 1;
  attacker.weaponState = {
    fireCooldownRemainingMs: 0,
    isBlocking: false,
    isReloading: false,
    magazineAmmo: 0,
    reloadRemainingMs: 0,
    weaponItemId: "item_pipe",
    weaponType: "melee",
  };

  queueInputIntent(state, attacker.entityId, {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    actions: { fire: true },
  });

  createCombatSystem().update(state, 0.1);

  expect(target.health.current).toBe(80);
  expect(state.events).toContainEqual(expect.objectContaining({
    type: "combat",
    weaponItemId: "item_pipe",
  }));
});

it("lets a stowed player punch instead of needing a weapon slot", () => {
  const state = createRoomState({ roomId: "room_test" });
  const attacker = spawnPlayer(state, "player_test-unarmed-1", "Avery", 0, 0);
  const target = spawnPlayer(state, "player_test-unarmed-2", "Blair", 0.8, 0);

  attacker.inventory.equippedWeaponSlot = null;
  attacker.weaponState = {
    fireCooldownRemainingMs: 0,
    isBlocking: false,
    isReloading: false,
    magazineAmmo: 0,
    reloadRemainingMs: 0,
    weaponItemId: "item_unarmed",
    weaponType: "unarmed",
  };

  queueInputIntent(state, attacker.entityId, {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    actions: { fire: true },
  });

  createCombatSystem().update(state, 0.1);

  expect(target.health.current).toBe(92);
  expect(state.events).toContainEqual(expect.objectContaining({
    type: "combat",
    weaponItemId: "item_unarmed",
  }));
});

it("does not auto-punch when an empty firearm is still equipped", () => {
  const state = createRoomState({ roomId: "room_test" });
  const attacker = spawnPlayer(state, "player_test-empty-firearm-1", "Avery", 0, 0);
  const target = spawnPlayer(state, "player_test-empty-firearm-2", "Blair", 1, 0);

  attacker.weaponState.magazineAmmo = 0;

  queueInputIntent(state, attacker.entityId, {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    actions: { fire: true },
  });

  createCombatSystem().update(state, 0.1);

  expect(target.health.current).toBe(100);
  expect(state.events).toEqual([]);
});
```

- [ ] **Step 2: Run the combat tests to verify they fail**

Run from `apps/server`:

```bash
pnpm test -- --run src/sim/systems/combatSystem.test.ts
```

Expected: FAIL because combat only understands firearm damage, reload, and hitscan cadence, and it has no unarmed or melee branches.

- [ ] **Step 3: Write the minimal combat implementation**

Update `apps/server/src/sim/systems/combatSystem.ts` to resolve the active weapon via `sim/weapons.ts` and branch by `weaponType`:

```ts
import type { FirearmWeaponDefinition, MeleeWeaponDefinition, UnarmedWeaponDefinition } from "@2dayz/shared";

import { getActiveWeaponDefinition } from "../weapons";

const getAttackRange = (weapon: FirearmWeaponDefinition | MeleeWeaponDefinition | UnarmedWeaponDefinition) => {
  return weapon.weaponType === "firearm" ? weapon.config.range : weapon.config.range;
};

const getAttackDamage = (weapon: FirearmWeaponDefinition | MeleeWeaponDefinition | UnarmedWeaponDefinition) => {
  return weapon.weaponType === "firearm" ? weapon.config.damagePerShot : weapon.config.damagePerHit;
};

const getAttackCooldownMs = (weapon: FirearmWeaponDefinition | MeleeWeaponDefinition | UnarmedWeaponDefinition) => {
  return weapon.weaponType === "firearm"
    ? 1000 / weapon.config.shotsPerSecond
    : 1000 / weapon.config.swingsPerSecond;
};

const canUsePrimaryAttack = (weapon: FirearmWeaponDefinition | MeleeWeaponDefinition | UnarmedWeaponDefinition, player: SimPlayer, aim: { x: number; y: number }) => {
  if (player.weaponState.isReloading || player.weaponState.fireCooldownRemainingMs > 0 || Math.hypot(aim.x, aim.y) === 0) {
    return false;
  }

  if (weapon.weaponType !== "firearm") {
    return true;
  }

  return player.weaponState.magazineAmmo > 0;
};
```

Inside the main `update()` loop, replace firearm-only resolution with this structure:

```ts
const weapon = getActiveWeaponDefinition(state, player);
if (!weapon) {
  intent.actions.fire = undefined;
  intent.actions.reload = undefined;
  continue;
}

player.weaponState.isBlocking = false;

if (
  intent.actions.reload &&
  weapon.weaponType === "firearm" &&
  !player.weaponState.isReloading &&
  player.weaponState.magazineAmmo < weapon.config.magazineSize &&
  player.inventory.ammoStacks.some((stack) => stack.ammoItemId === weapon.config.ammoItemId && stack.quantity > 0)
) {
  player.weaponState.isReloading = true;
  player.weaponState.reloadRemainingMs = weapon.config.reloadTimeMs;
  state.dirtyPlayerIds.add(player.entityId);
}

if (intent.actions.fire && canUsePrimaryAttack(weapon, player, intent.aim)) {
  if (weapon.weaponType === "firearm") {
    player.weaponState.magazineAmmo -= 1;
    const spreadAim = applySpreadToAim(intent.aim, weapon.config.spread, random);
    state.events.push({
      type: "shot",
      roomId: state.roomId,
      attackerEntityId: player.entityId,
      weaponItemId: weapon.itemId,
      origin: { x: player.transform.x, y: player.transform.y },
      aim: spreadAim,
    });
    const hitTarget = findHitTarget(state, player, spreadAim, weapon.config.range);
    if (hitTarget) {
      hitTarget.apply(weapon.config.damagePerShot);
      state.events.push({
        type: "combat",
        roomId: state.roomId,
        attackerEntityId: player.entityId,
        targetEntityId: hitTarget.entityId,
        weaponItemId: weapon.itemId,
        damage: weapon.config.damagePerShot,
        remainingHealth: hitTarget.healthCurrent(),
        hitPosition: hitTarget.position,
      });
      hitTarget.markDirty();
    }
  } else {
    const hitTarget = findHitTarget(state, player, intent.aim, weapon.config.range);
    if (hitTarget) {
      hitTarget.apply(weapon.config.damagePerHit);
      state.events.push({
        type: "combat",
        roomId: state.roomId,
        attackerEntityId: player.entityId,
        targetEntityId: hitTarget.entityId,
        weaponItemId: weapon.itemId,
        damage: weapon.config.damagePerHit,
        remainingHealth: hitTarget.healthCurrent(),
        hitPosition: hitTarget.position,
      });
      hitTarget.markDirty();
    }
  }

  player.weaponState.fireCooldownRemainingMs = getAttackCooldownMs(weapon);
  state.dirtyPlayerIds.add(player.entityId);
}
```

Update the reload completion path to guard on firearm-only config:

```ts
if (weapon && weapon.weaponType === "firearm") {
  consumeAmmoForReload(player, weapon.config.ammoItemId, weapon.config.magazineSize);
}
```

- [ ] **Step 4: Run the combat tests to verify they pass**

Run from `apps/server`:

```bash
pnpm test -- --run src/sim/systems/combatSystem.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/sim/systems/combatSystem.ts apps/server/src/sim/systems/combatSystem.test.ts
git commit -m "feat: resolve combat by weapon type"
```

### Task 4: Wire Stow, Loot, Blocking, And Respawn Through The Server Runtime

**Files:**
- Modify: `apps/server/src/content/defaultItems.ts`
- Modify: `apps/server/src/content/defaultLootTable.ts`
- Modify: `apps/server/src/sim/systems/inventorySystem.ts`
- Modify: `apps/server/src/sim/systems/inventorySystem.test.ts`
- Modify: `apps/server/src/sim/systems/lootSystem.test.ts`
- Modify: `apps/server/src/sim/systems/zombieSystem.ts`
- Modify: `apps/server/src/sim/systems/zombieSystem.test.ts`
- Modify: `apps/server/src/rooms/respawn.ts`
- Modify: `apps/server/src/rooms/respawn.test.ts`
- Test: `apps/server/src/sim/systems/inventorySystem.test.ts`
- Test: `apps/server/src/sim/systems/lootSystem.test.ts`
- Test: `apps/server/src/sim/systems/zombieSystem.test.ts`
- Test: `apps/server/src/rooms/respawn.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Add these tests to `apps/server/src/sim/systems/inventorySystem.test.ts`:

```ts
it("stows to unarmed when the authoritative inventory action is stow", () => {
  const state = createRoomState({ roomId: "room_test" });

  queueSpawnPlayer(state, {
    entityId: "player_test-stow",
    displayName: "Avery",
    position: { x: 1, y: 1 },
  });
  createLifecycleSystem().update(state, 0);

  queueInputIntent(state, "player_test-stow", {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    actions: {
      inventory: { type: "stow" },
    },
  });

  createInventorySystem().update(state, 0);

  expect(state.players.get("player_test-stow")).toMatchObject({
    inventory: { equippedWeaponSlot: null },
    weaponState: { weaponItemId: "item_unarmed", weaponType: "unarmed" },
  });
});

it("treats equipping an empty slot as unarmed instead of keeping the previous weapon selected", () => {
  const state = createRoomState({ roomId: "room_test" });

  queueSpawnPlayer(state, {
    entityId: "player_test-empty-slot",
    displayName: "Avery",
    position: { x: 1, y: 1 },
  });
  createLifecycleSystem().update(state, 0);

  queueInputIntent(state, "player_test-empty-slot", {
    sequence: 1,
    movement: { x: 0, y: 0 },
    aim: { x: 1, y: 0 },
    actions: {
      inventory: { type: "equip", toSlot: 5 },
    },
  });

  createInventorySystem().update(state, 0);

  expect(state.players.get("player_test-empty-slot")).toMatchObject({
    inventory: { equippedWeaponSlot: null },
    weaponState: { weaponItemId: "item_unarmed", weaponType: "unarmed" },
  });
});
```

Update `apps/server/src/sim/systems/lootSystem.test.ts` to assert the police table can spawn the melee weapon when the weighted roll reaches that entry:

```ts
createLootSystem({ random: () => 0.95 }).update(state, 0);

expect([...state.loot.values()].map((loot) => loot.itemId)).toContain("item_pipe");
```

Add this zombie block test to `apps/server/src/sim/systems/zombieSystem.test.ts`:

```ts
it("reduces zombie attack damage while the target is blocking with an allowed weapon state", () => {
  const state = createRoomState({ roomId: "room_test" });
  const player = spawnPlayer(state, "player_test-block", "Avery", { x: 1.5, y: 1 });

  player.inventory.equippedWeaponSlot = null;
  player.weaponState = {
    fireCooldownRemainingMs: 0,
    isBlocking: true,
    isReloading: false,
    magazineAmmo: 0,
    reloadRemainingMs: 0,
    weaponItemId: "item_unarmed",
    weaponType: "unarmed",
  };

  state.zombies.set("zombie_test-1", {
    entityId: "zombie_test-1",
    archetypeId: "zombie_shambler",
    transform: { x: 1, y: 1, rotation: 0 },
    velocity: { x: 0, y: 0 },
    health: { current: 60, max: 60, isDead: false },
    state: "idle",
    aggroTargetEntityId: null,
    attackCooldownRemainingMs: 0,
    lostTargetMs: 0,
  });

  createZombieSystem().update(state, 0.1);

  expect(player.health.current).toBe(94);
});
```

Add this respawn assertion to `apps/server/src/rooms/respawn.test.ts` after the existing health/position checks:

```ts
expect(player.weaponState).toMatchObject({
  fireCooldownRemainingMs: 0,
  isBlocking: false,
  isReloading: false,
  magazineAmmo: 0,
  reloadRemainingMs: 0,
  weaponItemId: "item_unarmed",
  weaponType: "unarmed",
});
```

- [ ] **Step 2: Run the server integration tests to verify they fail**

Run from `apps/server`:

```bash
pnpm test -- --run src/sim/systems/inventorySystem.test.ts src/sim/systems/lootSystem.test.ts src/sim/systems/zombieSystem.test.ts src/rooms/respawn.test.ts
```

Expected: FAIL because there is no `stow` handling in the inventory system, no melee item in default content or loot tables, zombie attacks ignore block state, and respawn leaves stale dead-player weapon state behind.

- [ ] **Step 3: Write the minimal integration implementation**

Add the melee item to `apps/server/src/content/defaultItems.ts`:

```ts
{
  itemId: "item_pipe",
  name: "Steel Pipe",
  category: "melee",
  stackable: false,
  maxStack: 1,
},
```

Add the melee item to `apps/server/src/content/defaultLootTable.ts` so it can be found without dominating the table:

```ts
{
  itemId: "item_pipe",
  weight: 1,
  minQuantity: 1,
  maxQuantity: 1,
},
```

Update `apps/server/src/sim/systems/inventorySystem.ts` to sync active weapon state whenever the player stows, equips a weapon, or clears inventory on death:

```ts
import { syncPlayerWeaponState } from "../weapons";

const handleEquipAction = (state: RoomSimulationState, player: SimPlayer): void => {
  const action = state.inputIntents.get(player.entityId)?.actions.inventory;
  if (!action) {
    return;
  }

  if (action.type === "stow") {
    player.inventory.equippedWeaponSlot = null;
    syncPlayerWeaponState(state, player);
    state.dirtyPlayerIds.add(player.entityId);
    return;
  }

  if (action.type !== "equip") {
    return;
  }

  const slot = player.inventory.slots[action.toSlot];
  const itemId = slot?.itemId ?? null;
  const nextWeapon = itemId ? state.weaponDefinitions.get(itemId) : null;

  player.inventory.equippedWeaponSlot = nextWeapon ? action.toSlot : null;
  syncPlayerWeaponState(state, player);
  state.dirtyPlayerIds.add(player.entityId);
};
```

When picking up gear into a selected slot, auto-equip only authored weapons:

```ts
const pickedUpWeapon = state.weaponDefinitions.get(loot.itemId);
if (pickedUpWeapon && pickedUpWeapon.weaponType !== "unarmed") {
  player.inventory.equippedWeaponSlot = slotIndex;
  syncPlayerWeaponState(state, player);
}
```

After death-drop inventory clearing, sync to unarmed instead of leaving a stale firearm state:

```ts
player.inventory.slots = Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
player.inventory.equippedWeaponSlot = null;
player.inventory.ammoStacks = [];
syncPlayerWeaponState(state, player);
player.weaponState.fireCooldownRemainingMs = 0;
player.weaponState.isBlocking = false;
player.weaponState.isReloading = false;
player.weaponState.reloadRemainingMs = 0;
```

Update `apps/server/src/sim/systems/zombieSystem.ts` to apply block reduction only when the player is actively blocking with melee or unarmed:

```ts
import { getBlockedZombieDamageMultiplier } from "../weapons";

if (zombie.attackCooldownRemainingMs === 0) {
  const blockedDamageMultiplier = getBlockedZombieDamageMultiplier(state, target);
  const attackDamage = Math.max(0, Math.round(archetype.attackDamage * blockedDamageMultiplier));

  target.health.current = Math.max(0, target.health.current - attackDamage);
  target.health.isDead = target.health.current === 0;
  target.lastDamagedByEntityId = zombie.entityId;
  zombie.attackCooldownRemainingMs = attackCooldownMs;
  state.dirtyPlayerIds.add(target.entityId);
}
```

Update `apps/server/src/rooms/respawn.ts` so respawned players become coherently unarmed:

```ts
import { syncPlayerWeaponState } from "../sim/weapons";

player.lastDamagedByEntityId = null;
syncPlayerWeaponState(state, player);
player.weaponState.fireCooldownRemainingMs = 0;
player.weaponState.isBlocking = false;
player.weaponState.isReloading = false;
player.weaponState.reloadRemainingMs = 0;
```

- [ ] **Step 4: Run the server integration tests to verify they pass**

Run from `apps/server`:

```bash
pnpm test -- --run src/sim/systems/inventorySystem.test.ts src/sim/systems/lootSystem.test.ts src/sim/systems/zombieSystem.test.ts src/rooms/respawn.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/content/defaultItems.ts apps/server/src/content/defaultLootTable.ts apps/server/src/sim/systems/inventorySystem.ts apps/server/src/sim/systems/inventorySystem.test.ts apps/server/src/sim/systems/lootSystem.test.ts apps/server/src/sim/systems/zombieSystem.ts apps/server/src/sim/systems/zombieSystem.test.ts apps/server/src/rooms/respawn.ts apps/server/src/rooms/respawn.test.ts
git commit -m "feat: add stow, melee loot, and zombie blocking"
```

### Task 5: Restore Weapon Selection UI And Map Client Input To Aim, Block, And Stow

**Files:**
- Modify: `apps/client/src/game/input/keymap.ts`
- Modify: `apps/client/src/game/input/inputController.ts`
- Modify: `apps/client/src/game/input/inputController.test.ts`
- Modify: `apps/client/src/game/boot.ts`
- Modify: `apps/client/src/game/boot.test.ts`
- Modify: `apps/client/src/game/state/clientGameStore.ts`
- Modify: `apps/client/src/game/state/clientGameStore.test.ts`
- Modify: `apps/client/src/game/ui/CombatHud.tsx`
- Modify: `apps/client/src/game/ui/CombatHud.test.tsx`
- Modify: `apps/client/src/game/ui/QuickbarHud.tsx`
- Modify: `apps/client/src/game/ui/QuickbarHud.test.tsx`
- Modify: `apps/client/src/game/ui/Hud.tsx`
- Modify: `apps/client/src/game/ui/ControlsOverlay.tsx`
- Modify: `apps/client/src/game/ui/ControlsOverlay.test.tsx`
- Modify: `apps/client/src/App.tsx`
- Modify: `apps/client/src/App.test.tsx`
- Modify: `apps/client/src/styles.css`
- Test: `apps/client/src/game/input/inputController.test.ts`
- Test: `apps/client/src/game/state/clientGameStore.test.ts`
- Test: `apps/client/src/game/ui/CombatHud.test.tsx`
- Test: `apps/client/src/game/ui/QuickbarHud.test.tsx`
- Test: `apps/client/src/App.test.tsx`

- [ ] **Step 1: Write the failing client tests**

Add these tests to `apps/client/src/game/input/inputController.test.ts`:

```ts
it("maps right click to block instead of aiming when the active weapon is melee", () => {
  const element = document.createElement("div");
  document.body.append(element);
  installPointerLockMocks(element);

  const controller = createInputController({
    element,
    getActiveWeaponType: () => "melee",
  });

  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 2 }));

  expect(controller.getViewState()).toEqual({
    isAiming: false,
    pitch: 0,
    yaw: 0,
  });
  expect(controller.pollInput(1)).toEqual({
    actions: { block: true },
    aim: { x: 1, y: 0 },
    movement: { x: 0, y: 0 },
    sequence: 1,
    type: "input",
  });

  controller.destroy();
});

it("queues stow on X keydown without repeating while the key is held", () => {
  const element = document.createElement("div");
  document.body.append(element);
  const onStowWeapon = vi.fn();

  const controller = createInputController({
    element,
    onStowWeapon,
  });

  window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "x", repeat: true }));

  expect(onStowWeapon).toHaveBeenCalledTimes(1);

  controller.destroy();
});
```

Replace the empty-slot client-store test in `apps/client/src/game/state/clientGameStore.test.ts` with this expectation:

```ts
it("switches to unarmed when selecting an empty inventory slot", () => {
  const store = createClientGameStore();

  store.completeJoin({
    displayName: "Survivor",
    playerEntityId: "player_self",
    roomId: "room_browser-v1",
  });

  store.applySnapshot({
    loot: [],
    playerEntityId: "player_self",
    players: [{
      displayName: "Survivor",
      entityId: "player_self",
      health: { current: 90, isDead: false, max: 100 },
      inventory: {
        ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: 18 }],
        equippedWeaponSlot: 0,
        slots: [
          { itemId: "item_revolver", quantity: 1 },
          null,
          null,
          null,
          null,
          null,
        ],
      },
      stamina: { current: 10, max: 10 },
      transform: { rotation: 0, x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      weaponState: {
        fireCooldownRemainingMs: 0,
        isBlocking: false,
        isReloading: false,
        magazineAmmo: 6,
        reloadRemainingMs: 0,
        weaponItemId: "item_revolver",
        weaponType: "firearm",
      },
    }],
    roomId: "room_browser-v1",
    tick: 30,
    type: "snapshot",
    zombies: [],
  });

  store.selectInventorySlot(1);

  expect(store.getState().inventory.equippedWeaponSlot).toBeNull();
});
```

Update `apps/client/src/game/ui/CombatHud.test.tsx` to use the richer weapon state and assert block availability:

```ts
render(
  <CombatHud
    health={health}
    inventoryAmmo={12}
    weaponLabel="Steel Pipe"
    weaponState={{
      fireCooldownRemainingMs: 0,
      isBlocking: false,
      isReloading: false,
      magazineAmmo: 0,
      reloadRemainingMs: 0,
      weaponItemId: "item_pipe",
      weaponType: "melee",
    }}
  />,
);

expect(screen.getByText(/weapon steel pipe/i)).toBeInTheDocument();
expect(screen.getByText(/block ready/i)).toBeInTheDocument();
expect(screen.queryByText(/ammo/i)).not.toBeInTheDocument();
```

Update `apps/client/src/game/ui/QuickbarHud.test.tsx` so clicking an empty slot still calls the handler and a stowed inventory has no pressed slot:

```ts
const stowedInventory: Inventory = {
  ...inventory,
  equippedWeaponSlot: null,
};

render(<QuickbarHud inventory={stowedInventory} onSelectSlot={onSelectSlot} />);

expect(screen.getByRole("button", { name: /quickbar slot 3, empty, unarmed/i })).toHaveAttribute("aria-pressed", "false");
expect(screen.getByRole("button", { name: /quickbar slot 1, weapon_rifle x1, not equipped/i })).toHaveAttribute("aria-pressed", "false");
```

Update the joined-shell assertion helper in `apps/client/src/App.test.tsx` to expect the quickbar again:

```ts
const expectJoinedShell = () => {
  expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/quickbar/i)).toBeInTheDocument();
};
```

And update `apps/client/src/game/ui/ControlsOverlay.test.tsx` to expect:

```ts
expect(controls).toEqual([
  "Click to capture mouse",
  "Mouse aim",
  "Left click attack",
  "Right click aim/block",
  "R reload",
  "X stow weapon",
  "Tab inventory",
  "WASD move",
  "E interact",
]);
```

- [ ] **Step 2: Run the client tests to verify they fail**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/input/inputController.test.ts src/game/state/clientGameStore.test.ts src/game/ui/CombatHud.test.tsx src/game/ui/QuickbarHud.test.tsx src/App.test.tsx src/game/ui/ControlsOverlay.test.tsx
```

Expected: FAIL because the input controller does not know weapon type or stow callbacks, the store leaves empty-slot selection unchanged, the HUD is firearm-only, the quickbar is not mounted in the joined shell, and the control copy is outdated.

- [ ] **Step 3: Write the minimal client implementation**

Add the stow key in `apps/client/src/game/input/keymap.ts`:

```ts
export const ACTION_KEYS = {
  interact: ["e"],
  inventory: ["tab"],
  reload: ["r"],
  sprint: ["shift"],
  stow: ["x"],
} as const;
```

Extend `createInputController` in `apps/client/src/game/input/inputController.ts`:

```ts
export const createInputController = ({
  element,
  getActiveWeaponType,
  isEnabled,
  onStowWeapon,
  onToggleInventory,
}: {
  element: HTMLElement;
  getActiveWeaponType?: () => "firearm" | "melee" | "unarmed" | null;
  isEnabled?: () => boolean;
  onStowWeapon?: () => void;
  onToggleInventory?: () => void;
}) => {
  let isBlocking = false;
```

Handle stow and right-click mode switching:

```ts
if (isMatchingKey(key, ACTION_KEYS.stow)) {
  if (!event.repeat) {
    onStowWeapon?.();
  }
  return;
}

if (event.button === 2) {
  event.preventDefault();
  const activeWeaponType = getActiveWeaponType?.() ?? "unarmed";
  if (activeWeaponType === "firearm") {
    isAiming = true;
  } else {
    isBlocking = true;
  }
  requestPointerCapture();
}
```

Reset and poll block state:

```ts
const clearPointerCaptureState = () => {
  isAiming = false;
  isBlocking = false;
  isFiring = false;
};

if (event.button === 2) {
  isAiming = false;
  isBlocking = false;
}

actions: {
  ...(isAiming ? { aiming: true } : {}),
  ...(isBlocking ? { block: true } : {}),
  ...(isFiring ? { fire: true } : {}),
  ...(isSprinting ? { sprint: true } : {}),
  ...(queuedActions.interact ? { interact: true } : {}),
  ...(queuedActions.reload ? { reload: true } : {}),
},
```

Wire those callbacks in `apps/client/src/game/boot.ts`:

```ts
const inputController = createInputController({
  element: canvas,
  getActiveWeaponType: () => store.getState().weaponState?.weaponType ?? "unarmed",
  isEnabled: () => store.getState().connectionState.phase === "joined",
  onStowWeapon: () => {
    store.stowWeapon?.();
    store.queueInventoryAction?.({ type: "stow" });
  },
  onToggleInventory: () => store.toggleInventory(),
});
```

Add the local stow helper and empty-slot unarmed behavior in `apps/client/src/game/state/clientGameStore.ts`:

```ts
selectInventorySlot(slotIndex: number) {
  update((current) => {
    if (slotIndex < 0 || slotIndex >= current.inventory.slots.length) {
      return current;
    }

    const nextSlot = current.inventory.slots[slotIndex];
    return {
      ...current,
      inventory: {
        ...current.inventory,
        equippedWeaponSlot: nextSlot ? slotIndex : null,
      },
    };
  });
},
stowWeapon() {
  update((current) => ({
    ...current,
    inventory: {
      ...current.inventory,
      equippedWeaponSlot: null,
    },
  }));
},
```

Make the HUD weapon-aware in `apps/client/src/game/ui/CombatHud.tsx`:

```tsx
type CombatHudProps = {
  health: Health | null;
  inventoryAmmo: number;
  weaponLabel: string;
  weaponState: WeaponState | null;
};

export const CombatHud = ({ health, inventoryAmmo, weaponLabel, weaponState }: CombatHudProps) => {
  const healthLabel = health ? `Health ${health.current}/${health.max}` : "Health pending";
  const weaponType = weaponState?.weaponType ?? "unarmed";
  const weaponStatus = `Weapon ${weaponLabel}`;
  const ammoLabel = weaponType === "firearm" ? `Ammo ${weaponState?.magazineAmmo ?? 0}/${inventoryAmmo}` : null;
  const blockLabel = weaponType === "firearm" ? null : weaponState?.isBlocking ? "Blocking" : "Block ready";

  return (
    <section aria-label="combat hud" className="combat-hud">
      <div aria-label="crosshair" className="combat-crosshair">
        <span className="combat-crosshair-line combat-crosshair-line-horizontal" />
        <span className="combat-crosshair-line combat-crosshair-line-vertical" />
      </div>
      <div className="combat-hud-panel">
        <p className="combat-hud-kicker">Combat HUD</p>
        <div className="combat-hud-readouts">
          <p>{healthLabel}</p>
          <p>{weaponStatus}</p>
          {ammoLabel ? <p>{ammoLabel}</p> : null}
          {blockLabel ? <p>{blockLabel}</p> : null}
        </div>
      </div>
    </section>
  );
};
```

Make quickbar empty/stowed state legible in `apps/client/src/game/ui/QuickbarHud.tsx`:

```tsx
const itemLabel = slot ? `${slot.itemId} x${slot.quantity}` : "Empty";
const isEquipped = inventory.equippedWeaponSlot === index;
const stateLabel = slot ? (isEquipped ? "equipped" : "not equipped") : "unarmed";

aria-label={`Quickbar slot ${index + 1}, ${itemLabel}, ${stateLabel}`}
```

Repurpose `apps/client/src/game/ui/Hud.tsx` into the joined-state wrapper:

```tsx
import type { Inventory } from "@2dayz/shared";

import { InventoryPanel } from "./InventoryPanel";
import { QuickbarHud } from "./QuickbarHud";

type HudProps = {
  inventory: Inventory;
  isInventoryOpen: boolean;
  onSelectSlot: (slotIndex: number) => void;
  onToggleInventory: () => void;
};

export const Hud = ({ inventory, isInventoryOpen, onSelectSlot, onToggleInventory }: HudProps) => {
  return (
    <>
      <QuickbarHud inventory={inventory} onSelectSlot={onSelectSlot} />
      <InventoryPanel inventory={inventory} isOpen={isInventoryOpen} onToggle={onToggleInventory} />
    </>
  );
};
```

Update `apps/client/src/App.tsx` to consume shared weapon metadata and restore the quickbar/inventory HUD:

```tsx
import { defaultWeapons, type WeaponType } from "@2dayz/shared";

import { Hud } from "./game/ui/Hud";

const weaponByItemId = Object.fromEntries(defaultWeapons.map((weapon) => [weapon.itemId, weapon]));

const getEquippedReserveAmmo = (inventory: Inventory, weaponState: { weaponItemId: string; weaponType: WeaponType } | null) => {
  if (!weaponState || weaponState.weaponType !== "firearm") {
    return 0;
  }

  const weapon = weaponByItemId[weaponState.weaponItemId];
  if (!weapon || weapon.weaponType !== "firearm") {
    return 0;
  }

  return inventory.ammoStacks
    .filter((stack) => stack.ammoItemId === weapon.config.ammoItemId)
    .reduce((total, stack) => total + stack.quantity, 0);
};

const activeWeaponLabel = weaponByItemId[state.weaponState?.weaponItemId ?? "item_unarmed"]?.name ?? "Bare Hands";
const inventoryAmmo = getEquippedReserveAmmo(state.inventory, state.weaponState);
```

Render the restored joined-state HUD:

```tsx
<section className="game-shell" aria-label="game shell">
  <div className="game-hud-layer">
    <CombatHud
      health={state.health}
      inventoryAmmo={inventoryAmmo}
      weaponLabel={activeWeaponLabel}
      weaponState={state.weaponState}
    />
    <Hud
      inventory={state.inventory}
      isInventoryOpen={state.isInventoryOpen}
      onSelectSlot={(slotIndex) => {
        const slot = state.inventory.slots[slotIndex];
        gameStore.selectInventorySlot(slotIndex);
        gameStore.queueInventoryAction(slot ? { type: "equip", toSlot: slotIndex } : { type: "stow" });
      }}
      onToggleInventory={() => gameStore.toggleInventory()}
    />
  </div>
</section>
```

Update `apps/client/src/game/ui/ControlsOverlay.tsx` with the new copy:

```tsx
<ul>
  <li>Click to capture mouse</li>
  <li>Mouse aim</li>
  <li>Left click attack</li>
  <li>Right click aim/block</li>
  <li>R reload</li>
  <li>X stow weapon</li>
  <li>Tab inventory</li>
  <li>WASD move</li>
  <li>E interact</li>
</ul>
```

Add small joined-HUD CSS in `apps/client/src/styles.css`:

```css
.quickbar-hud {
  pointer-events: auto;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  align-self: stretch;
}

.quickbar-slot {
  display: grid;
  gap: 6px;
  border-radius: 14px;
  border: 1px solid rgba(200, 179, 138, 0.22);
  background: rgba(24, 21, 19, 0.9);
  color: inherit;
  padding: 10px;
}

.quickbar-slot[data-equipped="true"] {
  border-color: rgba(216, 185, 128, 0.7);
}
```

- [ ] **Step 4: Run the client tests to verify they pass**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/input/inputController.test.ts src/game/state/clientGameStore.test.ts src/game/ui/CombatHud.test.tsx src/game/ui/QuickbarHud.test.tsx src/App.test.tsx src/game/ui/ControlsOverlay.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/game/input/keymap.ts apps/client/src/game/input/inputController.ts apps/client/src/game/input/inputController.test.ts apps/client/src/game/boot.ts apps/client/src/game/boot.test.ts apps/client/src/game/state/clientGameStore.ts apps/client/src/game/state/clientGameStore.test.ts apps/client/src/game/ui/CombatHud.tsx apps/client/src/game/ui/CombatHud.test.tsx apps/client/src/game/ui/QuickbarHud.tsx apps/client/src/game/ui/QuickbarHud.test.tsx apps/client/src/game/ui/Hud.tsx apps/client/src/game/ui/ControlsOverlay.tsx apps/client/src/game/ui/ControlsOverlay.test.tsx apps/client/src/App.tsx apps/client/src/App.test.tsx apps/client/src/styles.css
git commit -m "feat: add client weapon selection and block input"
```

### Task 6: Update Mock Transport, Protocol Fixtures, And E2E Verification

**Files:**
- Modify: `apps/client/src/game/net/socketClient.ts`
- Modify: `apps/client/src/game/net/socketClient.test.ts`
- Modify: `apps/client/src/game/net/protocolStore.test.ts`
- Modify: `apps/client/e2e/join-and-spawn.spec.ts`
- Test: `apps/client/src/game/net/socketClient.test.ts`
- Test: `apps/client/src/game/net/protocolStore.test.ts`
- Test: `apps/client/e2e/join-and-spawn.spec.ts`

- [ ] **Step 1: Write the failing mock/e2e updates**

Update `apps/client/src/game/net/socketClient.test.ts` to use real shared ids and the richer weapon state. Replace the authoritative-equip assertion with this stow-aware flow:

```ts
it("applies mock authoritative stow actions through replicated inventory state", async () => {
  const protocolStore = createProtocolStore();
  const socketClient = createSocketClient({
    mode: "mock",
    protocolStore,
  });

  await socketClient.join({ displayName: "Survivor" });
  protocolStore.drainWorldUpdates();

  socketClient.sendInput(
    inputMessageSchema.parse({
      actions: {
        inventory: {
          type: "stow",
        },
      },
      aim: { x: 0, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 2,
      type: "input",
    }),
  );

  const { deltas } = protocolStore.drainWorldUpdates();
  const selfUpdate = deltas[0]?.entityUpdates.find((update) => update.entityId === "player_survivor");

  expect(selfUpdate).toMatchObject({
    inventory: expect.objectContaining({
      equippedWeaponSlot: null,
    }),
    weaponState: expect.objectContaining({
      weaponItemId: "item_unarmed",
      weaponType: "unarmed",
    }),
  });
});
```

Update `apps/client/src/game/net/protocolStore.test.ts` snapshot and delta fixtures to use `item_revolver`, `item_pistol-ammo`, and the richer weapon state fields.

Update `apps/client/e2e/join-and-spawn.spec.ts` websocket init script so the quickbar snapshot matches the real starter loadout and joined shell includes the restored quickbar:

```ts
let equippedWeaponSlot: number | null = 0;
let weaponState = {
  fireCooldownRemainingMs: 0,
  isBlocking: false,
  isReloading: false,
  magazineAmmo: 6,
  reloadRemainingMs: 0,
  weaponItemId: "item_revolver",
  weaponType: "firearm",
};
```

When the mock receives `inventory.type === "stow"`, set:

```ts
equippedWeaponSlot = null;
weaponState = {
  fireCooldownRemainingMs: 0,
  isBlocking: false,
  isReloading: false,
  magazineAmmo: 0,
  reloadRemainingMs: 0,
  weaponItemId: "item_unarmed",
  weaponType: "unarmed",
};
```

And in the joined-page assertions add:

```ts
await expect(page.getByLabel("Quickbar")).toBeVisible();
```

- [ ] **Step 2: Run the mock/e2e tests to verify they fail**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/net/socketClient.test.ts src/game/net/protocolStore.test.ts
```

Then run from the repo root:

```bash
pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts --grep "joins from landing page and reaches the game shell|keeps the joined shell reachable on a shorter phone viewport"
```

Expected: FAIL because mock snapshots still use the old weapon ids and weapon-state shape, and the e2e script still assumes the joined shell has no quickbar.

- [ ] **Step 3: Write the minimal mock/e2e implementation**

Update `apps/client/src/game/net/socketClient.ts` to use the real authored ids and richer weapon state:

```ts
type MockWorldState = {
  ammoReserve: number;
  equippedWeaponSlot: number | null;
  lastProcessedInputSequence: number;
  localInventorySlotOne: { itemId: string; quantity: number } | null;
  localTransform: { rotation: number; x: number; y: number };
  weaponState: {
    fireCooldownRemainingMs: number;
    isBlocking: boolean;
    isReloading: boolean;
    magazineAmmo: number;
    reloadRemainingMs: number;
    weaponItemId: string;
    weaponType: "firearm" | "melee" | "unarmed";
  };
  zombieHealth: number;
  zombieIsAlive: boolean;
  zombieTransform: { rotation: number; x: number; y: number };
};
```

Use real starter ids in `createMockInventory()`:

```ts
return {
  ammoStacks: [{ ammoItemId: "item_pistol-ammo", quantity: worldState.ammoReserve }],
  equippedWeaponSlot: worldState.equippedWeaponSlot,
  slots: [
    { itemId: "item_revolver", quantity: 1 },
    worldState.localInventorySlotOne,
    { itemId: "item_pipe", quantity: 1 },
    null,
    null,
    null,
  ],
};
```

Emit `weaponState: worldState.weaponState` in both mock snapshot and delta builders, and when processing input:

```ts
const nextWeaponState = payload.actions.inventory?.type === "stow"
  ? {
      fireCooldownRemainingMs: 0,
      isBlocking: false,
      isReloading: false,
      magazineAmmo: 0,
      reloadRemainingMs: 0,
      weaponItemId: "item_unarmed",
      weaponType: "unarmed",
    }
  : mockWorldState.weaponState;
```

For `inventory.type === "equip"`, set firearm or melee state based on the target slot, and keep mock shot emission gated on `worldState.weaponState.weaponType === "firearm"`.

- [ ] **Step 4: Run the mock/e2e tests and then the final verification set**

Run from `apps/client`:

```bash
pnpm test -- --run src/game/net/socketClient.test.ts src/game/net/protocolStore.test.ts
```

Run from the repo root:

```bash
pnpm exec playwright test apps/client/e2e/join-and-spawn.spec.ts --grep "joins from landing page and reaches the game shell|keeps the joined shell reachable on a shorter phone viewport"
pnpm test
pnpm build
```

Expected: PASS on the targeted client tests, PASS on the two e2e checks, then PASS on full `pnpm test` and `pnpm build`.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/game/net/socketClient.ts apps/client/src/game/net/socketClient.test.ts apps/client/src/game/net/protocolStore.test.ts apps/client/e2e/join-and-spawn.spec.ts
git commit -m "test: align client mocks with weapon system"
```
