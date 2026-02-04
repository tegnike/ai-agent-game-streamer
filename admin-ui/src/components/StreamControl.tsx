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
  const configSelectedGames = useStreamStore((s) => s.state.config.selectedGames);
  const availableGames = useStreamStore((s) => s.availableGames);
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

  // Skip Game is disabled when the effective game pool has 1 or fewer entries
  const effectiveGameCount = configSelectedGames?.length || availableGames.length;
  const skipDisabled = effectiveGameCount <= 1;

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

      {isIdle && (
        <p className="hint-text">
          {selectedMode === "single"
            ? "選択中のゲームから1つをランダムにプレイして終了します"
            : "選択中のゲームをランダム順でループ再生します"}
        </p>
      )}

      {isActive && (
        <>
          <div className="control-group">
            <button className="btn btn-pause" onClick={handlePause}>
              Pause
            </button>
            <button className="btn btn-stop" onClick={handleStop}>
              Stop
            </button>
            {mode === "multi" && (
              <button
                className="btn btn-skip"
                onClick={handleSkip}
                disabled={skipDisabled}
              >
                Skip Game
              </button>
            )}
          </div>
          <p className="hint-text">
            Pause: AIの進行を一時停止 / Stop: ゲームを終了してロビーへ
            {mode === "multi" && " / Skip: 次のゲームへスキップ"}
          </p>
        </>
      )}

      {isPaused && (
        <>
          <div className="control-group">
            <button className="btn btn-start" onClick={handleResume}>
              Restart
            </button>
            <button className="btn btn-stop" onClick={handleStop}>
              Stop
            </button>
          </div>
          <p className="hint-text">
            Restart: 同じゲームでAIを再開 / Stop: ゲームを終了してロビーへ
          </p>
        </>
      )}
    </CollapsiblePanel>
  );
}
