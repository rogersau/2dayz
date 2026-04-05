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
    const players: JoinPlayerResult[] = [];
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
        return players.length;
      },
      isHealthy() {
        return healthy;
      },
      canAcceptPlayers() {
        return healthy && players.length < roomCapacity;
      },
      joinPlayer(player: JoinPlayerInput) {
        if (!this.canAcceptPlayers()) {
          throw new Error("room cannot accept players");
        }

        const joinedPlayer = {
          roomId,
          playerEntityId: createPlayerEntityId(roomId, players.length + 1),
          displayName: player.displayName,
        };

        players.push(joinedPlayer);
        status = players.length >= roomCapacity ? "full" : "active";

        return {
          roomId: joinedPlayer.roomId,
          playerEntityId: joinedPlayer.playerEntityId,
        };
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
