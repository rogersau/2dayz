import type { ClientGameStore } from "./state/clientGameStore";

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
  const scene = createScene();
  const inputController = createInputController({
    element: canvas,
    onToggleInventory: () => store.toggleInventory(),
  });
  const entityViewStore = createEntityViewStore(scene);
  const predictionController = createPredictionController({ rotation: 0, x: 0, y: 0 });
  let animationFrame = 0;
  let isDisposed = false;
  let sequence = 0;
  let previousFrameTime = performance.now();

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
    const input = inputController.pollInput(sequence++);

    socketClient.sendInput(input);

    renderFrame({
      camera,
      deltaSeconds,
      entityViewStore,
      input,
      predictionController,
      renderer,
      scene,
      store,
    });

    animationFrame = window.requestAnimationFrame(tick);
  };

  window.addEventListener("resize", resize);
  resize();
  animationFrame = window.requestAnimationFrame(tick);

  return () => {
    isDisposed = true;
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("resize", resize);
    inputController.destroy();
    entityViewStore.dispose();
    renderer.dispose();
  };
};
