import { create } from "zustand";
import type {
  StreamState,
  AgentActivity,
  ViewerComment,
  ConnectionStatus,
  GameConfig,
  GameId,
  ProviderInfo,
  LLMState,
} from "../types";

interface StreamStore {
  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Stream state
  state: StreamState;
  setState: (state: StreamState) => void;
  updateState: (partial: Partial<StreamState>) => void;

  // Activities
  activities: AgentActivity[];
  addActivity: (activity: AgentActivity) => void;
  clearActivities: () => void;

  // Comments
  comments: ViewerComment[];
  setComments: (comments: ViewerComment[]) => void;
  updateComment: (comment: ViewerComment) => void;

  // Games
  availableGames: GameConfig[];
  setAvailableGames: (games: GameConfig[]) => void;
  selectedGames: GameId[];
  toggleGame: (gameId: GameId) => void;
  setSelectedGames: (games: GameId[]) => void;

  // Event log
  eventLog: { time: string; type: string; content: string }[];
  addEventLog: (type: string, content: string) => void;
  clearEventLog: () => void;

  // LLM Configuration
  providers: ProviderInfo[];
  setProviders: (providers: ProviderInfo[]) => void;
  llmState: LLMState;
  setLLMState: (state: LLMState) => void;
}

const DEFAULT_STATE: StreamState = {
  phase: "idle",
  mode: "single",
  currentGame: null,
  currentGameConfig: null,
  sessionId: null,
  gamesPlayed: [],
  gamesCompleted: 0,
  agentThought: null,
  agentSpeech: null,
  config: { mode: "single" },
  startedAt: null,
  error: null,
  browser: { mode: "none", running: false, launchedByUs: false },
};

const MAX_ACTIVITIES = 200;
const MAX_EVENT_LOG = 500;

const DEFAULT_LLM_STATE: LLMState = {
  current: null,
  pending: null,
  requiresRestart: false,
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ja-JP", { hour12: false });
}

export const useStreamStore = create<StreamStore>((set) => ({
  connectionStatus: "disconnected",
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  state: DEFAULT_STATE,
  setState: (state) => set({ state }),
  updateState: (partial) =>
    set((prev) => ({
      state: { ...prev.state, ...partial },
    })),

  activities: [],
  addActivity: (activity) =>
    set((prev) => {
      const next = [...prev.activities, activity];
      if (next.length > MAX_ACTIVITIES) next.shift();
      return { activities: next };
    }),
  clearActivities: () => set({ activities: [] }),

  comments: [],
  setComments: (comments) => set({ comments }),
  updateComment: (comment) =>
    set((prev) => {
      const idx = prev.comments.findIndex((c) => c.id === comment.id);
      if (idx === -1) {
        return { comments: [...prev.comments, comment] };
      }
      const next = [...prev.comments];
      next[idx] = comment;
      return { comments: next };
    }),

  availableGames: [],
  setAvailableGames: (games) => set({ availableGames: games }),
  selectedGames: [],
  toggleGame: (gameId) =>
    set((prev) => {
      const has = prev.selectedGames.includes(gameId);
      return {
        selectedGames: has
          ? prev.selectedGames.filter((id) => id !== gameId)
          : [...prev.selectedGames, gameId],
      };
    }),
  setSelectedGames: (games) => set({ selectedGames: games }),

  eventLog: [],
  addEventLog: (type, content) =>
    set((prev) => {
      const next = [
        ...prev.eventLog,
        { time: formatTime(new Date()), type, content },
      ];
      if (next.length > MAX_EVENT_LOG) next.shift();
      return { eventLog: next };
    }),
  clearEventLog: () => set({ eventLog: [] }),

  providers: [],
  setProviders: (providers) => set({ providers }),
  llmState: DEFAULT_LLM_STATE,
  setLLMState: (llmState) => set({ llmState }),
}));
