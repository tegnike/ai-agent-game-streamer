import { logger } from "../utils/logger.js";
import type { EventHub } from "./event-hub.js";
import type { CommentAdapter } from "./comments/comment-adapter.js";

const DEFAULT_POLL_MS = 10_000;
const MAX_CONSECUTIVE_ERRORS = 10;

export class CommentIngester {
  private hub: EventHub;
  private adapters: CommentAdapter[] = [];
  private pollTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private seenIds = new Set<string>();
  private errorCounts: Map<string, number> = new Map();
  private running = false;

  constructor(hub: EventHub) {
    this.hub = hub;
  }

  addAdapter(adapter: CommentAdapter): void {
    this.adapters.push(adapter);
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info(`Comment ingester started with ${this.adapters.length} adapter(s)`);

    for (const adapter of this.adapters) {
      if (adapter.isConnected()) {
        this.schedulePoll(adapter, 0);
      }
    }
  }

  stop(): void {
    this.running = false;
    for (const [, timer] of this.pollTimers) {
      clearTimeout(timer);
    }
    this.pollTimers.clear();
    logger.info("Comment ingester stopped");
  }

  private schedulePoll(adapter: CommentAdapter, delayMs: number): void {
    if (!this.running) return;

    const timer = setTimeout(async () => {
      await this.pollAdapter(adapter);
    }, delayMs);

    this.pollTimers.set(adapter.platform, timer);
  }

  private async pollAdapter(adapter: CommentAdapter): Promise<void> {
    if (!this.running || !adapter.isConnected()) return;

    try {
      const { comments, nextPollMs } = await adapter.fetchRecent();
      this.errorCounts.set(adapter.platform, 0);

      for (const raw of comments) {
        // Dedup
        if (this.seenIds.has(raw.id)) continue;
        this.seenIds.add(raw.id);

        // Trim seen IDs set if it gets too large
        if (this.seenIds.size > 10_000) {
          const arr = Array.from(this.seenIds);
          this.seenIds = new Set(arr.slice(arr.length - 5000));
        }

        this.hub.addComment(raw.authorName, raw.text, adapter.platform);
      }

      // Schedule next poll using API-recommended interval
      this.schedulePoll(adapter, nextPollMs || DEFAULT_POLL_MS);
    } catch (err) {
      const errCount = (this.errorCounts.get(adapter.platform) ?? 0) + 1;
      this.errorCounts.set(adapter.platform, errCount);

      logger.error(`Comment poll error (${adapter.platform}, attempt ${errCount}):`, err);

      if (errCount >= MAX_CONSECUTIVE_ERRORS) {
        logger.error(`Max errors reached for ${adapter.platform}. Stopping adapter.`);
        await adapter.disconnect();
        return;
      }

      // Exponential backoff
      const backoff = Math.min(1000 * Math.pow(2, errCount), 300_000);
      this.schedulePoll(adapter, backoff);
    }
  }
}
