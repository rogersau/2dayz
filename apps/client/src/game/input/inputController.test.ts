import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInputController } from "./inputController";

describe("inputController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("collects WASD movement, mouse aim, fire, reload, and interact input", () => {
    const element = document.createElement("div");
    document.body.append(element);
    element.getBoundingClientRect = () => ({
      bottom: 220,
      height: 120,
      left: 10,
      right: 210,
      top: 100,
      width: 200,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    });

    const controller = createInputController({ element });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
    element.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 170, clientY: 160 }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 170, clientY: 160 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));

    expect(controller.pollInput(4)).toEqual({
      actions: {
        fire: true,
        interact: true,
        reload: true,
      },
      aim: {
        x: 60,
        y: 0,
      },
      movement: {
        x: 1,
        y: -1,
      },
      sequence: 4,
      type: "input",
    });

    expect(controller.pollInput(5)).toEqual({
      actions: {
        fire: true,
      },
      aim: {
        x: 60,
        y: 0,
      },
      movement: {
        x: 1,
        y: -1,
      },
      sequence: 5,
      type: "input",
    });

    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 170, clientY: 160 }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "w" }));
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "d" }));

    expect(controller.pollInput(6)).toEqual({
      actions: {},
      aim: {
        x: 60,
        y: 0,
      },
      movement: {
        x: 0,
        y: 0,
      },
      sequence: 6,
      type: "input",
    });

    controller.destroy();
  });

  it("toggles inventory when tab is pressed without emitting a gameplay input action", () => {
    const element = document.createElement("div");
    document.body.append(element);
    const onToggleInventory = vi.fn();
    const controller = createInputController({ element, onToggleInventory });

    const keydownEvent = new KeyboardEvent("keydown", { cancelable: true, key: "Tab" });
    window.dispatchEvent(keydownEvent);

    expect(onToggleInventory).toHaveBeenCalledTimes(1);
    expect(keydownEvent.defaultPrevented).toBe(true);
    expect(controller.pollInput(1)).toEqual({
      actions: {},
      aim: { x: 0, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    controller.destroy();
  });

  it("clears held and queued input state on blur and visibility changes", () => {
    const element = document.createElement("div");
    document.body.append(element);
    element.getBoundingClientRect = () => ({
      bottom: 220,
      height: 120,
      left: 10,
      right: 210,
      top: 100,
      width: 200,
      x: 10,
      y: 100,
      toJSON: () => ({}),
    });

    const controller = createInputController({ element });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 170, clientY: 160 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));

    window.dispatchEvent(new Event("blur"));

    expect(controller.pollInput(1)).toEqual({
      actions: {},
      aim: { x: 60, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 1,
      type: "input",
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d" }));
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 170, clientY: 160 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(controller.pollInput(2)).toEqual({
      actions: {},
      aim: { x: 60, y: 0 },
      movement: { x: 0, y: 0 },
      sequence: 2,
      type: "input",
    });

    controller.destroy();
  });
});
