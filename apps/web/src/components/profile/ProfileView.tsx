import { useEffect, useRef } from "react";
import { type AssetBundle, drawFrame, speciesScale } from "../../game/sprites";
import { type AuthenticatedUser } from "../auth/auth.types";

interface ProfileViewProps {
  currentUser: AuthenticatedUser | null;
  bundle: AssetBundle | null;
  reducedMotion?: boolean;
  onBack?: () => void;
}

export function ProfileView({
  currentUser,
  bundle,
  onBack,
}: ProfileViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bundle) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // Diver avatar centered
    try {
      const pScale = speciesScale(bundle, "explorer", 72);
      drawFrame(
        ctx,
        bundle,
        "explorer.down.0",
        Math.round(canvas.width / 2),
        Math.round(canvas.height * 0.58),
        pScale
      );
    } catch (err) {
      console.warn("Failed to render explorer avatar on profile canvas:", err);
    }
  }, [bundle]);

  const displayName = currentUser?.displayName || "Deep Diver";
  const email = currentUser?.email || "offline@pointnemo.local";

  return (
    <section className="profile-view" aria-labelledby="profile-title">
      <div className="eyebrow">LEARNER PROFILE</div>
      <div className="page-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 id="profile-title">My Profile</h1>
          <p>Your study progress, quiz scores, and achievements.</p>
        </div>
        {onBack && (
          <button
            type="button"
            className="secondary-button"
            onClick={onBack}
            style={{ alignSelf: "center", padding: "8px 14px", fontSize: "12px" }}
          >
            ← Back to Library
          </button>
        )}
      </div>

      <section className="profile-hero panel">
        <div className="profile-avatar">
          <canvas ref={canvasRef} width={112} height={112} className="pixel-scene" />
        </div>
        <div className="profile-identity">
          <p className="eyebrow">STUDENT EXPLORER</p>
          <h2>{displayName}</h2>
          <p>
            Level 04 <span>·</span> 640 / 1,000 XP <span>·</span> {email}
          </p>
          <div className="xp-track" aria-label="640 of 1000 XP toward next level">
            <i style={{ width: "64%" }} />
          </div>
        </div>
      </section>

      <div className="profile-stats">
        <section className="panel profile-stat">
          <span>COMPLETED LESSONS</span>
          <b>03</b>
        </section>
        <section className="panel profile-stat">
          <span>BEST QUIZ SCORE</span>
          <b>9 / 9</b>
        </section>
        <section className="panel profile-stat">
          <span>TOTAL POINTS EARNED</span>
          <b>640</b>
        </section>
      </div>

      <section className="panel profile-badges">
        <h2>Study Milestones</h2>
        <div className="milestone-row">
          <span className="milestone-icon" aria-hidden="true">
            ✦
          </span>
          <span>
            <b>Lesson Master</b>
            <small>Complete all 3 topics and pass the final review quiz</small>
          </span>
          <span className="milestone-state">EARNED</span>
        </div>
        <div className="milestone-row">
          <span className="milestone-icon" aria-hidden="true">
            ◉
          </span>
          <span>
            <b>Document Scholar</b>
            <small>Turn 3 study documents into practice quiz lessons</small>
          </span>
          <span className="milestone-state">EARNED</span>
        </div>
      </section>
    </section>
  );
}
