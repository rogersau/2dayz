import type { Inventory, WeaponDefinition, WeaponState } from "@2dayz/shared";

const clearFirearmFields = (weaponState: WeaponState): WeaponState => {
  return {
    ...weaponState,
    magazineAmmo: 0,
    isReloading: false,
    reloadRemainingMs: 0,
    fireCooldownRemainingMs: 0,
  };
};

export const createWeaponStateFromDefinition = (weaponDefinition: WeaponDefinition): WeaponState => {
  return {
    weaponItemId: weaponDefinition.itemId,
    weaponType: weaponDefinition.weaponType,
    magazineAmmo: weaponDefinition.weaponType === "firearm" ? weaponDefinition.magazineSize : 0,
    isBlocking: false,
    isReloading: false,
    reloadRemainingMs: 0,
    fireCooldownRemainingMs: 0,
  };
};

export const resolveActiveWeaponDefinition = (
  weaponDefinitions: ReadonlyMap<string, WeaponDefinition>,
  inventory: Inventory,
): WeaponDefinition => {
  const equippedSlot = inventory.equippedWeaponSlot === null ? null : inventory.slots[inventory.equippedWeaponSlot];
  const weaponItemId = equippedSlot?.itemId ?? "item_unarmed";
  const weaponDefinition = weaponDefinitions.get(weaponItemId);

  if (!weaponDefinition) {
    throw new Error(`missing authored weapon definition for ${weaponItemId}`);
  }

  return weaponDefinition;
};

export const syncWeaponStateFromDefinition = (
  weaponState: WeaponState,
  weaponDefinition: WeaponDefinition,
): WeaponState => {
  if (weaponDefinition.weaponType === "firearm" && weaponState.weaponItemId === weaponDefinition.itemId) {
    return {
      ...weaponState,
      weaponItemId: weaponDefinition.itemId,
      weaponType: weaponDefinition.weaponType,
      magazineAmmo: Math.min(weaponState.magazineAmmo, weaponDefinition.magazineSize),
    };
  }

  if (weaponDefinition.weaponType === "firearm" && weaponState.weaponItemId !== weaponDefinition.itemId) {
    return createWeaponStateFromDefinition(weaponDefinition);
  }

  const syncedWeaponState: WeaponState = {
    ...weaponState,
    weaponItemId: weaponDefinition.itemId,
    weaponType: weaponDefinition.weaponType,
  };

  if (weaponDefinition.weaponType !== "firearm") {
    return clearFirearmFields(syncedWeaponState);
  }

  return {
    ...syncedWeaponState,
    magazineAmmo: Math.min(syncedWeaponState.magazineAmmo, weaponDefinition.magazineSize),
  };
};

export const createSyncedWeaponState = (
  weaponDefinitions: ReadonlyMap<string, WeaponDefinition>,
  inventory: Inventory,
  weaponState: WeaponState,
): WeaponState => {
  return syncWeaponStateFromDefinition(weaponState, resolveActiveWeaponDefinition(weaponDefinitions, inventory));
};
