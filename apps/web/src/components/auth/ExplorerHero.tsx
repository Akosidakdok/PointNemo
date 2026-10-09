import { useState } from "react";

export interface ExplorerHeroProps {
  reducedMotion?: boolean;
}

export function ExplorerHero({ reducedMotion = false }: ExplorerHeroProps) {
  const [showStatus, setShowStatus] = useState(false);

  return (
    <div
      className={`explorer-hero-container ${reducedMotion ? "no-motion" : ""}`}
      onMouseEnter={() => setShowStatus(true)}
      onMouseLeave={() => setShowStatus(false)}
      onFocus={() => setShowStatus(true)}
      onBlur={() => setShowStatus(false)}
      tabIndex={0}
      role="region"
      aria-label="Explorer Unit Telemetry"
    >
      <div className="explorer-sprite-wrapper">
        <img
          src="/assets/characters/explorer-front.png"
          alt="Point Nemo Front-Facing Explorer Survivor in Deep Diving Gear"
          className="explorer-front-sprite pixel-art"
          width="130"
          height="198"
          loading="eager"
        />
        <div className="explorer-visor-glow" aria-hidden="true" />
      </div>

      {/* Optional Interactive Status Tooltip */}
      <div
        className={`explorer-telemetry-card ${showStatus ? "is-visible" : ""}`}
        aria-hidden={!showStatus}
      >
        <div className="telemetry-card-header">EXPLORER UNIT // MK-I</div>
        <div className="telemetry-lines">
          <div><span>VISOR</span> <b className="text-cyan">READY</b></div>
          <div><span>SONAR</span> <b className="text-cyan">READY</b></div>
          <div><span>NAV</span> <b className="text-cyan">READY</b></div>
        </div>
      </div>
    </div>
  );
}
