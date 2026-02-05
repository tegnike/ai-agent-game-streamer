import { useState, useEffect, useCallback } from "react";
import { useStreamStore } from "../store/stream-store";
import { CollapsiblePanel } from "./CollapsiblePanel";
import type { ProviderId, LLMConfig } from "../types";

export function LLMConfigPanel() {
  const providers = useStreamStore((s) => s.providers);
  const setProviders = useStreamStore((s) => s.setProviders);
  const llmState = useStreamStore((s) => s.llmState);
  const setLLMState = useStreamStore((s) => s.setLLMState);
  const phase = useStreamStore((s) => s.state.phase);

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("zai");
  const [selectedModel, setSelectedModel] = useState("");
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
      const resp = await fetch("/api/llm/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await resp.json();
      if (resp.ok) {
        setLLMState(data);
        setApiKey(""); // Clear API key after applying
      } else {
        setError(data.error ?? "Failed to apply config");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedProvider, selectedModel, apiKey, setLLMState]);

  const handleRestart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/llm/restart", { method: "POST" });
      const data = await resp.json();
      if (!data.success) {
        setError(data.error ?? "Restart failed");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const isStreamRunning = phase !== "idle" && phase !== "stopped";
  const canRestart = llmState.requiresRestart && !isStreamRunning;
  const hasChanges =
    llmState.current &&
    (selectedProvider !== llmState.current.provider ||
      selectedModel !== llmState.current.model ||
      apiKey.trim() !== "");

  return (
    <CollapsiblePanel title="LLM Settings" className="llm-config-panel" defaultOpen={false}>
      {/* Current Config Display */}
      {llmState.current && (
        <div className="status-row">
          <span className="label">Current:</span>
          <span className="current-model">
            {llmState.current.provider}/{llmState.current.model}
          </span>
        </div>
      )}

      {/* Pending Config Warning */}
      {llmState.requiresRestart && llmState.pending && (
        <div className="pending-warning">
          Pending: {llmState.pending.provider}/{llmState.pending.model}
          <br />
          <small>Restart required to apply</small>
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

      {/* Action Buttons */}
      <div className="button-row">
        <button
          className="btn btn-send"
          onClick={handleApply}
          disabled={loading || !hasChanges}
        >
          {loading ? "Applying..." : "Apply"}
        </button>
        <button
          className="btn btn-restart"
          onClick={handleRestart}
          disabled={loading || !canRestart}
          title={isStreamRunning ? "Stop stream first" : ""}
        >
          {loading ? "Restarting..." : "Restart Server"}
        </button>
      </div>

      {/* Stream Running Warning */}
      {isStreamRunning && llmState.requiresRestart && (
        <div className="hint-text">
          Stop the stream to restart the LLM server.
        </div>
      )}

      {/* Error Display */}
      {error && <div className="error-text">{error}</div>}
    </CollapsiblePanel>
  );
}
