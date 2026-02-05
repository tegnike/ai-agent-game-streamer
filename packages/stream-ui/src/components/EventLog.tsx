import { useEffect, useRef } from 'react'
import { useStreamStore } from '../store/stream-store'

const TYPE_COLORS: Record<string, string> = {
  text: 'text-white',
  reasoning: 'text-gray-400',
  tool: 'text-blue-400',
  game: 'text-green-400',
  error: 'text-red-400',
  state: 'text-yellow-400',
  system: 'text-purple-400',
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
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-700 text-sm font-semibold text-gray-300">
        Event Log
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-xs"
      >
        {eventLog.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            Waiting for events...
          </div>
        ) : (
          eventLog.map((entry, i) => (
            <div key={i} className="flex gap-2 leading-5">
              <span className="text-gray-500 shrink-0">{entry.time}</span>
              <span
                className={`shrink-0 w-16 text-right ${TYPE_COLORS[entry.type] || 'text-gray-400'}`}
              >
                {entry.type}
              </span>
              <span className={TYPE_COLORS[entry.type] || 'text-gray-400'}>
                {entry.content}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
