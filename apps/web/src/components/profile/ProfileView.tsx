import { useEffect, useRef } from "react";
import { type AssetBundle, drawFrame, speciesScale } from "../../game/sprites";
import { type AuthenticatedUser } from "../auth/auth.types";

interface ProfileViewProps {
  currentUser: AuthenticatedUser | null;
  bundle: AssetBundle | null;
  reducedMotion?: boolean;
}

export function ProfileView({
  currentUser,
  bundle,
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
    const pScale = speciesScale(bundle, "explorer", 72);
    drawFrame(
      ctx,
      bundle,
      "explorer.idle.down",
      Math.round(canvas.width / 2),
      Math.round(canvas.height * 0.58),
      pScale
    );
  }, [bundle]);

  const displayName = currentUser?.displayName || "Deep Diver";
  const email = currentUser?.email || "offline@pointnemo.local";

  return (
    <section className="profile-view" aria-labelledby="profile-title">
      <div className="eyebrow">EXPLORER DOSSIER</div>
      <div className="page-heading">
        <div>
          <h1 id="profile-title">Profile</h1>
          <p>Local expedition credentials, diving experience, and milestone achievements.</p>
        </div>
      </div>

      <section className="profile-hero panel">
        <div className="profile-avatar">
          <canvas ref={canvasRef} width={112} height={112} className="pixel-scene" />
        </div>
        <div className="profile-identity">
          <p className="eyebrow">ACTIVE DIVER</p>
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
          <span>COMPLETED DESCENTS</span>
          <b>03</b>
        </section>
        <section className="panel profile-stat">
          <span>BEST FINAL REVIEW</span>
          <b>9 / 9</b>
        </section>
        <section className="panel profile-stat">
          <span>TOTAL XP ACCRUED</span>
          <b>640</b>
        </section>
      </div>

      <section className="panel profile-badges">
        <h2>Expedition Milestones</h2>
        <div className="milestone-row">
          <span className="milestone-icon" aria-hidden="true">
            ✦
          </span>
          <span>
            <b>Descent Complete</b>
            <small>Reach Point Nemo and conquer the final review challenge</small>
          </span>
          <span className="milestone-state">EARNED</span>
        </div>
        <div className="milestone-row">
          <span className="milestone-icon" aria-hidden="true">
            ◉
          </span>
          <span>
            <b>Benthic Scholar</b>
            <small>Extract 3 local documents using offline Ollama</small>
          </span>
          <span className="milestone-state">EARNED</span>
        </div>
      </section>
    </section>
  );
}
