import type { OpencodeClient, Event } from "@opencode-ai/sdk";
import { logger, type GameLogger } from "./utils/logger.js";

export class EventMonitor {
  private client: OpencodeClient;
  private abortController: AbortController | null = null;
  private gameLogger: GameLogger | null = null;

  constructor(client: OpencodeClient) {
    this.client = client;
  }

  setGameLogger(gameLogger: GameLogger): void {
    this.gameLogger = gameLogger;
  }

  async startMonitoring(
    sessionId: string,
    onIdle: () => void,
    onError: (error: unknown) => void,
  ): Promise<void> {
    this.abortController = new AbortController();

    try {
      const result = await this.client.event.subscribe();

      for await (const event of result.stream) {
        if (this.abortController.signal.aborted) break;

        const typedEvent = event as Event;

        switch (typedEvent.type) {
          case "session.idle":
            if (typedEvent.properties.sessionID === sessionId) {
              this.output("\n");
              logger.info(`Session idle: ${sessionId}`);
              this.gameLogger?.log(`Session idle: ${sessionId}`);
              onIdle();
              return;
            }
            break;

          case "session.error":
            if (typedEvent.properties.sessionID === sessionId) {
              this.output("\n");
              logger.error(`Session error:`, typedEvent);
              this.gameLogger?.log(`Session error: ${JSON.stringify(typedEvent)}`);
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
      if (!this.abortController.signal.aborted) {
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
        }
        break;

      case "tool": {
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
          const cmd = state.input?.command ?? state.input?.path ?? "";
          this.output(`\n  [${tool}] ${cmd}\n`);
        } else if (state.status === "completed" && state.output) {
          // Show abbreviated output
          const output = state.output;
          const lines = output.split("\n");
          const preview =
            lines.length > 5
              ? lines.slice(0, 5).join("\n") + `\n  ... (${lines.length} lines)`
              : output;
          this.output(`  => ${preview}\n`);
        } else if (state.status === "error") {
          this.output(`  [ERROR] ${state.error}\n`);
        }
        break;
      }

      default:
        break;
    }
  }

  stopMonitoring(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.gameLogger?.close();
    this.gameLogger = null;
  }
}
