import { useEffect } from 'react'
import { useStreamStore } from '../store/stream-store'
import { useCharacterAnimation } from '../hooks/useCharacterAnimation'

const IMAGE_NAMES = [
  'eye_open_mouth_close',
  'eye_open_mouth_open',
  'eye_close_mouth_close',
  'eye_close_mouth_open',
]

export function CharacterDisplay() {
  const isSpeaking = useStreamStore((s) => s.isSpeaking)
  const { imageName, bounceY } = useCharacterAnimation(isSpeaking)

  // プリロード
  useEffect(() => {
    IMAGE_NAMES.forEach((name) => {
      new Image().src = `/images/nikechan/${name}.png`
    })
  }, [])

  return (
    <div
      className="shrink-0 flex items-end justify-center"
      style={{ transform: `translateY(${bounceY}px)` }}
    >
      <img
        src={`/images/nikechan/${imageName}`}
        alt="nikechan"
        className="h-[500px] object-contain"
      />
    </div>
  )
}
