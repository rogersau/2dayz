import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { SocketClientError } from "./game/net/socketClient";
import "./styles.css";

const joinMock = vi.fn();
const protocolSubscribeMock = vi.fn();
const protocolIngestMock = vi.fn();
const protocolDrainWorldUpdatesMock = vi.fn();
const reconnectMock = vi.fn();
const subscribeToConnectionMock = vi.fn();
const closeMock = vi.fn();

vi.mock("./game/GameCanvas", () => ({
  GameCanvas: () => <div aria-label="game world">mock game canvas</div>,
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

const expectJoinedShell = () => {
  expect(screen.getByLabelText(/game shell/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /quickbar slot 1/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /open inventory/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/survival hud/i)).not.toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: /2d dayz/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toHaveValue("Saved Survivor");
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
      expect(screen.getByRole("heading", { name: /2d dayz/i })).toBeInTheDocument();
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

  it("renders the joined shell without the removed html survival hud", async () => {
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

  it("keeps the quickbar visible and toggles the inventory panel from the joined hud", async () => {
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
      expect(screen.getByRole("button", { name: /quickbar slot 1/i })).toBeInTheDocument();
    });

    expect(screen.queryByText(/slot 1/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quickbar slot 1, weapon_pistol x1, equipped/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /quickbar slot 2, bandage x2, not equipped/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /open inventory/i }).closest("section")).toHaveClass("inventory-card");
    expect(screen.getByRole("button", { name: /quickbar slot 1/i }).closest("section")).toHaveClass("quickbar-hud");

    fireEvent.click(screen.getByRole("button", { name: /open inventory/i }));

    expect(screen.getByTestId("inventory-panel-content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quickbar slot 1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /collapse inventory/i }));

    expect(screen.queryByTestId("inventory-panel-content")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quickbar slot 1/i })).toBeInTheDocument();
  });

  it("does not steal Tab from focused joined-state controls", async () => {
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

    const inventoryToggle = await screen.findByRole("button", { name: /open inventory/i });

    inventoryToggle.focus();
    fireEvent.keyDown(inventoryToggle, {
      code: "Tab",
      key: "Tab",
    });

    expect(screen.queryByTestId("inventory-panel-content")).not.toBeInTheDocument();
  });

  it("does not optimistically change the equipped quickbar slot before authoritative replication", async () => {
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

    const slotOne = await screen.findByRole("button", { name: /quickbar slot 1, weapon_pistol x1, equipped/i });
    const slotTwo = screen.getByRole("button", { name: /quickbar slot 2, bandage x2, not equipped/i });

    expect(slotOne).toHaveAttribute("aria-pressed", "true");
    expect(slotTwo).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(slotTwo);

    expect(slotOne).toHaveAttribute("aria-pressed", "true");
    expect(slotTwo).toHaveAttribute("aria-pressed", "false");
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
