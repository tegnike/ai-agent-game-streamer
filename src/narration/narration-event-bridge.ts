import type { EventHub } from "../stream/event-hub.js";
import type { StreamEvent } from "../stream/types.js";
import { logger } from "../utils/logger.js";
import type { NarrationEmotion, NarrationSayInput } from "@narration-runtime/protocol";
import { extractSentences } from "./sentence-splitter.js";

const CONTROL_TAG_RE = /\[(?:CONTINUE|END_STREAM)\]/g;

export type NarrationWaitMode = "busy" | "completion" | "none";

export interface NarrationProducerClient {
  say(input: NarrationSayInput): Promise<unknown>;
  onBusyChange(listener: (busy: boolean) => void): void;
  offBusyChange(listener: (busy: boolean) => void): void;
}

function inferEmotion(text: string): NarrationEmotion {
  if (/やった|嬉し|うれし|楽しい|最高|いい展開|良い展開|チャンス|勝て|成功|すごい|わあ/.test(text)) {
    return "happy";
  }
  if (/悔し|くっ|怒|許せ|なんで/.test(text)) {
    return "angry";
  }
  if (/厳し|ピンチ|困|負け|失敗|まずい|ごめん|つらい|不利/.test(text)) {
    return "sad";
  }
  if (/考え|慎重|迷|どうしよう|狙|ここは|次は/.test(text)) {
    return "thinking";
  }
  return "neutral";
}

export class NarrationEventBridge {
  private buffer = "";
  private listener: ((event: StreamEvent) => void) | null = null;
  private busyListener: ((busy: boolean) => void) | null = null;
  private queue = Promise.resolve();
  private running = false;
  private completionPending = 0;

  constructor(
    private readonly hub: EventHub,
    private readonly client: NarrationProducerClient,
    private readonly waitMode: NarrationWaitMode = "busy",
  ) {}

  start(): void {
    if (this.listener) return;

    this.listener = (event) => this.handleEvent(event);
    this.hub.onAny(this.listener);
    this.running = true;

    if (this.waitMode === "busy") {
      this.busyListener = (busy) => {
        this.hub.setTTSBusy(busy);
      };
      this.client.onBusyChange(this.busyListener);
    }
    logger.info("Narration event bridge started");
  }

  stop(): void {
    if (this.listener) {
      this.hub.offAny(this.listener);
      this.listener = null;
    }
    if (this.busyListener) {
      this.client.offBusyChange(this.busyListener);
      this.busyListener = null;
    }
    this.buffer = "";
    this.running = false;
    this.completionPending = 0;
    this.hub.setTTSBusy(false);
  }

  private handleEvent(event: StreamEvent): void {
    if (event.type !== "agent:text" && event.type !== "agent:tool") {
      return;
    }

    if (event.type === "agent:tool") {
      this.flushRemainder("tool-boundary");
      return;
    }

    const data = event.data as { content?: string };
    const delta = (data.content ?? "").replace(CONTROL_TAG_RE, "");
    if (!delta.trim()) return;

    this.buffer += delta;
    const { sentences, remainder } = extractSentences(this.buffer);
    this.buffer = remainder;

    for (const sentence of sentences) {
      this.publish(sentence, "sentence");
    }
  }

  private flushRemainder(reason: string): void {
    const text = this.buffer.trim();
    this.buffer = "";
    if (text.length >= 2) {
      this.publish(text, reason);
    }
  }

  private publish(text: string, boundary: string): void {
    const input: NarrationSayInput = {
      text,
      speaker: "nike",
      emotion: inferEmotion(text),
      interrupt: false,
      metadata: { source: "ai-agent-game-streamer", boundary },
    };

    const send = async () => {
      if (!this.running) return;
      try {
        await this.client.say(input);
      } catch (err) {
        logger.warn("[Narration] failed to publish narration:", err);
      }
    };

    if (this.waitMode === "completion") {
      this.completionPending++;
      this.hub.setTTSBusy(true);
      const sendQueued = async () => {
        try {
          await send();
        } finally {
          this.completionPending = Math.max(0, this.completionPending - 1);
          if (this.completionPending === 0) {
            this.hub.setTTSBusy(false);
          }
        }
      };
      this.queue = this.queue.then(sendQueued, sendQueued);
      return;
    }

    void send();
  }
}
