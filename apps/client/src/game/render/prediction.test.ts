import { describe, expect, it } from "vitest";

import {
  applyPredictedInput,
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
});
