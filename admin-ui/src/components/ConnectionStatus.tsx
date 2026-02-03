import { useStreamStore } from "../store/stream-store";
import type { ConnectionStatus as ConnStatus } from "../types";

const STATUS_CONFIG: Record<ConnStatus, { icon: string; label: string; className: string }> = {
  connected: { icon: "\u25cf", label: "Connected", className: "status-connected" },
  connecting: { icon: "\u25d0", label: "Connecting...", className: "status-connecting" },
  reconnecting: { icon: "\u25d0", label: "Reconnecting...", className: "status-reconnecting" },
  disconnected: { icon: "\u25cb", label: "Disconnected", className: "status-disconnected" },
};

export function ConnectionStatus() {
  const status = useStreamStore((s) => s.connectionStatus);
  const config = STATUS_CONFIG[status];

  return (
    <span className={`connection-status ${config.className}`}>
      {config.icon} {config.label}
    </span>
  );
}
