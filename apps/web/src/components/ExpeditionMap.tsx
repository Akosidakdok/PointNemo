import type { CSSProperties } from "react";
import { GameButton } from "./ui/GameButton";

export interface MapNode {
  id: string;
  label: string;
  kind: "start" | "hazard" | "lesson" | "encounter" | "boss";
  short: string;
  detail: string;
  progress: string;
  depth: number;
}

export const mapNodes: MapNode[] = [
  {
    id: "nemo",
    label: "Point Nemo Surface",
    kind: "start",
    short: "Expedition Origin",
    detail: "The oceanic pole of inaccessibility. Coordinates: 48°52.6′S 123°23.6′W. Furthest point from all landmasses.",
    progress: "ORIGIN",
    depth: 0,
  },
  {
    id: "iceberg",
    label: "Drift Hazard Sector",
    kind: "hazard",
    short: "Hazard · Shifting Ice",
    detail: "Subsurface shelf fragments drifting across abyssal currents. Navigate sonar pulses around mass contours.",
    progress: "AHEAD",
    depth: 1850,
  },
  {
    id: "adaptation",
    label: "Pressure & Adaptation",
    kind: "lesson",
    short: "Lesson 01 · 12 min",
    detail: "Field study on deep-sea barophiles and gelatinous organisms surviving extreme hydrostatic pressure.",
    progress: "STUDY",
    depth: 4180,
  },
  {
    id: "encounter",
    label: "Hadal Creature Zone",
    kind: "encounter",
    short: "Encounter · Turn Battle",
    detail: "Sensors pick up an organic bio-signature. Blobfish and abyssal organisms detected in the trench.",
    progress: "ACTIVE",
    depth: 7200,
  },
  {
    id: "megalodon",
    label: "Megalodon Abyss Trench",
    kind: "boss",
    short: "Trench Apex · Locked",
    detail: "Ultimate hadal depth marker at 10,935m. Deep-sea sonar signals reflect enormous unknown structures.",
    progress: "LOCKED",
    depth: 10935,
  },
];

export interface ExpeditionMapProps {
  selectedId: string;
  onSelect: (node: MapNode) => void;
  onLaunchEncounter?: () => void;
  onClose?: () => void;
}

const kindGlyphs: Record<MapNode["kind"], string> = {
  start: "⌖",
  hazard: "✳",
  lesson: "◈",
  encounter: "◉",
  boss: "✦",
};

export function ExpeditionMap({
  selectedId,
  onSelect,
  onLaunchEncounter,
  onClose,
}: ExpeditionMapProps) {
  const selectedNode = mapNodes.find((n) => n.id === selectedId) || mapNodes[0];

  return (
    <section className="expedition-map pixel-panel" aria-labelledby="map-heading">
      <div className="map-topbar">
        <div>
          <p className="panel-eyebrow">BATHYMETRIC TACTICAL CHART</p>
          <h2 id="map-heading" className="map-heading">HADAL DESCENT ROUTE 01</h2>
        </div>
        <div className="map-top-actions">
          <span className="depth-badge">
            MAX DEPTH: <b>10,935 M</b>
          </span>
          {onClose && (
            <GameButton variant="secondary" size="sm" onClick={onClose} aria-label="Close route map">
              ✕
            </GameButton>
          )}
        </div>
      </div>

      {/* Sonar Chart Area */}
      <div className="radar-route-area" role="region" aria-label="Tactical navigation chart">
        <div className="bathymetric-grid" aria-hidden="true" />
        <svg
          className="route-vector-svg"
          viewBox="0 0 800 220"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="route-track-bg"
            d="M50 170 C140 170 150 70 260 70 S370 160 450 150 S550 50 630 80 S710 140 760 30"
          />
          <path
            className="route-track-active"
            d="M50 170 C140 170 150 70 260 70 S370 160 450 150"
          />
        </svg>

        {mapNodes.map((node, index) => {
          const isSelected = selectedId === node.id;
          const xPercent = 6 + index * 22;
          const yOffsets = [76, 28, 68, 34, 14];
          const yPercent = yOffsets[index];

          return (
            <button
              key={node.id}
              type="button"
              className={`waypoint-node node-${node.kind} ${isSelected ? "is-selected" : ""}`}
              style={
                {
                  "--node-x": `${xPercent}%`,
                  "--node-y": `${yPercent}%`,
                } as CSSProperties
              }
              aria-pressed={isSelected}
              onClick={() => onSelect(node)}
            >
              <span className="waypoint-orb" aria-hidden="true">
                {kindGlyphs[node.kind]}
              </span>
              <span className="waypoint-label">{node.label}</span>
              <span className="waypoint-meta">{node.progress} · {node.depth}M</span>
            </button>
          );
        })}

        <div className="radar-coordinates" aria-hidden="true">
          <span>48°52′S · 123°23′W</span>
          <span>BATHYAL CONTOUR 04</span>
        </div>
      </div>

      {/* Waypoint Detail Card */}
      <div className="waypoint-detail-panel" aria-live="polite">
        <div className="waypoint-index-badge">
          WAYPOINT #{String(mapNodes.findIndex((n) => n.id === selectedNode.id) + 1).padStart(2, "0")}
        </div>
        <div className="waypoint-info">
          <p className="waypoint-type-tag">
            {selectedNode.kind.toUpperCase()} // DEPTH {selectedNode.depth} METERS
          </p>
          <h3 className="waypoint-title">{selectedNode.label}</h3>
          <p className="waypoint-desc">{selectedNode.detail}</p>
        </div>
        <div className="waypoint-action">
          {selectedNode.kind === "encounter" && onLaunchEncounter && (
            <GameButton variant="primary" size="md" onClick={onLaunchEncounter}>
              ENGAGE CREATURE ↗
            </GameButton>
          )}
          {selectedNode.kind === "lesson" && (
            <GameButton variant="gold" size="md">
              START LESSON ↗
            </GameButton>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="map-legend-row" aria-label="Route symbols legend">
        <span className="legend-item"><i className="legend-dot dot-origin" /> Surface Origin</span>
        <span className="legend-item"><i className="legend-dot dot-hazard" /> Current Hazard</span>
        <span className="legend-item"><i className="legend-dot dot-lesson" /> Study Module</span>
        <span className="legend-item"><i className="legend-dot dot-encounter" /> Creature Encounter</span>
        <span className="legend-item"><i className="legend-dot dot-boss" /> Hadal Apex</span>
      </div>
    </section>
  );
}
