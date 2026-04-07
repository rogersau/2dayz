import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createCamera } from "./createCamera";

describe("createCamera", () => {
  it("keeps the wider orthographic framing while matching the runtime follow offsets", () => {
    const canvas = document.createElement("canvas");
    const { camera } = createCamera(canvas);

    expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
    expect(camera.position).toMatchObject({ x: 18, y: 28, z: 18 });
    expect((camera as THREE.OrthographicCamera).top).toBe(22);
    expect((camera as THREE.OrthographicCamera).bottom).toBe(-22);
  });
});
