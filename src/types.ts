export type GameId = "othello" | "gomoku" | "sokoban" | "card-battle" | "minesweeper" | "chess";

export interface GameConfig {
  id: GameId;
  name: string;
  nameJa: string;
  directory: string;
  controlMethod: "cell-click" | "move" | "dom-click";
  apiMethods: string[];
  port: number;
}

export interface StreamingState {
  currentGame: GameId | null;
  sessionId: string | null;
  serverPid: number | null;
  gamesPlayed: GameId[];
  isPlaying: boolean;
}
