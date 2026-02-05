/**
 * 五目並べ（Gomoku）
 * 19x19 ボード、Minimax AI搭載
 */

// 定数
const EMPTY = 0;
const BLACK = 1;  // プレイヤー（先手）
const WHITE = 2;  // CPU（後手）
const BOARD_SIZE = 19;
const WIN_COUNT = 5;

// AI設定
const AI_DEPTH = 3;  // Minimaxの探索深さ
const SEARCH_RADIUS = 2;  // 石の周囲何マスを探索するか

// パターンスコア（攻撃用）
const PATTERNS = {
    FIVE: 10000000,       // 5連（勝ち）
    OPEN_FOUR: 500000,    // 両端空き4連（ほぼ勝ち確定）
    FOUR: 50000,          // 片端4連
    OPEN_THREE: 10000,    // 両端空き3連
    THREE: 1000,          // 片端3連
    OPEN_TWO: 500,        // 両端空き2連
    TWO: 100,             // 片端2連
};

// 星の位置（天元と8つの星）
const STAR_POINTS = [
    [3, 3], [3, 9], [3, 15],
    [9, 3], [9, 9], [9, 15],
    [15, 3], [15, 9], [15, 15]
];

class Gomoku {
    constructor() {
        this.board = [];
        this.currentPlayer = BLACK;
        this.gameOver = false;
        this.lastMove = null;
        this.winningCells = [];
        this.moveCount = 0;
        this.init();
    }

    /**
     * ゲーム初期化
     */
    init() {
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));
        this.currentPlayer = BLACK;
        this.gameOver = false;
        this.lastMove = null;
        this.winningCells = [];
        this.moveCount = 0;

        this.renderBoard();
        this.updateInfo();
        this.showMessage('');
    }

    /**
     * ボード描画
     */
    renderBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // 端の処理
                if (row === 0) cell.classList.add('edge-top');
                if (row === BOARD_SIZE - 1) cell.classList.add('edge-bottom');
                if (col === 0) cell.classList.add('edge-left');
                if (col === BOARD_SIZE - 1) cell.classList.add('edge-right');

                // 星（天元と星）
                if (STAR_POINTS.some(p => p[0] === row && p[1] === col)) {
                    cell.classList.add('star-point');
                    const starMarker = document.createElement('div');
                    starMarker.className = 'star-marker';
                    cell.appendChild(starMarker);
                }

                // 石を配置
                if (this.board[row][col] !== EMPTY) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${this.board[row][col] === BLACK ? 'black' : 'white'}`;
                    cell.appendChild(stone);
                }

                // 最後の手をハイライト
                if (this.lastMove && this.lastMove.row === row && this.lastMove.col === col) {
                    cell.classList.add('last-move');
                }

                // 勝利ラインをハイライト
                if (this.winningCells.some(c => c.row === row && c.col === col)) {
                    cell.classList.add('winning-line');
                }

                cell.addEventListener('click', () => this.handleCellClick(row, col));
                boardElement.appendChild(cell);
            }
        }
    }

    /**
     * セルクリック処理
     */
    handleCellClick(row, col) {
        if (this.gameOver || this.currentPlayer !== BLACK) return;

        if (this.isValidMove(row, col)) {
            this.makeMove(row, col, this.currentPlayer);
            this.switchTurn();
        }
    }

    /**
     * 有効な手かチェック
     */
    isValidMove(row, col) {
        return this.board[row][col] === EMPTY;
    }

    /**
     * 有効な手一覧を取得（石の周囲のみ）
     */
    getValidMoves() {
        const moves = [];
        const checked = new Set();

        // 石がある場所の周囲を探索
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (this.board[row][col] !== EMPTY) {
                    for (let dr = -SEARCH_RADIUS; dr <= SEARCH_RADIUS; dr++) {
                        for (let dc = -SEARCH_RADIUS; dc <= SEARCH_RADIUS; dc++) {
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

    /**
     * 手を打つ
     */
    makeMove(row, col, player) {
        this.board[row][col] = player;
        this.lastMove = { row, col };
        this.moveCount++;

        this.renderBoard();
        this.updateInfo();

        // 配置アニメーション
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            const stone = cell.querySelector('.stone');
            if (stone) {
                stone.classList.add('place');
            }
        }
    }

    /**
     * 手を元に戻す（AI探索用）
     */
    undoMove(row, col) {
        this.board[row][col] = EMPTY;
    }

    /**
     * ターン切り替え
     */
    switchTurn() {
        // 勝敗チェック
        const winner = this.checkWinner();
        if (winner) {
            this.endGame(winner);
            return;
        }

        // 引き分けチェック（盤面が埋まった）
        if (this.moveCount >= BOARD_SIZE * BOARD_SIZE) {
            this.endGame(null);
            return;
        }

        this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
        this.renderBoard();
        this.updateInfo();

        // CPUのターン
        if (this.currentPlayer === WHITE) {
            this.showMessage('CPUが考えています...');
            setTimeout(() => this.cpuMove(), 500);
        }
    }

    /**
     * CPUの手
     */
    cpuMove() {
        const validMoves = this.getValidMoves();
        if (validMoves.length === 0) {
            this.switchTurn();
            return;
        }

        const bestMove = this.selectBestMove(validMoves);
        this.makeMove(bestMove.row, bestMove.col, WHITE);
        this.showMessage('');
        this.switchTurn();
    }

    /**
     * 最善手を選択（Minimax + Alpha-Beta）
     */
    selectBestMove(validMoves) {
        // 即勝利手・即防御手をまずチェック
        const immediateWin = this.findImmediateWin(WHITE);
        if (immediateWin) return immediateWin;

        const immediateBlock = this.findImmediateWin(BLACK);
        if (immediateBlock) return immediateBlock;

        // 脅威度でソートして探索範囲を絞る
        const scoredMoves = validMoves.map(move => ({
            ...move,
            score: this.evaluateMove(move.row, move.col, WHITE)
        }));
        scoredMoves.sort((a, b) => b.score - a.score);

        // 上位の手のみ深く探索
        const topMoves = scoredMoves.slice(0, Math.min(15, scoredMoves.length));

        let bestScore = -Infinity;
        let bestMoves = [];

        for (const move of topMoves) {
            this.board[move.row][move.col] = WHITE;
            const score = this.minimax(AI_DEPTH - 1, -Infinity, Infinity, false);
            this.board[move.row][move.col] = EMPTY;

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        // 同点の場合はランダムに選択
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    /**
     * 即勝利手（5連が作れる場所）を探す
     */
    findImmediateWin(player) {
        const moves = this.getValidMoves();
        for (const move of moves) {
            this.board[move.row][move.col] = player;
            // 探索用なのでwinningCellsは記録しない
            if (this.checkWinnerAt(move.row, move.col, player, false)) {
                this.board[move.row][move.col] = EMPTY;
                return move;
            }
            this.board[move.row][move.col] = EMPTY;
        }
        return null;
    }

    /**
     * Minimax with Alpha-Beta Pruning
     */
    minimax(depth, alpha, beta, isMaximizing) {
        // 終了条件
        if (depth === 0) {
            return this.evaluateBoard();
        }

        const validMoves = this.getValidMoves();
        if (validMoves.length === 0) {
            return this.evaluateBoard();
        }

        // 即勝利/敗北チェック
        const player = isMaximizing ? WHITE : BLACK;
        const winMove = this.findImmediateWin(player);
        if (winMove) {
            return isMaximizing ? PATTERNS.FIVE : -PATTERNS.FIVE;
        }

        // 探索範囲を絞る
        const scoredMoves = validMoves.map(move => ({
            ...move,
            score: this.evaluateMove(move.row, move.col, player)
        }));
        scoredMoves.sort((a, b) => b.score - a.score);
        const topMoves = scoredMoves.slice(0, Math.min(10, scoredMoves.length));

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of topMoves) {
                this.board[move.row][move.col] = WHITE;
                const evalScore = this.minimax(depth - 1, alpha, beta, false);
                this.board[move.row][move.col] = EMPTY;
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of topMoves) {
                this.board[move.row][move.col] = BLACK;
                const evalScore = this.minimax(depth - 1, alpha, beta, true);
                this.board[move.row][move.col] = EMPTY;
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * 特定の手の評価
     */
    evaluateMove(row, col, player) {
        let score = 0;
        const opponent = player === BLACK ? WHITE : BLACK;

        // 仮に置いてパターンを評価
        this.board[row][col] = player;
        score += this.evaluatePosition(row, col, player);
        this.board[row][col] = EMPTY;

        // 相手の脅威を防ぐ価値
        this.board[row][col] = opponent;
        score += this.evaluatePosition(row, col, opponent) * 0.9;
        this.board[row][col] = EMPTY;

        // 中央に近いほど有利
        const center = Math.floor(BOARD_SIZE / 2);
        const distFromCenter = Math.abs(row - center) + Math.abs(col - center);
        score += (BOARD_SIZE - distFromCenter) * 2;

        return score;
    }

    /**
     * 位置のパターン評価
     */
    evaluatePosition(row, col, player) {
        let score = 0;
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

        for (const [dr, dc] of directions) {
            const line = this.getLine(row, col, dr, dc, 5);
            score += this.evaluateLine(line, player);
        }

        return score;
    }

    /**
     * 指定方向のラインを取得
     */
    getLine(row, col, dr, dc, length) {
        const line = [];
        for (let i = -(length - 1); i < length; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                line.push(this.board[r][c]);
            } else {
                line.push(-1);  // 盤外
            }
        }
        return line;
    }

    /**
     * ラインのパターン評価
     */
    evaluateLine(line, player) {
        const opponent = player === BLACK ? WHITE : BLACK;
        const lineStr = line.map(c => {
            if (c === player) return 'X';
            if (c === opponent) return 'O';
            if (c === EMPTY) return '_';
            return '#';  // 盤外
        }).join('');

        let score = 0;

        // 5連
        if (/XXXXX/.test(lineStr)) score += PATTERNS.FIVE;
        // 両端空き4連
        if (/_XXXX_/.test(lineStr)) score += PATTERNS.OPEN_FOUR;
        // 片端4連
        if (/XXXX_|_XXXX/.test(lineStr)) score += PATTERNS.FOUR;
        // 両端空き3連
        if (/_XXX_/.test(lineStr)) score += PATTERNS.OPEN_THREE;
        // 3連（片端ブロック）
        if (/XXX__|__XXX|_XXX_/.test(lineStr.replace(/O/g, '#'))) score += PATTERNS.THREE;
        // 両端空き2連
        if (/__XX__|_XX_/.test(lineStr)) score += PATTERNS.OPEN_TWO;

        return score;
    }

    /**
     * 盤面全体の評価
     */
    evaluateBoard() {
        let score = 0;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (this.board[row][col] === WHITE) {
                    score += this.evaluatePosition(row, col, WHITE);
                } else if (this.board[row][col] === BLACK) {
                    score -= this.evaluatePosition(row, col, BLACK);
                }
            }
        }

        return score;
    }

    /**
     * 勝敗判定
     */
    checkWinner() {
        if (!this.lastMove) return null;
        const { row, col } = this.lastMove;
        const player = this.board[row][col];

        if (this.checkWinnerAt(row, col, player)) {
            return player;
        }
        return null;
    }

    /**
     * 特定の位置で勝利判定
     * @param {boolean} recordWin - trueなら勝利セルを記録（デフォルトtrue）
     */
    checkWinnerAt(row, col, player, recordWin = true) {
        const directions = [
            [[0, -1], [0, 1]],   // 横
            [[-1, 0], [1, 0]],   // 縦
            [[-1, -1], [1, 1]],  // 右下がり斜め
            [[-1, 1], [1, -1]]   // 右上がり斜め
        ];

        for (const [dir1, dir2] of directions) {
            const cells = [{ row, col }];
            let count = 1;

            // 両方向にカウント
            for (const [dr, dc] of [dir1, dir2]) {
                let r = row + dr;
                let c = col + dc;

                while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
                    if (this.board[r][c] === player) {
                        cells.push({ row: r, col: c });
                        count++;
                        r += dr;
                        c += dc;
                    } else {
                        break;
                    }
                }
            }

            if (count >= WIN_COUNT) {
                if (recordWin) {
                    this.winningCells = cells;
                }
                return true;
            }
        }

        return false;
    }

    /**
     * 石の数をカウント
     */
    countStones() {
        let black = 0;
        let white = 0;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (this.board[row][col] === BLACK) black++;
                else if (this.board[row][col] === WHITE) white++;
            }
        }

        return { black, white };
    }

    /**
     * 情報更新
     */
    updateInfo() {
        const { black, white } = this.countStones();
        document.getElementById('black-count').textContent = black;
        document.getElementById('white-count').textContent = white;

        const turnSpan = document.getElementById('current-turn');
        if (this.currentPlayer === BLACK) {
            turnSpan.textContent = '黒（あなた）';
            turnSpan.className = 'black-text';
        } else {
            turnSpan.textContent = '白（CPU）';
            turnSpan.className = 'white-text';
        }
    }

    /**
     * メッセージ表示
     */
    showMessage(msg) {
        const messageElement = document.getElementById('message');
        messageElement.textContent = msg;
        messageElement.className = msg.includes('考えています') ? 'message thinking' : 'message';
    }

    /**
     * ゲーム終了
     */
    endGame(winner) {
        this.gameOver = true;
        this.renderBoard();

        let result;
        if (winner === BLACK) {
            result = 'あなたの勝ちです！';
        } else if (winner === WHITE) {
            result = 'CPUの勝ちです！';
        } else {
            result = '引き分けです！';
        }

        const messageElement = document.getElementById('message');
        messageElement.textContent = result;
        messageElement.className = 'message winner';
    }
}

// ゲーム開始
const game = new Gomoku();

// リセットボタン
document.getElementById('reset-btn').addEventListener('click', () => {
    game.init();
});
