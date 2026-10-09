import { forwardRef, useEffect, useImperativeHandle, useRef, type RefObject } from "react";
import { drawFrame, loadAssetBundle, SpriteAnimation, type AssetBundle } from "../../../../src/assets/sprites.js";

export type EffectTarget = "player" | "enemy";
export type EffectLayer = "behind-actors" | "on-actors" | "above-actors";
export type EffectName = "effects.sonar-cast" | "effects.sonar-hit" | "effects.hull-hit";

export interface BattleEffectsHandle {
  play: (name: EffectName, target: EffectTarget, layer: EffectLayer) => void;
  clear: () => void;
}

interface Props {
  sceneRef: RefObject<HTMLDivElement | null>;
  playerRef: RefObject<HTMLDivElement | null>;
  enemyRef: RefObject<HTMLDivElement | null>;
}

interface QueuedEffect {
  name: EffectName;
  target: EffectTarget;
  layer: EffectLayer;
}

interface ActiveEffect extends QueuedEffect {
  animation: SpriteAnimation;
  elapsed: number;
  reduced: boolean;
}

const layers: EffectLayer[] = ["behind-actors", "on-actors", "above-actors"];

export const BattleEffects = forwardRef<BattleEffectsHandle, Props>(function BattleEffects(
  { sceneRef, playerRef, enemyRef }, ref,
) {
  const canvasRefs = useRef<Record<EffectLayer, HTMLCanvasElement | null>>({
    "behind-actors": null,
    "on-actors": null,
    "above-actors": null,
  });
  const bundleRef = useRef<AssetBundle | null>(null);
  const queuedRef = useRef<QueuedEffect[]>([]);
  const activeRef = useRef<ActiveEffect[]>([]);

  useImperativeHandle(ref, () => ({
    play(name, target, layer) {
      const queued = { name, target, layer };
      const bundle = bundleRef.current;
      if (!bundle) {
        queuedRef.current.push(queued);
        return;
      }
      activeRef.current.push({
        ...queued,
        animation: new SpriteAnimation(bundle, name),
        elapsed: 0,
        reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
    },
    clear() {
      queuedRef.current = [];
      activeRef.current = [];
      for (const layer of layers) {
        const canvas = canvasRefs.current[layer];
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
  }), []);

  useEffect(() => {
    let live = true;
    void loadAssetBundle("/assets/runtime/manifest.json", { atlases: ["effects"] }).then((bundle) => {
      if (!live) return;
      bundleRef.current = bundle;
      activeRef.current.push(...queuedRef.current.map((queued) => ({
        ...queued,
        animation: new SpriteAnimation(bundle, queued.name),
        elapsed: 0,
        reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      })));
      queuedRef.current = [];
    }).catch((error) => console.warn("Battle effects unavailable:", error));
    return () => { live = false; bundleRef.current = null; queuedRef.current = []; activeRef.current = []; };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let animationId = 0;
    let previous = performance.now();
    let logicalWidth = 0;
    let logicalHeight = 0;

    const resize = () => {
      logicalWidth = scene.clientWidth;
      logicalHeight = scene.clientHeight;
      const ratio = window.devicePixelRatio || 1;
      for (const layer of layers) {
        const canvas = canvasRefs.current[layer];
        if (!canvas) continue;
        canvas.width = Math.max(1, Math.round(logicalWidth * ratio));
        canvas.height = Math.max(1, Math.round(logicalHeight * ratio));
        canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(scene);
    resize();

    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const bundle = bundleRef.current;
      const sceneBox = scene.getBoundingClientRect();
      for (const layer of layers) {
        const canvas = canvasRefs.current[layer];
        const ctx = canvas?.getContext("2d");
        if (!ctx) continue;
        ctx.clearRect(0, 0, logicalWidth, logicalHeight);
        if (!bundle) continue;
        for (const effect of activeRef.current) {
          if (effect.layer !== layer) continue;
          const actor = effect.target === "player" ? playerRef.current : enemyRef.current;
          if (!actor) continue;
          const actorBox = actor.getBoundingClientRect();
          const x = actorBox.left + actorBox.width / 2 - sceneBox.left;
          const y = actorBox.top + actorBox.height / 2 - sceneBox.top;
          const scale = Math.min(1, logicalWidth / 300);
          if (effect.reduced) {
            const frames = bundle.manifest.animations[effect.name].frames;
            drawFrame(ctx, bundle, frames[Math.min(2, frames.length - 1)], x, y, scale);
          } else {
            effect.animation.draw(ctx, x, y, scale);
          }
        }
      }
      activeRef.current = activeRef.current.filter((effect) => {
        effect.elapsed += dt;
        if (effect.reduced) return effect.elapsed < 0.15;
        effect.animation.update(dt);
        return !effect.animation.finished;
      });
      animationId = requestAnimationFrame(render);
    };
    animationId = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(animationId); observer.disconnect(); };
  }, [sceneRef, playerRef, enemyRef]);

  return <>{layers.map((layer) => (
    <canvas
      key={layer}
      ref={(node) => { canvasRefs.current[layer] = node; }}
      className={`battle-effects battle-effects--${layer}`}
      aria-hidden="true"
    />
  ))}</>;
});
