import { useEffect, useRef } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  drawFrame,
  speciesScale,
} from "../../game/sprites";

interface OceanAmbientBackgroundProps {
  bundle: AssetBundle | null;
  reducedMotion?: boolean;
  theme?: "light" | "dark";
}

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  phase: number;
  alpha: number;
}

export function OceanAmbientBackground({
  bundle,
  reducedMotion = false,
  theme = "light",
}: OceanAmbientBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let prev = performance.now();

    // Explorer Diver animations
    const diverRight = new SpriteAnimation(bundle, "explorer.swim.right");
    const diverLeft = new SpriteAnimation(bundle, "explorer.swim.left");

    // Fish animations
    const barreleyeAnim = new SpriteAnimation(bundle, "barreleye.swim");
    
    // Optional second creature: Dumbo octopus or Anglerfish if available
    let dumboAnim: SpriteAnimation | null = null;
    try {
      dumboAnim = new SpriteAnimation(bundle, "dumbo.swim");
    } catch {
      // Dumbo optional
    }

    // Set canvas dimensions to match viewport
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Initial Diver state
    const diver = {
      x: window.innerWidth * 0.15,
      y: window.innerHeight * 0.45,
      targetY: window.innerHeight * 0.45,
      speed: 48, // pixels per second
      facing: "right" as "left" | "right",
      baseY: window.innerHeight * 0.45,
      bobPhase: 0,
      scale: speciesScale(bundle, "explorer", 64),
    };

    // Initial Barreleye Fish state
    const barreleye = {
      x: window.innerWidth * 0.85,
      y: window.innerHeight * 0.65,
      speed: 38,
      facing: "left" as "left" | "right",
      baseY: window.innerHeight * 0.65,
      bobPhase: Math.PI / 2,
      scale: speciesScale(bundle, "barreleye", 70),
    };

    // Initial Dumbo Octopus state
    const dumbo = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.25,
      speed: 25,
      facing: "right" as "left" | "right",
      baseY: window.innerHeight * 0.25,
      bobPhase: Math.PI,
      scale: dumboAnim ? speciesScale(bundle, "dumbo", 52) : 1,
    };

    // Bubble particle system (24 ambient floating bubbles)
    const BUBBLE_COUNT = 24;
    const bubbles: Bubble[] = Array.from({ length: BUBBLE_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: 2 + Math.random() * 4.5,
      speed: 20 + Math.random() * 32,
      wobbleSpeed: 1.5 + Math.random() * 2,
      wobbleAmp: 0.8 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.18 + Math.random() * 0.26,
    }));

    const render = (time: number) => {
      const dt = Math.max(0, Math.min((time - prev) / 1000, 0.1));
      prev = time;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // --- 1. RISING BUBBLE PARTICLES ---
      ctx.save();
      const isLight = theme === "light";
      for (const b of bubbles) {
        if (!reducedMotion) {
          b.y -= b.speed * dt;
          b.phase += b.wobbleSpeed * dt;
          b.x += Math.sin(b.phase) * b.wobbleAmp;

          // Wrap to bottom when floating off top
          if (b.y < -20) {
            b.y = height + 10 + Math.random() * 20;
            b.x = Math.random() * width;
          }
        }

        // Draw translucent circular bubble with soft specular highlight
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(34, 126, 189, ${b.alpha * 0.7})`
          : `rgba(48, 214, 242, ${b.alpha})`;
        ctx.fill();

        ctx.strokeStyle = isLight
          ? `rgba(255, 255, 255, ${b.alpha * 1.5})`
          : `rgba(215, 246, 255, ${b.alpha * 1.4})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Little specular shine dot on top-left of bubble
        ctx.beginPath();
        ctx.arc(b.x - b.radius * 0.35, b.y - b.radius * 0.35, Math.max(0.6, b.radius * 0.25), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();
      }
      ctx.restore();

      // --- 2. UPDATE ACTOR MOVEMENTS ---
      if (!reducedMotion) {
        diverRight.update(dt);
        diverLeft.update(dt);
        barreleyeAnim.update(dt);
        if (dumboAnim) dumboAnim.update(dt);

        // Diver swimming motion
        const diverDir = diver.facing === "right" ? 1 : -1;
        diver.x += diver.speed * diverDir * dt;
        diver.bobPhase += dt * 1.4;
        diver.y = diver.baseY + Math.sin(diver.bobPhase) * 16;

        // Diver screen turnaround
        if (diver.facing === "right" && diver.x > width + 80) {
          diver.facing = "left";
          diver.baseY = Math.min(height * 0.75, Math.max(height * 0.2, height * (0.2 + Math.random() * 0.55)));
        } else if (diver.facing === "left" && diver.x < -80) {
          diver.facing = "right";
          diver.baseY = Math.min(height * 0.75, Math.max(height * 0.2, height * (0.2 + Math.random() * 0.55)));
        }

        // Barreleye Fish swimming motion (moves in opposite general flow)
        const fishDir = barreleye.facing === "right" ? 1 : -1;
        barreleye.x += barreleye.speed * fishDir * dt;
        barreleye.bobPhase += dt * 1.8;
        barreleye.y = barreleye.baseY + Math.sin(barreleye.bobPhase) * 12;

        if (barreleye.facing === "left" && barreleye.x < -90) {
          barreleye.facing = "right";
          barreleye.baseY = Math.min(height * 0.8, Math.max(height * 0.3, height * (0.3 + Math.random() * 0.45)));
        } else if (barreleye.facing === "right" && barreleye.x > width + 90) {
          barreleye.facing = "left";
          barreleye.baseY = Math.min(height * 0.8, Math.max(height * 0.3, height * (0.3 + Math.random() * 0.45)));
        }

        // Dumbo Octopus drifting
        if (dumboAnim) {
          const dumboDir = dumbo.facing === "right" ? 1 : -1;
          dumbo.x += dumbo.speed * dumboDir * dt;
          dumbo.bobPhase += dt * 1.1;
          dumbo.y = dumbo.baseY + Math.sin(dumbo.bobPhase) * 22;

          if (dumbo.facing === "right" && dumbo.x > width + 70) {
            dumbo.facing = "left";
            dumbo.baseY = height * (0.15 + Math.random() * 0.35);
          } else if (dumbo.facing === "left" && dumbo.x < -70) {
            dumbo.facing = "right";
            dumbo.baseY = height * (0.15 + Math.random() * 0.35);
          }
        }
      }

      // --- 3. DRAW SWIMMING CREATURES ---
      ctx.imageSmoothingEnabled = false;

      // Draw Dumbo Octopus (drifting deep in background)
      if (dumboAnim) {
        ctx.save();
        ctx.globalAlpha = isLight ? 0.45 : 0.55;
        ctx.translate(Math.round(dumbo.x), Math.round(dumbo.y));
        if (dumbo.facing === "left") {
          ctx.scale(-1, 1);
        }
        drawFrame(ctx, bundle, dumboAnim.frameName, 0, 0, dumbo.scale);
        ctx.restore();
      }

      // Draw Barreleye Fish (swimming smoothly)
      ctx.save();
      ctx.globalAlpha = isLight ? 0.65 : 0.75;
      ctx.translate(Math.round(barreleye.x), Math.round(barreleye.y));
      // Barreleye sprite in atlas defaults to facing left; flip if facing right
      if (barreleye.facing === "right") {
        ctx.scale(-1, 1);
      }
      drawFrame(ctx, bundle, barreleyeAnim.frameName, 0, 0, barreleye.scale);
      ctx.restore();

      // Draw Explorer Diver (front swimming layer)
      ctx.save();
      ctx.globalAlpha = isLight ? 0.82 : 0.88;
      const diverAnim = diver.facing === "right" ? diverRight : diverLeft;
      drawFrame(
        ctx,
        bundle,
        diverAnim.frameName,
        Math.round(diver.x),
        Math.round(diver.y),
        diver.scale
      );
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [bundle, reducedMotion, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="ocean-ambient-canvas"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden="true"
    />
  );
}
