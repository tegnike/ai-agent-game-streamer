# 共通パターン・ユーティリティ

ボードゲーム実装で共通して使えるパターンとユーティリティ関数です。

## ボード操作

### ボードのコピー（Minimax用）

```javascript
copyBoard(board) {
    return board.map(row => [...row]);
}
```

### 座標の境界チェック

```javascript
isInBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}
```

### 8方向の隣接セル取得

```javascript
getNeighbors(row, col) {
    const neighbors = [];
    for (const [dr, dc] of DIRECTIONS) {
        const r = row + dr;
        const c = col + dc;
        if (this.isInBounds(r, c)) {
            neighbors.push({ row: r, col: c });
        }
    }
    return neighbors;
}
```

## AI共通パターン

### Minimax基本実装

```javascript
minimax(board, depth, isMaximizing, alpha, beta) {
    // 終了条件
    const winner = this.checkWinnerOnBoard(board);
    if (winner === WHITE) return 10000 - depth;
    if (winner === BLACK) return -10000 + depth;
    if (depth === 0) return this.evaluateBoard(board);

    const player = isMaximizing ? WHITE : BLACK;
    const moves = this.getValidMovesOnBoard(board, player);

    if (moves.length === 0) {
        return this.evaluateBoard(board);
    }

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const newBoard = this.applyMoveOnBoard(board, move, player);
            const eval = this.minimax(newBoard, depth - 1, false, alpha, beta);
            maxEval = Math.max(maxEval, eval);
            alpha = Math.max(alpha, eval);
            if (beta <= alpha) break;  // 枝刈り
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const newBoard = this.applyMoveOnBoard(board, move, player);
            const eval = this.minimax(newBoard, depth - 1, true, alpha, beta);
            minEval = Math.min(minEval, eval);
            beta = Math.min(beta, eval);
            if (beta <= alpha) break;  // 枝刈り
        }
        return minEval;
    }
}

applyMoveOnBoard(board, move, player) {
    const newBoard = this.copyBoard(board);
    newBoard[move.row][move.col] = player;
    return newBoard;
}
```

### 探索深さの動的調整

```javascript
getDynamicDepth() {
    const stoneCount = this.countStones().black + this.countStones().white;
    const totalCells = BOARD_SIZE * BOARD_SIZE;
    const fillRate = stoneCount / totalCells;

    // 序盤: 浅く、終盤: 深く
    if (fillRate < 0.2) return 3;
    if (fillRate < 0.5) return 4;
    if (fillRate < 0.8) return 5;
    return 6;
}
```

### 手の優先順位付け（探索効率化）

```javascript
sortMoves(moves, board, player) {
    return moves.map(move => {
        const newBoard = this.applyMoveOnBoard(board, move, player);
        return {
            ...move,
            score: this.quickEvaluate(newBoard, player)
        };
    }).sort((a, b) => b.score - a.score);
}
```

## アニメーション

### 石の配置アニメーション

```javascript
animatePlacement(row, col) {
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (cell) {
        const stone = cell.querySelector('.stone');
        if (stone) {
            stone.classList.add('place');
            setTimeout(() => stone.classList.remove('place'), 300);
        }
    }
}
```

### 石の反転アニメーション（オセロ用）

```javascript
animateFlip(stones) {
    stones.forEach(({ r, c }, index) => {
        setTimeout(() => {
            const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (cell) {
                const stone = cell.querySelector('.stone');
                if (stone) {
                    stone.classList.add('flip');
                }
            }
        }, index * 50);  // 順番に反転
    });
}
```

### 勝利エフェクト

```javascript
showWinEffect(winningCells) {
    winningCells.forEach(({ row, col }, index) => {
        setTimeout(() => {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('winning-line');
            }
        }, index * 100);
    });
}
```

## ゲーム履歴

### 手の記録

```javascript
class GameHistory {
    constructor() {
        this.moves = [];
        this.currentIndex = -1;
    }

    addMove(row, col, player) {
        // 途中から分岐した場合、それ以降を削除
        this.moves = this.moves.slice(0, this.currentIndex + 1);
        this.moves.push({ row, col, player, timestamp: Date.now() });
        this.currentIndex++;
    }

    canUndo() {
        return this.currentIndex >= 0;
    }

    canRedo() {
        return this.currentIndex < this.moves.length - 1;
    }

    undo() {
        if (this.canUndo()) {
            const move = this.moves[this.currentIndex];
            this.currentIndex--;
            return move;
        }
        return null;
    }

    redo() {
        if (this.canRedo()) {
            this.currentIndex++;
            return this.moves[this.currentIndex];
        }
        return null;
    }
}
```

### 棋譜の保存・読み込み

```javascript
exportGame() {
    return JSON.stringify({
        moves: this.history.moves,
        boardSize: BOARD_SIZE,
        gameType: 'gomoku'
    });
}

importGame(json) {
    const data = JSON.parse(json);
    this.init();
    for (const move of data.moves) {
        this.makeMove(move.row, move.col, move.player);
    }
}
```

## サウンド効果

### シンプルなサウンド再生

```javascript
const sounds = {
    place: new Audio('data:audio/wav;base64,...'),  // 石を置く音
    flip: new Audio('data:audio/wav;base64,...'),   // 反転音
    win: new Audio('data:audio/wav;base64,...'),    // 勝利音
};

function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(() => {});  // 自動再生ブロック対策
    }
}
```

## レスポンシブ対応

### 動的セルサイズ計算

```javascript
function calculateCellSize() {
    const container = document.querySelector('.container');
    const maxWidth = Math.min(container.clientWidth - 40, 600);
    const cellSize = Math.floor(maxWidth / BOARD_SIZE) - 2;
    return Math.max(cellSize, 25);  // 最小25px
}

function updateBoardSize() {
    const cellSize = calculateCellSize();
    document.documentElement.style.setProperty('--cell-size', `${cellSize}px`);
    document.documentElement.style.setProperty('--stone-size', `${cellSize - 8}px`);
}

window.addEventListener('resize', updateBoardSize);
```

### CSS変数を使ったサイズ指定

```css
:root {
    --cell-size: 50px;
    --stone-size: 40px;
}

.cell {
    width: var(--cell-size);
    height: var(--cell-size);
}

.stone {
    width: var(--stone-size);
    height: var(--stone-size);
}
```

## デバッグ支援

### ボード状態のコンソール出力

```javascript
printBoard() {
    const symbols = { [EMPTY]: '.', [BLACK]: '●', [WHITE]: '○' };
    console.log(this.board.map(row =>
        row.map(cell => symbols[cell]).join(' ')
    ).join('\n'));
}
```

### AI思考過程のログ

```javascript
logAIThinking(moves, scores) {
    console.group('AI Thinking');
    moves.forEach((move, i) => {
        console.log(`(${move.row}, ${move.col}): ${scores[i]}`);
    });
    console.groupEnd();
}
```
