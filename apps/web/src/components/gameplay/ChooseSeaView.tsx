import { type LessonRecord, lessonParts } from "../../game/lessonCatalog";

interface ChooseSeaViewProps {
  lessons: LessonRecord[];
  activeInstancesByLesson: Map<string, string>; // lessonId -> instanceId
  onSelectLesson: (lessonId: string, action: "resume" | "new") => void;
  onUploadNewPdf: () => void;
}

export function ChooseSeaView({
  lessons,
  activeInstancesByLesson,
  onSelectLesson,
  onUploadNewPdf,
}: ChooseSeaViewProps) {
  return (
    <section className="choose-sea-view" aria-labelledby="seas-title">
      <div className="eyebrow">MODULE 03 · CHOOSE A SEA</div>
      <div className="page-heading">
        <div>
          <h1 id="seas-title">Choose your sea</h1>
          <p>Each lesson opens its own map route, isolated descent run, and enemy encounters.</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={onUploadNewPdf}
        >
          + Add New PDF
        </button>
      </div>

      <div className="sea-list">
        {lessons.map((lesson, idx) => {
          const activeInstanceId = activeInstancesByLesson.get(lesson.id);
          const hasActiveInstance = Boolean(activeInstanceId);

          return (
            <article key={lesson.id} className="panel sea-card" data-sea-card={lesson.id}>
              <div
                className={`sea-map-thumb ${idx % 2 !== 0 ? "sea-map-thumb-alt" : ""}`}
                aria-hidden="true"
              />
              <div className="sea-card-copy">
                <p className="eyebrow">
                  {lesson.isCustom ? "CUSTOM PDF LESSON · 3 TOPICS · 9 QUESTIONS" : "SAMPLE · 3 TOPICS · 3 QUESTIONS"}
                </p>
                <h2>{lesson.title}</h2>
                <p>
                  {lesson.topics
                    .filter((t) => t && t !== "Lesson boss")
                    .join(" · ")}
                </p>
                <small>
                  {hasActiveInstance
                    ? `Active descent · ${activeInstanceId}`
                    : "No active descent instance"}
                </small>
              </div>
              <div className="sea-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!hasActiveInstance}
                  onClick={() => onSelectLesson(lesson.id, "resume")}
                  aria-label={`Resume active descent for ${lesson.title}`}
                >
                  Resume
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onSelectLesson(lesson.id, "new")}
                  disabled={lesson.isCustom && lessonParts(lesson).some((part)=>part.length!==3)}
                  aria-label={`Start new descent for ${lesson.title}`}
                >
                  Start new descent <span>→</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
