import { defaultTownMap } from "@2dayz/shared";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createWorldView } from "./createWorldView";

describe("createWorldView", () => {
  it("builds static ground and building groups from collision volumes", () => {
    const scene = new THREE.Scene();
    const worldView = createWorldView({ map: defaultTownMap, scene });

    expect(scene.getObjectByName("world:static")).toBeInstanceOf(THREE.Group);
    expect(scene.getObjectByName("building:volume_market")).toBeTruthy();
    expect(scene.getObjectByName("building:volume_police-station")).toBeTruthy();
    expect(scene.getObjectByName("building:volume_barn")).toBeTruthy();

    worldView.dispose();

    expect(scene.getObjectByName("world:static")).toBeUndefined();
  });
});
