import { useSyncExternalStore } from "react";

import type {
  DeltaMessage,
  EnteredEntity,
  ErrorReason,
  Health,
  Inventory,
  LootEntity,
  PlayerState,
  SnapshotMessage,
  ZombieEntity,
} from "@2dayz/shared";
import { INVENTORY_SLOT_COUNT } from "@2dayz/shared";

const createEmptyInventory = (): Inventory => ({
  ammoStacks: [],
  equippedWeaponSlot: null,
  slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => null),
});

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
      ...(update.transform ? { transform: update.transform } : {}),
      ...(update.velocity ? { velocity: update.velocity } : {}),
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
      ...(update.transform ? { transform: update.transform } : {}),
      ...(update.velocity ? { velocity: update.velocity } : {}),
    };
  });

  const selfPlayer = players.find((entity) => entity.entityId === state.playerEntityId) ?? null;

  return {
    ...state,
    health: selfPlayer?.health ?? state.health,
    inventory: selfPlayer?.inventory ?? state.inventory,
    isDead: selfPlayer?.health?.isDead ?? state.isDead,
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
    worldEntities: createEmptyWorldEntities(),
  };
  const listeners = new Set<() => void>();

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
      update((current) => ({
        ...current,
        connectionState: { phase: "joined" },
        health: current.health,
        inventory: current.inventory,
        isDead: current.playerEntityId === playerEntityId ? current.isDead : false,
        isInventoryOpen: false,
        lastJoinDisplayName: displayName,
        playerEntityId,
        roomId,
      }));
    },
    failConnection(reason: ErrorReason) {
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
      update((current) => ({
        ...current,
        connectionState: { phase: "idle" },
      }));
    },
    setInventory(inventory: Inventory) {
      update((current) => ({
        ...current,
        inventory,
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
