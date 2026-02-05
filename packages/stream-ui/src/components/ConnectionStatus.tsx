import { useEffect, useRef } from 'react'
import { useStreamStore } from '../store/stream-store'
import { checkVoicevoxHealth } from '../services/voicevox-client'

const STATUS_CLASS: Record<string, string> = {
  connected: 'biim-status-ok',
  connecting: 'biim-status-warn',
  reconnecting: 'biim-status-warn',
  disconnected: 'biim-status-error',
}

const VOICEVOX_CLASS: Record<string, string> = {
  connected: 'biim-status-ok',
  unavailable: 'biim-status-error',
  checking: 'biim-status-warn',
}

export function ConnectionStatus() {
  const connectionStatus = useStreamStore((s) => s.connectionStatus)
  const voicevoxStatus = useStreamStore((s) => s.voicevoxStatus)
  const setVoicevoxStatus = useStreamStore((s) => s.setVoicevoxStatus)
  const currentGame = useStreamStore((s) => s.state.currentGameConfig)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = async () => {
      setVoicevoxStatus('checking')
      const ok = await checkVoicevoxHealth()
      setVoicevoxStatus(ok ? 'connected' : 'unavailable')
    }

    check()
    intervalRef.current = setInterval(check, 10000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [setVoicevoxStatus])

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-3 py-1 text-xs"
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        fontFamily: "'DotGothic16', 'MS Gothic', monospace",
        color: '#00ff00',
      }}
    >
      <div className="flex items-center gap-1">
        <span className={`biim-status-dot ${STATUS_CLASS[connectionStatus]}`} />
        <span>WS:{connectionStatus}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`biim-status-dot ${VOICEVOX_CLASS[voicevoxStatus]}`} />
        <span>
          TTS:{voicevoxStatus === 'unavailable' ? 'OFF' : voicevoxStatus === 'connected' ? 'OK' : '...'}
        </span>
      </div>
      {currentGame && (
        <div className="flex items-center gap-1 ml-auto" style={{ color: '#ffff00' }}>
          <span>GAME:{currentGame.nameJa || currentGame.name}</span>
        </div>
      )}
    </div>
  )
}
