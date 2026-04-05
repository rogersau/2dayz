import { describe, expect, it, vi } from "vitest";

import type { ServerConfig } from "./config";
import { startServer } from "./index";
import type { Logger } from "./telemetry/logger";

describe("startServer", () => {
  it("pairs signal registration with teardown across repeated start and stop cycles", async () => {
    const signalProcess = {
      once: vi.fn(),
      off: vi.fn(),
    };
    const runtime = {
      start: vi.fn(async () => ({ server: { tag: "http" }, socketServer: { tag: "ws" } })),
      stop: vi.fn(async () => undefined),
    };
    const config: ServerConfig = {
      host: "127.0.0.1",
      port: 3011,
      roomCapacity: 12,
      reclaimWindowMs: 30_000,
    };
    const logger: Logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const first = await startServer({
      config,
      logger,
      signalProcess,
      createRuntime: () => runtime as never,
    });

    const firstSigint = signalProcess.once.mock.calls[0]?.[1];
    const firstSigterm = signalProcess.once.mock.calls[1]?.[1];

    await first.stop();

    const second = await startServer({
      config,
      logger,
      signalProcess,
      createRuntime: () => runtime as never,
    });

    const secondSigint = signalProcess.once.mock.calls[2]?.[1];
    const secondSigterm = signalProcess.once.mock.calls[3]?.[1];

    await second.stop();

    expect(signalProcess.off).toHaveBeenCalledWith("SIGINT", firstSigint);
    expect(signalProcess.off).toHaveBeenCalledWith("SIGTERM", firstSigterm);
    expect(signalProcess.off).toHaveBeenCalledWith("SIGINT", secondSigint);
    expect(signalProcess.off).toHaveBeenCalledWith("SIGTERM", secondSigterm);
    expect(runtime.stop).toHaveBeenCalledTimes(2);
  });
});
