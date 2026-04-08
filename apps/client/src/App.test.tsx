import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { SocketClientError } from "./game/net/socketClient";
import "./styles.css";

const createSocketClientMock = vi.fn();
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
    createSocketClient: (options: unknown) => {
      createSocketClientMock(options);
      return {
        close: closeMock,
        join: joinMock,
        reconnect: reconnectMock,
        subscribeToConnection: subscribeToConnectionMock,
      };
    },
  };
});

vi.mock("./game/net/protocolStore", () => ({
  createProtocolStore: () => ({
    drainWorldUpdates: protocolDrainWorldUpdatesMock,
    ingest: protocolIngestMock,
    subscribe: protocolSubscribeMock,
  }),
}));

const expectJoinedShell = () => {
  expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /quickbar slot 1/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /open inventory/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /collapse inventory/i })).not.toBeInTheDocument();
};

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

  it("shows the field briefing before the first join", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "  Survivor  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));

    expect(joinMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /field briefing/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(joinMock).toHaveBeenCalledWith({ displayName: "Survivor" });
    });
  });

  it("keeps the controls step interactive inside the interrupt layer", () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));

    const controlsCard = screen.getByRole("heading", { name: /field briefing/i }).closest("section");

    expect(controlsCard).not.toBeNull();
    expect(controlsCard).toHaveClass("interrupt-card");
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
      expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
    });

    expectJoinedShell();
    expect(window.localStorage.getItem("2dayz:display-name")).toBe("Saved Survivor");
  });

  it("clears legacy localStorage reconnect tokens before attempting reconnect", async () => {
    window.localStorage.setItem("2dayz:display-name", "Saved Survivor");
    window.localStorage.setItem("2dayz:session-token", "session_legacy");

    render(<App />);

    await waitFor(() => {
      expect(reconnectMock).not.toHaveBeenCalled();
    });

    expect(window.localStorage.getItem("2dayz:session-token")).toBeNull();
    expect(screen.getByRole("heading", { name: /2dayz/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Saved Survivor");
  });

  it("defaults dev socket mode to websocket unless mock mode is explicitly requested", () => {
    render(<App />);

    expect(createSocketClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "ws",
      }),
    );
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

    expectJoinedShell();
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
      expect(screen.getByRole("heading", { name: /2dayz/i })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
    });

    expectJoinedShell();

    handleConnectionChange?.({ type: "closed", reason: "internal-error" });

    await waitFor(() => {
      expect(screen.getByText(/could not join the session/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /retry join/i })).toBeInTheDocument();
  });

  it("hides the death overlay after a dead player disconnects out of the joined shell", async () => {
    let handleConnectionChange: ((state: { type: "closed"; reason: string } | { type: "open" }) => void) | undefined;
    subscribeToConnectionMock.mockImplementation((listener: typeof handleConnectionChange) => {
      handleConnectionChange = listener;
      return () => {};
    });
    protocolDrainWorldUpdatesMock.mockReturnValue({
      deltas: [],
      snapshot: {
        loot: [],
        playerEntityId: "player_survivor",
        players: [
          {
            displayName: "Dead Survivor",
            entityId: "player_survivor",
            health: { current: 0, isDead: true, max: 100 },
            inventory: {
              ammoStacks: [],
              equippedWeaponSlot: null,
              slots: [null, null, null, null, null, null],
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

    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /you died/i })).toBeInTheDocument();
    });

    handleConnectionChange?.({ type: "closed", reason: "internal-error" });

    await waitFor(() => {
      expect(screen.getByText(/could not join the session/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /you died/i })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
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

  it("renders the joined shell with combat hud and without the old quickbar or inventory controls", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
    });

    expectJoinedShell();
  });

  it("shows the local replicated combat hud values after join", async () => {
    protocolDrainWorldUpdatesMock.mockReturnValue({
      deltas: [],
      snapshot: {
        loot: [],
        playerEntityId: "player_survivor",
        players: [
          {
            displayName: "Quickbar Survivor",
            entityId: "player_survivor",
            health: { current: 100, isDead: false, max: 100 },
            inventory: {
              ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 12 }],
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
            weaponState: {
              fireCooldownRemainingMs: 0,
              isReloading: false,
              magazineAmmo: 5,
              reloadRemainingMs: 0,
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

    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/health 100\/100/i)).toBeInTheDocument();
    expect(screen.getByText(/ammo 5\/12/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open inventory/i })).not.toBeInTheDocument();
  });

  it("shows reserve ammo only for the equipped weapon ammo type", async () => {
    protocolDrainWorldUpdatesMock.mockReturnValue({
      deltas: [],
      snapshot: {
        loot: [],
        playerEntityId: "player_survivor",
        players: [
          {
            displayName: "Mixed Ammo Survivor",
            entityId: "player_survivor",
            health: { current: 91, isDead: false, max: 100 },
            inventory: {
              ammoStacks: [
                { ammoItemId: "ammo_9mm", quantity: 12 },
                { ammoItemId: "ammo_shells", quantity: 30 },
              ],
              equippedWeaponSlot: 0,
              slots: [
                { itemId: "weapon_pistol", quantity: 1 },
                { itemId: "weapon_shotgun", quantity: 1 },
                null,
                null,
                null,
                null,
              ],
            },
            weaponState: {
              fireCooldownRemainingMs: 0,
              isReloading: false,
              magazineAmmo: 5,
              reloadRemainingMs: 0,
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

    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/ammo 5\/12/i)).toBeInTheDocument();
    expect(screen.queryByText(/ammo 5\/42/i)).not.toBeInTheDocument();
  });

  it("does not render the removed joined-state quickbar controls", async () => {
    protocolDrainWorldUpdatesMock.mockReturnValue({
      deltas: [],
      snapshot: {
        loot: [],
        playerEntityId: "player_survivor",
        players: [
          {
            displayName: "Accessible Survivor",
            entityId: "player_survivor",
            health: { current: 100, isDead: false, max: 100 },
            inventory: {
              ammoStacks: [],
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

    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/combat hud/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /quickbar slot 1/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open inventory/i })).not.toBeInTheDocument();
  });

  it("bypasses the field briefing on a later same-session join after it was already dismissed", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter session/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
    });

    expectJoinedShell();

    firstRender.unmount();
    window.sessionStorage.removeItem("2dayz:session-token");
    render(<App />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "fail survivor" },
    });
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));

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
    fireEvent.click(screen.getByRole("button", { name: /review briefing/i }));

    await waitFor(() => {
      expect(joinMock).toHaveBeenLastCalledWith({ displayName: "Second Survivor" });
    });

    expect(screen.queryByRole("heading", { name: /field briefing/i })).not.toBeInTheDocument();
  });
});
