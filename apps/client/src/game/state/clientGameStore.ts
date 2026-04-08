import { useSyncExternalStore } from "react";

import type {
  CombatEvent,
  DeathEvent,
  DeltaMessage,
  EnteredEntity,
  ErrorReason,
  Health,
  Inventory,
  InventoryAction,
  LootEntity,
  PlayerState,
  ShotEvent,
  SnapshotMessage,
  Stamina,
  WeaponState,
  ZombieEntity,
} from "@2dayz/shared";
import { INVENTORY_SLOT_COUNT } from "@2dayz/shared";

const createEmptyInventory = (): Inventory => ({
  ammoStacks: [],
  equippedWeaponSlot: null,
  slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => null),
});

const FIREARM_ITEM_IDS = new Set(["item_revolver", "weapon_pistol", "weapon_shotgun"]);
const MELEE_ITEM_IDS = new Set(["item_pipe", "weapon_hatchet"]);

const toWeaponType = (itemId: string | null | undefined): WeaponState["weaponType"] => {
  if (!itemId) {
    return "unarmed";
  }

  if (FIREARM_ITEM_IDS.has(itemId)) {
    return "firearm";
  }

  if (MELEE_ITEM_IDS.has(itemId)) {
    return "melee";
  }

  return "unarmed";
};

const deriveLocalWeaponState = (
  inventory: Inventory,
  currentWeaponState: WeaponState | null,
): WeaponState | null => {
  const equippedSlot = inventory.equippedWeaponSlot;
  const equippedItemId = equippedSlot === null ? null : inventory.slots[equippedSlot]?.itemId ?? null;
  const weaponType = toWeaponType(equippedItemId);

  if (weaponType === "unarmed") {
    return {
      fireCooldownRemainingMs: 0,
      isBlocking: false,
      isReloading: false,
      magazineAmmo: 0,
      reloadRemainingMs: 0,
      weaponItemId: "item_unarmed",
      weaponType,
    };
  }

  if (!equippedItemId) {
    return currentWeaponState;
  }

  return {
    fireCooldownRemainingMs: currentWeaponState?.weaponItemId === equippedItemId
      ? currentWeaponState.fireCooldownRemainingMs
      : 0,
    isBlocking: currentWeaponState?.weaponItemId === equippedItemId ? currentWeaponState.isBlocking : false,
    isReloading: currentWeaponState?.weaponItemId === equippedItemId ? currentWeaponState.isReloading : false,
    magazineAmmo:
      currentWeaponState?.weaponItemId === equippedItemId && weaponType === "firearm"
        ? currentWeaponState.magazineAmmo
        : 0,
    reloadRemainingMs:
      currentWeaponState?.weaponItemId === equippedItemId ? currentWeaponState.reloadRemainingMs : 0,
    weaponItemId: equippedItemId,
    weaponType,
  };
};

type ConnectionState =
  | { phase: "idle" }
  | { phase: "joining" }
  | { phase: "reconnecting" }
  | { phase: "joined" }
  | { phase: "failed"; reason: ErrorReason };

export type RenderPlayerEntity = PlayerState & { kind: "player" };
export type RenderLootEntity = LootEntity & { kind: "loot" };
export type RenderZombieEntity = ZombieEntity & {
  health?: Health;
  kind: "zombie";
  velocity?: { x: number; y: number };
};
export type ClientRenderEvent = ShotEvent | CombatEvent | DeathEvent;

type WorldEntities = {
  loot: RenderLootEntity[];
  players: RenderPlayerEntity[];
  zombies: RenderZombieEntity[];
};

type ClientGameState = {
  connectionState: ConnectionState;
  health: Health | null;
  inventory: Inventory;
  isDead: boolean;
  isInventoryOpen: boolean;
  lastJoinDisplayName: string;
  latestTick: number | null;
  playerEntityId: string | null;
  roomId: string | null;
  stamina: Stamina | null;
  weaponState: WeaponState | null;
  worldEntities: WorldEntities;
};

const createEmptyWorldEntities = (): WorldEntities => ({
  loot: [],
  players: [],
  zombies: [],
});

const toRenderPlayer = (player: PlayerState): RenderPlayerEntity => ({
  ...player,
  kind: "player",
});

const toRenderZombie = (zombie: ZombieEntity): RenderZombieEntity => ({
  ...zombie,
  kind: "zombie",
});

const upsertEntity = <T extends { entityId: string }>(entities: T[], nextEntity: T) => {
  const index = entities.findIndex((entity) => entity.entityId === nextEntity.entityId);
  if (index === -1) {
    return [...entities, nextEntity];
  }

  const nextEntities = entities.slice();
  nextEntities[index] = nextEntity;
  return nextEntities;
};

const applyEntityUpdate = (state: ClientGameState, update: DeltaMessage["entityUpdates"][number]): ClientGameState => {
  const players = state.worldEntities.players.map((entity) => {
    if (entity.entityId !== update.entityId) {
      return entity;
    }

      return {
        ...entity,
        ...(update.health ? { health: update.health } : {}),
        ...(update.inventory ? { inventory: update.inventory } : {}),
        ...(update.lastProcessedInputSequence !== undefined
          ? { lastProcessedInputSequence: update.lastProcessedInputSequence }
          : {}),
        ...(update.stamina ? { stamina: update.stamina } : {}),
        ...(update.transform ? { transform: update.transform } : {}),
        ...(update.velocity ? { velocity: update.velocity } : {}),
        ...(update.weaponState ? { weaponState: update.weaponState } : {}),
      };
  });

  const loot = state.worldEntities.loot.map((entity) => {
    if (entity.entityId !== update.entityId) {
      return entity;
    }

    return {
      ...entity,
      ...(update.itemId ? { itemId: update.itemId } : {}),
      ...(update.position ? { position: update.position } : {}),
      ...(update.quantity ? { quantity: update.quantity } : {}),
    };
  });

  const zombies = state.worldEntities.zombies.map((entity) => {
    if (entity.entityId !== update.entityId) {
      return entity;
    }

    return {
      ...entity,
      ...(update.health ? { health: update.health } : {}),
      ...(update.state ? { state: update.state } : {}),
      ...(update.transform ? { transform: update.transform } : {}),
      ...(update.velocity ? { velocity: update.velocity } : {}),
    };
  });

  const selfPlayer = players.find((entity) => entity.entityId === state.playerEntityId) ?? null;
  const inventory = selfPlayer?.inventory ?? state.inventory;
  const weaponState = deriveLocalWeaponState(inventory, selfPlayer?.weaponState ?? state.weaponState);

  return {
    ...state,
    health: selfPlayer?.health ?? state.health,
    inventory,
    isDead: selfPlayer?.health?.isDead ?? state.isDead,
    stamina: selfPlayer?.stamina ?? state.stamina,
    weaponState,
    worldEntities: {
      loot,
      players,
      zombies,
    },
  };
};

const applyEnteredEntity = (state: ClientGameState, entity: EnteredEntity): ClientGameState => {
  if (entity.kind === "player") {
    return {
      ...state,
      worldEntities: {
        ...state.worldEntities,
        players: upsertEntity(state.worldEntities.players, entity),
      },
    };
  }

  if (entity.kind === "loot") {
    return {
      ...state,
      worldEntities: {
        ...state.worldEntities,
        loot: upsertEntity(state.worldEntities.loot, entity),
      },
    };
  }

  return {
    ...state,
    worldEntities: {
      ...state.worldEntities,
      zombies: upsertEntity(state.worldEntities.zombies, entity),
    },
  };
};

const removeEntities = (worldEntities: WorldEntities, removedEntityIds: string[]): WorldEntities => {
  return {
    loot: worldEntities.loot.filter((entity) => !removedEntityIds.includes(entity.entityId)),
    players: worldEntities.players.filter((entity) => !removedEntityIds.includes(entity.entityId)),
    zombies: worldEntities.zombies.filter((entity) => !removedEntityIds.includes(entity.entityId)),
  };
};

export const createClientGameStore = () => {
  let state: ClientGameState = {
    connectionState: { phase: "idle" },
    health: null,
    inventory: createEmptyInventory(),
    isDead: false,
    isInventoryOpen: false,
    lastJoinDisplayName: "",
    latestTick: null,
    playerEntityId: null,
    roomId: null,
    stamina: null,
    weaponState: null,
    worldEntities: createEmptyWorldEntities(),
  };
  const listeners = new Set<() => void>();
  let queuedInventoryAction: InventoryAction | undefined;
  let queuedRenderEvents: ClientRenderEvent[] = [];

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const update = (updater: (current: ClientGameState) => ClientGameState) => {
    state = updater(state);
    emit();
  };

  return {
    applyDelta(delta: DeltaMessage) {
      update((current) => {
        let nextState: ClientGameState = {
          ...current,
          latestTick: delta.tick,
          roomId: delta.roomId,
          worldEntities: removeEntities(current.worldEntities, delta.removedEntityIds),
        };

        for (const entity of delta.enteredEntities) {
          nextState = applyEnteredEntity(nextState, entity);
        }

        for (const entityUpdate of delta.entityUpdates) {
          nextState = applyEntityUpdate(nextState, entityUpdate);
        }

        for (const event of delta.events) {
          if (event.type === "shot" || event.type === "combat" || event.type === "death") {
            queuedRenderEvents.push(event);
          }

          if (event.type === "death" && event.victimEntityId === current.playerEntityId) {
            nextState = {
              ...nextState,
              isDead: true,
            };
          }
        }

        return nextState;
      });
    },
    applySnapshot(snapshot: SnapshotMessage) {
      update((current) => {
        const players = snapshot.players.map(toRenderPlayer);
        const selfPlayer = players.find((entity) => entity.entityId === snapshot.playerEntityId) ?? null;

        return {
          ...current,
          health: selfPlayer?.health ?? null,
          inventory: selfPlayer?.inventory ?? current.inventory,
          isDead: selfPlayer?.health?.isDead ?? false,
          latestTick: snapshot.tick,
          playerEntityId: snapshot.playerEntityId,
            roomId: snapshot.roomId,
            stamina: selfPlayer?.stamina ?? null,
            weaponState: deriveLocalWeaponState(selfPlayer?.inventory ?? current.inventory, selfPlayer?.weaponState ?? null),
            worldEntities: {
              loot: snapshot.loot.map((entity) => ({ ...entity, kind: "loot" })),
              players,
            zombies: snapshot.zombies.map(toRenderZombie),
          },
        };
      });
    },
    beginJoin(displayName: string) {
      update((current) => ({
        ...current,
        connectionState: { phase: "joining" },
        lastJoinDisplayName: displayName,
      }));
    },
    beginReconnect() {
      update((current) => ({
        ...current,
        connectionState: { phase: "reconnecting" },
      }));
    },
    completeJoin({
      displayName,
      playerEntityId,
      roomId,
    }: {
      displayName: string;
      playerEntityId: string;
      roomId: string;
    }) {
      queuedInventoryAction = undefined;
      queuedRenderEvents = [];
      update((current) => {
        const isSameIdentity = current.playerEntityId === playerEntityId;

        return {
          ...current,
          connectionState: { phase: "joined" },
          health: isSameIdentity ? current.health : null,
          inventory: isSameIdentity ? current.inventory : createEmptyInventory(),
          isDead: isSameIdentity ? current.isDead : false,
          isInventoryOpen: false,
          lastJoinDisplayName: displayName,
          latestTick: isSameIdentity ? current.latestTick : null,
          playerEntityId,
          roomId,
          stamina: isSameIdentity ? current.stamina : null,
          weaponState: isSameIdentity ? current.weaponState : null,
          worldEntities: isSameIdentity ? current.worldEntities : createEmptyWorldEntities(),
        };
      });
    },
    failConnection(reason: ErrorReason) {
      queuedInventoryAction = undefined;
      queuedRenderEvents = [];
      update((current) => ({
        ...current,
        connectionState: { phase: "failed", reason },
        isInventoryOpen: false,
      }));
    },
    getState() {
      return state;
    },
    resetToIdle() {
      queuedInventoryAction = undefined;
      queuedRenderEvents = [];
      update((current) => ({
        connectionState: { phase: "idle" },
        health: null,
        inventory: createEmptyInventory(),
        isDead: false,
        isInventoryOpen: false,
        lastJoinDisplayName: current.lastJoinDisplayName,
        latestTick: null,
        playerEntityId: null,
        roomId: null,
        stamina: null,
        weaponState: null,
        worldEntities: createEmptyWorldEntities(),
      }));
    },
    selectInventorySlot(slotIndex: number) {
      update((current) => {
        if (slotIndex < 0 || slotIndex >= current.inventory.slots.length) {
          return current;
        }

        const nextEquippedWeaponSlot = current.inventory.slots[slotIndex] === null ? null : slotIndex;
        const inventory = {
          ...current.inventory,
          equippedWeaponSlot: nextEquippedWeaponSlot,
        };

        queuedInventoryAction = nextEquippedWeaponSlot === null
          ? { type: "stow" }
          : { toSlot: slotIndex, type: "equip" };

        return {
          ...current,
          inventory,
          weaponState: deriveLocalWeaponState(inventory, current.weaponState),
        };
      });
    },
    stowWeapon() {
      queuedInventoryAction = { type: "stow" };
      update((current) => {
        const inventory = {
          ...current.inventory,
          equippedWeaponSlot: null,
        };

        return {
          ...current,
          inventory,
          weaponState: deriveLocalWeaponState(inventory, current.weaponState),
        };
      });
    },
    queueInventoryAction(action: InventoryAction) {
      queuedInventoryAction = action;
    },
    consumeQueuedInventoryAction() {
      const nextAction = queuedInventoryAction;
      queuedInventoryAction = undefined;
      return nextAction;
    },
    drainRenderEvents() {
      const events = queuedRenderEvents;
      queuedRenderEvents = [];
      return events;
    },
    setInventory(inventory: Inventory) {
      update((current) => ({
        ...current,
        inventory,
        weaponState: deriveLocalWeaponState(inventory, current.weaponState),
      }));
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    toggleInventory() {
      update((current) => ({
        ...current,
        isInventoryOpen: !current.isInventoryOpen,
      }));
    },
  };
};

export const useClientGameStore = (store: ReturnType<typeof createClientGameStore>) => {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
};

export type ClientGameStore = ReturnType<typeof createClientGameStore>;
