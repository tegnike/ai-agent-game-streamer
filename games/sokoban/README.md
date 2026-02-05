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

### メソッド

| メソッド | 説明 | 戻り値 |
|---------|------|--------|
| `game.move(direction)` | 移動（'up', 'down', 'left', 'right'） | `true`=成功, `false`=移動不可 |
| `game.undo()` | 1手戻す | - |
| `game.loadStage(index)` | ステージを読み込む（0-9） | - |
| `game.checkClear()` | クリア判定 | `true`=クリア, `false`=未クリア |
| `game.getBoxPositions()` | 箱の位置を取得 | `[{row, col, onGoal}, ...]` |

### プロパティ（状態取得）

| プロパティ | 説明 | 型 |
|-----------|------|-----|
| `game.playerPos` | プレイヤー位置 | `{row: number, col: number}` |
| `game.goals` | ゴール位置の配列 | `[{row, col}, ...]` |
| `game.board` | 盤面データ（セルタイプの2次元配列） | `number[][]` |
| `game.currentStage` | 現在のステージ番号 | `0-9` |
| `game.moveCount` | 移動回数 | `number` |

### セルタイプ（board配列の値）

| 値 | 定数名 | 意味 |
|----|--------|------|
| 0 | FLOOR | 床 |
| 1 | WALL | 壁 |
| 2 | GOAL | ゴール |
| 3 | BOX | 箱 |
| 4 | BOX_ON_GOAL | ゴール上の箱 |
| 5 | PLAYER | プレイヤー |
| 6 | PLAYER_ON_GOAL | ゴール上のプレイヤー |

## 攻略のヒント

### 箱とゴールの位置を確認する

```bash
# 箱の位置を取得
agent-browser eval "JSON.stringify(game.getBoxPositions())"
# 例: [{"row":2,"col":2,"onGoal":false},{"row":4,"col":4,"onGoal":false}]

# ゴールの位置を取得
agent-browser eval "JSON.stringify(game.goals)"
# 例: [{"row":3,"col":5},{"row":4,"col":5}]

# プレイヤーの位置を取得
agent-browser eval "JSON.stringify(game.playerPos)"
# 例: {"row":4,"col":2}
```

### 重要なルール

- **箱は押すことしかできない**（引くことはできない）
- **箱を壁や角に押し込むと詰む可能性がある**
- 詰んだ場合は `game.undo()` で戻るか `game.loadStage(n)` でリセット
- 移動が失敗（`false`）した場合、位置は変わらない

### 攻略の基本戦略

1. まずゴールと箱の位置を確認する
2. 箱をゴールに運ぶルートを逆算する（ゴールから箱を押す方向を考える）
3. 箱を押す方向の反対側に回り込む必要がある
4. 1手ずつ確実に、移動後の位置を確認しながら進める

## ファイル構成

```
sokoban/
├── index.html  # HTML構造
├── style.css   # スタイル
├── script.js   # ゲームロジック
└── README.md   # このファイル
```
