import type { Transform, Vector2 } from "@2dayz/shared";

const DEFAULT_MOVE_SPEED = 4;

export type PredictedInput = {
  deltaSeconds: number;
  movement: Vector2;
  sequence: number;
};

export type PredictionState = {
  correctionOffset: Transform;
  pendingInputs: PredictedInput[];
  transform: Transform;
};

const CORRECTION_SMOOTHING = 10;
const SNAP_DISTANCE = 3;
const createZeroTransform = (): Transform => ({ rotation: 0, x: 0, y: 0 });

const normalizeState = (state: PredictionState): PredictionState => {
  return {
    correctionOffset: state.correctionOffset ?? createZeroTransform(),
    pendingInputs: state.pendingInputs,
    transform: state.transform,
  };
};

const addTransforms = (base: Transform, offset: Transform): Transform => {
  return {
    rotation: base.rotation + offset.rotation,
    x: base.x + offset.x,
    y: base.y + offset.y,
  };
};

const subtractTransforms = (left: Transform, right: Transform): Transform => {
  return {
    rotation: left.rotation - right.rotation,
    x: left.x - right.x,
    y: left.y - right.y,
  };
};

const getDistance = (left: Transform, right: Transform) => {
  return Math.hypot(left.x - right.x, left.y - right.y);
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
    correctionOffset: createZeroTransform(),
    pendingInputs: [],
    transform,
  };
};

export const applyPredictedInput = (
  state: PredictionState,
  input: PredictedInput,
  moveSpeed = DEFAULT_MOVE_SPEED,
): PredictionState => {
  const normalizedState = normalizeState(state);

  return {
    correctionOffset: normalizedState.correctionOffset,
    pendingInputs: [...normalizedState.pendingInputs, input],
    transform: applyMovement(normalizedState.transform, input, moveSpeed),
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
  const normalizedState = normalizeState(state);
  const pendingInputs = normalizedState.pendingInputs.filter((input) => input.sequence > lastProcessedSequence);
  const transform = pendingInputs.reduce((current, input) => {
    return applyMovement(current, input, moveSpeed);
  }, authoritativeTransform);
  const displayedTransform = addTransforms(normalizedState.transform, normalizedState.correctionOffset);

  return {
    correctionOffset: subtractTransforms(displayedTransform, transform),
    pendingInputs,
    transform,
  };
};

export const createPredictionController = (initialTransform: Transform) => {
  let state = createPredictionState(initialTransform);
  let trackedEntityId: string | null = null;
  let lastProcessedSequence = -1;

  return {
    applyInput(input: PredictedInput, moveSpeed = DEFAULT_MOVE_SPEED) {
      state = applyPredictedInput(state, input, moveSpeed);
      return addTransforms(state.transform, state.correctionOffset);
    },
    getState() {
      return state;
    },
    reconcile({
      authoritativeTransform,
      lastProcessedSequence,
      moveSpeed = DEFAULT_MOVE_SPEED,
    }: {
      authoritativeTransform: Transform;
      lastProcessedSequence: number;
      moveSpeed?: number;
    }) {
      state = reconcilePrediction({
        authoritativeTransform,
        lastProcessedSequence,
        moveSpeed,
        state,
      });
      return addTransforms(state.transform, state.correctionOffset);
    },
    syncAuthoritative({
      authoritativeTransform,
      entityId,
      lastProcessedSequence: nextProcessedSequence,
      snapDistance = SNAP_DISTANCE,
    }: {
      authoritativeTransform: Transform;
      entityId: string;
      lastProcessedSequence: number;
      snapDistance?: number;
    }) {
      const displayedTransform = addTransforms(state.transform, state.correctionOffset);
      const shouldSnap =
        trackedEntityId !== entityId ||
        nextProcessedSequence < lastProcessedSequence ||
        getDistance(displayedTransform, authoritativeTransform) >= snapDistance;

      trackedEntityId = entityId;
      lastProcessedSequence = nextProcessedSequence;

      if (shouldSnap) {
        state = createPredictionState(authoritativeTransform);
        return authoritativeTransform;
      }

      state = reconcilePrediction({
        authoritativeTransform,
        lastProcessedSequence: nextProcessedSequence,
        moveSpeed: DEFAULT_MOVE_SPEED,
        state,
      });
      return addTransforms(state.transform, state.correctionOffset);
    },
    reset(transform: Transform) {
      state = createPredictionState(transform);
      trackedEntityId = null;
      lastProcessedSequence = -1;
    },
    advanceSmoothing(deltaSeconds: number) {
      const smoothingAlpha = 1 - Math.exp(-deltaSeconds * CORRECTION_SMOOTHING);
      state = {
        ...state,
        correctionOffset: {
          rotation: state.correctionOffset.rotation * (1 - smoothingAlpha),
          x: state.correctionOffset.x * (1 - smoothingAlpha),
          y: state.correctionOffset.y * (1 - smoothingAlpha),
        },
      };
      return addTransforms(state.transform, state.correctionOffset);
    },
  };
};

export type PredictionController = ReturnType<typeof createPredictionController>;
