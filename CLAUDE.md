# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Agent Game Streamer - AIエージェントがブラウザベースのボードゲームをプレイ・配信するためのプロジェクト。OpenCode SDKを使ったオーケストレーション層と、Claude Codeのカスタムスキルによるゲーム作成・自動プレイの2つの実行方式がある。

## Architecture

### Orchestration Layer (`src/`)

TypeScriptで書かれたオーケストレーション層。OpenCode SDKを通じてAIエージェントのゲームプレイを制御する。

- **index.ts**: エントリーポイント。`--game=<id>`, `--provider=`, `--model=`, `--loop` フラグに対応
- **game-orchestrator.ts**: メインのゲーム進行制御。HTTPサーバー起動→OpenCodeセッション作成→イベント監視→完了待ち→クリーンアップの流れ
- **config.ts**: プロバイダープリセット（OpenAI, Anthropic, Google, Zai）とモデル選定ロジック。`PROJECT_ROOT`, `GAME_SERVER_PORT` 等の定数
- **session-manager.ts**: OpenCodeセッション管理。ゲーム固有のプロンプト構築
- **event-monitor.ts**: イベントストリーム監視。`session.idle`, `session.error`, `message.part.updated` をリッスン
- **server.ts**: OpenCodeサーバーの起動・接続管理
- **process-manager.ts**: HTTPサーバーのspawn/kill、ポート管理
- **games/game-registry.ts**: ゲームメタデータレジストリ。GameId型（`"othello" | "gomoku" | "sokoban" | "card-battle"`）とAPIメソッドの対応表

### Skills System (`.agents/skills/`)

カスタムスキルが5つ定義されている：

1. **agent-browser**: ブラウザ自動操作ツール。Playwrightベースでスナップショット、クリック、入力、JS実行、スクリーンショット等を実行
2. **create-game**: HTML/CSS/JSでボードゲームを作成するスキル。セルサイズ基準あり（8x8→50px, 15x15→35px, 19x19→30px）
3. **play-game**: agent-browserを使ってゲームを自動プレイするスキル。`--headed`必須、ソースコード読み取り禁止（README.mdのみ参照可）
4. **generate-image**: Gemini APIベースの画像生成
5. **generate-transparent-image**: 背景透過画像生成（Gemini + PhotoRoom API）

### Sample Games (`games/`)

各ゲームは `index.html` + `script.js` + `style.css` + `README.md` 構成（card-battleはモジュール分割あり）：

| ゲーム | ディレクトリ | 操作方式 | API |
|--------|-------------|---------|-----|
| オセロ | othello/ | セルクリック | `handleCellClick(row, col)`, `getValidMoves(player)` |
| 五目並べ | gomoku/ | セルクリック | `handleCellClick(row, col)`, `getValidMoves(player)` |
| 倉庫番 | sokoban/ | 方向移動 | `move(direction)`, `undo()`, `loadStage()` |
| カードバトル | card-battle/ | カード選択 | `playCard()`, `sacrificeCard()`, `getGameState()` |

### Game Class Pattern

全ゲームは以下の共通パターンに従う：
- グローバル変数 `game` でゲームインスタンスを公開
- `handleCellClick(row, col)` でセルクリック処理
- `move(direction)` で移動系ゲームの操作
- `getValidMoves(player)` で有効な手の取得
- 画面解像度: 1280x720（16:9）を基準に最適化

## Development Commands

### オーケストレーター

```bash
npm run dev                # 開発実行（tsx）
npm run play               # ランダムなゲームを1回プレイ（--game=othello で指定可）
npm run stream             # ストリーミングループモード（連続プレイ）
npm run build              # TypeScriptコンパイル → dist/
```

### ゲームの動作確認

```bash
cd games/<game-name>
python3 -m http.server 8080
open http://localhost:8080
```

### agent-browser セットアップ

**必須バージョン: 0.9.1以上**（0.7.x以前はheadedモードでabout:blankのまま表示される問題あり）

```bash
npm install -g agent-browser@latest
agent-browser install
agent-browser --headed open http://127.0.0.1:8888/games/othello/
```

## ゲームをプレイ

必ず `play-game` スキルを使用してゲームをプレイすること

## Bash ツールのルール

- 先頭が `#` で始まるコマンドを実行しないこと（コメントのみのコマンドは不要なため）