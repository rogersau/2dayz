import { DEFAULT_RECLAIM_WINDOW_MS } from "../config";
import { createReconnectRegistry, type ReconnectRegistry, type SessionReservation } from "../rooms/reconnect";

type SessionRegistryOptions = {
  reclaimWindowMs?: number;
};

type CreateSessionInput = {
  displayName: string;
  roomId: string;
  playerEntityId: string;
};

export type SessionRegistry = {
  createSession(input: CreateSessionInput): SessionReservation;
  markDisconnected(sessionToken: string): void;
  reclaim(sessionToken: string): ReturnType<ReconnectRegistry["reclaim"]>;
};

export const createSessionRegistry = ({ reclaimWindowMs = DEFAULT_RECLAIM_WINDOW_MS }: SessionRegistryOptions = {}): SessionRegistry => {
  const registry = createReconnectRegistry({ reclaimWindowMs });

  return {
    createSession(input) {
      return registry.issueReservation({ ...input, now: Date.now() });
    },
    markDisconnected(sessionToken) {
      registry.markDisconnected(sessionToken, Date.now());
    },
    reclaim(sessionToken) {
      return registry.reclaim(sessionToken, Date.now());
    },
  };
};
