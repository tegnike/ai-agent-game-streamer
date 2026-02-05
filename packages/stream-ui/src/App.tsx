import { useState, useCallback, useEffect } from 'react'
import { useTTS } from './hooks/useTTS'
import { useWebSocket } from './hooks/useWebSocket'
import { CharacterDisplay } from './components/CharacterDisplay'
import { EventLog } from './components/EventLog'
import { Subtitle } from './components/Subtitle'
import { ConnectionStatus } from './components/ConnectionStatus'
import { useStreamStore } from './store/stream-store'
import type { TTSPipeline } from './services/tts-pipeline'

// biim式タイマーフック
function useTimer() {
  const startedAt = useStreamStore((s) => s.state.startedAt)
  const phase = useStreamStore((s) => s.state.phase)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt || phase === 'idle' || phase === 'stopped') {
      return
    }

    const update = () => {
      setElapsed(Date.now() - startedAt)
    }
    update()
    const interval = setInterval(update, 100)
    return () => clearInterval(interval)
  }, [startedAt, phase])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const centis = Math.floor((ms % 1000) / 10)
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`
  }

  return { elapsed, formatted: startedAt ? formatTime(elapsed) : '--:--:--.--' }
}

// biim式ゲーム情報パネル
function GameInfoPanel() {
  const currentGame = useStreamStore((s) => s.state.currentGameConfig)
  const phase = useStreamStore((s) => s.state.phase)
  const gamesCompleted = useStreamStore((s) => s.state.gamesCompleted)

  const phaseLabel = (p: string) => {
    switch (p) {
      case 'idle': return '待機中'
      case 'starting': return '開始中'
      case 'playing': return 'プレイ中'
      case 'transitioning': return '移行中'
      case 'paused': return '一時停止'
      case 'stopped': return '停止'
      default: return p
    }
  }

  return (
    <div className="biim-section biim-border">
      <div className="biim-section-title">ゲーム情報</div>
      <div className="biim-section-content text-xs space-y-1">
        <div className="flex justify-between">
          <span>タイトル:</span>
          <span className="font-bold">{currentGame?.nameJa || currentGame?.name || '---'}</span>
        </div>
        <div className="flex justify-between">
          <span>状態:</span>
          <span className={phase === 'playing' ? 'text-green-600 font-bold' : ''}>
            {phaseLabel(phase)}
          </span>
        </div>
        <div className="flex justify-between">
          <span>完了数:</span>
          <span>{gamesCompleted} 回</span>
        </div>
      </div>
    </div>
  )
}

// biim式メインレイアウト
function BiimLayout({ pipeline }: { pipeline: TTSPipeline }) {
  useWebSocket(pipeline)

  const phase = useStreamStore((s) => s.state.phase)
  const startedAt = useStreamStore((s) => s.state.startedAt)
  const currentGame = useStreamStore((s) => s.state.currentGameConfig)
  const isPlaying = phase === 'playing'
  const { formatted } = useTimer()

  return (
    <div className="h-screen w-screen biim-layout flex flex-col overflow-hidden">
      {/* メインエリア - CSS Grid で左右の行を揃える */}
      <div
        className="flex-1 min-h-0 grid p-2 gap-2"
        style={{
          gridTemplateColumns: '1fr 280px',
          gridTemplateRows: '1fr auto',
        }}
      >
        {/* 左上: ゲーム画面 */}
        <div className="biim-border biim-border-inset min-h-0 flex items-center justify-center bg-black">
          <div className="relative w-full h-full flex items-center justify-center">
            {/* ゲーム画面プレースホルダー */}
            <span className="text-xl text-gray-600">GAME SCREEN</span>
            <ConnectionStatus />
          </div>
        </div>

        {/* 右上: ゲーム情報 + ログ */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* ゲーム情報 */}
          <GameInfoPanel />

          {/* イベントログ */}
          <div className="biim-section biim-border flex-1 flex flex-col min-h-0">
            <div className="biim-section-title">ログ</div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <EventLog />
            </div>
          </div>
        </div>

        {/* 左下: 字幕エリア */}
        <div className="flex items-start justify-center pt-4 px-4">
          <Subtitle />
        </div>

        {/* 右下: キャラクター */}
        <div className="biim-section biim-border">
          <CharacterDisplay />
        </div>
      </div>

      {/* 下部: タイマーバー */}
      <div className="biim-panel biim-border flex items-center gap-4 px-4 py-2">
        {/* タイマー（startedAtがある場合のみ表示） */}
        {startedAt && (
          <div className="biim-timer biim-border-inset">
            {formatted}
          </div>
        )}

        {/* ゲーム名 */}
        <div className="flex-1 text-center" style={{ color: '#000' }}>
          {currentGame ? (
            <span className="font-bold">{currentGame.nameJa || currentGame.name}</span>
          ) : (
            <span className="text-gray-500">ゲーム未選択</span>
          )}
        </div>

        {/* ステータス表示 */}
        <div className="flex gap-4 text-xs" style={{ color: '#000' }}>
          <div className="flex items-center">
            <span
              className={`biim-status-dot ${isPlaying ? 'biim-status-ok biim-blink' : 'biim-status-warn'}`}
            />
            <span>{isPlaying ? 'LIVE' : 'STANDBY'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [audioReady, setAudioReady] = useState(false)
  const pipeline = useTTS()

  const handleStart = useCallback(async () => {
    await pipeline.audioPlayer.initialize()
    setAudioReady(true)
  }, [pipeline])

  if (!audioReady) {
    return (
      <div className="h-screen flex items-center justify-center biim-layout">
        <div className="biim-panel biim-border p-0">
          <div className="biim-title">AI Agent Game Streamer</div>
          <div className="p-8 text-center">
            <div className="mb-4 text-lg" style={{ color: '#000' }}>
              biim式配信UI
            </div>
            <button
              onClick={handleStart}
              className="biim-border px-8 py-3 bg-[#c0c0c0] hover:bg-[#d0d0d0] text-black font-bold cursor-pointer active:biim-border-inset"
              style={{ fontFamily: "'DotGothic16', 'MS Gothic', monospace" }}
            >
              配信UIを開始
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <BiimLayout pipeline={pipeline} />
}

export default App
