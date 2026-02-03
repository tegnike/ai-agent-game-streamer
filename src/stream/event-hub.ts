import { EventEmitter } from "node:events";
import { logger } from "../utils/logger.js";
import type {
  StreamState,
  StreamPhase,
  StreamMode,
  StreamConfig,
  StreamEvent,
  StreamEventType,
  AgentActivity,
  AgentActivityType,
  ViewerComment,
  CommentStatus,
  GameEvent,
} from "./types.js";
import type { GameId, GameConfig } from "../types.js";

const MAX_ACTIVITIES = 50;
const MAX_COMMENTS = 500;

export class EventHub {
  private emitter = new EventEmitter();
  private activities: AgentActivity[] = [];
  private comments: ViewerComment[] = [];
  private activityCounter = 0;
  private commentCounter = 0;

  private state: StreamState = {
    phase: "idle",
    mode: "single",
    currentGame: null,
    currentGameConfig: null,
    sessionId: null,
    gamesPlayed: [],
    gamesCompleted: 0,
    agentThought: null,
    agentSpeech: null,
    config: { mode: "single" },
    startedAt: null,
    error: null,
  };

  // --- Event pub/sub ---

  on(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(event, listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.off(event, listener);
  }

  emit(type: StreamEventType, data?: unknown): void {
    const event: StreamEvent = {
      type,
      data: data ?? null,
      timestamp: Date.now(),
    };
    this.emitter.emit(type, event);
    this.emitter.emit("*", event);
  }

  onAny(listener: (event: StreamEvent) => void): void {
    this.emitter.on("*", listener);
  }

  offAny(listener: (event: StreamEvent) => void): void {
    this.emitter.off("*", listener);
  }

  // --- State management ---

  getState(): StreamState {
    return { ...this.state };
  }

  setPhase(phase: StreamPhase): void {
    this.state.phase = phase;
    this.emitter.emit("state:changed", { phase });
  }

  setMode(mode: StreamMode): void {
    this.state.mode = mode;
  }

  setCurrentGame(gameId: GameId | null, config: GameConfig | null): void {
    this.state.currentGame = gameId;
    this.state.currentGameConfig = config;
  }

  setSessionId(sessionId: string | null): void {
    this.state.sessionId = sessionId;
  }

  setConfig(config: StreamConfig): void {
    this.state.config = config;
    this.state.mode = config.mode;
  }

  setStartedAt(timestamp: number | null): void {
    this.state.startedAt = timestamp;
  }

  setError(error: string | null): void {
    this.state.error = error;
  }

  addGamePlayed(gameId: GameId): void {
    this.state.gamesPlayed.push(gameId);
    this.state.gamesCompleted++;
  }

  resetGamesPlayed(): void {
    this.state.gamesPlayed = [];
  }

  // --- Agent thought / speech ---

  setAgentThought(text: string | null): void {
    this.state.agentThought = text;
  }

  setAgentSpeech(text: string | null): void {
    this.state.agentSpeech = text;
  }

  // --- Agent Activity buffer ---

  pushActivity(type: AgentActivityType, content: string, extra?: Partial<AgentActivity>): AgentActivity {
    const activity: AgentActivity = {
      id: `act_${++this.activityCounter}`,
      type,
      content,
      timestamp: Date.now(),
      ...extra,
    };

    this.activities.push(activity);
    if (this.activities.length > MAX_ACTIVITIES) {
      this.activities.shift();
    }

    this.emit(`agent:${type}` as StreamEventType, activity);
    return activity;
  }

  getRecentActivities(offset = 0, limit = MAX_ACTIVITIES): AgentActivity[] {
    const start = Math.max(0, offset);
    return this.activities.slice(start, start + limit);
  }

  getActivitiesCount(): number {
    return this.activities.length;
  }

  // --- Comment buffer ---

  addComment(authorName: string, text: string, platform: string): ViewerComment {
    const comment: ViewerComment = {
      id: `cmt_${++this.commentCounter}`,
      authorName,
      text,
      platform,
      status: "received",
      timestamp: Date.now(),
    };

    this.comments.push(comment);
    if (this.comments.length > MAX_COMMENTS) {
      this.comments.shift();
    }

    this.emit("comment:received", comment);
    return comment;
  }

  updateCommentStatus(commentId: string, status: CommentStatus): ViewerComment | null {
    const comment = this.comments.find((c) => c.id === commentId);
    if (!comment) return null;

    comment.status = status;
    this.emit("comment:updated", comment);
    return comment;
  }

  getComments(): ViewerComment[] {
    return [...this.comments];
  }

  getQueuedComments(): ViewerComment[] {
    return this.comments.filter((c) => c.status === "queued");
  }

  // --- Full state snapshot ---

  getFullSnapshot(): {
    state: StreamState;
    recentActivities: AgentActivity[];
    comments: ViewerComment[];
  } {
    return {
      state: this.getState(),
      recentActivities: this.getRecentActivities(),
      comments: this.getComments(),
    };
  }
}
