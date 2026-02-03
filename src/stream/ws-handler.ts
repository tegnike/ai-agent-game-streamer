import type { WebSocket } from "ws";
import { logger } from "../utils/logger.js";
import type { EventHub } from "./event-hub.js";
import type { StreamManager } from "./stream-manager.js";
import type { AdminCommand, ServerEvent, StreamEvent } from "./types.js";

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

  constructor(
    hub: EventHub,
    streamManager: StreamManager,
    callbacks?: {
      onAdminMessage?: (text: string) => void;
      onCommentQueue?: (commentId: string) => void;
      onCommentDismiss?: (commentId: string) => void;
    },
  ) {
    this.hub = hub;
    this.streamManager = streamManager;
    this.onAdminMessage = callbacks?.onAdminMessage;
    this.onCommentQueue = callbacks?.onCommentQueue;
    this.onCommentDismiss = callbacks?.onCommentDismiss;
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

      case "stream:started":
      case "stream:stopped":
      case "stream:paused":
      case "stream:resumed":
        return { type: "state:update", data: this.hub.getState() };

      case "comment:received":
      case "comment:updated":
        return { type: "comment:updated", data: event.data as never };

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
}
