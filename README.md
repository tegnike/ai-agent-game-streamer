# AI Agent Game Streamer

AIエージェントがブラウザベースのボードゲームをプレイ・配信するためのプロジェクトです。

2つの実行方式をサポートしています：

- **オーケストレーター方式** (`src/`): OpenCode SDKを通じてAIエージェントのゲームプレイを自動制御。ゲーム選択→サーバー起動→プレイ→クリーンアップを一気通貫で実行
- **スキル方式** (`.agents/skills/`): Claude Code のカスタムスキルを使い、対話的にゲーム作成・プレイを実行

さらに **配信プラットフォームモード** (`--admin`) を使うと、管理用WebUI・リアルタイム監視・視聴者コメント連携・外部ビジュアルアプリ連携が利用可能です。

## 収録ゲーム

ゲーム一覧ページ (`samples/index.html`) からすべてのゲームにアクセスできます。

| ゲーム | 説明 | 操作方式 | API |
|--------|------|----------|-----|
| [オセロ](samples/othello/) | 8x8ボードで石を挟んで裏返す | セルクリック | `handleCellClick(row, col)`, `getValidMoves(player)` |
| [五目並べ](samples/gomoku/) | 19x19碁盤で先に5つ並べたら勝ち | セルクリック | `handleCellClick(row, col)`, `getValidMoves(player)` |
| [倉庫番](samples/sokoban/) | 箱を押してゴールに運ぶパズル（10ステージ） | 方向キー移動 | `move(direction)`, `undo()`, `loadStage(n)` |
| [カードバトル](samples/card-battle/) | 属性カードで戦う Element Clash | カード選択 | `playCard()`, `sacrificeCard()`, `getGameState()` |

## アーキテクチャ

### スタンドアロンモード

```
┌─────────────────────────────────────────────────────┐
│  CLI (src/index.ts)                                 │
│  --game=othello --provider=openai --loop             │
└──────────┬──────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────┐
│  GameOrchestrator                                   │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Session      │ │ Event        │ │ Process      │ │
│  │ Manager      │ │ Monitor      │ │ Manager      │ │
│  └──────┬──────┘ └──────┬───────┘ └──────┬───────┘ │
└─────────┼───────────────┼────────────────┼──────────┘
          │               │                │
┌─────────▼───────────────▼────────┐ ┌─────▼────────┐
│  OpenCode Server (:4096)         │ │ HTTP Server  │
│  agent: game-streamer            │ │ (:8888)      │
│  ┌─────────────────────────┐     │ │ python3 -m   │
│  │ agent-browser (Playwright)│    │ │ http.server  │
│  └─────────────────────────┘     │ └──────┬───────┘
└──────────────────────────────────┘        │
                                    ┌───────▼────────┐
                                    │ samples/<game>  │
                                    │ HTML/CSS/JS     │
                                    └────────────────┘
```

### 配信プラットフォームモード (`--admin`)

```
┌──────────────────┐     ┌──────────────────────────────────┐
│  Admin UI        │     │  External Visual App             │
│  (React + Vite)  │     │  (HTTP POST受信)                  │
│  localhost:5173   │     └──────────────────────────────────┘
└────────┬─────────┘                    ▲
         │ WS + REST                    │ HTTP POST
         ▼                              │
┌──────────────────────────────────────────────────────────┐
│              Stream Server (:3000) [node:http + ws]       │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ WebSocket Hub│  │ REST API     │  │ Visual Bridge  │  │
│  │ (/ws/admin)  │  │ (/api/...)   │  │ (HTTP POST送信)│  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│         └─────────┬───────┘                   │           │
│                   ▼                           │           │
│           ┌───────────────┐                   │           │
│           │   Event Hub   │───────────────────┘           │
│           │  (pub/sub)    │                               │
│           └───────┬───────┘                               │
│                   │                                       │
│    ┌──────────────┼──────────────────┐                    │
│    ▼              ▼                  ▼                    │
│ GameOrchestrator  EventMonitor  CommentIngester           │
│ (既存拡張)        (既存拡張)    (YouTube API)              │
└──────────────────────────────────────────────────────────┘
         │
         ▼
  OpenCode SDK (localhost:4096) → AI Agent → Game (localhost:8888)
```

### ポート管理

| 用途 | ポート | 変更方法 |
|------|--------|----------|
| ゲームHTTPサーバー | 8888 | `config.ts` |
| OpenCodeサーバー | 4096 | `config.ts` |
| Stream Server | 3000 | `--admin-port` or `STREAM_PORT` 環境変数 |
| React devサーバー | 5173 | 開発時のみ（Vite） |

### データフロー（スタンドアロン）

1. CLI がオプションを解析し、プロバイダー/モデルを設定
2. OpenCode サーバーを起動（またはexisting serverに接続）
3. GameOrchestrator がゲーム用HTTPサーバーをspawn
4. OpenCode セッションを作成し、ゲームプレイのプロンプトを送信
5. EventMonitor がイベントストリーム（テキスト出力、ツール実行、エラー）をリアルタイムで監視・ログ出力
6. セッション完了（`session.idle`）でクリーンアップ
7. ループモードの場合は3秒のポーズを挟んで次のゲームへ

### データフロー（配信プラットフォーム）

1. `--admin` フラグ付きで起動するとEventHub・StreamManager・StreamServerが初期化される
2. Admin UIからWebSocket経由で `stream:start` コマンドを送信
3. StreamManagerが状態を管理し、GameOrchestratorがゲームを実行
4. EventMonitorのイベントがEventHubを経由してWebSocketでAdmin UIにリアルタイム配信
5. 管理者はAdmin UIからメッセージ送信・ゲームスキップ・一時停止等を操作
6. YouTube Live Chat APIからコメントを取得し、キュー管理してAIに回答させる
7. Visual Bridgeが外部ビジュアルアプリにHTTP POSTでイベントを転送

## プロジェクト構成

```
ai-agent-game-streamer/
├── src/                         # オーケストレーション層（TypeScript）
│   ├── index.ts                 #   エントリーポイント（--admin対応）
│   ├── game-orchestrator.ts     #   ゲーム進行制御（配信ループ対応）
│   ├── session-manager.ts       #   OpenCodeセッション管理・プロンプト構築
│   ├── event-monitor.ts         #   イベントストリーム監視（EventHub連携）
│   ├── server.ts                #   OpenCodeサーバー起動・接続
│   ├── config.ts                #   プロバイダープリセット・定数定義
│   ├── types.ts                 #   型定義（GameId, GameConfig, StreamingState）
│   ├── games/
│   │   └── game-registry.ts     #   ゲームメタデータレジストリ
│   ├── stream/                  #   配信プラットフォーム層
│   │   ├── types.ts             #     配信関連型定義
│   │   ├── event-hub.ts         #     イベントバス（pub/sub）
│   │   ├── stream-manager.ts    #     配信ライフサイクル管理
│   │   ├── stream-server.ts     #     HTTP + WebSocketサーバー
│   │   ├── ws-handler.ts        #     WebSocket接続管理
│   │   ├── visual-bridge.ts     #     外部ビジュアルアプリ連携
│   │   ├── comment-ingester.ts  #     コメント収集・管理
│   │   ├── comments/
│   │   │   ├── comment-adapter.ts   # アダプターインターフェース
│   │   │   └── youtube-adapter.ts   # YouTube Live Chat実装
│   │   └── __tests__/           #     ユニットテスト
│   │       ├── event-hub.test.ts
│   │       ├── stream-manager.test.ts
│   │       └── ws-handler.test.ts
│   └── utils/
│       ├── logger.ts            #   ロガー（stdout + ファイル二重出力）
│       └── process-manager.ts   #   HTTPサーバープロセス管理
├── admin-ui/                    # 管理用WebUI（React + Vite）
│   ├── package.json
│   ├── vite.config.ts           #   API/WSプロキシ設定
│   ├── src/
│   │   ├── App.tsx              #     メインレイアウト
│   │   ├── store/
│   │   │   └── stream-store.ts  #     zustand状態管理
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts  #     WebSocket接続（自動再接続）
│   │   │   └── useStreamState.ts #    セレクタhooks
│   │   ├── components/
│   │   │   ├── StreamControl.tsx    # 開始/停止/一時停止
│   │   │   ├── GameSelector.tsx     # ゲーム選択
│   │   │   ├── AgentMonitor.tsx     # AI思考・発話表示
│   │   │   ├── MessagePanel.tsx     # 管理者→AIメッセージ
│   │   │   ├── CommentPanel.tsx     # コメント管理
│   │   │   ├── YouTubePanel.tsx     # YouTube連携設定
│   │   │   ├── VisualBridgePanel.tsx # ビジュアルAPI設定
│   │   │   ├── EventLog.tsx         # イベントログ
│   │   │   └── ConnectionStatus.tsx # 接続状態
│   │   └── styles/
│   │       └── globals.css
│   └── dist/                    #   ビルド済みファイル（自動生成）
├── .agents/skills/              # カスタムスキル
│   ├── agent-browser/           #   ブラウザ自動操作（Playwright）
│   ├── create-board-game/       #   ボードゲーム作成
│   ├── play-game/               #   ゲーム自動プレイ
│   ├── generate-image/          #   画像生成（Gemini API）
│   └── generate-transparent-image/  # 透過画像生成（Gemini + PhotoRoom）
├── samples/                     # ゲーム集
│   ├── index.html               #   ゲーム一覧ページ
│   ├── common/                  #   共通スタイル
│   ├── othello/                 #   オセロ
│   ├── gomoku/                  #   五目並べ
│   ├── sokoban/                 #   倉庫番
│   └── card-battle/             #   カードバトル
├── opencode.json                # OpenCode SDK 設定
├── logs/                        # ゲームセッションログ（自動生成）
└── dist/                        # コンパイル済みJS（自動生成）
```

## セットアップ

### 必要なもの

- **Node.js** (v18+)
- **Python 3** （ゲーム配信用のローカルHTTPサーバー）
- **agent-browser** （Playwrightベースのブラウザ自動操作ツール）

### インストール

```bash
# 依存パッケージのインストール
npm install

# agent-browser のグローバルインストール
npm install -g agent-browser
agent-browser install

# TypeScript のビルド（オーケストレーター使用時）
npm run build

# 管理UI のインストール（配信プラットフォームモード使用時）
cd admin-ui && npm install
```

### 環境変数

使用するLLMプロバイダーに応じたAPIキーを設定してください。

| プロバイダー | 環境変数 | デフォルトモデル |
|-------------|---------|----------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4.1 |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| Google | `GOOGLE_API_KEY` | gemini-2.5-pro |
| Zai | `ZAI_API_KEY` | glm-4.7 |

配信プラットフォームモードで使用する追加の環境変数:

| 用途 | 環境変数 | 説明 |
|------|---------|------|
| YouTubeコメント | `YOUTUBE_API_KEY` | YouTube Data API v3 キー |
| StreamServerポート | `STREAM_PORT` | デフォルト: 3000 |

## 使い方

### オーケストレーター（自動プレイ）

```bash
# ランダムなゲームを1回プレイ
npm run dev

# ゲームを指定してプレイ
npm run dev -- --game=othello

# プロバイダーを指定
npm run dev -- --game=gomoku --provider=anthropic

# モデルを直接指定（provider/model 形式）
npm run dev -- --model=google/gemini-2.5-pro

# ストリーミングループ（連続プレイ）
npm run stream

# 既存のOpenCodeサーバーに接続
npm run dev -- --connect --game=sokoban
```

利用可能なゲームID: `othello`, `gomoku`, `sokoban`, `card-battle`

### 配信プラットフォームモード

管理UIからリアルタイムでAIの配信を制御するモードです。

```bash
# 配信プラットフォームモードで起動
npm run stream:managed

# ポートを変更して起動
npm run stream:managed -- --admin-port=3100

# ビジュアルアプリ連携付きで起動
npm run stream:managed -- --visual-endpoint=http://localhost:5000/api/visual

# プロバイダーを指定して起動
npm run stream:managed -- --provider=anthropic
```

起動後の操作:

1. 別ターミナルで管理UIの開発サーバーを起動: `npm run admin:dev`
2. ブラウザで `http://localhost:5173` を開く
3. Admin UIの「Stream Control」パネルからモード（single/multi）を選択して開始

#### Admin UI の機能

| パネル | 説明 |
|--------|------|
| Stream Control | 配信の開始/停止/一時停止/スキップ |
| Game Selector | 利用可能なゲーム一覧の表示 |
| Agent Monitor | AIの思考（reasoning）・発話（text）・ツール実行のリアルタイム表示 |
| Message Panel | 管理者からAIエージェントへのメッセージ送信 |
| Comment Panel | 視聴者コメントの管理（キュー追加/却下） |
| YouTube Panel | YouTube Live Chat API の接続設定 |
| Visual Bridge | 外部ビジュアルアプリへのイベント転送設定 |
| Event Log | 全イベントの生ログ表示 |

#### REST API

Stream Serverは以下のREST APIを提供します（デフォルト: `http://localhost:3000`）。

```bash
# ステータス確認
curl http://localhost:3000/api/status

# ゲーム一覧
curl http://localhost:3000/api/games

# 配信開始（multiモード）
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"mode":"multi"}'

# 配信停止
curl -X POST http://localhost:3000/api/stream/stop

# AIにメッセージ送信
curl -X POST http://localhost:3000/api/admin/message \
  -H "Content-Type: application/json" \
  -d '{"text":"次は角を狙ってみて"}'

# コメント追加（手動）
curl -X POST http://localhost:3000/api/comments/add \
  -H "Content-Type: application/json" \
  -d '{"authorName":"Taro","text":"オセロ強い!","platform":"manual"}'
```

#### WebSocket

WebSocket接続先: `ws://localhost:3000/ws/admin`

接続時にフルステートスナップショットが送信され、以降はリアルタイムでイベントが配信されます。管理コマンド（start/stop/skip/message等）もWebSocket経由で送信可能です。

### 手動プレイ（ブラウザで確認）

```bash
# ゲーム一覧を開く
cd samples && python3 -m http.server 8080
open http://localhost:8080

# 個別ゲームを開く
cd samples/othello && python3 -m http.server 8080
open http://localhost:8080
```

### agent-browser で対話的にプレイ

```bash
# サーバー起動
cd samples && python3 -m http.server 8888 &

# ゲームを開く（配信用に --headed）
agent-browser --headed open http://127.0.0.1:8888/othello/

# 操作例
agent-browser eval "game.handleCellClick(2, 3)"
agent-browser eval "game.getValidMoves(1)"
agent-browser snapshot -i
agent-browser close
```

## ゲームの共通設計

### ファイル構成

各ゲームは `index.html` + `script.js` + `style.css` + `README.md` の構成です（カードバトルはモジュール分割あり）。

### 共通API

すべてのゲームはグローバル変数 `game` でインスタンスを公開しています。

```javascript
// セルクリック系（オセロ、五目並べ）
game.handleCellClick(row, col)
game.getValidMoves(player)
game.init()

// 移動系（倉庫番）
game.move(direction)  // 'up', 'down', 'left', 'right'
game.undo()

// カード系（カードバトル）
game.playCard(cardIndex)
game.sacrificeCard(cardIndex)
game.getGameState()
game.getValidMoves()
```

### 画面設計

- 解像度: 1280x720（16:9）を基準に最適化
- レイアウト: ボード左 + 情報パネル右の横並び配置
- セルサイズ基準: 8x8→50px, 15x15→35px, 19x19→30px

## スキルシステム

### agent-browser

Playwright ベースのブラウザ自動操作ツールです。

```bash
agent-browser open <url>           # ページを開く
agent-browser snapshot -i          # インタラクティブ要素を取得
agent-browser click @e1            # 要素をクリック
agent-browser fill @e2 "text"      # テキスト入力
agent-browser eval "expression"    # JavaScript を実行
agent-browser screenshot file.png  # スクリーンショット保存
agent-browser close                # ブラウザを閉じる
```

### create-board-game

HTML/CSS/JavaScript でボードゲームを新規作成するスキルです。テンプレートとAI実装パターン（位置評価、minimax、パターンマッチング）が用意されています。

### play-game

agent-browser を使ってゲームを自動プレイするスキルです。配信を想定し `--headed` モードで操作を可視化します。ソースコードの直接読み取りは禁止で、各ゲームの `README.md` のみ参照可能です。

### generate-image / generate-transparent-image

Gemini API ベースの画像生成スキルです。`generate-transparent-image` は PhotoRoom API と組み合わせて背景透過画像を生成します。

## YouTube コメント連携

YouTube Live Chat API を使って、配信中の視聴者コメントをリアルタイムで取得・管理できます。

### 設定

1. [Google Cloud Console](https://console.cloud.google.com/) で YouTube Data API v3 を有効化
2. APIキーを環境変数 `YOUTUBE_API_KEY` に設定
3. Admin UI の YouTube Panel で Live Chat ID または Video ID を入力して接続

### コメント管理フロー

1. YouTube Live Chat からコメントを自動取得（APIの `pollingIntervalMillis` に従ってポーリング）
2. Admin UI の Comment Panel にコメントが表示される
3. 管理者が「Queue」ボタンでAIに回答させるキューに入れる
4. ゲーム間の休憩時間にキューイングされたコメントがAIに送信される
5. 「Dismiss」ボタンでコメントを却下することも可能

### APIクォータ

YouTube Data API v3 の日次クォータ上限は10,000ユニットです。`liveChatMessages.list` は1回あたり5ユニット消費します。APIが返す推奨ポーリング間隔に従うことでクォータ消費を最適化しています。

## Visual Bridge API

外部のビジュアルアプリケーション（Unityアプリ、OBSオーバーレイ等）にAIの状態をリアルタイムで転送する仕組みです。

### 設定方法

```bash
# CLI引数で指定
npm run stream:managed -- --visual-endpoint=http://localhost:5000/api/visual --visual-interval=500

# または Admin UI の Visual Bridge パネルから設定
```

### 送信スキーマ

設定されたエンドポイントに以下のJSONがHTTP POSTで送信されます（バッチ送信）。

```json
{
  "events": [
    {
      "type": "thought | speech | action | game_state",
      "data": {
        "text": "角を取れるので...",
        "emotion": "thinking | happy | frustrated | excited | neutral"
      },
      "timestamp": 1706900000000
    }
  ]
}
```

| イベントタイプ | 元データ | 説明 |
|--------------|---------|------|
| `thought` | AIのreasoning | 内部推論（拡張思考） |
| `speech` | AIのtext出力 | 視聴者向けコメンタリー |
| `action` | ツール実行 | agent-browser操作等 |
| `game_state` | ゲームイベント | ゲーム開始/完了等 |

感情検出はキーワードベースのヒューリスティック（V1）です。送信はfire-and-forget方式で、送信失敗がゲーム進行に影響することはありません。

## ログ

ゲームセッションのログは `logs/` ディレクトリに自動保存されます。

- ログファイル: `logs/YYYYMMDD-HHMMSS_GameName.log`
- スクリーンショット: `logs/YYYYMMDD-HHMMSS_name.png`

## 開発

### npm scripts

```bash
# オーケストレーター
npm run dev              # 開発実行（tsx）
npm run play             # ランダムなゲームを1回プレイ
npm run stream           # ストリーミングループ（連続プレイ）
npm run build            # TypeScriptコンパイル → dist/

# 配信プラットフォーム
npm run stream:managed   # --admin --loop で配信モード起動
npm run admin:dev        # Admin UI 開発サーバー（Vite）
npm run admin:build      # Admin UI ビルド

# テスト
npm test                 # ユニットテスト実行
```

### テスト

`node:test` + `node:assert` を使用したユニットテストが `src/stream/__tests__/` にあります。

```bash
npm test
```

テスト対象: EventHub（pub/sub、バッファ管理）、StreamManager（状態遷移）、WSHandler（WebSocket通信）

## OpenCode 設定

`opencode.json` でOpenCode SDKの設定を管理しています。

- サーバー: `127.0.0.1:4096`
- デフォルトエージェント: `game-streamer`
- パーミッション: `agent-browser`, `python3 -m http.server`, `lsof`, `kill` 等のみ許可。`edit`, `write`, `webfetch` は拒否

## ライセンス

MIT
