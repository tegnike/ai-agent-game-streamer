import { useEffect, useRef } from 'react'
import { useStreamStore } from '../store/stream-store'

const TYPE_COLORS: Record<string, string> = {
  text: '#00ff00',
  reasoning: '#888888',
  tool: '#00ffff',
  game: '#ffff00',
  error: '#ff4444',
  state: '#ff8800',
  system: '#ff00ff',
}

export function EventLog() {
  const eventLog = useStreamStore((s) => s.eventLog)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自動スクロール
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [eventLog])

  return (
    <div
      ref={scrollRef}
      className="biim-log h-full"
    >
      {eventLog.length === 0 ? (
        <div className="text-center py-2" style={{ color: '#666' }}>
          &gt; Waiting for events...
        </div>
      ) : (
        eventLog.slice(-50).map((entry, i) => (
          <div
            key={i}
            className="biim-log-entry"
            style={{ color: TYPE_COLORS[entry.type] || '#00ff00' }}
          >
            <span style={{ color: '#666' }}>{entry.time}</span>
            {' '}
            <span style={{ color: TYPE_COLORS[entry.type] || '#00ff00' }}>
              [{entry.type}]
            </span>
            {' '}
            {entry.content}
          </div>
        ))
      )}
    </div>
  )
}
