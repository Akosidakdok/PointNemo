import { type AuthenticatedUser } from "../auth/auth.types";

export type AppNavScreen =
  | "library"
  | "upload"
  | "sonar"
  | "seas"
  | "descent"
  | "boss"
  | "results"
  | "profile"
  | "leaderboard";

interface AppHeaderProps {
  currentScreen: AppNavScreen;
  onNavigate: (screen: AppNavScreen) => void;
  currentUser: AuthenticatedUser | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  bossUnlocked?: boolean;
  resultsUnlocked?: boolean;
  activeInstanceId?: string | null;
}

export function AppHeader({
  currentScreen,
  onNavigate,
  currentUser,
  onLogout,
  onOpenSettings,
  theme,
  onToggleTheme,
  bossUnlocked = false,
  resultsUnlocked = false,
  activeInstanceId,
}: AppHeaderProps) {
  return (
    <header className="app-header-container" role="banner">
      <div className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => onNavigate("library")}
          aria-label="Point Nemo Home"
        >
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            POINT <b>NEMO</b>
          </span>
        </button>

        <div className="topbar-tools">
          {currentUser && (
            <div className="explorer-status-badge">
              <span className="explorer-dot" aria-hidden="true" />
              <span>{currentUser.displayName.toUpperCase()}</span>
            </div>
          )}

          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            title="Toggle Theme"
          >
            {theme === "light" ? "☾" : "☼"}
          </button>

          <button
            type="button"
            className={`profile-shortcut ${currentScreen === "profile" ? "current-page" : ""}`}
            onClick={() => onNavigate("profile")}
            aria-label="Open Explorer Profile"
          >
            Profile
          </button>

          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: "32px", padding: "6px 10px", fontSize: "11px" }}
            onClick={onOpenSettings}
            aria-label="System Settings"
            title="Settings"
          >
            ⚙
          </button>

          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: "32px", padding: "6px 10px", fontSize: "11px" }}
            onClick={onLogout}
            aria-label="Log Out"
            title="Log Out"
          >
            EXIT
          </button>
        </div>
      </div>

      <nav className="flow-nav" aria-label="Expedition journey steps">
        <button
          type="button"
          className={`nav-step ${currentScreen === "library" ? "active" : ""}`}
          onClick={() => onNavigate("library")}
          aria-current={currentScreen === "library" ? "page" : undefined}
        >
          <b>01</b> Library
        </button>

        <button
          type="button"
          className={`nav-step ${currentScreen === "upload" || currentScreen === "sonar" ? "active" : ""}`}
          onClick={() => onNavigate("upload")}
          aria-current={currentScreen === "upload" || currentScreen === "sonar" ? "page" : undefined}
        >
          <b>02</b> Sonar
        </button>

        <button
          type="button"
          className={`nav-step ${currentScreen === "seas" ? "active" : ""}`}
          onClick={() => onNavigate("seas")}
          aria-current={currentScreen === "seas" ? "page" : undefined}
        >
          <b>03</b> Choose Sea
        </button>

        <button
          type="button"
          className={`nav-step ${currentScreen === "descent" ? "active" : ""}`}
          onClick={() => onNavigate("descent")}
          aria-current={currentScreen === "descent" ? "page" : undefined}
          title={activeInstanceId ? `Active Descent: ${activeInstanceId}` : "Ocean Descent World Map"}
        >
          <b>04</b> Descent
        </button>

        <button
          type="button"
          className={`nav-step ${currentScreen === "boss" ? "active" : ""}`}
          onClick={() => onNavigate("boss")}
          disabled={!bossUnlocked}
          aria-current={currentScreen === "boss" ? "page" : undefined}
          title={bossUnlocked ? "Final Review Boss (Unlocked)" : "Clear all three parts and reach the boss marker"}
        >
          <b>05</b> Lesson Boss
        </button>

        <button
          type="button"
          className={`nav-step ${currentScreen === "results" ? "active" : ""}`}
          onClick={() => onNavigate("results")}
          disabled={!resultsUnlocked}
          aria-current={currentScreen === "results" ? "page" : undefined}
        >
          <b>06</b> Results
        </button>

        <span className="nav-divider" aria-hidden="true" />

        <button
          type="button"
          className={`nav-step ${currentScreen === "leaderboard" ? "active" : ""}`}
          onClick={() => onNavigate("leaderboard")}
          aria-current={currentScreen === "leaderboard" ? "page" : undefined}
        >
          Leaderboard
        </button>
      </nav>
    </header>
  );
}
