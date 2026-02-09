import { useEffect, useRef, useCallback } from "react";
import { useStreamStore } from "../store/stream-store";
import type { AdminCommand, ServerEvent, LLMState } from "../types";

const RECONNECT_CONFIG = {
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  // In dev, connect directly to the backend to avoid Vite ws proxy EPIPE errors
  const host = import.meta.env.DEV ? "localhost:3000" : window.location.host;
  return `${protocol}//${host}/ws/admin`;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(RECONNECT_CONFIG.initialDelay);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const {
    setConnectionStatus,
    setState,
    updateState,
    addActivity,
    updateComment,
    addEventLog,
    setLLMState,
  } = useStreamStore();

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerEvent;
        switch (msg.type) {
          case "state:full":
            setState(msg.data);
            addEventLog("state", `Full state received (phase: ${msg.data.phase})`);
            break;
          case "state:update":
            updateState(msg.data);
            if (msg.data.phase) {
              addEventLog("state", `Phase: ${msg.data.phase}`);
            }
            break;
          case "agent:activity":
            addActivity(msg.data);
            addEventLog(
              msg.data.type,
              msg.data.type === "tool"
                ? `[${msg.data.toolName}] ${msg.data.content.substring(0, 80)}`
                : msg.data.content.substring(0, 100),
            );
            break;
          case "game:event":
            addEventLog("game", `${msg.data.type}: ${msg.data.gameId}`);
            break;
          case "comment:updated":
            updateComment(msg.data);
            break;
          case "llm:state": {
            const llmState = msg.data as LLMState;
            setLLMState(llmState);
            addEventLog("llm", `LLM: ${llmState.current?.provider}/${llmState.current?.model}`);
            break;
          }
          case "error":
            addEventLog("error", msg.message);
            break;
        }
      } catch {
        // Invalid message
      }
    },
    [setState, updateState, addActivity, updateComment, addEventLog, setLLMState],
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    setConnectionStatus("connecting");
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      reconnectDelay.current = RECONNECT_CONFIG.initialDelay;
      addEventLog("system", "WebSocket connected");
    };

    ws.onmessage = handleMessage;

    ws.onclose = () => {
      if (!mountedRef.current) return;
      // Ignore close events from stale WebSocket instances (e.g. React StrictMode remount)
      if (wsRef.current !== ws) return;
      setConnectionStatus("reconnecting");
      addEventLog("system", "WebSocket disconnected, reconnecting...");
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, [setConnectionStatus, handleMessage, addEventLog]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);

    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, reconnectDelay.current);

    reconnectDelay.current = Math.min(
      reconnectDelay.current * RECONNECT_CONFIG.backoffMultiplier,
      RECONNECT_CONFIG.maxDelay,
    );
  }, [connect]);

  const sendCommand = useCallback((command: AdminCommand) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(command));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { sendCommand };
}
