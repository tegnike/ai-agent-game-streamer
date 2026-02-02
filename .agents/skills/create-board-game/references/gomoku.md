# 五目並べ（Gomoku）実装ガイド

## 概要

五目並べは15x15（または19x19）のボードで、先に5つの石を縦・横・斜めに並べた方が勝つゲームです。

## ゲーム設定

```javascript
const BOARD_SIZE = 15;  // 15x15 または 19x19
const WIN_COUNT = 5;    // 勝利に必要な連続数
```

## 勝敗判定

最後に置いた石を起点に、4方向（横、縦、斜め2種）をチェックします。

```javascript
checkWinner() {
    if (!this.lastMove) return null;

    const { row, col } = this.lastMove;
    const player = this.board[row][col];

    // 4方向: 横、縦、右下がり斜め、右上がり斜め
    const directions = [
        [[0, -1], [0, 1]],   // 横
        [[-1, 0], [1, 0]],   // 縦
        [[-1, -1], [1, 1]],  // 右下がり斜め
        [[-1, 1], [1, -1]]   // 右上がり斜め
    ];

    for (const [dir1, dir2] of directions) {
        let count = 1;  // 自分自身

        // 両方向にカウント
        count += this.countDirection(row, col, dir1[0], dir1[1], player);
        count += this.countDirection(row, col, dir2[0], dir2[1], player);

        if (count >= WIN_COUNT) {
            return player;
        }
    }

    return null;
}

countDirection(row, col, dr, dc, player) {
    let count = 0;
    let r = row + dr;
    let c = col + dc;

    while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (this.board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        } else {
            break;
        }
    }

    return count;
}
```

## 有効な手の判定

五目並べでは、空いているマスならどこでも打てます。

```javascript
isValidMove(row, col, player) {
    return this.board[row][col] === EMPTY;
}
```

## AI実装（パターンマッチング）

### 脅威度評価

```javascript
// パターンと脅威度
const PATTERNS = {
    FIVE:       { pattern: 'XXXXX', score: 1000000 },  // 勝ち
    OPEN_FOUR:  { pattern: '_XXXX_', score: 50000 },   // 両端空き4連
    FOUR:       { pattern: 'XXXX_', score: 10000 },    // 片端4連
    OPEN_THREE: { pattern: '_XXX_', score: 5000 },     // 両端空き3連
    THREE:      { pattern: 'XXX__', score: 1000 },     // 3連
    OPEN_TWO:   { pattern: '_XX_', score: 500 },       // 両端空き2連
    TWO:        { pattern: 'XX___', score: 100 },      // 2連
};
```

### ライン評価

```javascript
evaluateLine(cells, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    const line = cells.map(c => {
        if (c === player) return 'X';
        if (c === opponent) return 'O';
        return '_';
    }).join('');

    let score = 0;

    // 自分のパターンをプラス
    for (const [name, { pattern, score: s }] of Object.entries(PATTERNS)) {
        const regex = new RegExp(pattern.replace(/X/g, 'X').replace(/_/g, '_'), 'g');
        const matches = (line.match(regex) || []).length;
        score += matches * s;
    }

    // 相手のパターンをマイナス（防御）
    const oppLine = line.replace(/X/g, 'T').replace(/O/g, 'X').replace(/T/g, 'O');
    for (const [name, { pattern, score: s }] of Object.entries(PATTERNS)) {
        const regex = new RegExp(pattern.replace(/X/g, 'X').replace(/_/g, '_'), 'g');
        const matches = (oppLine.match(regex) || []).length;
        score -= matches * s * 0.9;  // 攻撃よりやや低く
    }

    return score;
}
```

### 最善手選択

```javascript
selectBestMove(validMoves) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of validMoves) {
        // 仮に置いてスコア計算
        this.board[move.row][move.col] = WHITE;
        const score = this.evaluateBoard(WHITE);
        this.board[move.row][move.col] = EMPTY;

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

evaluateBoard(player) {
    let totalScore = 0;

    // 全ての行
    for (let row = 0; row < BOARD_SIZE; row++) {
        totalScore += this.evaluateLine(this.board[row], player);
    }

    // 全ての列
    for (let col = 0; col < BOARD_SIZE; col++) {
        const column = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            column.push(this.board[row][col]);
        }
        totalScore += this.evaluateLine(column, player);
    }

    // 斜めライン（右下がり）
    for (let start = -BOARD_SIZE + 1; start < BOARD_SIZE; start++) {
        const diagonal = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            const row = i;
            const col = start + i;
            if (col >= 0 && col < BOARD_SIZE) {
                diagonal.push(this.board[row][col]);
            }
        }
        if (diagonal.length >= WIN_COUNT) {
            totalScore += this.evaluateLine(diagonal, player);
        }
    }

    // 斜めライン（右上がり）
    for (let start = 0; start < 2 * BOARD_SIZE - 1; start++) {
        const diagonal = [];
        for (let i = 0; i < BOARD_SIZE; i++) {
            const row = i;
            const col = start - i;
            if (col >= 0 && col < BOARD_SIZE) {
                diagonal.push(this.board[row][col]);
            }
        }
        if (diagonal.length >= WIN_COUNT) {
            totalScore += this.evaluateLine(diagonal, player);
        }
    }

    return totalScore;
}
```

## 探索範囲の最適化

空のボードで全マスを評価すると遅いため、既存の石の周囲のみを探索します。

```javascript
getValidMoves(player) {
    const moves = [];
    const checked = new Set();

    // 既存の石の周囲2マスを探索
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (this.board[row][col] !== EMPTY) {
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const r = row + dr;
                        const c = col + dc;
                        const key = `${r},${c}`;

                        if (r >= 0 && r < BOARD_SIZE &&
                            c >= 0 && c < BOARD_SIZE &&
                            this.board[r][c] === EMPTY &&
                            !checked.has(key)) {
                            checked.add(key);
                            moves.push({ row: r, col: c });
                        }
                    }
                }
            }
        }
    }

    // 最初の手は中央
    if (moves.length === 0) {
        const center = Math.floor(BOARD_SIZE / 2);
        moves.push({ row: center, col: center });
    }

    return moves;
}
```

## 禁じ手（連珠ルール）

競技ルールでは黒に禁じ手があります（三三、四四、長連）。必要に応じて実装します。

```javascript
// 簡易的な三三チェック
isForbiddenMove(row, col, player) {
    if (player !== BLACK) return false;  // 黒のみ

    // 仮に置く
    this.board[row][col] = player;

    let openThreeCount = 0;

    // 4方向で両端空き3連をカウント
    // ...（省略）

    this.board[row][col] = EMPTY;

    return openThreeCount >= 2;  // 三三は禁じ手
}
```

## CSS調整

15x15ボードの場合、セルサイズを小さくします。

```css
.board {
    grid-template-columns: repeat(15, 1fr);
    max-width: 600px;
}

.cell {
    width: 35px;
    height: 35px;
}

.stone {
    width: 28px;
    height: 28px;
}
```

## 勝利ラインのハイライト

勝利時に5つの石をハイライトします。

```javascript
highlightWinningLine(cells) {
    for (const { row, col } of cells) {
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            cell.classList.add('winning-line');
        }
    }
}
```
