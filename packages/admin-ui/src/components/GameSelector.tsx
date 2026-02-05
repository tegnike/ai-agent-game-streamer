import { useStreamStore } from "../store/stream-store";
import { useEffect } from "react";
import { CollapsiblePanel } from "./CollapsiblePanel";
import type { GameId } from "../types";

export function GameSelector() {
  const games = useStreamStore((s) => s.availableGames);
  const setGames = useStreamStore((s) => s.setAvailableGames);
  const selectedGames = useStreamStore((s) => s.selectedGames);
  const toggleGame = useStreamStore((s) => s.toggleGame);
  const setSelectedGames = useStreamStore((s) => s.setSelectedGames);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then(setGames)
      .catch(() => {});
  }, [setGames]);

  const allSelected = games.length > 0 && games.every((g) => selectedGames.includes(g.id));
  const noneSelected = selectedGames.length === 0;

  const handleSelectAll = () => {
    setSelectedGames(games.map((g) => g.id as GameId));
  };

  const handleClearAll = () => {
    setSelectedGames([]);
  };

  const headerActions = (
    <div className="game-select-actions">
      <button className="btn btn-sm" onClick={handleSelectAll} disabled={allSelected}>
        All
      </button>
      <button className="btn btn-sm" onClick={handleClearAll} disabled={noneSelected}>
        Clear
      </button>
    </div>
  );

  return (
    <CollapsiblePanel title="Games" className="game-selector" headerRight={headerActions}>
      {noneSelected && (
        <div className="hint-text">未選択 = 全ゲーム対象</div>
      )}
      <ul className="game-list">
        {games.map((game) => {
          const checked = selectedGames.includes(game.id);
          return (
            <li
              key={game.id}
              className={`game-item ${checked ? "game-item-selected" : ""}`}
              onClick={() => toggleGame(game.id)}
            >
              <input
                type="checkbox"
                className="game-checkbox"
                checked={checked}
                onChange={() => toggleGame(game.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="game-name">{game.nameJa}</span>
              <span className="game-id">({game.name})</span>
            </li>
          );
        })}
      </ul>
    </CollapsiblePanel>
  );
}
