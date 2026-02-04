/**
 * 倉庫番 (Sokoban)
 * プレイヤーが箱を押してゴールに運ぶパズルゲーム
 */

// セルタイプ
const FLOOR = 0;
const WALL = 1;
const GOAL = 2;
const BOX = 3;
const BOX_ON_GOAL = 4;
const PLAYER = 5;
const PLAYER_ON_GOAL = 6;

// 方向
const DIRECTIONS = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 }
};

// ステージデータ（標準的な倉庫番フォーマット）
// # = 壁, @ = プレイヤー, $ = 箱, . = ゴール, * = ゴール上の箱, + = ゴール上のプレイヤー, スペース = 床
const STAGES = [
    // ステージ 1 - チュートリアル
    [
        "  #####",
        "###   #",
        "# $ # ##",
        "# #  . #",
        "# @ $. #",
        "#      #",
        "########"
    ],
    // ステージ 2
    [
        "########",
        "#      #",
        "# .**$ #",
        "# .  $ #",
        "# . $$ #",
        "#   @  #",
        "########"
    ],
    // ステージ 3
    [
        "  ####",
        "###  ####",
        "#     $ #",
        "# #  #$ #",
        "# . .#@ #",
        "##$  ####",
        " # ..#",
        " #   #",
        " #####"
    ],
    // ステージ 4
    [
        "########",
        "#  #   #",
        "# $$ $ #",
        "#  #$  #",
        "#..#  @#",
        "#.. ####",
        "#  ##",
        "####"
    ],
    // ステージ 5
    [
        "  #####",
        "  #   #",
        "  #$  #",
        "###  $###",
        "#  $ $ @#",
        "# .. #  #",
        "###..####",
        "  ####"
    ],
    // ステージ 6
    [
        "    #####",
        "    #   #",
        "    #$  #",
        "  ###  $##",
        "  #  $ $ #",
        "### # ## #",
        "#   # ## ##",
        "# $  $      #",
        "##### ### #@#",
        "    #  ...  #",
        "    #########"
    ],
    // ステージ 7
    [
        "  ######",
        "  #    #",
        " ## ## ###",
        " # $  $  #",
        "## $  $  #",
        "#  ## #####",
        "#   . .   #",
        "###. . .###",
        "  # @ #",
        "  #####"
    ],
    // ステージ 8
    [
        "  ########",
        "  #@     #",
        "### $#$# #",
        "#  $ #   #",
        "# #  # # #",
        "# #. .  .#",
        "#   ##$#.#",
        "###    ###",
        "  ######"
    ],
    // ステージ 9
    [
        "   #####",
        "   #   ##",
        "   # #  #",
        "   #    #",
        "####$## #",
        "#   $   #",
        "# #$ #$##",
        "# @......#",
        "#  ######",
        "####"
    ],
    // ステージ 10
    [
        "##########",
        "# @      #",
        "# ##### ##",
        "# #   #  #",
        "# # $ #  #",
        "# #$$$#$ #",
        "# #     .#",
        "#   ###..#",
        "#####  ..#",
        "    ######"
    ]
];

class Sokoban {
    constructor() {
        this.currentStage = 0;
        this.board = [];
        this.playerPos = { row: 0, col: 0 };
        this.moveCount = 0;
        this.history = [];
        this.goals = [];
        this.init();
    }

    /**
     * ゲーム初期化
     */
    init() {
        this.loadStage(this.currentStage);
        this.bindEvents();
        this.updateInfo();
    }

    /**
     * ステージ読み込み
     */
    loadStage(stageIndex) {
        this.currentStage = stageIndex;
        this.moveCount = 0;
        this.history = [];
        this.goals = [];
        this.board = [];

        const stageData = STAGES[stageIndex];
        const maxWidth = Math.max(...stageData.map(row => row.length));

        for (let row = 0; row < stageData.length; row++) {
            this.board[row] = [];
            for (let col = 0; col < maxWidth; col++) {
                const char = stageData[row][col] || ' ';
                let cell;

                switch (char) {
                    case '#':
                        cell = WALL;
                        break;
                    case '@':
                        cell = PLAYER;
                        this.playerPos = { row, col };
                        break;
                    case '+':
                        cell = PLAYER_ON_GOAL;
                        this.playerPos = { row, col };
                        this.goals.push({ row, col });
                        break;
                    case '$':
                        cell = BOX;
                        break;
                    case '*':
                        cell = BOX_ON_GOAL;
                        this.goals.push({ row, col });
                        break;
                    case '.':
                        cell = GOAL;
                        this.goals.push({ row, col });
                        break;
                    default:
                        cell = FLOOR;
                }
                this.board[row][col] = cell;
            }
        }

        this.renderBoard();
        this.updateInfo();
        this.showMessage('矢印キーまたはWASDで移動');
    }

    /**
     * ボード描画
     */
    renderBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';

        const rows = this.board.length;
        const cols = this.board[0].length;
        boardElement.style.gridTemplateColumns = `repeat(${cols}, 40px)`;
        boardElement.style.gridTemplateRows = `repeat(${rows}, 40px)`;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const cellType = this.board[row][col];

                // 床/ゴールの判定
                const isGoal = this.goals.some(g => g.row === row && g.col === col);

                switch (cellType) {
                    case WALL:
                        cell.classList.add('wall');
                        break;
                    case FLOOR:
                        cell.classList.add('floor');
                        break;
                    case GOAL:
                        cell.classList.add('floor', 'goal');
                        break;
                    case BOX:
                        cell.classList.add('floor');
                        if (isGoal) cell.classList.add('goal');
                        const box = document.createElement('div');
                        box.className = 'box';
                        cell.appendChild(box);
                        break;
                    case BOX_ON_GOAL:
                        cell.classList.add('floor', 'goal');
                        const boxOnGoal = document.createElement('div');
                        boxOnGoal.className = 'box on-goal';
                        cell.appendChild(boxOnGoal);
                        break;
                    case PLAYER:
                        cell.classList.add('floor');
                        if (isGoal) cell.classList.add('goal');
                        const player = document.createElement('div');
                        player.className = 'player';
                        cell.appendChild(player);
                        break;
                    case PLAYER_ON_GOAL:
                        cell.classList.add('floor', 'goal');
                        const playerOnGoal = document.createElement('div');
                        playerOnGoal.className = 'player';
                        cell.appendChild(playerOnGoal);
                        break;
                }

                boardElement.appendChild(cell);
            }
        }
    }

    /**
     * プレイヤー移動
     */
    move(direction) {
        const dir = DIRECTIONS[direction];
        if (!dir) return false;

        const newRow = this.playerPos.row + dir.row;
        const newCol = this.playerPos.col + dir.col;

        // 範囲外チェック
        if (newRow < 0 || newRow >= this.board.length ||
            newCol < 0 || newCol >= this.board[0].length) {
            return false;
        }

        const targetCell = this.board[newRow][newCol];

        // 壁には移動できない
        if (targetCell === WALL) {
            return false;
        }

        // 箱がある場合
        if (targetCell === BOX || targetCell === BOX_ON_GOAL) {
            const boxNewRow = newRow + dir.row;
            const boxNewCol = newCol + dir.col;

            // 箱の移動先チェック
            if (boxNewRow < 0 || boxNewRow >= this.board.length ||
                boxNewCol < 0 || boxNewCol >= this.board[0].length) {
                return false;
            }

            const boxTargetCell = this.board[boxNewRow][boxNewCol];

            // 箱の移動先が壁または箱なら移動不可
            if (boxTargetCell === WALL || boxTargetCell === BOX || boxTargetCell === BOX_ON_GOAL) {
                return false;
            }

            // 履歴保存
            this.saveHistory();

            // 箱を移動
            const isBoxOnGoal = this.goals.some(g => g.row === boxNewRow && g.col === boxNewCol);
            this.board[boxNewRow][boxNewCol] = isBoxOnGoal ? BOX_ON_GOAL : BOX;

            // 元の箱の位置を更新
            const wasBoxOnGoal = this.goals.some(g => g.row === newRow && g.col === newCol);
            this.board[newRow][newCol] = wasBoxOnGoal ? GOAL : FLOOR;
        } else {
            // 履歴保存
            this.saveHistory();
        }

        // プレイヤーの元の位置を更新
        const wasPlayerOnGoal = this.goals.some(g => g.row === this.playerPos.row && g.col === this.playerPos.col);
        this.board[this.playerPos.row][this.playerPos.col] = wasPlayerOnGoal ? GOAL : FLOOR;

        // プレイヤーを移動
        const isPlayerOnGoal = this.goals.some(g => g.row === newRow && g.col === newCol);
        this.board[newRow][newCol] = isPlayerOnGoal ? PLAYER_ON_GOAL : PLAYER;
        this.playerPos = { row: newRow, col: newCol };

        this.moveCount++;
        this.renderBoard();
        this.updateInfo();

        // クリアチェック
        if (this.checkClear()) {
            this.showMessage(`ステージ ${this.currentStage + 1} クリア！`, true);
        }

        return true;
    }

    /**
     * 履歴保存
     */
    saveHistory() {
        this.history.push({
            board: this.board.map(row => [...row]),
            playerPos: { ...this.playerPos },
            moveCount: this.moveCount
        });

        // 履歴は最大100手まで
        if (this.history.length > 100) {
            this.history.shift();
        }
    }

    /**
     * 元に戻す
     */
    undo() {
        if (this.history.length === 0) return;

        const state = this.history.pop();
        this.board = state.board;
        this.playerPos = state.playerPos;
        this.moveCount = state.moveCount;

        this.renderBoard();
        this.updateInfo();
        this.showMessage('');
    }

    /**
     * クリアチェック
     */
    checkClear() {
        return this.goals.every(goal => {
            const cell = this.board[goal.row][goal.col];
            return cell === BOX_ON_GOAL;
        });
    }

    /**
     * 情報更新
     */
    updateInfo() {
        document.getElementById('current-stage').textContent = this.currentStage + 1;
        document.getElementById('total-stages').textContent = STAGES.length;
        document.getElementById('move-count').textContent = this.moveCount;

        const boxesOnGoal = this.goals.filter(goal => {
            const cell = this.board[goal.row][goal.col];
            return cell === BOX_ON_GOAL;
        }).length;

        document.getElementById('boxes-on-goal').textContent = boxesOnGoal;
        document.getElementById('total-boxes').textContent = this.goals.length;

        // ステージボタンの状態更新
        document.getElementById('prev-stage').disabled = this.currentStage === 0;
        document.getElementById('next-stage').disabled = this.currentStage >= STAGES.length - 1;
    }

    /**
     * メッセージ表示
     */
    showMessage(msg, isClear = false) {
        const messageElement = document.getElementById('message');
        messageElement.textContent = msg;
        messageElement.className = isClear ? 'message clear' : 'message';
    }

    /**
     * イベントバインド
     */
    bindEvents() {
        // キーボード操作
        document.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    e.preventDefault();
                    this.move('up');
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    e.preventDefault();
                    this.move('down');
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    e.preventDefault();
                    this.move('left');
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    e.preventDefault();
                    this.move('right');
                    break;
                case 'z':
                case 'Z':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.undo();
                    }
                    break;
                case 'r':
                case 'R':
                    if (!e.ctrlKey && !e.metaKey) {
                        this.loadStage(this.currentStage);
                    }
                    break;
            }
        });

        // 画面上の矢印ボタン
        document.querySelectorAll('.arrow-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.move(btn.dataset.dir);
            });
        });

        // リセットボタン
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.loadStage(this.currentStage);
        });

        // 元に戻すボタン
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undo();
        });

        // 前のステージ
        document.getElementById('prev-stage').addEventListener('click', () => {
            if (this.currentStage > 0) {
                this.loadStage(this.currentStage - 1);
            }
        });

        // 次のステージ
        document.getElementById('next-stage').addEventListener('click', () => {
            if (this.currentStage < STAGES.length - 1) {
                this.loadStage(this.currentStage + 1);
            }
        });
    }
}

// ゲーム開始
const game = new Sokoban();
