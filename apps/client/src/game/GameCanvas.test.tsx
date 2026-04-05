import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bootGameMock = vi.hoisted(() => vi.fn());

vi.mock("./boot", () => ({
  bootGame: bootGameMock,
}));

import { GameCanvas } from "./GameCanvas";

describe("GameCanvas", () => {
  const originalUserAgent = window.navigator.userAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0",
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it("shows the actual boot error message when runtime startup fails", async () => {
    bootGameMock.mockImplementation(() => {
      throw new Error("WebGL context creation failed");
    });

    render(
      <GameCanvas
        socketClient={{ sendInput: vi.fn() }}
        store={{ subscribe: vi.fn(), getState: vi.fn() } as never}
      />,
    );

    expect(await screen.findByText(/webgl context creation failed/i)).toBeInTheDocument();
  });
});
