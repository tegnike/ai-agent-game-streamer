# Narration Runtime UI

AIプレイシステムからナレーション表示・TTS再生を切り離すために追加した、独立したWebSocketナレーションUIの設計メモです。

## 目的

これまでの `packages/stream-ui` は `ai-agent-game-streamer` の配信状態管理に強く結びついていました。今回追加した `packages/narration-ui` は、AIプレイシステムとはWebSocketだけで接続し、受け取ったテキストをTTS再生して、再生完了を送信元へ通知します。

これにより、`ai-agent-game-streamer` のOpenCode/Codexエージェントだけでなく、`pokechamp` のPythonベースのナレーターシステムからも同じUIを使えます。

## 構成

```text
AIプレイシステム
  ├─ ai-agent-game-streamer / OpenCode agent
  └─ pokechamp / NarratorPlayer
        │
        │ WebSocket
        ▼
Narration Relay
  ws://localhost:3010/ws/narration
        │
        │ WebSocket
        ▼
Narration UI
  http://localhost:5175
  ├─ VOICEVOX TTS
  ├─ 字幕表示
  ├─ ニケちゃんPNG差分キャラ表示
  └─ 再生完了通知
```

## 追加ファイル

| ファイル | 役割 |
|---|---|
| `src/narration/narration-relay-server.ts` | producer/UI/observerを中継するWebSocket relay |
| `src/narration/index.ts` | relay単独起動CLI |
| `src/narration/narration-event-bridge.ts` | `ai-agent-game-streamer` の `EventHub` からAI発話をrelayへ流すbridge |
| `src/narration/types.ts` | relayプロトコル型 |
| `src/narration/sentence-splitter.ts` | AI発話デルタを文単位に分割 |
| `packages/narration-ui/` | 独立ナレーションUI |

## 起動方法

relayだけを使う場合:

```bash
npm run narration:relay
npm run narration:dev
```

`ai-agent-game-streamer` の管理配信と一緒に使う場合:

```bash
npm run stream:managed
npm run narration:dev
```

ポート:

| 用途 | デフォルト |
|---|---:|
| Narration Relay | `3010` |
| Narration UI dev server | `5175` |
| VOICEVOX Engine | `10101` |

relayのポートは `--port=<port>` または `NARRATION_PORT` で変更できます。`stream:managed` 側では `--narration-port=<port>` または `NARRATION_PORT` を使います。

## WebSocketプロトコル

接続直後、クライアントはroleを宣言します。

```json
{
  "type": "narration:hello",
  "role": "producer",
  "clientName": "pokechamp"
}
```

role:

| role | 説明 |
|---|---|
| `producer` | 発話テキストを送るAIプレイシステム |
| `ui` | TTS再生と表示を行うUI |
| `observer` | 状態や完了イベントを監視するクライアント |

発話送信:

```json
{
  "type": "narration:say",
  "id": "utt_001",
  "text": "ここは慎重にいきたいですね。",
  "speaker": "nike",
  "emotion": "normal",
  "interrupt": false,
  "metadata": {
    "source": "pokechamp",
    "turn": 5
  }
}
```

UIからの通知:

```json
{ "type": "narration:started", "id": "utt_001" }
{ "type": "narration:completed", "id": "utt_001", "durationMs": 2380 }
```

失敗時:

```json
{
  "type": "narration:failed",
  "id": "utt_001",
  "error": "VOICEVOX synthesis failed: 500"
}
```

UIが接続していない場合、relayはproducerへ `narration:skipped` を返します。ゲーム進行を止めないための挙動です。

## ai-agent-game-streamer連携

`stream:managed` 起動時に `NarrationRelayServer` と `NarrationEventBridge` も初期化します。`EventMonitor` が `agent:text` を `EventHub` に流すと、bridgeが文単位に分割して `narration:say` としてrelayへ送ります。

`/api/tts/wait` との関係:

- 既存の `stream-ui` は `tts:status` を `StreamServer` に返します。
- 新しい `narration-ui` は `narration:completed` をrelayへ返します。
- `NarrationEventBridge` はrelayのbusy状態を `EventHub.setTTSBusy()` に反映します。
- そのため、既存の `/api/tts/wait` は新UI側の再生完了も待てます。

## pokechamp連携

`pokechamp` 側には `NarrationUIClient` を追加し、`NarratorPlayer` の `_speak_with_emotion()` から外部UIへ `narration:say` を送れるようにしました。

利用例:

```bash
# ai-agent-game-streamer 側
npm run narration:relay
npm run narration:dev

# pokechamp 側
uv run python narrator/run_narrator_battle.py \
  --backend gpt-5.2 \
  --battle_format gen9bssregj \
  --narration_ui
```

このモードでは、pokechamp側ではVOICEVOXのWAVを生成せず、UI側がTTS生成・再生を担当します。`NarratorPlayer` は `narration:completed` を待ってから次の行動へ進みます。

## キャラUI

現状の `packages/narration-ui` は、既存 `stream-ui` のニケちゃんPNG差分画像を流用しています。

使用場所:

- `packages/narration-ui/src/components/CharacterDisplay.tsx`
- `packages/narration-ui/src/hooks/useCharacterAnimation.ts`
- `packages/narration-ui/public/images/nikechan/`

基本差分:

- `neutral/eyeON_mouth_OFF.png`
- `neutral/eyeON_mouth_ON.png`
- `neutral/eyeOFF_mouth_OFF.png`
- `neutral/eyeOFF_mouth_ON.png`

表情差分は `neutral`, `happy`, `sad`, `angry`, `thinking` のディレクトリに分かれています。
`narration:say` の `emotion` に応じて表情ディレクトリを切り替えます。互換性のため `normal` は `neutral` として扱います。

## 検証

実施済み:

```bash
./node_modules/.bin/tsc
./node_modules/.bin/tsc -b packages/narration-ui
./node_modules/.bin/tsx --test src/stream/__tests__/*.test.ts
python3 -m py_compile narrator/narration_ui_client.py narrator/narrator_player.py narrator/run_narrator_battle.py
```

relayのproducer/UI往復も、`tsx` の小さなスモークテストで `narration:say` から `narration:completed` まで確認済みです。

未確認:

- Vite dev server / build は、ローカルの既存 `node_modules` にある Rollup native optional dependency のmacOSコード署名エラーで起動できませんでした。依存再インストール後に再確認してください。
