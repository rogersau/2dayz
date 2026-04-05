import { useEffect, useState } from "react";

type JoinScreenProps = {
  initialDisplayName?: string;
  onContinue: (displayName: string) => void;
};

export const JoinScreen = ({
  initialDisplayName = "",
  onContinue,
}: JoinScreenProps) => {
  const [displayName, setDisplayName] = useState(initialDisplayName);

  useEffect(() => {
    setDisplayName(initialDisplayName);
  }, [initialDisplayName]);

  const trimmedName = displayName.trim();
  const canSubmit = trimmedName.length > 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    onContinue(trimmedName);
  };

  return (
    <section className="join-card">
      <h2>Join a live session</h2>
      <p>Enter a display name and review the controls before joining the current browser room.</p>
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
          Continue
        </button>
      </form>
      <p>Local mock mode: use any name containing `fail` to simulate a retryable join error after the controls step.</p>
    </section>
  );
};
