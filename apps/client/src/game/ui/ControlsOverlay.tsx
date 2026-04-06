import { useState } from "react";

const CONTROLS_DISMISSED_KEY = "2dayz:controls-dismissed";

export const hasDismissedControlsInSession = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(CONTROLS_DISMISSED_KEY) === "1";
};

type ControlsOverlayProps = {
  onContinue: () => void;
};

export const ControlsOverlay = ({ onContinue }: ControlsOverlayProps) => {
  const [dismissed, setDismissed] = useState(hasDismissedControlsInSession);

  if (dismissed) {
    return null;
  }

  return (
    <section className="controls-card interrupt-card">
      <h2>Before you drop in</h2>
      <ul>
        <li>WASD move</li>
        <li>Mouse aim</li>
        <li>Click shoot</li>
        <li>E interact</li>
        <li>R reload</li>
        <li>Tab inventory</li>
      </ul>
      <button
        className="primary-button"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(CONTROLS_DISMISSED_KEY, "1");
          }
          setDismissed(true);
          onContinue();
        }}
        type="button"
      >
        Continue to session
      </button>
    </section>
  );
};
