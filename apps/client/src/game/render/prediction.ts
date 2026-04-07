import { SPRINT_SPEED_MULTIPLIER, type Stamina, type Transform, type Vector2 } from "@2dayz/shared";

const DEFAULT_MOVE_SPEED = 4;

export type PredictedInput = {
  aim: Vector2;
  deltaSeconds: number;
  movement: Vector2;
  sequence: number;
  sprint: boolean;
};

export type PredictionState = {
  correctionOffset: Transform;
  pendingInputs: PredictedInput[];
  stamina: Stamina | null;
  transform: Transform;
};

const CORRECTION_SMOOTHING = 10;
const SNAP_DISTANCE = 3;
const createZeroTransform = (): Transform => ({ rotation: 0, x: 0, y: 0 });

const normalizeState = (state: PredictionState): PredictionState => {
  return {
    correctionOffset: state.correctionOffset ?? createZeroTransform(),
    pendingInputs: state.pendingInputs,
    stamina: state.stamina ?? null,
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

const normalizeMovement = (movement: Vector2): Vector2 => {
  const magnitude = Math.hypot(movement.x, movement.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: movement.x / magnitude,
    y: movement.y / magnitude,
  };
};

const applyMovement = ({
  input,
  moveSpeed,
  stamina,
  transform,
}: {
  input: PredictedInput;
  moveSpeed: number;
  stamina: Stamina | null;
  transform: Transform;
}): { stamina: Stamina | null; transform: Transform } => {
  const direction = normalizeMovement(input.movement);
  const aimMagnitude = Math.hypot(input.aim.x, input.aim.y);
  const moving = direction.x !== 0 || direction.y !== 0;
  const canSprint = input.sprint && moving && (stamina?.current ?? 0) > 0;
  const appliedMoveSpeed = canSprint ? moveSpeed * SPRINT_SPEED_MULTIPLIER : moveSpeed;

  return {
    stamina:
      stamina === null
        ? null
        : {
            current: canSprint ? Math.max(0, stamina.current - input.deltaSeconds) : stamina.current,
            max: stamina.max,
          },
    transform: {
      rotation: aimMagnitude > 0 ? Math.atan2(input.aim.y, input.aim.x) : transform.rotation,
      x: transform.x + direction.x * appliedMoveSpeed * input.deltaSeconds,
      y: transform.y + direction.y * appliedMoveSpeed * input.deltaSeconds,
    },
  };
};

export const createPredictionState = (transform: Transform): PredictionState => {
  return {
    correctionOffset: createZeroTransform(),
    pendingInputs: [],
    stamina: null,
    transform,
  };
};

export const applyPredictedInput = (
  state: PredictionState,
  input: PredictedInput,
  moveSpeed = DEFAULT_MOVE_SPEED,
): PredictionState => {
  const normalizedState = normalizeState(state);
  const next = applyMovement({
    input,
    moveSpeed,
    stamina: normalizedState.stamina,
    transform: normalizedState.transform,
  });

  return {
    correctionOffset: normalizedState.correctionOffset,
    pendingInputs: [...normalizedState.pendingInputs, input],
    stamina: next.stamina,
    transform: next.transform,
  };
};

export const reconcilePrediction = ({
  authoritativeTransform,
  authoritativeStamina,
  lastProcessedSequence,
  moveSpeed = DEFAULT_MOVE_SPEED,
  state,
}: {
  authoritativeStamina: Stamina;
  authoritativeTransform: Transform;
  lastProcessedSequence: number;
  moveSpeed?: number;
  state: PredictionState;
}): PredictionState => {
  const normalizedState = normalizeState(state);
  const pendingInputs = normalizedState.pendingInputs.filter((input) => input.sequence > lastProcessedSequence);
  const replayed = pendingInputs.reduce(
    (current, input) => {
      return applyMovement({
        input,
        moveSpeed,
        stamina: current.stamina,
        transform: current.transform,
      });
    },
    {
      stamina: authoritativeStamina,
      transform: authoritativeTransform,
    },
  );
  const displayedTransform = addTransforms(normalizedState.transform, normalizedState.correctionOffset);

  return {
    correctionOffset: subtractTransforms(displayedTransform, replayed.transform),
    pendingInputs,
    stamina: replayed.stamina,
    transform: replayed.transform,
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
      authoritativeStamina,
      authoritativeTransform,
      lastProcessedSequence,
      moveSpeed = DEFAULT_MOVE_SPEED,
    }: {
      authoritativeStamina: Stamina;
      authoritativeTransform: Transform;
      lastProcessedSequence: number;
      moveSpeed?: number;
    }) {
      state = reconcilePrediction({
        authoritativeStamina,
        authoritativeTransform,
        lastProcessedSequence,
        moveSpeed,
        state,
      });
      return addTransforms(state.transform, state.correctionOffset);
    },
    syncAuthoritative({
      authoritativeStamina,
      authoritativeTransform,
      entityId,
      lastProcessedSequence: nextProcessedSequence,
      snapDistance = SNAP_DISTANCE,
    }: {
      authoritativeStamina: Stamina;
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
        state = {
          ...createPredictionState(authoritativeTransform),
          stamina: authoritativeStamina,
        };
        return authoritativeTransform;
      }

      state = reconcilePrediction({
        authoritativeStamina,
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
