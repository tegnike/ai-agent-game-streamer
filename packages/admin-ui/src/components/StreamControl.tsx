import { useState } from "react";
import { useStreamStore } from "../store/stream-store";
import { CollapsiblePanel } from "./CollapsiblePanel";
import type { StreamMode, GameId, AdminCommand, StreamConfig } from "../types";

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
  const [maxGames, setMaxGames] = useState<number>(0);
  const [aiAutoEnd, setAiAutoEnd] = useState(false);

  const handleStart = () => {
    const config: StreamConfig = {
      mode: selectedMode,
      maxGames: selectedMode === "multi" && maxGames > 0 ? maxGames : undefined,
      aiAutoEnd: selectedMode === "multi" ? aiAutoEnd : undefined,
    };
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

      {isIdle && selectedMode === "multi" && (
        <div className="control-group">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">最大ゲーム数:</label>
            <input
              type="number"
              min="0"
              step="1"
              value={maxGames}
              onChange={(e) => setMaxGames(Math.max(0, Math.floor(Number(e.target.value))))}
              className="w-20 px-2 py-1 border rounded text-sm"
              placeholder="0=無制限"
            />
            <span className="text-xs text-gray-400">0=無制限</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={aiAutoEnd}
              onChange={(e) => setAiAutoEnd(e.target.checked)}
            />
            AIが自動で終了判断
          </label>
        </div>
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
