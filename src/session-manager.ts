import type { OpencodeClient } from "@opencode-ai/sdk";
import type { GameConfig, GameId, StreamingState } from "./types.js";
import { buildPlayPrompt, buildGameTransitionPrompt, type PlayPromptOptions } from "./prompts/play-game.js";
import { logger } from "./utils/logger.js";

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
    if (this.state.sessionId) {
      // 既存セッションを再利用
      sessionId = this.state.sessionId;
      logger.info(`Reusing session: ${sessionId} for ${game.nameJa}`);
    } else {
      // 初回: 新規作成
      const result = await this.client.session.create({
        body: { title: "ニケの配信" },
      });
      sessionId = result.data!.id;
      this.state.sessionId = sessionId;
      logger.info(`Session created: ${sessionId} for ${game.nameJa}`);
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
    logger.info(`Sending play command for ${game.nameJa}...`);

    this.promptAbortController = new AbortController();
    try {
      await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          parts: [{ type: "text", text: prompt }],
        },
        signal: this.promptAbortController.signal,
      } as never);
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
    await this.client.session.abort({ path: { id: sessionId } });
    this.state.isPlaying = false;
    logger.info(`Session aborted: ${sessionId}`);
  }

  getState(): StreamingState {
    return { ...this.state };
  }

  markGameCompleted(gameId: GameId): void {
    this.state.gamesPlayed.push(gameId);
    this.state.currentGame = null;
    this.state.isPlaying = false;
    // Note: sessionId は意図的にクリアしない（永続セッション）
  }

  resetSession(): void {
    this.state.sessionId = null;
    this.state.currentGame = null;
    this.state.isPlaying = false;
    // gamesPlayed はリセットしない（ゲーム選択の重複回避に使用）
  }

  resetGamesPlayed(): void {
    this.state.gamesPlayed = [];
  }
}
