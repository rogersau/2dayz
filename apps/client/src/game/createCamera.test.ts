import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createCamera } from "./createCamera";

describe("createCamera", () => {
  it("creates a perspective chase camera and keeps its aspect ratio in sync on resize", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 1280 });
    Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 720 });

    const { camera } = createCamera(canvas);

    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect((camera as THREE.PerspectiveCamera).fov).toBe(60);
    expect((camera as THREE.PerspectiveCamera).aspect).toBeCloseTo(1280 / 720);
    expect(camera.position.y).toBeGreaterThan(1);
  });

  it("updates the perspective projection when the canvas size changes", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 1280, writable: true });
    Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 720, writable: true });

    const { camera, resize } = createCamera(canvas);

    Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 900, writable: true });
    Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 900, writable: true });

    resize();

    expect((camera as THREE.PerspectiveCamera).aspect).toBe(1);
  });
});
