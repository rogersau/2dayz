import { createSimulationRoomRuntime, type RoomRuntime } from "./roomRuntime";

export type CreateRoom = () => RoomRuntime;

type RoomFactoryOptions = {
  roomCapacity: number;
};

export const createRoomFactory = ({ roomCapacity }: RoomFactoryOptions): CreateRoom => {
  let roomSequence = 0;

  return () => {
    roomSequence += 1;

    return createSimulationRoomRuntime({
      roomId: `room_${roomSequence}`,
      config: {
        playerCapacity: roomCapacity,
      },
    });
  };
};
