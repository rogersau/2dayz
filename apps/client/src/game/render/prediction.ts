import type { Transform, Vector2 } from "@2dayz/shared";

const DEFAULT_MOVE_SPEED = 4;

export type PredictedInput = {
  deltaSeconds: number;
  movement: Vector2;
  sequence: number;
};

export type PredictionState = {
  pendingInputs: PredictedInput[];
  transform: Transform;
};

const applyMovement = (transform: Transform, input: PredictedInput, moveSpeed: number): Transform => {
  return {
    rotation: input.movement.x === 0 && input.movement.y === 0 ? transform.rotation : Math.atan2(input.movement.y, input.movement.x),
    x: transform.x + input.movement.x * moveSpeed * input.deltaSeconds,
    y: transform.y + input.movement.y * moveSpeed * input.deltaSeconds,
  };
};

export const createPredictionState = (transform: Transform): PredictionState => {
  return {
    pendingInputs: [],
    transform,
  };
};

export const applyPredictedInput = (
  state: PredictionState,
  input: PredictedInput,
  moveSpeed = DEFAULT_MOVE_SPEED,
): PredictionState => {
  return {
    pendingInputs: [...state.pendingInputs, input],
    transform: applyMovement(state.transform, input, moveSpeed),
  };
};

export const reconcilePrediction = ({
  authoritativeTransform,
  lastProcessedSequence,
  moveSpeed = DEFAULT_MOVE_SPEED,
  state,
}: {
  authoritativeTransform: Transform;
  lastProcessedSequence: number;
  moveSpeed?: number;
  state: PredictionState;
}): PredictionState => {
  const pendingInputs = state.pendingInputs.filter((input) => input.sequence > lastProcessedSequence);
  const transform = pendingInputs.reduce((current, input) => {
    return applyMovement(current, input, moveSpeed);
  }, authoritativeTransform);

  return {
    pendingInputs,
    transform,
  };
};
