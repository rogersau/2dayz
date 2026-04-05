import { useEffect, useRef, useState } from "react";

import type { ErrorReason } from "@2dayz/shared";

import { createSocketClient, SocketClientError, type JoinResult } from "./game/net/socketClient";
import { createProtocolStore } from "./game/net/protocolStore";
import {
  createClientGameStore,
  useClientGameStore,
} from "./game/state/clientGameStore";
import { ConnectionBanner } from "./game/ui/ConnectionBanner";
import { ControlsOverlay } from "./game/ui/ControlsOverlay";
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
  const { sessionToken, setSessionToken, clearSessionToken } = useSessionToken();

  useEffect(() => {
    if (!sessionToken || reconnectAttemptRef.current === sessionToken) {
      return;
    }

    reconnectAttemptRef.current = sessionToken;
    gameStore.beginReconnect();

    void socketClient
      .reconnect({ sessionToken })
      .then((result) => {
        gameStore.completeJoin({
          displayName: state.lastJoinDisplayName || "Survivor",
          playerEntityId: result.playerEntityId,
          roomId: result.roomId,
          reconnected: true,
        });
      })
      .catch((error: unknown) => {
        clearSessionToken();
        gameStore.failConnection(getConnectionErrorReason(error));
      });
  }, [clearSessionToken, gameStore, sessionToken, socketClient, state.lastJoinDisplayName]);

  useEffect(() => {
    return () => {
      socketClient.close();
    };
  }, [socketClient]);

  const handleJoined = (result: JoinResult, displayName: string) => {
    reconnectAttemptRef.current = result.sessionToken;
    setSessionToken(result.sessionToken);
    gameStore.completeJoin({
      displayName,
      playerEntityId: result.playerEntityId,
      roomId: result.roomId,
      reconnected: false,
    });
  };

  const handleJoinStarted = (displayName: string) => {
    gameStore.beginJoin(displayName);
  };

  const handleJoinFailed = (reason: ErrorReason, displayName: string) => {
    clearSessionToken();
    gameStore.beginJoin(displayName);
    gameStore.failConnection(reason);
  };

  const handleRetry = () => {
    if (state.connectionState.phase === "failed" && state.lastJoinDisplayName) {
      gameStore.resetToIdle();
    }
  };

  const isConnected = state.connectionState.phase === "joined";

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

        {!isConnected ? (
          <JoinScreen
            initialDisplayName={state.lastJoinDisplayName}
            onJoined={handleJoined}
            onJoinFailed={handleJoinFailed}
            onJoinStarted={handleJoinStarted}
            socketClient={socketClient}
          />
        ) : (
          <section className="game-shell" aria-label="game shell">
            <Hud
              inventory={state.inventory}
              isInventoryOpen={state.isInventoryOpen}
              onToggleInventory={() => gameStore.toggleInventory()}
              roomId={state.roomId}
            />
            <DeathOverlay isVisible={state.isDead} />
            {state.showControlsOverlay ? (
              <ControlsOverlay onDismiss={() => gameStore.dismissControlsOverlay()} />
            ) : null}
          </section>
        )}
      </section>
    </main>
  );
};
