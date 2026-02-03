import { logger } from "../../utils/logger.js";
import type { RawComment } from "../types.js";
import type { CommentAdapter } from "./comment-adapter.js";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const DEFAULT_POLL_MS = 10_000;
const QUOTA_PER_REQUEST = 5;
const DAILY_QUOTA_LIMIT = 10_000;

interface YouTubeConfig {
  apiKey: string;
  liveChatId?: string;
  videoId?: string;
}

interface LiveChatResponse {
  pollingIntervalMillis: number;
  nextPageToken?: string;
  items: {
    id: string;
    snippet: {
      authorChannelId: string;
      displayMessage: string;
      publishedAt: string;
    };
    authorDetails: {
      displayName: string;
      channelId: string;
    };
  }[];
}

export class YouTubeAdapter implements CommentAdapter {
  readonly platform = "youtube";
  private apiKey = "";
  private liveChatId = "";
  private nextPageToken: string | undefined;
  private connected = false;
  private quotaUsed = 0;
  private backoffMs = 0;
  private lastPollInterval = DEFAULT_POLL_MS;

  async connect(config: Record<string, unknown>): Promise<void> {
    const ytConfig = config as unknown as YouTubeConfig;
    this.apiKey = ytConfig.apiKey || process.env.YOUTUBE_API_KEY || "";

    if (!this.apiKey) {
      throw new Error("YouTube API key is required (set YOUTUBE_API_KEY env var)");
    }

    if (ytConfig.liveChatId) {
      // Video IDっぽい短い文字列(8〜12文字の英数字+ハイフン/アンダースコア)の場合、
      // Video IDとして扱いliveChatIdを自動解決する
      if (/^[A-Za-z0-9_-]{8,12}$/.test(ytConfig.liveChatId)) {
        logger.info(
          `"${ytConfig.liveChatId}" looks like a Video ID, resolving liveChatId from it...`,
        );
        this.liveChatId = await this.fetchLiveChatId(ytConfig.liveChatId);
      } else {
        this.liveChatId = ytConfig.liveChatId;
      }
    } else if (ytConfig.videoId) {
      this.liveChatId = await this.fetchLiveChatId(ytConfig.videoId);
    } else {
      throw new Error("Either liveChatId or videoId is required");
    }

    // 接続前にliveChatIdの有効性を検証する
    await this.validateLiveChatId();

    this.connected = true;
    this.quotaUsed = 0;
    logger.info(`YouTube adapter connected: liveChatId=${this.liveChatId}`);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.nextPageToken = undefined;
    this.backoffMs = 0;
    logger.info("YouTube adapter disconnected");
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchRecent(): Promise<{ comments: RawComment[]; nextPollMs: number }> {
    if (!this.connected) {
      return { comments: [], nextPollMs: DEFAULT_POLL_MS };
    }

    // Backoff if needed
    if (this.backoffMs > 0) {
      const wait = this.backoffMs;
      this.backoffMs = 0;
      return { comments: [], nextPollMs: wait };
    }

    // Quota check
    const quotaRemaining = DAILY_QUOTA_LIMIT - this.quotaUsed;
    if (quotaRemaining < QUOTA_PER_REQUEST) {
      logger.error("YouTube API quota exhausted. Stopping polling.");
      this.connected = false;
      return { comments: [], nextPollMs: DEFAULT_POLL_MS };
    }

    try {
      const params = new URLSearchParams({
        liveChatId: this.liveChatId,
        part: "snippet,authorDetails",
        key: this.apiKey,
      });

      if (this.nextPageToken) {
        params.set("pageToken", this.nextPageToken);
      }

      const resp = await fetch(
        `${YOUTUBE_API_BASE}/liveChat/messages?${params}`,
        { signal: AbortSignal.timeout(10_000) },
      );

      this.quotaUsed += QUOTA_PER_REQUEST;

      if (!resp.ok) {
        const errorBody = await resp.text().catch(() => "(no body)");
        if (resp.status === 403 || resp.status === 429) {
          // Rate limited or quota exceeded
          this.backoffMs = Math.min(
            (this.backoffMs || 30_000) * 2,
            300_000, // Max 5 minutes
          );
          logger.error(`YouTube API ${resp.status}: backing off ${this.backoffMs}ms`, errorBody);
          return { comments: [], nextPollMs: this.backoffMs };
        }
        logger.error(`YouTube API error body:`, errorBody);
        throw new Error(`YouTube API error: ${resp.status} ${resp.statusText}`);
      }

      const data = (await resp.json()) as LiveChatResponse;
      this.nextPageToken = data.nextPageToken;
      this.lastPollInterval = data.pollingIntervalMillis || DEFAULT_POLL_MS;

      const comments: RawComment[] = data.items.map((item) => ({
        id: item.id,
        authorName: item.authorDetails.displayName,
        text: item.snippet.displayMessage,
        publishedAt: item.snippet.publishedAt,
      }));

      return {
        comments,
        nextPollMs: this.lastPollInterval,
      };
    } catch (err) {
      logger.error("YouTube fetch error:", err);
      this.backoffMs = Math.min(
        (this.backoffMs || 30_000) * 2,
        300_000,
      );
      return { comments: [], nextPollMs: this.backoffMs };
    }
  }

  private async validateLiveChatId(): Promise<void> {
    const params = new URLSearchParams({
      liveChatId: this.liveChatId,
      part: "id",
      maxResults: "1",
      key: this.apiKey,
    });

    const resp = await fetch(
      `${YOUTUBE_API_BASE}/liveChat/messages?${params}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    this.quotaUsed += QUOTA_PER_REQUEST;

    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => "(no body)");
      logger.error(`liveChatId validation failed:`, errorBody);
      throw new Error(
        `Invalid liveChatId "${this.liveChatId}": YouTube API returned ${resp.status}. ` +
          `If you entered a Video ID, please use the "Video ID" field instead.`,
      );
    }

    // 初回レスポンスからnextPageTokenとpollingIntervalを取得しておく
    const data = (await resp.json()) as LiveChatResponse;
    this.nextPageToken = data.nextPageToken;
    this.lastPollInterval = data.pollingIntervalMillis || DEFAULT_POLL_MS;
  }

  private async fetchLiveChatId(videoId: string): Promise<string> {
    const params = new URLSearchParams({
      id: videoId,
      part: "liveStreamingDetails",
      key: this.apiKey,
    });

    const resp = await fetch(
      `${YOUTUBE_API_BASE}/videos?${params}`,
      { signal: AbortSignal.timeout(10_000) },
    );

    if (!resp.ok) {
      throw new Error(`Failed to fetch video details: ${resp.status}`);
    }

    const data = await resp.json();
    const liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;

    if (!liveChatId) {
      throw new Error(`No active live chat found for video ${videoId}`);
    }

    return liveChatId;
  }

  getQuotaUsed(): number {
    return this.quotaUsed;
  }

  getQuotaRemaining(): number {
    return DAILY_QUOTA_LIMIT - this.quotaUsed;
  }

  getQuotaPercentRemaining(): number {
    return ((DAILY_QUOTA_LIMIT - this.quotaUsed) / DAILY_QUOTA_LIMIT) * 100;
  }
}
