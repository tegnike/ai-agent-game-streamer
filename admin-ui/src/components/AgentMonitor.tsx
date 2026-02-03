import { useRef, useEffect } from "react";
import { useStreamStore } from "../store/stream-store";

export function AgentMonitor() {
  const thought = useStreamStore((s) => s.state.agentThought);
  const speech = useStreamStore((s) => s.state.agentSpeech);
  const activities = useStreamStore((s) => s.activities);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);

  return (
    <div className="panel agent-monitor">
      <h2>Agent Monitor</h2>

      <div className="agent-state">
        <div className="agent-thought">
          <span className="label">Thought:</span>
          <span className="value">{thought || "-"}</span>
        </div>
        <div className="agent-speech">
          <span className="label">Speech:</span>
          <span className="value">{speech || "-"}</span>
        </div>
      </div>

      <div className="activity-list" ref={scrollRef}>
        {activities.map((activity) => (
          <div key={activity.id} className={`activity activity-${activity.type}`}>
            {activity.type === "tool" ? (
              <span>
                <span className={`tool-badge tool-${activity.toolStatus}`}>
                  [{activity.toolName}]
                </span>{" "}
                {activity.content.substring(0, 120)}
              </span>
            ) : (
              <span>{activity.content.substring(0, 200)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
