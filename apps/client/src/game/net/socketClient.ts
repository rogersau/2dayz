import {
  deltaMessageSchema,
  errorMessageSchema,
  inputMessageSchema,
  joinRequestSchema,
  reconnectRequestSchema,
  roomJoinedMessageSchema,
  roomStatusMessageSchema,
  serverMessageSchema,
  snapshotMessageSchema,
  type ErrorReason,
  type InputMessage,
  type RoomJoinedMessage,
} from "@2dayz/shared";

import type { ProtocolStore } from "./protocolStore";

const MOCK_ROOM_ID = "room_browser-v1";
const MOCK_ROOM_NAME = "Browser Room 1";

const wait = (durationMs: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, durationMs);
});

const sanitizeName = (displayName: string) => {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "survivor";
};

const createSessionToken = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `session_${crypto.randomUUID()}`;
  }

  return `session_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeMovement = (movement: { x: number; y: number }) => {
  const magnitude = Math.hypot(movement.x, movement.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: movement.x / magnitude,
    y: movement.y / magnitude,
  };
};

const createMockJoinMessage = (displayName: string, sessionToken = createSessionToken()) => {
  return roomJoinedMessageSchema.parse({
    type: "room-joined",
    roomId: MOCK_ROOM_ID,
    playerEntityId: `player_${sanitizeName(displayName)}`,
    sessionToken,
  });
};

const createMockInventory = (worldState: MockWorldState) => {
  return {
    ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: worldState.ammoReserve }],
    equippedWeaponSlot: worldState.equippedWeaponSlot,
    slots: [
      { itemId: "weapon_pistol", quantity: 1 },
      worldState.localInventorySlotOne,
      null,
      null,
      null,
      null,
    ],
  };
};

const createMockSnapshot = (joined: JoinResult, tick: number, worldState: MockWorldState) => {
  return snapshotMessageSchema.parse({
    loot: [
      {
        entityId: "loot_shells",
        itemId: "ammo_9mm",
        position: { x: -3, y: 4 },
        quantity: 15,
      },
    ],
    playerEntityId: joined.playerEntityId,
    players: [
      {
        displayName: "You",
        entityId: joined.playerEntityId,
        health: { current: 86, isDead: false, max: 100 },
        inventory: createMockInventory(worldState),
        lastProcessedInputSequence: worldState.lastProcessedInputSequence,
        transform: worldState.localTransform,
        velocity: { x: 0, y: 0 },
      },
      {
        displayName: "Bandit",
        entityId: "player_bandit",
        inventory: {
          ammoStacks: [],
          equippedWeaponSlot: null,
          slots: [null, null, null, null, null, null],
        },
        transform: { rotation: 0.2, x: 6, y: -3 },
        velocity: { x: -0.3, y: 0 },
      },
    ],
    roomId: joined.roomId,
    tick,
    type: "snapshot",
    zombies: [
      {
        archetypeId: "zombie_walker",
        entityId: "zombie_1",
        state: "chasing",
        transform: { rotation: 0.1, x: -8, y: -2 },
      },
    ],
  });
};

const createMockDelta = (joined: JoinResult, tick: number, worldState: MockWorldState) => {
  const phase = tick * 0.45;

  return deltaMessageSchema.parse({
    enteredEntities: [],
    entityUpdates: [
      {
        entityId: joined.playerEntityId,
        health: { current: 86, isDead: false, max: 100 },
        inventory: createMockInventory(worldState),
        lastProcessedInputSequence: worldState.lastProcessedInputSequence,
        transform: worldState.localTransform,
        velocity: { x: 0, y: 0 },
      },
      {
        entityId: "player_bandit",
        transform: { rotation: 0.2, x: 6 - Math.sin(phase) * 2.5, y: -3 + Math.cos(phase) * 1.2 },
        velocity: { x: -0.3, y: 0.2 },
      },
      {
        entityId: "zombie_1",
        health: { current: 28, isDead: false, max: 40 },
        transform: { rotation: -0.3, x: -8 + Math.cos(phase) * 3, y: -2 + Math.sin(phase) * 2 },
        velocity: { x: 0.2, y: 0.1 },
      },
    ],
    events: [],
    removedEntityIds: [],
    roomId: joined.roomId,
    tick,
    type: "delta",
  });
};

export class SocketClientError extends Error {
  constructor(public readonly reason: ErrorReason) {
    super(reason);
    this.name = "SocketClientError";
  }
}

export type JoinResult = RoomJoinedMessage;

type SocketMode = "mock" | "ws";

type SocketClientOptions = {
  mode?: SocketMode;
  protocolStore: ProtocolStore;
  wsUrl?: string;
};

type PendingRequest = {
  reject: (error: SocketClientError) => void;
  resolve: (result: JoinResult) => void;
};

type ConnectionEvent = { type: "open" } | { type: "closed"; reason: ErrorReason };
type PendingRequestKind = "join" | "reconnect";

type MockWorldState = {
  ammoReserve: number;
  equippedWeaponSlot: number | null;
  lastProcessedInputSequence: number;
  localInventorySlotOne: { itemId: string; quantity: number } | null;
  localTransform: { rotation: number; x: number; y: number };
};

export type SocketClient = ReturnType<typeof createSocketClient>;

export const createSocketClient = ({
  mode = "mock",
  protocolStore,
  wsUrl,
}: SocketClientOptions) => {
  let socket: WebSocket | null = null;
  let activeRequestKind: PendingRequestKind | null = null;
  let activeMockSession: JoinResult | null = null;
  let mockTick = 1;
  let mockWorldInterval: ReturnType<typeof setInterval> | null = null;
  let mockWorldState: MockWorldState = {
    ammoReserve: 27,
    equippedWeaponSlot: 0,
    lastProcessedInputSequence: 0,
    localInventorySlotOne: { itemId: "bandage", quantity: 2 },
    localTransform: { rotation: 0, x: 0, y: 0 },
  };
  let pendingRequest: PendingRequest | null = null;
  const mockSessions = new Map<string, JoinResult>();
  const connectionListeners = new Set<(event: ConnectionEvent) => void>();

  const emitConnectionEvent = (event: ConnectionEvent) => {
    for (const listener of connectionListeners) {
      listener(event);
    }
  };

  const resolvedUrl =
    wsUrl ??
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      : "ws://localhost:3000/ws");

  const close = () => {
    if (mockWorldInterval) {
      clearInterval(mockWorldInterval);
      mockWorldInterval = null;
    }
    socket?.close();
    socket = null;
    activeMockSession = null;
    if (pendingRequest) {
      pendingRequest.reject(new SocketClientError("internal-error"));
      pendingRequest = null;
    }
  };

  const startMockWorld = (joined: JoinResult) => {
    if (mockWorldInterval) {
      clearInterval(mockWorldInterval);
    }

    mockTick = 1;
    mockWorldState = {
      ammoReserve: 27,
      equippedWeaponSlot: 0,
      lastProcessedInputSequence: 0,
      localInventorySlotOne: { itemId: "bandage", quantity: 2 },
      localTransform: { rotation: 0, x: 0, y: 0 },
    };
    protocolStore.ingest(createMockSnapshot(joined, mockTick, mockWorldState));

    mockWorldInterval = setInterval(() => {
      mockTick += 1;
      protocolStore.ingest(createMockDelta(joined, mockTick, mockWorldState));
    }, 300);
  };

  const sendInput = (input: InputMessage) => {
    const payload = inputMessageSchema.parse(input);

    if (mode === "mock") {
      const direction = normalizeMovement(payload.movement);
      const aimMagnitude = Math.hypot(payload.aim.x, payload.aim.y);

      mockWorldState = {
        ...mockWorldState,
        ammoReserve: payload.actions.fire ? Math.max(0, mockWorldState.ammoReserve - 1) : mockWorldState.ammoReserve,
        equippedWeaponSlot:
          payload.actions.inventory?.type === "equip"
            ? payload.actions.inventory.toSlot
            : mockWorldState.equippedWeaponSlot,
        lastProcessedInputSequence: payload.sequence,
        localInventorySlotOne: payload.actions.reload ? { itemId: "bandage", quantity: 1 } : mockWorldState.localInventorySlotOne,
        localTransform: {
          rotation: aimMagnitude > 0
            ? Math.atan2(payload.aim.y, payload.aim.x)
            : mockWorldState.localTransform.rotation,
          x: mockWorldState.localTransform.x + direction.x * 0.2,
          y: mockWorldState.localTransform.y + direction.y * 0.2,
        },
      };

      if (activeMockSession) {
        mockTick += 1;
        protocolStore.ingest(createMockDelta(activeMockSession, mockTick, mockWorldState));
      }

      return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(payload));
  };

  const settleFromServerMessage = (message: unknown) => {
    const parsed = protocolStore.ingest(message);

    if (parsed.type === "room-joined") {
      pendingRequest?.resolve(parsed);
      pendingRequest = null;
      return;
    }

    if (parsed.type === "error") {
      pendingRequest?.reject(new SocketClientError(parsed.reason));
      pendingRequest = null;
    }
  };

  const ensureSocket = async () => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return socket;
    }

    const nextSocket = new WebSocket(resolvedUrl);
    socket = nextSocket;

    await new Promise<void>((resolve, reject) => {
      nextSocket.addEventListener("open", () => {
        emitConnectionEvent({ type: "open" });
        resolve();
      }, { once: true });
      nextSocket.addEventListener(
        "error",
        () => reject(new SocketClientError("internal-error")),
        { once: true },
      );
    });

    nextSocket.addEventListener("message", (event) => {
      try {
        const raw = JSON.parse(String(event.data)) as unknown;
        settleFromServerMessage(serverMessageSchema.parse(raw));
      } catch {
        settleFromServerMessage(errorMessageSchema.parse({ type: "error", reason: "invalid-message" }));
      }
    });

    nextSocket.addEventListener("close", () => {
      socket = null;
      emitConnectionEvent({ type: "closed", reason: "internal-error" });
      if (pendingRequest) {
        pendingRequest.reject(new SocketClientError("internal-error"));
        pendingRequest = null;
      }
    });

    return nextSocket;
  };

  const sendRequest = async (payload: ReturnType<typeof joinRequestSchema.parse> | ReturnType<typeof reconnectRequestSchema.parse>) => {
    const activeSocket = await ensureSocket();

    return await new Promise<JoinResult>((resolve, reject) => {
      pendingRequest = { resolve, reject };
      activeSocket.send(JSON.stringify(payload));
    });
  };

  const runWithSinglePendingRequest = async <T>(kind: PendingRequestKind, operation: () => Promise<T>) => {
    if (activeRequestKind) {
      throw new SocketClientError("session-active");
    }

    activeRequestKind = kind;

    try {
      return await operation();
    } finally {
      activeRequestKind = null;
    }
  };

  const mockJoin = async ({ displayName }: { displayName: string }) => {
    await wait(120);

    if (displayName.toLowerCase().includes("fail")) {
      const error = errorMessageSchema.parse({ type: "error", reason: "room-unavailable" });
      protocolStore.ingest(error);
      throw new SocketClientError(error.reason);
    }

    const joined = createMockJoinMessage(displayName);
    mockSessions.set(joined.sessionToken, joined);
    activeMockSession = joined;
    protocolStore.ingest(joined);
    protocolStore.ingest(
      roomStatusMessageSchema.parse({
        type: "room-status",
        room: {
          roomId: joined.roomId,
          name: MOCK_ROOM_NAME,
          status: "active",
          playerCount: 1,
          capacity: 12,
        },
      }),
    );
    startMockWorld(joined);
    return joined;
  };

  const mockReconnect = async ({ sessionToken }: { sessionToken: string }) => {
    await wait(120);
    const existingSession = mockSessions.get(sessionToken);

    if (!existingSession) {
      const error = errorMessageSchema.parse({ type: "error", reason: "expired" });
      protocolStore.ingest(error);
      throw new SocketClientError(error.reason);
    }

    protocolStore.ingest(existingSession);
    activeMockSession = existingSession;
    startMockWorld(existingSession);
    return existingSession;
  };

  return {
    close,
    async join({ displayName }: { displayName: string }) {
      const payload = joinRequestSchema.parse({ type: "join", displayName });

      return await runWithSinglePendingRequest("join", async () => {
        if (mode === "mock") {
          return await mockJoin(payload);
        }

        return await sendRequest(payload);
      });
    },
    async reconnect({ sessionToken }: { sessionToken: string }) {
      const payload = reconnectRequestSchema.parse({ type: "reconnect", sessionToken });

      return await runWithSinglePendingRequest("reconnect", async () => {
        if (mode === "mock") {
          return await mockReconnect(payload);
        }

        return await sendRequest(payload);
      });
    },
    sendInput,
    subscribeToConnection(listener: (event: ConnectionEvent) => void) {
      connectionListeners.add(listener);
      return () => {
        connectionListeners.delete(listener);
      };
    },
  };
};
