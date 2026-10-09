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

interface Swimmer {
  id: string;
  species: string;
  x: number;
  y: number;
  baseYRatio: number;
  minYRatio: number;
  maxYRatio: number;
  speed: number;
  facing: "left" | "right";
  bobPhase: number;
  bobAmp: number;
  bobSpeed: number;
  scale: number;
  opacityLight: number;
  opacityDark: number;
  edgeMargin: number;
  baseFacesLeft: boolean;
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
    let isTabVisible = !document.hidden;

    // --- 1. SPRITE ANIMATIONS ---
    // Explorer Diver (directional swimming animations)
    const diverRight = new SpriteAnimation(bundle, "explorer.swim.right");
    const diverLeft = new SpriteAnimation(bundle, "explorer.swim.left");

    // All Native Deep-Sea Fish Species
    const barreleyeAnim = new SpriteAnimation(bundle, "barreleye.swim");
    const blobfishLeft = new SpriteAnimation(bundle, "blobfish.swim.left");
    const blobfishRight = new SpriteAnimation(bundle, "blobfish.swim.right");
    const gulperAnim = new SpriteAnimation(bundle, "gulper.swim");
    const goblinAnim = new SpriteAnimation(bundle, "goblin.swim");
    const fringeheadAnim = new SpriteAnimation(bundle, "fringehead.swim");

    // Canvas dimensions sync
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        prev = performance.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const width = window.innerWidth;
    const height = window.innerHeight;

    // --- 2. SWIMMING CREATURES ECOSYSTEM ---
    const swimmers: Swimmer[] = [
      // Explorer Diver (Epipelagic / Upper Layer)
      {
        id: "explorer",
        species: "explorer",
        x: width * 0.15,
        y: height * 0.22,
        baseYRatio: 0.22,
        minYRatio: 0.12,
        maxYRatio: 0.34,
        speed: 46,
        facing: "right",
        bobPhase: 0,
        bobAmp: 14,
        bobSpeed: 1.4,
        scale: speciesScale(bundle, "explorer", 64),
        opacityLight: 0.82,
        opacityDark: 0.88,
        edgeMargin: 80,
        baseFacesLeft: false, // discrete left/right animations
      },
      // Barreleye Fish (Mesopelagic / Twilight Layer)
      {
        id: "barreleye",
        species: "barreleye",
        x: width * 0.85,
        y: height * 0.32,
        baseYRatio: 0.32,
        minYRatio: 0.20,
        maxYRatio: 0.44,
        speed: 36,
        facing: "left",
        bobPhase: Math.PI * 0.4,
        bobAmp: 10,
        bobSpeed: 1.8,
        scale: speciesScale(bundle, "barreleye", 68),
        opacityLight: 0.68,
        opacityDark: 0.78,
        edgeMargin: 90,
        baseFacesLeft: true,
      },
      // Gulper Eel (Bathypelagic / Mid-Deep Layer)
      {
        id: "gulper",
        species: "gulper",
        x: width * 0.42,
        y: height * 0.52,
        baseYRatio: 0.52,
        minYRatio: 0.38,
        maxYRatio: 0.64,
        speed: 32,
        facing: "right",
        bobPhase: Math.PI * 0.8,
        bobAmp: 18,
        bobSpeed: 1.2,
        scale: speciesScale(bundle, "gulper", 72),
        opacityLight: 0.60,
        opacityDark: 0.72,
        edgeMargin: 110,
        baseFacesLeft: true,
      },
      // Goblin Shark (Abyssal Predator Layer)
      {
        id: "goblin",
        species: "goblin",
        x: width * 0.72,
        y: height * 0.64,
        baseYRatio: 0.64,
        minYRatio: 0.48,
        maxYRatio: 0.76,
        speed: 42,
        facing: "left",
        bobPhase: Math.PI * 1.2,
        bobAmp: 9,
        bobSpeed: 1.5,
        scale: speciesScale(bundle, "goblin", 74),
        opacityLight: 0.62,
        opacityDark: 0.74,
        edgeMargin: 100,
        baseFacesLeft: true,
      },
      // Blobfish (Benthic / Lower Layer)
      {
        id: "blobfish",
        species: "blobfish",
        x: width * 0.22,
        y: height * 0.75,
        baseYRatio: 0.75,
        minYRatio: 0.62,
        maxYRatio: 0.86,
        speed: 20,
        facing: "right",
        bobPhase: Math.PI * 1.6,
        bobAmp: 20,
        bobSpeed: 0.9,
        scale: speciesScale(bundle, "blobfish", 58),
        opacityLight: 0.64,
        opacityDark: 0.76,
        edgeMargin: 85,
        baseFacesLeft: false, // discrete left/right animations
      },
      // Sarcastic Fringehead (Seabed / Hadal Layer)
      {
        id: "fringehead",
        species: "fringehead",
        x: width * 0.60,
        y: height * 0.87,
        baseYRatio: 0.87,
        minYRatio: 0.74,
        maxYRatio: 0.94,
        speed: 28,
        facing: "left",
        bobPhase: Math.PI * 0.2,
        bobAmp: 12,
        bobSpeed: 2.0,
        scale: speciesScale(bundle, "fringehead", 62),
        opacityLight: 0.58,
        opacityDark: 0.70,
        edgeMargin: 90,
        baseFacesLeft: true,
      },
    ];

    // --- 3. AMBIENT BUBBLES ---
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

      if (!isTabVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const curWidth = canvas.width;
      const curHeight = canvas.height;

      ctx.clearRect(0, 0, curWidth, curHeight);

      // --- A. RISING BUBBLE PARTICLES ---
      ctx.save();
      const isLight = theme === "light";
      for (const b of bubbles) {
        if (!reducedMotion) {
          b.y -= b.speed * dt;
          b.phase += b.wobbleSpeed * dt;
          b.x += Math.sin(b.phase) * b.wobbleAmp;

          if (b.y < -20) {
            b.y = curHeight + 10 + Math.random() * 20;
            b.x = Math.random() * curWidth;
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

        // Specular shine dot on top-left of bubble
        ctx.beginPath();
        ctx.arc(
          b.x - b.radius * 0.35,
          b.y - b.radius * 0.35,
          Math.max(0.6, b.radius * 0.25),
          0,
          Math.PI * 2
        );
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();
      }
      ctx.restore();

      // --- B. UPDATE ANIMATIONS & POSITIONS ---
      if (!reducedMotion) {
        diverRight.update(dt);
        diverLeft.update(dt);
        barreleyeAnim.update(dt);
        blobfishLeft.update(dt);
        blobfishRight.update(dt);
        gulperAnim.update(dt);
        goblinAnim.update(dt);
        fringeheadAnim.update(dt);

        for (const s of swimmers) {
          const dir = s.facing === "right" ? 1 : -1;
          s.x += s.speed * dir * dt;
          s.bobPhase += dt * s.bobSpeed;
          s.y = curHeight * s.baseYRatio + Math.sin(s.bobPhase) * s.bobAmp;

          // Turnaround when swimming past screen edge
          if (s.facing === "right" && s.x > curWidth + s.edgeMargin) {
            s.facing = "left";
            s.baseYRatio =
              s.minYRatio + Math.random() * (s.maxYRatio - s.minYRatio);
          } else if (s.facing === "left" && s.x < -s.edgeMargin) {
            s.facing = "right";
            s.baseYRatio =
              s.minYRatio + Math.random() * (s.maxYRatio - s.minYRatio);
          }
        }
      }

      // --- C. DRAW ALL SWIMMERS ---
      ctx.imageSmoothingEnabled = false;

      for (const s of swimmers) {
        let frameName = "";
        let shouldFlip = false;

        if (s.species === "explorer") {
          frameName =
            s.facing === "right" ? diverRight.frameName : diverLeft.frameName;
        } else if (s.species === "blobfish") {
          frameName =
            s.facing === "right"
              ? blobfishRight.frameName
              : blobfishLeft.frameName;
        } else if (s.species === "barreleye") {
          frameName = barreleyeAnim.frameName;
          shouldFlip = s.facing === "right"; // base faces left
        } else if (s.species === "gulper") {
          frameName = gulperAnim.frameName;
          shouldFlip = s.facing === "right"; // base faces left
        } else if (s.species === "goblin") {
          frameName = goblinAnim.frameName;
          shouldFlip = s.facing === "right"; // base faces left
        } else if (s.species === "fringehead") {
          frameName = fringeheadAnim.frameName;
          shouldFlip = s.facing === "right"; // base faces left
        }

        if (!frameName) continue;

        ctx.save();
        ctx.globalAlpha = isLight ? s.opacityLight : s.opacityDark;
        ctx.translate(Math.round(s.x), Math.round(s.y));

        if (shouldFlip) {
          ctx.scale(-1, 1);
        }

        drawFrame(ctx, bundle, frameName, 0, 0, s.scale);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
