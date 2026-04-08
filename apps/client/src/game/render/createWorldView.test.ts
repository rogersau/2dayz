import { defaultTownMap, thirdPersonSliceMap } from "@2dayz/shared";
import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createWorldView } from "./createWorldView";

describe("createWorldView", () => {
  it("builds static ground and building groups from collision volumes", () => {
    const scene = new THREE.Scene();
    const worldView = createWorldView({ map: defaultTownMap, scene });
    const ground = scene.getObjectByName("ground:map-bounds");

    expect(scene.getObjectByName("world:static")).toBeInstanceOf(THREE.Group);
    expect(ground).toBeInstanceOf(THREE.Mesh);
    expect((ground as THREE.Mesh).position.x).toBe(defaultTownMap.bounds.width / 2);
    expect((ground as THREE.Mesh).position).toMatchObject({
      x: defaultTownMap.bounds.width / 2,
      y: -0.25,
      z: defaultTownMap.bounds.height / 2,
    });
    expect(((ground as THREE.Mesh).geometry as THREE.BoxGeometry).parameters).toMatchObject({
      width: defaultTownMap.bounds.width,
      height: 0.5,
      depth: defaultTownMap.bounds.height,
    });
    expect(scene.getObjectByName("building:volume_market")).toBeTruthy();
    expect(scene.getObjectByName("building:volume_police-station")).toBeTruthy();
    expect(scene.getObjectByName("building:volume_barn")).toBeTruthy();

    worldView.dispose();

    expect(scene.getObjectByName("world:static")).toBeUndefined();
  });

  it("builds third-person encounter landmarks and clears them on dispose", () => {
    const scene = new THREE.Scene();
    const worldView = createWorldView({ map: thirdPersonSliceMap, scene });

    const centralTruck = scene.getObjectByName("building:volume_central-truck");
    const eastShed = scene.getObjectByName("building:volume_east-shed");

    expect(centralTruck).toBeInstanceOf(THREE.Group);
    expect(eastShed).toBeInstanceOf(THREE.Group);
    expect(centralTruck?.getObjectByName("cover:volume_central-truck")).toBeInstanceOf(THREE.Mesh);
    expect(eastShed?.getObjectByName("building-body:volume_east-shed")).toBeInstanceOf(THREE.Mesh);

    worldView.dispose();

    expect(scene.getObjectByName("building:volume_central-truck")).toBeUndefined();
    expect(scene.getObjectByName("building:volume_east-shed")).toBeUndefined();
  });
});
