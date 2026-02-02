// オセロゲーム
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

// 8方向のベクトル
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1],  [1, 0], [1, 1]
];

// 角の位置評価（角を優先するための重み付け）
const POSITION_WEIGHTS = [
    [100, -20, 10,  5,  5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [ 10,  -2,  1,  1,  1,  1,  -2,  10],
    [  5,  -2,  1,  1,  1,  1,  -2,   5],
    [  5,  -2,  1,  1,  1,  1,  -2,   5],
    [ 10,  -2,  1,  1,  1,  1,  -2,  10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10,  5,  5, 10, -20, 100]
];

class OthelloGame {
    constructor() {
        this.board = [];
        this.currentPlayer = BLACK;
        this.gameOver = false;
        this.init();
    }

    init() {
        // ボードの初期化
        this.board = Array(8).fill(null).map(() => Array(8).fill(EMPTY));

        // 初期配置
        this.board[3][3] = WHITE;
        this.board[3][4] = BLACK;
        this.board[4][3] = BLACK;
        this.board[4][4] = WHITE;

        this.currentPlayer = BLACK;
        this.gameOver = false;

        this.renderBoard();
        this.updateInfo();
        this.showMessage('');
    }

    renderBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';

        const validMoves = this.getValidMoves(this.currentPlayer);

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;

                // 石を配置
                if (this.board[row][col] !== EMPTY) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${this.board[row][col] === BLACK ? 'black' : 'white'}`;
                    cell.appendChild(stone);
                }

                // 有効な手をハイライト（プレイヤーのターンのみ）
                if (this.currentPlayer === BLACK && validMoves.some(m => m.row === row && m.col === col)) {
                    cell.classList.add('valid-move');
                }

                cell.addEventListener('click', () => this.handleCellClick(row, col));
                boardElement.appendChild(cell);
            }
        }
    }

    handleCellClick(row, col) {
        if (this.gameOver || this.currentPlayer !== BLACK) return;

        if (this.isValidMove(row, col, this.currentPlayer)) {
            this.makeMove(row, col, this.currentPlayer);
            this.switchTurn();
        }
    }

    isValidMove(row, col, player) {
        if (this.board[row][col] !== EMPTY) return false;

        const opponent = player === BLACK ? WHITE : BLACK;

        for (const [dr, dc] of DIRECTIONS) {
            let r = row + dr;
            let c = col + dc;
            let foundOpponent = false;

            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (this.board[r][c] === opponent) {
                    foundOpponent = true;
                } else if (this.board[r][c] === player) {
                    if (foundOpponent) return true;
                    break;
                } else {
                    break;
                }
                r += dr;
                c += dc;
            }
        }
        return false;
    }

    getValidMoves(player) {
        const moves = [];
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.isValidMove(row, col, player)) {
                    moves.push({ row, col });
                }
            }
        }
        return moves;
    }

    makeMove(row, col, player) {
        this.board[row][col] = player;
        const flippedStones = this.getFlippedStones(row, col, player);

        for (const { r, c } of flippedStones) {
            this.board[r][c] = player;
        }

        this.renderBoard();
        this.animateFlip(flippedStones);
        this.updateInfo();
    }

    getFlippedStones(row, col, player) {
        const opponent = player === BLACK ? WHITE : BLACK;
        const flipped = [];

        for (const [dr, dc] of DIRECTIONS) {
            const toFlip = [];
            let r = row + dr;
            let c = col + dc;

            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                if (this.board[r][c] === opponent) {
                    toFlip.push({ r, c });
                } else if (this.board[r][c] === player) {
                    flipped.push(...toFlip);
                    break;
                } else {
                    break;
                }
                r += dr;
                c += dc;
            }
        }
        return flipped;
    }

    animateFlip(stones) {
        setTimeout(() => {
            for (const { r, c } of stones) {
                const cell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                if (cell) {
                    const stone = cell.querySelector('.stone');
                    if (stone) {
                        stone.classList.add('flip');
                    }
                }
            }
        }, 50);
    }

    switchTurn() {
        const opponent = this.currentPlayer === BLACK ? WHITE : BLACK;

        // 相手が打てるかチェック
        if (this.getValidMoves(opponent).length > 0) {
            this.currentPlayer = opponent;
            this.renderBoard();
            this.updateInfo();

            // CPUのターン
            if (this.currentPlayer === WHITE) {
                this.showMessage('CPUが考えています...');
                setTimeout(() => this.cpuMove(), 800);
            }
        } else if (this.getValidMoves(this.currentPlayer).length > 0) {
            // 相手がパス
            this.showMessage(`${opponent === BLACK ? '黒' : '白'}はパスです`);
            this.renderBoard();

            if (this.currentPlayer === WHITE) {
                setTimeout(() => this.cpuMove(), 800);
            }
        } else {
            // 両者打てない = ゲーム終了
            this.endGame();
        }
    }

    cpuMove() {
        const validMoves = this.getValidMoves(WHITE);
        if (validMoves.length === 0) {
            this.switchTurn();
            return;
        }

        // 最善手を選択
        const bestMove = this.selectBestMove(validMoves);
        this.makeMove(bestMove.row, bestMove.col, WHITE);
        this.showMessage('');
        this.switchTurn();
    }

    selectBestMove(validMoves) {
        let bestScore = -Infinity;
        let bestMoves = [];

        for (const move of validMoves) {
            // 取れる石の数
            const flipped = this.getFlippedStones(move.row, move.col, WHITE);
            const flipCount = flipped.length;

            // 位置の重み
            const positionWeight = POSITION_WEIGHTS[move.row][move.col];

            // 総合スコア
            const score = flipCount * 2 + positionWeight;

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (score === bestScore) {
                bestMoves.push(move);
            }
        }

        // 同スコアならランダム選択
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    countStones() {
        let black = 0;
        let white = 0;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (this.board[row][col] === BLACK) black++;
                else if (this.board[row][col] === WHITE) white++;
            }
        }

        return { black, white };
    }

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

    showMessage(msg) {
        const messageElement = document.getElementById('message');
        messageElement.textContent = msg;
        messageElement.className = 'message';
    }

    endGame() {
        this.gameOver = true;
        const { black, white } = this.countStones();

        let result;
        if (black > white) {
            result = `ゲーム終了！ 黒の勝ち！ (${black} - ${white})`;
        } else if (white > black) {
            result = `ゲーム終了！ 白（CPU）の勝ち！ (${black} - ${white})`;
        } else {
            result = `ゲーム終了！ 引き分け！ (${black} - ${white})`;
        }

        const messageElement = document.getElementById('message');
        messageElement.textContent = result;
        messageElement.className = 'message winner';
    }
}

// ゲーム開始
const game = new OthelloGame();

// リセットボタン
document.getElementById('reset-btn').addEventListener('click', () => {
    game.init();
});
