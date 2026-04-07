import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { createCombatEffectsView } from "./combatEffectsView";

describe("createCombatEffectsView", () => {
  it("spawns and expires local shots and authoritative hit effects", () => {
    const scene = new THREE.Scene();
    const effects = createCombatEffectsView(scene);
    const entityViewStore = { flashEntity: vi.fn() };
    const effectNames = () => scene.getObjectByName("effects:combat")?.children.map((child) => child.name) ?? [];

    effects.queueLocalShot({ aim: { x: 12, y: 0 } });
    effects.update({
      deltaSeconds: 0,
      entityViewStore: entityViewStore as never,
      localPlayerTransform: { rotation: 0, x: 12, y: 20 },
      renderEvents: [],
    });

    expect(effectNames()).toEqual(expect.arrayContaining(["effect:muzzle-flash", "effect:tracer"]));
    expect(effectNames()).not.toContain("effect:impact-flash");

    effects.update({
      deltaSeconds: 1 / 20,
      entityViewStore: entityViewStore as never,
      localPlayerTransform: null,
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
    });

    expect(entityViewStore.flashEntity).toHaveBeenCalledWith("zombie_1");
    expect(scene.children.some((child) => child.name === "effects:combat")).toBe(true);
    expect(effectNames()).toEqual(
      expect.arrayContaining(["effect:muzzle-flash", "effect:tracer", "effect:impact-flash"]),
    );

    effects.update({
      deltaSeconds: 1,
      entityViewStore: entityViewStore as never,
      localPlayerTransform: null,
      renderEvents: [],
    });

    expect(scene.getObjectByName("effects:combat")?.children.some((child) => child.name.startsWith("effect:"))).toBe(false);
  });

  it("retains queued local shots until a local player transform is available", () => {
    const scene = new THREE.Scene();
    const effects = createCombatEffectsView(scene);
    const entityViewStore = { flashEntity: vi.fn() };
    const effectNames = () => scene.getObjectByName("effects:combat")?.children.map((child) => child.name) ?? [];

    effects.queueLocalShot({ aim: { x: 12, y: 0 } });
    effects.update({
      deltaSeconds: 1 / 20,
      entityViewStore: entityViewStore as never,
      localPlayerTransform: null,
      renderEvents: [],
    });

    expect(effectNames()).toEqual([]);

    effects.update({
      deltaSeconds: 0,
      entityViewStore: entityViewStore as never,
      localPlayerTransform: { rotation: 0, x: 12, y: 20 },
      renderEvents: [],
    });

    expect(effectNames()).toEqual(expect.arrayContaining(["effect:muzzle-flash", "effect:tracer"]));
  });
});
