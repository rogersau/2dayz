import type { DeltaMessage, SnapshotMessage } from "@2dayz/shared";

import type { RoomReplicationDelta, RoomReplicationSnapshot } from "../sim/query";

export const createSnapshotMessage = (roomId: string, snapshot: RoomReplicationSnapshot): SnapshotMessage => {
  return {
    type: "snapshot",
    roomId,
    tick: snapshot.tick,
    playerEntityId: snapshot.playerEntityId,
    players: snapshot.players,
    loot: snapshot.loot,
    zombies: snapshot.zombies,
  };
};

export const createDeltaMessage = (roomId: string, delta: RoomReplicationDelta): DeltaMessage => {
  return {
    type: "delta",
    roomId,
    tick: delta.tick,
    entityUpdates: delta.entityUpdates,
    removedEntityIds: delta.removedEntityIds,
    events: delta.events,
  };
};
