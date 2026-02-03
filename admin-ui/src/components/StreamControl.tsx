import { useState } from "react";
import { useStreamStore } from "../store/stream-store";
import { CollapsiblePanel } from "./CollapsiblePanel";
import type { StreamMode, GameId, AdminCommand } from "../types";

interface Props {
  sendCommand: (cmd: AdminCommand) => void;
}

export function StreamControl({ sendCommand }: Props) {
  const phase = useStreamStore((s) => s.state.phase);
  const mode = useStreamStore((s) => s.state.mode);
  const gamesCompleted = useStreamStore((s) => s.state.gamesCompleted);
  const currentGame = useStreamStore((s) => s.state.currentGameConfig);
  const selectedGames = useStreamStore((s) => s.selectedGames);
  const [selectedMode, setSelectedMode] = useState<StreamMode>("multi");

  const handleStart = () => {
    const config: { mode: StreamMode; selectedGames?: GameId[] } = { mode: selectedMode };
    if (selectedGames.length > 0) {
      config.selectedGames = selectedGames;
    }
    sendCommand({
      type: "stream:start",
      config,
    });
  };

  const handleStop = () => sendCommand({ type: "stream:stop" });
  const handlePause = () => sendCommand({ type: "stream:pause" });
  const handleResume = () => sendCommand({ type: "stream:resume" });
  const handleSkip = () => sendCommand({ type: "game:skip" });

  const isIdle = phase === "idle" || phase === "stopped";
  const isPaused = phase === "paused";
  const isActive = phase === "playing" || phase === "starting" || phase === "transitioning";

  return (
    <CollapsiblePanel title="Stream Control" className="stream-control">
      <div className="status-row">
        <span className="label">Status:</span>
        <span className={`phase-badge phase-${phase}`}>{phase}</span>
      </div>

      {currentGame && (
        <div className="status-row">
          <span className="label">Game:</span>
          <span>{currentGame.nameJa}</span>
        </div>
      )}

      <div className="status-row">
        <span className="label">Completed:</span>
        <span>{gamesCompleted}</span>
      </div>

      {isIdle && (
        <div className="control-group">
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value as StreamMode)}
          >
            <option value="single">Single Game</option>
            <option value="multi">Multi Game (Loop)</option>
          </select>
          <button className="btn btn-start" onClick={handleStart}>
            Start
          </button>
        </div>
      )}

      {isActive && (
        <div className="control-group">
          <button className="btn btn-pause" onClick={handlePause}>
            Pause
          </button>
          <button className="btn btn-stop" onClick={handleStop}>
            Stop
          </button>
          <button className="btn btn-skip" onClick={handleSkip}>
            Skip Game
          </button>
        </div>
      )}

      {isPaused && (
        <div className="control-group">
          <button className="btn btn-start" onClick={handleResume}>
            Resume
          </button>
          <button className="btn btn-stop" onClick={handleStop}>
            Stop
          </button>
        </div>
      )}
    </CollapsiblePanel>
  );
}
