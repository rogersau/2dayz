import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createScene } from "./createScene";

describe("createScene", () => {
  it("uses fog and lighting suited to third-person readability", () => {
    const { dispose, scene } = createScene();

    expect(scene.fog).toBeInstanceOf(THREE.Fog);
    expect((scene.fog as THREE.Fog).near).toBeLessThan(24);
    expect((scene.fog as THREE.Fog).far).toBeGreaterThan(60);

    const hemisphereLight = scene.children.find((child) => child instanceof THREE.HemisphereLight);
    const directionalLight = scene.children.find((child) => child instanceof THREE.DirectionalLight);

    expect(hemisphereLight).toBeInstanceOf(THREE.HemisphereLight);
    expect(directionalLight).toBeInstanceOf(THREE.DirectionalLight);
    expect((directionalLight as THREE.DirectionalLight).castShadow).toBe(true);

    dispose();

    expect(scene.children.find((child) => child instanceof THREE.HemisphereLight)).toBeUndefined();
    expect(scene.children.find((child) => child instanceof THREE.DirectionalLight)).toBeUndefined();
  });
});
