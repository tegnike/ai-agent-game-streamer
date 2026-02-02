# AI Agent Game Streamer

AIエージェントがブラウザベースのボードゲームをプレイ・配信するためのプロジェクトです。

Claude Code のカスタムスキルを活用し、ゲームの作成からブラウザ操作による自動プレイまでを一貫して行えます。

## デモ

ゲーム一覧ページ (`samples/index.html`) からすべてのゲームにアクセスできます。

## 収録ゲーム

| ゲーム | 説明 | 操作方式 |
|--------|------|----------|
| [オセロ](samples/othello/) | 8x8ボードで石を挟んで裏返す定番ゲーム | セルクリック |
| [五目並べ](samples/gomoku/) | 19x19碁盤で先に5つ並べたら勝ち | セルクリック |
| [倉庫番](samples/sokoban/) | 箱を押してゴールに運ぶパズル（10ステージ） | 方向キー移動 |
| [カードバトル](samples/card-battle/) | 属性カードで戦う Element Clash | カード選択 |

## プロジェクト構成

```
ai-agent-game-streamer/
├── .agents/skills/          # カスタムスキル
│   ├── agent-browser/       #   ブラウザ自動操作（Playwright）
│   ├── create-board-game/   #   ボードゲーム作成
│   ├── play-game/           #   ゲーム自動プレイ
│   ├── generate-image/      #   画像生成
│   └── generate-transparent-image/  # 透過画像生成
├── samples/                 # ゲーム集
│   ├── index.html           #   ゲーム一覧ページ
│   ├── common/              #   共通スタイル
│   ├── othello/             #   オセロ
│   ├── gomoku/              #   五目並べ
│   ├── sokoban/             #   倉庫番
│   └── card-battle/         #   カードバトル
├── CLAUDE.md                # Claude Code 向けプロジェクト設定
└── README.md                # このファイル
```

## ゲームの共通設計

すべてのゲームは以下のパターンに従っています。

### ファイル構成

各ゲームは `index.html` + `script.js` + `style.css` の3ファイル構成です（カードバトルはモジュール分割あり）。

### 共通API

```javascript
// グローバル変数でゲームインスタンスを公開
game

// セルクリック系（オセロ、五目並べ）
game.handleCellClick(row, col)
game.getValidMoves(player)
game.init()

// 移動系（倉庫番）
game.move(direction)  // 'up', 'down', 'left', 'right'
game.undo()
```

### 画面設計

- 解像度: 1280x720（16:9）を基準に最適化
- レイアウト: ボード左 + 情報パネル右の横並び配置

## スキルシステム

### agent-browser

Playwright ベースのブラウザ自動操作ツールです。スナップショット取得、クリック、入力、JavaScript 実行などが可能です。

```bash
agent-browser open <url>           # ページを開く
agent-browser snapshot -i          # インタラクティブ要素を取得
agent-browser click @e1            # 要素をクリック
agent-browser eval "expression"    # JavaScript を実行
agent-browser close                # ブラウザを閉じる
```

### create-board-game

HTML/CSS/JavaScript でボードゲームを新規作成するスキルです。テンプレートとリファレンスが用意されており、統一的なパターンでゲームを追加できます。

### play-game

agent-browser を使ってゲームを自動プレイするスキルです。配信を想定し `--headed` モードで操作を可視化します。

## セットアップ

### 必要なもの

- Python 3（ローカルサーバー用）
- Node.js（agent-browser 用）
- agent-browser（`npm install -g agent-browser`）

### ゲームの起動

```bash
# ゲーム一覧を開く
cd samples
python3 -m http.server 8080
open http://localhost:8080

# 個別ゲームを開く
cd samples/othello
python3 -m http.server 8080
open http://localhost:8080
```

### agent-browser でプレイ

```bash
# セットアップ
npm install -g agent-browser
agent-browser install

# ゲームを開く（配信用に --headed）
python3 -m http.server 8888 &
agent-browser --headed open http://127.0.0.1:8888/samples/othello/

# 操作例
agent-browser eval "game.handleCellClick(2, 3)"
agent-browser eval "game.getValidMoves(1)"
```

## ライセンス

MIT
