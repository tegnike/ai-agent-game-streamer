// チェスゲーム
const EMPTY = 0;
const WHITE = 1;  // プレイヤー（下側）
const BLACK = 2;  // CPU（上側）

// 駒タイプ
const PAWN = 'P';
const KNIGHT = 'N';
const BISHOP = 'B';
const ROOK = 'R';
const QUEEN = 'Q';
const KING = 'K';

// Unicode駒文字
const PIECE_CHARS = {
    [WHITE]: { [KING]: '♔', [QUEEN]: '♕', [ROOK]: '♖', [BISHOP]: '♗', [KNIGHT]: '♘', [PAWN]: '♙' },
    [BLACK]: { [KING]: '♚', [QUEEN]: '♛', [ROOK]: '♜', [BISHOP]: '♝', [KNIGHT]: '♞', [PAWN]: '♟' },
};

// 駒の価値（AI評価用）
const PIECE_VALUES = {
    [PAWN]: 100,
    [KNIGHT]: 320,
    [BISHOP]: 330,
    [ROOK]: 500,
    [QUEEN]: 900,
    [KING]: 20000,
};

// 位置ボーナステーブル（白視点、黒は反転）
const POSITION_BONUS = {
    [PAWN]: [
        [ 0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [ 5,  5, 10, 25, 25, 10,  5,  5],
        [ 0,  0,  0, 20, 20,  0,  0,  0],
        [ 5, -5,-10,  0,  0,-10, -5,  5],
        [ 5, 10, 10,-20,-20, 10, 10,  5],
        [ 0,  0,  0,  0,  0,  0,  0,  0],
    ],
    [KNIGHT]: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50],
    ],
    [BISHOP]: [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  5,  5,  5,  5,  5,  5,-10],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20],
    ],
    [ROOK]: [
        [ 0,  0,  0,  0,  0,  0,  0,  0],
        [ 5, 10, 10, 10, 10, 10, 10,  5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [ 0,  0,  0,  5,  5,  0,  0,  0],
    ],
    [QUEEN]: [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [ -5,  0,  5,  5,  5,  5,  0, -5],
        [  0,  0,  5,  5,  5,  5,  0, -5],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [-10,  0,  5,  0,  0,  0,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20],
    ],
    [KING]: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [ 20, 20,  0,  0,  0,  0, 20, 20],
        [ 20, 30, 10,  0,  0, 10, 30, 20],
    ],
};

class ChessGame {
    constructor() {
        this.board = [];
        this.currentPlayer = WHITE;
        this.gameOver = false;
        this.selectedCell = null;
        this.validMovesCache = [];
        this.lastMove = null;
        this.moveHistory = [];
        this.capturedWhite = []; // 白が取った駒
        this.capturedBlack = []; // 黒が取った駒

        // キャスリング権利
        this.castlingRights = {
            [WHITE]: { kingSide: true, queenSide: true },
            [BLACK]: { kingSide: true, queenSide: true },
        };

        // アンパッサン対象マス
        this.enPassantTarget = null;

        // プロモーション待ち
        this.promotionPending = null;

        this.init();
    }

    init() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));

        // 黒（CPU）の駒配置（上側: row 0-1）
        this.board[0] = [
            { color: BLACK, type: ROOK }, { color: BLACK, type: KNIGHT }, { color: BLACK, type: BISHOP }, { color: BLACK, type: QUEEN },
            { color: BLACK, type: KING }, { color: BLACK, type: BISHOP }, { color: BLACK, type: KNIGHT }, { color: BLACK, type: ROOK },
        ];
        for (let c = 0; c < 8; c++) this.board[1][c] = { color: BLACK, type: PAWN };

        // 白（プレイヤー）の駒配置（下側: row 6-7）
        for (let c = 0; c < 8; c++) this.board[6][c] = { color: WHITE, type: PAWN };
        this.board[7] = [
            { color: WHITE, type: ROOK }, { color: WHITE, type: KNIGHT }, { color: WHITE, type: BISHOP }, { color: WHITE, type: QUEEN },
            { color: WHITE, type: KING }, { color: WHITE, type: BISHOP }, { color: WHITE, type: KNIGHT }, { color: WHITE, type: ROOK },
        ];

        this.currentPlayer = WHITE;
        this.gameOver = false;
        this.selectedCell = null;
        this.validMovesCache = [];
        this.lastMove = null;
        this.moveHistory = [];
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.castlingRights = {
            [WHITE]: { kingSide: true, queenSide: true },
            [BLACK]: { kingSide: true, queenSide: true },
        };
        this.enPassantTarget = null;
        this.promotionPending = null;

        this.renderLabels();
        this.renderBoard();
        this.updateInfo();
        this.showMessage('');
    }

    renderLabels() {
        const rankLabels = document.getElementById('rank-labels');
        const fileLabels = document.getElementById('file-labels');
        rankLabels.innerHTML = '';
        fileLabels.innerHTML = '';
        for (let r = 0; r < 8; r++) {
            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = 8 - r;
            rankLabels.appendChild(label);
        }
        for (let c = 0; c < 8; c++) {
            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = String.fromCharCode(97 + c);
            fileLabels.appendChild(label);
        }
    }

    renderBoard() {
        const boardEl = document.getElementById('board');
        boardEl.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const cell = document.createElement('div');
                const isLight = (row + col) % 2 === 0;
                cell.className = `cell ${isLight ? 'light' : 'dark'}`;
                cell.dataset.row = row;
                cell.dataset.col = col;

                // 最後の手をハイライト
                if (this.lastMove) {
                    if ((this.lastMove.from.row === row && this.lastMove.from.col === col) ||
                        (this.lastMove.to.row === row && this.lastMove.to.col === col)) {
                        cell.classList.add('last-move');
                    }
                }

                // 選択中のマスをハイライト
                if (this.selectedCell && this.selectedCell.row === row && this.selectedCell.col === col) {
                    cell.classList.add('selected');
                }

                // 有効な移動先をハイライト
                if (this.validMovesCache.some(m => m.row === row && m.col === col)) {
                    if (this.board[row][col]) {
                        cell.classList.add('valid-capture');
                    } else {
                        cell.classList.add('valid-move');
                    }
                }

                // チェック状態のキング
                const piece = this.board[row][col];
                if (piece && piece.type === KING && this.isInCheck(piece.color)) {
                    cell.classList.add('in-check');
                }

                // 駒を描画
                if (piece) {
                    const pieceSpan = document.createElement('span');
                    pieceSpan.className = 'piece';
                    pieceSpan.textContent = PIECE_CHARS[piece.color][piece.type];
                    cell.appendChild(pieceSpan);
                }

                cell.addEventListener('click', () => this.handleCellClick(row, col));
                boardEl.appendChild(cell);
            }
        }
    }

    handleCellClick(row, col) {
        if (this.gameOver || this.currentPlayer !== WHITE || this.promotionPending) return;

        const piece = this.board[row][col];

        // 既に駒を選択していて、有効な移動先をクリックした場合
        if (this.selectedCell) {
            const move = this.validMovesCache.find(m => m.row === row && m.col === col);
            if (move) {
                this.executeMove(this.selectedCell.row, this.selectedCell.col, row, col);
                return;
            }
        }

        // 自分の駒をクリックした場合
        if (piece && piece.color === WHITE) {
            this.selectedCell = { row, col };
            this.validMovesCache = this.getLegalMoves(row, col);
            this.renderBoard();
            return;
        }

        // 選択解除
        this.selectedCell = null;
        this.validMovesCache = [];
        this.renderBoard();
    }

    executeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return;

        // 履歴を保存
        this.saveHistory();

        const captured = this.board[toRow][toCol];

        // アンパッサン判定
        let isEnPassant = false;
        if (piece.type === PAWN && this.enPassantTarget &&
            toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
            isEnPassant = true;
        }

        // キャスリング判定
        let isCastling = false;
        if (piece.type === KING && Math.abs(toCol - fromCol) === 2) {
            isCastling = true;
        }

        // 駒を移動
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // アンパッサンで相手のポーンを除去
        if (isEnPassant) {
            const capturedRow = piece.color === WHITE ? toRow + 1 : toRow - 1;
            const capturedPawn = this.board[capturedRow][toCol];
            if (capturedPawn) {
                if (piece.color === WHITE) this.capturedWhite.push(capturedPawn);
                else this.capturedBlack.push(capturedPawn);
            }
            this.board[capturedRow][toCol] = null;
        }

        // キャプチャ記録
        if (captured) {
            if (piece.color === WHITE) this.capturedWhite.push(captured);
            else this.capturedBlack.push(captured);
        }

        // キャスリング時のルーク移動
        if (isCastling) {
            if (toCol === 6) { // キングサイド
                this.board[toRow][5] = this.board[toRow][7];
                this.board[toRow][7] = null;
            } else if (toCol === 2) { // クイーンサイド
                this.board[toRow][3] = this.board[toRow][0];
                this.board[toRow][0] = null;
            }
        }

        // キャスリング権利の更新
        if (piece.type === KING) {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        if (piece.type === ROOK) {
            if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
        }
        // 相手のルークが取られた場合
        if (captured && captured.type === ROOK) {
            if (toCol === 0) this.castlingRights[captured.color].queenSide = false;
            if (toCol === 7) this.castlingRights[captured.color].kingSide = false;
        }

        // アンパッサン対象の更新
        this.enPassantTarget = null;
        if (piece.type === PAWN && Math.abs(toRow - fromRow) === 2) {
            this.enPassantTarget = {
                row: (fromRow + toRow) / 2,
                col: toCol,
            };
        }

        // プロモーション判定
        if (piece.type === PAWN) {
            const promotionRow = piece.color === WHITE ? 0 : 7;
            if (toRow === promotionRow) {
                if (piece.color === WHITE) {
                    // プレイヤー：モーダルで選択
                    this.promotionPending = { row: toRow, col: toCol, color: piece.color };
                    this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
                    this.selectedCell = null;
                    this.validMovesCache = [];
                    this.renderBoard();
                    this.showPromotionModal(piece.color);
                    return;
                } else {
                    // CPU：クイーンに昇格
                    this.board[toRow][toCol] = { color: piece.color, type: QUEEN };
                }
            }
        }

        this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
        this.selectedCell = null;
        this.validMovesCache = [];

        this.switchTurn();
    }

    showPromotionModal(color) {
        const modal = document.getElementById('promotion-modal');
        const choices = document.getElementById('promotion-choices');
        choices.innerHTML = '';

        for (const type of [QUEEN, ROOK, BISHOP, KNIGHT]) {
            const btn = document.createElement('div');
            btn.className = 'modal-piece';
            btn.textContent = PIECE_CHARS[color][type];
            btn.addEventListener('click', () => this.completePromotion(type));
            choices.appendChild(btn);
        }

        modal.style.display = 'flex';
    }

    completePromotion(type) {
        const { row, col, color } = this.promotionPending;
        this.board[row][col] = { color, type };
        this.promotionPending = null;
        document.getElementById('promotion-modal').style.display = 'none';
        this.switchTurn();
    }

    switchTurn() {
        this.currentPlayer = this.currentPlayer === WHITE ? BLACK : WHITE;
        this.renderBoard();
        this.updateInfo();

        // ゲーム終了判定
        const hasLegalMoves = this.hasAnyLegalMoves(this.currentPlayer);
        const inCheck = this.isInCheck(this.currentPlayer);

        if (!hasLegalMoves) {
            this.gameOver = true;
            if (inCheck) {
                const winner = this.currentPlayer === WHITE ? 'black' : 'white';
                const winnerText = winner === 'white' ? '白（あなた）' : '黒（CPU）';
                this.endGame(`チェックメイト！ ${winnerText}の勝ち！`);
            } else {
                this.endGame('ステイルメイト！ 引き分け！');
            }
            return;
        }

        if (inCheck) {
            this.showMessage('チェック！');
        } else {
            this.showMessage('');
        }

        // CPUのターン
        if (this.currentPlayer === BLACK && !this.gameOver) {
            this.showMessage('CPUが考えています...');
            setTimeout(() => this.cpuMove(), 500);
        }
    }

    cpuMove() {
        const bestMove = this.findBestMove(BLACK, 3);
        if (!bestMove) {
            this.gameOver = true;
            this.endGame('エラー: CPUの手が見つかりません');
            return;
        }

        this.executeMove(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
    }

    // --- 合法手生成 ---

    // 特定マスの駒の合法手（チェック回避を考慮）
    getLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        const pseudoMoves = this.getPseudoLegalMoves(row, col);
        const legalMoves = [];

        for (const move of pseudoMoves) {
            if (this.isMoveLegal(row, col, move.row, move.col, piece.color)) {
                legalMoves.push(move);
            }
        }

        return legalMoves;
    }

    // 全合法手を取得
    getValidMoves(player) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === player) {
                    const pieceMoves = this.getLegalMoves(r, c);
                    for (const m of pieceMoves) {
                        moves.push({ fromRow: r, fromCol: c, toRow: m.row, toCol: m.col });
                    }
                }
            }
        }
        return moves;
    }

    hasAnyLegalMoves(player) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === player) {
                    if (this.getLegalMoves(r, c).length > 0) return true;
                }
            }
        }
        return false;
    }

    // 擬似合法手（チェック回避を考慮しない）
    getPseudoLegalMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];

        switch (piece.type) {
            case PAWN: return this.getPawnMoves(row, col, piece.color);
            case KNIGHT: return this.getKnightMoves(row, col, piece.color);
            case BISHOP: return this.getSlidingMoves(row, col, piece.color, [[-1,-1],[-1,1],[1,-1],[1,1]]);
            case ROOK: return this.getSlidingMoves(row, col, piece.color, [[-1,0],[1,0],[0,-1],[0,1]]);
            case QUEEN: return this.getSlidingMoves(row, col, piece.color, [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]);
            case KING: return this.getKingMoves(row, col, piece.color);
            default: return [];
        }
    }

    getPawnMoves(row, col, color) {
        const moves = [];
        const dir = color === WHITE ? -1 : 1;
        const startRow = color === WHITE ? 6 : 1;

        // 1マス前進
        const oneStep = row + dir;
        if (oneStep >= 0 && oneStep < 8 && !this.board[oneStep][col]) {
            moves.push({ row: oneStep, col });

            // 2マス前進
            const twoStep = row + 2 * dir;
            if (row === startRow && !this.board[twoStep][col]) {
                moves.push({ row: twoStep, col });
            }
        }

        // 斜め取り
        for (const dc of [-1, 1]) {
            const nr = row + dir;
            const nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (target && target.color !== color) {
                    moves.push({ row: nr, col: nc });
                }
                // アンパッサン
                if (this.enPassantTarget && nr === this.enPassantTarget.row && nc === this.enPassantTarget.col) {
                    moves.push({ row: nr, col: nc });
                }
            }
        }

        return moves;
    }

    getKnightMoves(row, col, color) {
        const moves = [];
        const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of offsets) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target || target.color !== color) {
                    moves.push({ row: nr, col: nc });
                }
            }
        }
        return moves;
    }

    getSlidingMoves(row, col, color, directions) {
        const moves = [];
        for (const [dr, dc] of directions) {
            let nr = row + dr;
            let nc = col + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target) {
                    moves.push({ row: nr, col: nc });
                } else {
                    if (target.color !== color) moves.push({ row: nr, col: nc });
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }
        return moves;
    }

    getKingMoves(row, col, color) {
        const moves = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    const target = this.board[nr][nc];
                    if (!target || target.color !== color) {
                        moves.push({ row: nr, col: nc });
                    }
                }
            }
        }

        // キャスリング
        if (!this.isInCheck(color)) {
            const baseRow = color === WHITE ? 7 : 0;
            if (row === baseRow && col === 4) {
                // キングサイド
                if (this.castlingRights[color].kingSide) {
                    if (!this.board[baseRow][5] && !this.board[baseRow][6]) {
                        if (!this.isSquareAttacked(baseRow, 5, color) && !this.isSquareAttacked(baseRow, 6, color)) {
                            moves.push({ row: baseRow, col: 6 });
                        }
                    }
                }
                // クイーンサイド
                if (this.castlingRights[color].queenSide) {
                    if (!this.board[baseRow][1] && !this.board[baseRow][2] && !this.board[baseRow][3]) {
                        if (!this.isSquareAttacked(baseRow, 2, color) && !this.isSquareAttacked(baseRow, 3, color)) {
                            moves.push({ row: baseRow, col: 2 });
                        }
                    }
                }
            }
        }

        return moves;
    }

    // 手がキングをチェックに晒さないか検証
    isMoveLegal(fromRow, fromCol, toRow, toCol, color) {
        // ボードのコピーを作成して試行
        const savedBoard = this.board.map(r => r.map(c => c ? { ...c } : null));
        const savedEnPassant = this.enPassantTarget;
        const piece = this.board[fromRow][fromCol];

        // アンパッサン
        if (piece.type === PAWN && this.enPassantTarget &&
            toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
            const capturedRow = color === WHITE ? toRow + 1 : toRow - 1;
            this.board[capturedRow][toCol] = null;
        }

        // キャスリング
        if (piece.type === KING && Math.abs(toCol - fromCol) === 2) {
            const baseRow = color === WHITE ? 7 : 0;
            if (toCol === 6) {
                this.board[baseRow][5] = this.board[baseRow][7];
                this.board[baseRow][7] = null;
            } else if (toCol === 2) {
                this.board[baseRow][3] = this.board[baseRow][0];
                this.board[baseRow][0] = null;
            }
        }

        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        const legal = !this.isInCheck(color);

        // ボードを復元
        this.board = savedBoard;
        this.enPassantTarget = savedEnPassant;

        return legal;
    }

    // --- チェック判定 ---

    findKing(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.type === KING && p.color === color) return { row: r, col: c };
            }
        }
        return null;
    }

    isInCheck(color) {
        const king = this.findKing(color);
        if (!king) return false;
        return this.isSquareAttacked(king.row, king.col, color);
    }

    // あるマスが相手に攻撃されているか
    isSquareAttacked(row, col, defenderColor) {
        const attacker = defenderColor === WHITE ? BLACK : WHITE;

        // ナイトからの攻撃
        const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (const [dr, dc] of knightOffsets) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const p = this.board[nr][nc];
                if (p && p.color === attacker && p.type === KNIGHT) return true;
            }
        }

        // ポーンからの攻撃
        const pawnDir = defenderColor === WHITE ? -1 : 1;
        for (const dc of [-1, 1]) {
            const nr = row + pawnDir, nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const p = this.board[nr][nc];
                if (p && p.color === attacker && p.type === PAWN) return true;
            }
        }

        // キングからの攻撃
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr, nc = col + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    const p = this.board[nr][nc];
                    if (p && p.color === attacker && p.type === KING) return true;
                }
            }
        }

        // スライディング駒（ビショップ/クイーン の斜め）
        for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
            let nr = row + dr, nc = col + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const p = this.board[nr][nc];
                if (p) {
                    if (p.color === attacker && (p.type === BISHOP || p.type === QUEEN)) return true;
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }

        // スライディング駒（ルーク/クイーン の直線）
        for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            let nr = row + dr, nc = col + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const p = this.board[nr][nc];
                if (p) {
                    if (p.color === attacker && (p.type === ROOK || p.type === QUEEN)) return true;
                    break;
                }
                nr += dr;
                nc += dc;
            }
        }

        return false;
    }

    // --- AI (Minimax with Alpha-Beta Pruning) ---

    findBestMove(color, depth) {
        const moves = this.getValidMoves(color);
        if (moves.length === 0) return null;

        // 手をスコアでソート（枝刈り効率を上げる）
        const scoredMoves = moves.map(m => {
            let score = 0;
            const target = this.board[m.toRow][m.toCol];
            if (target) score += PIECE_VALUES[target.type] * 10; // キャプチャ優先
            // 中央寄りの手を優先
            score += (3.5 - Math.abs(m.toCol - 3.5)) + (3.5 - Math.abs(m.toRow - 3.5));
            return { ...m, sortScore: score };
        });
        scoredMoves.sort((a, b) => b.sortScore - a.sortScore);

        let bestScore = -Infinity;
        let bestMove = scoredMoves[0];

        for (const move of scoredMoves) {
            const state = this.saveState();
            this.applyMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = -this.minimax(depth - 1, -Infinity, Infinity, color === WHITE ? BLACK : WHITE, color);
            this.restoreState(state);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    minimax(depth, alpha, beta, currentColor, maximizingColor) {
        if (depth === 0) return this.evaluate(maximizingColor);

        const moves = this.getValidMoves(currentColor);
        if (moves.length === 0) {
            if (this.isInCheck(currentColor)) {
                // チェックメイト
                return currentColor === maximizingColor ? -99999 + (3 - depth) : 99999 - (3 - depth);
            }
            return 0; // ステイルメイト
        }

        const isMaximizing = currentColor === maximizingColor;
        let best = isMaximizing ? -Infinity : Infinity;

        // 手をソート
        const scoredMoves = moves.map(m => {
            let s = 0;
            const target = this.board[m.toRow][m.toCol];
            if (target) s += PIECE_VALUES[target.type];
            return { ...m, s };
        });
        scoredMoves.sort((a, b) => b.s - a.s);

        for (const move of scoredMoves) {
            const state = this.saveState();
            this.applyMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const nextColor = currentColor === WHITE ? BLACK : WHITE;
            const score = this.minimax(depth - 1, alpha, beta, nextColor, maximizingColor);
            this.restoreState(state);

            if (isMaximizing) {
                best = Math.max(best, score);
                alpha = Math.max(alpha, score);
            } else {
                best = Math.min(best, score);
                beta = Math.min(beta, score);
            }
            if (beta <= alpha) break;
        }

        return best;
    }

    evaluate(color) {
        let score = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (!piece) continue;

                const value = PIECE_VALUES[piece.type];
                const bonus = this.getPositionBonus(piece, r, c);
                const total = value + bonus;

                if (piece.color === color) score += total;
                else score -= total;
            }
        }
        return score;
    }

    getPositionBonus(piece, row, col) {
        const table = POSITION_BONUS[piece.type];
        if (!table) return 0;
        // 黒の場合はテーブルを上下反転
        const r = piece.color === WHITE ? row : 7 - row;
        return table[r][col];
    }

    // 状態保存・復元（AI探索用）
    saveState() {
        return {
            board: this.board.map(r => r.map(c => c ? { ...c } : null)),
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights)),
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            currentPlayer: this.currentPlayer,
        };
    }

    restoreState(state) {
        this.board = state.board;
        this.castlingRights = state.castlingRights;
        this.enPassantTarget = state.enPassantTarget;
        this.currentPlayer = state.currentPlayer;
    }

    // AI用の手適用（描画なし）
    applyMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return;

        // アンパッサン
        if (piece.type === PAWN && this.enPassantTarget &&
            toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
            const capturedRow = piece.color === WHITE ? toRow + 1 : toRow - 1;
            this.board[capturedRow][toCol] = null;
        }

        // キャスリング
        if (piece.type === KING && Math.abs(toCol - fromCol) === 2) {
            const baseRow = piece.color === WHITE ? 7 : 0;
            if (toCol === 6) {
                this.board[baseRow][5] = this.board[baseRow][7];
                this.board[baseRow][7] = null;
            } else if (toCol === 2) {
                this.board[baseRow][3] = this.board[baseRow][0];
                this.board[baseRow][0] = null;
            }
        }

        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // キャスリング権利の更新
        if (piece.type === KING) {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        if (piece.type === ROOK) {
            if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
        }

        // アンパッサン対象の更新
        this.enPassantTarget = null;
        if (piece.type === PAWN && Math.abs(toRow - fromRow) === 2) {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
        }

        // プロモーション（AI用は常にクイーン）
        if (piece.type === PAWN) {
            const promotionRow = piece.color === WHITE ? 0 : 7;
            if (toRow === promotionRow) {
                this.board[toRow][toCol] = { color: piece.color, type: QUEEN };
            }
        }

        this.currentPlayer = this.currentPlayer === WHITE ? BLACK : WHITE;
    }

    // --- 履歴（待った機能） ---

    saveHistory() {
        this.moveHistory.push({
            board: this.board.map(r => r.map(c => c ? { ...c } : null)),
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights)),
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            currentPlayer: this.currentPlayer,
            lastMove: this.lastMove ? JSON.parse(JSON.stringify(this.lastMove)) : null,
            capturedWhite: [...this.capturedWhite],
            capturedBlack: [...this.capturedBlack],
        });
    }

    undo() {
        // プレイヤーの手+CPUの手の2手分戻す
        if (this.moveHistory.length < 2) return;

        // まだCPUのターン中なら戻さない
        if (this.currentPlayer === BLACK && !this.gameOver) return;

        const state = this.moveHistory[this.moveHistory.length - 2];
        this.moveHistory = this.moveHistory.slice(0, -2);

        this.board = state.board;
        this.castlingRights = state.castlingRights;
        this.enPassantTarget = state.enPassantTarget;
        this.currentPlayer = state.currentPlayer;
        this.lastMove = state.lastMove;
        this.capturedWhite = state.capturedWhite;
        this.capturedBlack = state.capturedBlack;
        this.gameOver = false;
        this.selectedCell = null;
        this.validMovesCache = [];
        this.promotionPending = null;

        this.renderBoard();
        this.updateInfo();
        this.showMessage('');
    }

    // --- ゲーム状態取得（API用） ---

    getGameState() {
        const state = {
            board: [],
            currentPlayer: this.currentPlayer === WHITE ? 'white' : 'black',
            gameOver: this.gameOver,
            inCheck: this.isInCheck(this.currentPlayer),
            lastMove: this.lastMove,
            capturedWhite: this.capturedWhite.map(p => p.type),
            capturedBlack: this.capturedBlack.map(p => p.type),
        };

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece) {
                    state.board.push({
                        row: r,
                        col: c,
                        color: piece.color === WHITE ? 'white' : 'black',
                        type: piece.type,
                        notation: String.fromCharCode(97 + c) + (8 - r),
                    });
                }
            }
        }

        return state;
    }

    // --- UI ---

    updateInfo() {
        const turnSpan = document.getElementById('current-turn');
        if (this.currentPlayer === WHITE) {
            turnSpan.textContent = '白（あなた）';
            turnSpan.className = 'white-side';
        } else {
            turnSpan.textContent = '黒（CPU）';
            turnSpan.className = 'black-side';
        }

        // 持ち駒表示
        const capturedWhiteEl = document.getElementById('captured-white');
        const capturedBlackEl = document.getElementById('captured-black');
        capturedWhiteEl.textContent = this.capturedWhite.map(p => PIECE_CHARS[p.color][p.type]).join('');
        capturedBlackEl.textContent = this.capturedBlack.map(p => PIECE_CHARS[p.color][p.type]).join('');

        // 待ったボタン
        const undoBtn = document.getElementById('undo-btn');
        undoBtn.disabled = this.moveHistory.length < 2 || this.currentPlayer !== WHITE || this.gameOver;
    }

    showMessage(msg) {
        const el = document.getElementById('message');
        el.textContent = msg;
        el.className = 'message';
    }

    endGame(msg) {
        const el = document.getElementById('message');
        el.textContent = msg;
        el.className = 'message winner';
        this.renderBoard();
        this.updateInfo();
    }
}

// ゲーム開始
const game = new ChessGame();

// ボタンイベント
document.getElementById('reset-btn').addEventListener('click', () => game.init());
document.getElementById('undo-btn').addEventListener('click', () => game.undo());
