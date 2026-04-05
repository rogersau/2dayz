import type { JoinPlayerInput, JoinPlayerResult, RoomRuntime, RoomStatus } from "./roomRuntime";

export type CreateRoom = () => RoomRuntime;

type RoomFactoryOptions = {
  roomCapacity: number;
};

const createPlayerEntityId = (roomId: string, playerNumber: number): string => {
  return `player_${roomId.replace(/^room_/, "")}-${playerNumber}`;
};

export const createRoomFactory = ({ roomCapacity }: RoomFactoryOptions): CreateRoom => {
  let roomSequence = 0;

  return () => {
    roomSequence += 1;

    const roomId = `room_${roomSequence}`;
    const players = new Map<string, { displayName: string; connected: boolean }>();
    let healthy = true;
    let status: RoomStatus = "active";

    return {
      roomId,
      capacity: roomCapacity,
      get status() {
        return status;
      },
      set status(nextStatus: RoomStatus) {
        status = nextStatus;
      },
      get playerCount() {
        return players.size;
      },
      isHealthy() {
        return healthy;
      },
      canAcceptPlayers() {
        return healthy && players.size < roomCapacity;
      },
      joinPlayer(player: JoinPlayerInput) {
        if (!this.canAcceptPlayers()) {
          throw new Error("room cannot accept players");
        }

        const joinedPlayer = {
          roomId,
          playerEntityId: createPlayerEntityId(roomId, players.size + 1),
          displayName: player.displayName,
        };

        players.set(joinedPlayer.playerEntityId, { displayName: joinedPlayer.displayName, connected: true });
        status = players.size >= roomCapacity ? "full" : "active";

        return {
          roomId: joinedPlayer.roomId,
          playerEntityId: joinedPlayer.playerEntityId,
        };
      },
      disconnectPlayer(playerEntityId: string) {
        const player = players.get(playerEntityId);
        if (!player) {
          return false;
        }

        player.connected = false;
        return true;
      },
      reclaimPlayer(playerEntityId: string) {
        const player = players.get(playerEntityId);
        if (!player || player.connected || !healthy) {
          return null;
        }

        player.connected = true;
        return { roomId, playerEntityId };
      },
      releasePlayer(playerEntityId: string) {
        const deleted = players.delete(playerEntityId);
        if (deleted && players.size < roomCapacity) {
          status = "active";
        }
        return deleted;
      },
      shutdown() {
        healthy = false;
        status = "shutting-down";
      },
      tick() {
        if (!healthy) {
          throw new Error("room is unavailable");
        }
      },
    };
  };
};
