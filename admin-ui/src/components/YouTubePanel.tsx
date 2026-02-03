import { useState } from "react";
import { CollapsiblePanel } from "./CollapsiblePanel";

export function YouTubePanel() {
  const [liveChatId, setLiveChatId] = useState("");
  const [videoId, setVideoId] = useState("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!liveChatId && !videoId) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/comments/youtube/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          liveChatId: liveChatId || undefined,
          videoId: videoId || undefined,
        }),
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
      await fetch("/api/comments/youtube/disconnect", { method: "POST" });
      setConnected(false);
    } catch {
      // ignore
    }
  };

  return (
    <CollapsiblePanel title="YouTube Live Chat" className="youtube-panel" defaultOpen={false}>
      {connected ? (
        <div>
          <div className="status-row">
            <span className="label">Status:</span>
            <span className="status-connected">Connected</span>
          </div>
          <button className="btn btn-stop" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <div className="youtube-form">
          <input
            type="text"
            placeholder="Live Chat ID"
            value={liveChatId}
            onChange={(e) => setLiveChatId(e.target.value)}
          />
          <span className="youtube-or">or</span>
          <input
            type="text"
            placeholder="Video ID"
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
          />
          <button
            className="btn btn-start"
            onClick={handleConnect}
            disabled={loading || (!liveChatId && !videoId)}
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
          {error && <div className="error-text">{error}</div>}
          <div className="hint-text">
            Requires YOUTUBE_API_KEY environment variable on the server.
          </div>
        </div>
      )}
    </CollapsiblePanel>
  );
}
