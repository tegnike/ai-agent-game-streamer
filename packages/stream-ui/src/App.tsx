import { useState, useCallback } from 'react'
import { useTTS } from './hooks/useTTS'
import { useWebSocket } from './hooks/useWebSocket'
import { CharacterDisplay } from './components/CharacterDisplay'
import { EventLog } from './components/EventLog'
import { Subtitle } from './components/Subtitle'
import { ConnectionStatus } from './components/ConnectionStatus'
import type { TTSPipeline } from './services/tts-pipeline'

function StreamerUI({ pipeline }: { pipeline: TTSPipeline }) {
  useWebSocket(pipeline)

  return (
    <div className="h-screen flex bg-gray-900 text-white overflow-hidden">
      {/* 左列: ゲーム画面 + 発話テキスト */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ゲーム画面プレースホルダー (16:9) - 左上に詰める */}
        <div className="w-full aspect-video bg-black shrink-0 relative">
          <ConnectionStatus />
        </div>
        {/* 発話テキスト: ゲーム画面の下・キャラの左側 */}
        <div className="flex-1 flex items-center justify-center p-4">
          <Subtitle />
        </div>
      </div>
      {/* 右列: イベントログ(上) + キャラクター(下) */}
      <div className="w-[400px] flex flex-col min-h-0 border-l border-gray-700">
        {/* イベントログ: キャラの上 */}
        <div className="flex-1 flex flex-col min-h-0">
          <EventLog />
        </div>
        {/* キャラクター: 右下 */}
        <CharacterDisplay />
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
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <button
          onClick={handleStart}
          className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-bold rounded-xl transition-colors cursor-pointer"
        >
          配信UIを開始
        </button>
      </div>
    )
  }

  return <StreamerUI pipeline={pipeline} />
}

export default App
