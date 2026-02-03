import { useRef, useEffect } from "react";
import { useStreamStore } from "../store/stream-store";

export function EventLog() {
  const eventLog = useStreamStore((s) => s.eventLog);
  const clearEventLog = useStreamStore((s) => s.clearEventLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLog]);

  return (
    <div className="panel event-log">
      <div className="panel-header">
        <h2>Event Log</h2>
        <button className="btn btn-sm" onClick={clearEventLog}>
          Clear
        </button>
      </div>
      <div className="event-log-list" ref={scrollRef}>
        {eventLog.map((entry, i) => (
          <div key={i} className={`log-entry log-${entry.type}`}>
            <span className="log-time">{entry.time}</span>
            <span className="log-type">[{entry.type}]</span>
            <span className="log-content">{entry.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
