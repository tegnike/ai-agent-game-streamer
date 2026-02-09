import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "@opencode-ai/sdk";
import type {
  ProviderId,
  ModelInfo,
  ProviderInfo,
  LLMConfig,
} from "./stream/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, "..");

export const OPENCODE_CONFIG = {
  hostname: "127.0.0.1",
  port: 4096,
  timeout: 10_000,
} as const;

export const GAME_SERVER_PORT = 8888;
export const DEFAULT_MOVE_DELAY_MS = 500;
export const AGENT_NAME = "game-streamer";

// --- Stream Server ---
export const STREAM_SERVER_PORT = 3000;
export const DEFAULT_PAUSE_BETWEEN_GAMES = 5000;
export const DEFAULT_VISUAL_BATCH_INTERVAL = 500;

/** Ports that killPort() is allowed to operate on */
export const MANAGED_PORTS = [GAME_SERVER_PORT, OPENCODE_CONFIG.port] as const;

// --- LLM Provider Presets ---

type ProviderPreset = {
  defaultModel: string;
  smallModel: string;
  envKey: string;
  npm?: string;
  baseURL?: string;
};

const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  openai: {
    defaultModel: "gpt-5.2",
    smallModel: "gpt-5-mini",
    envKey: "OPENAI_API_KEY",
  },
  anthropic: {
    defaultModel: "claude-sonnet-4-5-20250929",
    smallModel: "claude-haiku-4-5-20251001",
    envKey: "ANTHROPIC_API_KEY",
  },
  google: {
    defaultModel: "gemini-3-pro-preview",
    smallModel: "gemini-3-flash-preview",
    envKey: "GOOGLE_API_KEY",
  },
  zai: {
    defaultModel: "glm-4.7",
    smallModel: "glm-4.7-flash",
    envKey: "ZAI_API_KEY",
    npm: "@ai-sdk/openai-compatible",
    baseURL: "https://api.z.ai/api/coding/paas/v4",
  },
};

export const DEFAULT_PROVIDER: ProviderId = "zai";

// --- Extended Provider Configs with Model Lists ---

interface ProviderConfig {
  name: string;
  models: ModelInfo[];
  defaultModel: string;
  smallModel: string;
  envKey: string;
  npm?: string;
  baseURL?: string;
}

export const PROVIDER_CONFIGS: Record<ProviderId, ProviderConfig> = {
  openai: {
    name: "OpenAI",
    models: [
      { id: "gpt-5.2", name: "GPT-5.2", description: "最新フラッグシップ（思考モデル）" },
      { id: "gpt-5.2-pro", name: "GPT-5.2 Pro", description: "最高性能・高度な推論" },
      { id: "gpt-5-mini", name: "GPT-5 Mini", description: "高速・コスト効率" },
      { id: "o3", name: "o3", description: "推論モデル" },
      { id: "o4-mini", name: "o4-mini", description: "効率的な推論モデル" },
      { id: "gpt-4.1", name: "GPT-4.1", description: "旧世代フラッグシップ" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "旧世代バランスモデル" },
    ],
    defaultModel: "gpt-5.2",
    smallModel: "gpt-5-mini",
    envKey: "OPENAI_API_KEY",
  },
  anthropic: {
    name: "Anthropic",
    models: [
      { id: "claude-opus-4-6-20260205", name: "Claude Opus 4.6", description: "最高性能・最新" },
      { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5", description: "バランス型" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", description: "高速・効率的" },
      { id: "claude-opus-4-20250514", name: "Claude Opus 4", description: "旧世代最高性能" },
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "旧世代バランス型" },
    ],
    defaultModel: "claude-sonnet-4-5-20250929",
    smallModel: "claude-haiku-4-5-20251001",
    envKey: "ANTHROPIC_API_KEY",
  },
  google: {
    name: "Google",
    models: [
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "最新フラッグシップ（プレビュー）" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "最新高速モデル（プレビュー）" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "安定版・高度な機能" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "安定版・高速応答" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "安定版・軽量" },
    ],
    defaultModel: "gemini-3-pro-preview",
    smallModel: "gemini-3-flash-preview",
    envKey: "GOOGLE_API_KEY",
  },
  zai: {
    name: "Zai (智谱AI)",
    models: [
      { id: "glm-4.7", name: "GLM-4.7", description: "フラッグシップ" },
      { id: "glm-4.7-flash", name: "GLM-4.7 Flash", description: "高速版" },
    ],
    defaultModel: "glm-4.7",
    smallModel: "glm-4.7-flash",
    envKey: "ZAI_API_KEY",
    npm: "@ai-sdk/openai-compatible",
    baseURL: "https://api.z.ai/api/coding/paas/v4",
  },
};

/**
 * Get list of all providers with API key availability status
 */
export function getProviderInfoList(): ProviderInfo[] {
  return (Object.keys(PROVIDER_CONFIGS) as ProviderId[]).map((id) => {
    const config = PROVIDER_CONFIGS[id];
    return {
      id,
      name: config.name,
      models: config.models,
      envKey: config.envKey,
      hasApiKey: !!process.env[config.envKey],
      npm: config.npm,
      baseURL: config.baseURL,
    };
  });
}

/**
 * Build OpenCode SDK Config from LLMConfig
 */
export function buildModelConfigFromLLM(llmConfig: LLMConfig): Config {
  const providerConfig = PROVIDER_CONFIGS[llmConfig.provider];
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${llmConfig.provider}`);
  }

  const config: Record<string, unknown> = {
    env: [providerConfig.envKey],
  };
  if (providerConfig.npm) {
    config.npm = providerConfig.npm;
  }
  if (providerConfig.baseURL) {
    config.options = { baseURL: providerConfig.baseURL };
  }
  // If API key is provided via UI, set it in environment
  if (llmConfig.apiKey) {
    process.env[providerConfig.envKey] = llmConfig.apiKey;
  }

  return {
    model: `${llmConfig.provider}/${llmConfig.model}`,
    small_model: `${llmConfig.provider}/${providerConfig.smallModel}`,
    provider: {
      [llmConfig.provider]: config,
    },
  } as Config;
}

export function buildModelConfig(
  providerName?: string,
  modelName?: string,
): Config | undefined {
  if (!providerName && !modelName) {
    providerName = DEFAULT_PROVIDER;
  }

  let provider: string;
  let model: string;
  let smallModel: string;

  if (providerName && !modelName) {
    // --provider only: use preset defaults
    const preset = PROVIDER_PRESETS[providerName];
    if (!preset) {
      const available = Object.keys(PROVIDER_PRESETS).join(", ");
      throw new Error(
        `Unknown provider: "${providerName}". Available: ${available}`,
      );
    }
    provider = providerName;
    model = preset.defaultModel;
    smallModel = preset.smallModel;
  } else if (modelName && !providerName) {
    // --model only: infer provider from "provider/model" format
    const slashIndex = modelName.indexOf("/");
    if (slashIndex === -1) {
      throw new Error(
        `Model must be in "provider/model" format when --provider is not specified. Got: "${modelName}"`,
      );
    }
    provider = modelName.substring(0, slashIndex);
    if (!PROVIDER_PRESETS[provider]) {
      const available = Object.keys(PROVIDER_PRESETS).join(", ");
      throw new Error(
        `Unknown provider "${provider}" inferred from model. Available: ${available}`,
      );
    }
    model = modelName.substring(slashIndex + 1);
    smallModel = PROVIDER_PRESETS[provider].smallModel;
  } else {
    // Both specified
    const preset = PROVIDER_PRESETS[providerName!];
    if (!preset) {
      const available = Object.keys(PROVIDER_PRESETS).join(", ");
      throw new Error(
        `Unknown provider: "${providerName}". Available: ${available}`,
      );
    }
    provider = providerName!;
    // Strip provider prefix if present
    const prefix = `${provider}/`;
    model = modelName!.startsWith(prefix)
      ? modelName!.substring(prefix.length)
      : modelName!;
    smallModel = preset.smallModel;
  }

  const preset = PROVIDER_PRESETS[provider];
  const providerConfig: Record<string, unknown> = {
    env: [preset.envKey],
  };
  if (preset.npm) {
    providerConfig.npm = preset.npm;
  }
  if (preset.baseURL) {
    providerConfig.options = { baseURL: preset.baseURL };
  }

  return {
    model: `${provider}/${model}`,
    small_model: `${provider}/${smallModel}`,
    provider: {
      [provider]: providerConfig,
    },
  } as Config;
}
