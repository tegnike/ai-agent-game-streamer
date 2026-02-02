---
name: play-game
description: ブラウザゲームを自動プレイするスキル。agent-browserを使ってローカルまたはオンラインのHTML/JSゲームをプレイします。倉庫番、オセロ、五目並べなど。
allowed-tools: Bash(agent-browser:*), Bash(npm install -g agent-browser*), Bash(chmod +x*), Bash(python3 -m http.server*), Bash(lsof -i:*), Bash(kill *), Bash(mkdir -p logs*)
---

# Game Playing with agent-browser

ブラウザゲームを自動プレイするためのスキルです。

## 重要な制約事項

**ゲーム情報の確認方法について：**

- 各ゲームの情報は、そのゲームディレクトリ内の `README.md` からのみ確認できます
- `README.md` 以外のファイル（`script.js`、`style.css`、`index.html` など）は**読むことが禁止**されています
- これらのファイルを**読もうとすること自体も禁止**されています
- ゲームの操作方法やルールは `README.md` に記載された情報と、実際にゲームを動かして得られる情報のみを使用してください

## 1. 事前準備（自動セットアップ）

### agent-browserのセットアップ

```bash
# 1. インストール確認
agent-browser --version 2>&1 || npm install -g agent-browser

# 2. バイナリに実行権限を付与（重要！）
chmod +x $(npm root -g)/agent-browser/bin/agent-browser-darwin-* 2>/dev/null

# 3. Chromiumインストール
agent-browser install 2>&1 | tail -5
```

### ワンライナーセットアップ

```bash
npm install -g agent-browser && chmod +x $(npm root -g)/agent-browser/bin/agent-browser-darwin-* && agent-browser install
```

---

## 2. ローカルゲームのプレイ

### Step 1: HTTPサーバーを起動

```bash
# ゲームディレクトリでサーバー起動（バックグラウンド）
cd /path/to/game && python3 -m http.server 8888 &
```

### Step 2: ゲームを開く

```bash
# --headed オプションでブラウザウィンドウを表示（ゲームの様子が見える）
agent-browser --headed open http://127.0.0.1:8888/index.html
```

> **!!!! 最重要 !!!!**
> **絶対に `--headed` オプションを付けてください。**
> `--headed` を付けないとヘッドレスモード（画面非表示）で動作し、ゲームの様子が視聴者に見えません。
> **ヘッドレスモードでのプレイは厳禁です。必ず `agent-browser --headed open ...` の形式で起動してください。**

### Step 3: スクリーンショットで状態確認

```bash
mkdir -p logs
agent-browser screenshot "logs/$(date +%Y%m%d-%H%M%S)_game.png"
```

> **スクリーンショットの保存ルール**:
> - すべてのスクリーンショットは `logs/` ディレクトリに保存してください
> - ファイル名は必ず **`YYYYMMDD-HHMMSS_名前.png`** 形式にしてください
> - 例: `logs/20260202-143025_initial.png`, `logs/20260202-143130_result.png`
> - シェルでの生成: `agent-browser screenshot "logs/$(date +%Y%m%d-%H%M%S)_名前.png"`
> - プロジェクトルートや `/tmp/` に保存しないでください

### Step 4: ゲームオブジェクトを確認

```bash
# ゲームのグローバル変数を探す
agent-browser eval "typeof game"
agent-browser eval "Object.keys(game).join(', ')"
```

### Step 5: ゲームを操作

```bash
# 例: 倉庫番の場合
agent-browser eval "game.move('right')"
agent-browser eval "game.move('up')"

# 例: オセロの場合
agent-browser eval "game.handleCellClick(3, 4)"
```

---

## 3. ゲーム別ガイド

### 倉庫番 (Sokoban)

```bash
# ゲーム状態確認
agent-browser eval "JSON.stringify({player: game.playerPos, stage: game.currentStage})"

# 移動（方向: 'up', 'down', 'left', 'right'）
agent-browser eval "game.move('right')"

# ステージクリア確認
agent-browser eval "game.isCleared()"
```

**パズルの解き方のコツ**:
- 箱は押すことしかできない（引けない）
- 壁際に押すとスタックする可能性あり
- 目標地点に近い箱から処理

### オセロ (Othello)

```bash
# 有効な手を取得
agent-browser eval "JSON.stringify(game.getValidMoves(game.currentPlayer))"

# 石を置く
agent-browser eval "game.handleCellClick(row, col)"

# ゲーム終了確認
agent-browser eval "game.gameOver"
```

### 五目並べ (Gomoku)

```bash
# 石を置く
agent-browser eval "game.handleCellClick(row, col)"

# 勝者確認
agent-browser eval "game.winner"
```

---

## 4. 便利なパターン

### 連続操作（重要：間隔を空けて実行）

> **重要**: ゲーム操作は一度に実行せず、**0.5秒以上の間隔を空けて**実行してください。一気に実行すると画面上で動きが見えず、視聴者にとって面白くありません。

```bash
# ❌ 悪い例：一度に全部実行（動きが見えない）
agent-browser eval "['right', 'right', 'down', 'left'].forEach(d => game.move(d))"

# ✅ 良い例：シェルループで間隔を空けて実行
for dir in right right down left; do
  agent-browser eval "game.move('$dir')"
  sleep 0.5
done
```

### ゲームループ（シェルスクリプト）

```bash
# 移動配列を定義してループで実行（0.5秒間隔）
moves="right right down left up"
for dir in $moves; do
  agent-browser eval "game.move('$dir')"
  sleep 0.5
done
```

### 状態をJSON出力

```bash
agent-browser eval "JSON.stringify(game)" --json
```

---

## 5. トラブルシューティング

| 問題 | 解決策 |
|------|--------|
| `game` が undefined | `agent-browser eval "Object.keys(window).filter(k => !k.startsWith('webkit'))"` でグローバル変数を確認 |
| キー操作が効かない | `eval` でJavaScript直接操作を使用 |
| サーバーが起動しない | `lsof -i:8888` でポート使用状況を確認、`kill` で終了 |
| スクリーンショットが真っ白 | `agent-browser wait 2000` で待機してから撮影 |

---

## 6. サーバー管理

```bash
# ポート8888を使用中のプロセスを確認
lsof -i:8888

# プロセスを終了
kill $(lsof -t -i:8888)
```

---

## 7. ブラウザを閉じる

```bash
agent-browser close
```
