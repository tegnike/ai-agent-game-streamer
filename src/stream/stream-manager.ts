import { logger } from "../utils/logger.js";
import type { EventHub } from "./event-hub.js";
import type { StreamPhase, StreamConfig, StreamMode } from "./types.js";

/** Allowed phase transitions: Map<fromPhase, Set<toPhase>> */
const ALLOWED_TRANSITIONS: Record<StreamPhase, Set<StreamPhase>> = {
  idle: new Set(["starting"]),
  starting: new Set(["playing", "stopped"]),
  playing: new Set(["transitioning", "paused", "stopped"]),
  transitioning: new Set(["playing", "stopped"]),
  paused: new Set(["playing", "stopped"]),
  stopped: new Set(["idle"]),
};

const DEFAULT_CONFIG: StreamConfig = {
  mode: "single",
  pauseBetweenGames: 5000,
};

export class StreamManager {
  private hub: EventHub;
  private config: StreamConfig = { ...DEFAULT_CONFIG };
  private skipRequested = false;

  constructor(hub: EventHub) {
    this.hub = hub;
  }

  // --- Configuration ---

  configure(config: Partial<StreamConfig>): void {
    this.config = { ...this.config, ...config };
    this.hub.setConfig(this.config);
  }

  getConfig(): StreamConfig {
    return { ...this.config };
  }

  // --- State transitions ---

  transition(to: StreamPhase): boolean {
    const from = this.hub.getState().phase;
    const allowed = ALLOWED_TRANSITIONS[from];

    if (!allowed || !allowed.has(to)) {
      const msg = `Invalid transition: ${from} -> ${to} (allowed from ${from}: ${allowed ? [...allowed].join(", ") : "none"})`;
      logger.error(msg);
      this.hub.setError(msg);
      this.hub.emit("stream:stopped", { error: msg });
      return false;
    }

    logger.info(`Stream phase: ${from} -> ${to}`);
    this.hub.setPhase(to);

    switch (to) {
      case "starting":
        this.hub.setStartedAt(Date.now());
        this.hub.setError(null);
        this.hub.emit("stream:started");
        break;
      case "stopped":
        this.hub.setCurrentGame(null, null);
        this.hub.setSessionId(null);
        this.hub.emit("stream:stopped");
        break;
      case "paused":
        this.hub.emit("stream:paused");
        break;
      case "playing":
        if (from === "paused") {
          this.hub.emit("stream:resumed");
        }
        break;
    }

    return true;
  }

  getCurrentPhase(): StreamPhase {
    return this.hub.getState().phase;
  }

  getMode(): StreamMode {
    return this.config.mode;
  }

  // --- Skip control ---

  requestSkip(): void {
    this.skipRequested = true;
    this.hub.emit("game:skipped");
  }

  consumeSkip(): boolean {
    const skip = this.skipRequested;
    this.skipRequested = false;
    return skip;
  }

  isSkipRequested(): boolean {
    return this.skipRequested;
  }

  // --- Convenience checks ---

  isRunning(): boolean {
    const phase = this.getCurrentPhase();
    return phase !== "idle" && phase !== "stopped";
  }

  canAcceptCommands(): boolean {
    return this.isRunning();
  }

  getPauseBetweenGames(): number {
    return this.config.pauseBetweenGames ?? DEFAULT_CONFIG.pauseBetweenGames!;
  }

  getMaxGames(): number | undefined {
    return this.config.maxGames;
  }

  getAiAutoEnd(): boolean {
    return this.config.aiAutoEnd ?? false;
  }
}
