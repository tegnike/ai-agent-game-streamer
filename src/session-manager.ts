import type { OpencodeClient } from "@opencode-ai/sdk";
import type { GameConfig, GameId, StreamingState } from "./types.js";
import { buildPlayPrompt } from "./prompts/play-game.js";
import { logger } from "./utils/logger.js";

export class SessionManager {
  private client: OpencodeClient;
  private state: StreamingState;

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
    const result = await this.client.session.create({
      body: { title: `Play ${game.nameJa}` },
    });
    const sessionId = result.data!.id;
    this.state.sessionId = sessionId;
    this.state.currentGame = game.id;
    this.state.isPlaying = true;
    logger.info(`Session created: ${sessionId} for ${game.nameJa}`);
    return sessionId;
  }

  async sendPlayCommand(sessionId: string, game: GameConfig): Promise<void> {
    const prompt = buildPlayPrompt(game);
    logger.info(`Sending play command for ${game.nameJa}...`);

    await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: prompt }],
      },
    });
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
  }

  resetGamesPlayed(): void {
    this.state.gamesPlayed = [];
  }
}
