import { useEffect, useRef } from 'react'
import { useStreamStore } from '../store/stream-store'
import { checkVoicevoxHealth } from '../services/voicevox-client'

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  reconnecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
}

const VOICEVOX_COLORS: Record<string, string> = {
  connected: 'bg-green-500',
  unavailable: 'bg-red-500',
  checking: 'bg-yellow-500',
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
    <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-4 py-2 text-sm bg-black/50">
      <div className="flex items-center gap-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[connectionStatus]}`} />
        <span className="text-gray-300">WS: {connectionStatus}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${VOICEVOX_COLORS[voicevoxStatus]}`} />
        <span className="text-gray-300">
          VOICEVOX: {voicevoxStatus === 'unavailable' ? 'VOICEVOX未検出' : voicevoxStatus}
        </span>
      </div>
      {currentGame && (
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-gray-400">🎮</span>
          <span className="text-gray-300">{currentGame.nameJa || currentGame.name}</span>
        </div>
      )}
    </div>
  )
}
