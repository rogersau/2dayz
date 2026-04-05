import {
  errorMessageSchema,
  joinRequestSchema,
  reconnectRequestSchema,
  roomJoinedMessageSchema,
  roomStatusMessageSchema,
  serverMessageSchema,
  type ErrorReason,
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

const createMockJoinMessage = (displayName: string, sessionToken = createSessionToken()) => {
  return roomJoinedMessageSchema.parse({
    type: "room-joined",
    roomId: MOCK_ROOM_ID,
    playerEntityId: `player_${sanitizeName(displayName)}`,
    sessionToken,
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

export type SocketClient = ReturnType<typeof createSocketClient>;

export const createSocketClient = ({
  mode = "mock",
  protocolStore,
  wsUrl,
}: SocketClientOptions) => {
  let socket: WebSocket | null = null;
  let pendingRequest: PendingRequest | null = null;
  const mockSessions = new Map<string, JoinResult>();

  const resolvedUrl =
    wsUrl ??
    (typeof window !== "undefined"
      ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`
      : "ws://localhost:3000/ws");

  const close = () => {
    socket?.close();
    socket = null;
    if (pendingRequest) {
      pendingRequest.reject(new SocketClientError("internal-error"));
      pendingRequest = null;
    }
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
      nextSocket.addEventListener("open", () => resolve(), { once: true });
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

  const mockJoin = async ({ displayName }: { displayName: string }) => {
    await wait(120);

    if (displayName.toLowerCase().includes("fail")) {
      const error = errorMessageSchema.parse({ type: "error", reason: "room-unavailable" });
      protocolStore.ingest(error);
      throw new SocketClientError(error.reason);
    }

    const joined = createMockJoinMessage(displayName);
    mockSessions.set(joined.sessionToken, joined);
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
    return existingSession;
  };

  return {
    close,
    async join({ displayName }: { displayName: string }) {
      const payload = joinRequestSchema.parse({ type: "join", displayName });

      if (mode === "mock") {
        return await mockJoin(payload);
      }

      return await sendRequest(payload);
    },
    async reconnect({ sessionToken }: { sessionToken: string }) {
      const payload = reconnectRequestSchema.parse({ type: "reconnect", sessionToken });

      if (mode === "mock") {
        return await mockReconnect(payload);
      }

      return await sendRequest(payload);
    },
  };
};
