import type { DeltaMessage, RoomMetadata, RoomStatusMessage, SnapshotMessage } from "@2dayz/shared";

import type { RoomReplicationDelta, RoomReplicationSnapshot } from "../sim/query";
import type { RoomRuntime } from "../rooms/roomRuntime";

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
    enteredEntities: delta.enteredEntities,
    entityUpdates: delta.entityUpdates,
    removedEntityIds: delta.removedEntityIds,
    events: delta.events,
  };
};

export const createRoomStatusMessage = (room: RoomRuntime | RoomMetadata): RoomStatusMessage => {
  const metadata: RoomMetadata = "name" in room
    ? room
    : {
        roomId: room.roomId,
        name: room.roomId,
        status: room.status,
        playerCount: room.playerCount,
        capacity: room.capacity,
      };

  return {
    type: "room-status",
    room: metadata,
  };
};
