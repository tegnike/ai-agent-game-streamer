import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { WebSocketServer } from "ws";
import { logger } from "../utils/logger.js";
import type { EventHub } from "./event-hub.js";
import type { StreamManager } from "./stream-manager.js";
import { WSHandler } from "./ws-handler.js";
import { GAME_REGISTRY } from "../games/game-registry.js";
import type { StreamConfig, ViewerComment } from "./types.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export class StreamServer {
  private hub: EventHub;
  private streamManager: StreamManager;
  private wsHandler: WSHandler;
  private server: ReturnType<typeof createServer> | null = null;
  private wss: WebSocketServer | null = null;
  private port: number;
  private staticDir: string | null;
  private onAdminMessage?: (text: string) => void;
  private onCommentQueue?: (commentId: string) => void;
  private onCommentDismiss?: (commentId: string) => void;
  private onYouTubeConnect?: (config: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  private onYouTubeDisconnect?: () => Promise<void>;
  private onVisualConfigure?: (config: { endpoint: string; batchInterval?: number }) => void | Promise<void>;

  constructor(
    hub: EventHub,
    streamManager: StreamManager,
    options: {
      port?: number;
      staticDir?: string;
      onAdminMessage?: (text: string) => void;
      onCommentQueue?: (commentId: string) => void;
      onCommentDismiss?: (commentId: string) => void;
      onYouTubeConnect?: (config: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
      onYouTubeDisconnect?: () => Promise<void>;
      onVisualConfigure?: (config: { endpoint: string; batchInterval?: number }) => void | Promise<void>;
    } = {},
  ) {
    this.hub = hub;
    this.streamManager = streamManager;
    this.port = options.port ?? 3000;
    this.staticDir = options.staticDir ?? null;
    this.onAdminMessage = options.onAdminMessage;
    this.onCommentQueue = options.onCommentQueue;
    this.onCommentDismiss = options.onCommentDismiss;
    this.onYouTubeConnect = options.onYouTubeConnect;
    this.onYouTubeDisconnect = options.onYouTubeDisconnect;
    this.onVisualConfigure = options.onVisualConfigure;

    this.wsHandler = new WSHandler(hub, streamManager, {
      onAdminMessage: this.onAdminMessage,
      onCommentQueue: this.onCommentQueue,
      onCommentDismiss: this.onCommentDismiss,
    });
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => this.handleRequest(req, res));

    // Attach WebSocket server — suppress its own error events since
    // the underlying HTTP server error is what we handle.
    this.wss = new WebSocketServer({ server: this.server, path: "/ws/admin" });
    this.wss.on("error", (err) => {
      logger.error("WebSocket server error:", err);
    });
    this.wss.on("connection", (ws) => this.wsHandler.handleConnection(ws));

    this.wsHandler.start();

    return new Promise<void>((resolve, reject) => {
      this.server!.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          logger.error(
            `Port ${this.port} is already in use. ` +
            `Use --admin-port=<port> or STREAM_PORT env to specify a different port.`,
          );
        }
        reject(err);
      });
      this.server!.listen(this.port, () => {
        logger.info(`Stream server listening on http://localhost:${this.port}`);
        logger.info(`WebSocket endpoint: ws://localhost:${this.port}/ws/admin`);
        if (this.staticDir) {
          logger.info(`Serving admin UI from: ${this.staticDir}`);
        }
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.wsHandler.stop();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.server) {
      return new Promise<void>((resolve) => {
        this.server!.close(() => {
          logger.info("Stream server stopped");
          this.server = null;
          resolve();
        });
      });
    }
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? "/", `http://localhost:${this.port}`);
    const path = url.pathname;
    const method = req.method ?? "GET";

    // CORS preflight
    if (method === "OPTIONS") {
      this.sendCors(res, 204);
      return;
    }

    // API routes
    if (path.startsWith("/api/")) {
      this.handleApi(method, path, req, res);
      return;
    }

    // Static file serving for admin UI
    if (this.staticDir && (path.startsWith("/admin") || path === "/")) {
      this.serveStatic(path, res);
      return;
    }

    this.sendJson(res, 404, { error: "Not Found" });
  }

  private handleApi(method: string, path: string, req: IncomingMessage, res: ServerResponse): void {
    // GET endpoints
    if (method === "GET") {
      switch (path) {
        case "/api/status":
          this.sendJson(res, 200, this.hub.getState());
          return;

        case "/api/games":
          this.sendJson(res, 200, Object.values(GAME_REGISTRY));
          return;

        case "/api/comments":
          this.sendJson(res, 200, this.hub.getComments());
          return;

        case "/api/activities": {
          const url = new URL(req.url ?? "/", `http://localhost:${this.port}`);
          const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
          const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
          this.sendJson(res, 200, {
            activities: this.hub.getRecentActivities(offset, limit),
            total: this.hub.getActivitiesCount(),
          });
          return;
        }
      }
    }

    // POST endpoints
    if (method === "POST") {
      this.parseBody(req, async (body) => {
        switch (path) {
          case "/api/stream/start": {
            const config = body as Partial<StreamConfig>;
            this.streamManager.configure(config);
            if (this.streamManager.getCurrentPhase() === "stopped") {
              this.streamManager.transition("idle");
            }
            const ok = this.streamManager.transition("starting");
            this.sendJson(res, ok ? 200 : 400, {
              success: ok,
              phase: this.hub.getState().phase,
            });
            return;
          }

          case "/api/stream/stop": {
            const ok = this.streamManager.transition("stopped");
            this.sendJson(res, ok ? 200 : 400, {
              success: ok,
              phase: this.hub.getState().phase,
            });
            return;
          }

          case "/api/stream/pause": {
            const ok = this.streamManager.transition("paused");
            this.sendJson(res, ok ? 200 : 400, {
              success: ok,
              phase: this.hub.getState().phase,
            });
            return;
          }

          case "/api/stream/resume": {
            const ok = this.streamManager.transition("playing");
            this.sendJson(res, ok ? 200 : 400, {
              success: ok,
              phase: this.hub.getState().phase,
            });
            return;
          }

          case "/api/game/skip": {
            this.streamManager.requestSkip();
            this.sendJson(res, 200, { success: true });
            return;
          }

          case "/api/admin/message": {
            const { text } = body as { text: string };
            if (!text) {
              this.sendJson(res, 400, { error: "text is required" });
              return;
            }
            if (!this.hub.getState().sessionId) {
              this.sendJson(res, 409, { error: "No active session. Start a game first." });
              return;
            }
            this.onAdminMessage?.(text);
            this.sendJson(res, 200, { success: true });
            return;
          }

          case "/api/comments/add": {
            const { authorName, text, platform } = body as {
              authorName: string;
              text: string;
              platform: string;
            };
            if (!authorName || !text) {
              this.sendJson(res, 400, { error: "authorName and text are required" });
              return;
            }
            const comment = this.hub.addComment(authorName, text, platform ?? "manual");
            this.sendJson(res, 200, comment);
            return;
          }

          case "/api/comments/youtube/connect": {
            if (!this.onYouTubeConnect) {
              this.sendJson(res, 501, { error: "YouTube integration not configured" });
              return;
            }
            const result = await this.onYouTubeConnect(body);
            this.sendJson(res, result.success ? 200 : 400, result);
            return;
          }

          case "/api/comments/youtube/disconnect": {
            if (this.onYouTubeDisconnect) {
              await this.onYouTubeDisconnect();
            }
            this.sendJson(res, 200, { success: true });
            return;
          }

          case "/api/visual/configure": {
            const { endpoint, batchInterval } = body as { endpoint: string; batchInterval?: number };
            if (!endpoint) {
              this.sendJson(res, 400, { error: "endpoint is required" });
              return;
            }
            if (!this.onVisualConfigure) {
              this.sendJson(res, 501, { error: "Visual bridge not available" });
              return;
            }
            await this.onVisualConfigure({ endpoint, batchInterval });
            this.sendJson(res, 200, { success: true });
            return;
          }

          default:
            break;
        }

        // Comment action endpoints: /api/comments/:id/queue or /api/comments/:id/dismiss
        const commentMatch = path.match(/^\/api\/comments\/([^/]+)\/(queue|dismiss)$/);
        if (commentMatch) {
          const [, commentId, action] = commentMatch;
          if (action === "queue") {
            const comment = this.hub.updateCommentStatus(commentId, "queued");
            if (!comment) {
              this.sendJson(res, 404, { error: "Comment not found" });
              return;
            }
            this.onCommentQueue?.(commentId);
            this.sendJson(res, 200, comment);
            return;
          }
          if (action === "dismiss") {
            const comment = this.hub.updateCommentStatus(commentId, "dismissed");
            if (!comment) {
              this.sendJson(res, 404, { error: "Comment not found" });
              return;
            }
            this.onCommentDismiss?.(commentId);
            this.sendJson(res, 200, comment);
            return;
          }
        }

        this.sendJson(res, 404, { error: "Not Found" });
      });
      return;
    }

    this.sendJson(res, 405, { error: "Method Not Allowed" });
  }

  private serveStatic(urlPath: string, res: ServerResponse): void {
    if (!this.staticDir) {
      this.sendJson(res, 404, { error: "Not Found" });
      return;
    }

    // Normalize path
    let filePath = urlPath === "/" || urlPath === "/admin" || urlPath === "/admin/"
      ? "index.html"
      : urlPath.replace(/^\/admin\/?/, "");

    const fullPath = join(this.staticDir, filePath);

    // Security: prevent directory traversal
    if (!fullPath.startsWith(this.staticDir)) {
      this.sendJson(res, 403, { error: "Forbidden" });
      return;
    }

    if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
      // SPA fallback: serve index.html for non-file paths
      const indexPath = join(this.staticDir, "index.html");
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath);
        res.writeHead(200, {
          ...CORS_HEADERS,
          "Content-Type": "text/html",
        });
        res.end(content);
        return;
      }
      this.sendJson(res, 404, { error: "Not Found" });
      return;
    }

    const ext = extname(fullPath);
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    const content = readFileSync(fullPath);

    res.writeHead(200, {
      ...CORS_HEADERS,
      "Content-Type": contentType,
    });
    res.end(content);
  }

  private parseBody(req: IncomingMessage, callback: (body: Record<string, unknown>) => Promise<void> | void): void {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", async () => {
      try {
        const body = data ? JSON.parse(data) : {};
        await callback(body);
      } catch {
        // Empty or invalid body
        await callback({});
      }
    });
  }

  private sendJson(res: ServerResponse, status: number, data: unknown): void {
    res.writeHead(status, {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(data));
  }

  private sendCors(res: ServerResponse, status: number): void {
    res.writeHead(status, CORS_HEADERS);
    res.end();
  }

  getPort(): number {
    return this.port;
  }
}
