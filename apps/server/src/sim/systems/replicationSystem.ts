import type { EnteredEntity, LootEntity, PlayerState, ZombieEntity } from "@2dayz/shared";

import { createRoomReplicationSnapshot, type RoomReplicationDelta, type RoomReplicationSnapshot } from "../query";
import type { RoomSimulationState } from "../state";

export type ReplicationSystemOptions = {
  nearbyRadius?: number;
  maxNearbyPlayers?: number;
  maxNearbyLoot?: number;
  maxNearbyZombies?: number;
};

type CreateDeltaForPlayerInput = {
  delta: RoomReplicationDelta;
  state: RoomSimulationState;
  playerEntityId: string;
  visibleEntityIds: Set<string>;
};

type CreateDeltaForPlayerResult = {
  delta: RoomReplicationDelta;
  visibleEntityIds: Set<string>;
};

const createEnteredEntityFromState = (state: RoomSimulationState, entityId: string): EnteredEntity | null => {
  const player = state.players.get(entityId);
  if (player) {
    return {
      kind: "player",
      entityId: player.entityId,
      displayName: player.displayName,
      transform: player.transform,
      velocity: player.velocity,
      inventory: player.inventory,
      health: player.health,
      stamina: player.stamina,
    };
  }

  const loot = state.loot.get(entityId);
  if (loot) {
    return {
      kind: "loot",
      entityId: loot.entityId,
      itemId: loot.itemId,
      quantity: loot.quantity,
      position: loot.position,
    };
  }

  const zombie = state.zombies.get(entityId);
  if (zombie) {
    return {
      kind: "zombie",
      entityId: zombie.entityId,
      archetypeId: zombie.archetypeId,
      transform: zombie.transform,
      velocity: zombie.velocity,
      health: zombie.health,
      state: zombie.state,
    };
  }

  return null;
};

const DEFAULT_NEARBY_RADIUS = 18;
const DEFAULT_MAX_NEARBY_PLAYERS = 8;
const DEFAULT_MAX_NEARBY_LOOT = 16;
const DEFAULT_MAX_NEARBY_ZOMBIES = 12;

const distanceTo = (from: { x: number; y: number }, to: { x: number; y: number }): number => {
  return Math.hypot(from.x - to.x, from.y - to.y);
};

const sortByDistance = <Entity>(
  entities: Entity[],
  getPosition: (entity: Entity) => { x: number; y: number },
  anchor: { x: number; y: number },
): Entity[] => {
  return [...entities].sort((left, right) => {
    return distanceTo(anchor, getPosition(left)) - distanceTo(anchor, getPosition(right));
  });
};

const filterNearby = <Entity>(
  entities: Entity[],
  getPosition: (entity: Entity) => { x: number; y: number },
  anchor: { x: number; y: number },
  nearbyRadius: number,
  maxCount: number,
): Entity[] => {
  return sortByDistance(entities, getPosition, anchor)
    .filter((entity) => distanceTo(anchor, getPosition(entity)) <= nearbyRadius)
    .slice(0, maxCount);
};

export const createReplicationSystem = ({
  nearbyRadius = DEFAULT_NEARBY_RADIUS,
  maxNearbyPlayers = DEFAULT_MAX_NEARBY_PLAYERS,
  maxNearbyLoot = DEFAULT_MAX_NEARBY_LOOT,
  maxNearbyZombies = DEFAULT_MAX_NEARBY_ZOMBIES,
}: ReplicationSystemOptions = {}) => {
  const createVisibleSnapshot = (state: RoomSimulationState, playerEntityId: string): RoomReplicationSnapshot => {
    return createInitialSnapshot(createRoomReplicationSnapshot(state, playerEntityId));
  };

  const createInitialSnapshot = (snapshot: RoomReplicationSnapshot): RoomReplicationSnapshot => {
    const localPlayer = snapshot.players.find((player) => player.entityId === snapshot.playerEntityId);
    if (!localPlayer) {
      return snapshot;
    }

    const anchor = localPlayer.transform;
    const nearbyPlayers = filterNearby(
      snapshot.players.filter((player) => player.entityId !== snapshot.playerEntityId),
      (player: PlayerState) => player.transform,
      anchor,
      nearbyRadius,
      Math.max(0, maxNearbyPlayers - 1),
    );

    return {
      ...snapshot,
      players: [localPlayer, ...nearbyPlayers],
      loot: filterNearby(snapshot.loot, (loot: LootEntity) => loot.position, anchor, nearbyRadius, maxNearbyLoot),
      zombies: filterNearby(snapshot.zombies, (zombie: ZombieEntity) => zombie.transform, anchor, nearbyRadius, maxNearbyZombies),
    };
  };

  const createDelta = (delta: RoomReplicationDelta): RoomReplicationDelta => {
    return {
      ...delta,
      enteredEntities: [...delta.enteredEntities],
      entityUpdates: [...delta.entityUpdates],
      removedEntityIds: [...delta.removedEntityIds],
      events: [...delta.events],
    };
  };

  const createDeltaForPlayer = ({ delta, state, playerEntityId, visibleEntityIds }: CreateDeltaForPlayerInput): CreateDeltaForPlayerResult => {
    const localPlayer = state.players.get(playerEntityId);
    if (!localPlayer) {
      return {
        delta: createDelta(delta),
        visibleEntityIds: new Set(),
      };
    }

    const visibleSnapshot = createVisibleSnapshot(state, playerEntityId);
    const nextVisibleEntityIds = new Set<string>([
      ...visibleSnapshot.players.map((player) => player.entityId),
      ...visibleSnapshot.loot.map((loot) => loot.entityId),
      ...visibleSnapshot.zombies.map((zombie) => zombie.entityId),
    ]);
    const enteringEntityIds = [...nextVisibleEntityIds].filter((entityId) => !visibleEntityIds.has(entityId));
    const leavingEntityIds = [...visibleEntityIds].filter((entityId) => !nextVisibleEntityIds.has(entityId));
    const syntheticEnteringEntities = enteringEntityIds
      .map((entityId) => createEnteredEntityFromState(state, entityId))
      .filter((entity): entity is NonNullable<typeof entity> => entity !== null);
    const visibleEntityUpdates = delta.entityUpdates.filter((update) => nextVisibleEntityIds.has(update.entityId));
    const mergedEntityUpdates = new Map<string, RoomReplicationDelta["entityUpdates"][number]>();

    for (const update of visibleEntityUpdates) {
      mergedEntityUpdates.set(update.entityId, update);
    }
    const mergedEnteredEntities = new Map<string, EnteredEntity>();
    for (const entity of [...delta.enteredEntities.filter((entity) => nextVisibleEntityIds.has(entity.entityId)), ...syntheticEnteringEntities]) {
      mergedEnteredEntities.set(entity.entityId, entity);
    }
    const removedEntityIds = new Set<string>([
      ...delta.removedEntityIds.filter((entityId) => visibleEntityIds.has(entityId)),
      ...leavingEntityIds,
    ]);

    return {
      delta: {
        ...createDelta(delta),
        enteredEntities: [...mergedEnteredEntities.values()],
        entityUpdates: [...mergedEntityUpdates.values()],
        removedEntityIds: [...removedEntityIds],
      },
      visibleEntityIds: new Set(
        [...nextVisibleEntityIds].filter((entityId) => !removedEntityIds.has(entityId)),
      ),
    };
  };

  return {
    createInitialSnapshot,
    createDelta,
    createDeltaForPlayer,
  };
};
