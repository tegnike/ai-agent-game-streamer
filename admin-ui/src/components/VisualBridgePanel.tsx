import { useState } from "react";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function VisualBridgePanel() {
  const [endpoint, setEndpoint] = useState("");
  const [batchInterval, setBatchInterval] = useState("500");
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfigure = async () => {
    if (!endpoint) return;
    setError(null);
    try {
      const resp = await fetch("/api/visual/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          batchInterval: parseInt(batchInterval, 10) || 500,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setConfigured(true);
      } else {
        setError(data.error ?? "Configuration failed");
      }
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <CollapsiblePanel title="Visual Bridge" className="visual-panel">
      {configured ? (
        <div>
          <div className="status-row">
            <span className="label">Endpoint:</span>
            <span>{endpoint}</span>
          </div>
          <div className="status-row">
            <span className="label">Status:</span>
            <span className="status-connected">Active</span>
          </div>
          <button
            className="btn"
            onClick={() => setConfigured(false)}
          >
            Reconfigure
          </button>
        </div>
      ) : (
        <div className="visual-form">
          <input
            type="text"
            placeholder="HTTP POST endpoint (e.g. http://localhost:5000/api/visual)"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <input
            type="number"
            placeholder="Batch interval (ms)"
            value={batchInterval}
            onChange={(e) => setBatchInterval(e.target.value)}
          />
          <button
            className="btn btn-send"
            onClick={handleConfigure}
            disabled={!endpoint}
          >
            Configure
          </button>
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
    </CollapsiblePanel>
  );
}
