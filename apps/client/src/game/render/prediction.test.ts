import { describe, expect, it } from "vitest";

import {
  applyPredictedInput,
  createPredictionController,
  createPredictionState,
  reconcilePrediction,
} from "./prediction";

describe("prediction", () => {
  it("reconciles to authoritative movement without dropping the latest local input", () => {
    const initial = createPredictionState({ rotation: 0, x: 0, y: 0 });
    const afterFirstInput = applyPredictedInput(initial, {
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 1,
    });
    const afterSecondInput = applyPredictedInput(afterFirstInput, {
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 2,
    });

    const reconciled = reconcilePrediction({
      authoritativeTransform: { rotation: 0, x: 1.6, y: 0 },
      lastProcessedSequence: 1,
      state: afterSecondInput,
    });

    expect(reconciled.transform).toEqual({
      rotation: 0,
      x: 3.6,
      y: 0,
    });
    expect(reconciled.pendingInputs.map((input) => input.sequence)).toEqual([2]);
  });

  it("persists pending inputs across frames and reconciles them against the latest authoritative ack", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    const firstFrame = prediction.applyInput({
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 1,
    });
    const secondFrame = prediction.applyInput({
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 2,
    });

    expect(firstFrame).toEqual({ rotation: 0, x: 1, y: 0 });
    expect(secondFrame).toEqual({ rotation: 0, x: 2, y: 0 });

    const reconciled = prediction.reconcile({
      authoritativeTransform: { rotation: 0, x: 0.8, y: 0 },
      lastProcessedSequence: 1,
    });

    expect(reconciled).toEqual({ rotation: 0, x: 2, y: 0 });
    expect(prediction.getState().pendingInputs.map((input) => input.sequence)).toEqual([2]);
    expect(prediction.getState().transform).toEqual({ rotation: 0, x: 1.8, y: 0 });
  });

  it("smooths a reconciliation correction over later frames instead of snapping immediately", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    prediction.syncAuthoritative({
      authoritativeTransform: { rotation: 0, x: 0, y: 0 },
      entityId: "player_self",
      lastProcessedSequence: 0,
    });

    prediction.applyInput({
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 1,
    });

    const afterReconcile = prediction.reconcile({
      authoritativeTransform: { rotation: 0, x: 0.4, y: 0 },
      lastProcessedSequence: 1,
    });

    expect(afterReconcile).toEqual({ rotation: 0, x: 1, y: 0 });

    const smoothed = prediction.advanceSmoothing(0.1);

    expect(smoothed.x).toBeGreaterThan(0.4);
    expect(smoothed.x).toBeLessThan(1);
    expect(prediction.getState().transform).toEqual({ rotation: 0, x: 0.4, y: 0 });
  });

  it("snaps immediately to the authoritative transform when identity or sequence resets", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    prediction.syncAuthoritative({
      authoritativeTransform: { rotation: 0, x: 0, y: 0 },
      entityId: "player_self",
      lastProcessedSequence: 3,
    });
    prediction.applyInput({
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 4,
    });

    const snapped = prediction.syncAuthoritative({
      authoritativeTransform: { rotation: 0.3, x: 12, y: -6 },
      entityId: "player_self",
      lastProcessedSequence: 0,
    });

    expect(snapped).toEqual({ rotation: 0.3, x: 12, y: -6 });
    expect(prediction.getState()).toEqual({
      correctionOffset: { rotation: 0, x: 0, y: 0 },
      pendingInputs: [],
      transform: { rotation: 0.3, x: 12, y: -6 },
    });
  });
});
