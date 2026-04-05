import { useSyncExternalStore } from "react";

import { INVENTORY_SLOT_COUNT, type ErrorReason, type Inventory } from "@2dayz/shared";

const createEmptyInventory = (): Inventory => ({
  slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => null),
  equippedWeaponSlot: null,
  ammoStacks: [],
});

type ConnectionState =
  | { phase: "idle" }
  | { phase: "joining" }
  | { phase: "reconnecting" }
  | { phase: "joined" }
  | { phase: "failed"; reason: ErrorReason };

type ClientGameState = {
  connectionState: ConnectionState;
  inventory: Inventory;
  isDead: boolean;
  isInventoryOpen: boolean;
  lastJoinDisplayName: string;
  roomId: string | null;
};

export const createClientGameStore = () => {
  let state: ClientGameState = {
    connectionState: { phase: "idle" },
    inventory: createEmptyInventory(),
    isDead: false,
    isInventoryOpen: false,
    lastJoinDisplayName: "",
    roomId: null,
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
      playerEntityId: _playerEntityId,
      roomId,
    }: {
      displayName: string;
      playerEntityId: string;
      roomId: string;
    }) {
      update((current) => ({
        ...current,
        connectionState: { phase: "joined" },
        inventory: current.connectionState.phase === "joined" ? current.inventory : createEmptyInventory(),
        isDead: false,
        isInventoryOpen: false,
        lastJoinDisplayName: displayName,
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
