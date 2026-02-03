import type { OpencodeClient } from "@opencode-ai/sdk";
import { SessionManager } from "./session-manager.js";
import { EventMonitor } from "./event-monitor.js";
import { ProcessManager } from "./utils/process-manager.js";
import { getRandomGame, GAME_REGISTRY } from "./games/game-registry.js";
import { logger, GameLogger, createGameLogPath } from "./utils/logger.js";
import type { GameId } from "./types.js";
import type { EventHub } from "./stream/event-hub.js";
import type { StreamManager } from "./stream/stream-manager.js";

export class GameOrchestrator {
  private sessionManager: SessionManager;
  private eventMonitor: EventMonitor;
  private processManager: ProcessManager;
  private eventHub: EventHub | null = null;
  private streamManager: StreamManager | null = null;
  private activeSessionId: string | null = null;

  constructor(client: OpencodeClient, eventHub?: EventHub) {
    this.sessionManager = new SessionManager(client);
    this.eventMonitor = new EventMonitor(client);
    this.processManager = new ProcessManager();

    if (eventHub) {
      this.eventHub = eventHub;
      this.eventMonitor.setEventHub(eventHub);
    }
  }

  setStreamManager(manager: StreamManager): void {
    this.streamManager = manager;
  }

  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  getEventMonitor(): EventMonitor {
    return this.eventMonitor;
  }

  getProcessManager(): ProcessManager {
    return this.processManager;
  }

  async playSingleGame(gameId: GameId): Promise<void> {
    const game = GAME_REGISTRY[gameId];
    if (!game) throw new Error(`Unknown game: ${gameId}`);

    // Setup game log file
    const logPath = createGameLogPath(game.name);
    const gameLogger = new GameLogger(logPath);
    this.eventMonitor.setGameLogger(gameLogger);

    logger.info(`=== Starting game: ${game.nameJa} (${game.name}) ===`);
    gameLogger.log(`=== Starting game: ${game.nameJa} (${game.name}) ===`);
    logger.info(`Log file: ${logPath}`);

    // Emit game lifecycle events
    this.eventHub?.setCurrentGame(gameId, game);
    this.eventHub?.emit("game:starting", { gameId, gameConfig: game });

    // 1. Start HTTP server
    await this.processManager.startGameServer(game.directory, game.port);

    // 2. Create OpenCode session
    const sessionId = await this.sessionManager.createGameSession(game);
    this.activeSessionId = sessionId;
    this.eventHub?.setSessionId(sessionId);
    this.eventHub?.emit("game:started", { gameId, gameConfig: game });

    // 3. Start event monitoring (non-blocking) + send play command concurrently
    const gameComplete = new Promise<void>((resolve, reject) => {
      this.eventMonitor.startMonitoring(
        sessionId,
        () => {
          this.sessionManager.markGameCompleted(gameId);
          resolve();
        },
        (error) => {
          reject(error);
        },
      );
    });

    // 4. Send play command and wait for game completion concurrently
    //    This prevents UnhandledPromiseRejection when session.error fires
    //    before sendPlayCommand resolves.
    const [promptResult, gameResult] = await Promise.allSettled([
      this.sessionManager.sendPlayCommand(sessionId, game),
      gameComplete,
    ]);

    // Game error (from event monitor) takes priority
    if (gameResult.status === "rejected") {
      throw gameResult.reason;
    }

    // If game completed successfully, prompt timeout is expected for long games
    if (promptResult.status === "rejected") {
      const isTimeout =
        promptResult.reason?.cause?.code === "UND_ERR_HEADERS_TIMEOUT";
      if (isTimeout) {
        logger.info(
          "Prompt request timed out (expected for long-running games)",
        );
      } else {
        throw promptResult.reason;
      }
    }

    // 6. Cleanup
    this.activeSessionId = null;
    this.eventMonitor.stopMonitoring();
    await this.processManager.stopGameServer();
    this.eventHub?.addGamePlayed(gameId);
    this.eventHub?.setCurrentGame(null, null);
    this.eventHub?.setSessionId(null);
    this.eventHub?.setAgentThought(null);
    this.eventHub?.setAgentSpeech(null);
    this.eventHub?.emit("game:completed", { gameId });
    logger.info(`=== Game completed: ${game.nameJa} ===`);
    logger.info(`Log saved: ${logPath}`);
  }

  async startStreamingLoop(): Promise<void> {
    logger.info("=== Starting streaming loop ===");

    while (true) {
      const state = this.sessionManager.getState();
      const game = getRandomGame(state.gamesPlayed);

      try {
        await this.playSingleGame(game.id);
      } catch (error) {
        logger.error(`Error playing ${game.name}:`, error);
        this.eventMonitor.stopMonitoring();
        await this.processManager.stopGameServer();
      }

      // Pause between games
      logger.info("Pausing between games...");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  /**
   * Force-abort the currently running game session and clean up resources.
   * Called when a stop command is received mid-game.
   */
  private async abortCurrentGame(): Promise<void> {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;

    logger.info(`Aborting active game session: ${sessionId}`);
    this.eventMonitor.stopMonitoring();

    try {
      await this.sessionManager.abortSession(sessionId);
    } catch (err) {
      logger.error("Failed to abort session:", err);
    }

    try {
      await this.processManager.stopGameServer();
    } catch (err) {
      logger.error("Failed to stop game server:", err);
    }

    this.activeSessionId = null;
  }

  /**
   * Managed streaming loop controlled by StreamManager.
   * Unlike startStreamingLoop(), this respects pause/stop/skip commands.
   */
  async startManagedStream(): Promise<void> {
    if (!this.streamManager || !this.eventHub) {
      throw new Error("StreamManager and EventHub are required for managed streaming");
    }

    logger.info("=== Starting managed stream ===");
    const config = this.streamManager.getConfig();
    const selectedGames = config.selectedGames;

    // Listen for stop events to abort the current game immediately
    const onStopped = () => {
      this.abortCurrentGame();
    };
    this.eventHub.on("stream:stopped", onStopped);

    while (this.streamManager.isRunning()) {
      const phase = this.streamManager.getCurrentPhase();

      // Wait while paused
      if (phase === "paused") {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Skip idle/stopped states (shouldn't happen, but safety)
      if (phase === "stopped" || phase === "idle") break;

      // Select next game
      const state = this.sessionManager.getState();
      let game;
      if (selectedGames && selectedGames.length > 0) {
        const available = selectedGames.filter(
          (id) => !state.gamesPlayed.includes(id),
        );
        const pick = available.length > 0 ? available : selectedGames;
        const gameId = pick[Math.floor(Math.random() * pick.length)];
        game = GAME_REGISTRY[gameId];
      } else {
        game = getRandomGame(state.gamesPlayed);
      }

      // Transition to playing
      this.streamManager.transition("playing");

      try {
        await this.playSingleGame(game.id);
      } catch (error) {
        logger.error(`Error playing ${game.name}:`, error);
        this.eventMonitor.stopMonitoring();
        await this.processManager.stopGameServer();
        this.eventHub.setError(String(error));
      }

      // Check if skip was requested (consume it)
      this.streamManager.consumeSkip();

      // Check mode: single game stops after one
      if (this.streamManager.getMode() === "single") {
        this.streamManager.transition("stopped");
        break;
      }

      // Multi mode: transition between games
      if (!this.streamManager.isRunning()) break;
      this.streamManager.transition("transitioning");

      // Inject queued comments between games
      const queued = this.eventHub.getQueuedComments();
      if (queued.length > 0) {
        const commentText = queued
          .map((c) => `${c.authorName}: "${c.text}"`)
          .join("\n");
        const prompt = [
          "ゲーム間の休憩時間です。視聴者からのコメントを確認してください:",
          "",
          commentText,
          "",
          "気になるコメントがあれば反応してください。その後、次のゲームの準備をします。",
        ].join("\n");
        try {
          await this.sessionManager.injectMessage(prompt);
          for (const c of queued) {
            this.eventHub.updateCommentStatus(c.id, "answered");
          }
        } catch (err) {
          logger.error("Failed to inject comments:", err);
        }
      }

      // Pause between games
      const pauseMs = this.streamManager.getPauseBetweenGames();
      logger.info(`Pausing ${pauseMs}ms between games...`);
      await new Promise((r) => setTimeout(r, pauseMs));
    }

    this.eventHub.off("stream:stopped", onStopped);
    this.activeSessionId = null;
    logger.info("=== Managed stream ended ===");
  }
}
