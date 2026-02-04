# 倉庫番

箱を押してゴールに運ぶパズルゲームです。10ステージ収録。

## 遊び方

1. ブラウザでゲームを開く
2. 矢印キーまたはWASDでプレイヤーを移動
3. 箱を押してゴール（赤い点）に運ぶ
4. すべての箱をゴールに乗せるとクリア
5. 「元に戻す」で1手戻せる（最大100手）

## 操作方法

### キーボード
| キー | 操作 |
|-----|------|
| ↑ / W | 上に移動 |
| ↓ / S | 下に移動 |
| ← / A | 左に移動 |
| → / D | 右に移動 |
| Ctrl+Z | 元に戻す |
| R | ステージをリセット |

### 画面上のボタン
- 矢印ボタン: 移動
- 元に戻す: 1手戻す
- リセット: ステージを最初から
- ◀ / ▶: ステージ切り替え

## ステージ構成

- ステージ 1-2: チュートリアル（簡単）
- ステージ 3-5: 初級
- ステージ 6-8: 中級
- ステージ 9-10: 上級

## マップ記号

| 記号 | 意味 |
|-----|------|
| # | 壁 |
| @ | プレイヤー |
| $ | 箱 |
| . | ゴール |
| * | ゴール上の箱 |
| + | ゴール上のプレイヤー |

## agent-browser での操作

```bash
# ゲームを開く
agent-browser --headed open http://127.0.0.1:8080/index.html

# 移動（up, down, left, right）
agent-browser eval "game.move('right')"
agent-browser eval "game.move('down')"

# 連続移動（視聴者が見やすいよう間隔を空ける）
for dir in right right down left; do
  agent-browser eval "game.move('$dir')"
  sleep 0.5
done

# 元に戻す
agent-browser eval "game.undo()"

# ステージ切り替え（0-9）
agent-browser eval "game.loadStage(0)"  # ステージ1
agent-browser eval "game.loadStage(9)"  # ステージ10
```

## API

| メソッド | 説明 |
|---------|------|
| `game.move(direction)` | 移動（'up', 'down', 'left', 'right'） |
| `game.undo()` | 1手戻す |
| `game.loadStage(index)` | ステージを読み込む（0-9） |
| `game.checkClear()` | クリア判定 |

## ファイル構成

```
sokoban/
├── index.html  # HTML構造
├── style.css   # スタイル
├── script.js   # ゲームロジック
└── README.md   # このファイル
```
