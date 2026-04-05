import { useEffect, useRef, useState } from "react";

import type { ErrorReason } from "@2dayz/shared";

import { GameCanvas } from "./game/GameCanvas";
import { createSocketClient, SocketClientError, type JoinResult } from "./game/net/socketClient";
import { createProtocolStore } from "./game/net/protocolStore";
import {
  createClientGameStore,
  useClientGameStore,
} from "./game/state/clientGameStore";
import { ConnectionBanner } from "./game/ui/ConnectionBanner";
import { ControlsOverlay, hasDismissedControlsInSession } from "./game/ui/ControlsOverlay";
import { DeathOverlay } from "./game/ui/DeathOverlay";
import { Hud } from "./game/ui/Hud";
import { JoinScreen } from "./game/ui/JoinScreen";
import { useSessionToken } from "./game/ui/useSessionToken";

const getConnectionErrorReason = (error: unknown): ErrorReason => {
  if (error instanceof SocketClientError) {
    return error.reason;
  }

  return "internal-error";
};

export const App = () => {
  const [protocolStore] = useState(() => createProtocolStore());
  const [gameStore] = useState(() => createClientGameStore());
  const [socketClient] = useState(() =>
    createSocketClient({
      mode: import.meta.env.DEV && import.meta.env.VITE_CLIENT_SOCKET_MODE !== "ws" ? "mock" : "ws",
      protocolStore,
    }),
  );
  const state = useClientGameStore(gameStore);
  const reconnectAttemptRef = useRef<string | null>(null);
  const [pendingJoinDisplayName, setPendingJoinDisplayName] = useState<string | null>(null);
  const [isJoinRequestPending, setIsJoinRequestPending] = useState(false);
  const { displayName, sessionToken, setDisplayName, setSessionToken, clearSessionToken } = useSessionToken();

  const completeJoin = (result: JoinResult, resolvedDisplayName: string) => {
    reconnectAttemptRef.current = result.sessionToken;
    setDisplayName(resolvedDisplayName);
    setSessionToken(result.sessionToken);
    gameStore.completeJoin({
      displayName: resolvedDisplayName,
      playerEntityId: result.playerEntityId,
      roomId: result.roomId,
    });
  };

  const attemptReconnect = () => {
    if (!sessionToken || isJoinRequestPending) {
      return;
    }

    setIsJoinRequestPending(true);
    reconnectAttemptRef.current = sessionToken;
    gameStore.beginReconnect();

    void socketClient
      .reconnect({ sessionToken })
      .then((result) => {
        completeJoin(result, displayName || state.lastJoinDisplayName || "Survivor");
      })
      .catch((error: unknown) => {
        clearSessionToken();
        gameStore.failConnection(getConnectionErrorReason(error));
      })
      .finally(() => {
        setIsJoinRequestPending(false);
      });
  };

  useEffect(() => {
    if (!sessionToken || reconnectAttemptRef.current === sessionToken) {
      return;
    }

    attemptReconnect();
  }, [displayName, sessionToken, socketClient]);

  useEffect(() => {
    return socketClient.subscribeToConnection((event) => {
      if (event.type === "closed" && state.connectionState.phase === "joined") {
        gameStore.failConnection(event.reason);
      }
    });
  }, [gameStore, socketClient, state.connectionState.phase]);

  useEffect(() => {
    return protocolStore.subscribe(() => {
      const { deltas, snapshot } = protocolStore.drainWorldUpdates();

      if (snapshot) {
        gameStore.applySnapshot(snapshot);
      }

      for (const delta of deltas) {
        gameStore.applyDelta(delta);
      }
    });
  }, [gameStore, protocolStore]);

  useEffect(() => {
    return () => {
      socketClient.close();
    };
  }, [socketClient]);

  const handleControlsContinue = () => {
    if (!pendingJoinDisplayName || isJoinRequestPending) {
      return;
    }

    setIsJoinRequestPending(true);
    gameStore.beginJoin(pendingJoinDisplayName);

    void socketClient
      .join({ displayName: pendingJoinDisplayName })
      .then((result) => {
        setPendingJoinDisplayName(null);
        completeJoin(result, pendingJoinDisplayName);
      })
      .catch((error: unknown) => {
        setPendingJoinDisplayName(null);
        gameStore.failConnection(getConnectionErrorReason(error));
      })
      .finally(() => {
        setIsJoinRequestPending(false);
      });
  };

  const handleRetry = () => {
    if (state.connectionState.phase !== "failed") {
      return;
    }

    if (sessionToken) {
      attemptReconnect();
      return;
    }

    gameStore.resetToIdle();
  };

  const isConnected = state.connectionState.phase === "joined";
  const showControlsStep = pendingJoinDisplayName !== null && state.connectionState.phase !== "joined";

  useEffect(() => {
    if (!showControlsStep || !hasDismissedControlsInSession()) {
      return;
    }

    handleControlsContinue();
  }, [showControlsStep]);

  return (
    <main className="app-shell">
      <section className="app-panel">
        <header className="hero-copy">
          <p className="eyebrow">Browser V1</p>
          <h1>2D DayZ</h1>
          <p className="hero-body">
            Drop in with a name, review the controls, and reconnect fast inside the same
            browser session.
          </p>
        </header>

        <ConnectionBanner connectionState={state.connectionState} onRetry={handleRetry} />

        {!isConnected && !showControlsStep ? (
          <JoinScreen
            initialDisplayName={displayName || state.lastJoinDisplayName}
            onContinue={(nextDisplayName) => {
              setDisplayName(nextDisplayName);
              setPendingJoinDisplayName(nextDisplayName);
            }}
          />
        ) : null}

        {!isConnected && showControlsStep ? (
          <ControlsOverlay onContinue={handleControlsContinue} />
        ) : (
          isConnected ? (
            <section className="game-shell" aria-label="game shell">
              <div className="game-stage">
                <GameCanvas store={gameStore} />
                <div className="game-hud-layer">
                  <Hud
                    health={state.health}
                    inventory={state.inventory}
                    isInventoryOpen={state.isInventoryOpen}
                    onToggleInventory={() => gameStore.toggleInventory()}
                    playerEntityId={state.playerEntityId}
                    roomId={state.roomId}
                  />
                  <DeathOverlay isVisible={state.isDead} />
                </div>
              </div>
            </section>
          ) : null
        )}
      </section>
    </main>
  );
};
