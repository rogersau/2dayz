import { useEffect, useRef, useState } from "react";

import type { SocketClient } from "./net/socketClient";
import type { ClientGameStore } from "./state/clientGameStore";

import { bootGame } from "./boot";

const getRuntimeErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return `Three.js runtime failed to start: ${error.message}`;
  }

  return "Three.js runtime failed to start: unknown error";
};

export const GameCanvas = ({
  socketClient,
  store,
}: {
  socketClient: Pick<SocketClient, "sendInput">;
  store: ClientGameStore;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    try {
      const dispose = bootGame({ canvas: canvasRef.current, socketClient, store });
      setRuntimeError(null);
      return dispose;
    } catch (error) {
      setRuntimeError(getRuntimeErrorMessage(error));
      return;
    }
  }, [socketClient, store]);

  return (
    <div className="game-canvas-shell">
      <canvas aria-label="game world" className="game-canvas" ref={canvasRef} />
      {runtimeError ? <p className="game-runtime-error">{runtimeError}</p> : null}
    </div>
  );
};
