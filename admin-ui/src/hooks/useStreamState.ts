import { useStreamStore } from "../store/stream-store";
import type { StreamPhase } from "../types";

export function useStreamPhase(): StreamPhase {
  return useStreamStore((s) => s.state.phase);
}

export function useIsPlaying(): boolean {
  return useStreamStore(
    (s) => s.state.phase === "playing" || s.state.phase === "starting",
  );
}

export function useCurrentGame() {
  return useStreamStore((s) => ({
    gameId: s.state.currentGame,
    gameConfig: s.state.currentGameConfig,
  }));
}

export function useAgentState() {
  return useStreamStore((s) => ({
    thought: s.state.agentThought,
    speech: s.state.agentSpeech,
  }));
}
