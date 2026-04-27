# Narration Runtime UI

AIプレイシステムからナレーション表示・TTS再生・WebSocket relayを切り離し、外部 `narration-runtime` として運用するための設計メモです。

## 目的

これまでの `packages/stream-ui` は `ai-agent-game-streamer` の配信状態管理に強く結びついていました。標準モデルでは、ナレーションrelayとUIを外部 `narration-runtime` で起動し、`ai-agent-game-streamer` はWebSocket producerとして発話を送信します。

これにより、`ai-agent-game-streamer` のOpenCode/Codexエージェントだけでなく、`pokechamp` のPythonベースのナレーターシステムからも同じrelay/UIを使えます。relay未起動、UI未接続、TTS失敗時でもproducer側はskipまたはfailedとして扱い、ゲーム進行を致命的に止めません。

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

## リポジトリ分担

標準構成では、relay、UI、protocol型、producer clientを `narration-runtime` 側で管理します。

| リポジトリ | 役割 |
|---|---|
| `narration-runtime/packages/protocol` | WebSocket message types |
| `narration-runtime/packages/relay` | producer/UI/observerを中継するWebSocket relay |
| `narration-runtime/packages/ui` | TTS再生、字幕、キャラクター表示 |
| `narration-runtime/packages/client` | producer向けTypeScript client |
| `ai-agent-game-streamer/src/narration/` | `EventHub` の `agent:text` を文単位の `narration:say` に変換するadapter |

このリポジトリにはproducer adapterと文分割処理だけを残し、旧relay/UI実装とnpm scriptは外部 `narration-runtime` 側へ移します。

## 起動方法

標準モデルでは、`narration-runtime` を別プロセスで先に起動します。

```bash
# narration-runtime repo
npm run relay
npm run ui:dev
```

`ai-agent-game-streamer` は外部relayへ接続するproducerとして起動します。

```bash
npm run stream:managed -- --narration-url=ws://localhost:3010/ws/narration
```

ポート:

| 用途 | デフォルト |
|---|---:|
| Narration Relay | `3010` |
| Narration UI dev server | `5175` |
| VOICEVOX Engine | `10101` |

`ai-agent-game-streamer` 側ではrelayのポートを直接管理しません。接続先は `NARRATION_URL` または `--narration-url=` で指定します。既定値は `ws://localhost:3010/ws/narration` です。ナレーションを送信しない場合は `--no-narration` を指定します。

## ai-agent-game-streamer設定

| 設定 | デフォルト | 説明 |
|---|---|---|
| `NARRATION_URL` | `ws://localhost:3010/ws/narration` | 外部relay WebSocket URL |
| `--narration-url=<url>` | なし | CLIからrelay URLを上書き |
| `NARRATION_ENABLED` | `true` | `false` の場合はナレーション送信を無効化 |
| `--no-narration` | なし | ナレーション送信を無効化 |
| `NARRATION_WAIT_MODE` | `busy` | TTS待機の扱い。`busy`, `completion`, `none` |
| `--narration-wait-mode=<mode>` | なし | CLIからwait modeを上書き |

`NARRATION_WAIT_MODE` の意味:

| 値 | 挙動 |
|---|---|
| `busy` | clientのpending有無を `EventHub.setTTSBusy()` へ反映し、既存の `/api/tts/wait` と連携する |
| `completion` | bridge内で `say()` 完了を待ってから次の発話を送る |
| `none` | TTS完了をゲーム進行へ反映しない |

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

`stream:managed` はrelay serverを同一プロセス内で起動しません。`EventMonitor` が `agent:text` を `EventHub` に流すと、bridge/adapterが文単位に分割して外部relayへ `narration:say` として送ります。外部relayへ接続できない場合はskip相当として扱い、配信とゲーム進行は継続します。

`/api/tts/wait` との関係:

- 既存の `stream-ui` は `tts:status` を `StreamServer` に返します。
- 外部 `narration-runtime` のUIは `narration:completed`、`narration:failed`、`narration:skipped` をrelayへ返します。
- `NARRATION_WAIT_MODE=busy` ではclientのpending状態を `EventHub.setTTSBusy()` に反映します。
- そのため、既存の `/api/tts/wait` は外部UI側の再生中もbusyとして待てます。

## pokechamp連携

`pokechamp` 側には `NarrationUIClient` を追加し、`NarratorPlayer` の `_speak_with_emotion()` から外部UIへ `narration:say` を送れるようにしました。

利用例:

```bash
# narration-runtime 側
npm run relay
npm run ui:dev

# pokechamp 側
uv run python narrator/run_narrator_battle.py \
  --backend gpt-5.2 \
  --battle_format gen9bssregj \
  --narration_ui
```

このモードでは、pokechamp側ではVOICEVOXのWAVを生成せず、外部 `narration-runtime` のUI側がTTS生成・再生を担当します。`NarratorPlayer` は `narration:completed` または `narration:skipped` などの完了statusを待ってから次の行動へ進みます。

## キャラUI

`narration-runtime/packages/ui` は、既存 `stream-ui` 由来のニケちゃんPNG差分画像を管理します。

使用場所:

- `narration-runtime/packages/ui/src/components/CharacterDisplay.tsx`
- `narration-runtime/packages/ui/src/hooks/useCharacterAnimation.ts`
- `narration-runtime/packages/ui/public/images/nikechan/`

基本差分:

- `neutral/eyeON_mouth_OFF.png`
- `neutral/eyeON_mouth_ON.png`
- `neutral/eyeOFF_mouth_OFF.png`
- `neutral/eyeOFF_mouth_ON.png`

表情差分は `neutral`, `happy`, `sad`, `angry`, `thinking` のディレクトリに分かれています。
`narration:say` の `emotion` に応じて表情ディレクトリを切り替えます。互換性のため `normal` は `neutral` として扱います。

## 検証

推奨コマンド:

```bash
npm run build
npm test
# narration-runtime repo
npm run build
npm run ui:build
```

relayのproducer/UI往復は、`narration-runtime` 側のスモークテストで `narration:say` から `narration:completed` または `narration:skipped` まで確認します。

未確認:

- 外部 `narration-runtime` relayを停止した状態でも `ai-agent-game-streamer` の `stream:managed` が継続すること。
- UI未接続時に `narration:skipped` でproducer側が継続すること。
