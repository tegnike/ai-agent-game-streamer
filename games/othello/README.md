# オセロゲーム

8x8ボードで対戦するオセロ（リバーシ）ゲームです。プレイヤー（黒）がCPU（白）と対戦します。

## 遊び方

1. ブラウザでゲームを開く
2. 緑色にハイライトされたマスが有効な手
3. マスをクリックして石を置く
4. CPUが自動で応答
5. 「リセット」ボタンで新しいゲームを開始

## ルール

- 相手の石を自分の石で挟むと、挟まれた石が裏返る
- 石を置ける場所は、相手の石を1つ以上裏返せる場所のみ
- 両者とも置ける場所がなくなるとゲーム終了
- 石の多い方が勝ち

## CPU AI

位置評価アルゴリズムを使用：
- 角（100点）を最優先で狙う
- 角の隣（-20〜-50点）は避ける
- 取れる石の数も考慮

## agent-browser での操作

```bash
# ゲームを開く
agent-browser --headed open http://127.0.0.1:8080/index.html

# セルをクリック（row, col は 0-7）
agent-browser eval "game.handleCellClick(3, 4)"

# 有効な手を取得
agent-browser eval "game.getValidMoves(1)"  # 1 = BLACK

# リセット
agent-browser eval "game.init()"
```

## API

### メソッド

| メソッド | 説明 |
|---------|------|
| `game.handleCellClick(row, col)` | 指定位置に石を置く（プレイヤー=黒のターンのみ有効）。戻り値なし（undefined）。CPUの応答は自動で実行される |
| `game.getValidMoves(player)` | 有効な手の一覧を取得（player: 1=黒, 2=白）。戻り値: `[{ row: number, col: number }, ...]` |
| `game.init()` | ゲームをリセットして初期状態に戻す |
| `game.countStones()` | 石の数を取得。戻り値: `{ black: number, white: number }` |

### プロパティ

| プロパティ | 説明 |
|-----------|------|
| `game.gameOver` | ゲーム終了フラグ（`true`=終了, `false`=進行中） |
| `game.currentPlayer` | 現在のターン（1=黒, 2=白）。黒のターンで `handleCellClick` が有効 |
| `game.board` | 8x8の2次元配列。各セルの値: 0=空, 1=黒, 2=白 |

### 定数

| 値 | 意味 |
|----|------|
| `0` (EMPTY) | 空のセル |
| `1` (BLACK) | 黒の石（プレイヤー） |
| `2` (WHITE) | 白の石（CPU） |

### ゲーム終了判定

- `game.gameOver === true` のときゲーム終了
- `game.countStones()` で最終スコアを確認
- 黒が多ければプレイヤー勝利、白が多ければCPU勝利

## ファイル構成

```
othello/
├── index.html  # HTML構造
├── style.css   # スタイル
├── script.js   # ゲームロジック
└── README.md   # このファイル
```
