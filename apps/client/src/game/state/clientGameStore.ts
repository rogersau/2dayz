import { useSyncExternalStore } from "react";

import { INVENTORY_SLOT_COUNT, type ErrorReason, type Inventory } from "@2dayz/shared";

const createEmptyInventory = (): Inventory => ({
  slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => null),
  equippedWeaponSlot: null,
  ammoStacks: [],
});

const createDemoInventory = (): Inventory => ({
  slots: [
    { itemId: "weapon_pistol", quantity: 1 },
    { itemId: "bandage", quantity: 2 },
    { itemId: "water", quantity: 1 },
    null,
    null,
    null,
  ],
  equippedWeaponSlot: 0,
  ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 30 }],
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
  showControlsOverlay: boolean;
};

export const createClientGameStore = () => {
  let state: ClientGameState = {
    connectionState: { phase: "idle" },
    inventory: createEmptyInventory(),
    isDead: false,
    isInventoryOpen: false,
    lastJoinDisplayName: "",
    roomId: null,
    showControlsOverlay: false,
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
      reconnected,
    }: {
      displayName: string;
      playerEntityId: string;
      roomId: string;
      reconnected: boolean;
    }) {
      update((current) => ({
        ...current,
        connectionState: { phase: "joined" },
        inventory: reconnected && current.inventory.slots.some(Boolean) ? current.inventory : createDemoInventory(),
        isDead: false,
        isInventoryOpen: false,
        lastJoinDisplayName: displayName,
        roomId,
        showControlsOverlay: true,
      }));
    },
    dismissControlsOverlay() {
      update((current) => ({
        ...current,
        showControlsOverlay: false,
      }));
    },
    failConnection(reason: ErrorReason) {
      update((current) => ({
        ...current,
        connectionState: { phase: "failed", reason },
        roomId: null,
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
