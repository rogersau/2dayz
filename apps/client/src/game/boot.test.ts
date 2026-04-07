import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ErrorReason, Inventory } from "@2dayz/shared";
import { INVENTORY_SLOT_COUNT } from "@2dayz/shared";

type TestConnectionState =
  | { phase: "idle" }
  | { phase: "joined" }
  | { phase: "failed"; reason: ErrorReason };

type TestStoreState = {
  connectionState: TestConnectionState;
  health: { current: number; isDead: boolean; max: number } | null;
  inventory: Inventory;
  isDead: boolean;
  latestTick: number;
  playerEntityId: string | null;
  roomId: string | null;
  worldEntities: { loot: []; players: []; zombies: [] };
};

const createInventory = (overrides: Partial<Inventory> = {}): Inventory => ({
  ammoStacks: [],
  equippedWeaponSlot: null,
  slots: Array.from({ length: INVENTORY_SLOT_COUNT }, () => null),
  ...overrides,
});

const createStoreState = (overrides: Partial<TestStoreState> = {}): TestStoreState => ({
  connectionState: { phase: "idle" },
  health: null,
  inventory: createInventory(),
  isDead: false,
  latestTick: 0,
  playerEntityId: null,
  roomId: null,
  worldEntities: { loot: [], players: [], zombies: [] },
  ...overrides,
});

const {
  createPredictionControllerMock,
  createInputControllerMock,
  createWorldViewMock,
  clearIntervalMock,
  destroyInputControllerMock,
  resetInputControllerMock,
  entityViewDisposeMock,
  predictionApplyInputMock,
  predictionAdvanceSmoothingMock,
  predictionSyncAuthoritativeMock,
  pollInputMock,
  renderFrameMock,
  rendererDisposeMock,
  resizeCameraMock,
  resizeRendererMock,
  sceneDisposeMock,
  setIntervalMock,
  rendererMock,
  worldViewDisposeMock,
} = vi.hoisted(() => ({
  createPredictionControllerMock: vi.fn(),
  createInputControllerMock: vi.fn(),
  createWorldViewMock: vi.fn(),
  clearIntervalMock: vi.fn(),
  destroyInputControllerMock: vi.fn(),
  resetInputControllerMock: vi.fn(),
  entityViewDisposeMock: vi.fn(),
  predictionApplyInputMock: vi.fn(),
  predictionAdvanceSmoothingMock: vi.fn(),
  predictionSyncAuthoritativeMock: vi.fn(),
  pollInputMock: vi.fn(),
  renderFrameMock: vi.fn(),
  rendererDisposeMock: vi.fn(),
  resizeCameraMock: vi.fn(),
  resizeRendererMock: vi.fn(),
  sceneDisposeMock: vi.fn(),
  setIntervalMock: vi.fn(),
  rendererMock: {
    autoClear: true,
    clearDepth: vi.fn(),
    dispose: vi.fn(),
    render: vi.fn(),
  },
  worldViewDisposeMock: vi.fn(),
}));

import { bootGame } from "./boot";

vi.mock("./createRenderer", () => ({
  createRenderer: () => ({
    renderer: rendererMock,
    resize: resizeRendererMock,
  }),
}));

vi.mock("./createCamera", () => ({
  createCamera: () => ({
    camera: { kind: "camera" },
    resize: resizeCameraMock,
  }),
}));

vi.mock("./createScene", () => ({
  createScene: () => ({ dispose: sceneDisposeMock, scene: { kind: "scene" } }),
}));

vi.mock("./input/inputController", () => ({
  createInputController: (...args: unknown[]) => {
    createInputControllerMock(...args);
    return {
      destroy: destroyInputControllerMock,
      pollInput: pollInputMock,
      reset: resetInputControllerMock,
    };
  },
}));

vi.mock("./render/entityViewStore", () => ({
  createEntityViewStore: () => ({
    dispose: entityViewDisposeMock,
  }),
}));

vi.mock("./render/prediction", () => ({
  createPredictionController: (...args: unknown[]) => {
    createPredictionControllerMock(...args);
    return {
      advanceSmoothing: predictionAdvanceSmoothingMock,
      applyInput: predictionApplyInputMock,
      syncAuthoritative: predictionSyncAuthoritativeMock,
    };
  },
}));

vi.mock("./render/createWorldView", () => ({
  createWorldView: (...args: unknown[]) => {
    createWorldViewMock(...args);
    return { dispose: worldViewDisposeMock };
  },
}));

vi.mock("./render/renderFrame", () => ({
  renderFrame: renderFrameMock,
}));

describe("bootGame", () => {
  let requestAnimationFrameSpy: { mockRestore: () => void };
  let cancelAnimationFrameSpy: { mockRestore: () => void };
  let setIntervalSpy: { mockRestore: () => void };
  let clearIntervalSpy: { mockRestore: () => void };
  let scheduledInterval: (() => void) | null;
  let scheduledFrame: FrameRequestCallback | null;

  beforeEach(() => {
    vi.clearAllMocks();
    rendererMock.autoClear = true;
    rendererMock.dispose = rendererDisposeMock;
    scheduledInterval = null;
    scheduledFrame = null;
    pollInputMock.mockImplementation((sequence: number) => ({
      actions: { fire: true },
      aim: { x: 12, y: -4 },
      movement: { x: 1, y: 0 },
      sequence,
      type: "input",
    }));
    requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledFrame = callback;
      return 7;
    });
    cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation(((callback: TimerHandler) => {
      scheduledInterval = callback as () => void;
      setIntervalMock();
      return 11;
    }) as typeof window.setInterval);
    clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(((id?: number) => {
      clearIntervalMock(id);
    }) as typeof window.clearInterval);
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it("does not send input packets until the player is joined, then sends them on the fixed interval", () => {
    const sendInput = vi.fn();
    const canvas = document.createElement("canvas");
    const store = {
      getState: (): TestStoreState => createStoreState(),
      subscribe: () => () => {},
      toggleInventory: vi.fn(),
    };

    bootGame({
      canvas,
      socketClient: { sendInput },
      store: store as never,
    });

    scheduledFrame?.(16);

    expect(sendInput).not.toHaveBeenCalled();
    scheduledInterval?.();

    expect(sendInput).not.toHaveBeenCalled();

    store.getState = (): TestStoreState =>
      createStoreState({ connectionState: { phase: "joined" }, playerEntityId: "player_survivor" });

    scheduledInterval?.();

    expect(sendInput).toHaveBeenCalledWith({
      actions: { fire: true },
      aim: { x: 12, y: -4 },
      movement: { x: 1, y: 0 },
      sequence: 0,
      type: "input",
    });
    expect(renderFrameMock).toHaveBeenCalled();
  });

  it("cleans up scene resources and the input send interval on dispose", () => {
    const canvas = document.createElement("canvas");

    const dispose = bootGame({
      canvas,
      socketClient: { sendInput: vi.fn() },
      store: {
        getState: () => createStoreState(),
        subscribe: () => () => {},
      } as never,
    });

    dispose();

    expect(clearIntervalMock).toHaveBeenCalledWith(11);
    expect(sceneDisposeMock).toHaveBeenCalledTimes(1);
    expect(entityViewDisposeMock).toHaveBeenCalledTimes(1);
    expect(rendererDisposeMock).toHaveBeenCalledTimes(1);
  });

  it("creates and disposes the shared world view alongside the main scene", () => {
    const dispose = bootGame({
      canvas: document.createElement("canvas"),
      socketClient: { sendInput: vi.fn() },
      store: {
        getState: () => createStoreState(),
        subscribe: () => () => {},
      } as never,
    });

    expect(createWorldViewMock).toHaveBeenCalledTimes(1);

    dispose();

    expect(worldViewDisposeMock).toHaveBeenCalledTimes(1);
  });

  it("predicts stationary aim changes during the fixed input loop", () => {
    pollInputMock.mockReturnValue({
      actions: {},
      aim: { x: 0, y: 8 },
      movement: { x: 0, y: 0 },
      sequence: 3,
      type: "input",
    });

    bootGame({
      canvas: document.createElement("canvas"),
      socketClient: { sendInput: vi.fn() },
      store: {
        getState: () => createStoreState({ connectionState: { phase: "joined" } }),
        subscribe: () => () => {},
      } as never,
    });

    scheduledInterval?.();

    expect(predictionApplyInputMock).toHaveBeenCalledWith({
      aim: { x: 0, y: 8 },
      deltaSeconds: 0.05,
      movement: { x: 0, y: 0 },
      sequence: 3,
    });
  });

  it("keeps gameplay input disabled until the player is joined", () => {
    const canvas = document.createElement("canvas");
    const store = {
      getState: (): TestStoreState => createStoreState(),
      subscribe: () => () => {},
      toggleInventory: vi.fn(),
    };

    bootGame({
      canvas,
      socketClient: { sendInput: vi.fn() },
      store: store as never,
    });

    expect(createInputControllerMock).toHaveBeenCalledTimes(1);
    const firstCall = createInputControllerMock.mock.calls[0] as [{ isEnabled: () => boolean }] | undefined;

    expect(firstCall).toBeDefined();

    if (!firstCall) {
      throw new Error("Expected createInputController to be called.");
    }

    const [{ isEnabled }] = firstCall;

    expect(isEnabled()).toBe(false);

    store.getState = (): TestStoreState =>
      createStoreState({ connectionState: { phase: "joined" }, playerEntityId: "player_survivor" });

    expect(isEnabled()).toBe(true);
  });

  it("resets held input when the connection leaves joined so reconnect cannot replay stale input", () => {
    const sendInput = vi.fn();
    const canvas = document.createElement("canvas");
    const state = createStoreState({
      connectionState: { phase: "joined" } as TestConnectionState,
      playerEntityId: "player_survivor",
    });
    let storeListener: (() => void) | undefined;
    const store = {
      getState: () => state,
      subscribe: (listener: () => void) => {
        storeListener = listener;
        return () => {};
      },
      toggleInventory: vi.fn(),
    };

    bootGame({
      canvas,
      socketClient: { sendInput },
      store: store as never,
    });

    scheduledInterval?.();

    expect(sendInput).toHaveBeenCalledTimes(1);
    expect(resetInputControllerMock).not.toHaveBeenCalled();

    state.connectionState = { phase: "failed", reason: "internal-error" };
    storeListener?.();

    expect(sendInput).toHaveBeenCalledTimes(1);
    expect(resetInputControllerMock).toHaveBeenCalledTimes(1);

    state.connectionState = { phase: "joined" };
    storeListener?.();

    scheduledInterval?.();

    expect(sendInput).toHaveBeenCalledTimes(2);
  });

  it("resets held input on a joined-to-non-joined transition even if the client rejoins before the next send tick", () => {
    const sendInput = vi.fn();
    const canvas = document.createElement("canvas");
    const state = createStoreState({
      connectionState: { phase: "joined" } as TestConnectionState,
      playerEntityId: "player_survivor",
    });
    const store = {
      getState: () => state,
      subscribe: (listener: () => void) => {
        storeListener = listener;
        return () => {};
      },
      toggleInventory: vi.fn(),
    };
    let storeListener: (() => void) | undefined;

    bootGame({
      canvas,
      socketClient: { sendInput },
      store: store as never,
    });

    scheduledInterval?.();

    expect(sendInput).toHaveBeenCalledTimes(1);
    expect(resetInputControllerMock).not.toHaveBeenCalled();

    state.connectionState = { phase: "failed", reason: "internal-error" };
    storeListener?.();
    state.connectionState = { phase: "joined" };
    storeListener?.();

    expect(resetInputControllerMock).toHaveBeenCalledTimes(1);

    scheduledInterval?.();

    expect(sendInput).toHaveBeenCalledTimes(2);
  });

  it("merges queued inventory actions into the next authoritative input packet", () => {
    const sendInput = vi.fn();
    const canvas = document.createElement("canvas");
    const consumeQueuedInventoryAction = vi
      .fn()
      .mockReturnValueOnce({ type: "equip", toSlot: 1 })
      .mockReturnValueOnce(undefined);
    const store = {
      consumeQueuedInventoryAction,
      getState: (): TestStoreState =>
        createStoreState({ connectionState: { phase: "joined" }, playerEntityId: "player_survivor" }),
      subscribe: () => () => {},
      toggleInventory: vi.fn(),
    };

    bootGame({
      canvas,
      socketClient: { sendInput },
      store: store as never,
    });

    scheduledInterval?.();

    expect(sendInput).toHaveBeenCalledWith({
      actions: {
        fire: true,
        inventory: { type: "equip", toSlot: 1 },
      },
      aim: { x: 12, y: -4 },
      movement: { x: 1, y: 0 },
      sequence: 0,
      type: "input",
    });

    scheduledInterval?.();

    expect(sendInput).toHaveBeenLastCalledWith({
      actions: { fire: true },
      aim: { x: 12, y: -4 },
      movement: { x: 1, y: 0 },
      sequence: 1,
      type: "input",
    });
  });

  it("does not perform a second render pass after the client joins", () => {
    const state = createStoreState({
      health: { current: 86, isDead: false, max: 100 },
      inventory: createInventory({
        ammoStacks: [{ ammoItemId: "ammo_9mm", quantity: 21 }],
        equippedWeaponSlot: 0,
        slots: [{ itemId: "weapon_pistol", quantity: 1 }, null, null, null, null, null],
      }),
      playerEntityId: "player_survivor",
      roomId: "room_browser-v1",
    });

    const store = {
      getState: () => state,
      subscribe: () => () => {},
      toggleInventory: vi.fn(),
    };

    bootGame({
      canvas: document.createElement("canvas"),
      socketClient: { sendInput: vi.fn() },
      store: store as never,
    });

    scheduledFrame?.(16);

    state.connectionState = { phase: "joined" };

    scheduledFrame?.(32);

    expect(rendererMock.autoClear).toBe(true);
    expect(rendererMock.render).not.toHaveBeenCalled();
    expect(rendererMock.clearDepth).not.toHaveBeenCalled();
    expect(renderFrameMock).toHaveBeenCalledTimes(2);
  });
});
