// Shared types mirroring server-side definitions

export type GameId = "othello" | "gomoku" | "sokoban" | "card-battle";

export interface GameConfig {
  id: GameId;
  name: string;
  nameJa: string;
  directory: string;
  controlMethod: string;
  apiMethods: string[];
  port: number;
}

export type StreamMode = "single" | "multi";

export type StreamPhase =
  | "idle"
  | "starting"
  | "playing"
  | "transitioning"
  | "paused"
  | "stopped";

export interface StreamConfig {
  mode: StreamMode;
  selectedGames?: GameId[];
  pauseBetweenGames?: number;
  commentsEnabled?: boolean;
}

export interface StreamState {
  phase: StreamPhase;
  mode: StreamMode;
  currentGame: GameId | null;
  currentGameConfig: GameConfig | null;
  sessionId: string | null;
  gamesPlayed: GameId[];
  gamesCompleted: number;
  agentThought: string | null;
  agentSpeech: string | null;
  config: StreamConfig;
  startedAt: number | null;
  error: string | null;
}

export type AgentActivityType = "text" | "reasoning" | "tool";

export interface AgentActivity {
  id: string;
  type: AgentActivityType;
  content: string;
  toolName?: string;
  toolStatus?: "running" | "completed" | "error";
  timestamp: number;
}

export type CommentStatus = "received" | "queued" | "answered" | "dismissed";

export interface ViewerComment {
  id: string;
  authorName: string;
  text: string;
  platform: string;
  status: CommentStatus;
  timestamp: number;
}

// WebSocket protocol
export type AdminCommand =
  | { type: "stream:start"; config: StreamConfig }
  | { type: "stream:stop" }
  | { type: "stream:pause" }
  | { type: "stream:resume" }
  | { type: "game:skip" }
  | { type: "admin:message"; text: string }
  | { type: "comment:queue"; commentId: string }
  | { type: "comment:dismiss"; commentId: string };

export type ServerEvent =
  | { type: "state:full"; data: StreamState }
  | { type: "state:update"; data: Partial<StreamState> }
  | { type: "agent:activity"; data: AgentActivity }
  | { type: "agent:activity:delta"; id: string; delta: string }
  | { type: "game:event"; data: { type: string; gameId: GameId } }
  | { type: "comment:updated"; data: ViewerComment }
  | { type: "error"; message: string };

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";
