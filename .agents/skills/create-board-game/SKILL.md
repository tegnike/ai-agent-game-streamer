---
name: create-game
description: Creates browser-based board games (Othello, Gomoku, Chess, etc.) with HTML/CSS/JS. Use when the user wants to create a new board game, implement game logic, or add AI opponents.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(python3 -m http.server*), Bash(open http://*)
---

# Board Game Creator Skill

ブラウザで動作するボードゲームを作成するためのスキルです。

## 概要

このスキルは以下のようなゲームの作成をサポートします：

- **オセロ / リバーシ** - 8x8ボード、石をひっくり返す
- **五目並べ / 連珠** - 15x15または19x19ボード、5つ並べたら勝ち
- **将棋 / チェス** - 駒の移動、取り合い
- **囲碁** - 19x19ボード、陣地を囲む
- **その他のボードゲーム** - カスタムルール対応

## ゲーム作成手順

### 1. 要件確認

ユーザーに以下を確認してください：

```
- ゲームの種類（オセロ、五目並べ、etc.）
- ボードサイズ（8x8、15x15、etc.）
- 対戦形式（プレイヤー vs CPU、2人対戦、etc.）
- AI の難易度（簡単、普通、難しい）
- 追加機能（アニメーション、サウンド、履歴、etc.）
```

### 2. ファイル構成

すべてのゲームは以下の構成で作成します：

```
games/<game-name>/
├── index.html    # UI構造
├── script.js     # ゲームロジック + AI
└── style.css     # スタイリング
```

### 3. 参照サンプル

既存のサンプルを参照してください：

```bash
# オセロの実装を確認
cat games/nike-othello/script.js
```

## 共通アーキテクチャ

### HTML構造（必須要素）

```html
<div class="container">
    <h1>ゲーム名</h1>

    <div class="game-info">
        <div class="turn-display">
            現在のターン: <span id="current-turn">...</span>
        </div>
        <div class="score-display">
            <!-- スコア表示 -->
        </div>
    </div>

    <div id="board" class="board"></div>

    <div id="message" class="message"></div>

    <button id="reset-btn" class="reset-btn">リセット</button>
</div>
```

### JavaScript クラス構造（必須メソッド）

```javascript
class GameName {
    constructor() {
        this.board = [];           // ボード状態
        this.currentPlayer = 1;    // 現在のプレイヤー (1: 黒/先手, 2: 白/後手)
        this.gameOver = false;     // ゲーム終了フラグ
        this.init();
    }

    // 初期化
    init() { }

    // ボード描画
    renderBoard() { }

    // クリックハンドラ
    handleCellClick(row, col) { }

    // 有効な手かチェック
    isValidMove(row, col, player) { }

    // 有効な手一覧取得
    getValidMoves(player) { }

    // 手を打つ
    makeMove(row, col, player) { }

    // ターン切り替え
    switchTurn() { }

    // CPU の手
    cpuMove() { }

    // 最善手選択（AI）
    selectBestMove(validMoves) { }

    // 勝敗判定
    checkWinner() { }

    // ゲーム終了処理
    endGame() { }

    // 情報更新
    updateInfo() { }

    // メッセージ表示
    showMessage(msg) { }
}
```

### CSS共通スタイル

**重要: 16:9アスペクト比対応**

ゲームは配信用途で使用されるため、**16:9の横長画面（1280x720）** に収まるようにレイアウトを設計してください。

- 最大高さ: **720px以内** に収める
- 横長レイアウト: ボードが大きい場合は **ボードを左、情報パネルを右** に配置
- コンパクト設計: 不要な余白を削減

```css
/* 基本設定 */
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: 'Hiragino Sans', 'Meiryo', sans-serif;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* 横長レイアウト用コンテナ（ボードが大きい場合） */
.container {
    display: flex;
    align-items: center;
    gap: 30px;
}

/* 情報パネル（右側） */
.game-panel {
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

/* ボードグリッド */
.board {
    display: grid;
    grid-template-columns: repeat(BOARD_SIZE, 1fr);
    gap: 2px;
    background: #333;
    padding: 10px;
    border-radius: 10px;
}

/* セル - 720p対応のサイズ調整 */
/* 8x8ボード: 50px, 15x15ボード: 35px, 19x19ボード: 30px */
.cell {
    width: 50px;
    height: 50px;
    background: #2e8b57;  /* 緑系 */
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
}
```

#### ボードサイズ別の推奨セルサイズ

| ボードサイズ | 推奨セルサイズ | ボード全体の高さ |
|-------------|---------------|-----------------|
| 8x8 (オセロ) | 50px | 約420px |
| 10x10 | 40px | 約420px |
| 15x15 (五目並べ) | 35px | 約545px |
| 19x19 (囲碁) | 30px | 約600px |

## AI実装パターン

### パターン1: 位置評価ベース（シンプル）

オセロのような「角が有利」なゲーム向け。

```javascript
const POSITION_WEIGHTS = [
    [100, -20, 10, ...],
    [-20, -50, -2, ...],
    // ...
];

selectBestMove(validMoves) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of validMoves) {
        const score = POSITION_WEIGHTS[move.row][move.col];
        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
```

### パターン2: Minimax（中級）

先読みが必要なゲーム向け。

```javascript
minimax(board, depth, isMaximizing, alpha, beta) {
    if (depth === 0 || this.isGameOver(board)) {
        return this.evaluate(board);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of this.getValidMoves(board, CPU)) {
            const newBoard = this.applyMove(board, move, CPU);
            const eval = this.minimax(newBoard, depth - 1, false, alpha, beta);
            maxEval = Math.max(maxEval, eval);
            alpha = Math.max(alpha, eval);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of this.getValidMoves(board, PLAYER)) {
            const newBoard = this.applyMove(board, move, PLAYER);
            const eval = this.minimax(newBoard, depth - 1, true, alpha, beta);
            minEval = Math.min(minEval, eval);
            beta = Math.min(beta, eval);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}
```

### パターン3: パターンマッチング（五目並べ向け）

```javascript
const PATTERNS = {
    FIVE: /11111/,           // 勝ち
    OPEN_FOUR: /011110/,     // 両端空き4連
    FOUR: /11110|01111/,     // 片端4連
    OPEN_THREE: /01110/,     // 両端空き3連
    // ...
};

evaluateLine(line, player) {
    const str = line.map(c => c === player ? '1' : c === 0 ? '0' : '2').join('');
    if (PATTERNS.FIVE.test(str)) return 100000;
    if (PATTERNS.OPEN_FOUR.test(str)) return 10000;
    // ...
}
```

## ゲーム別実装ガイド

詳細な実装ガイドは以下を参照：

| ガイド | 説明 |
|--------|------|
| [references/gomoku.md](references/gomoku.md) | 五目並べの実装ガイド |
| [references/common-patterns.md](references/common-patterns.md) | 共通パターン・ユーティリティ |

## テンプレート

すぐに使えるテンプレートファイル：

| テンプレート | 説明 |
|--------------|------|
| [templates/game-template.html](templates/game-template.html) | HTML基本テンプレート |
| [templates/game-template.css](templates/game-template.css) | CSS基本テンプレート |
| [templates/game-template.js](templates/game-template.js) | JS基本テンプレート |

## 動作確認

作成したゲームの動作確認：

```bash
# ローカルサーバー起動
cd games/<game-name>
python3 -m http.server 8080

# ブラウザで開く
open http://localhost:8080
```

## チェックリスト

ゲーム作成時の確認事項：

- [ ] 初期配置が正しい
- [ ] 有効な手のハイライト表示
- [ ] 無効な手はクリックできない
- [ ] ターン切り替えが正しい
- [ ] パス判定（該当する場合）
- [ ] 勝敗判定が正しい
- [ ] CPUが適切に動作する
- [ ] リセットボタンが機能する
- [ ] **16:9（1280x720）の画面に収まる**
- [ ] アニメーションが滑らか
