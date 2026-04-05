import { createCollisionIndex, isCirclePositionBlocked } from "../world/collision";
import { loadMapDefinition } from "../world/loadMapDefinition";
import { createNavigationGraph } from "../world/navigation";
import { createSimulationRoomRuntime, type RoomRuntime } from "./roomRuntime";

export type CreateRoom = () => RoomRuntime;

type RoomFactoryOptions = {
  roomCapacity: number;
  loadMap?: typeof loadMapDefinition;
};

const playerCollisionRadius = 0.5;

export const createRoomFactory = ({ roomCapacity, loadMap = loadMapDefinition }: RoomFactoryOptions): CreateRoom => {
  let roomSequence = 0;

  return () => {
    roomSequence += 1;

    const map = loadMap();
    const collision = createCollisionIndex(map.collisionVolumes);
    const navigation = createNavigationGraph(map.navigation);

    return createSimulationRoomRuntime({
      roomId: `room_${roomSequence}`,
      world: {
        map,
        collision,
        navigation,
        respawnPoints: map.respawnPoints.map((point) => point.position),
      },
      config: {
        playerCapacity: roomCapacity,
        isPositionBlocked: (position) => isCirclePositionBlocked(collision, position, playerCollisionRadius),
      },
    });
  };
};
