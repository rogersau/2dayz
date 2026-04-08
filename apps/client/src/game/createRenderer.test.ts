import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

const { webGLRendererMock } = vi.hoisted(() => ({
  webGLRendererMock: vi.fn((parameters: { antialias: boolean; canvas: HTMLCanvasElement }) => ({
    domElement: parameters.canvas,
    outputColorSpace: "",
    setClearColor: vi.fn(),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    shadowMap: { enabled: false, type: null as number | null },
    toneMapping: null as number | null,
  })),
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();

  return {
    ...actual,
    WebGLRenderer: webGLRendererMock,
  };
});

import { createRenderer } from "./createRenderer";

describe("createRenderer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    webGLRendererMock.mockClear();
  });

  it("applies perspective-friendly color, tone mapping, and shadow settings", () => {
    vi.spyOn(window, "devicePixelRatio", "get").mockReturnValue(3);

    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 960 });
    Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 540 });

    const { renderer } = createRenderer(canvas);

    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe(THREE.PCFSoftShadowMap);
  });
});
