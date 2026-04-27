import type { Config } from "@opencode-ai/sdk";
import type { LLMConfig, LLMState, ProviderInfo, BuiltInProviderId, ReasoningEffort } from "./types.js";
import {
  getProviderInfoList,
  buildModelConfigFromLLM,
  DEFAULT_PROVIDER,
  PROVIDER_CONFIGS,
} from "../config.js";

/**
 * Manages LLM configuration state for the stream server.
 * Tracks current (active) and pending configurations.
 */
export class LLMConfigManager {
  private currentConfig: LLMConfig | null = null;
  private pendingConfig: LLMConfig | null = null;

  /**
   * Initialize with configuration from CLI args or default
   */
  initialize(providerName?: string, modelName?: string, reasoningEffort?: string): void {
    const effort = this.parseEffort(reasoningEffort);
    if (providerName || modelName) {
      const provider = (providerName || DEFAULT_PROVIDER) as LLMConfig["provider"];
      const providerConfig = PROVIDER_CONFIGS[provider as BuiltInProviderId];
      const model = modelName?.includes("/")
        ? modelName.split("/")[1]
        : modelName || providerConfig?.defaultModel;

      this.currentConfig = { provider, model, reasoningEffort: effort };
    } else {
      // Use default provider and model
      const providerConfig = PROVIDER_CONFIGS[DEFAULT_PROVIDER as BuiltInProviderId];
      this.currentConfig = {
        provider: DEFAULT_PROVIDER,
        model: providerConfig.defaultModel,
        reasoningEffort: effort,
      };
    }
  }

  private parseEffort(value?: string): ReasoningEffort | undefined {
    if (!value) return undefined;
    if (value === "low" || value === "medium" || value === "high") return value;
    return undefined;
  }

  /**
   * Get list of all available providers with API key status
   */
  getProviders(): ProviderInfo[] {
    return getProviderInfoList();
  }

  /**
   * Get current LLM state (current + pending configs)
   */
  getState(): LLMState {
    return {
      current: this.currentConfig,
      pending: this.pendingConfig,
      requiresRestart: this.requiresRestart(),
    };
  }

  /**
   * Check if pending config differs from current (restart needed)
   */
  private requiresRestart(): boolean {
    if (!this.pendingConfig) return false;
    if (!this.currentConfig) return true;
    return (
      this.pendingConfig.provider !== this.currentConfig.provider ||
      this.pendingConfig.model !== this.currentConfig.model ||
      this.pendingConfig.reasoningEffort !== this.currentConfig.reasoningEffort ||
      this.pendingConfig.baseURL !== this.currentConfig.baseURL ||
      this.pendingConfig.smallModel !== this.currentConfig.smallModel
    );
  }

  /**
   * Set pending configuration (to be applied on restart)
   */
  setConfig(config: LLMConfig): void {
    this.pendingConfig = config;
  }

  /**
   * Get pending config if set, otherwise current config
   */
  getPendingOrCurrent(): LLMConfig | null {
    return this.pendingConfig || this.currentConfig;
  }

  /**
   * Apply pending config and return OpenCode SDK Config.
   * Call this when restarting the OpenCode server.
   */
  applyPendingConfig(): Config | null {
    if (!this.pendingConfig) {
      return null;
    }

    // Apply pending to current
    this.currentConfig = { ...this.pendingConfig };
    this.pendingConfig = null;

    return buildModelConfigFromLLM(this.currentConfig);
  }

  /**
   * Get OpenCode SDK Config for current configuration.
   * Used for initial server startup.
   */
  getCurrentConfig(): Config | null {
    if (!this.currentConfig) {
      return null;
    }
    return buildModelConfigFromLLM(this.currentConfig);
  }

  /**
   * Clear pending config without applying
   */
  clearPending(): void {
    this.pendingConfig = null;
  }
}
