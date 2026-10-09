import { useEffect, useRef, useState, useCallback } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  drawFrame,
  speciesScale,
} from "../../game/sprites";
import {
  type DescentInstance,
  type LessonRecord,
  BASE_ROUTE_POINTS,
} from "../../game/lessonCatalog";

interface DescentMapViewProps {
  instance: DescentInstance;
  lesson: LessonRecord;
  bundle: AssetBundle | null;
  onReachTarget: (nodeIndex: number) => void;
  onUpdatePlayer: (x: number, y: number, facing: "up" | "down" | "left" | "right") => void;
  reducedMotion?: boolean;
}

export function DescentMapView({
  instance,
  lesson,
  bundle,
  onReachTarget,
  onUpdatePlayer,
  reducedMotion = false,
}: DescentMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heldKeysRef = useRef<Set<string>>(new Set());
  const playerPosRef = useRef({ ...instance.player });
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Synchronize internal ref with external instance player state
  useEffect(() => {
    playerPosRef.current = { ...instance.player };
  }, [instance.id]);

  // Load world map image
  useEffect(() => {
    const img = new Image();
    img.src = "/assets/maps/point-nemo-abyss-ocean.png";
    img.onload = () => {
      mapImageRef.current = img;
      setMapLoaded(true);
    };
    img.onerror = () => {
      console.warn("World map failed to load, using canvas fallback gradient");
      setMapLoaded(true);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        code === "KeyW" ||
        code === "KeyA" ||
        code === "KeyS" ||
        code === "KeyD" ||
        code.startsWith("Arrow")
      ) {
        e.preventDefault();
        heldKeysRef.current.add(code);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    const handleBlur = () => {
      heldKeysRef.current.clear();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Virtual D-pad for mobile / touch accessibility
  const handleVirtualDirection = useCallback((dir: "up" | "down" | "left" | "right", active: boolean) => {
    const codeMap: Record<string, string> = {
      up: "KeyW",
      down: "KeyS",
      left: "KeyA",
      right: "KeyD",
    };
    const code = codeMap[dir];
    if (active) {
      heldKeysRef.current.add(code);
    } else {
      heldKeysRef.current.delete(code);
    }
  }, []);

  // Canvas render & animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle || !mapLoaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let prevTime = performance.now();

    // Creature animations
    const creatures = [
      new SpriteAnimation(bundle, "barreleye.swim"),
      new SpriteAnimation(bundle, "gulper.swim"),
      new SpriteAnimation(bundle, "fringehead.swim"),
      new SpriteAnimation(bundle, "goblin.idle.profile"),
    ];
    const playerAnim = new SpriteAnimation(bundle, "explorer.idle.up");

    const render = (time: number) => {
      const dt = Math.min((time - prevTime) / 1000, 0.1);
      prevTime = time;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Process Player Movement
      let dx =
        Number(heldKeysRef.current.has("KeyD") || heldKeysRef.current.has("ArrowRight")) -
        Number(heldKeysRef.current.has("KeyA") || heldKeysRef.current.has("ArrowLeft"));
      let dy =
        Number(heldKeysRef.current.has("KeyS") || heldKeysRef.current.has("ArrowDown")) -
        Number(heldKeysRef.current.has("KeyW") || heldKeysRef.current.has("ArrowUp"));

      const length = Math.hypot(dx, dy);
      const isMoving = length > 0 && !instance.activeEncounter;

      if (isMoving) {
        dx /= length;
        dy /= length;
        const speed = 0.24 * dt;
        playerPosRef.current.x = Math.max(0.05, Math.min(0.95, playerPosRef.current.x + dx * speed));
        playerPosRef.current.y = Math.max(0.05, Math.min(0.95, playerPosRef.current.y + dy * speed));

        if (Math.abs(dx) > Math.abs(dy)) {
          playerPosRef.current.facing = dx < 0 ? "left" : "right";
        } else {
          playerPosRef.current.facing = dy < 0 ? "up" : "down";
        }

        onUpdatePlayer(
          playerPosRef.current.x,
          playerPosRef.current.y,
          playerPosRef.current.facing
        );

        // Check distance to target node
        const target = BASE_ROUTE_POINTS[instance.routeNode];
        if (target && !instance.activeEncounter) {
          const dist = Math.hypot(playerPosRef.current.x - target.x, playerPosRef.current.y - target.y);
          if (dist < 0.07) {
            heldKeysRef.current.clear();
            onReachTarget(instance.routeNode);
          }
        }
      }

      // 2. Draw World Map Background
      ctx.imageSmoothingEnabled = false;
      if (mapImageRef.current) {
        ctx.drawImage(mapImageRef.current, 0, 0, width, height);
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, "#061426");
        grad.addColorStop(1, "#0b1e38");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Draw Route Path Line
      const pts = BASE_ROUTE_POINTS.map((p) => ({
        x: p.x * width,
        y: p.y * height,
      }));

      for (let i = 1; i < pts.length; i++) {
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = Math.max(2, width * 0.005);
        ctx.strokeStyle =
          i < instance.routeNode
            ? "rgba(48, 214, 242, 0.85)"
            : i === instance.routeNode
            ? "rgba(220, 249, 255, 0.95)"
            : "rgba(66, 104, 135, 0.35)";
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // 4. Draw Waypoint Creature Markers
      for (let m = 1; m <= 4; m++) {
        const marker = pts[m];
        const creature = creatures[m - 1];
        if (!reducedMotion) creature.update(dt);

        const isCurrent = m === instance.routeNode;
        const isPast = m < instance.routeNode;

        ctx.save();
        ctx.globalAlpha = isPast ? 0.35 : isCurrent ? 1.0 : 0.55;

        // Glowing circle under marker
        ctx.beginPath();
        ctx.arc(marker.x, marker.y, Math.max(24, width * 0.05), 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? "rgba(48, 214, 242, 0.35)" : "rgba(6, 20, 38, 0.55)";
        ctx.strokeStyle = isCurrent ? "#d7f6ff" : "rgba(66, 104, 135, 0.6)";
        ctx.lineWidth = isCurrent ? 3 : 1;
        ctx.fill();
        ctx.stroke();

        // Creature sprite
        const creatureSpecies =
          m === 1 ? "barreleye" : m === 2 ? "gulper" : m === 3 ? "fringehead" : "goblin";
        const creatureScale = speciesScale(bundle, creatureSpecies, 58) * (width / 600);
        drawFrame(ctx, bundle, creature.frameName, marker.x, marker.y, creatureScale);

        // Marker label
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isCurrent ? "#30d6f2" : "#eaf4fc";
        const stopLabel = lesson.topics[m] || BASE_ROUTE_POINTS[m].label;
        ctx.fillText(stopLabel.toUpperCase(), marker.x, marker.y + width * 0.058);
        ctx.restore();
      }

      // 5. Draw Player Diver
      const playerAnimName = `explorer.${isMoving && !reducedMotion ? "swim" : "idle"}.${playerPosRef.current.facing}`;
      playerAnim.play(playerAnimName);
      if (!reducedMotion) playerAnim.update(dt);

      const pScale = speciesScale(bundle, "explorer", 64) * (width / 600);
      const px = Math.round(playerPosRef.current.x * width);
      const py = Math.round(playerPosRef.current.y * height);
      playerAnim.draw(ctx, px, py, pScale);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bundle, mapLoaded, instance.routeNode, instance.activeEncounter, lesson, reducedMotion, onReachTarget, onUpdatePlayer]);

  const activeTopic = lesson.topics[instance.routeNode] || "Encounter";

  return (
    <section className="descent-route panel" aria-labelledby="route-title">
      <div className="route-heading">
        <div>
          <p className="eyebrow">
            INDEPENDENT RUN · <span>{instance.id}</span>
          </p>
          <h2 id="route-title">{lesson.title} — Descent Map</h2>
        </div>
        <span id="route-position">
          {instance.routeNode === 4
            ? "FINAL TARGET · LESSON BOSS"
            : `NEXT OBJECTIVE · PART ${instance.routeNode} OF 3`}
        </span>
      </div>

      <div className="route-scene">
        <canvas
          ref={canvasRef}
          width={650}
          height={650}
          className="pixel-scene"
          aria-label="Ocean descent world map. Use W, A, S, D to swim to the highlighted creature marker."
          tabIndex={0}
        />
        <span className="route-depth-label">WORLD MAP · WASD TO SWIM</span>
      </div>

      {/* On-screen Directional Touch Controls for mobile/accessibility */}
      <div
        className="mobile-dpad-container"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          margin: "8px 0 12px",
        }}
      >
        <button
          type="button"
          className="secondary-button"
          style={{ width: "42px", height: "38px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("up", true)}
          onPointerUp={() => handleVirtualDirection("up", false)}
          onPointerLeave={() => handleVirtualDirection("up", false)}
          aria-label="Swim Up"
        >
          ▲
        </button>
        <button
          type="button"
          className="secondary-button"
          style={{ width: "42px", height: "38px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("left", true)}
          onPointerUp={() => handleVirtualDirection("left", false)}
          onPointerLeave={() => handleVirtualDirection("left", false)}
          aria-label="Swim Left"
        >
          ◀
        </button>
        <button
          type="button"
          className="secondary-button"
          style={{ width: "42px", height: "38px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("down", true)}
          onPointerUp={() => handleVirtualDirection("down", false)}
          onPointerLeave={() => handleVirtualDirection("down", false)}
          aria-label="Swim Down"
        >
          ▼
        </button>
        <button
          type="button"
          className="secondary-button"
          style={{ width: "42px", height: "38px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("right", true)}
          onPointerUp={() => handleVirtualDirection("right", false)}
          onPointerLeave={() => handleVirtualDirection("right", false)}
          aria-label="Swim Right"
        >
          ▶
        </button>
      </div>

      <ol className="route-stops" aria-label="Sequential lesson checkpoints">
        <li className={instance.routeNode === 0 ? "current" : "complete"}>
          <span>01</span>
          <b>Point Nemo</b>
          <small>Origin Buoy</small>
        </li>
        <li className={instance.routeNode === 1 ? "current" : instance.routeNode > 1 ? "complete" : "locked"}>
          <span>02</span>
          <b>{lesson.topics[1] || "Part 1"}</b>
          <small>Encounter 1</small>
        </li>
        <li className={instance.routeNode === 2 ? "current" : instance.routeNode > 2 ? "complete" : "locked"}>
          <span>03</span>
          <b>{lesson.topics[2] || "Part 2"}</b>
          <small>Encounter 2</small>
        </li>
        <li className={instance.routeNode === 3 ? "current" : instance.routeNode > 3 ? "complete" : "locked"}>
          <span>04</span>
          <b>{lesson.topics[3] || "Part 3"}</b>
          <small>Encounter 3</small>
        </li>
        <li className={instance.routeNode === 4 ? "current" : "locked"}>
          <span>05</span>
          <b>Lesson Boss</b>
          <small>Final Review</small>
        </li>
      </ol>

      <div className="route-controls">
        <span id="route-status">
          {instance.routeNode === 4
            ? "All three topics clear. Swim to the Goblin Shark marker for the final boss review."
            : `Swim to the highlighted ${activeTopic} marker. Subsequent markers unlock upon clearing this encounter.`}
        </span>
        <span className="key-hints">
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> MOVE
        </span>
      </div>
    </section>
  );
}
