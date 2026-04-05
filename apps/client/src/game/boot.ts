import type { ClientGameStore } from "./state/clientGameStore";

import { createCamera } from "./createCamera";
import { createRenderer } from "./createRenderer";
import { createScene } from "./createScene";
import { createInputController } from "./input/inputController";
import { createEntityViewStore } from "./render/entityViewStore";
import { renderFrame } from "./render/renderFrame";

export const bootGame = ({ canvas, store }: { canvas: HTMLCanvasElement; store: ClientGameStore }) => {
  const { renderer, resize: resizeRenderer } = createRenderer(canvas);
  const { camera, resize: resizeCamera } = createCamera(canvas);
  const scene = createScene();
  const inputController = createInputController({ element: canvas });
  const entityViewStore = createEntityViewStore(scene);
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

    renderFrame({
      camera,
      deltaSeconds,
      entityViewStore,
      input: inputController.pollInput(sequence++),
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
