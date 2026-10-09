import { useEffect, useRef } from "react";
import {
  type AssetBundle,
  SpriteAnimation,
  drawFrame,
  speciesScale,
} from "../../game/sprites";
import { type QuestionSet } from "@point-nemo/shared";

interface LibraryHubViewProps {
  questionSets: QuestionSet[];
  activeInstanceId?: string | null;
  onOpenUpload: () => void;
  onGoToSeas: () => void;
  bundle: AssetBundle | null;
  reducedMotion?: boolean;
}

export function LibraryHubView({
  questionSets,
  activeInstanceId = "PN-001",
  onOpenUpload,
  onGoToSeas,
  bundle,
  reducedMotion = false,
}: LibraryHubViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animated Diver & Barreleye banner
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let prev = performance.now();

    const playerAnim = new SpriteAnimation(bundle, "explorer.swim.right");
    const creatureAnim = new SpriteAnimation(bundle, "barreleye.swim");

    const render = (time: number) => {
      const dt = Math.min((time - prev) / 1000, 0.1);
      prev = time;

      if (!reducedMotion) {
        playerAnim.update(dt);
        creatureAnim.update(dt);
      }

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = false;

      // Water gradient
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#0e3456");
      grad.addColorStop(1, "#06172c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw swimming explorer
      const pScale = speciesScale(bundle, "explorer", 70);
      drawFrame(ctx, bundle, playerAnim.frameName, Math.round(width * 0.32), Math.round(height * 0.52), pScale);

      // Draw swimming barreleye
      const cScale = speciesScale(bundle, "barreleye", 80);
      drawFrame(ctx, bundle, creatureAnim.frameName, Math.round(width * 0.72), Math.round(height * 0.54), cScale);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bundle, reducedMotion]);

  return (
    <section className="library-hub-view" aria-labelledby="library-title">
      <div className="eyebrow">MODULE 01 · LOCAL STUDY LIBRARY</div>
      <div className="page-heading">
        <div>
          <h1 id="library-title">Your library</h1>
          <p>Local study lessons and autonomous descent routes processed on this machine.</p>
        </div>
      </div>

      <section className="art-banner" aria-label="Underwater descent preview banner">
        <canvas ref={canvasRef} width={800} height={180} className="pixel-scene" />
        <span className="depth-mark">DESCENT PREVIEW · BENTHIC ZONE</span>
      </section>

      <div className="library-grid">
        <section className="panel upload-panel" aria-labelledby="upload-box-title">
          <div className="panel-heading">
            <div>
              <h2 id="upload-box-title">Add a study PDF</h2>
              <p>English, text-based documents · Local extraction &amp; AI validation</p>
            </div>
          </div>

          <div
            className="dropzone"
            onClick={onOpenUpload}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onOpenUpload();
            }}
          >
            <span className="upload-icon" aria-hidden="true">
              ↑
            </span>
            <strong>Upload a study PDF</strong>
            <span>No file-size or page limit · Processed locally</span>
            <span className="choose-button">Open file intake</span>
          </div>

          <p className="file-status">
            Upload a document to generate an authentic 9-question ocean descent.
          </p>
        </section>

        <aside className="panel saved-panel" aria-labelledby="saved-box-title">
          <div className="panel-heading">
            <div>
              <h2 id="saved-box-title">Recent Lessons</h2>
            </div>
          </div>

          {questionSets.length > 0 ? (
            questionSets.slice(0, 2).map((qs) => (
              <article key={qs.id} className="saved-card">
                <div className="pdf-mark">PDF</div>
                <div className="saved-copy">
                  <strong>
                    {"documentName" in qs
                      ? qs.documentName
                      : "title" in (qs as Record<string, unknown>)
                      ? String((qs as Record<string, unknown>).title)
                      : "Study Expedition"}
                  </strong>
                  <span>9 questions · Local AI Ready</span>
                </div>
                <span className="ready-dot" aria-label="Ready" />
              </article>
            ))
          ) : (
            <article className="saved-card">
              <div className="pdf-mark">PDF</div>
              <div className="saved-copy">
                <strong>Introduction to Marine Biology</strong>
                <span>3 topics · 9 questions · Ready</span>
              </div>
              <span className="ready-dot" aria-label="Ready" />
            </article>
          )}

          <article className="saved-card active-run">
            <div className="resume-mark">↗</div>
            <div className="saved-copy">
              <strong>Active descent · {activeInstanceId || "PN-001"}</strong>
              <span>Introduction to Marine Biology</span>
            </div>
            <button className="text-button" type="button" onClick={onGoToSeas}>
              Choose sea
            </button>
          </article>

          <button
            className="secondary-button full-button"
            type="button"
            onClick={onGoToSeas}
          >
            Choose a sea <span>→</span>
          </button>

          <button
            className="secondary-button full-button"
            type="button"
            onClick={onOpenUpload}
          >
            Upload study PDF <span>→</span>
          </button>
        </aside>
      </div>
    </section>
  );
}
