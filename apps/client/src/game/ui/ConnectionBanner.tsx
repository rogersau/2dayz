import type { ErrorReason } from "@2dayz/shared";

type ConnectionState =
  | { phase: "idle" }
  | { phase: "joining" }
  | { phase: "reconnecting" }
  | { phase: "joined" }
  | { phase: "failed"; reason: ErrorReason };

type ConnectionBannerProps = {
  connectionState: ConnectionState;
  onRetry: () => void;
};

const getFailureMessage = (reason: ErrorReason) => {
  if (reason === "room-unavailable") {
    return "The room was unavailable or unhealthy. Retry to join a healthy session.";
  }

  if (reason === "expired") {
    return "Your previous session expired. Retry to enter a fresh run.";
  }

  return "Could not join the session. Retry when you are ready.";
};

export const ConnectionBanner = ({ connectionState, onRetry }: ConnectionBannerProps) => {
  if (connectionState.phase === "reconnecting") {
    return (
      <section aria-live="polite" className="banner banner-info" role="status">
        Reconnecting to your session...
      </section>
    );
  }

  if (connectionState.phase !== "failed") {
    return null;
  }

  return (
    <section className="banner banner-error">
      <p aria-live="assertive" role="alert">{getFailureMessage(connectionState.reason)}</p>
      <button className="secondary-button" onClick={onRetry} type="button">
        Retry join
      </button>
    </section>
  );
};
