import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { createCombatEffectsView } from "./combatEffectsView";

describe("createCombatEffectsView", () => {
  it("spawns and expires authoritative shot and hit effects", () => {
    const scene = new THREE.Scene();
    const effects = createCombatEffectsView(scene);
    const entityViewStore = { flashEntity: vi.fn() };
    const effectNames = () => scene.getObjectByName("effects:combat")?.children.map((child) => child.name) ?? [];

    effects.update({
      deltaSeconds: 0,
      entityViewStore: entityViewStore as never,
      renderEvents: [
        {
          attackerEntityId: "player_self",
          aim: { x: 12, y: 0 },
          origin: { x: 12, y: 20 },
          roomId: "room_browser-v1",
          type: "shot",
          weaponItemId: "weapon_pistol",
        },
      ],
      shooterTransforms: new Map(),
    });

    expect(effectNames()).toEqual(expect.arrayContaining(["effect:muzzle-flash", "effect:tracer"]));
    expect(effectNames()).not.toContain("effect:impact-flash");

    effects.update({
      deltaSeconds: 1 / 20,
      entityViewStore: entityViewStore as never,
      renderEvents: [
        {
          attackerEntityId: "player_self",
          damage: 12,
          hitPosition: { x: 18, y: 20 },
          remainingHealth: 28,
          roomId: "room_browser-v1",
          targetEntityId: "zombie_1",
          type: "combat",
          weaponItemId: "weapon_pistol",
        },
      ],
      shooterTransforms: new Map(),
    });

    expect(entityViewStore.flashEntity).toHaveBeenCalledWith("zombie_1");
    expect(scene.children.some((child) => child.name === "effects:combat")).toBe(true);
    expect(effectNames()).toEqual(
      expect.arrayContaining(["effect:muzzle-flash", "effect:tracer", "effect:impact-flash"]),
    );

    effects.update({
      deltaSeconds: 1,
      entityViewStore: entityViewStore as never,
      renderEvents: [],
      shooterTransforms: new Map(),
    });

    expect(scene.getObjectByName("effects:combat")?.children.some((child) => child.name.startsWith("effect:"))).toBe(false);
  });

  it("spawns shot effects from replicated shooter transforms", () => {
    const scene = new THREE.Scene();
    const effects = createCombatEffectsView(scene);
    const entityViewStore = { flashEntity: vi.fn() };
    const effectNames = () => scene.getObjectByName("effects:combat")?.children.map((child) => child.name) ?? [];

    effects.update({
      deltaSeconds: 0,
      entityViewStore: entityViewStore as never,
      renderEvents: [
        {
          attackerEntityId: "player_other",
          aim: { x: 0, y: 12 },
          origin: { x: 4, y: 8 },
          roomId: "room_browser-v1",
          type: "shot",
          weaponItemId: "weapon_pistol",
        },
      ],
      shooterTransforms: new Map([["player_other", { rotation: Math.PI / 2, x: 4, y: 8 }]]),
    });

    expect(effectNames()).toEqual(expect.arrayContaining(["effect:muzzle-flash", "effect:tracer"]));
  });

  it("renders authoritative shot effects from event origin instead of current shooter transform", () => {
    const scene = new THREE.Scene();
    const effects = createCombatEffectsView(scene);

    effects.update({
      deltaSeconds: 0,
      entityViewStore: { flashEntity: vi.fn() } as never,
      renderEvents: [
        {
          attackerEntityId: "player_other",
          aim: { x: 5, y: 0 },
          origin: { x: 2, y: 3 },
          roomId: "room_browser-v1",
          type: "shot",
          weaponItemId: "weapon_pistol",
        },
      ],
      shooterTransforms: new Map([["player_other", { rotation: 0, x: 50, y: 60 }]]),
    });

    const muzzleFlash = scene.getObjectByName("effect:muzzle-flash");

    expect(muzzleFlash?.position.x).toBeCloseTo(2.8);
    expect(muzzleFlash?.position.z).toBeCloseTo(3);
  });
});
