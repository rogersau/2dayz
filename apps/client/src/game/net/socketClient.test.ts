import { afterEach, describe, expect, it, vi } from "vitest";

import { inputMessageSchema, roomJoinedMessageSchema } from "@2dayz/shared";

import { createProtocolStore } from "./protocolStore";
import { createSocketClient } from "./socketClient";

describe("socketClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a second in-flight request while a join is already pending", async () => {
    const socketClient = createSocketClient({
      mode: "mock",
      protocolStore: createProtocolStore(),
    });

    const firstJoin = socketClient.join({ displayName: "Survivor" });

    await expect(socketClient.reconnect({ sessionToken: "session_test" })).rejects.toMatchObject({
      reason: "session-active",
    });

    await expect(firstJoin).resolves.toMatchObject({
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
    });
  });

  it("sends typed input over the active websocket connection after joining", async () => {
    class FakeWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      static instances: FakeWebSocket[] = [];

      readonly listeners = new Map<string, Array<(event?: Event | MessageEvent) => void>>();
      readonly sentMessages: string[] = [];
      readyState = FakeWebSocket.CONNECTING;

      constructor(public readonly url: string) {
        FakeWebSocket.instances.push(this);
      }

      addEventListener(type: string, listener: (event?: Event | MessageEvent) => void, options?: AddEventListenerOptions | boolean) {
        const once = typeof options === "object" && options?.once;
        const wrapped = once
          ? (event?: Event | MessageEvent) => {
            listener(event);
            this.removeEventListener(type, wrapped);
          }
          : listener;
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(wrapped);
        this.listeners.set(type, handlers);
      }

      close() {
        this.readyState = FakeWebSocket.CLOSED;
      }

      dispatch(type: string, event?: Event | MessageEvent) {
        for (const listener of this.listeners.get(type) ?? []) {
          listener(event);
        }
      }

      emitMessage(data: unknown) {
        this.dispatch("message", { data: JSON.stringify(data) } as MessageEvent);
      }

      open() {
        this.readyState = FakeWebSocket.OPEN;
        this.dispatch("open", new Event("open"));
      }

      removeEventListener(type: string, listener: (event?: Event | MessageEvent) => void) {
        const handlers = this.listeners.get(type) ?? [];
        this.listeners.set(type, handlers.filter((handler) => handler !== listener));
      }

      send(message: string) {
        this.sentMessages.push(message);
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);

    const protocolStore = createProtocolStore();
    const socketClient = createSocketClient({
      mode: "ws",
      protocolStore,
      wsUrl: "ws://example.test/ws",
    });
    const joinPromise = socketClient.join({ displayName: "Survivor" });
    const socket = FakeWebSocket.instances[0];

    expect(socket).toBeDefined();
    if (!socket) {
      throw new Error("expected websocket instance");
    }

    socket.open();
    await new Promise((resolve) => setTimeout(resolve, 0));
    socket.emitMessage(roomJoinedMessageSchema.parse({
      type: "room-joined",
      roomId: "room_browser-v1",
      playerEntityId: "player_survivor",
      sessionToken: "session_test",
    }));

    await joinPromise;

    const input = inputMessageSchema.parse({
      actions: { fire: true },
      aim: { x: 14, y: -6 },
      movement: { x: 1, y: 0 },
      sequence: 4,
      type: "input",
    });

    socketClient.sendInput(input);

    expect(socket.sentMessages).toContain(JSON.stringify(input));
  });
});
