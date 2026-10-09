import { useEffect, useRef, useState } from "react";

export interface OceanBackdropProps {
  reducedMotion?: boolean;
}

export function OceanBackdrop({ reducedMotion = false }: OceanBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion || window.innerWidth <= 768) return;

    const handleMouseMove = (e: MouseEvent) => {
      const normX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const normY = (e.clientY / window.innerHeight - 0.5) * 2;
      setParallax({
        x: Math.round(normX * 6), // max 6px
        y: Math.round(normY * 4), // max 4px
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * (canvas.width || 800),
      y: Math.random() * (canvas.height || 600),
      speedY: 0.15 + Math.random() * 0.35,
      size: Math.random() > 0.8 ? 2 : 1,
      opacity: 0.1 + Math.random() * 0.3,
    }));

    const render = () => {
      if (!reducedMotion) {
        t += 0.02;
      }

      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;

      // 1. Deep abyss water gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#061426");
      grad.addColorStop(0.5, "#0b1e38");
      grad.addColorStop(1, "#030912");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 2. Faint horizontal scanlines
      ctx.strokeStyle = "rgba(66, 104, 135, 0.08)";
      ctx.lineWidth = 1;
      for (let y = 16; y < h; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3. Floating particles (marine snow)
      for (const p of particles) {
        if (!reducedMotion) {
          p.y -= p.speedY;
          if (p.y < 0) {
            p.y = h + 10;
            p.x = Math.random() * w;
          }
        }
        ctx.fillStyle = `rgba(161, 181, 204, ${p.opacity.toFixed(2)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }

      // 4. Distant Red Buoy (top-right visual anchor)
      const buoyX = Math.round(w * 0.85 + parallax.x * 0.5);
      const buoyY = Math.round(h * 0.18 + Math.sin(t * 1.1) * 3 + parallax.y * 0.5);

      // Small pixel buoy silhouette
      ctx.fillStyle = "#ff4853";
      ctx.fillRect(buoyX - 3, buoyY - 8, 6, 16);
      ctx.fillStyle = "#e6b957";
      ctx.fillRect(buoyX - 5, buoyY - 2, 10, 3);

      // Rare subtle red pulse ring
      const pulse = Math.sin(t * 1.4);
      if (pulse > 0.65 && !reducedMotion) {
        const pulseAlpha = ((pulse - 0.65) / 0.35) * 0.45;
        ctx.strokeStyle = `rgba(255, 72, 83, ${pulseAlpha.toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(buoyX, buoyY - 6, 10 + (1 - pulse) * 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [reducedMotion, parallax]);

  return (
    <div className="ocean-backdrop-root" aria-hidden="true">
      <canvas ref={canvasRef} className="ocean-backdrop-canvas" />
      <div className="ocean-vignette" />
    </div>
  );
}
