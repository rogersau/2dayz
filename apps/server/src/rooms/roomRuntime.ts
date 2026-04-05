export type RoomStatus = "active" | "full" | "unhealthy" | "shutting-down";

export type JoinPlayerInput = {
  displayName: string;
};

export type JoinPlayerResult = {
  roomId: string;
  playerEntityId: string;
};

export interface RoomRuntime {
  roomId: string;
  capacity: number;
  status: RoomStatus;
  playerCount: number;
  isHealthy(): boolean;
  canAcceptPlayers(): boolean;
  joinPlayer(player: JoinPlayerInput): JoinPlayerResult;
  shutdown(reason?: string): void;
  tick?(): void;
}

export type ManagedRoom = {
  runtime: RoomRuntime;
};
