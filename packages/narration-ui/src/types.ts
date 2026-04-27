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

export type NarrationClientRole = 'ui' | 'producer' | 'observer'

export interface NarrationSayMessage {
  type: 'narration:say'
  id: string
  text: string
  speaker?: string
  emotion?: string
  interrupt?: boolean
  metadata?: Record<string, unknown>
  timestamp?: number
}

export interface NarrationStatusMessage {
  type: 'narration:started' | 'narration:completed' | 'narration:failed' | 'narration:skipped'
  id: string
  durationMs?: number
  error?: string
  timestamp?: number
}

export interface NarrationReadyMessage {
  type: 'narration:ready'
  role: NarrationClientRole
  uiClients: number
  pendingCount: number
}

export interface NarrationStateMessage {
  type: 'narration:state'
  uiClients: number
  pendingCount: number
  busy: boolean
}

export type NarrationServerMessage =
  | NarrationSayMessage
  | NarrationStatusMessage
  | NarrationReadyMessage
  | NarrationStateMessage
  | { type: 'error'; message: string }
