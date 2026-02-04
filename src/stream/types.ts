import type { GameId, GameConfig } from "../types.js";

// --- Stream Lifecycle ---

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

// --- Agent Activity ---

export type AgentActivityType = "text" | "reasoning" | "tool";

export interface AgentActivity {
  id: string;
  type: AgentActivityType;
  content: string;
  toolName?: string;
  toolStatus?: "running" | "completed" | "error";
  timestamp: number;
}

// --- Viewer Comments ---

export type CommentStatus = "received" | "queued" | "answered" | "dismissed";

export interface ViewerComment {
  id: string;
  authorName: string;
  text: string;
  platform: string;
  status: CommentStatus;
  timestamp: number;
}

// --- Browser State ---

export type BrowserMode = "daemon" | "cdp" | "none";

export interface BrowserState {
  mode: BrowserMode;
  running: boolean;
  cdpPort?: number;
  launchedByUs: boolean;
}

// --- Stream State ---

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

// --- Events ---

export type StreamEventType =
  | "agent:text"
  | "agent:reasoning"
  | "agent:tool"
  | "agent:idle"
  | "agent:error"
  | "game:starting"
  | "game:started"
  | "game:completed"
  | "game:skipped"
  | "stream:started"
  | "stream:stopped"
  | "stream:paused"
  | "stream:resumed"
  | "admin:message"
  | "comment:received"
  | "comment:updated"
  | "visual:thought"
  | "visual:speech"
  | "visual:action"
  | "visual:game_state"
  | "browser:launched"
  | "browser:closed"
  | "browser:error";

export interface StreamEvent {
  type: StreamEventType;
  data: unknown;
  timestamp: number;
}

export interface GameEvent {
  type: "game:starting" | "game:started" | "game:completed";
  gameId: GameId;
  gameConfig?: GameConfig;
  result?: string;
  timestamp: number;
}

// --- WebSocket Protocol ---

export type AdminCommand =
  | { type: "stream:start"; config: StreamConfig }
  | { type: "stream:stop" }
  | { type: "stream:pause" }
  | { type: "stream:resume" }
  | { type: "game:skip" }
  | { type: "admin:message"; text: string }
  | { type: "comment:queue"; commentId: string }
  | { type: "comment:dismiss"; commentId: string }
  | { type: "browser:launch" }
  | { type: "browser:launch-cdp"; port: number }
  | { type: "browser:close" };

export type ServerEvent =
  | { type: "state:full"; data: StreamState }
  | { type: "state:update"; data: Partial<StreamState> }
  | { type: "agent:activity"; data: AgentActivity }
  | { type: "agent:activity:delta"; id: string; delta: string }
  | { type: "game:event"; data: GameEvent }
  | { type: "comment:updated"; data: ViewerComment }
  | { type: "error"; message: string };

// --- Visual Bridge ---

export type VisualEventType = "thought" | "speech" | "action" | "game_state";

export type Emotion =
  | "thinking"
  | "happy"
  | "frustrated"
  | "excited"
  | "neutral";

export interface VisualEvent {
  type: VisualEventType;
  data: {
    text?: string;
    action?: string;
    gameId?: string;
    emotion?: Emotion;
  };
  timestamp: number;
}

export interface VisualPayload {
  events: VisualEvent[];
}

// --- Comment Adapter ---

export interface RawComment {
  id: string;
  authorName: string;
  text: string;
  publishedAt: string;
}

export interface CommentAdapterConfig {
  platform: string;
  [key: string]: unknown;
}
