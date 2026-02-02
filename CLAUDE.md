# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Agent Game Streamer - AIエージェントがブラウザベースのボードゲームをプレイ・配信するためのプロジェクト。

## Architecture

### Skills System (`.agents/skills/`)

カスタムスキルが3つ定義されている：

1. **agent-browser**: ブラウザ自動操作ツール。Playwrightベースでスナップショット、クリック、入力などを実行
2. **create-board-game**: HTML/CSS/JSでボードゲームを作成するスキル
3. **play-game**: agent-browserを使ってゲームを自動プレイするスキル

### Sample Games (`samples/`)

各ゲームは `index.html` + `script.js` + `style.css` の3ファイル構成：

- **othello/**: オセロ（8x8、位置評価AIを搭載）
- **gomoku/**: 五目並べ
- **sokoban/**: 倉庫番（10ステージ、Undo機能付き）
- **lights-out/**: ライツアウト
- その他

### Game Class Pattern

全ゲームは以下の共通パターンに従う：
- グローバル変数 `game` でゲームインスタンスを公開
- `handleCellClick(row, col)` でセルクリック処理
- `move(direction)` で移動系ゲームの操作
- `getValidMoves(player)` で有効な手の取得

## Development Commands

### ゲームの動作確認

```bash
# ローカルサーバー起動
cd samples/<game-name>
python3 -m http.server 8080

# ブラウザで開く
open http://localhost:8080
```

## ゲームをプレイ

必ず `play-game` スキルを使用してゲームをプレイすること

## Bash ツールのルール

- 先頭が `#` で始まるコマンドを実行しないこと（コメントのみのコマンドは不要なため）