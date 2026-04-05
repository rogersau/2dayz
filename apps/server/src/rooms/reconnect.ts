export type SessionReservation = {
  sessionToken: string;
  displayName: string;
  roomId: string;
  playerEntityId: string;
};

type StoredReservation = SessionReservation & {
  disconnectedAt: number | null;
};

type ReconnectRegistryOptions = {
  reclaimWindowMs: number;
};

type ReservationInput = {
  displayName: string;
  roomId: string;
  playerEntityId: string;
  now: number;
};

type ReclaimResult =
  | { accepted: true; reservation: SessionReservation }
  | { accepted: false; reason: "expired" | "invalid" | "not-disconnected" | "room-unavailable" };

export type StoredReservationSnapshot = SessionReservation & {
  disconnectedAt: number | null;
};

export type ReconnectRegistry = {
  issueReservation(input: ReservationInput): SessionReservation;
  markDisconnected(sessionToken: string, now: number): SessionReservation | null;
  getReservation(sessionToken: string): StoredReservationSnapshot | null;
  listReservations(): StoredReservationSnapshot[];
  invalidate(sessionToken: string): boolean;
  reclaim(sessionToken: string, now: number): ReclaimResult;
};

export const createReconnectRegistry = ({ reclaimWindowMs }: ReconnectRegistryOptions): ReconnectRegistry => {
  let tokenSequence = 0;
  const reservations = new Map<string, StoredReservation>();

  return {
    issueReservation(input) {
      tokenSequence += 1;
      const sessionToken = `session_${tokenSequence}`;
      const reservation: StoredReservation = {
        sessionToken,
        displayName: input.displayName,
        roomId: input.roomId,
        playerEntityId: input.playerEntityId,
        disconnectedAt: null,
      };

      reservations.set(sessionToken, reservation);
      return {
        sessionToken,
        displayName: reservation.displayName,
        roomId: reservation.roomId,
        playerEntityId: reservation.playerEntityId,
      };
    },
    markDisconnected(sessionToken, now) {
      const reservation = reservations.get(sessionToken);
      if (!reservation) {
        return null;
      }

      reservation.disconnectedAt = now;
      return {
        sessionToken: reservation.sessionToken,
        displayName: reservation.displayName,
        roomId: reservation.roomId,
        playerEntityId: reservation.playerEntityId,
      };
    },
    getReservation(sessionToken) {
      const reservation = reservations.get(sessionToken);
      if (!reservation) {
        return null;
      }

      return { ...reservation };
    },
    listReservations() {
      return [...reservations.values()].map((reservation) => ({ ...reservation }));
    },
    invalidate(sessionToken) {
      return reservations.delete(sessionToken);
    },
    reclaim(sessionToken, now) {
      const reservation = reservations.get(sessionToken);
      if (!reservation) {
        return { accepted: false, reason: "invalid" };
      }

      if (reservation.disconnectedAt === null) {
        return { accepted: false, reason: "not-disconnected" };
      }

      if (now - reservation.disconnectedAt > reclaimWindowMs) {
        reservations.delete(sessionToken);
        return { accepted: false, reason: "expired" };
      }

      reservation.disconnectedAt = null;

      return {
        accepted: true,
        reservation: {
          sessionToken: reservation.sessionToken,
          displayName: reservation.displayName,
          roomId: reservation.roomId,
          playerEntityId: reservation.playerEntityId,
        },
      };
    },
  };
};
