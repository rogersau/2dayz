import type { ClientGameStore } from "./state/clientGameStore";
import { SERVER_TICK_RATE, defaultTownMap, sharedWeaponDefinitionsById } from "@2dayz/shared";

import { createCamera } from "./createCamera";
import { createRenderer } from "./createRenderer";
import { createScene } from "./createScene";
import { createInputController } from "./input/inputController";
import { createWorldView } from "./render/createWorldView";
import { createCombatEffectsView } from "./render/combatEffectsView";
import { createEntityViewStore } from "./render/entityViewStore";
import { createPredictionController } from "./render/prediction";
import { renderFrame } from "./render/renderFrame";
import type { SocketClient } from "./net/socketClient";

const canQueueLocalShot = ({
  cooldownsByWeaponId,
  now,
  store,
  aim,
}: {
  cooldownsByWeaponId: Map<string, number>;
  now: number;
  store: ClientGameStore;
  aim: { x: number; y: number };
}): boolean => {
  const state = store.getState();
  if (state.connectionState.phase !== "joined" || Math.hypot(aim.x, aim.y) === 0) {
    return false;
  }

  const equippedSlot = state.inventory.equippedWeaponSlot;
  if (equippedSlot === null) {
    return false;
  }

  const equippedItem = state.inventory.slots[equippedSlot];
  if (!equippedItem) {
    return false;
  }

  const weaponDefinition = sharedWeaponDefinitionsById.get(equippedItem.itemId);
  if (!weaponDefinition) {
    return false;
  }

  const hasAmmo = state.inventory.ammoStacks.some(
    (ammoStack) => ammoStack.ammoItemId === weaponDefinition.ammoItemId && ammoStack.quantity > 0,
  );
  if (!hasAmmo) {
    return false;
  }

  const nextAllowedShotTime = cooldownsByWeaponId.get(weaponDefinition.itemId) ?? 0;
  if (now < nextAllowedShotTime) {
    return false;
  }

  cooldownsByWeaponId.set(weaponDefinition.itemId, now + 1000 / weaponDefinition.fireRate);
  return true;
};

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
  const worldView = createWorldView({ map: defaultTownMap, scene });
  const inputController = createInputController({
    element: canvas,
    isEnabled: () => store.getState().connectionState.phase === "joined",
    onToggleInventory: () => store.toggleInventory(),
  });
  const combatEffectsView = createCombatEffectsView(scene);
  const entityViewStore = createEntityViewStore(scene);
  const predictionController = createPredictionController({ rotation: 0, x: 0, y: 0 });
  let animationFrame = 0;
  let isDisposed = false;
  let inputLoop = 0;
  let wasJoined = store.getState().connectionState.phase === "joined";
  let sequence = 0;
  let previousFrameTime = performance.now();
  const localShotCooldownsByWeaponId = new Map<string, number>();
  const inputDeltaSeconds = 1 / SERVER_TICK_RATE;

  const unsubscribeFromStore = store.subscribe(() => {
    const isJoined = store.getState().connectionState.phase === "joined";

    if (wasJoined && !isJoined) {
      inputController.reset();
      localShotCooldownsByWeaponId.clear();
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
    const inventoryAction = store.consumeQueuedInventoryAction?.();
    const nextInput = inventoryAction
      ? {
          ...input,
          actions: {
            ...input.actions,
            inventory: inventoryAction,
          },
        }
      : input;
    socketClient.sendInput(nextInput);

    if (
      nextInput.actions.fire &&
      canQueueLocalShot({
        aim: nextInput.aim,
        cooldownsByWeaponId: localShotCooldownsByWeaponId,
        now: performance.now(),
        store,
      })
    ) {
      combatEffectsView.queueLocalShot({ aim: nextInput.aim });
    }

    if (
      nextInput.movement.x !== 0 ||
      nextInput.movement.y !== 0 ||
      nextInput.aim.x !== 0 ||
      nextInput.aim.y !== 0
    ) {
      predictionController.applyInput({
        aim: nextInput.aim,
        deltaSeconds: inputDeltaSeconds,
        movement: nextInput.movement,
        sequence: nextInput.sequence,
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
      combatEffectsView,
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
    unsubscribeFromStore();
    inputController.destroy();
    combatEffectsView.dispose();
    entityViewStore.dispose();
    worldView.dispose();
    disposeScene();
    renderer.dispose();
  };
};
