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
  BrowserState,
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
  private ttsSpeaking = false;
  private ttsWaiters: Array<() => void> = [];
  private ttsBusy = false;
  private ttsBusyWaiters: Array<() => void> = [];

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
    browser: { mode: "none", running: false, launchedByUs: false },
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
    // Log all events except high-frequency agent text/reasoning deltas
    if (type !== "agent:text" && type !== "agent:reasoning") {
      logger.info(`[EventHub] emit: ${type}${data ? ` data=${JSON.stringify(data).substring(0, 200)}` : ""}`);
    } else {
      logger.debug(`[EventHub] emit: ${type} (delta)`);
    }
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
    const prev = this.state.phase;
    this.state.phase = phase;
    logger.info(`[EventHub] phase: ${prev} -> ${phase}`);
    this.emitter.emit("state:changed", { phase });
  }

  setMode(mode: StreamMode): void {
    this.state.mode = mode;
  }

  setCurrentGame(gameId: GameId | null, config: GameConfig | null): void {
    const prev = this.state.currentGame;
    this.state.currentGame = gameId;
    this.state.currentGameConfig = config;
    if (prev !== gameId) {
      logger.info(`[EventHub] currentGame: ${prev ?? "null"} -> ${gameId ?? "null"}`);
    }
  }

  setSessionId(sessionId: string | null): void {
    const prev = this.state.sessionId;
    this.state.sessionId = sessionId;
    if (prev !== sessionId) {
      logger.info(`[EventHub] sessionId: ${prev ?? "null"} -> ${sessionId ?? "null"}`);
    }
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
    if (error) {
      logger.warn(`[EventHub] error set: ${error}`);
    } else {
      logger.debug("[EventHub] error cleared");
    }
  }

  addGamePlayed(gameId: GameId): void {
    this.state.gamesPlayed.push(gameId);
    this.state.gamesCompleted++;
    logger.info(`[EventHub] gameCompleted: ${gameId} (total: ${this.state.gamesCompleted}, played: [${this.state.gamesPlayed.join(", ")}])`);
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

  setBrowserState(browser: BrowserState): void {
    const prev = this.state.browser;
    this.state.browser = { ...browser };
    if (prev.running !== browser.running || prev.mode !== browser.mode) {
      logger.info(`[EventHub] browser: mode=${prev.mode}->${browser.mode}, running=${prev.running}->${browser.running}`);
    }
  }

  // --- TTS synchronization ---

  setTTSSpeaking(speaking: boolean): void {
    const prev = this.ttsSpeaking;
    this.ttsSpeaking = speaking;
    if (prev !== speaking) {
      logger.debug(`[EventHub] TTS: ${prev ? "speaking" : "idle"} -> ${speaking ? "speaking" : "idle"} (waiters: ${this.ttsWaiters.length})`);
    }
    if (!speaking) {
      const waiters = this.ttsWaiters;
      this.ttsWaiters = [];
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  getTTSSpeaking(): boolean {
    return this.ttsSpeaking;
  }

  /** TTS再生完了まで待つPromiseを返す。既にidle状態なら即resolve */
  waitForTTSIdle(): Promise<void> {
    if (!this.ttsSpeaking) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.ttsWaiters.push(resolve);
    });
  }

  // --- TTS busy (pipeline-wide) ---

  setTTSBusy(busy: boolean): void {
    const prev = this.ttsBusy;
    this.ttsBusy = busy;
    if (prev !== busy) {
      logger.debug(`[EventHub] TTS busy: ${prev} -> ${busy} (waiters: ${this.ttsBusyWaiters.length})`);
    }
    if (!busy) {
      const waiters = this.ttsBusyWaiters;
      this.ttsBusyWaiters = [];
      for (const resolve of waiters) {
        resolve();
      }
    }
  }

  getTTSBusy(): boolean {
    return this.ttsBusy;
  }

  waitForTTSBusyIdle(): Promise<void> {
    if (!this.ttsBusy) return Promise.resolve();
    return new Promise<void>((resolve) => {
      this.ttsBusyWaiters.push(resolve);
    });
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
