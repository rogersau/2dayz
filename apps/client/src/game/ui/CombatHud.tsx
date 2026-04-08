import type { Health, WeaponState } from "@2dayz/shared";

type CombatHudProps = {
  health: Health | null;
  inventoryAmmo: number;
  weaponState: WeaponState | null;
};

export const CombatHud = ({ health, inventoryAmmo, weaponState }: CombatHudProps) => {
  const healthLabel = health ? `Health ${health.current}/${health.max}` : "Health pending";
  const ammoLabel = weaponState ? `Ammo ${weaponState.magazineAmmo}/${inventoryAmmo}` : `Ammo 0/${inventoryAmmo}`;

  return (
    <section aria-label="combat hud" className="combat-hud">
      <div aria-label="crosshair" className="combat-crosshair">
        <span className="combat-crosshair-line combat-crosshair-line-horizontal" />
        <span className="combat-crosshair-line combat-crosshair-line-vertical" />
      </div>
      <div className="combat-hud-panel">
        <p className="combat-hud-kicker">Combat HUD</p>
        <div className="combat-hud-readouts">
          <p>{healthLabel}</p>
          <p>{ammoLabel}</p>
        </div>
      </div>
    </section>
  );
};
