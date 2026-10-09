import { type LessonRecord } from "../../game/lessonCatalog";

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
      <div className="eyebrow">STEP 03 · CHOOSE A LESSON</div>
      <div className="page-heading">
        <div>
          <h1 id="seas-title">Choose your lesson</h1>
          <p>Pick a study guide to begin your interactive quiz map.</p>
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
                  {lesson.isCustom ? "CUSTOM STUDY LESSON" : "3 TOPICS · 9 QUESTIONS"}
                </p>
                <h2>{lesson.title}</h2>
                <div className="sea-topic-list" aria-label="Lesson topics">
                  {lesson.topics
                    .filter((t) => t && t !== "Lesson boss")
                    .map((topic, tIdx) => (
                      <span key={tIdx} className="sea-topic-pill">
                        <span className="topic-num">{tIdx + 1}</span>
                        <span className="topic-text">{topic}</span>
                      </span>
                    ))}
                </div>
                <small>
                  {hasActiveInstance
                    ? `In-progress lesson · ${activeInstanceId}`
                    : "Ready to start"}
                </small>
              </div>
              <div className="sea-card-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!hasActiveInstance}
                  onClick={() => onSelectLesson(lesson.id, "resume")}
                  aria-label={`Resume lesson for ${lesson.title}`}
                >
                  Resume Lesson
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onSelectLesson(lesson.id, "new")}
                  aria-label={`Start lesson for ${lesson.title}`}
                >
                  Start Lesson <span>→</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
