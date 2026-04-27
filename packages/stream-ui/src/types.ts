// Re-export shared types
export * from "@agent-game/shared";

// Stream-UI specific types (TTS)
export interface TTSSentence {
  text: string;
  generationId: number;
  status: "pending" | "synthesizing" | "ready" | "playing" | "done" | "cancelled";
  audioData: ArrayBuffer | null;
}

export type NarrationEmotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'thinking'
