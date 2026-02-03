import { useState } from "react";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function OneCommePanel() {
  const [port, setPort] = useState("11180");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!port) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/comments/onecomme/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: parseInt(port, 10) }),
      });
      const data = await resp.json();
      if (data.success) {
        setConnected(true);
      } else {
        setError(data.error ?? "Connection failed");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch("/api/comments/onecomme/disconnect", { method: "POST" });
      setConnected(false);
    } catch {
      // ignore
    }
  };

  return (
    <CollapsiblePanel title="わんコメ (OneComme)" className="onecomme-panel" defaultOpen={false}>
      {connected ? (
        <div>
          <div className="status-row">
            <span className="label">Status:</span>
            <span className="status-connected">Connected (port {port})</span>
          </div>
          <button className="btn btn-stop" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="onecomme-form">
          <input
            type="text"
            placeholder="Port (default: 11180)"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
          <button
            className="btn btn-start"
            onClick={handleConnect}
            disabled={loading || !port}
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
          {error && <div className="error-text">{error}</div>}
          <div className="hint-text">
            わんコメが起動している必要があります。
          </div>
        </div>
      )}
    </CollapsiblePanel>
  );
}
