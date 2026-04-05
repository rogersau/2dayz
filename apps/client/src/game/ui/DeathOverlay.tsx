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
      <p>Respawn flow lands in the next task once the full game runtime is connected.</p>
    </section>
  );
};
