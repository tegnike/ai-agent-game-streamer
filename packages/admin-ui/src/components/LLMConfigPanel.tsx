import { useState, useEffect, useCallback, useMemo } from "react";
import { useStreamStore } from "../store/stream-store";
import { CollapsiblePanel } from "./CollapsiblePanel";
import type { ProviderId, ReasoningEffort, LLMConfig } from "../types";

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function LLMConfigPanel() {
  const providers = useStreamStore((s) => s.providers);
  const setProviders = useStreamStore((s) => s.setProviders);
  const llmState = useStreamStore((s) => s.llmState);
  const setLLMState = useStreamStore((s) => s.setLLMState);
  const phase = useStreamStore((s) => s.state.phase);

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("zai");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffort | "">("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch providers on mount
  useEffect(() => {
    fetch("/api/llm/providers")
      .then((res) => res.json())
      .then((data) => {
        setProviders(data);
        // Set default selections based on first provider
        if (data.length > 0) {
          const defaultProvider = data.find((p: { id: ProviderId }) => p.id === "zai") ?? data[0];
          setSelectedProvider(defaultProvider.id);
          if (defaultProvider.models.length > 0) {
            setSelectedModel(defaultProvider.models[0].id);
          }
        }
      })
      .catch(console.error);

    // Also fetch current LLM config
    fetch("/api/llm/config")
      .then((res) => res.json())
      .then((data) => {
        setLLMState(data);
        // Update selection to match current config
        if (data.current) {
          setSelectedProvider(data.current.provider);
          setSelectedModel(data.current.model);
          setSelectedEffort(data.current.reasoningEffort ?? "");
        }
      })
      .catch(console.error);
  }, [setProviders, setLLMState]);

  // Update model selection when provider changes
  useEffect(() => {
    const provider = providers.find((p) => p.id === selectedProvider);
    if (provider && provider.models.length > 0) {
      // Keep current model if it exists in new provider, otherwise use first
      const modelExists = provider.models.some((m) => m.id === selectedModel);
      if (!modelExists) {
        setSelectedModel(provider.models[0].id);
      }
    }
  }, [selectedProvider, providers, selectedModel]);

  const currentProvider = providers.find((p) => p.id === selectedProvider);

  // Determine reasoning effort options based on selected model
  const currentModel = currentProvider?.models.find((m) => m.id === selectedModel);
  const supportedEfforts = currentModel?.reasoningEfforts;

  // Reset effort when switching to a model that doesn't support it
  useEffect(() => {
    if (!supportedEfforts?.length) {
      setSelectedEffort("");
    } else if (selectedEffort && !supportedEfforts.includes(selectedEffort)) {
      // Current effort is not supported by the new model, reset
      setSelectedEffort("");
    }
  }, [selectedModel, supportedEfforts, selectedEffort]);

  const effortOptions = useMemo(() => {
    if (!supportedEfforts?.length) return [];
    return [
      { value: "" as const, label: "Default" },
      ...supportedEfforts.map((e) => ({ value: e, label: EFFORT_LABELS[e] })),
    ];
  }, [supportedEfforts]);

  const handleApply = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const config: LLMConfig = {
        provider: selectedProvider,
        model: selectedModel,
      };
      if (apiKey.trim()) {
        config.apiKey = apiKey.trim();
      }
      if (selectedEffort) {
        config.reasoningEffort = selectedEffort;
      }
      const resp = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await resp.json();
      if (data.success) {
        setLLMState(data);
        setApiKey("");
      } else {
        setError(data.error ?? "Failed to apply config");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedProvider, selectedModel, selectedEffort, apiKey, setLLMState]);

  const isStreamRunning = phase !== "idle" && phase !== "stopped";
  const hasChanges =
    llmState.current &&
    (selectedProvider !== llmState.current.provider ||
      selectedModel !== llmState.current.model ||
      (selectedEffort || undefined) !== llmState.current.reasoningEffort ||
      apiKey.trim() !== "");

  return (
    <CollapsiblePanel title="LLM Settings" className="llm-config-panel">
      {/* Current Config Display */}
      {llmState.current && (
        <div className="status-row">
          <span className="label">Current:</span>
          <span className="current-model">
            {llmState.current.provider}/{llmState.current.model}
            {llmState.current.reasoningEffort && ` (reasoning: ${llmState.current.reasoningEffort})`}
          </span>
        </div>
      )}

      {/* Provider Selection */}
      <div className="form-group">
        <label htmlFor="provider-select">Provider</label>
        <select
          id="provider-select"
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value as ProviderId)}
          disabled={loading}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.hasApiKey ? "" : "(No API Key)"}
            </option>
          ))}
        </select>
      </div>

      {/* Model Selection */}
      <div className="form-group">
        <label htmlFor="model-select">Model</label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={loading}
        >
          {currentProvider?.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} {m.description ? `- ${m.description}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* API Key Input */}
      <div className="form-group">
        <label htmlFor="api-key-input">
          API Key
          {currentProvider?.hasApiKey && (
            <span className="env-hint"> (env var set)</span>
          )}
        </label>
        <input
          id="api-key-input"
          type="password"
          placeholder={currentProvider?.hasApiKey ? "Using environment variable" : "Enter API key"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={loading}
        />
      </div>

      {/* Reasoning Effort — only shown when the selected model supports it */}
      {effortOptions.length > 0 && (
        <div className="form-group">
          <label htmlFor="reasoning-effort-select">Reasoning Effort</label>
          <select
            id="reasoning-effort-select"
            value={selectedEffort}
            onChange={(e) => setSelectedEffort(e.target.value as ReasoningEffort | "")}
            disabled={loading}
          >
            {effortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action Button */}
      <div className="button-row">
        <button
          className="btn btn-send"
          onClick={handleApply}
          disabled={loading || !hasChanges || isStreamRunning}
          title={isStreamRunning ? "Stop stream first" : ""}
        >
          {loading ? "Applying..." : "Apply"}
        </button>
      </div>

      {/* Stream Running Warning */}
      {isStreamRunning && hasChanges && (
        <div className="hint-text">
          Stop the stream to change the LLM settings.
        </div>
      )}

      {/* Error Display */}
      {error && <div className="error-text">{error}</div>}
    </CollapsiblePanel>
  );
}
