import {
  serverMessageSchema,
  type DeltaMessage,
  type ErrorMessage,
  type RoomJoinedMessage,
  type RoomStatusMessage,
  type SnapshotMessage,
} from "@2dayz/shared";

type ProtocolState = {
  delta: DeltaMessage | null;
  error: ErrorMessage | null;
  pendingDeltas: DeltaMessage[];
  roomJoined: RoomJoinedMessage | null;
  roomStatus: RoomStatusMessage | null;
  snapshot: SnapshotMessage | null;
};

export type ProtocolStore = ReturnType<typeof createProtocolStore>;

export const createProtocolStore = () => {
  let state: ProtocolState = {
      delta: null,
      error: null,
      pendingDeltas: [],
      roomJoined: null,
      roomStatus: null,
      snapshot: null,
  };
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getState: () => state,
    ingest(message: unknown) {
      const parsed = serverMessageSchema.parse(message);

      if (parsed.type === "room-joined") {
        state = { ...state, roomJoined: parsed, error: null };
        emit();
        return parsed;
      }

      if (parsed.type === "room-status") {
        state = { ...state, roomStatus: parsed };
        emit();
        return parsed;
      }

      if (parsed.type === "snapshot") {
        state = {
          ...state,
          pendingDeltas: state.pendingDeltas.filter((delta) => delta.tick > parsed.tick),
          snapshot: parsed,
        };
        emit();
        return parsed;
      }

      if (parsed.type === "delta") {
        const snapshotTick = state.snapshot?.tick ?? -1;
        if (parsed.tick <= snapshotTick || state.pendingDeltas.some((delta) => delta.tick === parsed.tick)) {
          return parsed;
        }

        state = {
          ...state,
          delta: parsed,
          pendingDeltas: [...state.pendingDeltas, parsed].sort((left, right) => left.tick - right.tick),
        };
        emit();
        return parsed;
      }

      state = { ...state, error: parsed };
      emit();
      return parsed;
    },
    drainWorldUpdates() {
      const worldUpdates = {
        deltas: state.pendingDeltas,
        snapshot: state.snapshot,
      };
      state = {
        ...state,
        pendingDeltas: [],
        snapshot: null,
      };
      return worldUpdates;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
