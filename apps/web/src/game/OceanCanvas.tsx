import { useEffect, useRef, useCallback } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  frameDeltaSeconds,
  speciesScale,
  drawWater,
  drawFrame,
} from "./sprites";

export interface OceanCanvasProps {
  bundle: AssetBundle;
  depthMeters: number;
  onDepthChange?: (depth: number) => void;
  sonarTriggerCount: number;
  onEncounterTrigger?: (creature: string) => void;
  paused?: boolean;
  reducedMotion?: boolean;
}

interface PlayerState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  direction: "down" | "left" | "right" | "up";
  isMoving: boolean;
  speed: number;
}

interface CreatureState {
  id: string;
  name: string;
  xRatio: number;
  yRatio: number;
  phase: number;
  sway: number;
  swimRate: number;
  animation: SpriteAnimation;
  scale: number;
}

export function OceanCanvas({
  bundle,
  depthMeters,
  onDepthChange,
  sonarTriggerCount,
  onEncounterTrigger,
  paused = false,
  reducedMotion = false,
}: OceanCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Entities state
  const playerRef = useRef<PlayerState>({
    x: 320,
    y: 280,
    targetX: 320,
    targetY: 280,
    direction: "down",
    isMoving: false,
    speed: 120,
  });

  const buoyPosRef = useRef({ x: 580, y: 190 });
  const sonarWavesRef = useRef<Array<{ x: number; y: number; radius: number; maxRadius: number; opacity: number }>>([]);
  const lastSonarCountRef = useRef(sonarTriggerCount);

  // Create sprite animations
  const animationsRef = useRef<{
    explorerDown: SpriteAnimation;
    explorerUp: SpriteAnimation;
    explorerLeft: SpriteAnimation;
    explorerRight: SpriteAnimation;
    explorerScale: number;
    buoyScale: number;
    creatures: CreatureState[];
  } | null>(null);

  useEffect(() => {
    if (!bundle) return;

    const explorerScale = speciesScale(bundle, "explorer", 74);
    const buoyScale = speciesScale(bundle, "buoy", 110);
    const creatures: Array<Omit<CreatureState, "animation" | "scale"> & { species: string; animationName: string; spriteSize: number }> = [
      { id: "blobfish-1", name: "Blobfish", species: "blobfish", animationName: "blobfish.swim.down", spriteSize: 58, xRatio: 0.22, yRatio: 0.7, phase: 0.3, sway: 26, swimRate: 0.34 },
      { id: "barreleye-1", name: "Barreleye", species: "barreleye", animationName: "barreleye.swim", spriteSize: 58, xRatio: 0.72, yRatio: 0.29, phase: 1.7, sway: 34, swimRate: 0.29 },
      { id: "gulper-1", name: "Gulper Eel", species: "gulper", animationName: "gulper.swim", spriteSize: 70, xRatio: 0.87, yRatio: 0.62, phase: 2.9, sway: 24, swimRate: 0.24 },
      { id: "goblin-1", name: "Goblin Shark", species: "goblin", animationName: "goblin.swim", spriteSize: 72, xRatio: 0.57, yRatio: 0.77, phase: 4.1, sway: 38, swimRate: 0.22 },
      { id: "fringehead-1", name: "Fringehead", species: "fringehead", animationName: "fringehead.swim", spriteSize: 62, xRatio: 0.36, yRatio: 0.2, phase: 5.2, sway: 30, swimRate: 0.31 },
    ];

    animationsRef.current = {
      explorerDown: new SpriteAnimation(bundle, "explorer.swim.down"),
      explorerUp: new SpriteAnimation(bundle, "explorer.swim.up"),
      explorerLeft: new SpriteAnimation(bundle, "explorer.swim.left"),
      explorerRight: new SpriteAnimation(bundle, "explorer.swim.right"),
      explorerScale,
      buoyScale,
      creatures: creatures.map(({ species, animationName, spriteSize, ...creature }) => ({
        ...creature,
        animation: new SpriteAnimation(bundle, animationName),
        scale: speciesScale(bundle, species, spriteSize),
      })),
    };
  }, [bundle]);

  // Handle Sonar trigger
  useEffect(() => {
    if (sonarTriggerCount > lastSonarCountRef.current) {
      lastSonarCountRef.current = sonarTriggerCount;
      const player = playerRef.current;
      sonarWavesRef.current.push({
        x: player.x,
        y: player.y,
        radius: 10,
        maxRadius: 280,
        opacity: 1,
      });
    }
  }, [sonarTriggerCount]);

  // Handle keyboard movement
  useEffect(() => {
    const keysPressed = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(e.key)) {
        // Prevent scrolling with arrows inside canvas
        if (document.activeElement === canvasRef.current) {
          e.preventDefault();
        }
        keysPressed.add(e.key.toLowerCase());
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let moveInterval = window.setInterval(() => {
      if (paused) return;
      const player = playerRef.current;
      let dx = 0;
      let dy = 0;

      if (keysPressed.has("arrowup") || keysPressed.has("w")) dy -= 1;
      if (keysPressed.has("arrowdown") || keysPressed.has("s")) dy += 1;
      if (keysPressed.has("arrowleft") || keysPressed.has("a")) dx -= 1;
      if (keysPressed.has("arrowright") || keysPressed.has("d")) dx += 1;

      if (dx !== 0 || dy !== 0) {
        const mag = Math.hypot(dx, dy);
        const step = (player.speed * 0.05) / mag;
        player.x += dx * step;
        player.y += dy * step;
        player.targetX = player.x;
        player.targetY = player.y;
        player.isMoving = true;

        if (dy > 0 && onDepthChange) {
          onDepthChange(Math.min(10935, depthMeters + 1));
        } else if (dy < 0 && onDepthChange) {
          onDepthChange(Math.max(0, depthMeters - 1));
        }

        if (Math.abs(dx) > Math.abs(dy)) {
          player.direction = dx > 0 ? "right" : "left";
        } else {
          player.direction = dy > 0 ? "down" : "up";
        }
      } else if (Math.hypot(player.targetX - player.x, player.targetY - player.y) > 4) {
        // Moving toward target tap
        const toX = player.targetX - player.x;
        const toY = player.targetY - player.y;
        const dist = Math.hypot(toX, toY);
        const step = Math.min(dist, player.speed * 0.05);
        player.x += (toX / dist) * step;
        player.y += (toY / dist) * step;
        player.isMoving = true;

        if (Math.abs(toX) > Math.abs(toY)) {
          player.direction = toX > 0 ? "right" : "left";
        } else {
          player.direction = toY > 0 ? "down" : "up";
        }
      } else {
        player.isMoving = false;
      }
    }, 50);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      clearInterval(moveInterval);
    };
  }, [paused]);

  // Canvas Click / Tap movement
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    playerRef.current.targetX = cssX;
    playerRef.current.targetY = cssY;
  }, []);

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animId: number;
    let lastTime: number | null = null;
    let beaconPhase = 0;
    let worldTime = 0;

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const dt = frameDeltaSeconds(now, lastTime);
      lastTime = now;
      if (!paused && !reducedMotion) worldTime += dt;

      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth || 800;
      const cssHeight = canvas.clientHeight || 500;

      // Handle backing resolution
      const targetWidth = Math.round(cssWidth * dpr);
      const targetHeight = Math.round(cssHeight * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = false;

      // 1. WATER (mirrored repeat)
      // Slight camera drift based on player or time
      const camX = Math.round(playerRef.current.x * 0.2);
      const camY = Math.round(playerRef.current.y * 0.2);
      const currentDrift = reducedMotion ? 0 : worldTime * 2;
      drawWater(ctx, bundle.images.water, cssWidth, cssHeight, 320, camX + currentDrift, camY - currentDrift * 0.4);

      // Deep ocean vignette overlay
      ctx.fillStyle = "rgba(6, 20, 38, 0.4)";
      ctx.fillRect(0, 0, cssWidth, cssHeight);

      // Depth watermark in canvas
      ctx.font = "10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(66, 104, 135, 0.4)";
      ctx.fillText(`HADAL TELEMETRY: ${depthMeters}M`, 14, cssHeight - 14);

      const anims = animationsRef.current;
      if (anims) {
        // 2. WORLD OBJECTS: RED NAVIGATION BUOY
        const buoy = buoyPosRef.current;
        const buoyScale = anims.buoyScale;

        // Faint beacon pulse behind buoy
        if (!reducedMotion) {
          beaconPhase = (beaconPhase + dt * 1.5) % (Math.PI * 2);
          const pulseRadius = 18 + Math.sin(beaconPhase) * 6;
          const pulseAlpha = 0.25 + Math.sin(beaconPhase) * 0.15;
          ctx.beginPath();
          ctx.arc(buoy.x, buoy.y - 30, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255, 72, 83, ${pulseAlpha})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Beacon core glow
          ctx.beginPath();
          ctx.arc(buoy.x, buoy.y - 30, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#ff4853";
          ctx.fill();
        }

        drawFrame(ctx, bundle, "buoy", buoy.x, buoy.y, buoyScale);

        // 3. ENEMIES: Blobfish & deep-sea life
        for (const creature of anims.creatures) {
          if (!paused && !reducedMotion) {
            creature.animation.update(dt);
          }
          const x = cssWidth * creature.xRatio + Math.sin(worldTime * creature.swimRate + creature.phase) * creature.sway;
          const y = cssHeight * creature.yRatio + Math.cos(worldTime * creature.swimRate * 0.7 + creature.phase) * 8;
          creature.animation.draw(ctx, Math.round(x), Math.round(y), creature.scale);

          // Check proximity for encounter notification
          const distToPlayer = Math.hypot(playerRef.current.x - x, playerRef.current.y - y);
          if (distToPlayer < 45 && onEncounterTrigger) {
            onEncounterTrigger(creature.name);
          }
        }

        // 4. CHARACTERS: Small Explorer with cyan visor
        const player = playerRef.current;
        let activeAnim = anims.explorerDown;
        if (player.direction === "up") activeAnim = anims.explorerUp;
        else if (player.direction === "left") activeAnim = anims.explorerLeft;
        else if (player.direction === "right") activeAnim = anims.explorerRight;

        if (player.isMoving && !paused && !reducedMotion) {
          activeAnim.update(dt);
        }

        // Visor cyan glow effect under water
        if (!reducedMotion) {
          ctx.beginPath();
          ctx.arc(player.x, player.y - 12, 14, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(48, 214, 242, 0.12)";
          ctx.fill();
        }

        activeAnim.draw(ctx, player.x, player.y, anims.explorerScale);

        // 5. SONAR WAVE EFFECTS
        for (let i = sonarWavesRef.current.length - 1; i >= 0; i--) {
          const wave = sonarWavesRef.current[i];
          wave.radius += dt * 240;
          wave.opacity = Math.max(0, 1 - wave.radius / wave.maxRadius);

          ctx.beginPath();
          ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(48, 214, 242, ${wave.opacity * 0.75})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          if (wave.radius >= wave.maxRadius) {
            sonarWavesRef.current.splice(i, 1);
          }
        }
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bundle, paused, reducedMotion, onEncounterTrigger]);

  return (
    <div className="ocean-viewport" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        className="ocean-canvas pixel-art"
        tabIndex={0}
        role="region"
        aria-label="Interactive ocean exploration scene. Use arrow keys or WASD to navigate explorer. Tap ocean to steer."
        onPointerDown={handlePointerDown}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          touchAction: "none",
          cursor: "crosshair",
        }}
      />
    </div>
  );
}
