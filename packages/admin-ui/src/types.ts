// Re-export shared types
export * from "@agent-game/shared";

// Admin-UI specific types

// --- LLM Configuration ---

export type ProviderId = "openai" | "anthropic" | "google" | "zai";

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  models: ModelInfo[];
  envKey: string;
  hasApiKey: boolean;
}

export interface LLMConfig {
  provider: ProviderId;
  model: string;
  apiKey?: string;
}

export interface LLMState {
  current: LLMConfig | null;
  pending: LLMConfig | null;
  requiresRestart: boolean;
}

// Import shared types for use in AdminCommand
import type { StreamConfig } from "@agent-game/shared";

export type AdminCommand =
  | { type: "stream:start"; config: StreamConfig }
  | { type: "stream:stop" }
  | { type: "stream:pause" }
  | { type: "stream:resume" }
  | { type: "game:skip" }
  | { type: "admin:message"; text: string }
  | { type: "comment:queue"; commentId: string }
  | { type: "comment:dismiss"; commentId: string }
  | { type: "llm:config"; config: LLMConfig }
  | { type: "llm:restart" };
