import type { OpencodeClient } from "@opencode-ai/sdk";
import type { GameConfig, GameId, StreamingState } from "./types.js";
import { buildPlayPrompt, buildGameTransitionPrompt, type PlayPromptOptions } from "./prompts/play-game.js";
import { logger } from "./utils/logger.js";

export class EmptyResponseError extends Error {
  constructor(gameNameJa: string) {
    super(`Model returned empty response for ${gameNameJa}. The AI agent did not take any action.`);
    this.name = "EmptyResponseError";
  }
}

export class SessionManager {
  private client: OpencodeClient;
  private state: StreamingState;
  private promptAbortController: AbortController | null = null;

  constructor(client: OpencodeClient) {
    this.client = client;
    this.state = {
      currentGame: null,
      sessionId: null,
      serverPid: null,
      gamesPlayed: [],
      isPlaying: false,
    };
  }

  async createGameSession(game: GameConfig): Promise<string> {
    let sessionId: string;
    const start = Date.now();
    if (this.state.sessionId) {
      // 既存セッションを再利用
      sessionId = this.state.sessionId;
      logger.info(`[Session] reusing session: ${sessionId} for ${game.nameJa}`);
    } else {
      // 初回: 新規作成
      logger.info(`[Session] creating new session for ${game.nameJa}...`);
      const result = await this.client.session.create({
        body: { title: "ニケの配信" },
      });
      const elapsed = Date.now() - start;
      logger.debug(`[Session] create result=${JSON.stringify(result.data)}`);
      sessionId = result.data!.id;
      this.state.sessionId = sessionId;
      logger.info(`[Session] created: ${sessionId} for ${game.nameJa} (${elapsed}ms)`);
    }
    this.state.currentGame = game.id;
    this.state.isPlaying = true;
    return sessionId;
  }

  async sendPlayCommand(
    sessionId: string,
    game: GameConfig,
    browserOptions?: PlayPromptOptions,
    isFirstGame: boolean = true,
  ): Promise<void> {
    const prompt = isFirstGame
      ? buildPlayPrompt(game, browserOptions)
      : buildGameTransitionPrompt(game, browserOptions);
    logger.info(`Sending play command for ${game.nameJa} (prompt length: ${prompt.length} chars)...`);
    logger.debug(`sendPlayCommand: prompt preview:\n${prompt.substring(0, 200)}...`);

    this.promptAbortController = new AbortController();
    try {
      const startTime = Date.now();
      const result = await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text: prompt }],
        },
        signal: this.promptAbortController.signal,
      } as never);
      const elapsed = Date.now() - startTime;

      // Log response details
      const rawResult = result as Record<string, unknown>;
      const data = rawResult.data as Record<string, unknown> | undefined;
      const info = data?.info as Record<string, unknown> | undefined;
      const parts = data?.parts as unknown[] | undefined;
      const partsCount = parts?.length ?? 0;

      if (info) {
        const tokens = info.tokens as Record<string, number> | undefined;
        logger.info(`sendPlayCommand: completed in ${elapsed}ms - model=${info.modelID}, finish=${info.finish}, parts=${partsCount}, tokens(in=${tokens?.input ?? 0}/out=${tokens?.output ?? 0}), error=${info.error ?? "none"}`);
      } else {
        logger.info(`sendPlayCommand: completed in ${elapsed}ms - data=${JSON.stringify(data)}, parts=${partsCount}`);
      }

      // Detect empty response (model returned nothing)
      if (partsCount === 0 && elapsed < 5000) {
        logger.error(`sendPlayCommand: model returned empty response in ${elapsed}ms - the AI agent did not take any action`);
        throw new EmptyResponseError(game.nameJa);
      }
    } catch (err) {
      if (err instanceof EmptyResponseError) throw err;
      logger.error(`sendPlayCommand: prompt threw: ${err}`);
      throw err;
    } finally {
      this.promptAbortController = null;
    }
  }

  /**
   * Cancel the in-flight prompt HTTP request (client-side).
   * This disconnects the HTTP connection so the server can detect the client left.
   */
  cancelPrompt(): void {
    this.promptAbortController?.abort();
    this.promptAbortController = null;
  }

  async injectMessage(text: string): Promise<void> {
    const sessionId = this.state.sessionId;
    if (!sessionId) {
      logger.error("Cannot inject message: no active session");
      return;
    }
    logger.info(`Injecting message to session ${sessionId}: ${text.substring(0, 50)}...`);
    await this.client.session.promptAsync({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text }],
      },
    });
  }

  async abortSession(sessionId: string): Promise<void> {
    const start = Date.now();
    logger.info(`[Session] aborting session: ${sessionId}`);
    await this.client.session.abort({ path: { id: sessionId } });
    this.state.isPlaying = false;
    logger.info(`[Session] aborted: ${sessionId} (${Date.now() - start}ms)`);
  }

  getState(): StreamingState {
    return { ...this.state };
  }

  markGameCompleted(gameId: GameId): void {
    this.state.gamesPlayed.push(gameId);
    this.state.currentGame = null;
    this.state.isPlaying = false;
    // Note: sessionId は意図的にクリアしない（永続セッション）
    logger.info(`[Session] game marked completed: ${gameId} (total played: ${this.state.gamesPlayed.length})`);
  }

  resetSession(): void {
    logger.info(`[Session] resetSession (was: sessionId=${this.state.sessionId}, game=${this.state.currentGame})`);
    this.state.sessionId = null;
    this.state.currentGame = null;
    this.state.isPlaying = false;
    // gamesPlayed はリセットしない（ゲーム選択の重複回避に使用）
  }

  resetGamesPlayed(): void {
    const prev = this.state.gamesPlayed.length;
    this.state.gamesPlayed = [];
    logger.info(`[Session] gamesPlayed reset (was ${prev} games)`);
  }
}
