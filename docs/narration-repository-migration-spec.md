# Narration Repository Migration Spec

ナレーター機能を `ai-agent-game-streamer` から切り出し、複数アプリから共通利用できる独立リポジトリとして管理するための移行仕様です。

## 目的

現在のナレーター機能は、`packages/narration-ui` と `src/narration/*` によって `ai-agent-game-streamer` から疎結合に使える構成になっている。ただし、`stream:managed` 起動時には `EventHub`、`/api/tts/wait`、`NarrationEventBridge` と接続されており、完全な別リポジトリ管理にはなっていない。

この移行では、ナレーション表示、TTS再生、WebSocket relay、プロトコル型を独立リポジトリへ移し、`ai-agent-game-streamer` 側は外部ナレーションruntimeへ接続するproducerとして振る舞う形に変更する。

## ゴール

- ナレーションruntimeを別リポジトリで単独開発、起動、配布できる。
- `ai-agent-game-streamer`、`pokechamp`、その他アプリが同じWebSocketプロトコルで接続できる。
- `ai-agent-game-streamer` 側に残す責務は、エージェント発話を `narration:say` に変換して送信するadapterだけにする。
- TTS実装とVOICEVOX依存はナレーションruntime側に閉じ込める。
- UI未接続、relay未起動、TTS失敗時でもゲーム進行が致命的に止まらない。

## 非ゴール

- キャラクター演出やVOICEVOX以外のTTSバックエンドを大きく作り直すこと。
- `stream-ui` の既存TTS機能を同時に廃止すること。
- `ai-agent-game-streamer` の配信管理、ゲーム実行、OpenCode orchestrationを新リポジトリへ移すこと。
- 外部アプリごとの専用プロトコルを増やすこと。

## 現状の構成

```text
ai-agent-game-streamer
  ├─ src/narration/
  │   ├─ narration-relay-server.ts
  │   ├─ narration-event-bridge.ts
  │   ├─ sentence-splitter.ts
  │   ├─ types.ts
  │   └─ index.ts
  ├─ packages/narration-ui/
  └─ src/stream/
      ├─ event-hub.ts
      └─ stream-server.ts (/api/tts/wait)
```

`stream:managed` では `NarrationRelayServer` と `NarrationEventBridge` が同一プロセス内で起動し、`EventHub` の `agent:text` をrelayへ流す。relayのbusy状態は `EventHub.setTTSBusy()` に反映され、既存の `/api/tts/wait` がナレーションUIの再生完了を待てる。

## 移行後の構成

```text
narration-runtime repo
  ├─ packages/protocol
  │   └─ WebSocket message types
  ├─ packages/relay
  │   └─ producer/ui/observer relay server
  ├─ packages/ui
  │   └─ narration-ui
  ├─ packages/client
  │   └─ TypeScript producer client
  └─ docs
      └─ protocol and integration guides

ai-agent-game-streamer repo
  └─ src/narration/
      ├─ narration-client-adapter.ts
      ├─ narration-event-bridge.ts
      └─ sentence-splitter.ts
```

`ai-agent-game-streamer` 側の `NarrationEventBridge` はrelayを直接生成せず、外部relayへWebSocket接続するclientへ発話を送る。relayの起動責務は原則として `narration-runtime` 側に移す。

## 新リポジトリの責務

想定リポジトリ名は `narration-runtime` とする。実際の名前は作成時に決定する。

### protocol package

役割:

- `narration:hello`
- `narration:ready`
- `narration:say`
- `narration:started`
- `narration:completed`
- `narration:failed`
- `narration:skipped`
- `narration:state`

上記メッセージ型を公開する。

互換性ルール:

- `type` と `id` は必須。
- `narration:say.text` は必須。
- `speaker`、`emotion`、`interrupt`、`metadata` は任意。
- 未知の `emotion` はUI側で `neutral` 相当にフォールバックする。
- producerは `narration:completed`、`narration:failed`、`narration:skipped` のいずれかで発話完了とみなせる。

### relay package

役割:

- `ws://localhost:3010/ws/narration` を提供する。
- producer、ui、observerをroleで区別する。
- producerから受け取った `narration:say` をuiとobserverへ中継する。
- uiから受け取った再生状態をproducerとobserverへ返す。
- UI未接続時は `narration:skipped` を返す。
- ack timeout時は `narration:failed` を返す。
- `GET /api/narration/status` を提供する。

relayは特定アプリの `EventHub` や配信状態を参照しない。

### ui package

役割:

- relayへ `role: "ui"` で接続する。
- `narration:say` をキューイングして再生する。
- VOICEVOXで音声合成する。
- 字幕とキャラクター表情を表示する。
- `narration:started`、`narration:completed`、`narration:failed` をrelayへ返す。

VOICEVOX依存、画像アセット、TTS pipelineはこのpackageに閉じる。

### client package

役割:

- producer向けのTypeScript clientを提供する。
- `connect()`、`say()`、`close()` を提供する。
- `say()` は完了statusをPromiseで返す。
- relay未接続時の挙動を設定可能にする。

推奨API:

```ts
const client = new NarrationClient({
  url: "ws://localhost:3010/ws/narration",
  clientName: "ai-agent-game-streamer",
  timeoutMs: 45_000,
  onBusyChange: (busy) => {},
});

await client.connect();
const result = await client.say({
  text: "ここは慎重にいきます。",
  speaker: "nike",
  emotion: "thinking",
  metadata: { source: "ai-agent-game-streamer" },
});
```

relay未接続時のデフォルトは `skipped` 相当とする。ゲーム進行を止めたいアプリだけ、設定でthrowに変更できる。

## ai-agent-game-streamer 側の責務

切り出し後、このリポジトリに残す責務は以下に限定する。

- `EventHub` の `agent:text` を購読する。
- 文区切りで `narration:say` に変換する。
- `agent:tool` を境界として未完全文をflushする。
- relayのbusy状態、または `say()` のpending状態を `EventHub.setTTSBusy()` へ反映する。
- relayが使えない場合でも配信を継続できる。

削除または移動するもの:

- `src/narration/narration-relay-server.ts` は新リポジトリへ移す。
- `src/narration/index.ts` は新リポジトリへ移す。
- `src/narration/types.ts` は新リポジトリのprotocol packageへ移す。
- `packages/narration-ui/` は新リポジトリのui packageへ移す。

残す候補:

- `src/narration/narration-event-bridge.ts`
- `src/narration/sentence-splitter.ts`

ただし `sentence-splitter.ts` は他アプリでも使うなら新リポジトリのclientまたはutility packageへ移し、`ai-agent-game-streamer` 側は依存として取り込む。

## 起動モデル

### 標準モデル

`narration-runtime` を別プロセスで起動する。

```bash
# narration-runtime repo
npm run relay
npm run ui:dev

# ai-agent-game-streamer repo
npm run stream:managed
```

`ai-agent-game-streamer` は `NARRATION_URL` または `--narration-url=` でrelayへ接続する。

```bash
npm run stream:managed -- --narration-url=ws://localhost:3010/ws/narration
```

### 開発補助モデル

必要なら `ai-agent-game-streamer` 側に外部コマンド起動オプションを追加する。

```bash
npm run stream:managed -- --narration-managed
```

この場合もrelay本体はnpm packageまたは外部CLIとして起動し、`ai-agent-game-streamer` のソースコード内へrelay serverを再配置しない。

## 設定

`ai-agent-game-streamer` 側に追加する設定:

| 設定 | デフォルト | 説明 |
|---|---:|---|
| `NARRATION_URL` | `ws://localhost:3010/ws/narration` | 外部relay WebSocket URL |
| `--narration-url=` | なし | CLIからrelay URLを上書き |
| `NARRATION_ENABLED` | `true` | ナレーション送信の有効化 |
| `--no-narration` | なし | ナレーション送信を無効化 |
| `NARRATION_WAIT_MODE` | `busy` | TTS待機の扱い。`busy`, `completion`, `none` |

`NARRATION_WAIT_MODE` の意味:

| 値 | 挙動 |
|---|---|
| `busy` | clientのpending有無を `EventHub.setTTSBusy()` へ反映する |
| `completion` | bridge内で `say()` 完了を待ってから次の発話を送る |
| `none` | TTS完了をゲーム進行へ反映しない |

初期移行では既存挙動に近い `busy` を採用する。

## WebSocketプロトコル

V1のプロトコルは現行実装を維持する。

producer hello:

```json
{
  "type": "narration:hello",
  "role": "producer",
  "clientName": "ai-agent-game-streamer"
}
```

say:

```json
{
  "type": "narration:say",
  "id": "utt_001",
  "text": "ここは慎重にいきます。",
  "speaker": "nike",
  "emotion": "thinking",
  "interrupt": false,
  "metadata": {
    "source": "ai-agent-game-streamer",
    "boundary": "sentence"
  }
}
```

completion:

```json
{
  "type": "narration:completed",
  "id": "utt_001",
  "durationMs": 2380
}
```

UI未接続:

```json
{
  "type": "narration:skipped",
  "id": "utt_001"
}
```

## 移行フェーズ

### Phase 0: プロトコル凍結

作業:

- 現行 `src/narration/types.ts` をV1 protocolとして文書化する。
- `docs/narration-runtime-ui.md` と本仕様書のプロトコル差分を解消する。
- `emotion` の互換ルールを明記する。
- `narration:say` の必須/任意フィールドを確定する。

完了条件:

- V1 protocolのJSON例とTypeScript型が一致している。
- 既存 `packages/narration-ui` と `NarrationRelayServer` の挙動を変更せずに説明できる。

### Phase 1: 新リポジトリ作成

作業:

- `narration-runtime` リポジトリを作成する。
- workspace構成を作る。
- `packages/protocol`、`packages/relay`、`packages/ui`、`packages/client` を作る。
- 現行 `src/narration/narration-relay-server.ts` を `packages/relay` へ移植する。
- 現行 `packages/narration-ui` を `packages/ui` へ移植する。
- `README.md` に単独起動手順を追加する。

完了条件:

- 新リポジトリ単体でrelayとUIが起動する。
- producerの簡易スクリプトから `narration:say` を送るとUIが再生し、`narration:completed` が返る。
- `ai-agent-game-streamer` のコード変更なしでも、現行の単独relay相当の機能が新リポジトリで動く。

### Phase 2: client package実装

作業:

- TypeScript producer clientを実装する。
- reconnect、pending管理、timeout、status待機を実装する。
- relay未接続時の `skipped` fallbackを実装する。
- `onBusyChange` callbackを実装する。

完了条件:

- client単体テストで `completed`、`failed`、`skipped`、timeoutを検証できる。
- 複数発話を順番に送って、各idの完了statusを正しく受け取れる。

### Phase 3: ai-agent-game-streamer adapter化

作業:

- `ai-agent-game-streamer` に `NarrationClientAdapter` を追加する。
- `NarrationEventBridge` の依存を `NarrationRelayServer` からclient interfaceへ変更する。
- `src/index.ts` で `NarrationRelayServer` を直接起動しないようにする。
- `--narration-url=` と `NARRATION_URL` を追加する。
- `--no-narration` を追加する。
- clientのbusy状態を `EventHub.setTTSBusy()` に反映する。

完了条件:

- `npm run stream:managed` は外部relayが起動していればナレーションを送る。
- 外部relayが起動していなくても、ゲーム進行は継続する。
- `/api/tts/wait` はナレーション再生中にbusyとして待機し、完了後に解除される。

### Phase 4: 旧実装削除

作業:

- `src/narration/narration-relay-server.ts` を削除する。
- `src/narration/index.ts` を削除する。
- `packages/narration-ui/` を削除する。
- root `package.json` から `narration:relay`、`narration:dev`、`narration:build` の扱いを見直す。
- 必要なら新リポジトリのCLIを呼ぶscriptへ置き換える。
- `README.md` の起動手順を更新する。

完了条件:

- `ai-agent-game-streamer` のビルドに `packages/narration-ui` が不要になる。
- `src/index.ts` にrelay serverの直接importが残っていない。
- `narration-runtime` を停止した状態でも `ai-agent-game-streamer` の通常プレイが動く。

### Phase 5: 外部アプリ連携確認

作業:

- `pokechamp` など別アプリから新relayへ接続する。
- Python clientまたは直接WebSocketで `narration:say` を送る。
- UI未接続時、relay未起動時、VOICEVOX未起動時の挙動を確認する。

完了条件:

- `ai-agent-game-streamer` 以外のproducerから同じUIを使える。
- producer側にVOICEVOX依存がない。
- `narration:completed` または `narration:skipped` を待って次処理へ進める。

## 互換性方針

- V1 protocolは後方互換を維持する。
- 追加フィールドは任意フィールドとして追加する。
- 既存producerが送る `normal` emotionは `neutral` として扱う。
- `speaker` が不明な場合はUI側のデフォルトspeakerを使う。
- UIが接続していない場合はエラーではなく `narration:skipped` とする。

破壊的変更が必要な場合は `protocolVersion` を導入し、V1とV2をrelayで一定期間併存させる。

## エラーハンドリング

| 状況 | relay | client | ai-agent-game-streamer |
|---|---|---|---|
| UI未接続 | `narration:skipped` を返す | skippedとして解決 | ゲーム継続 |
| VOICEVOX失敗 | UIが `narration:failed` を返す | failedとして解決 | ゲーム継続 |
| relay未起動 | 接続不可 | fallback設定に従う | デフォルトはゲーム継続 |
| ack timeout | `narration:failed` を返す | failedとして解決 | busy解除 |
| producer切断 | pendingを破棄またはobserverへstate更新 | 再接続 | 次発話から再送 |
| UI切断 | pendingをtimeoutまで保持 | status待機 | timeout後に継続 |

## テスト計画

### narration-runtime repo

- protocol型のコンパイルテスト。
- relayのproducer/UI/observer中継テスト。
- UI未接続時の `narration:skipped` テスト。
- ack timeout時の `narration:failed` テスト。
- clientの `say()` 完了status解決テスト。
- UI buildテスト。

推奨コマンド:

```bash
npm run build
npm test
npm run ui:build
```

### ai-agent-game-streamer repo

- `NarrationEventBridge` が `agent:text` を文単位でclientへ送るテスト。
- `agent:tool` 境界でremainderがflushされるテスト。
- client busy状態が `EventHub.setTTSBusy()` に反映されるテスト。
- relay未接続時にstreamが継続するテスト。

推奨コマンド:

```bash
npm run build
npm test
```

### 手動確認

1. `narration-runtime` でrelayとUIを起動する。
2. producer smoke scriptから `narration:say` を送る。
3. UIで字幕、キャラクター表情、音声再生を確認する。
4. `ai-agent-game-streamer` の `stream:managed` を起動する。
5. AI発話が外部relay経由でUIに表示されることを確認する。
6. UIを落としてもゲーム進行が止まらないことを確認する。
7. relayを落としてもゲーム進行が止まらないことを確認する。

## リリース手順

1. `narration-runtime` V0.1.0を作成する。
2. protocol、relay、ui、clientを同一バージョンでリリースする。
3. `ai-agent-game-streamer` にclient依存を追加する。
4. `ai-agent-game-streamer` のadapter化をmergeする。
5. 一定期間、旧relay起動scriptをdeprecated扱いで残すか、READMEで外部起動へ誘導する。
6. 旧 `packages/narration-ui` と旧relay実装を削除する。

## 判断が必要な項目

- 新リポジトリ名とnpm scope。
- `ai-agent-game-streamer` が外部relayを自動起動する補助scriptを持つか。
- protocol packageをnpm公開するか、Git submoduleやworkspace参照にするか。
- `sentence-splitter` をどちらのリポジトリで管理するか。
- `stream-ui` 側の既存TTSを将来的に残すか、narration-runtimeへ統合するか。

## 推奨方針

初期移行では、relayとUIの起動責務を完全に `narration-runtime` 側へ移す。`ai-agent-game-streamer` は外部WebSocketへ送るだけのproducerにする。

`/api/tts/wait` との互換性は、`NarrationClientAdapter` のpending状態を `EventHub.setTTSBusy()` へ反映することで維持する。これにより、既存のゲームプレイプロンプトや待機APIを大きく変えずに、ナレーター本体だけを別リポジトリ化できる。
