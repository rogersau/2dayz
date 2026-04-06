import type { ClientGameStore } from "./state/clientGameStore";
import { SERVER_TICK_RATE } from "@2dayz/shared";

import { createCamera } from "./createCamera";
import { createRenderer } from "./createRenderer";
import { createScene } from "./createScene";
import { createInputController } from "./input/inputController";
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
  let sequence = 0;
  let previousFrameTime = performance.now();
  const inputDeltaSeconds = 1 / SERVER_TICK_RATE;

  const sendInput = () => {
    if (isDisposed) {
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
    inputController.destroy();
    entityViewStore.dispose();
    disposeScene();
    renderer.dispose();
  };
};
