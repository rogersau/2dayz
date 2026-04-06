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
      <p className="join-kicker">Live title menu</p>
      <h2>Enter the quarantine</h2>
      <p>Choose your display name, check the field briefing, and drop into the current browser run.</p>
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
          Review briefing
        </button>
      </form>
      <p>Local mock mode: use any name containing `fail` to simulate a retryable join failure after the briefing.</p>
    </section>
  );
};
