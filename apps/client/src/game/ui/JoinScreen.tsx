import { useEffect, useState } from "react";

import type { ErrorReason } from "@2dayz/shared";

import { SocketClientError, type JoinResult, type SocketClient } from "../net/socketClient";

type JoinScreenProps = {
  initialDisplayName?: string;
  onJoined?: (result: JoinResult, displayName: string) => void;
  onJoinFailed?: (reason: ErrorReason, displayName: string) => void;
  onJoinStarted?: (displayName: string) => void;
  socketClient: Pick<SocketClient, "join">;
};

const getJoinErrorReason = (error: unknown): ErrorReason => {
  if (error instanceof SocketClientError) {
    return error.reason;
  }

  return "internal-error";
};

export const JoinScreen = ({
  initialDisplayName = "",
  onJoined,
  onJoinFailed,
  onJoinStarted,
  socketClient,
}: JoinScreenProps) => {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDisplayName(initialDisplayName);
  }, [initialDisplayName]);

  const trimmedName = displayName.trim();
  const canSubmit = trimmedName.length > 0 && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    onJoinStarted?.(trimmedName);

    try {
      const result = await socketClient.join({ displayName: trimmedName });
      onJoined?.(result, trimmedName);
    } catch (error) {
      onJoinFailed?.(getJoinErrorReason(error), trimmedName);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="join-card">
      <h2>Join a live session</h2>
      <p>Enter a display name and drop straight into the current browser room.</p>
      <form className="join-form" onSubmit={handleSubmit}>
        <label>
          <span>Display name</span>
          <input
            autoComplete="nickname"
            name="displayName"
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Survivor"
            value={displayName}
          />
        </label>
        <button className="primary-button" disabled={!canSubmit} type="submit">
          {isSubmitting ? "Joining..." : "Join now"}
        </button>
      </form>
      <p>Local mock mode: use any name containing `fail` to simulate a retryable join error.</p>
    </section>
  );
};
