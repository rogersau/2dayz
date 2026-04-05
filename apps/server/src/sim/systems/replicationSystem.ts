import type { LootEntity, PlayerState, ZombieEntity } from "@2dayz/shared";

import type { RoomReplicationDelta, RoomReplicationSnapshot } from "../query";

export type ReplicationSystemOptions = {
  nearbyRadius?: number;
  maxNearbyPlayers?: number;
  maxNearbyLoot?: number;
  maxNearbyZombies?: number;
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
      entityUpdates: [...delta.entityUpdates],
      removedEntityIds: [...delta.removedEntityIds],
      events: [...delta.events],
    };
  };

  return {
    createInitialSnapshot,
    createDelta,
  };
};
