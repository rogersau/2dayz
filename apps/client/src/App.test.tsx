import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

const joinMock = vi.fn();
const reconnectMock = vi.fn();
const subscribeToConnectionMock = vi.fn();
const closeMock = vi.fn();

vi.mock("./game/net/socketClient", () => {
  class SocketClientError extends Error {
    constructor(public readonly reason: string) {
      super(reason);
      this.name = "SocketClientError";
    }
  }

  return {
    SocketClientError,
    createSocketClient: () => ({
      close: closeMock,
      join: joinMock,
      reconnect: reconnectMock,
      subscribeToConnection: subscribeToConnectionMock,
    }),
  };
});

describe("App join and reconnect flow", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    joinMock.mockResolvedValue({
      type: "room-joined",
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
      sessionToken: "session_test",
    });
    reconnectMock.mockResolvedValue({
      type: "room-joined",
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
      sessionToken: "session_test",
    });
    subscribeToConnectionMock.mockReturnValue(() => {});
  });

  it("gates the first join attempt behind the controls card and only joins after continue", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "  Survivor  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(joinMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /before you drop in/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue to session/i }));

    await waitFor(() => {
      expect(joinMock).toHaveBeenCalledWith({ displayName: "Survivor" });
    });
  });

  it("persists the display name and session token locally and reconnects with the saved display name", async () => {
    window.localStorage.setItem("2dayz:session-token", "session_saved");
    window.localStorage.setItem("2dayz:display-name", "Saved Survivor");

    render(<App />);

    await waitFor(() => {
      expect(reconnectMock).toHaveBeenCalledWith({ sessionToken: "session_saved" });
    });

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("Room: room_browser-v1"))).toBeInTheDocument();
    });

    expect(screen.getByText((content) => content.includes("Weapon: none"))).toBeInTheDocument();
    expect(window.localStorage.getItem("2dayz:display-name")).toBe("Saved Survivor");
  });

  it("moves from joined state into a reconnectable retry banner when the active socket disconnects", async () => {
    let handleConnectionChange: ((state: { type: "closed"; reason: string } | { type: "open" }) => void) | undefined;
    subscribeToConnectionMock.mockImplementation((listener: typeof handleConnectionChange) => {
      handleConnectionChange = listener;
      return () => {};
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to session/i }));

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("Room: room_browser-v1"))).toBeInTheDocument();
    });

    handleConnectionChange?.({ type: "closed", reason: "internal-error" });

    await waitFor(() => {
      expect(screen.getByText(/could not join the session/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry join/i })).toBeInTheDocument();
  });

  it("stores the joined player entity id for later self-identity use", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to session/i }));

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("Player: player_survivor"))).toBeInTheDocument();
    });
  });

  it("bypasses the controls step on a later same-session join after controls were already dismissed", async () => {
    joinMock
      .mockResolvedValueOnce({
        type: "room-joined",
        playerEntityId: "player_survivor",
        roomId: "room_browser-v1",
        sessionToken: "session_first",
      })
      .mockRejectedValueOnce(new Error("join failed"))
      .mockResolvedValueOnce({
        type: "room-joined",
        playerEntityId: "player_survivor",
        roomId: "room_browser-v1",
        sessionToken: "session_second",
      });

    const firstRender = render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue to session/i }));

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("Room: room_browser-v1"))).toBeInTheDocument();
    });

    firstRender.unmount();
    window.localStorage.removeItem("2dayz:session-token");
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "fail survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/could not join the session/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /retry join/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Second Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => {
      expect(joinMock).toHaveBeenLastCalledWith({ displayName: "Second Survivor" });
    });

    expect(screen.queryByRole("heading", { name: /before you drop in/i })).not.toBeInTheDocument();
  });
});
