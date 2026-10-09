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
  onSelectLesson?: (lessonId: string, action: "resume" | "new") => void;
  bundle: AssetBundle | null;
  reducedMotion?: boolean;
}

export function LibraryHubView({
  questionSets,
  activeInstanceId = "PN-001",
  onOpenUpload,
  onGoToSeas,
  onSelectLesson,
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
      const dt = Math.max(0, Math.min((time - prev) / 1000, 0.1));
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
      <div className="eyebrow">STEP 01 · STUDY LIBRARY</div>
      <div className="page-heading">
        <div>
          <h1 id="library-title">Your library</h1>
          <p>Interactive study lessons and practice quizzes saved privately on your device.</p>
        </div>
      </div>

      <section className="art-banner" aria-label="Interactive lesson preview banner">
        <canvas ref={canvasRef} width={800} height={180} className="pixel-scene" />
        <span className="depth-mark">INTERACTIVE LESSON PREVIEW</span>
      </section>

      <div className="library-grid">
        <section className="panel upload-panel" aria-labelledby="upload-box-title">
          <div className="panel-heading">
            <div>
              <h2 id="upload-box-title">Add a study PDF</h2>
              <p>English text documents · Automatic AI quiz generation</p>
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
            <span>Private offline processing · No data leaves your computer</span>
            <span className="choose-button">Select PDF File</span>
          </div>

          <p className="file-status">
            Upload your study guide or lecture notes to create a 9-question practice quiz.
          </p>
        </section>

        <aside className="panel saved-panel" aria-labelledby="saved-box-title">
          <div className="panel-heading">
            <div>
              <h2 id="saved-box-title">Recent Lessons</h2>
            </div>
          </div>

          {questionSets.length > 0 ? (
            questionSets.slice(0, 3).map((qs) => {
              const lessonTitle =
                "documentName" in qs
                  ? qs.documentName
                  : "title" in (qs as Record<string, unknown>)
                  ? String((qs as Record<string, unknown>).title)
                  : "Study Lesson";
              const lessonId = qs.id;
              return (
                <article key={qs.id} className="saved-card">
                  <div className="pdf-mark">PDF</div>
                  <div className="saved-copy">
                    <button
                      type="button"
                      className="saved-title-btn"
                      onClick={() =>
                        onSelectLesson ? onSelectLesson(lessonId, "resume") : onGoToSeas()
                      }
                      title={`Open ${lessonTitle}`}
                    >
                      {lessonTitle}
                    </button>
                    <span>9 questions · Ready to practice</span>
                  </div>
                  <button
                    type="button"
                    className="text-button retake-btn"
                    onClick={() =>
                      onSelectLesson ? onSelectLesson(lessonId, "new") : onGoToSeas()
                    }
                    title="Retake this lesson from the beginning"
                  >
                    Retake ↺
                  </button>
                </article>
              );
            })
          ) : (
            <article className="saved-card">
              <div className="pdf-mark">PDF</div>
              <div className="saved-copy">
                <button
                  type="button"
                  className="saved-title-btn"
                  onClick={() =>
                    onSelectLesson ? onSelectLesson("marine-biology", "resume") : onGoToSeas()
                  }
                  title="Open Introduction to Marine Biology"
                >
                  Introduction to Marine Biology
                </button>
                <span>3 topics · 9 questions · Accomplished</span>
              </div>
              <button
                type="button"
                className="text-button retake-btn"
                onClick={() =>
                  onSelectLesson ? onSelectLesson("marine-biology", "new") : onGoToSeas()
                }
                title="Retake this lesson from the beginning"
              >
                Retake ↺
              </button>
            </article>
          )}

          <article className="saved-card active-run">
            <div className="resume-mark">↗</div>
            <div className="saved-copy">
              <button
                type="button"
                className="saved-title-btn"
                onClick={() =>
                  onSelectLesson ? onSelectLesson("marine-biology", "resume") : onGoToSeas()
                }
                title="Resume in-progress lesson"
              >
                In-Progress Lesson · {activeInstanceId || "PN-001"}
              </button>
              <span>Introduction to Marine Biology</span>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  onSelectLesson ? onSelectLesson("marine-biology", "resume") : onGoToSeas()
                }
              >
                Resume
              </button>
              <button
                className="text-button retake-btn"
                type="button"
                onClick={() =>
                  onSelectLesson ? onSelectLesson("marine-biology", "new") : onGoToSeas()
                }
                title="Retake from the beginning"
              >
                Retake ↺
              </button>
            </div>
          </article>

          <button
            className="secondary-button full-button"
            type="button"
            onClick={onGoToSeas}
          >
            Choose a lesson <span>→</span>
          </button>

          <button
            className="secondary-button full-button"
            type="button"
            onClick={onOpenUpload}
          >
            Upload study notes <span>→</span>
          </button>
        </aside>
      </div>
    </section>
  );
}
