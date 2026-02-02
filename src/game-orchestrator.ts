import type { OpencodeClient } from "@opencode-ai/sdk";
import { SessionManager } from "./session-manager.js";
import { EventMonitor } from "./event-monitor.js";
import { ProcessManager } from "./utils/process-manager.js";
import { getRandomGame, GAME_REGISTRY } from "./games/game-registry.js";
import { logger, GameLogger, createGameLogPath } from "./utils/logger.js";
import type { GameId } from "./types.js";

export class GameOrchestrator {
  private sessionManager: SessionManager;
  private eventMonitor: EventMonitor;
  private processManager: ProcessManager;

  constructor(client: OpencodeClient) {
    this.sessionManager = new SessionManager(client);
    this.eventMonitor = new EventMonitor(client);
    this.processManager = new ProcessManager();
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

    // 1. Start HTTP server
    await this.processManager.startGameServer(game.directory, game.port);

    // 2. Create OpenCode session
    const sessionId = await this.sessionManager.createGameSession(game);

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
    const [promptResult] = await Promise.allSettled([
      this.sessionManager.sendPlayCommand(sessionId, game),
      gameComplete,
    ]);

    // If prompt itself failed, throw that error
    if (promptResult.status === "rejected") {
      throw promptResult.reason;
    }

    // 6. Cleanup
    this.eventMonitor.stopMonitoring();
    await this.processManager.stopGameServer();
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
}
