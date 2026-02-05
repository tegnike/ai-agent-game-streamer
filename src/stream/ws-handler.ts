import type { WebSocket } from "ws";
import { logger } from "../utils/logger.js";
import type { EventHub } from "./event-hub.js";
import type { StreamManager } from "./stream-manager.js";
import type { AdminCommand, ServerEvent, StreamEvent, LLMConfig } from "./types.js";

const PING_INTERVAL = 30_000;

interface AdminClient {
  ws: WebSocket;
  alive: boolean;
}

export class WSHandler {
  private hub: EventHub;
  private streamManager: StreamManager;
  private clients: Set<AdminClient> = new Set();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private eventListener: ((event: StreamEvent) => void) | null = null;
  private onAdminMessage?: (text: string) => void;
  private onCommentQueue?: (commentId: string) => void;
  private onCommentDismiss?: (commentId: string) => void;
  private onBrowserLaunch?: () => void;
  private onBrowserLaunchCDP?: (port: number) => void;
  private onBrowserClose?: () => void;
  private onLLMConfig?: (config: LLMConfig) => void;
  private onLLMRestart?: () => Promise<{ success: boolean; error?: string }>;

  constructor(
    hub: EventHub,
    streamManager: StreamManager,
    callbacks?: {
      onAdminMessage?: (text: string) => void;
      onCommentQueue?: (commentId: string) => void;
      onCommentDismiss?: (commentId: string) => void;
      onBrowserLaunch?: () => void;
      onBrowserLaunchCDP?: (port: number) => void;
      onBrowserClose?: () => void;
      onLLMConfig?: (config: LLMConfig) => void;
      onLLMRestart?: () => Promise<{ success: boolean; error?: string }>;
    },
  ) {
    this.hub = hub;
    this.streamManager = streamManager;
    this.onAdminMessage = callbacks?.onAdminMessage;
    this.onCommentQueue = callbacks?.onCommentQueue;
    this.onCommentDismiss = callbacks?.onCommentDismiss;
    this.onBrowserLaunch = callbacks?.onBrowserLaunch;
    this.onBrowserLaunchCDP = callbacks?.onBrowserLaunchCDP;
    this.onBrowserClose = callbacks?.onBrowserClose;
    this.onLLMConfig = callbacks?.onLLMConfig;
    this.onLLMRestart = callbacks?.onLLMRestart;
  }

  start(): void {
    // Subscribe to all hub events and broadcast to clients
    this.eventListener = (event: StreamEvent) => {
      this.broadcastEvent(event);
    };
    this.hub.onAny(this.eventListener);

    // Ping/pong for connection health
    this.pingTimer = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          logger.info("WebSocket client timed out, terminating");
          client.ws.terminate();
          this.clients.delete(client);
          continue;
        }
        client.alive = false;
        client.ws.ping();
      }
    }, PING_INTERVAL);
  }

  stop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.eventListener) {
      this.hub.offAny(this.eventListener);
      this.eventListener = null;
    }
    for (const client of this.clients) {
      client.ws.close(1001, "Server shutting down");
    }
    this.clients.clear();
  }

  handleConnection(ws: WebSocket): void {
    const client: AdminClient = { ws, alive: true };
    this.clients.add(client);
    logger.info(`Admin WebSocket connected (total: ${this.clients.size})`);

    // Send full state snapshot on connect
    const snapshot = this.hub.getFullSnapshot();
    this.send(ws, {
      type: "state:full",
      data: snapshot.state,
    });

    // Send recent activities
    for (const activity of snapshot.recentActivities) {
      this.send(ws, { type: "agent:activity", data: activity });
    }

    // Send comments
    for (const comment of snapshot.comments) {
      this.send(ws, { type: "comment:updated", data: comment });
    }

    // Handle pong
    ws.on("pong", () => {
      client.alive = true;
    });

    // Handle incoming commands
    ws.on("message", (raw) => {
      try {
        const command = JSON.parse(raw.toString()) as AdminCommand;
        this.handleCommand(command);
      } catch (err) {
        logger.error("Invalid WebSocket message:", err);
        this.send(ws, { type: "error", message: "Invalid message format" });
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      this.clients.delete(client);
      logger.info(`Admin WebSocket disconnected (total: ${this.clients.size})`);
    });

    ws.on("error", (err) => {
      logger.error("WebSocket error:", err);
      this.clients.delete(client);
    });
  }

  private handleCommand(command: AdminCommand): void {
    logger.info(`Admin command: ${command.type}`);

    switch (command.type) {
      case "stream:start":
        this.streamManager.configure(command.config);
        if (this.streamManager.getCurrentPhase() === "stopped") {
          this.streamManager.transition("idle");
        }
        this.streamManager.transition("starting");
        break;

      case "stream:stop":
        this.streamManager.transition("stopped");
        break;

      case "stream:pause":
        this.streamManager.transition("paused");
        break;

      case "stream:resume":
        this.streamManager.transition("playing");
        break;

      case "game:skip":
        this.streamManager.requestSkip();
        break;

      case "admin:message":
        if (!this.hub.getState().sessionId) {
          logger.error("admin:message ignored: no active session");
          return;
        }
        this.onAdminMessage?.(command.text);
        break;

      case "comment:queue":
        this.onCommentQueue?.(command.commentId);
        break;

      case "comment:dismiss":
        this.onCommentDismiss?.(command.commentId);
        break;

      case "browser:launch":
        this.onBrowserLaunch?.();
        break;

      case "browser:launch-cdp":
        this.onBrowserLaunchCDP?.(command.port);
        break;

      case "browser:close":
        this.onBrowserClose?.();
        break;

      case "llm:config":
        this.onLLMConfig?.(command.config);
        break;

      case "llm:restart":
        this.onLLMRestart?.();
        break;

      default:
        logger.error("Unknown command type:", (command as { type: string }).type);
    }
  }

  private broadcastEvent(event: StreamEvent): void {
    const mapped = this.mapEventToServerEvent(event);
    if (!mapped) return;

    const messages: ServerEvent[] = [mapped];

    // For agent text/reasoning, also broadcast the updated thought/speech state
    if (event.type === "agent:text" || event.type === "agent:reasoning") {
      const state = this.hub.getState();
      messages.push({
        type: "state:update",
        data: {
          agentThought: state.agentThought,
          agentSpeech: state.agentSpeech,
        },
      });
    }

    for (const client of this.clients) {
      if (client.ws.readyState === client.ws.OPEN) {
        for (const msg of messages) {
          this.send(client.ws, msg);
        }
      }
    }
  }

  private mapEventToServerEvent(event: StreamEvent): ServerEvent | null {
    switch (event.type) {
      case "agent:text":
      case "agent:reasoning":
      case "agent:tool":
        return { type: "agent:activity", data: event.data as never };

      case "agent:idle":
      case "agent:error":
        return {
          type: "state:update",
          data: { phase: this.hub.getState().phase },
        };

      case "game:starting":
      case "game:started":
      case "game:completed":
        return { type: "game:event", data: event.data as never };

      case "game:skipped":
        return { type: "state:update", data: this.hub.getState() };

      case "stream:started":
      case "stream:stopped":
      case "stream:paused":
      case "stream:resumed":
        return { type: "state:update", data: this.hub.getState() };

      case "comment:received":
      case "comment:updated":
        return { type: "comment:updated", data: event.data as never };

      case "browser:launched":
      case "browser:closed":
      case "browser:error":
        return { type: "state:update", data: { browser: this.hub.getState().browser } };

      default:
        return null;
    }
  }

  private send(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  broadcast(event: ServerEvent): void {
    for (const client of this.clients) {
      this.send(client.ws, event);
    }
  }
}
