type DeathOverlayProps = {
  isVisible: boolean;
};

export const DeathOverlay = ({ isVisible }: DeathOverlayProps) => {
  if (!isVisible) {
    return null;
  }

  return (
    <section className="death-overlay">
      <h2>You died</h2>
      <p>Respawning into the current live session...</p>
    </section>
  );
};
