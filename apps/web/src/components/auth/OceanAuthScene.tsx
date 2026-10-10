import { useEffect, useRef, useState } from "react";
import { type AssetBundle, drawFrame, drawWater, speciesScale, SpriteAnimation, frameDeltaSeconds } from "../../game/sprites";

export interface OceanAuthSceneProps {
  bundle: AssetBundle | null;
  reducedMotion?: boolean;
}

interface Particle {
  x: number;
  y: number;
  speedY: number;
  size: number;
  opacity: number;
}

export function OceanAuthScene({ bundle, reducedMotion = false }: OceanAuthSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [explorerStatusOpen, setExplorerStatusOpen] = useState(false);
  const [buoySignalOpen, setBuoySignalOpen] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;
    let lastFrame: number | null = null;
    const explorerSwim = bundle ? new SpriteAnimation(bundle, "explorer.swim.right") : null;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const css = getComputedStyle(canvas);
    const color = (token: string) => css.getPropertyValue(token).trim();
    const colors = {
      abyss: color("--abyss"),
      deepIndigo: color("--deep-indigo"),
      oceanSlate: color("--ocean-slate"),
      visorCyan: color("--visor-cyan"),
      signalRed: color("--signal-red"),
      equipmentGold: color("--equipment-gold"),
      textMuted: color("--text-muted"),
    };

    // Responsive canvas dimensions
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * pixelRatio);
      canvas.height = Math.floor(rect.height * pixelRatio);
    };
    resize();

    // Initial particles
    const particles: Particle[] = Array.from({ length: 16 }, () => ({
      x: Math.random() * (canvas.width || 400),
      y: Math.random() * (canvas.height || 600),
      speedY: 0.2 + Math.random() * 0.4,
      size: Math.random() > 0.7 ? 2 : 1,
      opacity: 0.15 + Math.random() * 0.35,
    }));

    const render = (now: number) => {
      const dt = frameDeltaSeconds(now, lastFrame);
      lastFrame = now;
      if (!reducedMotion && document.visibilityState === "visible") {
        t += dt;
        explorerSwim?.update(dt);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = colors.abyss;
      ctx.fillRect(0, 0, w, h);

      // Reuse the approved surface-water tile; tint it down for a quiet approach scene.
      const water = bundle?.images[bundle.manifest.world.waterAtlas];
      if (bundle && water) {
        const current = reducedMotion ? 0 : t * 5 * pixelRatio;
        drawWater(ctx, water, w, h, bundle.manifest.world.tileWorldSize * pixelRatio, current, -current * 0.35);
      }

      const waterTint = ctx.createLinearGradient(0, 0, 0, h);
      waterTint.addColorStop(0, colors.deepIndigo);
      waterTint.addColorStop(1, colors.abyss);
      ctx.globalAlpha = 0.58;
      ctx.fillStyle = waterTint;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      // A thin surface line gives the diver a place in the water without a HUD grid.
      ctx.strokeStyle = colors.textMuted;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = Math.max(1, pixelRatio);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(h * 0.2));
      ctx.quadraticCurveTo(w * 0.48, h * 0.18, w, h * 0.205);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Sparse marine snow gives the water scale without competing with the terminal.
      for (const p of particles) {
        if (!reducedMotion) {
          p.y -= p.speedY;
          if (p.y < 0) {
            p.y = h + 10;
            p.x = Math.random() * w;
          }
        }
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = colors.textMuted;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // Distant red navigation buoy.
      const buoyX = Math.round(w * 0.78);
      const buoyBob = reducedMotion ? 0 : Math.sin(t * 1.2) * 2;
      const buoyY = Math.round(h * 0.28 + buoyBob);

      if (bundle) {
        const buoyFrameName = bundle.manifest.world.buoyFrame || "buoy.sprite";
        if (bundle.manifest.frames[buoyFrameName]) {
          drawFrame(ctx, bundle, buoyFrameName, buoyX, buoyY, speciesScale(bundle, "buoy", 38 * pixelRatio));
        }
      } else {
        // Fallback pixel buoy silhouette
        ctx.fillStyle = colors.signalRed;
        ctx.fillRect(buoyX - 4, buoyY - 12, 8, 24);
        ctx.fillStyle = colors.equipmentGold;
        ctx.fillRect(buoyX - 6, buoyY - 2, 12, 4);
      }

      // A restrained signal ring locates the route buoy.
      const pingCycle = Math.sin(t * 1.2);
      if (pingCycle > 0.55 && !reducedMotion) {
        const pingAlpha = (pingCycle - 0.55) / 0.45;
        ctx.strokeStyle = colors.signalRed;
        ctx.globalAlpha = pingAlpha * 0.28;
        ctx.lineWidth = Math.max(1, pixelRatio);
        ctx.beginPath();
        ctx.arc(buoyX, buoyY - 10, (16 + (1 - pingAlpha) * 10) * pixelRatio, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Explorer sprite.
      const explorerX = Math.round(w * 0.38);
      const explorerBob = reducedMotion ? 0 : Math.cos(t * 0.9) * 3;
      const explorerY = Math.round(h * 0.52 + explorerBob);

      if (bundle) {
        const explorerScale = speciesScale(bundle, "explorer", 82 * pixelRatio);
        if (explorerSwim) {
          explorerSwim.draw(ctx, explorerX, explorerY, explorerScale);
        } else {
          drawFrame(ctx, bundle, "explorer.right.0", explorerX, explorerY, explorerScale);
        }
      } else {
        // Fallback pixel explorer silhouette
        ctx.fillStyle = colors.oceanSlate;
        ctx.fillRect(explorerX - 16, explorerY - 20, 32, 40);
        ctx.fillStyle = colors.visorCyan;
        ctx.fillRect(explorerX - 6, explorerY - 10, 16, 8);
      }

      if (!reducedMotion && document.visibilityState === "visible") {
        animId = requestAnimationFrame(render);
      }
    };

    const handleVisibilityChange = () => {
      cancelAnimationFrame(animId);
      lastFrame = null;
      render(performance.now());
    };
    const handleResize = () => {
      resize();
      cancelAnimationFrame(animId);
      lastFrame = null;
      render(performance.now());
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleResize);
    render(performance.now());

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
    };
  }, [bundle, reducedMotion]);

  return (
    <div className="ocean-auth-scene">
      <canvas ref={canvasRef} className="ocean-auth-canvas" aria-hidden="true" />

      <div className="auth-scene-telemetry" aria-label="Expedition scene telemetry">
        <span className="telemetry-item"><span className="telemetry-label">DEPTH</span><span className="telemetry-val">0000 M</span></span>
        <span className="telemetry-item"><span className="telemetry-label">SYSTEM</span><span className="telemetry-val text-cyan">READY</span></span>
      </div>

      <button
        type="button"
        className="scene-hotspot explorer-hotspot"
        aria-label="Explorer status: oxygen ready, suit ready, sonar ready, depth zero meters"
        aria-expanded={explorerStatusOpen}
        aria-describedby="explorer-status-tooltip"
        onClick={() => setExplorerStatusOpen((open) => !open)}
        onBlur={() => setExplorerStatusOpen(false)}
      >
        <span className="sr-only">Explorer status</span>
      </button>
      <div id="explorer-status-tooltip" className="scene-tooltip explorer-tooltip" role="status">
        <strong>EXPLORER STATUS</strong>
        <span>OXYGEN <b>READY</b></span>
        <span>SUIT <b>READY</b></span>
        <span>SONAR <b>READY</b></span>
        <span>DEPTH <b>0000 M</b></span>
      </div>

      <button
        type="button"
        className="scene-hotspot buoy-hotspot"
        aria-label="Navigation signal: Point Nemo route acquired"
        aria-expanded={buoySignalOpen}
        aria-describedby="buoy-signal-tooltip"
        onClick={() => setBuoySignalOpen((open) => !open)}
        onBlur={() => setBuoySignalOpen(false)}
      >
        <span className="sr-only">Navigation signal</span>
      </button>
      <div id="buoy-signal-tooltip" className="scene-tooltip buoy-tooltip" role="status">
        <strong>NAVIGATION SIGNAL</strong>
        <span>POINT NEMO ROUTE ACQUIRED</span>
      </div>

      <div className="auth-scene-story">
        <div className="scene-brand-badge">
          <span className="brand-dot-pulse" aria-hidden="true" />
          <span>SIGNAL DETECTED</span>
        </div>
        <h2 className="scene-brand-title">THE DESCENT STARTS HERE.</h2>
        <p className="scene-tagline">
          Upload your notes. Build your knowledge. Defeat the lesson.
        </p>
        <span className="scene-sub-callout">SURFACE APPROACH // 0000 M</span>
      </div>
    </div>
  );
}
