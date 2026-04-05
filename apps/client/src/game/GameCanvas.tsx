import { useEffect, useRef, useState } from "react";

import type { SocketClient } from "./net/socketClient";
import type { ClientGameStore } from "./state/clientGameStore";

import { bootGame } from "./boot";

export const GameCanvas = ({
  socketClient,
  store,
}: {
  socketClient: Pick<SocketClient, "sendInput">;
  store: ClientGameStore;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasRuntimeError, setHasRuntimeError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    if (/jsdom/i.test(window.navigator.userAgent)) {
      setHasRuntimeError(true);
      return;
    }

    try {
      const dispose = bootGame({ canvas: canvasRef.current, socketClient, store });
      setHasRuntimeError(false);
      return dispose;
    } catch {
      setHasRuntimeError(true);
      return;
    }
  }, [socketClient, store]);

  return (
    <div className="game-canvas-shell">
      <canvas aria-label="game world" className="game-canvas" ref={canvasRef} />
      {hasRuntimeError ? <p className="game-runtime-error">Three.js runtime unavailable in this environment.</p> : null}
    </div>
  );
};
