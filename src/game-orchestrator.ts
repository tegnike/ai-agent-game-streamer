import type { OpencodeClient } from "@opencode-ai/sdk";
import { SessionManager, EmptyResponseError } from "./session-manager.js";
import { EventMonitor } from "./event-monitor.js";
import { ProcessManager } from "./utils/process-manager.js";
import { BrowserManager } from "./utils/browser-manager.js";
import { getRandomGame, GAME_REGISTRY } from "./games/game-registry.js";
import { logger, GameLogger, createGameLogPath } from "./utils/logger.js";
import { GAME_SERVER_PORT } from "./config.js";
import type { GameId } from "./types.js";
import type { EventHub } from "./stream/event-hub.js";
import type { StreamManager } from "./stream/stream-manager.js";

const LOBBY_URL = `http://127.0.0.1:${GAME_SERVER_PORT}/index.html`;
const MAX_EMPTY_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export class GameOrchestrator {
  private sessionManager: SessionManager;
  private eventMonitor: EventMonitor;
  private processManager: ProcessManager;
  private browserManager: BrowserManager;
  private eventHub: EventHub | null = null;
  private streamManager: StreamManager | null = null;
  private activeSessionId: string | null = null;
  private pausedGameId: GameId | null = null;
  private gameAborted = false;

  constructor(client: OpencodeClient, eventHub?: EventHub, browserManager?: BrowserManager) {
    this.sessionManager = new SessionManager(client);
    this.eventMonitor = new EventMonitor(client);
    this.processManager = new ProcessManager();
    this.browserManager = browserManager ?? new BrowserManager();

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

  getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  /**
   * Update the OpenCode client (used when LLM is restarted)
   */
  updateClient(client: OpencodeClient): void {
    this.sessionManager = new SessionManager(client);
    this.eventMonitor = new EventMonitor(client);
    if (this.eventHub) {
      this.eventMonitor.setEventHub(this.eventHub);
    }
    // LLM再起動時は旧セッションIDが無効になるためクリア
    this.activeSessionId = null;
    this.eventHub?.setSessionId(null);
    logger.info("GameOrchestrator client updated");
  }

  /**
   * Ensure persistent infrastructure is running (HTTP server + browser).
   * This method is idempotent and safe to call multiple times.
   */
  async initPersistent(): Promise<void> {
    // Start persistent HTTP server from games/ root if not running
    const serverRunning = this.processManager.isRunning();
    logger.debug(`initPersistent: HTTP server running=${serverRunning}`);
    if (!serverRunning) {
      logger.info("Starting HTTP server...");
      await this.processManager.startPersistentServer(GAME_SERVER_PORT);
      logger.info("HTTP server started");
    }

    // Detect or launch browser
    const browserState = this.browserManager.getState();
    logger.debug(`initPersistent: browser state=${JSON.stringify(browserState)}`);
    if (!browserState.running) {
      logger.info("Browser not running, detecting...");
      const detected = await this.browserManager.detectRunning();
      logger.debug(`initPersistent: browser detected=${detected}`);
      if (!detected) {
        logger.info("Launching browser daemon...");
        await this.browserManager.launchDaemon(LOBBY_URL);
        logger.info("Browser daemon launched");
      }
      this.eventHub?.setBrowserState(this.browserManager.getState());
      this.eventHub?.emit("browser:launched");
    }
    logger.debug("initPersistent: done");
  }

  async playSingleGame(gameId: GameId): Promise<void> {
    const game = GAME_REGISTRY[gameId];
    if (!game) throw new Error(`Unknown game: ${gameId}`);

    this.gameAborted = false;

    // Setup game log file
    const logPath = createGameLogPath(game.name);
    const gameLogger = new GameLogger(logPath);
    this.eventMonitor.setGameLogger(gameLogger);

    logger.info(`=== Starting game: ${game.nameJa} (${game.name}) ===`);
    gameLogger.log(`=== Starting game: ${game.nameJa} (${game.name}) ===`);
    logger.info(`Log file: ${logPath}`);

    // Emit game lifecycle events
    this.eventHub?.setCurrentGame(gameId, game);
    this.eventHub?.emit("game:starting", { type: "game:starting", gameId, gameConfig: game });

    // 1. Ensure persistent infrastructure (idempotent)
    logger.debug("playSingleGame: step 1 - initPersistent");
    try {
      await this.initPersistent();
    } catch (err) {
      logger.error("playSingleGame: initPersistent failed:", err);
      throw err;
    }
    logger.debug("playSingleGame: step 1 done");

    // 2. Create OpenCode session
    logger.debug("playSingleGame: step 2 - createGameSession");
    let sessionId: string;
    try {
      sessionId = await this.sessionManager.createGameSession(game);
    } catch (err) {
      logger.error("playSingleGame: createGameSession failed:", err);
      throw err;
    }
    this.activeSessionId = sessionId;
    this.eventHub?.setSessionId(sessionId);
    this.eventHub?.emit("game:started", { type: "game:started", gameId, gameConfig: game });
    logger.debug(`playSingleGame: step 2 done, sessionId=${sessionId}`);

    // 3. Start event monitoring (non-blocking) + send play command concurrently
    logger.debug("playSingleGame: step 3 - startMonitoring");
    const gameComplete = new Promise<void>((resolve, reject) => {
      this.eventMonitor.startMonitoring(
        sessionId,
        () => {
          logger.info("Game completed (session idle)");
          this.sessionManager.markGameCompleted(gameId);
          resolve();
        },
        (error) => {
          logger.error("Game error (from event monitor):", error);
          reject(error);
        },
        () => {
          logger.info("Game aborted (onAbort callback)");
          resolve(); // onAbort: resolve to unblock Promise.allSettled
        },
      );
    });

    // 4. Send play command concurrently (don't await directly — it blocks until agent finishes)
    const isFirstGame = this.sessionManager.getState().gamesPlayed.length === 0;
    logger.info(`Sending play command to session ${sessionId}...`);
    const sendPromise = this.sessionManager.sendPlayCommand(sessionId, game, {
      browserPrefix: this.browserManager.getAgentBrowserPrefix(),
      gameBaseUrl: `http://127.0.0.1:${GAME_SERVER_PORT}`,
    }, isFirstGame);
    // Suppress unhandled rejection so we can abandon this promise on abort
    sendPromise.catch((err) => {
      logger.debug(`sendPlayCommand rejected (may be expected on abort): ${err}`);
    });

    // 5. Wait for game completion (idle, error, or external abort)
    logger.info("Waiting for game completion...");
    let gameError: unknown = null;
    try {
      await gameComplete;
      logger.info("gameComplete promise resolved");
    } catch (err) {
      logger.error("gameComplete promise rejected:", err);
      gameError = err;
    }

    // If the game was externally aborted (pause/skip/stop), return immediately
    // without waiting for sendPlayCommand which may hang after session abort
    if (this.gameAborted) {
      logger.info(`Game aborted: ${game.nameJa}`);
      logger.info(`Log saved: ${logPath}`);
      return;
    }

    // Game error (from event monitor) takes priority
    if (gameError) {
      throw gameError;
    }

    // Game completed normally — wait for prompt to settle
    try {
      await sendPromise;
    } catch (err: unknown) {
      const isTimeout =
        (err as { cause?: { code?: string } })?.cause?.code === "UND_ERR_HEADERS_TIMEOUT";
      if (isTimeout) {
        logger.info(
          "Prompt request timed out (expected for long-running games)",
        );
      } else {
        throw err;
      }
    }

    // 6. Cleanup: navigate back to lobby (don't stop server or close browser)
    // Note: activeSessionId と sessionId はクリアしない（永続セッション）
    this.eventMonitor.stopMonitoring();
    await this.browserManager.navigate(LOBBY_URL);
    this.eventHub?.addGamePlayed(gameId);
    this.eventHub?.setCurrentGame(null, null);
    this.eventHub?.setAgentThought(null);
    this.eventHub?.setAgentSpeech(null);
    this.eventHub?.emit("game:completed", { type: "game:completed", gameId });
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
        // Check if browser is still alive after error
        await this.checkBrowserHealth();
      }

      // Pause between games
      logger.info("Pausing between games...");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  /**
   * Abort the current OpenCode session without navigation.
   * Sets gameAborted flag so playSingleGame() exits cleanly.
   */
  private async abortSession(): Promise<void> {
    const sessionId = this.activeSessionId;
    if (!sessionId) return;

    logger.info(`Aborting active game session: ${sessionId}`);
    this.gameAborted = true;
    this.sessionManager.cancelPrompt();
    this.eventMonitor.stopMonitoring();

    try {
      await this.sessionManager.abortSession(sessionId);
    } catch (err) {
      logger.error("Failed to abort session:", err);
    }

    this.activeSessionId = null;
    // abortしたセッションは再利用不可 — 次回は新規作成
    this.sessionManager.resetSession();
  }

  /**
   * Force-abort the currently running game session, navigate to lobby, and clean up UI state.
   * Called when a stop command is received mid-game.
   */
  private async abortCurrentGame(): Promise<void> {
    await this.abortSession();

    try {
      await this.browserManager.navigate(LOBBY_URL);
    } catch (err) {
      logger.error("Failed to navigate to lobby:", err);
    }

    this.eventHub?.setCurrentGame(null, null);
    this.eventHub?.setSessionId(null);
    this.eventHub?.setAgentThought(null);
    this.eventHub?.setAgentSpeech(null);
  }

  /**
   * Check if the browser is still alive and attempt relaunch if needed.
   */
  private async checkBrowserHealth(): Promise<void> {
    const isAlive = await this.browserManager.detectRunning();
    if (!isAlive && this.browserManager.getState().launchedByUs) {
      logger.info("Browser crashed, relaunching...");
      try {
        await this.browserManager.launchDaemon(LOBBY_URL);
        this.eventHub?.setBrowserState(this.browserManager.getState());
        this.eventHub?.emit("browser:launched");
      } catch (err) {
        logger.error("Failed to relaunch browser:", err);
        this.eventHub?.emit("browser:error", { error: String(err) });
      }
    } else if (!isAlive) {
      this.eventHub?.setBrowserState(this.browserManager.getState());
      this.eventHub?.emit("browser:closed");
    }
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

    // Listen for pause events to abort session but keep game page visible
    const onPaused = () => {
      const currentGame = this.eventHub?.getState().currentGame ?? null;
      if (currentGame) {
        this.pausedGameId = currentGame as GameId;
      }
      this.abortSession();
    };
    this.eventHub.on("stream:paused", onPaused);

    // Listen for skip events to abort current game and continue to next
    const onSkipped = () => {
      this.abortSession().then(() => {
        this.browserManager.navigate(LOBBY_URL).catch((err) => {
          logger.error("Failed to navigate to lobby on skip:", err);
        });
        this.eventHub?.setCurrentGame(null, null);
        this.eventHub?.setSessionId(null);
        this.eventHub?.setAgentThought(null);
        this.eventHub?.setAgentSpeech(null);
      });
    };
    this.eventHub.on("game:skipped", onSkipped);

    while (this.streamManager.isRunning()) {
      const phase = this.streamManager.getCurrentPhase();
      logger.debug(`managedStream loop: phase=${phase}`);

      // Wait while paused
      if (phase === "paused") {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Skip idle/stopped states (shouldn't happen, but safety)
      if (phase === "stopped" || phase === "idle") {
        logger.info(`managedStream: exiting loop due to phase=${phase}`);
        break;
      }

      // Select next game (use pausedGameId if resuming from pause)
      let game;
      if (this.pausedGameId) {
        game = GAME_REGISTRY[this.pausedGameId];
        this.pausedGameId = null;
        logger.info(`Resuming paused game: ${game.nameJa}`);
      } else {
        const state = this.sessionManager.getState();
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
        logger.info(`Selected game: ${game.nameJa} (${game.id})`);
      }

      // Transition to playing
      const transitionOk = this.streamManager.transition("playing");
      logger.debug(`managedStream: transition to playing=${transitionOk}`);

      // Play game with retry on empty model response
      let gameSucceeded = false;
      for (let attempt = 1; attempt <= MAX_EMPTY_RETRIES; attempt++) {
        try {
          logger.info(`--- playSingleGame(${game.id}) starting${attempt > 1 ? ` (retry ${attempt}/${MAX_EMPTY_RETRIES})` : ""} ---`);
          await this.playSingleGame(game.id);
          logger.info(`--- playSingleGame(${game.id}) completed ---`);
          gameSucceeded = true;
          break;
        } catch (error) {
          if (error instanceof EmptyResponseError && attempt < MAX_EMPTY_RETRIES) {
            logger.info(`Model returned empty response (attempt ${attempt}/${MAX_EMPTY_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`);
            this.eventMonitor.stopMonitoring();
            this.activeSessionId = null;
            await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          logger.error(`Error playing ${game.name}:`, error);
          this.eventMonitor.stopMonitoring();
          await this.checkBrowserHealth();
          this.eventHub.setError(String(error));
          break;
        }
      }

      // Check if skip was requested (consume it)
      this.streamManager.consumeSkip();

      // If game was paused, the loop will wait at the top
      if (this.streamManager.getCurrentPhase() === "paused") {
        continue;
      }

      // Check mode: single game stops after one (unless paused)
      if (this.streamManager.getMode() === "single") {
        this.streamManager.transition("stopped");
        break;
      }

      // Multi mode: transition between games
      if (!this.streamManager.isRunning()) break;
      this.streamManager.transition("transitioning");

      // Pause between games
      const pauseMs = this.streamManager.getPauseBetweenGames();
      logger.info(`Pausing ${pauseMs}ms between games...`);
      await new Promise((r) => setTimeout(r, pauseMs));
    }

    this.eventHub.off("stream:stopped", onStopped);
    this.eventHub.off("stream:paused", onPaused);
    this.eventHub.off("game:skipped", onSkipped);
    this.activeSessionId = null;
    this.pausedGameId = null;
    logger.info("=== Managed stream ended ===");
  }
}
