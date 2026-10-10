import { type AuthenticatedUser } from "../auth/auth.types";

export type AppNavScreen =
  | "library"
  | "upload"
  | "sonar"
  | "seas"
  | "descent"
  | "boss"
  | "results"
  | "profile";

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
  maxUnlockedStep?: number;
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
  maxUnlockedStep = 1,
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
            title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === "light" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5" fill="currentColor" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
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
            style={{ minHeight: "44px", minWidth: "44px", padding: "6px 10px", fontSize: "11px" }}
            onClick={onOpenSettings}
            aria-label="System Settings"
            title="Settings"
          >
            ⚙
          </button>

          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: "44px", minWidth: "44px", padding: "6px 10px", fontSize: "11px" }}
            onClick={onLogout}
            aria-label="Log Out"
            title="Log Out"
          >
            EXIT
          </button>
        </div>
      </div>

      <nav className="flow-nav" aria-label="Study journey steps">
        <button
          type="button"
          className={`nav-step ${currentScreen === "library" ? "active" : ""}`}
          onClick={() => onNavigate("library")}
          aria-current={currentScreen === "library" ? "page" : undefined}
        >
          <b>01</b> Library
        </button>

        {(maxUnlockedStep >= 2 || currentScreen === "upload" || currentScreen === "sonar") && (
          <button
            type="button"
            className={`nav-step ${currentScreen === "upload" || currentScreen === "sonar" ? "active" : ""}`}
            onClick={() => onNavigate("upload")}
            aria-current={currentScreen === "upload" || currentScreen === "sonar" ? "page" : undefined}
          >
            <b>02</b> Scan Notes
          </button>
        )}

        {(maxUnlockedStep >= 3 || currentScreen === "seas") && (
          <button
            type="button"
            className={`nav-step ${currentScreen === "seas" ? "active" : ""}`}
            onClick={() => onNavigate("seas")}
            aria-current={currentScreen === "seas" ? "page" : undefined}
          >
            <b>03</b> Choose Lesson
          </button>
        )}

        {(maxUnlockedStep >= 4 || currentScreen === "descent") && (
          <button
            type="button"
            className={`nav-step ${currentScreen === "descent" ? "active" : ""}`}
            onClick={() => onNavigate("descent")}
            aria-current={currentScreen === "descent" ? "page" : undefined}
            title={activeInstanceId ? `Active Lesson: ${activeInstanceId}` : "Study Map"}
          >
            <b>04</b> Study Map
          </button>
        )}

        <button
          type="button"
          className={`nav-step ${currentScreen === "boss" ? "active" : ""}`}
          onClick={() => onNavigate("boss")}
          disabled={!bossUnlocked}
          aria-current={currentScreen === "boss" ? "page" : undefined}
          title={bossUnlocked ? "Final Review Boss (Unlocked)" : "Clear all three parts and reach the boss marker"}
        >
          Final Review
        </button>

        <button
          type="button"
          className={`nav-step ${currentScreen === "results" ? "active" : ""}`}
          onClick={() => onNavigate("results")}
          disabled={!resultsUnlocked}
          aria-current={currentScreen === "results" ? "page" : undefined}
        >
          <b>05</b> Results
        </button>

      </nav>
    </header>
  );
}
