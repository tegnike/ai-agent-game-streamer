/**
 * ボードゲーム基本テンプレート
 * {{GAME_NAME}}
 *
 * カスタマイズポイント:
 * - BOARD_SIZE: ボードサイズ
 * - isValidMove(): ゲーム固有のルール
 * - checkWinner(): 勝敗判定ロジック
 * - selectBestMove(): AI ロジック
 */

// 定数
const EMPTY = 0;
const BLACK = 1;  // プレイヤー（先手）
const WHITE = 2;  // CPU（後手）
const BOARD_SIZE = 8;  // {{BOARD_SIZE}} に変更

// 8方向（オセロ/五目並べ共通）
const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],          [0, 1],
    [1, -1],  [1, 0], [1, 1]
];

class BoardGame {
    constructor() {
        this.board = [];
        this.currentPlayer = BLACK;
        this.gameOver = false;
        this.lastMove = null;
        this.init();
    }

    /**
     * ゲーム初期化
     */
    init() {
        // ボードを空で初期化
        this.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(EMPTY));

        // 初期配置（ゲームによって変更）
        // 例: オセロの場合
        // const mid = BOARD_SIZE / 2;
        // this.board[mid - 1][mid - 1] = WHITE;
        // this.board[mid - 1][mid] = BLACK;
        // this.board[mid][mid - 1] = BLACK;
        // this.board[mid][mid] = WHITE;

        this.currentPlayer = BLACK;
        this.gameOver = false;
        this.lastMove = null;

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

        // グリッドサイズを動的に設定
        boardElement.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;

        const validMoves = this.getValidMoves(this.currentPlayer);

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
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

                // 最後の手をハイライト
                if (this.lastMove && this.lastMove.row === row && this.lastMove.col === col) {
                    cell.classList.add('last-move');
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

        if (this.isValidMove(row, col, this.currentPlayer)) {
            this.makeMove(row, col, this.currentPlayer);
            this.switchTurn();
        }
    }

    /**
     * 有効な手かチェック
     * @param {number} row
     * @param {number} col
     * @param {number} player
     * @returns {boolean}
     */
    isValidMove(row, col, player) {
        // 空いているかチェック
        if (this.board[row][col] !== EMPTY) return false;

        // ゲーム固有のルールをここに実装
        // 例: 五目並べなら空いていればOK
        return true;
    }

    /**
     * 有効な手一覧を取得
     * @param {number} player
     * @returns {Array<{row: number, col: number}>}
     */
    getValidMoves(player) {
        const moves = [];
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                if (this.isValidMove(row, col, player)) {
                    moves.push({ row, col });
                }
            }
        }
        return moves;
    }

    /**
     * 手を打つ
     * @param {number} row
     * @param {number} col
     * @param {number} player
     */
    makeMove(row, col, player) {
        this.board[row][col] = player;
        this.lastMove = { row, col };

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
     * ターン切り替え
     */
    switchTurn() {
        // 勝敗チェック
        const winner = this.checkWinner();
        if (winner) {
            this.endGame(winner);
            return;
        }

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
            this.endGame(null);
        }
    }

    /**
     * CPUの手
     */
    cpuMove() {
        const validMoves = this.getValidMoves(WHITE);
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
     * 最善手を選択（AI）
     * @param {Array<{row: number, col: number}>} validMoves
     * @returns {{row: number, col: number}}
     */
    selectBestMove(validMoves) {
        // デフォルト: ランダム選択
        // ゲーム固有のAIロジックに置き換え
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    /**
     * 勝敗判定
     * @returns {number|null} 勝者（BLACK/WHITE）またはnull（続行/引き分け）
     */
    checkWinner() {
        // ゲーム固有の勝敗判定をここに実装
        // 例: 五目並べなら5つ並んだかチェック
        return null;
    }

    /**
     * 石の数をカウント
     * @returns {{black: number, white: number}}
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
     * @param {string} msg
     */
    showMessage(msg) {
        const messageElement = document.getElementById('message');
        messageElement.textContent = msg;
        messageElement.className = 'message';
    }

    /**
     * ゲーム終了
     * @param {number|null} winner
     */
    endGame(winner) {
        this.gameOver = true;
        const { black, white } = this.countStones();

        let result;
        if (winner === BLACK) {
            result = `ゲーム終了！ 黒の勝ち！ (${black} - ${white})`;
        } else if (winner === WHITE) {
            result = `ゲーム終了！ 白（CPU）の勝ち！ (${black} - ${white})`;
        } else {
            // 引き分けまたは石の数で判定
            if (black > white) {
                result = `ゲーム終了！ 黒の勝ち！ (${black} - ${white})`;
            } else if (white > black) {
                result = `ゲーム終了！ 白（CPU）の勝ち！ (${black} - ${white})`;
            } else {
                result = `ゲーム終了！ 引き分け！ (${black} - ${white})`;
            }
        }

        const messageElement = document.getElementById('message');
        messageElement.textContent = result;
        messageElement.className = 'message winner';
    }
}

// ゲーム開始
const game = new BoardGame();

// リセットボタン
document.getElementById('reset-btn').addEventListener('click', () => {
    game.init();
});
