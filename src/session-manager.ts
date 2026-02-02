import type { OpencodeClient } from "@opencode-ai/sdk";
import type { GameConfig, GameId, StreamingState } from "./types.js";
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
    const prompt = this.buildPlayPrompt(game);
    logger.info(`Sending play command for ${game.nameJa}...`);

    await this.client.session.prompt({
      path: { id: sessionId },
      body: {
        parts: [{ type: "text", text: prompt }],
      },
    });
  }

  private buildPlayPrompt(game: GameConfig): string {
    return [
      `ゲームをプレイしてください: ${game.nameJa} (${game.name})`,
      ``,
      `手順:`,
      `1. まず samples/${game.directory}/README.md を読んでゲームのAPIを確認してください`,
      `2. ポート${game.port}でHTTPサーバーが起動済みです`,
      `3. agent-browser --headed open http://127.0.0.1:${game.port}/index.html でゲームを開いてください`,
      `4. スクリーンショットで初期状態を確認してください`,
      `5. ゲームをプレイしてください（各手の間に0.5秒の間隔を空けること）`,
      `6. ゲーム終了後、結果を報告してください`,
      ``,
      `重要:`,
      `- --headed フラグを必ず使用してください`,
      `- ソースコード（script.js, style.css, index.html）は読まないでください`,
      `- README.md のみ参照可能です`,
    ].join("\n");
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
