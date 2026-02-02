import type { GameConfig, GameId } from "../types.js";

export const GAME_REGISTRY: Record<GameId, GameConfig> = {
  othello: {
    id: "othello",
    name: "Othello",
    nameJa: "オセロ",
    directory: "othello",
    controlMethod: "cell-click",
    apiMethods: ["handleCellClick", "getValidMoves", "init", "countStones"],
    port: 8888,
  },
  gomoku: {
    id: "gomoku",
    name: "Gomoku",
    nameJa: "五目並べ",
    directory: "gomoku",
    controlMethod: "cell-click",
    apiMethods: ["handleCellClick", "getValidMoves", "init"],
    port: 8888,
  },
  sokoban: {
    id: "sokoban",
    name: "Sokoban",
    nameJa: "倉庫番",
    directory: "sokoban",
    controlMethod: "move",
    apiMethods: ["move", "undo", "loadStage", "isCleared"],
    port: 8888,
  },
  "card-battle": {
    id: "card-battle",
    name: "Card Battle",
    nameJa: "カードバトル",
    directory: "card-battle",
    controlMethod: "dom-click",
    apiMethods: ["playCard", "sacrificeCard", "getGameState", "getValidMoves"],
    port: 8888,
  },
};

export function getRandomGame(exclude: GameId[] = []): GameConfig {
  const available = Object.values(GAME_REGISTRY).filter(
    (g) => !exclude.includes(g.id),
  );
  if (available.length === 0) {
    const all = Object.values(GAME_REGISTRY);
    return all[Math.floor(Math.random() * all.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}
