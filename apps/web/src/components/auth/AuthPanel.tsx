import { useState, type FormEvent } from "react";
import { AuthInput } from "./AuthInput";
import { RPGButton } from "./RPGButton";
import { type LocalExplorer } from "./auth.types";

export interface AuthPanelProps { onSuccess: (user: LocalExplorer) => void }

export function AuthPanel({ onSuccess }: AuthPanelProps) {
  const [name, setName] = useState("");
  const [remembered, setRemembered] = useState(false);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSuccess({ displayName: name.trim() || "Explorer", remembered });
  }
  return <div className="rpg-auth-panel" role="region" aria-label="Local explorer display name">
    <div className="terminal-top-badge"><span className="terminal-id">LOCAL EXPLORER // THIS LAPTOP</span></div>
    <div className="auth-mode-headline"><h2 className="mode-main-title">READY TO STUDY?</h2>
      <p className="mode-sub-title">Point Nemo supports one local user. Your name only changes the display; everyone using this app on the laptop shares its library.</p>
      <p>No account, email, or password is required. Progress is saved by the local server.</p>
    </div>
    <form onSubmit={handleSubmit} className="auth-form-slot">
      <AuthInput label="EXPLORER NAME (OPTIONAL)" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} autoComplete="nickname" hint="Leave blank to use Explorer" />
      <label className="auth-label"><input type="checkbox" checked={remembered} onChange={(event) => setRemembered(event.target.checked)} /> Remember this display name in this browser</label>
      <RPGButton type="submit">OPEN LOCAL LIBRARY</RPGButton>
    </form>
  </div>;
}
