// Re-export shared types
export * from "@agent-game/shared";

// Admin-UI specific types

// --- LLM Configuration ---

export type ProviderId = "openai" | "anthropic" | "google" | "zai" | "custom";

export type ReasoningEffort = "low" | "medium" | "high";

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  /** Supported reasoning effort levels. undefined = reasoning not supported */
  reasoningEfforts?: ReasoningEffort[];
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
  reasoningEffort?: ReasoningEffort;
  /** OpenAI-compatible endpoint base URL (for "custom" provider) */
  baseURL?: string;
  /** Small model for summaries etc. (for "custom" provider, defaults to model) */
  smallModel?: string;
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
  | { type: "comment:dismiss"; commentId: string };
