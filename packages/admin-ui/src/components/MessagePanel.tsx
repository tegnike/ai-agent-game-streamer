import { useState } from "react";
import { CollapsiblePanel } from "./CollapsiblePanel";
import type { AdminCommand } from "../types";

interface Props {
  sendCommand: (cmd: AdminCommand) => void;
}

export function MessagePanel({ sendCommand }: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendCommand({ type: "admin:message", text: trimmed });
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <CollapsiblePanel title="Send Message" className="message-panel">
      <textarea
        className="message-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message to the AI agent..."
        rows={3}
      />
      <button className="btn btn-send" onClick={handleSend} disabled={!text.trim()}>
        Send to Agent
      </button>
    </CollapsiblePanel>
  );
}
