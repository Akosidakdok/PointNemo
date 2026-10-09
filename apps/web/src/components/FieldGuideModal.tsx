import { useState, useRef, useEffect } from "react";
import { GameModal } from "./ui/GameModal";
import { GameButton } from "./ui/GameButton";
import { type AssetBundle, drawFrame, speciesScale } from "../game/sprites";

export interface FieldGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  bundle: AssetBundle | null;
}

interface Specimen {
  id: string;
  name: string;
  taxonomy: string;
  zone: string;
  depthRange: string;
  frame: string;
  species: string;
  scaleFactor: number;
  description: string;
  adaptation: string;
}

const SPECIMENS: Specimen[] = [
  {
    id: "blobfish",
    name: "Hadal Blobfish",
    taxonomy: "Psychrolutes marcidus",
    zone: "Abyssal Plain",
    depthRange: "600m – 4,200m",
    frame: "blobfish.1.0",
    species: "blobfish",
    scaleFactor: 80,
    description: "Lacking bone density and gas bladders, its body consists mostly of gelatinous flesh slightly less dense than water, allowing it to float above the ocean floor with minimal expenditure of energy.",
    adaptation: "Hydrostatic Pressure Equilibrium: Flesh maintains natural structural integrity under deep water pressure; compresses rather than collapsing."
  },
  {
    id: "barreleye",
    name: "Barreleye Fish",
    taxonomy: "Macropinna microstoma",
    zone: "Mesopelagic / Bathyal",
    depthRange: "600m – 2,500m",
    frame: "barreleye.1.0",
    species: "barreleye",
    scaleFactor: 80,
    description: "Famous for its transparent, fluid-filled dome on its head through which glowing green tubular eyes detect the faintest silhouettes of prey drifting against the downwelling surface light.",
    adaptation: "Extreme Low-Light Photoreception: Tubular lenses gather sparse photons while shielded from stinging siphonophore tentacles."
  },
  {
    id: "gulper",
    name: "Pelican Gulper Eel",
    taxonomy: "Eurypharynx pelecanoides",
    zone: "Abyssal Trench",
    depthRange: "1,500m – 7,500m",
    frame: "gulper.1.0",
    species: "gulper",
    scaleFactor: 110,
    description: "Possesses a loosely hinged pouch jaw capable of expanding to swallow organisms several times its own mass in nutrient-scarce ocean depths.",
    adaptation: "Opportunistic Macro-Feeding: Bioluminescent tail organ lures prey into an enormous expandable pouch."
  },
  {
    id: "buoy",
    name: "Autonomous Buoy Relay",
    taxonomy: "Point Nemo Surface Transponder",
    zone: "Pelagic Surface",
    depthRange: "0m – 10m",
    frame: "buoy",
    species: "buoy",
    scaleFactor: 90,
    description: "High-frequency red telemetry beacon anchored at the Oceanic Pole of Inaccessibility, providing orbital positioning sync for diving submersibles.",
    adaptation: "Red Navigation Pulse: Distant reference signal guiding returning explorers through the abyss."
  }
];

export function FieldGuideModal({ isOpen, onClose, bundle }: FieldGuideModalProps) {
  const [selectedId, setSelectedId] = useState(SPECIMENS[0].id);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const specimen = SPECIMENS.find((s) => s.id === selectedId) || SPECIMENS[0];

  useEffect(() => {
    if (!isOpen || !bundle || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Background preview box
    ctx.fillStyle = "#061426";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(66, 104, 135, 0.25)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    try {
      const scale = speciesScale(bundle, specimen.species, specimen.scaleFactor);
      drawFrame(
        ctx,
        bundle,
        specimen.frame,
        Math.round(canvas.width / 2),
        Math.round(canvas.height / 2),
        scale
      );
    } catch (e) {
      console.warn("Could not render specimen preview:", e);
    }
  }, [isOpen, selectedId, bundle, specimen]);

  return (
    <GameModal
      isOpen={isOpen}
      onClose={onClose}
      title="ABYSSAL FIELD LOG & SPECIMEN GUIDE"
      subtitle="BIOLOGICAL TELEMETRY ARCHIVE"
      maxWidth="680px"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <GameButton variant="secondary" size="md" onClick={onClose}>
            RETURN TO EXPLORER
          </GameButton>
        </div>
      }
    >
      <div className="field-guide-layout">
        <nav className="guide-specimen-list" aria-label="Field guide specimen list">
          {SPECIMENS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`specimen-select-tab ${selectedId === s.id ? "is-active" : ""}`}
              onClick={() => setSelectedId(s.id)}
            >
              <span className="specimen-tab-name">{s.name}</span>
              <span className="specimen-tab-meta">{s.zone}</span>
            </button>
          ))}
        </nav>

        <article className="guide-specimen-detail" aria-labelledby="specimen-name">
          <div className="specimen-viewport-wrapper">
            <canvas
              ref={canvasRef}
              width={260}
              height={140}
              className="specimen-canvas pixel-art"
              aria-label={`Visual preview of ${specimen.name}`}
            />
            <div className="specimen-depth-tag">{specimen.depthRange}</div>
          </div>

          <h3 id="specimen-name" className="specimen-name">{specimen.name}</h3>
          <p className="specimen-tax">{specimen.taxonomy}</p>
          <p className="specimen-desc">{specimen.description}</p>

          <div className="specimen-adaptation-card">
            <span className="adaptation-title">HADAL SURVIVAL TRAIT</span>
            <p className="adaptation-desc">{specimen.adaptation}</p>
          </div>
        </article>
      </div>
    </GameModal>
  );
}
