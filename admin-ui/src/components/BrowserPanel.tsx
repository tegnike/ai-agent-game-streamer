import { useState } from "react";
import { useStreamStore } from "../store/stream-store";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function BrowserPanel() {
  const browser = useStreamStore((s) => s.state.browser);
  const [cdpPort, setCdpPort] = useState("9222");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunch = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/browser/launch", { method: "POST" });
      const data = await resp.json();
      if (!data.success) setError(data.error ?? "Launch failed");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectCDP = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/browser/launch-cdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: parseInt(cdpPort, 10) }),
      });
      const data = await resp.json();
      if (!data.success) setError(data.error ?? "Connection failed");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/browser/close", { method: "POST" });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const isRunning = browser?.running ?? false;

  return (
    <CollapsiblePanel title="Browser" className="browser-panel">
      <div className="status-row">
        <span className="label">Status:</span>
        <span className={isRunning ? "status-connected" : ""}>
          {isRunning ? `Running (${browser.mode})` : "Stopped"}
        </span>
      </div>

      {browser?.cdpPort && (
        <div className="status-row">
          <span className="label">CDP Port:</span>
          <span>{browser.cdpPort}</span>
        </div>
      )}

      {isRunning ? (
        <div>
          {browser.launchedByUs ? (
            <button className="btn btn-stop" onClick={handleClose} disabled={loading}>
              Close Browser
            </button>
          ) : (
            <div className="hint-text">
              External browser detected. Close manually or disconnect.
            </div>
          )}
        </div>
      ) : (
        <div className="visual-form">
          <button
            className="btn btn-send"
            onClick={handleLaunch}
            disabled={loading}
          >
            {loading ? "Starting..." : "Launch Browser"}
          </button>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="CDP port (e.g. 9222)"
              value={cdpPort}
              onChange={(e) => setCdpPort(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn"
              onClick={handleConnectCDP}
              disabled={loading || !cdpPort}
            >
              Connect CDP
            </button>
          </div>
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
    </CollapsiblePanel>
  );
}
