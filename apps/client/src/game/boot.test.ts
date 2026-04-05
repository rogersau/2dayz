import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  destroyInputControllerMock,
  entityViewDisposeMock,
  pollInputMock,
  renderFrameMock,
  renderMock,
  rendererDisposeMock,
  resizeCameraMock,
  resizeRendererMock,
} = vi.hoisted(() => ({
  destroyInputControllerMock: vi.fn(),
  entityViewDisposeMock: vi.fn(),
  pollInputMock: vi.fn(),
  renderFrameMock: vi.fn(),
  renderMock: vi.fn(),
  rendererDisposeMock: vi.fn(),
  resizeCameraMock: vi.fn(),
  resizeRendererMock: vi.fn(),
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
  createScene: () => ({ kind: "scene" }),
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

vi.mock("./render/renderFrame", () => ({
  renderFrame: renderFrameMock,
}));

describe("bootGame", () => {
  let requestAnimationFrameSpy: { mockRestore: () => void };
  let cancelAnimationFrameSpy: { mockRestore: () => void };
  let scheduledFrame: FrameRequestCallback | null;

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("polls typed input each frame and sends it through the socket client", () => {
    const sendInput = vi.fn();
    const canvas = document.createElement("canvas");

    bootGame({
      canvas,
      socketClient: { sendInput },
      store: { getState: () => ({ latestTick: 0, playerEntityId: null, worldEntities: { loot: [], players: [], zombies: [] } }) } as never,
    });

    scheduledFrame?.(16);

    expect(sendInput).toHaveBeenCalledWith({
      actions: { fire: true },
      aim: { x: 12, y: -4 },
      movement: { x: 1, y: 0 },
      sequence: 0,
      type: "input",
    });
    expect(renderFrameMock).toHaveBeenCalled();
  });
});
