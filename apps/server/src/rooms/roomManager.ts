import type { RoomRuntime, RoomStatus } from "./roomRuntime";

type AssignPlayerInput = {
  displayName: string;
};

type AssignPlayerResult = {
  roomId: string;
  playerEntityId: string;
};

type RoomSummary = {
  roomId: string;
  playerCount: number;
  capacity: number;
  status: RoomStatus;
};

type RoomManagerOptions = {
  roomCapacity: number;
  createRoom: () => RoomRuntime;
  initialRooms?: RoomRuntime[];
};

export type RoomManager = {
  assignPlayer(input: AssignPlayerInput): AssignPlayerResult;
  disconnectPlayer(roomId: string, playerEntityId: string): boolean;
  reclaimPlayer(roomId: string, playerEntityId: string): AssignPlayerResult | null;
  releasePlayer(roomId: string, playerEntityId: string): boolean;
  tickAllRooms(): void;
  getRoomSummaries(): RoomSummary[];
  getRoomCount(): number;
};

const summarizeRoom = (room: RoomRuntime): RoomSummary => {
  const status = !room.isHealthy()
    ? "unhealthy"
    : room.playerCount >= room.capacity
      ? "full"
      : room.status;

  return {
    roomId: room.roomId,
    playerCount: room.playerCount,
    capacity: room.capacity,
    status,
  };
};

export const createRoomManager = ({ createRoom, initialRooms = [] }: RoomManagerOptions): RoomManager => {
  const rooms = new Map<string, RoomRuntime>();

  for (const room of initialRooms) {
    rooms.set(room.roomId, room);
  }

  const removeRoom = (roomId: string, reason: string): void => {
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }

    room.shutdown(reason);
    rooms.delete(roomId);
  };

  const cleanupUnhealthyRooms = (): void => {
    for (const room of rooms.values()) {
      if (!room.isHealthy()) {
        removeRoom(room.roomId, "unhealthy");
      }
    }
  };

  const getHealthyRoom = (): RoomRuntime | undefined => {
    cleanupUnhealthyRooms();

    for (const room of rooms.values()) {
      if (room.isHealthy() && room.canAcceptPlayers()) {
        return room;
      }
    }

    return undefined;
  };

  const getOrCreateRoom = (): RoomRuntime => {
    const existingRoom = getHealthyRoom();
    if (existingRoom) {
      return existingRoom;
    }

    const room = createRoom();
    rooms.set(room.roomId, room);
    return room;
  };

  return {
    assignPlayer(input) {
      const room = getOrCreateRoom();

      try {
        return room.joinPlayer(input);
      } catch {
        removeRoom(room.roomId, "join-failed");

        const fallbackRoom = getOrCreateRoom();
        return fallbackRoom.joinPlayer(input);
      }
    },
    disconnectPlayer(roomId, playerEntityId) {
      const room = rooms.get(roomId);
      if (!room || !room.isHealthy()) {
        return false;
      }

      return room.disconnectPlayer(playerEntityId);
    },
    reclaimPlayer(roomId, playerEntityId) {
      const room = rooms.get(roomId);
      if (!room || !room.isHealthy()) {
        return null;
      }

      return room.reclaimPlayer(playerEntityId);
    },
    releasePlayer(roomId, playerEntityId) {
      const room = rooms.get(roomId);
      if (!room) {
        return false;
      }

      const released = room.releasePlayer(playerEntityId);
      if (room.playerCount === 0) {
        removeRoom(roomId, "empty");
      }

      return released;
    },
    tickAllRooms() {
      for (const room of [...rooms.values()]) {
        try {
          room.tick?.();
          if (!room.isHealthy()) {
            removeRoom(room.roomId, "unhealthy");
          }
        } catch {
          removeRoom(room.roomId, "tick-failed");
        }
      }
    },
    getRoomSummaries() {
      cleanupUnhealthyRooms();
      return [...rooms.values()].map(summarizeRoom);
    },
    getRoomCount() {
      cleanupUnhealthyRooms();
      return rooms.size;
    },
  };
};
