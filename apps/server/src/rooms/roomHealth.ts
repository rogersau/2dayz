import type { RoomManager } from "./roomManager";

export type RoomHealthSnapshot = {
  status: "ok";
  uptime: number;
  rooms: number;
};

export const createRoomHealthSnapshot = (roomManager: RoomManager, uptime: number): RoomHealthSnapshot => {
  return {
    status: "ok",
    uptime,
    rooms: roomManager.getRoomCount(),
  };
};
