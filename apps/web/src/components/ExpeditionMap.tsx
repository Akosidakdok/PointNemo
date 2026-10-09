import type { CSSProperties } from "react";

export interface MapNode {
  id: string;
  label: string;
  kind: "start" | "lesson" | "hazard" | "encounter" | "boss";
  short: string;
  detail: string;
  progress: string;
}

export const mapNodes: MapNode[] = [
  {
    id: "nemo",
    label: "Point Nemo",
    kind: "start",
    short: "Your starting point",
    detail: "The most remote point in the ocean. Your expedition begins here.",
    progress: "START",
  },
  {
    id: "iceberg",
    label: "Iceberg drift",
    kind: "hazard",
    short: "Hazard · shifting ice",
    detail: "Navigate the cold current carefully before it pushes the submersible off route.",
    progress: "AHEAD",
  },
  {
    id: "adaptation",
    label: "Pressure & adaptation",
    kind: "lesson",
    short: "Lesson 01 · 12 min",
    detail: "Explore how deep-sea life adapts to darkness, cold, and crushing pressure.",
    progress: "LESSON",
  },
  {
    id: "anglerfish",
    label: "Anglerfish encounter",
    kind: "encounter",
    short: "Encounter · turn battle",
    detail: "Use a sonar pulse to clear the path and continue your expedition.",
    progress: "BATTLE",
  },
  {
    id: "megalodon",
    label: "Megalodon trench",
    kind: "boss",
    short: "Lesson boss · locked",
    detail: "A final challenge waits beyond this lesson route.",
    progress: "LOCKED",
  },
];

interface ExpeditionMapProps {
  selectedId: string;
  onSelect: (node: MapNode) => void;
}

const iconByKind: Record<MapNode["kind"], string> = {
  start: "⌖",
  lesson: "◈",
  hazard: "✳",
  encounter: "◉",
  boss: "✦",
};

export function ExpeditionMap({ selectedId, onSelect }: ExpeditionMapProps) {
  return (
    <section className="map-card" aria-labelledby="map-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">LIVE EXPEDITION · ROUTE 01</p>
          <h2 id="map-title">The hadal descent</h2>
        </div>
        <span className="depth-chip">10,935 m <span>MAX DEPTH</span></span>
      </div>

      <div className="route-map" aria-label="Lesson route from Point Nemo to the Megalodon trench">
        <div className="sea-grid" aria-hidden="true" />
        <svg className="route-line" viewBox="0 0 800 220" preserveAspectRatio="none" aria-hidden="true">
          <path d="M40 174 C145 174 130 60 254 66 S350 174 433 156 S541 44 625 73 S710 150 770 24" />
          <path className="route-progress" d="M40 174 C145 174 130 60 254 66" />
        </svg>
        {mapNodes.map((node, index) => (
          <button
            className={`map-node node-${node.kind}${selectedId === node.id ? " is-selected" : ""}${index > 2 ? " is-distant" : ""}`}
            key={node.id}
            style={{ "--node-x": `${5 + index * 22.5}%`, "--node-y": `${76 - [0, 50, 5, 43, 66][index]}%` } as CSSProperties}
            type="button"
            aria-pressed={selectedId === node.id}
            onClick={() => onSelect(node)}
          >
            <span className="node-orb" aria-hidden="true">{iconByKind[node.kind]}</span>
            <span className="node-label">{node.label}</span>
            <span className="node-type">{node.progress}</span>
          </button>
        ))}
        <div className="map-coordinate coordinate-one" aria-hidden="true">48°52′S<br />123°23′W</div>
        <div className="map-coordinate coordinate-two" aria-hidden="true">HADAL ZONE<br />BATHYAL EDGE</div>
        <div className="sonar-sweep" aria-hidden="true" />
      </div>

      <div className="map-legend" aria-label="Map legend">
        <span><i className="legend-dot legend-current" />Current position</span>
        <span><i className="legend-dot legend-lesson" />Lesson</span>
        <span><i className="legend-dot legend-hazard" />Hazard</span>
        <span><i className="legend-dot legend-encounter" />Encounter</span>
      </div>
    </section>
  );
}
