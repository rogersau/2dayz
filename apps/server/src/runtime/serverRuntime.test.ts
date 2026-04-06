import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

import type { ServerConfig } from "../config";
import { SERVER_TICK_RATE } from "@2dayz/shared";
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

  it("uses the simulation tick cadence by default", async () => {
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
    });

    await runtime.start();
    await vi.advanceTimersByTimeAsync(151);
    await runtime.stop();

    expect(roomManager.tickAllRooms).toHaveBeenCalledTimes(3);
    expect(roomManager.tickAllRooms.mock.calls[0]?.length).toBe(0);
    expect(1000 / SERVER_TICK_RATE).toBe(50);
  });

  it("reports tick durations through the injected observer", async () => {
    vi.useFakeTimers();

    const roomManager = {
      tickAllRooms: vi.fn(),
      getRoomCount: vi.fn(() => 0),
    };
    const httpServer = createHttpServerDouble();
    const socketServer = {
      close: vi.fn(),
    };
    const onTickDuration = vi.fn();
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
      onTickDuration,
    });

    await runtime.start();
    await vi.advanceTimersByTimeAsync(55);
    await runtime.stop();

    expect(onTickDuration).toHaveBeenCalledTimes(1);
    expect(typeof onTickDuration.mock.calls[0]?.[0]).toBe("number");
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
