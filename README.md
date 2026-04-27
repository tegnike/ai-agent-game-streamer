# AI Agent Game Streamer

AIエージェントがブラウザベースのゲームをプレイし、その様子を配信・監視するためのプロジェクトです。

このリポジトリには大きく分けて3つの仕組みがあります。

- **オーケストレーター** (`src/`): OpenCode SDK経由でAIエージェントを起動し、ゲームHTTPサーバー・ブラウザ・セッション・ログをまとめて制御します。
- **配信プラットフォーム** (`src/stream/`, `packages/admin-ui/`, `packages/stream-ui/`): 管理UI、WebSocket/REST API、コメント連携、TTS待機、外部ビジュアル連携を提供します。
- **Codex/Claude系スキル** (`.agents/skills/`): ゲーム作成、ブラウザ操作、自動プレイ、画像生成、検証用のローカルスキル群です。

## 収録ゲーム

ゲーム一覧ページは `games/index.html` です。オーケストレーター起動時は `games/` をHTTPサーバーのルートとして公開するため、各ゲームは `http://127.0.0.1:8888/<game-id>/index.html` で開けます。

| ゲームID | ゲーム | 説明 | 操作/API |
|---|---|---|---|
| `othello` | [オセロ](games/othello/) | 8x8のリバーシ。プレイヤー黒 vs CPU白 | `handleCellClick(row, col)`, `getValidMoves(player)`, `countStones()` |
| `gomoku` | [五目並べ](games/gomoku/) | 19x19で5つ並べる対戦ゲーム | `handleCellClick(row, col)`, `getValidMoves()`, `countStones()` |
| `sokoban` | [倉庫番](games/sokoban/) | 箱をゴールに運ぶ10ステージのパズル | `move(direction)`, `undo()`, `loadStage(index)`, `checkClear()` |
| `card-battle` | [カードバトル](games/card-battle/) | 属性相性・チェイン・サクリファイスで戦うカードゲーム | `playCard(index)`, `sacrificeCard(index)`, `getGameState()`, `getValidMoves()` |
| `minesweeper` | [マインスイーパー](games/minesweeper/) | 初級/中級/上級を持つマインスイーパー | `handleCellClick(row, col)`, `toggleFlag(row, col)`, `getGameState()` |
| `chess` | [チェス](games/chess/) | 標準ルールのチェス。白プレイヤー vs 黒CPU | `handleCellClick(row, col)`, `getValidMoves(player)`, `getGameState()`, `completePromotion(type)` |

## セットアップ

### 必要なもの

- Node.js 18以上
- Python 3
- `agent-browser` 0.9.1以上
- 利用するLLMプロバイダーのAPIキー

### インストール

```bash
npm install
npm install -g agent-browser@latest
agent-browser install
npm run build
```

このリポジトリはnpm workspacesを使っています。管理UIや視聴者向けUIの依存関係も、通常はルートの `npm install` でインストールされます。

## LLM設定

CLI引数で指定がない場合、現在のコードは `zai/glm-4.7` をデフォルトとしてOpenCodeサーバーを起動します。`opencode.json` はOpenCodeのベース設定ですが、通常の `npm run dev` / `npm run stream:managed` ではCLI側で生成した設定が優先されます。

| プロバイダー | 環境変数 | デフォルトモデル | 小型モデル |
|---|---|---|---|
| OpenAI | `OPENAI_API_KEY` | `gpt-5.2` | `gpt-5-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5-20250929` | `claude-haiku-4-5-20251001` |
| Google | `GOOGLE_API_KEY` | `gemini-3-pro-preview` | `gemini-3-flash-preview` |
| Zai | `ZAI_API_KEY` | `glm-4.7` | `glm-4.7-flash` |
| Custom OpenAI Compatible | `CUSTOM_OPENAI_API_KEY` | UI/APIで指定 | UI/APIで指定 |

`--reasoning-effort=low|medium|high` を指定すると、対応モデルではプロバイダーごとの推論オプションに変換されます。対応していないモデルでは無視されます。

## 使い方

### スタンドアロン自動プレイ

```bash
npm run dev
npm run dev -- --game=othello
npm run dev -- --game=chess --provider=openai
npm run dev -- --model=google/gemini-2.5-pro --reasoning-effort=high
npm run dev -- --connect --game=sokoban
npm run stream
```

主なCLIオプション:

| オプション | 説明 |
|---|---|
| `--game=<id>` | 特定ゲームを1回プレイ。省略時はランダム |
| `--loop` | 複数ゲームを連続プレイ |
| `--provider=<name>` | `openai`, `anthropic`, `google`, `zai` から選択 |
| `--model=<provider/model>` | モデルを直接指定 |
| `--reasoning-effort=<level>` | `low`, `medium`, `high` |
| `--connect` | 既存のOpenCodeサーバーへ接続 |
| `--debug` | 詳細ログを有効化 |

### 配信プラットフォームモード

配信管理を使う場合は、バックエンドのStream Serverと管理UIを起動します。

```bash
npm run stream:managed
npm run admin:dev
```

- Stream Server: `http://localhost:3000`
- Admin UI: `http://localhost:5173`
- WebSocket: `ws://localhost:3000/ws/admin`
- ゲーム一覧: `http://127.0.0.1:8888/index.html`

追加の起動例:

```bash
npm run stream:managed -- --admin-port=3100
npm run stream:managed -- --provider=anthropic --reasoning-effort=medium
npm run stream:managed -- --visual-endpoint=http://localhost:5000/api/visual --visual-interval=500
npm run stream:managed:debug
```

Admin UIからは配信開始/停止/一時停止/スキップ、ゲーム選択、AIへの管理者メッセージ送信、LLM設定変更、コメントソース接続、ブラウザ起動、外部ビジュアル連携を操作できます。

### 視聴者向けUI / TTS

`packages/stream-ui` は配信表示用のReact UIです。Stream ServerのWebSocketを購読し、AI発話を字幕・TTSキューに流します。

```bash
npm run stream:dev
```

- Stream UI: `http://localhost:5174`
- WebSocket接続先: `ws://localhost:3000/ws/admin`
- VOICEVOXプロキシ: Vite上の `/voicevox` から `http://127.0.0.1:50021` へ転送
- 実装上のデフォルトVOICEVOX URL: `http://127.0.0.1:10101`

AIエージェントのプレイプロンプトは各手の前に `GET /api/tts/wait` を呼ぶようになっています。Stream UIがWebSocketで `tts:status` を送ることで、ゲーム操作が音声読み上げ完了を待てる構成です。

### 外部ナレーションruntime

ナレーション表示、TTS再生、WebSocket relayは外部の `narration-runtime` を標準モデルとして使います。`ai-agent-game-streamer` はproducerとして外部relayへ `narration:say` を送信し、relayやUIが未起動でもゲーム進行を継続します。`npm run stream:managed` はrelayを同一プロセス内で起動しません。

```bash
# narration-runtime repo
npm run relay
npm run ui:dev

# ai-agent-game-streamer repo
npm run stream:managed -- --narration-url=ws://localhost:3010/ws/narration
```

- Narration UI: `http://localhost:5175`
- Narration WebSocket: `ws://localhost:3010/ws/narration`
- Status API: `http://localhost:3010/api/narration/status`

`NARRATION_URL` または `--narration-url=` でrelay URLを指定できます。既定値は `ws://localhost:3010/ws/narration` です。ナレーション送信を止める場合は `--no-narration` を使います。`NARRATION_WAIT_MODE` は `/api/tts/wait` とナレーション完了待ちの連携方法を切り替えます。

| 設定 | 値 | 説明 |
|---|---|---|
| `NARRATION_URL` | WebSocket URL | 外部relay接続先 |
| `--narration-url=<url>` | WebSocket URL | CLIからrelay接続先を上書き |
| `NARRATION_ENABLED=false` | `false` | ナレーション送信を無効化 |
| `--no-narration` | なし | ナレーション送信を無効化 |
| `NARRATION_WAIT_MODE` | `busy`, `completion`, `none` | `busy` はpending状態をTTS busyへ反映、`completion` は発話完了を待って次を送信、`none` はゲーム進行へ反映しません |
| `--narration-wait-mode=<mode>` | `busy`, `completion`, `none` | CLIからwait modeを上書き |

外部システムは最初に `{"type":"narration:hello","role":"producer"}` を送り、その後 `narration:say` を送信します。UIが接続していない場合は `narration:skipped` が返り、relayへ接続できない場合もproducer側はskip相当として扱い、ゲーム進行はブロックされません。

詳細な構成・プロトコル・pokechamp連携は [docs/narration-runtime-ui.md](docs/narration-runtime-ui.md) を参照してください。

### 手動でゲームを確認

```bash
cd games
python3 -m http.server 8080
open http://localhost:8080
```

個別ゲームだけを確認する場合:

```bash
cd games/othello
python3 -m http.server 8080
open http://localhost:8080
```

### agent-browserで操作

```bash
cd games
python3 -m http.server 8888
agent-browser --headed open http://127.0.0.1:8888/othello/index.html
agent-browser eval "game.handleCellClick(2, 3)"
agent-browser eval "JSON.stringify(game.getValidMoves(1))"
agent-browser screenshot logs/manual.png
agent-browser close
```

オーケストレーター実行時はブラウザを共有するため、エージェントプロンプトでは `agent-browser close` を禁止しています。

## アーキテクチャ

### スタンドアロンの流れ

1. `src/index.ts` がCLI引数を解析し、LLM設定を構築します。
2. `src/server.ts` がOpenCodeサーバーを `127.0.0.1:4096` で起動、または既存サーバーへ接続します。
3. `GameOrchestrator` が `games/` ルートでPython HTTPサーバーを `:8888` に起動します。
4. `BrowserManager` が `agent-browser --headed` のデーモンを検出または起動します。
5. `SessionManager` がOpenCodeセッションを作成し、`src/prompts/play-game.ts` の実況プレイ用プロンプトを送信します。
6. `EventMonitor` がOpenCodeイベントを監視し、AI発話・推論・ツール実行・エラーをログに流します。
7. ゲーム終了後、ブラウザはロビーへ戻り、ログとスクリーンショットが `logs/` に残ります。

### 配信プラットフォームの流れ

1. `--admin` で `EventHub`, `StreamManager`, `StreamServer` を初期化します。
2. Admin UIまたはREST/WebSocketから `stream:start` を送ります。
3. `StreamManager` が `idle` / `starting` / `playing` / `transitioning` / `paused` / `stopped` の状態を管理します。
4. `GameOrchestrator` がゲームを実行し、`EventMonitor` がイベントを `EventHub` へ publish します。
5. `WSHandler` が管理UIと視聴者UIへ状態・発話・コメント・ゲームイベントを配信します。
6. コメント連携や管理者メッセージは、アクティブなOpenCodeセッションへ追加入力として注入されます。
7. `VisualBridge` はAI発話・推論・ツール実行・ゲーム状態を外部HTTPエンドポイントへバッチPOSTします。

### 主要ポート

| 用途 | デフォルト | 変更方法 |
|---|---:|---|
| OpenCode Server | 4096 | `src/config.ts` |
| ゲームHTTPサーバー | 8888 | `src/config.ts` |
| Stream Server / REST / WebSocket | 3000 | `--admin-port` または `STREAM_PORT` |
| External Narration Relay | 3010 | `--narration-url` または `NARRATION_URL` |
| Admin UI dev server | 5173 | `packages/admin-ui/vite.config.ts` |
| Stream UI dev server | 5174 | `packages/stream-ui/vite.config.ts` |
| Narration UI dev server | 5175 | `narration-runtime/packages/ui/vite.config.ts` |
| VOICEVOX Engine例 | 50021 / 10101 | Stream UI設定・プロキシ設定 |
| わんコメ | 11180 | 接続設定 |

## プロジェクト構成

```text
ai-agent-game-streamer/
├── src/
│   ├── index.ts                  # CLIエントリーポイント
│   ├── game-orchestrator.ts      # ゲーム進行・ループ・pause/skip/stop制御
│   ├── session-manager.ts        # OpenCodeセッションと追加入力
│   ├── event-monitor.ts          # OpenCodeイベント監視
│   ├── server.ts                 # OpenCodeサーバー起動/接続
│   ├── config.ts                 # ポート、プロバイダー、モデル、reasoning設定
│   ├── prompts/play-game.ts      # AI VTuber「ニケ」のプレイプロンプト
│   ├── games/game-registry.ts    # ゲームメタデータ
│   ├── stream/                   # 配信プラットフォーム層
│   └── utils/                    # ログ、プロセス、ブラウザ管理
├── packages/
│   ├── admin-ui/                 # 管理用React UI
│   ├── stream-ui/                # 視聴者向け表示/TTS UI
│   └── shared/                   # 共有型・共有コード
├── games/                        # ブラウザゲーム集
├── .agents/skills/               # ローカルスキル
├── opencode.json                 # OpenCodeベース設定
├── logs/                         # 実行ログ・スクリーンショット
└── dist/                         # TypeScriptビルド出力
```

## REST API

Stream Serverはデフォルトで `http://localhost:3000` にREST APIを公開します。

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/api/status` | 現在の配信状態 |
| `GET` | `/api/games` | ゲーム一覧 |
| `GET` | `/api/comments` | コメント一覧 |
| `GET` | `/api/activities?offset=0&limit=50` | AI活動ログ |
| `GET` | `/api/browser/status` | ブラウザ状態 |
| `GET` | `/api/llm/providers` | 利用可能なプロバイダーとAPIキー有無 |
| `GET` | `/api/llm/config` | 現在/保留中のLLM設定 |
| `GET` | `/api/tts/wait` | TTS読み上げ完了待ち |
| `POST` | `/api/stream/start` | 配信開始 |
| `POST` | `/api/stream/stop` | 配信停止 |
| `POST` | `/api/stream/pause` | 一時停止 |
| `POST` | `/api/stream/resume` | 再開 |
| `POST` | `/api/game/skip` | 現在のゲームをスキップ |
| `POST` | `/api/admin/message` | AIへ管理者メッセージを送信 |
| `POST` | `/api/comments/add` | 手動コメント追加 |
| `POST` | `/api/comments/:id/queue` | コメントをAI回答キューへ投入 |
| `POST` | `/api/comments/:id/dismiss` | コメントを却下 |
| `POST` | `/api/comments/youtube/connect` | YouTube Live Chatへ接続 |
| `POST` | `/api/comments/onecomme/connect` | わんコメへ接続 |
| `POST` | `/api/browser/launch` | `agent-browser` headedデーモンを起動 |
| `POST` | `/api/browser/launch-cdp` | 既存ChromeへCDP接続 |
| `POST` | `/api/browser/close` | 起動したブラウザを閉じる |
| `POST` | `/api/visual/configure` | Visual Bridge設定 |
| `POST` | `/api/llm/config` | LLM設定を変更しOpenCodeを再起動 |

例:

```bash
curl http://localhost:3000/api/status
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"mode":"multi","selectedGames":["othello","gomoku"],"pauseBetweenGames":5000}'
curl -X POST http://localhost:3000/api/admin/message \
  -H "Content-Type: application/json" \
  -d '{"text":"次は角を狙ってみて"}'
```

## WebSocket

接続先は `ws://localhost:3000/ws/admin` です。

接続時に `state:full` が送信され、その後は `state:update`, `agent:activity`, `game:event`, `comment:updated`, `llm:state` などが配信されます。クライアントからは `stream:start`, `stream:stop`, `stream:pause`, `stream:resume`, `game:skip`, `admin:message`, `comment:queue`, `comment:dismiss`, `browser:launch`, `browser:launch-cdp`, `browser:close`, `tts:status` を送れます。

## コメント連携

### YouTube Live Chat

`YOUTUBE_API_KEY` を設定し、Admin UIまたはREST APIからLive Chat IDまたはVideo IDを指定して接続します。実装はYouTube Data API v3の `liveChat/messages` と `videos` を使います。

```bash
curl -X POST http://localhost:3000/api/comments/youtube/connect \
  -H "Content-Type: application/json" \
  -d '{"videoId":"YOUR_VIDEO_ID"}'
```

### わんコメ

わんコメがローカルで起動している状態で、既定では `127.0.0.1:11180` の `/api/info` と `/sub?p=comments` に接続します。

```bash
curl -X POST http://localhost:3000/api/comments/onecomme/connect \
  -H "Content-Type: application/json" \
  -d '{"port":11180}'
```

## Visual Bridge

外部アプリにイベントをHTTP POSTで送るためのブリッジです。Unity、OBSオーバーレイ、別の演出アプリなどが受信側になります。

```bash
npm run stream:managed -- --visual-endpoint=http://localhost:5000/api/visual --visual-interval=500
```

送信形式:

```json
{
  "events": [
    {
      "type": "thought",
      "data": {
        "text": "ここは慎重にいきたいですね",
        "emotion": "thinking"
      },
      "timestamp": 1706900000000
    }
  ]
}
```

イベントタイプは `thought`, `speech`, `action`, `game_state` です。感情はキーワードベースで `thinking`, `happy`, `frustrated`, `excited`, `neutral` に分類されます。

## ゲーム実装の共通ルール

- 各ゲームはブラウザグローバルの `game` でインスタンスを公開します。
- 基本構成は `index.html`, `script.js`, `style.css`, `README.md` です。
- AIプレイ時はソースを読ませず、各ゲームの `README.md` をAPI仕様として使います。
- 画面は主に1280x720を想定します。
- オーケストレーターは `games/` ルートをHTTP公開するため、ゲーム内リンクやアセットはその前提で確認してください。

新規ゲームを追加する場合は `games/<id>/` を作成し、`src/types.ts` の `GameId` と `src/games/game-registry.ts` に登録してください。

## スキル

`.agents/skills/` には以下があります。

| スキル | 役割 |
|---|---|
| `agent-browser` | Playwrightベースのブラウザ自動操作 |
| `create-board-game` | HTML/CSS/JSのボードゲーム作成 |
| `play-game` | `agent-browser` を使ったゲーム自動プレイ |
| `verify-game` | ゲームを実際に操作してクリア可能性や不具合を検証 |
| `generate-image` | Gemini APIで画像生成 |
| `generate-transparent-image` | 画像生成後に背景透過PNGを作成 |

このリポジトリでゲームを自動プレイする場合は、原則として `play-game` スキルを使います。

## ログ

実行ログとスクリーンショットは `logs/` に保存されます。

- セッションログ: `logs/YYYYMMDD-HHMMSS_GameName.log`
- スクリーンショット: `logs/YYYYMMDD-HHMMSS_name.png`

`GameLogger` は標準出力とファイルの両方へ主要イベントを書き出します。

## 開発

```bash
npm run dev
npm run play
npm run stream
npm run stream:managed
npm run stream:managed:debug
npm run build
npm test
npm run admin:dev
npm run admin:build
npm run stream:dev
npm run stream:build
npm run shared:build
npm run ui:build
```

テストは `node:test` + `node:assert` で、主に `src/stream/__tests__/` のEventHub、StreamManager、WSHandlerを検証します。

## OpenCode設定

`opencode.json` はOpenCodeのベース設定です。

- サーバー: `127.0.0.1:4096`
- デフォルトエージェント: `game-streamer`
- 許可される主なbash: `agent-browser`, `python3 -m http.server`, `lsof`, `kill`, `sleep`, `ls`
- `edit`, `write`, `webfetch` は拒否

通常起動では `src/config.ts` から生成したプロバイダー設定をOpenCode SDKへ渡します。`--connect` を使う場合は、既に起動しているOpenCodeサーバー側の設定が使われます。

## ライセンス

MIT
