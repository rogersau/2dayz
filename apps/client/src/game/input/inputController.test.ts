import { beforeEach, describe, expect, it } from "vitest";

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
});
