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
      <p className="join-kicker">Field briefing</p>
      <h2>Field briefing</h2>
      <p>Stay light, move fast, and make your first contact count.</p>
      <p>Your first left click captures the mouse and fires.</p>
      <ul>
        <li>Click to capture mouse</li>
        <li>Mouse aim</li>
        <li>Left click fire</li>
        <li>Right click aim or block</li>
        <li>Esc release mouse</li>
        <li>WASD move</li>
        <li>E interact</li>
        <li>R reload</li>
        <li>X stow weapon</li>
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
        Enter session
      </button>
    </section>
  );
};
