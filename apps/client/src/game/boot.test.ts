import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createPredictionControllerMock,
  clearIntervalMock,
  destroyInputControllerMock,
  entityViewDisposeMock,
  predictionApplyInputMock,
  predictionAdvanceSmoothingMock,
  predictionSyncAuthoritativeMock,
  pollInputMock,
  renderFrameMock,
  renderMock,
  rendererDisposeMock,
  resizeCameraMock,
  resizeRendererMock,
  sceneDisposeMock,
  setIntervalMock,
} = vi.hoisted(() => ({
  createPredictionControllerMock: vi.fn(),
  clearIntervalMock: vi.fn(),
  destroyInputControllerMock: vi.fn(),
  entityViewDisposeMock: vi.fn(),
  predictionApplyInputMock: vi.fn(),
  predictionAdvanceSmoothingMock: vi.fn(),
  predictionSyncAuthoritativeMock: vi.fn(),
  pollInputMock: vi.fn(),
  renderFrameMock: vi.fn(),
  renderMock: vi.fn(),
  rendererDisposeMock: vi.fn(),
  resizeCameraMock: vi.fn(),
  resizeRendererMock: vi.fn(),
  sceneDisposeMock: vi.fn(),
  setIntervalMock: vi.fn(),
}));

import { bootGame } from "./boot";

vi.mock("./createRenderer", () => ({
  createRenderer: () => ({
    renderer: { dispose: rendererDisposeMock, render: renderMock },
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
  createInputController: () => ({
    destroy: destroyInputControllerMock,
    pollInput: pollInputMock,
  }),
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
    scheduledInterval = null;
    scheduledFrame = null;
    pollInputMock.mockReturnValue({
      actions: { fire: true },
      aim: { x: 12, y: -4 },
      movement: { x: 1, y: 0 },
      sequence: 0,
      type: "input",
    });
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

  it("sends typed input on a fixed interval instead of every render frame", () => {
    const sendInput = vi.fn();
    const canvas = document.createElement("canvas");

    bootGame({
      canvas,
      socketClient: { sendInput },
      store: { getState: () => ({ latestTick: 0, playerEntityId: null, worldEntities: { loot: [], players: [], zombies: [] } }) } as never,
    });

    scheduledFrame?.(16);

    expect(sendInput).not.toHaveBeenCalled();
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
      store: { getState: () => ({ latestTick: 0, playerEntityId: null, worldEntities: { loot: [], players: [], zombies: [] } }) } as never,
    });

    dispose();

    expect(clearIntervalMock).toHaveBeenCalledWith(11);
    expect(sceneDisposeMock).toHaveBeenCalledTimes(1);
    expect(entityViewDisposeMock).toHaveBeenCalledTimes(1);
    expect(rendererDisposeMock).toHaveBeenCalledTimes(1);
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
      store: { getState: () => ({ latestTick: 0, playerEntityId: null, worldEntities: { loot: [], players: [], zombies: [] } }) } as never,
    });

    scheduledInterval?.();

    expect(predictionApplyInputMock).toHaveBeenCalledWith({
      aim: { x: 0, y: 8 },
      deltaSeconds: 0.05,
      movement: { x: 0, y: 0 },
      sequence: 3,
    });
  });
});
