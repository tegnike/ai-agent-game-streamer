// === Game Types ===
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

// === Stream Types ===
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
  visualEndpoint?: string;
  visualBatchInterval?: number;
}

// === Browser Types ===
export type BrowserMode = "daemon" | "cdp" | "none";

export interface BrowserState {
  mode: BrowserMode;
  running: boolean;
  cdpPort?: number;
  launchedByUs: boolean;
}

// === Stream State ===
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
  browser: BrowserState;
}

// === Agent Activity ===
export type AgentActivityType = "text" | "reasoning" | "tool";

export interface AgentActivity {
  id: string;
  type: AgentActivityType;
  content: string;
  toolName?: string;
  toolStatus?: "running" | "completed" | "error";
  timestamp: number;
}

// === Comments ===
export type CommentStatus = "received" | "queued" | "answered" | "dismissed";

export interface ViewerComment {
  id: string;
  authorName: string;
  text: string;
  platform: string;
  status: CommentStatus;
  timestamp: number;
}

// === WebSocket Protocol ===
export type ServerEvent =
  | { type: "state:full"; data: StreamState }
  | { type: "state:update"; data: Partial<StreamState> }
  | { type: "agent:activity"; data: AgentActivity }
  | { type: "agent:activity:delta"; id: string; delta: string }
  | { type: "game:event"; data: { type: string; gameId: GameId } }
  | { type: "comment:updated"; data: ViewerComment }
  | { type: "llm:state"; data: unknown } // LLMState型はadmin-ui固有
  | { type: "error"; message: string };

// === Connection ===
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";
