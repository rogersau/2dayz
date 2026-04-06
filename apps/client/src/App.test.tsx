import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { SocketClientError } from "./game/net/socketClient";

const joinMock = vi.fn();
const protocolSubscribeMock = vi.fn();
const protocolIngestMock = vi.fn();
const protocolDrainWorldUpdatesMock = vi.fn();
const reconnectMock = vi.fn();
const subscribeToConnectionMock = vi.fn();
const closeMock = vi.fn();

vi.mock("./game/GameCanvas", () => ({
  GameCanvas: () => <div aria-label="game world">mock game canvas</div>,
}));

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

vi.mock("./game/net/protocolStore", () => ({
  createProtocolStore: () => ({
    drainWorldUpdates: protocolDrainWorldUpdatesMock,
    ingest: protocolIngestMock,
    subscribe: protocolSubscribeMock,
  }),
}));

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
    protocolSubscribeMock.mockImplementation((listener: () => void) => {
      listener();
      return () => {};
    });
    protocolDrainWorldUpdatesMock.mockReturnValue({ deltas: [], snapshot: null });
  });

  it("shows the title menu over the live scene before join", () => {
    render(<App />);

    expect(screen.getByLabelText(/game world/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/title menu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(joinMock).not.toHaveBeenCalled();
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
    protocolDrainWorldUpdatesMock.mockReturnValue({
      deltas: [],
      snapshot: {
        loot: [],
        playerEntityId: "player_survivor",
        players: [
          {
            displayName: "Saved Survivor",
            entityId: "player_survivor",
            health: { current: 86, isDead: false, max: 100 },
            inventory: {
              ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 21 }],
              equippedWeaponSlot: 0,
              slots: [
                { itemId: "weapon_pistol", quantity: 1 },
                { itemId: "bandage", quantity: 2 },
                null,
                null,
                null,
                null,
              ],
            },
            transform: { rotation: 0, x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
          },
        ],
        roomId: "room_browser-v1",
        tick: 1,
        type: "snapshot",
        zombies: [],
      },
    });

    window.sessionStorage.setItem("2dayz:session-token", "session_saved");
    window.localStorage.setItem("2dayz:display-name", "Saved Survivor");

    render(<App />);

    await waitFor(() => {
      expect(reconnectMock).toHaveBeenCalledWith({ sessionToken: "session_saved" });
    });

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("Room: room_browser-v1"))).toBeInTheDocument();
    });

    expect(screen.getByText((content) => content.includes("Health: 86/100"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Weapon: weapon_pistol"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("Ammo: 21"))).toBeInTheDocument();
    expect(window.localStorage.getItem("2dayz:display-name")).toBe("Saved Survivor");
  });

  it("retries reconnect briefly when the server still reports not-disconnected", async () => {
    reconnectMock
      .mockRejectedValueOnce(new SocketClientError("not-disconnected"))
      .mockResolvedValueOnce({
        type: "room-joined",
        playerEntityId: "player_survivor",
        roomId: "room_browser-v1",
        sessionToken: "session_saved",
      });

    window.sessionStorage.setItem("2dayz:session-token", "session_saved");
    window.localStorage.setItem("2dayz:display-name", "Saved Survivor");

    render(<App />);

    await waitFor(() => {
      expect(reconnectMock).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText((content) => content.includes("Room: room_browser-v1"))).toBeInTheDocument();
  });

  it("keeps the expired banner visible until the user explicitly retries into a fresh run", async () => {
    reconnectMock.mockRejectedValueOnce(new SocketClientError("expired"));

    window.sessionStorage.setItem("2dayz:session-token", "session_expired");
    window.localStorage.setItem("2dayz:display-name", "Expired Survivor");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/your previous session expired/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/display name/i)).toHaveValue("Expired Survivor");
    expect(window.sessionStorage.getItem("2dayz:session-token")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /retry join/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /join a live session/i })).toBeInTheDocument();
    });
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

  it("handles a socket close emitted immediately after join completion", async () => {
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

    await act(async () => {
      handleConnectionChange?.({ type: "closed", reason: "internal-error" });
      await Promise.resolve();
    });

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
    window.sessionStorage.removeItem("2dayz:session-token");
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
