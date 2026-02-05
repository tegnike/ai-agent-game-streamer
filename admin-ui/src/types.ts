// Shared types mirroring server-side definitions

export type GameId = "othello" | "gomoku" | "sokoban" | "card-battle";

// --- LLM Configuration ---

export type ProviderId = "openai" | "anthropic" | "google" | "zai";

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  models: ModelInfo[];
  envKey: string;
  hasApiKey: boolean;
}

export interface LLMConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
}

export interface LLMState {
  current: LLMConfig | null;
  pending: LLMConfig | null;
  requiresRestart: boolean;
}

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

export type BrowserMode = "daemon" | "cdp" | "none";

export interface BrowserState {
  mode: BrowserMode;
  running: boolean;
  cdpPort?: number;
  launchedByUs: boolean;
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
  browser: BrowserState;
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
  | { type: "comment:dismiss"; commentId: string }
  | { type: "llm:config"; config: LLMConfig }
  | { type: "llm:restart" };

export type ServerEvent =
  | { type: "state:full"; data: StreamState }
  | { type: "state:update"; data: Partial<StreamState> }
  | { type: "agent:activity"; data: AgentActivity }
  | { type: "agent:activity:delta"; id: string; delta: string }
  | { type: "game:event"; data: { type: string; gameId: GameId } }
  | { type: "comment:updated"; data: ViewerComment }
  | { type: "llm:state"; data: LLMState }
  | { type: "error"; message: string };

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";
