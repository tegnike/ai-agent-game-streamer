import { useState, useCallback } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { ConnectionStatus } from "./components/ConnectionStatus";
import { StreamControl } from "./components/StreamControl";
import { GameSelector } from "./components/GameSelector";
import { AgentMonitor } from "./components/AgentMonitor";
import { MessagePanel } from "./components/MessagePanel";
import { CommentPanel } from "./components/CommentPanel";
import { CommentSourcePanel } from "./components/CommentSourcePanel";
import { VisualBridgePanel } from "./components/VisualBridgePanel";
import { BrowserPanel } from "./components/BrowserPanel";
import { EventLog } from "./components/EventLog";
import { ResizeHandle } from "./components/ResizeHandle";

export default function App() {
  const { sendCommand } = useWebSocket();

  const [leftWidth, setLeftWidth] = useState(520);
  const [topRatio, setTopRatio] = useState(0.6);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((prev) => Math.max(300, Math.min(prev + delta, 900)));
  }, []);

  const handleVerticalSplit = useCallback((delta: number) => {
    setTopRatio((prev) => {
      const container = document.querySelector(".column-right");
      if (!container) return prev;
      const h = container.clientHeight;
      const newRatio = prev + delta / h;
      return Math.max(0.15, Math.min(newRatio, 0.85));
    });
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI Agent Game Streamer - Admin</h1>
        <ConnectionStatus />
      </header>

      <main className="app-main">
        <div className="column column-left" style={{ width: leftWidth, minWidth: leftWidth }}>
          <StreamControl sendCommand={sendCommand} />
          <BrowserPanel />
          <GameSelector />
          <MessagePanel sendCommand={sendCommand} />
          <CommentPanel sendCommand={sendCommand} />
          <CommentSourcePanel />
          <VisualBridgePanel />
        </div>
        <ResizeHandle direction="horizontal" onResize={handleLeftResize} />
        <div className="column column-right">
          <div className="agent-monitor-wrapper" style={{ flex: topRatio }}>
            <AgentMonitor />
          </div>
          <ResizeHandle direction="vertical" onResize={handleVerticalSplit} />
          <div className="event-log-wrapper" style={{ flex: 1 - topRatio }}>
            <EventLog />
          </div>
        </div>
      </main>
    </div>
  );
}
