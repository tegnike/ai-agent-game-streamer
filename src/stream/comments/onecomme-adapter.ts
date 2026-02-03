import WebSocket from "ws";
import { logger } from "../../utils/logger.js";
import type { RawComment } from "../types.js";
import type { CommentAdapter } from "./comment-adapter.js";

const DEFAULT_PORT = 11180;
const BUFFER_POLL_MS = 1_000;
const CONNECT_TIMEOUT_MS = 5_000;

interface OneCommeConfig {
  port?: number;
}

/**
 * わんコメ (OneComme) 用の CommentAdapter 実装。
 *
 * WebSocket エンドポイント `ws://127.0.0.1:{port}/sub` に接続し、
 * コメントイベントを受信してバッファリングする。
 *
 * @see https://onecomme.com/en/docs/developer/websocket-api
 */
export class OneCommeAdapter implements CommentAdapter {
  readonly platform = "onecomme";
  private ws: WebSocket | null = null;
  private buffer: RawComment[] = [];
  private connected = false;
  private port = DEFAULT_PORT;

  async connect(config: Record<string, unknown>): Promise<void> {
    const ocConfig = config as unknown as OneCommeConfig;
    this.port = ocConfig.port ?? DEFAULT_PORT;

    // わんコメが起動しているか HTTP で確認
    await this.verifyServerRunning();

    // WebSocket 接続を確立
    await this.connectWebSocket();

    this.connected = true;
    logger.info(`OneComme adapter connected: port=${this.port}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.buffer = [];
    logger.info("OneComme adapter disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchRecent(): Promise<{ comments: RawComment[]; nextPollMs: number }> {
    if (!this.connected) {
      return { comments: [], nextPollMs: BUFFER_POLL_MS };
    }

    // バッファをドレインして返却
    const comments = this.buffer.splice(0);
    return { comments, nextPollMs: BUFFER_POLL_MS };
  }

  private async verifyServerRunning(): Promise<void> {
    const url = `http://127.0.0.1:${this.port}/api/info`;
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS),
      });
      if (resp.ok) {
        const info = await resp.json();
        logger.info(`OneComme server found: v${info.version ?? "unknown"}`);
      }
    } catch {
      throw new Error(
        `わんコメサーバーに接続できません (127.0.0.1:${this.port})。わんコメが起動していることを確認してください。`,
      );
    }
  }

  private connectWebSocket(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // わんコメの WebSocket エンドポイントは /sub
      // p=comments でコメントイベントのみ購読
      const wsUrl = `ws://127.0.0.1:${this.port}/sub?p=comments`;
      const ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        ws.removeAllListeners();
        ws.close();
        reject(new Error(`WebSocket connection to OneComme timed out (${wsUrl})`));
      }, CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.ws = ws;
        this.setupMessageHandler(ws);
        resolve();
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection to OneComme failed: ${err.message}`));
      });
    });
  }

  private setupMessageHandler(ws: WebSocket): void {
    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        this.handleMessage(parsed);
      } catch {
        logger.debug(`OneComme: non-JSON message received, ignoring`);
      }
    });

    ws.on("close", () => {
      if (this.connected) {
        logger.info("OneComme WebSocket closed unexpectedly");
        this.connected = false;
      }
    });

    ws.on("error", (err) => {
      logger.error("OneComme WebSocket error:", err);
    });
  }

  private handleMessage(parsed: unknown): void {
    if (!parsed || typeof parsed !== "object") return;

    const msg = parsed as Record<string, unknown>;
    logger.debug(`OneComme WS message: type=${String(msg.type)}`);

    switch (msg.type) {
      case "connected": {
        // 初回接続時に既存コメントが送られてくる場合がある
        // connected の data.comments は Comment オブジェクトの配列（ラッパー無し）
        const connData = msg.data as Record<string, unknown> | undefined;
        if (connData?.comments && Array.isArray(connData.comments)) {
          logger.info(`OneComme: received ${connData.comments.length} existing comment(s)`);
          for (const c of connData.comments) {
            const comment = this.parseDirectComment(c);
            if (comment) {
              this.buffer.push(comment);
            }
          }
        }
        break;
      }

      case "comments": {
        // コメントイベント: data は配列 [{ comment, serviceData, userData }, ...]
        if (!Array.isArray(msg.data)) {
          logger.debug(`OneComme: "comments" event data is not an array: ${typeof msg.data}`);
          return;
        }

        logger.debug(`OneComme: received ${msg.data.length} new comment(s)`);

        for (const item of msg.data) {
          const comment = this.parseComment(item);
          if (comment) {
            this.buffer.push(comment);
            logger.debug(`OneComme: buffered comment from ${comment.authorName}: ${comment.text.slice(0, 50)}`);
          } else {
            logger.debug(`OneComme: failed to parse comment item: ${JSON.stringify(item).slice(0, 200)}`);
          }
        }
        break;
      }

      default:
        logger.debug(`OneComme: unhandled message type: ${String(msg.type)}`);
        break;
    }
  }

  /**
   * わんコメの "comments" イベントのコメントデータを RawComment に変換する。
   *
   * "comments" イベントの各要素は以下の構造:
   * {
   *   comment: { id, service, name, data: { id, name, comment, timestamp, ... } },
   *   serviceData: { ... },
   *   userData: { ... }
   * }
   *
   * @see https://onecomme.com/en/docs/developer/websocket-api
   */
  private parseComment(item: unknown): RawComment | null {
    if (!item || typeof item !== "object") return null;

    const wrapper = item as Record<string, unknown>;

    // comment.data にコメント本体が格納されている
    const commentObj = wrapper.comment as Record<string, unknown> | undefined;
    if (!commentObj) return null;

    return this.extractFromCommentObject(commentObj);
  }

  /**
   * "connected" イベントの既存コメントを RawComment に変換する。
   *
   * "connected" の data.comments には Comment オブジェクトが直接入っている
   * (ラッパー { comment, serviceData, userData } は無い):
   * { id, service, name, data: { id, name, comment, timestamp, ... } }
   */
  private parseDirectComment(item: unknown): RawComment | null {
    if (!item || typeof item !== "object") return null;
    return this.extractFromCommentObject(item as Record<string, unknown>);
  }

  /**
   * Comment オブジェクト (id, service, data: CommentData) から RawComment を抽出する。
   */
  private extractFromCommentObject(commentObj: Record<string, unknown>): RawComment | null {
    const commentData = commentObj.data as Record<string, unknown> | undefined;
    if (!commentData) return null;

    const id = String(
      commentData.id ?? `onecomme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );

    const authorName = String(
      commentData.name ?? commentData.displayName ?? "Unknown",
    );

    // comment フィールドは HTML エスケープ済みテキスト
    const text = String(commentData.comment ?? "");
    if (!text) return null;

    const publishedAt =
      typeof commentData.timestamp === "number"
        ? new Date(commentData.timestamp).toISOString()
        : new Date().toISOString();

    return { id, authorName, text, publishedAt };
  }
}
