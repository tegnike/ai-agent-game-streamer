import type { RawComment } from "../types.js";

export interface CommentAdapter {
  readonly platform: string;
  connect(config: Record<string, unknown>): Promise<void>;
  disconnect(): Promise<void>;
  fetchRecent(): Promise<{ comments: RawComment[]; nextPollMs: number }>;
  isConnected(): boolean;
}
