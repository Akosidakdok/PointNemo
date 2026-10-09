import { type AuthenticatedUser } from "../auth/auth.types";

interface LeaderboardViewProps {
  currentUser: AuthenticatedUser | null;
}

export function LeaderboardView({ currentUser }: LeaderboardViewProps) {
  const currentName = currentUser?.displayName || "Deep Diver";

  const entries = [
    { rank: "01", initials: "MK", name: "Mira K.", descents: 12, xp: "2,840", isYou: false },
    { rank: "02", initials: "JR", name: "Jules R.", descents: 10, xp: "2,420", isYou: false },
    {
      rank: "03",
      initials: currentName.slice(0, 2).toUpperCase(),
      name: currentName,
      descents: 3,
      xp: "640",
      isYou: true,
    },
    { rank: "04", initials: "AS", name: "Alex S.", descents: 2, xp: "390", isYou: false },
    { rank: "05", initials: "TK", name: "Taylor K.", descents: 1, xp: "180", isYou: false },
  ];

  return (
    <section className="leaderboard-view" aria-labelledby="leaderboard-title">
      <div className="eyebrow">COMMUNITY EXPEDITIONS</div>
      <div className="page-heading">
        <div>
          <h1 id="leaderboard-title">Leaderboard</h1>
          <p>Local expedition standings and depth clearance ratings.</p>
        </div>
        <span className="leaderboard-period">THIS WEEK</span>
      </div>

      <section className="panel leaderboard-panel">
        <div className="leaderboard-heading">
          <span>RANK</span>
          <span>DIVER</span>
          <span>DESCENTS</span>
          <span>XP</span>
        </div>

        <ol className="leaderboard-list">
          {entries.map((entry) => (
            <li key={entry.rank} className={entry.isYou ? "current-player" : ""}>
              <span className="rank">{entry.rank}</span>
              <span className="diver-name">
                <i>{entry.initials}</i>
                <b>{entry.name}</b>
                {entry.isYou && <small>YOU</small>}
              </span>
              <span className="descent-count">{entry.descents}</span>
              <strong className="leader-score">{entry.xp}</strong>
            </li>
          ))}
        </ol>
      </section>

      <p className="leaderboard-note">
        Preview telemetry only · Online accounts and network leaderboards are not connected in local offline mode.
      </p>
    </section>
  );
}
