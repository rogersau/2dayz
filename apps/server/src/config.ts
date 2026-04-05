export type ServerConfig = {
  host: string;
  port: number;
  roomCapacity: number;
  reclaimWindowMs: number;
};

const readNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const DEFAULT_RECLAIM_WINDOW_MS = 30_000;
export const DEFAULT_ROOM_CAPACITY = 12;
export const DEFAULT_PORT = 3001;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): ServerConfig => {
  return {
    host: env.HOST ?? "127.0.0.1",
    port: readNumber(env.PORT, DEFAULT_PORT),
    roomCapacity: readNumber(env.ROOM_CAPACITY, DEFAULT_ROOM_CAPACITY),
    reclaimWindowMs: readNumber(env.RECLAIM_WINDOW_MS, DEFAULT_RECLAIM_WINDOW_MS),
  };
};
