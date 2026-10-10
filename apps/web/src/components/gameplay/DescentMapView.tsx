import { useEffect, useRef, useState, useCallback } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  frameDeltaSeconds,
  drawFrame,
  drawWater,
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
  const [pendingNode, setPendingNode] = useState<number | null>(null);
  const [ignoredNode, setIgnoredNode] = useState<number | null>(null);
  const stepMovingUntilRef = useRef<number>(0);
  const diverAnimsRef = useRef<{
    up: SpriteAnimation;
    down: SpriteAnimation;
    left: SpriteAnimation;
    right: SpriteAnimation;
  } | null>(null);
  const creaturesRef = useRef<SpriteAnimation[] | null>(null);
  const velRef = useRef({ vx: 0, vy: 0 });

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
      if (pendingNode !== null) return;
      const target=e.target as HTMLElement | null;
      if(target?.closest("input,textarea,select,[contenteditable='true']") || e.ctrlKey || e.metaKey || e.altKey)return;
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
  }, [pendingNode]);

  const stepDirection = (direction: "up" | "down" | "left" | "right") => {
    if (instance.activeEncounter || pendingNode !== null) return;
    stepMovingUntilRef.current = performance.now() + 450;
    const impulse = 0.38;
    if (direction === "left") velRef.current.vx = -impulse;
    else if (direction === "right") velRef.current.vx = impulse;
    else if (direction === "up") velRef.current.vy = -impulse;
    else if (direction === "down") velRef.current.vy = impulse;
    playerPosRef.current.facing = direction;
    const target = BASE_ROUTE_POINTS[instance.routeNode];
    if (target) {
      const distance = Math.hypot(playerPosRef.current.x - target.x, playerPosRef.current.y - target.y);
      if (distance < 0.075 && ignoredNode !== instance.routeNode) {
        heldKeysRef.current.clear();
        velRef.current = { vx: 0, vy: 0 };
        setPendingNode(instance.routeNode);
      } else if (distance > 0.085 && ignoredNode === instance.routeNode) {
        setIgnoredNode(null);
      }
    }
  };

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
    let prevTime: number | null = null;
    let elapsed=0;
    const particles=Array.from({length:24},()=>({x:Math.random()*650,y:Math.random()*650,speedY:0.25+Math.random()*0.45,size:Math.random()>0.7?2:1,opacity:0.15+Math.random()*0.35}));
    const diverBubbles: Array<{ x: number; y: number; radius: number; speedY: number; alpha: number; phase: number }> = [];

    // Persistent Creature & Player animations
    if (!creaturesRef.current) {
      creaturesRef.current = [
        new SpriteAnimation(bundle, "barreleye.swim"),
        new SpriteAnimation(bundle, "gulper.swim"),
        new SpriteAnimation(bundle, "fringehead.swim"),
        new SpriteAnimation(bundle, "goblin.idle.profile"),
      ];
    }
    const creatures = creaturesRef.current;

    if (!diverAnimsRef.current) {
      diverAnimsRef.current = {
        up: new SpriteAnimation(bundle, "explorer.swim.up"),
        down: new SpriteAnimation(bundle, "explorer.swim.down"),
        left: new SpriteAnimation(bundle, "explorer.swim.left"),
        right: new SpriteAnimation(bundle, "explorer.swim.right"),
      };
    }
    const diverAnims = diverAnimsRef.current;

    const render = (time: number) => {
      const dt = frameDeltaSeconds(time, prevTime);
      prevTime = time;
      if (!reducedMotion) elapsed += dt;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Process Fluid Player Movement & Inertia
      let dx =
        Number(heldKeysRef.current.has("KeyD") || heldKeysRef.current.has("ArrowRight")) -
        Number(heldKeysRef.current.has("KeyA") || heldKeysRef.current.has("ArrowLeft"));
      let dy =
        Number(heldKeysRef.current.has("KeyS") || heldKeysRef.current.has("ArrowDown")) -
        Number(heldKeysRef.current.has("KeyW") || heldKeysRef.current.has("ArrowUp"));

      const length = Math.hypot(dx, dy);
      const isKeyMoving = length > 0 && !instance.activeEncounter && pendingNode === null;
      const now = performance.now();

      let targetVx = 0;
      let targetVy = 0;
      if (isKeyMoving) {
        targetVx = (dx / length) * 0.48;
        targetVy = (dy / length) * 0.48;
      }

      // Acceleration when actively steering, exponential water drag when drifting
      if (isKeyMoving) {
        const accel = 14 * dt;
        velRef.current.vx += (targetVx - velRef.current.vx) * Math.min(1, accel);
        velRef.current.vy += (targetVy - velRef.current.vy) * Math.min(1, accel);
      } else {
        const drag = Math.pow(0.85, dt * 60);
        velRef.current.vx *= drag;
        velRef.current.vy *= drag;
        if (Math.hypot(velRef.current.vx, velRef.current.vy) < 0.005) {
          velRef.current.vx = 0;
          velRef.current.vy = 0;
        }
      }

      const speed = Math.hypot(velRef.current.vx, velRef.current.vy);
      const isMoving = speed > 0.02 || (stepMovingUntilRef.current > now && !instance.activeEncounter && pendingNode === null);

      if (speed > 0.01) {
        playerPosRef.current.x = Math.max(0.05, Math.min(0.95, playerPosRef.current.x + velRef.current.vx * dt));
        playerPosRef.current.y = Math.max(0.05, Math.min(0.95, playerPosRef.current.y + velRef.current.vy * dt));

        if (Math.abs(velRef.current.vx) > Math.abs(velRef.current.vy) * 0.8) {
          playerPosRef.current.facing = velRef.current.vx < 0 ? "left" : "right";
        } else {
          playerPosRef.current.facing = velRef.current.vy < 0 ? "up" : "down";
        }
      }

      // Check distance to target node (evaluated continuously every frame)
      const target = BASE_ROUTE_POINTS[instance.routeNode];
      if (target && !instance.activeEncounter && pendingNode === null) {
        const dist = Math.hypot(playerPosRef.current.x - target.x, playerPosRef.current.y - target.y);
        if (dist < 0.075) {
          if (ignoredNode !== instance.routeNode) {
            heldKeysRef.current.clear();
            velRef.current = { vx: 0, vy: 0 };
            setPendingNode(instance.routeNode);
          }
        } else if (dist > 0.085) {
          if (ignoredNode === instance.routeNode) {
            setIgnoredNode(null);
          }
        }
      }

      // 2. Draw Animated Water Waves Background (layered over world map)
      ctx.imageSmoothingEnabled = false;
      const waterImg = bundle?.images[bundle.manifest.world.waterAtlas] || bundle?.images?.water;
      if (mapImageRef.current) {
        ctx.drawImage(mapImageRef.current, 0, 0, width, height);
        if (waterImg && !reducedMotion) {
          ctx.save();
          ctx.globalAlpha = 0.22;
          const current = elapsed * 24;
          drawWater(ctx, waterImg, width, height, 320, current, -current * 0.35);
          ctx.restore();
        }
        // Ambient floating marine snow particles
        for (const p of particles) {
          if (!reducedMotion) p.y -= p.speedY * dt * 60;
          if (p.y < 0) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = "#8ec5ec";
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;
      } else if (waterImg) {
        const current = elapsed * 20;
        drawWater(ctx, waterImg, width, height, 320, current, -current * 0.35);

        // Deep ocean gradient tint overlay
        const waterTint = ctx.createLinearGradient(0, 0, 0, height);
        waterTint.addColorStop(0, "#081b30");
        waterTint.addColorStop(1, "#030c18");
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = waterTint;
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;

        // Ambient floating marine snow particles
        for (const p of particles) {
          if(!reducedMotion)p.y -= p.speedY*dt*60;
          if (p.y < 0) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = "#8ec5ec";
          ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        }
        ctx.globalAlpha = 1;
      } else {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, "#061426");
        grad.addColorStop(1, "#0b1e38");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // 3. Draw Route Path Line (only draw up to the active target encounter)
      const pts = BASE_ROUTE_POINTS.map((p) => ({
        x: p.x * width,
        y: p.y * height,
      }));

      ctx.lineDashOffset = -elapsed * 15;
      for (let i = 1; i <= Math.min(instance.routeNode, pts.length - 1); i++) {
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);

        ctx.setLineDash([8, 10]);
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(3, width * 0.006);

        const isPast = i < instance.routeNode;
        const isCurrent = i === instance.routeNode;

        ctx.strokeStyle = isPast
          ? "rgba(48, 214, 242, 0.4)"
          : isCurrent
          ? "rgba(220, 249, 255, 0.95)"
          : "rgba(66, 104, 135, 0.25)";

        if (isCurrent) {
          ctx.shadowColor = "rgba(48, 214, 242, 0.8)";
          ctx.shadowBlur = 8;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // 4a. Animate Origin Buoy wave ripples & draw buoy sprite at the center point (Point Nemo)
      const originPt = pts[0];
      const s = width / 650;
      ctx.save();

      // Animated concentric water ripples emanating from buoy base
      for (let r = 0; r < 3; r++) {
        const progress = ((elapsed * 0.8 + r / 3) % 1);
        const rx = (20 + progress * 32) * s;
        const ry = rx * 0.42;
        const alpha = (1 - progress) * 0.55;
        ctx.beginPath();
        ctx.ellipse(originPt.x, originPt.y + 12 * s, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 80, 95, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw the autonomous buoy sprite fixed at the center point
      const buoyScale = speciesScale(bundle, "buoy", 74) * s;
      if(!mapImageRef.current)drawFrame(ctx, bundle, "buoy", originPt.x, originPt.y, buoyScale);

      // Red beacon light pulse at the buoy tip
      const beaconPhase = (elapsed * 3) % (Math.PI * 2);
      const pulseR = (10 + Math.sin(beaconPhase) * 4) * s;
      const pulseAlpha = 0.25 + Math.sin(beaconPhase) * 0.15;
      ctx.beginPath();
      ctx.arc(originPt.x, originPt.y - 30 * s, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 72, 83, ${pulseAlpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(originPt.x, originPt.y - 30 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = "#ff4853";
      ctx.shadowColor = "#ff4853";
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Clean label below the buoy without dark covering circle
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#30d6f2";
      ctx.fillText("POINT NEMO", originPt.x, originPt.y + 36 * s);
      ctx.restore();

      // 4b. Draw Waypoint Creature Markers (only current active and accomplished encounters)
      for (let m = 1; m <= 4; m++) {
        // Fog of war: Hide future encounters until the current level is accomplished
        if (m > instance.routeNode) continue;

        const marker = pts[m];
        const creature = creatures[m - 1];
        if (!reducedMotion) creature.update(dt);

        const isCurrent = m === instance.routeNode;
        const isPast = m < instance.routeNode;
        const markerSway = !reducedMotion ? Math.sin(elapsed * 2.2 + m * 1.5) * (3.5 * s) : 0;
        const markerY = marker.y + markerSway;

        ctx.save();
        ctx.globalAlpha = isPast ? 0.45 : 1.0;

        // Glowing circle under marker
        ctx.beginPath();
        ctx.arc(marker.x, markerY, Math.max(24, width * 0.05), 0, Math.PI * 2);
        ctx.fillStyle = isCurrent ? "rgba(48, 214, 242, 0.35)" : "rgba(6, 20, 38, 0.45)";
        ctx.strokeStyle = isCurrent ? "#d7f6ff" : "rgba(48, 214, 242, 0.4)";
        ctx.lineWidth = isCurrent ? 3 : 1;
        ctx.fill();
        ctx.stroke();

        // Creature sprite
        const creatureSpecies =
          m === 1 ? "barreleye" : m === 2 ? "gulper" : m === 3 ? "fringehead" : "goblin";
        const creatureScale = speciesScale(bundle, creatureSpecies, 58) * (width / 600);
        drawFrame(ctx, bundle, creature.frameName, marker.x, markerY, creatureScale);

        // Marker label
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isCurrent ? "#30d6f2" : "#7ea0b8";
        const rawLabel = lesson.topics[m] || BASE_ROUTE_POINTS[m].label;
        const stopLabel = isPast ? `✓ ${rawLabel.toUpperCase()}` : rawLabel.toUpperCase();
        ctx.fillText(stopLabel, marker.x, markerY + width * 0.058);
        ctx.restore();
      }

      // Advance synchronized swimming stroke cycle across all directions
      if (!reducedMotion) {
        const strokeDt = isMoving ? dt * 1.35 : dt * 0.45;
        diverAnims.up.update(strokeDt);
        diverAnims.down.update(strokeDt);
        diverAnims.left.update(strokeDt);
        diverAnims.right.update(strokeDt);
      }

      // 5. Draw Player Diver with hydrodynamic pitch tilt & synchronized strokes
      const activeDiverAnim = diverAnims[playerPosRef.current.facing];
      const pScale = speciesScale(bundle, "explorer", 64) * (width / 600);
      const idleBob = !reducedMotion && !isMoving ? Math.sin(elapsed * 2.8) * (3.5 * s) : 0;
      const px = Math.round(playerPosRef.current.x * width);
      const py = Math.round(playerPosRef.current.y * height + idleBob);

      // Scuba regulator bubble exhalations with momentum drift
      if (!reducedMotion) {
        if (Math.random() < (isMoving ? 0.09 : 0.035) && diverBubbles.length < 16) {
          diverBubbles.push({
            x: px + (Math.random() * 8 - 4) * s - velRef.current.vx * 15 * s,
            y: py - 12 * s,
            radius: (1.2 + Math.random() * 1.8) * s,
            speedY: (20 + Math.random() * 25) * s,
            alpha: 0.75 + Math.random() * 0.2,
            phase: Math.random() * Math.PI * 2,
          });
        }
        for (let b = diverBubbles.length - 1; b >= 0; b--) {
          const bub = diverBubbles[b];
          bub.y -= bub.speedY * dt;
          bub.x += Math.sin(elapsed * 4 + bub.phase) * (6 * dt * s);
          bub.alpha -= dt * 0.4;
          if (bub.alpha <= 0 || bub.y < 0) {
            diverBubbles.splice(b, 1);
            continue;
          }
          ctx.save();
          ctx.beginPath();
          ctx.arc(bub.x, bub.y, bub.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(180, 240, 255, ${Math.max(0, bub.alpha * 0.6)})`;
          ctx.strokeStyle = `rgba(215, 246, 255, ${Math.max(0, bub.alpha)})`;
          ctx.lineWidth = 1;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // Visor cyan glow halo
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py - 4 * s, 12 * s, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(48, 214, 242, ${0.12 + Math.sin(elapsed * 3) * 0.06})`;
      ctx.fill();
      ctx.restore();

      // Hydrodynamic swimming pitch tilt
      let swimTilt = 0;
      if (!reducedMotion) {
        if (playerPosRef.current.facing === "right") {
          swimTilt = velRef.current.vy * 0.28 + Math.sin(activeDiverAnim.elapsed * 4.2) * 0.04;
        } else if (playerPosRef.current.facing === "left") {
          swimTilt = -velRef.current.vy * 0.28 - Math.sin(activeDiverAnim.elapsed * 4.2) * 0.04;
        } else if (playerPosRef.current.facing === "up" || playerPosRef.current.facing === "down") {
          swimTilt = velRef.current.vx * 0.22;
        }
      }

      ctx.save();
      ctx.translate(px, py);
      if (swimTilt !== 0) {
        ctx.rotate(swimTilt);
      }
      activeDiverAnim.draw(ctx, 0, 0, pScale);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      onUpdatePlayer(
        playerPosRef.current.x,
        playerPosRef.current.y,
        playerPosRef.current.facing
      );
    };
  }, [bundle, mapLoaded, instance.routeNode, instance.activeEncounter, pendingNode, ignoredNode, lesson, reducedMotion, onReachTarget, onUpdatePlayer]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (pendingNode !== null || instance.activeEncounter) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;
    const target = BASE_ROUTE_POINTS[instance.routeNode];
    if (target) {
      const dist = Math.hypot(clickX - target.x, clickY - target.y);
      if (dist < 0.12) {
        heldKeysRef.current.clear();
        setIgnoredNode(null);
        setPendingNode(instance.routeNode);
      }
    }
  };

  const activeTopic = lesson.topics[instance.routeNode] || "Encounter";

  return (
    <section className="descent-route panel" aria-labelledby="route-title">
      <div className="route-heading">
        <div>
          <p className="eyebrow">
            STUDY LESSON · <span>{instance.id}</span>
          </p>
          <h2 id="route-title">{lesson.title} — Study Map</h2>
        </div>
        <span id="route-position">
          {instance.routeNode === 4
            ? "FINAL CHALLENGE · REVIEW QUIZ"
            : `CURRENT GOAL · TOPIC ${instance.routeNode} OF 3`}
        </span>
      </div>

      <div className="route-scene">
        <canvas
          ref={canvasRef}
          width={650}
          height={650}
          className="pixel-scene"
          onClick={handleCanvasClick}
          aria-label="Interactive study map. Use W, A, S, D to move to the highlighted quiz marker."
          tabIndex={0}
        />
        {pendingNode !== null && (
          <div className="encounter-confirm-overlay">
            <div className="encounter-confirm-card">
              <p className="eyebrow">QUIZ READY</p>
              <h3>Ready for this question?</h3>
              <p>
                {pendingNode <= 3
                  ? `You've reached the ${lesson.topics[pendingNode] || "quiz"} challenge.`
                  : "You've reached the Final Review Quiz."}
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    heldKeysRef.current.clear();
                    onUpdatePlayer(
                      playerPosRef.current.x,
                      playerPosRef.current.y,
                      playerPosRef.current.facing
                    );
                    onReachTarget(pendingNode);
                    setPendingNode(null);
                  }}
                >
                  Start Question ▶
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    heldKeysRef.current.clear();
                    setIgnoredNode(pendingNode);
                    setPendingNode(null);
                    setTimeout(() => setIgnoredNode(null), 1200);
                  }}
                >
                  Not Yet
                </button>
              </div>
            </div>
          </div>
        )}
        {pendingNode === null && (
          <span className="route-depth-label">STUDY MAP · USE WASD TO MOVE</span>
        )}
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
          style={{ width: "44px", height: "44px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("up", true)}
          onPointerUp={() => handleVirtualDirection("up", false)}
          onPointerLeave={() => handleVirtualDirection("up", false)}
          onPointerCancel={() => handleVirtualDirection("up", false)}
          onClick={()=>stepDirection("up")}
          aria-label="Swim Up"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <polygon points="8,3 13,13 3,13" />
          </svg>
        </button>
        <button
          type="button"
          className="secondary-button"
          style={{ width: "44px", height: "44px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("left", true)}
          onPointerUp={() => handleVirtualDirection("left", false)}
          onPointerLeave={() => handleVirtualDirection("left", false)}
          onPointerCancel={() => handleVirtualDirection("left", false)}
          onClick={()=>stepDirection("left")}
          aria-label="Swim Left"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <polygon points="3,8 13,3 13,13" />
          </svg>
        </button>
        <button
          type="button"
          className="secondary-button"
          style={{ width: "44px", height: "44px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("down", true)}
          onPointerUp={() => handleVirtualDirection("down", false)}
          onPointerLeave={() => handleVirtualDirection("down", false)}
          onPointerCancel={() => handleVirtualDirection("down", false)}
          onClick={()=>stepDirection("down")}
          aria-label="Swim Down"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <polygon points="8,13 13,3 3,3" />
          </svg>
        </button>
        <button
          type="button"
          className="secondary-button"
          style={{ width: "44px", height: "44px", padding: 0 }}
          onPointerDown={() => handleVirtualDirection("right", true)}
          onPointerUp={() => handleVirtualDirection("right", false)}
          onPointerLeave={() => handleVirtualDirection("right", false)}
          onPointerCancel={() => handleVirtualDirection("right", false)}
          onClick={()=>stepDirection("right")}
          aria-label="Swim Right"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <polygon points="13,8 3,3 3,13" />
          </svg>
        </button>
      </div>

      <ol className="route-stops" aria-label="Sequential lesson checkpoints">
        <li className={instance.routeNode === 0 ? "current" : "complete"}>
          <span>01</span>
          <b>Point Nemo</b>
          <small>Start Point</small>
        </li>
        <li className={instance.routeNode === 1 ? "current" : instance.routeNode > 1 ? "complete" : "locked"}>
          <span>02</span>
          <b>{instance.routeNode >= 1 ? (lesson.topics[1] || "Topic 1") : "???"}</b>
          <small>{instance.routeNode > 1 ? "Cleared ✓" : instance.routeNode === 1 ? "In Progress" : "Locked"}</small>
        </li>
        <li className={instance.routeNode === 2 ? "current" : instance.routeNode > 2 ? "complete" : "locked"}>
          <span>03</span>
          <b>{instance.routeNode >= 2 ? (lesson.topics[2] || "Topic 2") : "???"}</b>
          <small>{instance.routeNode > 2 ? "Cleared ✓" : instance.routeNode === 2 ? "In Progress" : "Locked"}</small>
        </li>
        <li className={instance.routeNode === 3 ? "current" : instance.routeNode > 3 ? "complete" : "locked"}>
          <span>04</span>
          <b>{instance.routeNode >= 3 ? (lesson.topics[3] || "Topic 3") : "???"}</b>
          <small>{instance.routeNode > 3 ? "Cleared ✓" : instance.routeNode === 3 ? "In Progress" : "Locked"}</small>
        </li>
        <li className={instance.routeNode === 4 ? "current" : "locked"}>
          <span>05</span>
          <b>{instance.routeNode >= 4 ? "Final Quiz" : "???"}</b>
          <small>{instance.routeNode >= 4 ? "Review All" : "Locked"}</small>
        </li>
      </ol>

      <div className="route-controls">
        <span id="route-status">
          {instance.routeNode === 4
            ? "All 3 topics completed! Swim to the final marker to take your review quiz."
            : `Move to the highlighted ${activeTopic} marker to start your quiz. Answer correctly to unlock the next topic.`}
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
