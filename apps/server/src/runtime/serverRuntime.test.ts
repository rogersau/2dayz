import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

import type { ServerConfig } from "../config";
import { createServerRuntime } from "./serverRuntime";

afterEach(() => {
  vi.useRealTimers();
});

const createHttpServerDouble = () => {
  return {
    once: vi.fn(),
    off: vi.fn(),
    listen: vi.fn((_port, _host, callback: () => void) => callback()),
    close: vi.fn((callback: (error?: Error) => void) => callback()),
  };
};

describe("createServerRuntime", () => {
  it("ticks rooms on a fixed interval and stops ticking after shutdown", async () => {
    vi.useFakeTimers();

    const roomManager = {
      tickAllRooms: vi.fn(),
      getRoomCount: vi.fn(() => 0),
    };
    const httpServer = createHttpServerDouble();
    const socketServer = {
      close: vi.fn(),
    };
    const config: ServerConfig = {
      host: "127.0.0.1",
      port: 3011,
      roomCapacity: 12,
      reclaimWindowMs: 30_000,
    };

    const runtime = createServerRuntime({
      config,
      roomManager: roomManager as never,
      createHttpServer: () => httpServer as never,
      createSocketServer: () => socketServer as never,
      tickIntervalMs: 50,
    });

    await runtime.start();
    await vi.advanceTimersByTimeAsync(160);
    await runtime.stop();
    await vi.advanceTimersByTimeAsync(100);

    expect(roomManager.tickAllRooms).toHaveBeenCalledTimes(3);
    expect(socketServer.close).toHaveBeenCalledTimes(1);
    expect(httpServer.close).toHaveBeenCalledTimes(1);
  });

  it("exposes runtime resources after start", async () => {
    const roomManager = {
      tickAllRooms: vi.fn(),
      getRoomCount: vi.fn(() => 0),
    };
    const httpServer = createHttpServerDouble();
    const socketServer = {
      close: vi.fn(),
    };
    const config: ServerConfig = {
      host: "127.0.0.1",
      port: 3011,
      roomCapacity: 12,
      reclaimWindowMs: 30_000,
    };

    const runtime = createServerRuntime({
      config,
      roomManager: roomManager as never,
      createHttpServer: () => httpServer as never,
      createSocketServer: () => socketServer as never,
      tickIntervalMs: 50,
    });

    const started = await runtime.start();

    expect(started.server).toBe(httpServer);
    expect(started.socketServer).toBe(socketServer);

    await runtime.stop();
  });

  it("rejects cleanly on startup errors and closes partially initialized runtime state", async () => {
    vi.useFakeTimers();

    class FakeHttpServer extends EventEmitter {
      close = vi.fn((callback: (error?: Error) => void) => callback());

      listen() {
        this.emit("error", new Error("bind failed"));
        return this;
      }
    }

    const roomManager = {
      tickAllRooms: vi.fn(),
      getRoomCount: vi.fn(() => 0),
    };
    const httpServer = new FakeHttpServer();
    const socketServer = {
      close: vi.fn(),
    };
    const config: ServerConfig = {
      host: "127.0.0.1",
      port: 3011,
      roomCapacity: 12,
      reclaimWindowMs: 30_000,
    };

    const runtime = createServerRuntime({
      config,
      roomManager: roomManager as never,
      createHttpServer: () => httpServer as never,
      createSocketServer: () => socketServer as never,
      tickIntervalMs: 50,
    });

    await expect(runtime.start()).rejects.toThrow("bind failed");
    await vi.advanceTimersByTimeAsync(100);

    expect(socketServer.close).toHaveBeenCalledTimes(1);
    expect(httpServer.close).toHaveBeenCalledTimes(1);
    expect(roomManager.tickAllRooms).not.toHaveBeenCalled();
  });
});
