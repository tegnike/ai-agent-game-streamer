# AI Agent Game Streamer

AIエージェントがブラウザベースのボードゲームをプレイ・配信するためのプロジェクトです。

2つの実行方式をサポートしています：

- **オーケストレーター方式** (`src/`): OpenCode SDKを通じてAIエージェントのゲームプレイを自動制御。ゲーム選択→サーバー起動→プレイ→クリーンアップを一気通貫で実行
- **スキル方式** (`.agents/skills/`): Claude Code のカスタムスキルを使い、対話的にゲーム作成・プレイを実行

## 収録ゲーム

ゲーム一覧ページ (`samples/index.html`) からすべてのゲームにアクセスできます。

| ゲーム | 説明 | 操作方式 | API |
|--------|------|----------|-----|
| [オセロ](samples/othello/) | 8x8ボードで石を挟んで裏返す | セルクリック | `handleCellClick(row, col)`, `getValidMoves(player)` |
| [五目並べ](samples/gomoku/) | 19x19碁盤で先に5つ並べたら勝ち | セルクリック | `handleCellClick(row, col)`, `getValidMoves(player)` |
| [倉庫番](samples/sokoban/) | 箱を押してゴールに運ぶパズル（10ステージ） | 方向キー移動 | `move(direction)`, `undo()`, `loadStage(n)` |
| [カードバトル](samples/card-battle/) | 属性カードで戦う Element Clash | カード選択 | `playCard()`, `sacrificeCard()`, `getGameState()` |

## アーキテクチャ

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

### データフロー

1. CLI がオプションを解析し、プロバイダー/モデルを設定
2. OpenCode サーバーを起動（またはexisting serverに接続）
3. GameOrchestrator がゲーム用HTTPサーバーをspawn
4. OpenCode セッションを作成し、ゲームプレイのプロンプトを送信
5. EventMonitor がイベントストリーム（テキスト出力、ツール実行、エラー）をリアルタイムで監視・ログ出力
6. セッション完了（`session.idle`）でクリーンアップ
7. ループモードの場合は3秒のポーズを挟んで次のゲームへ

## プロジェクト構成

```
ai-agent-game-streamer/
├── src/                         # オーケストレーション層（TypeScript）
│   ├── index.ts                 #   エントリーポイント
│   ├── game-orchestrator.ts     #   ゲーム進行制御
│   ├── session-manager.ts       #   OpenCodeセッション管理・プロンプト構築
│   ├── event-monitor.ts         #   イベントストリーム監視
│   ├── server.ts                #   OpenCodeサーバー起動・接続
│   ├── config.ts                #   プロバイダープリセット・定数定義
│   ├── types.ts                 #   型定義（GameId, GameConfig, StreamingState）
│   ├── games/
│   │   └── game-registry.ts     #   ゲームメタデータレジストリ
│   └── utils/
│       ├── logger.ts            #   ロガー（stdout + ファイル二重出力）
│       └── process-manager.ts   #   HTTPサーバープロセス管理
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
```

### 環境変数

使用するLLMプロバイダーに応じたAPIキーを設定してください。

| プロバイダー | 環境変数 | デフォルトモデル |
|-------------|---------|----------------|
| OpenAI | `OPENAI_API_KEY` | gpt-4.1 |
| Anthropic | `ANTHROPIC_API_KEY` | claude-sonnet-4-20250514 |
| Google | `GOOGLE_API_KEY` | gemini-2.5-pro |
| Zai | `ZAI_API_KEY` | glm-4.7 |

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

## ログ

ゲームセッションのログは `logs/` ディレクトリに自動保存されます。

- ログファイル: `logs/YYYYMMDD-HHMMSS_GameName.log`
- スクリーンショット: `logs/YYYYMMDD-HHMMSS_name.png`

## OpenCode 設定

`opencode.json` でOpenCode SDKの設定を管理しています。

- サーバー: `127.0.0.1:4096`
- デフォルトエージェント: `game-streamer`
- パーミッション: `agent-browser`, `python3 -m http.server`, `lsof`, `kill` 等のみ許可。`edit`, `write`, `webfetch` は拒否

## ライセンス

MIT
