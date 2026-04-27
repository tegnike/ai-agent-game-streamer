import type { EventHub } from "../stream/event-hub.js";
import type { StreamEvent } from "../stream/types.js";
import { logger } from "../utils/logger.js";
import type { NarrationRelayServer } from "./narration-relay-server.js";
import type { NarrationEmotion } from "./types.js";
import { extractSentences } from "./sentence-splitter.js";

const CONTROL_TAG_RE = /\[(?:CONTINUE|END_STREAM)\]/g;

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

  constructor(
    private readonly hub: EventHub,
    private readonly relay: NarrationRelayServer,
  ) {}

  start(): void {
    if (this.listener) return;

    this.listener = (event) => this.handleEvent(event);
    this.hub.onAny(this.listener);

    this.busyListener = (busy) => {
      this.hub.setTTSBusy(busy);
    };
    this.relay.onBusyChange(this.busyListener);
    logger.info("Narration event bridge started");
  }

  stop(): void {
    if (this.listener) {
      this.hub.offAny(this.listener);
      this.listener = null;
    }
    if (this.busyListener) {
      this.relay.offBusyChange(this.busyListener);
      this.busyListener = null;
    }
    this.buffer = "";
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
    this.relay.publishSay({
      text,
      speaker: "nike",
      emotion: inferEmotion(text),
      interrupt: false,
      metadata: { source: "ai-agent-game-streamer", boundary },
    });
  }
}
