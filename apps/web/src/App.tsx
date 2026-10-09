import { useEffect, useState } from "react";
import { getAppStatus, type AppStatus } from "./api";
import { BattleEncounter } from "./components/BattleEncounter";
import { ExpeditionMap, mapNodes, type MapNode } from "./components/ExpeditionMap";

const initialStatus: AppStatus = {
  api: { available: false, message: "Checking local API…" },
  ai: { available: false, message: "Checking Ollama…" },
};

function App() {
  const [status, setStatus] = useState<AppStatus>(initialStatus);
  const [selectedNode, setSelectedNode] = useState<MapNode>(mapNodes[0]);

  useEffect(() => {
    let active = true;
    void getAppStatus().then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    return () => { active = false; };
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Point Nemo home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>POINT <b>NEMO</b></span>
        </a>
        <div className="topbar-center"><span className="live-dot" /> STUDY EXPEDITION <span className="topbar-divider">/</span> FIELD LOG 001</div>
        <div className={`connection-pill${status.api.available ? " is-online" : " is-offline"}`} title={status.api.message}>
          <span className="connection-dot" />
          {status.api.available ? "LOCAL SYSTEMS ONLINE" : "LOCAL SYSTEMS OFFLINE"}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-rule" /> EXPEDITION 01 <span className="eyebrow-muted">· SOUTH PACIFIC</span></p>
          <h1>The ocean<br />keeps its <em>secrets.</em></h1>
          <p className="hero-description">Descend into your next lesson. Navigate the unknown, meet the life that thrives below, and bring what you learn back to the surface.</p>
          <div className="hero-meta">
            <span><b>01</b> ACTIVE ROUTE</span>
            <span><b>04</b> DEPTH MARKERS</span>
            <span><b>∞</b> CURIOSITY</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="depth-ring ring-outer" /><div className="depth-ring ring-mid" /><div className="depth-ring ring-inner" />
          <div className="hero-orb"><span className="orb-cross" /><span className="orb-label">48°52′S<br />123°23′W</span></div>
          <span className="hero-coordinate hero-coordinate-top">PACIFIC<br />OCEAN</span>
          <span className="hero-coordinate hero-coordinate-bottom">POINT NEMO<br /><b>THE OCEANIC POLE OF INACCESSIBILITY</b></span>
          <i className="drift drift-a" /><i className="drift drift-b" /><i className="drift drift-c" />
        </div>
      </section>

      <section className="expedition-layout" aria-label="Expedition dashboard">
        <div className="map-column">
          <ExpeditionMap selectedId={selectedNode.id} onSelect={setSelectedNode} />
          <section className="selected-location" aria-live="polite">
            <div className="location-index">{String(mapNodes.findIndex((node) => node.id === selectedNode.id) + 1).padStart(2, "0")}</div>
            <div className="location-copy">
              <p className="eyebrow">SELECTED WAYPOINT <span>· {selectedNode.short.toUpperCase()}</span></p>
              <h3>{selectedNode.label}</h3>
              <p>{selectedNode.detail}</p>
            </div>
            {selectedNode.kind === "encounter" && <span className="waypoint-open">ENCOUNTER OPEN <i>↗</i></span>}
          </section>
        </div>

        <aside className="side-column" aria-label="Expedition details">
          {selectedNode.kind === "encounter" ? <BattleEncounter /> : (
            <section className="mission-card">
              <div className="mission-header"><p className="eyebrow">CURRENT MISSION</p><span className="mission-number">01 — 04</span></div>
              <h2>Pressure<br /><em>makes life.</em></h2>
              <p className="mission-description">Meet the organisms that turn darkness, cold, and immense pressure into a way of life.</p>
              <div className="mission-separator" />
              <div className="mission-stat"><span>SUBMERSIBLE</span><b>NAUTILUS-01</b></div>
              <div className="mission-stat"><span>DEPTH</span><b>10,935 <small>m</small></b></div>
              <div className="mission-stat"><span>EST. DURATION</span><b>~ 12 <small>min</small></b></div>
              <button className="mission-button" type="button" onClick={() => setSelectedNode(mapNodes.find((node) => node.id === "adaptation")!)}>
                Open lesson briefing <span aria-hidden="true">↗</span>
              </button>
            </section>
          )}

          <section className={`ai-card${status.ai.available ? " ai-ready" : ""}`} aria-live="polite">
            <div className="ai-card-top"><span className="ai-icon" aria-hidden="true">✳</span><span className="eyebrow">LOCAL INTELLIGENCE</span><span className={`ai-state${status.ai.available ? " state-ready" : ""}`}><i />{status.ai.available ? "READY" : "STANDBY"}</span></div>
            <p>{status.ai.message}</p>
            <div className="ai-model"><span>MODEL</span><code>{status.ai.model ?? "OLLAMA · LOCAL"}</code></div>
          </section>

          <div className="ambient-note"><span>↳</span> The map is only the beginning. Every lesson opens a deeper route.</div>
        </aside>
      </section>

      <footer className="footer"><span>POINT NEMO <i>·</i> DEEP SEA STUDY EXPEDITION</span><span>THE FURTHEST PLACE FROM LAND <b>+ 2,688 KM</b></span></footer>
    </main>
  );
}

export default App;
