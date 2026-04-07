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
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 1,
      sprint: false,
    });
    const afterSecondInput = applyPredictedInput(afterFirstInput, {
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 2,
      sprint: false,
    });

    const reconciled = reconcilePrediction({
      authoritativeStamina: { current: 10, max: 10 },
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
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 1,
      sprint: false,
    });
    const secondFrame = prediction.applyInput({
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 2,
      sprint: false,
    });

    expect(firstFrame).toEqual({ rotation: 0, x: 1, y: 0 });
    expect(secondFrame).toEqual({ rotation: 0, x: 2, y: 0 });

    const reconciled = prediction.reconcile({
      authoritativeStamina: { current: 10, max: 10 },
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
      authoritativeStamina: { current: 10, max: 10 },
      authoritativeTransform: { rotation: 0, x: 0, y: 0 },
      entityId: "player_self",
      lastProcessedSequence: 0,
    });

    prediction.applyInput({
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 1,
      sprint: false,
    });

    const afterReconcile = prediction.reconcile({
      authoritativeStamina: { current: 10, max: 10 },
      authoritativeTransform: { rotation: 0, x: 0.4, y: 0 },
      lastProcessedSequence: 1,
    });

    expect(afterReconcile).toEqual({ rotation: 0, x: 1, y: 0 });

    const smoothed = prediction.advanceSmoothing(0.1);

    expect(smoothed.x).toBeGreaterThan(0.4);
    expect(smoothed.x).toBeLessThan(1);
    expect(prediction.getState().transform).toEqual({ rotation: 0, x: 0.4, y: 0 });
  });

  it("normalizes diagonal movement so local speed matches the server movement rules", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    const transform = prediction.applyInput({
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 1 },
      sequence: 1,
      sprint: false,
    });

    expect(transform.x).toBeCloseTo(Math.SQRT2);
    expect(transform.y).toBeCloseTo(Math.SQRT2);
  });

  it("uses aim to predict self rotation while stationary and while strafing", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    const standingAim = prediction.applyInput({
      aim: { x: 0, y: 2 },
      deltaSeconds: 0.25,
      movement: { x: 0, y: 0 },
      sequence: 1,
      sprint: false,
    });
    const strafingAim = prediction.applyInput({
      aim: { x: 0, y: 2 },
      deltaSeconds: 0.25,
      movement: { x: -1, y: 0 },
      sequence: 2,
      sprint: false,
    });

    expect(standingAim.rotation).toBeCloseTo(Math.PI / 2);
    expect(strafingAim.rotation).toBeCloseTo(Math.PI / 2);
  });

  it("predicts faster local movement while sprinting", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    prediction.syncAuthoritative({
      authoritativeStamina: { current: 10, max: 10 },
      authoritativeTransform: { rotation: 0, x: 0, y: 0 },
      entityId: "player_self",
      lastProcessedSequence: 0,
    });

    const transform = prediction.applyInput({
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 1,
      sprint: true,
    });

    expect(transform).toEqual({ rotation: 0, x: 3, y: 0 });
  });

  it("stops predicting sprint once predicted stamina is exhausted while sprint stays held", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    prediction.syncAuthoritative({
      authoritativeStamina: { current: 0.5, max: 10 },
      authoritativeTransform: { rotation: 0, x: 0, y: 0 },
      entityId: "player_self",
      lastProcessedSequence: 0,
    });

    const firstTick = prediction.applyInput({
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 1,
      sprint: true,
    });
    const secondTick = prediction.applyInput({
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 2,
      sprint: true,
    });

    expect(firstTick).toEqual({ rotation: 0, x: 3, y: 0 });
    expect(secondTick).toEqual({ rotation: 0, x: 5, y: 0 });
  });

  it("replays pending sprint inputs at sprint speed during reconciliation", () => {
    const initial = createPredictionState({ rotation: 0, x: 0, y: 0 });
    const seeded = reconcilePrediction({
      authoritativeStamina: { current: 10, max: 10 },
      authoritativeTransform: { rotation: 0, x: 0, y: 0 },
      lastProcessedSequence: 0,
      state: initial,
    });
    const afterFirstInput = applyPredictedInput(seeded, {
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 1,
      sprint: true,
    });
    const afterSecondInput = applyPredictedInput(afterFirstInput, {
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.5,
      movement: { x: 1, y: 0 },
      sequence: 2,
      sprint: true,
    });

    const reconciled = reconcilePrediction({
      authoritativeStamina: { current: 7, max: 10 },
      authoritativeTransform: { rotation: 0, x: 3, y: 0 },
      lastProcessedSequence: 1,
      state: afterSecondInput,
    });

    expect(reconciled.transform).toEqual({
      rotation: 0,
      x: 6,
      y: 0,
    });
    expect(reconciled.pendingInputs.map((input) => input.sequence)).toEqual([2]);
  });

  it("snaps immediately to the authoritative transform when identity or sequence resets", () => {
    const prediction = createPredictionController({ rotation: 0, x: 0, y: 0 });

    prediction.syncAuthoritative({
      authoritativeStamina: { current: 10, max: 10 },
      authoritativeTransform: { rotation: 0, x: 0, y: 0 },
      entityId: "player_self",
      lastProcessedSequence: 3,
    });
    prediction.applyInput({
      aim: { x: 1, y: 0 },
      deltaSeconds: 0.25,
      movement: { x: 1, y: 0 },
      sequence: 4,
      sprint: false,
    });

    const snapped = prediction.syncAuthoritative({
      authoritativeStamina: { current: 10, max: 10 },
      authoritativeTransform: { rotation: 0.3, x: 12, y: -6 },
      entityId: "player_self",
      lastProcessedSequence: 0,
    });

    expect(snapped).toEqual({ rotation: 0.3, x: 12, y: -6 });
    expect(prediction.getState()).toEqual({
      correctionOffset: { rotation: 0, x: 0, y: 0 },
      pendingInputs: [],
      stamina: { current: 10, max: 10 },
      transform: { rotation: 0.3, x: 12, y: -6 },
    });
  });
});
