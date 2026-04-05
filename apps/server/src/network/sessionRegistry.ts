import { DEFAULT_RECLAIM_WINDOW_MS } from "../config";
import { createReconnectRegistry, type ReconnectRegistry, type SessionReservation } from "../rooms/reconnect";
import type { RoomManager } from "../rooms/roomManager";

type SessionRegistryOptions = {
  reclaimWindowMs?: number;
  roomManager: RoomManager;
  now?: () => number;
};

type CreateSessionInput = {
  displayName: string;
  roomId: string;
  playerEntityId: string;
};

export type SessionRegistry = {
  createSession(input: CreateSessionInput): SessionReservation;
  cleanupExpiredReservations(): void;
  markDisconnected(sessionToken: string): void;
  reclaim(sessionToken: string): ReturnType<ReconnectRegistry["reclaim"]>;
};

export const createSessionRegistry = ({
  reclaimWindowMs = DEFAULT_RECLAIM_WINDOW_MS,
  roomManager,
  now = () => Date.now(),
}: SessionRegistryOptions): SessionRegistry => {
  const registry = createReconnectRegistry({ reclaimWindowMs });

  const purgeExpiredReservations = (): void => {
    for (const reservation of registry.listReservations()) {
      if (reservation.disconnectedAt === null) {
        continue;
      }

      if (now() - reservation.disconnectedAt > reclaimWindowMs) {
        roomManager.releasePlayer(reservation.roomId, reservation.playerEntityId);
        registry.invalidate(reservation.sessionToken);
      }
    }
  };

  return {
    cleanupExpiredReservations() {
      purgeExpiredReservations();
    },
    createSession(input) {
      purgeExpiredReservations();
      return registry.issueReservation({ ...input, now: now() });
    },
    markDisconnected(sessionToken) {
      purgeExpiredReservations();
      const reservation = registry.markDisconnected(sessionToken, now());
      if (!reservation) {
        return;
      }

      roomManager.disconnectPlayer(reservation.roomId, reservation.playerEntityId);
    },
    reclaim(sessionToken) {
      const reservation = registry.getReservation(sessionToken);
      if (!reservation) {
        purgeExpiredReservations();
        return { accepted: false, reason: "invalid" };
      }

      if (reservation.disconnectedAt === null) {
        return { accepted: false, reason: "not-disconnected" };
      }

      if (now() - reservation.disconnectedAt > reclaimWindowMs) {
        roomManager.releasePlayer(reservation.roomId, reservation.playerEntityId);
        registry.invalidate(sessionToken);
        return { accepted: false, reason: "expired" };
      }

      purgeExpiredReservations();

      const reclaimedPlayer = roomManager.reclaimPlayer(reservation.roomId, reservation.playerEntityId);
      if (!reclaimedPlayer) {
        registry.invalidate(sessionToken);
        return { accepted: false, reason: "room-unavailable" };
      }

      return registry.reclaim(sessionToken, now());
    },
  };
};
