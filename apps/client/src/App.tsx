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

  if (
    typeof error === "object"
    && error !== null
    && "reason" in error
    && typeof error.reason === "string"
  ) {
    return error.reason as ErrorReason;
  }

  return "internal-error";
};

const RECONNECT_RETRY_DELAY_MS = 150;
const RECONNECT_RETRY_LIMIT = 5;

const getReconnectFailureReason = (reason: ErrorReason): ErrorReason => {
  if (reason === "invalid") {
    return "expired";
  }

  return reason;
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
  const reconnectRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingJoinDisplayName, setPendingJoinDisplayName] = useState<string | null>(null);
  const [isJoinRequestPending, setIsJoinRequestPending] = useState(false);
  const { displayName, sessionToken, setDisplayName, setSessionToken, clearSessionToken } = useSessionToken();

  const clearReconnectRetryTimeout = () => {
    if (reconnectRetryTimeoutRef.current) {
      clearTimeout(reconnectRetryTimeoutRef.current);
      reconnectRetryTimeoutRef.current = null;
    }
  };

  const completeJoin = (result: JoinResult, resolvedDisplayName: string) => {
    clearReconnectRetryTimeout();
    reconnectAttemptRef.current = result.sessionToken;
    setDisplayName(resolvedDisplayName);
    setSessionToken(result.sessionToken);
    gameStore.completeJoin({
      displayName: resolvedDisplayName,
      playerEntityId: result.playerEntityId,
      roomId: result.roomId,
    });
  };

  const attemptReconnect = (attempt = 0, token = sessionToken) => {
    if (!token || (isJoinRequestPending && attempt === 0)) {
      return;
    }

    clearReconnectRetryTimeout();
    setIsJoinRequestPending(true);
    reconnectAttemptRef.current = token;
    gameStore.beginReconnect();

    void socketClient
      .reconnect({ sessionToken: token })
      .then((result) => {
        completeJoin(result, displayName || state.lastJoinDisplayName || "Survivor");
      })
      .catch((error: unknown) => {
        const reason = getConnectionErrorReason(error);

        if (reason === "not-disconnected" && attempt < RECONNECT_RETRY_LIMIT) {
          setIsJoinRequestPending(false);
          reconnectRetryTimeoutRef.current = setTimeout(() => {
            attemptReconnect(attempt + 1, token);
          }, RECONNECT_RETRY_DELAY_MS);
          return;
        }

        const resolvedReason = getReconnectFailureReason(reason);
        clearSessionToken();
        gameStore.failConnection(resolvedReason);
      })
      .finally(() => {
        if (reconnectRetryTimeoutRef.current === null) {
          setIsJoinRequestPending(false);
        }
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
      if (event.type === "closed" && gameStore.getState().connectionState.phase === "joined") {
        gameStore.failConnection(event.reason);
      }
    });
  }, [gameStore, socketClient]);

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
      clearReconnectRetryTimeout();
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
      <div className="scene-layer">
        <GameCanvas socketClient={socketClient} store={gameStore} />
      </div>

      <div className="shell-layer">
        <ConnectionBanner connectionState={state.connectionState} onRetry={handleRetry} />

        {!isConnected && !showControlsStep ? (
          <section className="title-menu" aria-label="title menu">
            <header className="hero-copy">
              <p className="eyebrow">Browser V1</p>
              <h1>2D DayZ</h1>
              <p className="hero-body">
                Take your place, step through the field briefing, and fight your way back in if the
                line goes cold.
              </p>
            </header>
            <JoinScreen
              initialDisplayName={displayName || state.lastJoinDisplayName}
              onContinue={(nextDisplayName) => {
                setDisplayName(nextDisplayName);
                setPendingJoinDisplayName(nextDisplayName);
              }}
            />
          </section>
        ) : null}

        {isConnected ? (
          <section className="game-shell" aria-label="game shell">
            <div className="game-hud-layer">
              <Hud
                inventory={state.inventory}
                isInventoryOpen={state.isInventoryOpen}
                onToggleInventory={() => gameStore.toggleInventory()}
              />
            </div>
          </section>
        ) : null}
      </div>

      <div className="interrupt-layer">
        {!isConnected && showControlsStep ? <ControlsOverlay onContinue={handleControlsContinue} /> : null}
        <DeathOverlay isVisible={isConnected && state.isDead} />
      </div>
    </main>
  );
};
