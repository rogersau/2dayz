import type { ClientGameStore } from "./state/clientGameStore";
import { SERVER_TICK_RATE } from "@2dayz/shared";

import { createCamera } from "./createCamera";
import { createRenderer } from "./createRenderer";
import { createScene } from "./createScene";
import { createInputController } from "./input/inputController";
import { createHudScene } from "./render/createHudScene";
import { deriveHudState } from "./render/hudState";
import { createEntityViewStore } from "./render/entityViewStore";
import { createPredictionController } from "./render/prediction";
import { renderFrame } from "./render/renderFrame";
import type { SocketClient } from "./net/socketClient";

export const bootGame = ({
  canvas,
  socketClient,
  store,
}: {
  canvas: HTMLCanvasElement;
  socketClient: Pick<SocketClient, "sendInput">;
  store: ClientGameStore;
}) => {
  const { renderer, resize: resizeRenderer } = createRenderer(canvas);
  const { camera, resize: resizeCamera } = createCamera(canvas);
  const { dispose: disposeScene, scene } = createScene();
  const {
    camera: hudCamera,
    dispose: disposeHudScene,
    resize: resizeHudScene,
    scene: hudScene,
    update: updateHudScene,
  } = createHudScene();
  const inputController = createInputController({
    element: canvas,
    isEnabled: () => store.getState().connectionState.phase === "joined",
    onToggleInventory: () => store.toggleInventory(),
  });
  const entityViewStore = createEntityViewStore(scene);
  const predictionController = createPredictionController({ rotation: 0, x: 0, y: 0 });
  let animationFrame = 0;
  let isDisposed = false;
  let inputLoop = 0;
  let wasJoined = store.getState().connectionState.phase === "joined";
  let sequence = 0;
  let previousFrameTime = performance.now();
  const inputDeltaSeconds = 1 / SERVER_TICK_RATE;

  const unsubscribeFromStore = store.subscribe(() => {
    const isJoined = store.getState().connectionState.phase === "joined";

    if (wasJoined && !isJoined) {
      inputController.reset();
    }

    wasJoined = isJoined;
  });

  const sendInput = () => {
    if (isDisposed) {
      return;
    }

    const isJoined = store.getState().connectionState.phase === "joined";

    if (!isJoined) {
      return;
    }

    const input = inputController.pollInput(sequence++);
    socketClient.sendInput(input);

    if (
      input.movement.x !== 0 ||
      input.movement.y !== 0 ||
      input.aim.x !== 0 ||
      input.aim.y !== 0
    ) {
      predictionController.applyInput({
        aim: input.aim,
        deltaSeconds: inputDeltaSeconds,
        movement: input.movement,
        sequence: input.sequence,
      });
    }
  };

  const resize = () => {
    resizeRenderer();
    resizeCamera();
    resizeHudScene(canvas);
  };

  const tick = (frameTime: number) => {
    if (isDisposed) {
      return;
    }

    const deltaSeconds = Math.min((frameTime - previousFrameTime) / 1000, 0.05);
    previousFrameTime = frameTime;

    renderFrame({
      camera,
      deltaSeconds,
      entityViewStore,
      predictionController,
      renderer,
      scene,
      store,
    });

    const state = store.getState();

    if (state.connectionState.phase === "joined") {
      updateHudScene(
        deriveHudState({
          health: state.health,
          inventory: state.inventory,
          playerEntityId: state.playerEntityId,
          roomId: state.roomId,
        }),
      );
      const previousAutoClear = renderer.autoClear;
      renderer.clearDepth();
      renderer.autoClear = false;
      renderer.render(hudScene, hudCamera);
      renderer.autoClear = previousAutoClear;
    }

    animationFrame = window.requestAnimationFrame(tick);
  };

  window.addEventListener("resize", resize);
  resize();
  inputLoop = window.setInterval(sendInput, inputDeltaSeconds * 1000);
  animationFrame = window.requestAnimationFrame(tick);

  return () => {
    isDisposed = true;
    window.cancelAnimationFrame(animationFrame);
    window.clearInterval(inputLoop);
    window.removeEventListener("resize", resize);
    unsubscribeFromStore();
    inputController.destroy();
    entityViewStore.dispose();
    disposeHudScene();
    disposeScene();
    renderer.dispose();
  };
};
