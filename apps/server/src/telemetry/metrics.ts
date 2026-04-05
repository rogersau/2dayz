import type { RoomManager } from "../rooms/roomManager";

export type MetricsSnapshot = {
  rooms: number;
};

export const collectMetrics = (roomManager: RoomManager): MetricsSnapshot => {
  return {
    rooms: roomManager.getRoomCount(),
  };
};
