import type { OpencodeClient, Event } from "@opencode-ai/sdk";
import { logger, type GameLogger } from "./utils/logger.js";
import type { EventHub } from "./stream/event-hub.js";

const FLUSH_INTERVAL_MS = 200;

export class EventMonitor {
  private client: OpencodeClient;
  private abortController: AbortController | null = null;
  private gameLogger: GameLogger | null = null;
  private eventHub: EventHub | null = null;
  private onAbortCallback: (() => void) | null = null;

  // Delta buffering for text/reasoning
  private textBuffer = "";
  private reasoningBuffer = "";
  private textAccum = "";
  private reasoningAccum = "";
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(client: OpencodeClient) {
    this.client = client;
  }

  setEventHub(hub: EventHub): void {
    this.eventHub = hub;
  }

  setGameLogger(gameLogger: GameLogger): void {
    this.gameLogger = gameLogger;
  }

  async startMonitoring(
    sessionId: string,
    onIdle: () => void,
    onError: (error: unknown) => void,
    onAbort?: () => void,
  ): Promise<void> {
    this.abortController = new AbortController();
    this.onAbortCallback = onAbort ?? null;
    this.textBuffer = "";
    this.reasoningBuffer = "";
    this.textAccum = "";
    this.reasoningAccum = "";

    try {
      const result = await this.client.event.subscribe();

      for await (const event of result.stream) {
        if (this.abortController.signal.aborted) break;

        const typedEvent = event as Event;

        switch (typedEvent.type) {
          case "session.idle":
            if (typedEvent.properties.sessionID === sessionId) {
              this.flushBuffers();
              this.output("\n");
              logger.info(`Session idle: ${sessionId}`);
              this.gameLogger?.log(`Session idle: ${sessionId}`);
              this.eventHub?.emit("agent:idle");
              onIdle();
              return;
            }
            break;

          case "session.error":
            if (typedEvent.properties.sessionID === sessionId) {
              this.flushBuffers();
              this.output("\n");
              logger.error(`Session error:`, typedEvent);
              this.gameLogger?.log(`Session error: ${JSON.stringify(typedEvent)}`);
              this.eventHub?.emit("agent:error", typedEvent);
              onError(typedEvent);
              return;
            }
            break;

          case "message.part.updated":
            this.handlePartUpdate(typedEvent, sessionId);
            break;

          default:
            break;
        }
      }
    } catch (err) {
      if (this.abortController && !this.abortController.signal.aborted) {
        logger.error("Event monitoring error:", err);
        this.gameLogger?.log(`Event monitoring error: ${err}`);
        onError(err);
      }
    }
  }

  private output(text: string): void {
    process.stdout.write(text);
    this.gameLogger?.write(text);
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushBuffers();
    }, FLUSH_INTERVAL_MS);
  }

  private flushBuffers(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.textBuffer && this.eventHub) {
      const speech = this.textAccum.length > 500
        ? "…" + this.textAccum.slice(-500)
        : this.textAccum;
      this.eventHub.setAgentSpeech(speech);
      this.eventHub.pushActivity("text", this.textBuffer);
      this.textBuffer = "";
    }

    if (this.reasoningBuffer && this.eventHub) {
      // Show only the tail of accumulated reasoning to keep it readable
      const thought = this.reasoningAccum.length > 500
        ? "…" + this.reasoningAccum.slice(-500)
        : this.reasoningAccum;
      this.eventHub.setAgentThought(thought);
      this.eventHub.pushActivity("reasoning", this.reasoningBuffer);
      this.reasoningBuffer = "";
    }
  }

  private handlePartUpdate(event: Event, sessionId: string): void {
    if (event.type !== "message.part.updated") return;

    const { part, delta } = event.properties;

    // Filter to only our session
    if ("sessionID" in part && part.sessionID !== sessionId) return;

    switch (part.type) {
      case "text":
        // Stream agent's text output
        if (delta) {
          this.output(delta);
          this.textBuffer += delta;
          this.textAccum += delta;
          this.scheduleFlush();
        }
        break;

      case "reasoning":
        // Stream agent's reasoning/thinking output
        if (delta) {
          this.output(delta);
          this.reasoningBuffer += delta;
          this.reasoningAccum += delta;
          this.scheduleFlush();
        }
        break;

      case "tool": {
        // Flush any pending text/reasoning before tool events
        this.flushBuffers();

        const toolPart = part as {
          type: "tool";
          tool: string;
          state: {
            status: string;
            input?: Record<string, unknown>;
            output?: string;
            title?: string;
            error?: string;
          };
        };
        const { tool, state } = toolPart;

        if (state.status === "running") {
          // Reset text accumulator so speech shows the latest segment.
          // Keep reasoningAccum across tool calls so thought preserves
          // the agent's reasoning chain and stays distinct from speech.
          this.textAccum = "";

          const cmd = state.input?.command ?? state.input?.path ?? "";
          this.output(`\n  [${tool}] ${cmd}\n`);
          this.eventHub?.pushActivity("tool", String(cmd), {
            toolName: tool,
            toolStatus: "running",
          });
        } else if (state.status === "completed" && state.output) {
          // Show abbreviated output
          const output = state.output;
          const lines = output.split("\n");
          const preview =
            lines.length > 5
              ? lines.slice(0, 5).join("\n") + `\n  ... (${lines.length} lines)`
              : output;
          this.output(`  => ${preview}\n`);
          this.eventHub?.pushActivity("tool", preview, {
            toolName: tool,
            toolStatus: "completed",
          });
        } else if (state.status === "error") {
          this.output(`  [ERROR] ${state.error}\n`);
          this.eventHub?.pushActivity("tool", state.error ?? "Unknown error", {
            toolName: tool,
            toolStatus: "error",
          });
        }
        break;
      }

      default:
        break;
    }
  }

  stopMonitoring(): void {
    this.flushBuffers();
    this.abortController?.abort();
    this.abortController = null;
    this.gameLogger?.close();
    this.gameLogger = null;
    this.onAbortCallback?.();
    this.onAbortCallback = null;
  }
}
