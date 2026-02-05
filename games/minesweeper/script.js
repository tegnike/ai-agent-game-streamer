const DIFFICULTIES = {
    easy:   { rows: 9,  cols: 9,  mines: 10, cellSize: 40 },
    medium: { rows: 16, cols: 16, mines: 40, cellSize: 36 },
    hard:   { rows: 16, cols: 30, mines: 99, cellSize: 28 }
};

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

class Minesweeper {
    constructor() {
        this.difficulty = 'easy';
        this.rows = 9;
        this.cols = 9;
        this.totalMines = 10;
        this.board = [];
        this.revealed = [];
        this.flagged = [];
        this.mineLocations = [];
        this.gameOver = false;
        this.gameStarted = false;
        this.firstClick = true;
        this.timer = 0;
        this.timerInterval = null;
        this.flagCount = 0;

        this.setupDifficultyButtons();
        this.init();
    }

    setupDifficultyButtons() {
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.difficulty;
                const d = DIFFICULTIES[this.difficulty];
                this.rows = d.rows;
                this.cols = d.cols;
                this.totalMines = d.mines;
                this.init();
            });
        });
    }

    init() {
        this.stopTimer();
        this.timer = 0;
        this.gameOver = false;
        this.gameStarted = false;
        this.firstClick = true;
        this.flagCount = 0;

        this.board = Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
        this.revealed = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        this.flagged = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        this.mineLocations = [];

        this.updateInfo();
        this.renderBoard();
        this.showMessage('');
    }

    placeMines(safeRow, safeCol) {
        const safeCells = new Set();
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                safeCells.add(`${safeRow + dr},${safeCol + dc}`);
            }
        }

        let placed = 0;
        while (placed < this.totalMines) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if (this.board[r][c] !== -1 && !safeCells.has(`${r},${c}`)) {
                this.board[r][c] = -1;
                this.mineLocations.push({ row: r, col: c });
                placed++;
            }
        }

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.board[r][c] === -1) continue;
                let count = 0;
                for (const [dr, dc] of DIRECTIONS) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.board[nr][nc] === -1) {
                        count++;
                    }
                }
                this.board[r][c] = count;
            }
        }
    }

    renderBoard() {
        const boardEl = document.getElementById('board');
        boardEl.innerHTML = '';
        const cellSize = DIFFICULTIES[this.difficulty].cellSize;
        boardEl.style.gridTemplateColumns = `repeat(${this.cols}, ${cellSize}px)`;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.style.width = `${cellSize}px`;
                cell.style.height = `${cellSize}px`;
                cell.style.fontSize = `${Math.max(cellSize * 0.45, 10)}px`;
                cell.dataset.row = r;
                cell.dataset.col = c;

                if (this.revealed[r][c]) {
                    cell.classList.add('opened');
                    if (this.board[r][c] === -1) {
                        const img = document.createElement('img');
                        img.src = '../icons/minesweeper_bomb.png';
                        img.className = 'bomb-img';
                        img.alt = '💣';
                        const imgSize = Math.max(cellSize * 0.65, 16);
                        img.style.width = `${imgSize}px`;
                        img.style.height = `${imgSize}px`;
                        cell.appendChild(img);
                    } else if (this.board[r][c] > 0) {
                        cell.textContent = this.board[r][c];
                        cell.classList.add(`num-${this.board[r][c]}`);
                    }
                } else {
                    cell.classList.add('closed');
                    if (this.flagged[r][c]) {
                        const flag = document.createElement('span');
                        flag.className = 'flag';
                        flag.style.fontSize = `${Math.max(cellSize * 0.55, 12)}px`;
                        flag.textContent = '🚩';
                        cell.appendChild(flag);
                    }
                }

                cell.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleCellClick(r, c);
                });
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.toggleFlag(r, c);
                });

                boardEl.appendChild(cell);
            }
        }
    }

    handleCellClick(row, col) {
        if (this.gameOver) return;
        if (this.flagged[row][col]) return;
        if (this.revealed[row][col]) {
            this.chordReveal(row, col);
            return;
        }

        if (this.firstClick) {
            this.firstClick = false;
            this.placeMines(row, col);
            this.startTimer();
            this.gameStarted = true;
        }

        this.reveal(row, col);
    }

    reveal(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return;
        if (this.revealed[row][col] || this.flagged[row][col]) return;

        this.revealed[row][col] = true;

        if (this.board[row][col] === -1) {
            this.onMineHit(row, col);
            return;
        }

        if (this.board[row][col] === 0) {
            for (const [dr, dc] of DIRECTIONS) {
                this.reveal(row + dr, col + dc);
            }
        }

        this.renderBoard();
        this.checkWin();
    }

    chordReveal(row, col) {
        if (!this.revealed[row][col]) return;
        const num = this.board[row][col];
        if (num <= 0) return;

        let adjacentFlags = 0;
        for (const [dr, dc] of DIRECTIONS) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && this.flagged[nr][nc]) {
                adjacentFlags++;
            }
        }

        if (adjacentFlags === num) {
            for (const [dr, dc] of DIRECTIONS) {
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    if (!this.revealed[nr][nc] && !this.flagged[nr][nc]) {
                        this.reveal(nr, nc);
                    }
                }
            }
        }
    }

    toggleFlag(row, col) {
        if (this.gameOver) return;
        if (this.revealed[row][col]) return;

        if (this.flagged[row][col]) {
            this.flagged[row][col] = false;
            this.flagCount--;
        } else {
            this.flagged[row][col] = true;
            this.flagCount++;
        }

        this.updateInfo();
        this.renderBoard();
    }

    onMineHit(row, col) {
        this.gameOver = true;
        this.stopTimer();

        for (const loc of this.mineLocations) {
            this.revealed[loc.row][loc.col] = true;
        }

        this.renderBoard();

        const hitCell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (hitCell) hitCell.classList.add('exploded');

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.flagged[r][c] && this.board[r][c] !== -1) {
                    const wrongCell = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
                    if (wrongCell) wrongCell.classList.add('wrong-flag');
                }
            }
        }

        const msgEl = document.getElementById('message');
        msgEl.textContent = '💥 ゲームオーバー！地雷を踏んでしまった…';
        msgEl.className = 'message lose';
    }

    checkWin() {
        let unopened = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.revealed[r][c]) unopened++;
            }
        }

        if (unopened === this.totalMines) {
            this.gameOver = true;
            this.stopTimer();

            for (const loc of this.mineLocations) {
                if (!this.flagged[loc.row][loc.col]) {
                    this.flagged[loc.row][loc.col] = true;
                    this.flagCount++;
                }
            }
            this.updateInfo();
            this.renderBoard();

            const msgEl = document.getElementById('message');
            msgEl.textContent = `🎉 クリア！ タイム: ${this.timer}秒`;
            msgEl.className = 'message winner';
        }
    }

    startTimer() {
        this.timer = 0;
        document.getElementById('timer').textContent = '000';
        this.timerInterval = setInterval(() => {
            this.timer++;
            document.getElementById('timer').textContent = String(this.timer).padStart(3, '0');
            if (this.timer >= 999) this.stopTimer();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateInfo() {
        const remaining = this.totalMines - this.flagCount;
        document.getElementById('mine-count').textContent = remaining;
    }

    showMessage(msg) {
        const msgEl = document.getElementById('message');
        msgEl.textContent = msg;
        msgEl.className = 'message';
    }

    getGameState() {
        let opened = 0;
        let flagged = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.revealed[r][c]) opened++;
                if (this.flagged[r][c]) flagged++;
            }
        }
        return {
            difficulty: this.difficulty,
            rows: this.rows,
            cols: this.cols,
            totalMines: this.totalMines,
            opened,
            flagged,
            gameOver: this.gameOver,
            gameStarted: this.gameStarted,
            timer: this.timer
        };
    }
}

const game = new Minesweeper();

document.getElementById('reset-btn').addEventListener('click', () => {
    game.init();
});
