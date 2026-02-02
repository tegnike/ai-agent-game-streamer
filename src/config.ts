import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "@opencode-ai/sdk";

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
    defaultModel: "gpt-4.1",
    smallModel: "gpt-4.1-mini",
    envKey: "OPENAI_API_KEY",
  },
  anthropic: {
    defaultModel: "claude-sonnet-4-20250514",
    smallModel: "claude-haiku-3-5-20241022",
    envKey: "ANTHROPIC_API_KEY",
  },
  google: {
    defaultModel: "gemini-2.5-pro",
    smallModel: "gemini-2.5-flash",
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

export function buildModelConfig(
  providerName?: string,
  modelName?: string,
): Config | undefined {
  if (!providerName && !modelName) {
    return undefined;
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
