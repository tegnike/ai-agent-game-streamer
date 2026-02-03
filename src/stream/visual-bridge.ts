import { logger } from "../utils/logger.js";
import type { EventHub } from "./event-hub.js";
import type {
  VisualEvent,
  VisualPayload,
  VisualEventType,
  Emotion,
  StreamEvent,
} from "./types.js";
import { DEFAULT_VISUAL_BATCH_INTERVAL } from "../config.js";

const EMOTION_KEYWORDS: { pattern: RegExp; emotion: Emotion }[] = [
  { pattern: /勝ち|クリア|成功|やった/u, emotion: "happy" },
  { pattern: /負け|失敗|難しい|ミス/u, emotion: "frustrated" },
  { pattern: /[!！]|すごい|おお/u, emotion: "excited" },
];

function detectEmotion(text: string, isReasoning: boolean): Emotion {
  if (isReasoning) return "thinking";
  for (const { pattern, emotion } of EMOTION_KEYWORDS) {
    if (pattern.test(text)) return emotion;
  }
  return "neutral";
}

export class VisualBridge {
  private hub: EventHub;
  private endpoint: string;
  private batchInterval: number;
  private buffer: VisualEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private eventListener: ((event: StreamEvent) => void) | null = null;

  constructor(
    hub: EventHub,
    options: {
      endpoint: string;
      batchInterval?: number;
    },
  ) {
    this.hub = hub;
    this.endpoint = options.endpoint;
    this.batchInterval = options.batchInterval ?? DEFAULT_VISUAL_BATCH_INTERVAL;
  }

  start(): void {
    logger.info(`Visual bridge started: ${this.endpoint} (interval: ${this.batchInterval}ms)`);

    this.eventListener = (event: StreamEvent) => {
      const visualEvent = this.mapToVisualEvent(event);
      if (visualEvent) {
        this.buffer.push(visualEvent);
      }
    };
    this.hub.onAny(this.eventListener);

    this.timer = setInterval(() => this.flush(), this.batchInterval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.eventListener) {
      this.hub.offAny(this.eventListener);
      this.eventListener = null;
    }
    // Flush remaining events
    this.flush();
    logger.info("Visual bridge stopped");
  }

  private mapToVisualEvent(event: StreamEvent): VisualEvent | null {
    const state = this.hub.getState();

    switch (event.type) {
      case "agent:reasoning": {
        const data = event.data as { content: string };
        return {
          type: "thought",
          data: {
            text: data.content,
            gameId: state.currentGame ?? undefined,
            emotion: detectEmotion(data.content, true),
          },
          timestamp: event.timestamp,
        };
      }

      case "agent:text": {
        const data = event.data as { content: string };
        return {
          type: "speech",
          data: {
            text: data.content,
            gameId: state.currentGame ?? undefined,
            emotion: detectEmotion(data.content, false),
          },
          timestamp: event.timestamp,
        };
      }

      case "agent:tool": {
        const data = event.data as { toolName?: string; content: string };
        return {
          type: "action",
          data: {
            action: data.toolName ?? "unknown",
            text: data.content,
            gameId: state.currentGame ?? undefined,
          },
          timestamp: event.timestamp,
        };
      }

      case "game:starting":
      case "game:started":
      case "game:completed": {
        return {
          type: "game_state",
          data: {
            text: event.type,
            gameId: state.currentGame ?? undefined,
          },
          timestamp: event.timestamp,
        };
      }

      default:
        return null;
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0);
    const payload: VisualPayload = { events };

    try {
      await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Fire-and-forget: log only, don't affect stream
      logger.debug(`Visual bridge send failed (${events.length} events dropped)`);
    }
  }
}
