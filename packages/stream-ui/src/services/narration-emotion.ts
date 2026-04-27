import type { NarrationEmotion } from '../types'

export const NARRATION_EMOTIONS: NarrationEmotion[] = [
  'neutral',
  'happy',
  'angry',
  'sad',
  'thinking',
]

export function inferNarrationEmotion(text: string): NarrationEmotion {
  if (/やった|嬉し|うれし|楽しい|最高|いい展開|良い展開|チャンス|勝て|成功|すごい|わあ/.test(text)) {
    return 'happy'
  }
  if (/悔し|くっ|怒|許せ|なんで/.test(text)) {
    return 'angry'
  }
  if (/厳し|ピンチ|困|負け|失敗|まずい|ごめん|つらい|不利/.test(text)) {
    return 'sad'
  }
  if (/考え|慎重|迷|どうしよう|狙|ここは|次は/.test(text)) {
    return 'thinking'
  }
  return 'neutral'
}
