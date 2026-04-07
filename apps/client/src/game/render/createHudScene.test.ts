import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HudState } from "./hudState";

import { createHudScene } from "./createHudScene";

const createState = (overrides: Partial<HudState> = {}): HudState => ({
  ammoValue: "21",
  equippedWeaponDetail: "Weapon: weapon_pistol",
  healthDetail: "Stable for now",
  healthValue: "86/100",
  inventorySummary: "1/6 slots filled",
  playerLabel: "Player: player_survivor",
  roomLabel: "Room: room_browser-v1",
  ...overrides,
});

describe("createHudScene", () => {
  const clearRectMock = vi.fn();
  const fillTextMock = vi.fn();
  const measureTextMock = vi.fn(() => ({ width: 128 }));
  let getContextSpy: { mockRestore: () => void };

  const createContextMock = () => ({
    clearRect: clearRectMock,
    fillStyle: "",
    fillText: fillTextMock,
    font: "",
    measureText: measureTextMock,
    textBaseline: "top",
  }) as unknown as CanvasRenderingContext2D;

  beforeEach(() => {
    clearRectMock.mockClear();
    fillTextMock.mockClear();
    measureTextMock.mockClear();
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() => createContextMock()) as never,
    );
  });

  afterEach(() => {
    getContextSpy.mockRestore();
  });

  it("skips label redraws when the joined hud text is unchanged", () => {
    const hudScene = createHudScene();

    fillTextMock.mockClear();
    measureTextMock.mockClear();
    clearRectMock.mockClear();

    hudScene.update(createState());

    expect(fillTextMock).toHaveBeenCalledTimes(8);
    expect(measureTextMock).toHaveBeenCalledTimes(8);
    expect(clearRectMock).toHaveBeenCalledTimes(8);

    fillTextMock.mockClear();
    measureTextMock.mockClear();
    clearRectMock.mockClear();

    hudScene.update(createState());

    expect(fillTextMock).not.toHaveBeenCalled();
    expect(measureTextMock).not.toHaveBeenCalled();
    expect(clearRectMock).not.toHaveBeenCalled();

    hudScene.dispose();
  });

  it("redraws only the label whose joined hud text changed", () => {
    const hudScene = createHudScene();

    hudScene.update(createState());
    fillTextMock.mockClear();
    measureTextMock.mockClear();
    clearRectMock.mockClear();

    hudScene.update(createState({ ammoValue: "22" }));

    expect(fillTextMock).toHaveBeenCalledTimes(1);
    expect(measureTextMock).toHaveBeenCalledTimes(1);
    expect(clearRectMock).toHaveBeenCalledTimes(1);

    hudScene.dispose();
  });

  it("keeps inventory summary and metadata in separate hud modules", () => {
    const hudScene = createHudScene();

    expect(hudScene.scene.children).toHaveLength(4);

    hudScene.dispose();
  });
});
