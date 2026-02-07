import { useEffect, useRef } from 'react'
import { useStreamStore } from '../store/stream-store'

export function EventLog() {
  const eventLog = useStreamStore((s) => s.eventLog)
  const scrollRef = useRef<HTMLDivElement>(null)

  // reasoning(思考)のみ抽出
  const thoughts = eventLog.filter((e) => e.type === 'reasoning')

  // 自動スクロール
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [thoughts])

  return (
    <div
      ref={scrollRef}
      className="biim-log h-full"
    >
      {thoughts.length === 0 ? (
        <div className="text-center py-2" style={{ color: '#666' }}>
          &gt; Waiting for thoughts...
        </div>
      ) : (
        thoughts.slice(-50).map((entry, i) => (
          <div
            key={i}
            className="biim-log-entry"
            style={{ color: '#cccccc', whiteSpace: 'normal', wordBreak: 'break-word' }}
          >
            {entry.content}
          </div>
        ))
      )}
    </div>
  )
}
