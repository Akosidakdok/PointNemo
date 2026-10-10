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

interface MarineSnow {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftX: number;
  phase: number;
  alpha: number;
}

interface KelpStalk {
  rootX: number;
  height: number;
  segments: number;
  swayAmp: number;
  phase: number;
  speed: number;
  color: string;
}

interface SunRay {
  topXRatio: number;
  topWidth: number;
  bottomXRatio: number;
  bottomWidth: number;
  heightRatio: number;
  phase: number;
  speed: number;
  maxAlpha: number;
}

interface SonarPing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
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
    let worldTime = 0;
    let sonarTimer = 0;

    // --- 1. SPRITE ANIMATIONS ---
    const diverRight = new SpriteAnimation(bundle, "explorer.swim.right");
    const diverLeft = new SpriteAnimation(bundle, "explorer.swim.left");
    const barreleyeAnim = new SpriteAnimation(bundle, "barreleye.swim");
    const blobfishLeft = new SpriteAnimation(bundle, "blobfish.swim.left");
    const blobfishRight = new SpriteAnimation(bundle, "blobfish.swim.right");
    const gulperAnim = new SpriteAnimation(bundle, "gulper.swim");
    const goblinAnim = new SpriteAnimation(bundle, "goblin.swim");
    const fringeheadAnim = new SpriteAnimation(bundle, "fringehead.swim");

    // Navigation Buoy scale
    let buoyScale = 0.2;
    try {
      buoyScale = speciesScale(bundle, "buoy", 84);
    } catch {
      buoyScale = 0.2;
    }

    // Handle viewport resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      rebuildKelp();
    };

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        prev = performance.now();
      }
    };
    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // --- 2. SWIMMING CREATURES ---
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
        baseFacesLeft: false,
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
        y: height * 0.55,
        baseYRatio: 0.55,
        minYRatio: 0.48,
        maxYRatio: 0.62,
        speed: 42,
        facing: "left",
        bobPhase: Math.PI * 1.2,
        bobAmp: 8,
        bobSpeed: 1.5,
        scale: speciesScale(bundle, "goblin", 74),
        opacityLight: 0.62,
        opacityDark: 0.74,
        edgeMargin: 100,
        baseFacesLeft: true,
      },
      // Blobfish (Benthic Layer)
      {
        id: "blobfish",
        species: "blobfish",
        x: width * 0.22,
        y: height * 0.67,
        baseYRatio: 0.67,
        minYRatio: 0.60,
        maxYRatio: 0.72,
        speed: 20,
        facing: "right",
        bobPhase: Math.PI * 1.6,
        bobAmp: 14,
        bobSpeed: 0.9,
        scale: speciesScale(bundle, "blobfish", 58),
        opacityLight: 0.64,
        opacityDark: 0.76,
        edgeMargin: 85,
        baseFacesLeft: false,
      },
      // Sarcastic Fringehead (Lower Benthic Layer - Elevated to prevent bottom overlap and clipping)
      {
        id: "fringehead",
        species: "fringehead",
        x: width * 0.60,
        y: height * 0.78,
        baseYRatio: 0.78,
        minYRatio: 0.72,
        maxYRatio: 0.82,
        speed: 28,
        facing: "left",
        bobPhase: Math.PI * 0.2,
        bobAmp: 8,
        bobSpeed: 1.8,
        scale: speciesScale(bundle, "fringehead", 62),
        opacityLight: 0.62,
        opacityDark: 0.74,
        edgeMargin: 90,
        baseFacesLeft: true,
      },
    ];

    // --- 3. SURFACE NAVIGATION BUOY ---
    const buoy = {
      xRatio: 0.82,
      baseYRatio: 0.11,
      bobAmp: 5,
      bobSpeed: 1.4,
      tiltAmp: 0.04,
      beaconPhase: 0,
    };

    // --- 4. VOLUMETRIC SUNBEAM SHAFTS ---
    const sunRays: SunRay[] = [
      {
        topXRatio: 0.08,
        topWidth: 70,
        bottomXRatio: 0.22,
        bottomWidth: 160,
        heightRatio: 0.65,
        phase: 0.3,
        speed: 0.25,
        maxAlpha: 0.045,
      },
      {
        topXRatio: 0.32,
        topWidth: 90,
        bottomXRatio: 0.48,
        bottomWidth: 200,
        heightRatio: 0.70,
        phase: 1.7,
        speed: 0.22,
        maxAlpha: 0.055,
      },
      {
        topXRatio: 0.62,
        topWidth: 80,
        bottomXRatio: 0.78,
        bottomWidth: 180,
        heightRatio: 0.62,
        phase: 3.1,
        speed: 0.28,
        maxAlpha: 0.04,
      },
    ];

    // --- 5. SWAYING SEABED KELP FOREST ---
    let kelpStalks: KelpStalk[] = [];
    const rebuildKelp = () => {
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      const stalkCount = curW < 640 ? 6 : 12;
      kelpStalks = Array.from({ length: stalkCount }, (_, i) => {
        const spreadRatio = (i + 0.5) / stalkCount;
        const xVariance = (Math.random() - 0.5) * (curW / stalkCount) * 0.7;
        const kelpHeight = curH * (0.09 + Math.random() * 0.07);
        const greenHue = 165 + Math.floor(Math.random() * 25);
        return {
          rootX: curW * spreadRatio + xVariance,
          height: kelpHeight,
          segments: 4,
          swayAmp: 16 + Math.random() * 14,
          phase: i * 0.7 + Math.random(),
          speed: 0.9 + Math.random() * 0.5,
          color:
            theme === "light"
              ? `rgba(20, ${greenHue}, 120, 0.38)`
              : `rgba(16, ${greenHue - 15}, 95, 0.32)`,
        };
      });
    };
    rebuildKelp();

    // --- 6. MARINE SNOW & PLANKTON DRIFT ---
    const SNOW_COUNT = 32;
    const marineSnow: MarineSnow[] = Array.from({ length: SNOW_COUNT }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: 0.8 + Math.random() * 1.4,
      speedY: 10 + Math.random() * 18,
      driftX: (Math.random() - 0.5) * 16,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.16 + Math.random() * 0.24,
    }));

    // --- 7. AMBIENT BUBBLE PARTICLES ---
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

    // --- 8. ACOUSTIC SONAR PINGS ---
    const sonarPings: SonarPing[] = [];

    // --- MAIN RENDER LOOP ---
    const render = (time: number) => {
      const dt = Math.max(0, Math.min((time - prev) / 1000, 0.1));
      prev = time;
      worldTime += dt;

      if (!isTabVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const curWidth = canvas.width;
      const curHeight = canvas.height;
      const isLight = theme === "light";

      ctx.clearRect(0, 0, curWidth, curHeight);

      // --- LAYER 1: VOLUMETRIC SUNLIGHT CAUSTIC SHAFTS ---
      if (!reducedMotion) {
        ctx.save();
        for (const ray of sunRays) {
          const sway = Math.sin(worldTime * ray.speed + ray.phase) * 24;
          const x1 = curWidth * ray.topXRatio;
          const x2 = x1 + ray.topWidth;
          const x3 = curWidth * ray.bottomXRatio + sway + ray.bottomWidth;
          const x4 = curWidth * ray.bottomXRatio + sway;
          const yBottom = curHeight * ray.heightRatio;

          const grad = ctx.createLinearGradient(0, 0, 0, yBottom);
          const baseAlpha = isLight ? ray.maxAlpha * 1.3 : ray.maxAlpha;
          grad.addColorStop(
            0,
            isLight
              ? `rgba(255, 255, 255, ${baseAlpha * 1.6})`
              : `rgba(48, 214, 242, ${baseAlpha * 1.2})`
          );
          grad.addColorStop(
            0.6,
            isLight
              ? `rgba(185, 230, 255, ${baseAlpha * 0.8})`
              : `rgba(32, 160, 210, ${baseAlpha * 0.6})`
          );
          grad.addColorStop(1, "rgba(255, 255, 255, 0)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(x1, 0);
          ctx.lineTo(x2, 0);
          ctx.lineTo(x3, yBottom);
          ctx.lineTo(x4, yBottom);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // --- LAYER 2: SWAYING SEABED KELP FOREST ---
      ctx.save();
      for (const stalk of kelpStalks) {
        ctx.strokeStyle = stalk.color;
        ctx.fillStyle = stalk.color;
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";

        const rootY = curHeight;
        const segH = stalk.height / stalk.segments;
        let curX = stalk.rootX;
        let curY = rootY;

        ctx.beginPath();
        ctx.moveTo(curX, curY);

        const nodes: { x: number; y: number }[] = [{ x: curX, y: curY }];

        for (let s = 1; s <= stalk.segments; s++) {
          const sway = reducedMotion
            ? 0
            : Math.sin(worldTime * stalk.speed + stalk.phase + s * 0.45) *
              (stalk.swayAmp * (s / stalk.segments));
          const nextX = stalk.rootX + sway;
          const nextY = rootY - s * segH;
          const midX = (curX + nextX) / 2;
          const midY = (curY + nextY) / 2;
          ctx.quadraticCurveTo(curX, curY, midX, midY);
          curX = nextX;
          curY = nextY;
          nodes.push({ x: nextX, y: nextY });
        }
        ctx.lineTo(curX, curY);
        ctx.stroke();

        // Draw small kelp fronds along nodes
        for (let i = 1; i < nodes.length; i++) {
          const pt = nodes[i];
          const dir = i % 2 === 0 ? 1 : -1;
          const leafSway = reducedMotion
            ? 0
            : Math.sin(worldTime * stalk.speed + stalk.phase + i) * 6;
          ctx.beginPath();
          ctx.ellipse(
            pt.x + dir * 12,
            pt.y + leafSway * 0.4,
            12,
            4.5,
            dir * 0.35,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
      ctx.restore();

      // --- LAYER 3: MARINE SNOW DRIFT ---
      ctx.save();
      for (const snow of marineSnow) {
        if (!reducedMotion) {
          snow.y += snow.speedY * dt;
          snow.phase += dt * 0.8;
          snow.x += Math.sin(snow.phase) * snow.driftX * dt;

          if (snow.y > curHeight + 10) {
            snow.y = -10;
            snow.x = Math.random() * curWidth;
          }
        }

        ctx.beginPath();
        ctx.arc(snow.x, snow.y, snow.radius, 0, Math.PI * 2);
        ctx.fillStyle = isLight
          ? `rgba(50, 120, 175, ${snow.alpha * 0.6})`
          : `rgba(205, 245, 255, ${snow.alpha})`;
        ctx.fill();
      }
      ctx.restore();

      // --- LAYER 4: ACOUSTIC TELEMETRY SONAR PINGS ---
      sonarTimer += dt;
      if (sonarTimer > 12) {
        sonarTimer = 0;
        sonarPings.push({
          x: curWidth * 0.32,
          y: curHeight * 0.58,
          radius: 12,
          maxRadius: 260,
          alpha: 0.28,
          speed: 38,
        });
      }

      ctx.save();
      for (let i = sonarPings.length - 1; i >= 0; i--) {
        const p = sonarPings[i];
        if (!reducedMotion) {
          p.radius += p.speed * dt;
          p.alpha *= Math.pow(0.94, dt * 60);
        }
        if (p.radius >= p.maxRadius || p.alpha < 0.01) {
          sonarPings.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.strokeStyle = isLight
          ? `rgba(32, 120, 180, ${p.alpha * 0.65})`
          : `rgba(48, 214, 242, ${p.alpha})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();

      // --- LAYER 5: AMBIENT RISING BUBBLES ---
      ctx.save();
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

      // --- LAYER 6: SURFACE NAVIGATION BUOY WITH RED WARNING BEACON ---
      const buoyX = curWidth * buoy.xRatio;
      const buoyY =
        curHeight * buoy.baseYRatio +
        (reducedMotion ? 0 : Math.sin(worldTime * buoy.bobSpeed) * buoy.bobAmp);
      const buoyTilt = reducedMotion
        ? 0
        : Math.sin(worldTime * buoy.bobSpeed * 0.7) * buoy.tiltAmp;

      ctx.save();
      ctx.translate(Math.round(buoyX), Math.round(buoyY));
      ctx.rotate(buoyTilt);

      // Blinking Red Beacon Core & Halo at mast tip
      if (!reducedMotion) {
        buoy.beaconPhase = (buoy.beaconPhase + dt * 2.4) % (Math.PI * 2);
        const pulseR = 14 + Math.sin(buoy.beaconPhase) * 6;
        const pulseA = 0.3 + Math.sin(buoy.beaconPhase) * 0.2;

        ctx.beginPath();
        ctx.arc(0, -32, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 72, 83, ${pulseA})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -32, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ff4853";
        ctx.shadowColor = "#ff4853";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = isLight ? 0.78 : 0.86;
      drawFrame(ctx, bundle, "buoy", 0, 0, buoyScale);
      ctx.restore();

      // --- LAYER 7: SWIMMING MARINE LIFE & EXPLORER DIVER ---
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
          const rawY = curHeight * s.baseYRatio + Math.sin(s.bobPhase) * s.bobAmp;
          const topMargin = 50;
          const bottomMargin = 45;
          s.y = Math.max(topMargin, Math.min(curHeight - bottomMargin, rawY));

          // Turnaround check at screen borders
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
          shouldFlip = s.facing === "right";
        } else if (s.species === "gulper") {
          frameName = gulperAnim.frameName;
          shouldFlip = s.facing === "right";
        } else if (s.species === "goblin") {
          frameName = goblinAnim.frameName;
          shouldFlip = s.facing === "right";
        } else if (s.species === "fringehead") {
          frameName = fringeheadAnim.frameName;
          shouldFlip = s.facing === "right";
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
