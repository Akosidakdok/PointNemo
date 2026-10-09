export function ExpeditionStatus() {
  return (
    <div className="expedition-status-strip" aria-label="Current Expedition Telemetry">
      <div className="status-metric">
        <span className="metric-dot dot-cyan" aria-hidden="true" />
        <span className="metric-label">DEPTH</span>
        <span className="metric-value">0000 M</span>
      </div>
      <span className="metric-divider" aria-hidden="true">·</span>
      <div className="status-metric">
        <span className="metric-dot dot-gold" aria-hidden="true" />
        <span className="metric-label">BEACON</span>
        <span className="metric-value text-cyan">SIGNAL READY</span>
      </div>
    </div>
  );
}
