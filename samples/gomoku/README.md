# 五目並べ

19x19の碁盤で対戦する五目並べです。プレイヤー（黒・先手）がCPU（白・後手）と対戦します。

## 遊び方

1. ブラウザでゲームを開く
2. 盤上の任意の空いている交点をクリック
3. CPUが自動で応答
4. 先に5つ並べた方の勝ち
5. 「リセット」ボタンで新しいゲームを開始

## ルール

- 縦・横・斜めのいずれかで5つ連続して並べると勝ち
- 先手（黒）が有利なため、プレイヤーが先手
- 盤面が埋まると引き分け

## CPU AI

Minimax + Alpha-Beta枝刈りアルゴリズムを使用：
- 探索深さ: 3手先
- パターン評価（5連、両端空き4連、片端4連など）
- 即勝利手・即防御手の優先判定
- 中央に近い位置を優先

### パターンスコア
| パターン | スコア |
|---------|--------|
| 5連（勝ち） | 10,000,000 |
| 両端空き4連 | 500,000 |
| 片端4連 | 50,000 |
| 両端空き3連 | 10,000 |
| 片端3連 | 1,000 |
| 両端空き2連 | 500 |

## agent-browser での操作

```bash
# ゲームを開く
agent-browser --headed open http://127.0.0.1:8080/index.html

# セルをクリック（row, col は 0-18）
agent-browser eval "game.handleCellClick(9, 9)"  # 中央（天元）

# 有効な手を取得
agent-browser eval "game.getValidMoves()"

# リセット
agent-browser eval "game.init()"
```

## API

| メソッド | 説明 |
|---------|------|
| `game.handleCellClick(row, col)` | 指定位置に石を置く（プレイヤーのターンのみ） |
| `game.getValidMoves()` | 石の周囲の有効な手を取得 |
| `game.init()` | ゲームをリセット |
| `game.countStones()` | 石の数を取得 `{ black, white }` |

## ファイル構成

```
gomoku/
├── index.html  # HTML構造
├── style.css   # スタイル
├── script.js   # ゲームロジック
└── README.md   # このファイル
```
