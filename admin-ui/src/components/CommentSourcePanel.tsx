import { useState } from "react";
import { CollapsiblePanel } from "./CollapsiblePanel";

type SourceTab = "youtube" | "onecomme";

export function CommentSourcePanel() {
  const [activeTab, setActiveTab] = useState<SourceTab>("youtube");

  // YouTube state
  const [ytLiveChatId, setYtLiveChatId] = useState("");
  const [ytVideoId, setYtVideoId] = useState("");
  const [ytConnected, setYtConnected] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);

  // わんコメ state
  const [ocPort, setOcPort] = useState("11180");
  const [ocConnected, setOcConnected] = useState(false);
  const [ocError, setOcError] = useState<string | null>(null);
  const [ocLoading, setOcLoading] = useState(false);

  // YouTube handlers
  const handleYtConnect = async () => {
    if (!ytLiveChatId && !ytVideoId) return;
    setYtLoading(true);
    setYtError(null);
    try {
      const resp = await fetch("/api/comments/youtube/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveChatId: ytLiveChatId || undefined,
          videoId: ytVideoId || undefined,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setYtConnected(true);
      } else {
        setYtError(data.error ?? "Connection failed");
      }
    } catch (err) {
      setYtError(String(err));
    } finally {
      setYtLoading(false);
    }
  };

  const handleYtDisconnect = async () => {
    try {
      await fetch("/api/comments/youtube/disconnect", { method: "POST" });
      setYtConnected(false);
    } catch {
      // ignore
    }
  };

  // わんコメ handlers
  const handleOcConnect = async () => {
    if (!ocPort) return;
    setOcLoading(true);
    setOcError(null);
    try {
      const resp = await fetch("/api/comments/onecomme/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ port: parseInt(ocPort, 10) }),
      });
      const data = await resp.json();
      if (data.success) {
        setOcConnected(true);
      } else {
        setOcError(data.error ?? "Connection failed");
      }
    } catch (err) {
      setOcError(String(err));
    } finally {
      setOcLoading(false);
    }
  };

  const handleOcDisconnect = async () => {
    try {
      await fetch("/api/comments/onecomme/disconnect", { method: "POST" });
      setOcConnected(false);
    } catch {
      // ignore
    }
  };

  return (
    <CollapsiblePanel title="Comment Source" className="comment-source-panel" defaultOpen={false}>
      <div className="source-tabs">
        <button
          className={`source-tab ${activeTab === "youtube" ? "active" : ""}`}
          onClick={() => setActiveTab("youtube")}
        >
          YouTube{ytConnected && <span className="tab-indicator">●</span>}
        </button>
        <button
          className={`source-tab ${activeTab === "onecomme" ? "active" : ""}`}
          onClick={() => setActiveTab("onecomme")}
        >
          わんコメ{ocConnected && <span className="tab-indicator">●</span>}
        </button>
      </div>

      {activeTab === "youtube" && (
        ytConnected ? (
          <div>
            <div className="status-row">
              <span className="label">Status:</span>
              <span className="status-connected">Connected</span>
            </div>
            <button className="btn btn-stop" onClick={handleYtDisconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <div className="source-form">
            <input
              type="text"
              placeholder="Live Chat ID"
              value={ytLiveChatId}
              onChange={(e) => setYtLiveChatId(e.target.value)}
            />
            <span className="source-or">or</span>
            <input
              type="text"
              placeholder="Video ID"
              value={ytVideoId}
              onChange={(e) => setYtVideoId(e.target.value)}
            />
            <button
              className="btn btn-start"
              onClick={handleYtConnect}
              disabled={ytLoading || (!ytLiveChatId && !ytVideoId)}
            >
              {ytLoading ? "Connecting..." : "Connect"}
            </button>
            {ytError && <div className="error-text">{ytError}</div>}
            <div className="hint-text">
              Requires YOUTUBE_API_KEY environment variable on the server.
            </div>
          </div>
        )
      )}

      {activeTab === "onecomme" && (
        ocConnected ? (
          <div>
            <div className="status-row">
              <span className="label">Status:</span>
              <span className="status-connected">Connected (port {ocPort})</span>
            </div>
            <button className="btn btn-stop" onClick={handleOcDisconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <div className="source-form">
            <input
              type="text"
              placeholder="Port (default: 11180)"
              value={ocPort}
              onChange={(e) => setOcPort(e.target.value)}
            />
            <button
              className="btn btn-start"
              onClick={handleOcConnect}
              disabled={ocLoading || !ocPort}
            >
              {ocLoading ? "Connecting..." : "Connect"}
            </button>
            {ocError && <div className="error-text">{ocError}</div>}
            <div className="hint-text">
              わんコメが起動している必要があります。
            </div>
          </div>
        )
      )}
    </CollapsiblePanel>
  );
}
