// カードバトルゲーム - メインゲームクラス

class CardBattleGame {
    constructor() {
        this.playerHand = [];
        this.cpuHand = [];
        this.playerDeck = [];
        this.cpuDeck = [];
        this.playerPlayedCard = null;
        this.cpuPlayedCard = null;
        this.currentRound = 1;
        this.maxRounds = 5;
        this.winsNeeded = 3;
        this.playerWins = 0;
        this.cpuWins = 0;
        this.phase = 'select';
        this.gameOver = false;
        this.difficulty = this._loadDifficulty();
        this.roundHistory = [];
        this.playerElementChain = { element: null, count: 0 };
        this.cpuElementChain = { element: null, count: 0 };
        this.usedElements = new Set();
        // サクリファイスシステム
        this.playerSacrificeBonus = 0;
        this.cpuSacrificeBonus = 0;
        this.playerSacrificedCards = [];
        this.cpuSacrificedCards = [];
        this.init();
    }

    _loadDifficulty() {
        try { return localStorage.getItem('cardBattle_difficulty') || 'normal'; } catch (e) { return 'normal'; }
    }

    _saveDifficulty() {
        try { localStorage.setItem('cardBattle_difficulty', this.difficulty); } catch (e) {}
    }

    init() {
        // リザルトオーバーレイがあれば除去
        document.querySelector('.result-overlay')?.remove();

        const pool = shuffle(createCardPool());

        // 交互に配布（偏り防止）
        const playerCards = [];
        const cpuCards = [];
        for (let i = 0; i < 20; i++) {
            if (i % 2 === 0) {
                playerCards.push(pool[i]);
            } else {
                cpuCards.push(pool[i]);
            }
        }

        this.playerHand = playerCards.slice(0, 5);
        this.playerDeck = playerCards.slice(5, 10);
        this.cpuHand = cpuCards.slice(0, 5);
        this.cpuDeck = cpuCards.slice(5, 10);

        this.playerPlayedCard = null;
        this.cpuPlayedCard = null;
        this.currentRound = 1;
        this.maxRounds = 10;
        this.winsNeeded = 3;
        this.playerWins = 0;
        this.cpuWins = 0;
        this.draws = 0;
        this.phase = 'select';
        this.gameOver = false;
        this.roundHistory = [];
        this.playerElementChain = { element: null, count: 0 };
        this.cpuElementChain = { element: null, count: 0 };
        this.usedElements = new Set();
        // サクリファイスリセット
        this.playerSacrificeBonus = 0;
        this.cpuSacrificeBonus = 0;
        this.playerSacrificedCards = [];
        this.cpuSacrificedCards = [];
        this._playerCardRevealed = false;

        this.renderBoard();
        this.updateInfo();
        this.showMessage('カードを選んでください');
        this._updateRoundDisplay();
        this._renderTimeline();
    }

    // ===== 描画 =====
    renderBoard() {
        this.renderPlayerHand();
        this.renderCpuHand();
        this.renderPlayedCards();
        this._renderChainIndicator();
        this._renderSacrificeIndicator();
        this._updateDeckInfo();
        this._updateTurnIndicator();
    }

    _updateDeckInfo() {
        const playerInfo = document.getElementById('player-deck-info');
        const cpuInfo = document.getElementById('cpu-deck-info');
        if (playerInfo) playerInfo.textContent = `手札: ${this.playerHand.length} / デッキ: ${this.playerDeck.length}`;
        if (cpuInfo) cpuInfo.textContent = `手札: ${this.cpuHand.length} / デッキ: ${this.cpuDeck.length}`;
    }

    _updateTurnIndicator() {
        const playerArea = document.querySelector('.player-area');
        const cpuArea = document.querySelector('.cpu-area');
        const phaseLabel = document.querySelector('.phase-label');

        playerArea.classList.remove('active-turn');
        cpuArea.classList.remove('active-turn');

        if (this.phase === 'select') {
            playerArea.classList.add('active-turn');
        } else if (this.phase === 'battle') {
            cpuArea.classList.add('active-turn');
        }

        // フェーズテキスト
        if (!phaseLabel) {
            const label = document.createElement('div');
            label.className = 'phase-label';
            const msgEl = document.getElementById('message');
            msgEl.parentNode.insertBefore(label, msgEl);
        }
        const label = document.querySelector('.phase-label');
        if (this.phase === 'select') label.textContent = '— あなたのターン —';
        else if (this.phase === 'battle') label.textContent = '— CPUのターン —';
        else if (this.phase === 'result') label.textContent = '— 結果 —';
        else label.textContent = '';
    }

    renderPlayerHand() {
        const handElement = document.getElementById('player-hand');
        handElement.innerHTML = '';

        this.playerHand.forEach((card, index) => {
            const cardEl = this.createCardElement(card, index, true);
            if (this.phase === 'select') {
                cardEl.classList.add('selectable');
                cardEl.addEventListener('click', () => this._onCardClick(index));

                // サクリファイスボタン（手札2枚以上の時のみ）
                if (this.playerHand.length > 1) {
                    const sacBtn = document.createElement('button');
                    sacBtn.className = 'sacrifice-btn';
                    sacBtn.textContent = '⚡';
                    sacBtn.title = `サクリファイス (+${Math.floor(card.power / 2)})`;
                    sacBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.sacrificeCard(index);
                    });
                    cardEl.appendChild(sacBtn);
                }

                // 3D tilt エフェクト
                cardEl.addEventListener('mousemove', (e) => {
                    const rect = cardEl.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const centerX = rect.width / 2;
                    const centerY = rect.height / 2;
                    const rotateY = ((x - centerX) / centerX) * 15;
                    const rotateX = ((centerY - y) / centerY) * 15;
                    cardEl.style.transform = `translateY(-8px) perspective(300px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
                });
                cardEl.addEventListener('mouseleave', () => {
                    cardEl.style.transform = '';
                });
            }
            handElement.appendChild(cardEl);
        });
    }

    renderCpuHand() {
        const handElement = document.getElementById('cpu-hand');
        handElement.innerHTML = '';

        this.cpuHand.forEach((card) => {
            const cardEl = document.createElement('div');
            cardEl.className = `card cpu-hand-reveal element-${card.element}`;
            const imgSrc = ELEMENT_IMAGE[card.element];
            const visualHTML = imgSrc
                ? `<img class="card-image" src="${imgSrc}" alt="${ELEMENT_NAMES[card.element]}">`
                : `<div class="card-emoji">${ELEMENT_EMOJI[card.element]}</div>`;
            cardEl.innerHTML = `
                ${visualHTML}
                <div class="card-element">${ELEMENT_NAMES[card.element]}</div>
                <div class="card-power cpu-power-hidden">?</div>
            `;
            handElement.appendChild(cardEl);
        });
    }

    renderPlayedCards() {
        const playerPlayedEl = document.getElementById('player-played');
        const cpuPlayedEl = document.getElementById('cpu-played');

        playerPlayedEl.innerHTML = '';
        cpuPlayedEl.innerHTML = '';

        if (this.playerPlayedCard) {
            if (!this._playerCardRevealed) {
                // 裏向き表示
                const cardEl = document.createElement('div');
                cardEl.className = 'card card-back player-card-facedown';
                cardEl.innerHTML = '<span class="card-back-text">?</span>';
                playerPlayedEl.appendChild(cardEl);
            } else {
                const cardEl = this.createCardElement(this.playerPlayedCard, -1, false);
                cardEl.classList.add('played');
                if (this._playerCardRevealed) cardEl.classList.add('flip-revealed');
                playerPlayedEl.appendChild(cardEl);
            }
        } else {
            // プレースホルダー
            const ph = document.createElement('div');
            ph.className = 'card-placeholder';
            ph.textContent = this.phase === 'select' ? 'カードを選択' : '';
            playerPlayedEl.appendChild(ph);
        }

        if (this.cpuPlayedCard) {
            if (!this._cpuCardRevealed) {
                // 裏向き表示
                const cardEl = document.createElement('div');
                cardEl.className = 'card card-back cpu-card-facedown';
                cardEl.innerHTML = '<span class="card-back-text">?</span>';
                cpuPlayedEl.appendChild(cardEl);
            } else {
                const cardEl = this.createCardElement(this.cpuPlayedCard, -1, false);
                cardEl.classList.add('played');
                if (this._cpuCardRevealed) cardEl.classList.add('flip-revealed');
                cpuPlayedEl.appendChild(cardEl);
            }
        } else {
            // CPUプレースホルダー
            const ph = document.createElement('div');
            ph.className = 'card-placeholder';
            cpuPlayedEl.appendChild(ph);
        }
    }

    createCardElement(card, index, showDetails) {
        const cardEl = document.createElement('div');
        cardEl.className = `card element-${card.element}`;
        cardEl.dataset.index = index;

        const imgSrc = ELEMENT_IMAGE[card.element];
        const visualHTML = imgSrc
            ? `<img class="card-image" src="${imgSrc}" alt="${ELEMENT_NAMES[card.element]}">`
            : `<div class="card-emoji">${ELEMENT_EMOJI[card.element]}</div>`;

        cardEl.innerHTML = `
            ${visualHTML}
            <div class="card-element">${ELEMENT_NAMES[card.element]}</div>
            <div class="card-power">${card.power}</div>
        `;

        return cardEl;
    }

    _onCardClick(index) {
        if (this.phase !== 'select' || this.gameOver) return;
        soundEngine.play('cardSelect');
        this.playCard(index);
    }

    // ===== サクリファイスシステム =====
    sacrificeCard(index) {
        if (this.phase !== 'select' || this.gameOver) return false;
        if (index < 0 || index >= this.playerHand.length) return false;
        if (this.playerHand.length <= 1) return false;

        const card = this.playerHand[index];
        const bonus = Math.floor(card.power / 2);
        this.playerSacrificeBonus += bonus;
        this.playerSacrificedCards.push({ ...card });
        this.playerHand.splice(index, 1);

        soundEngine.play('cardSelect');
        this.renderBoard();
        this.showMessage(`${card.name}をサクリファイス！ (次のカードに +${bonus} パワー)`);
        return true;
    }

    _renderSacrificeIndicator() {
        let indicator = document.getElementById('sacrifice-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'sacrifice-indicator';
            indicator.className = 'sacrifice-indicator';
            const playerArea = document.querySelector('.player-area');
            const hand = document.getElementById('player-hand');
            playerArea.insertBefore(indicator, hand);
        }

        if (this.playerSacrificeBonus > 0 && this.phase === 'select') {
            indicator.innerHTML = `<span class="sacrifice-bonus-label">⚡ サクリファイス</span> <span class="sacrifice-bonus-value">+${this.playerSacrificeBonus}</span>`;
            indicator.style.display = 'flex';
        } else {
            indicator.style.display = 'none';
        }
    }

    // ===== コンボシステム [G3] =====
    _updateChain(who, element) {
        const chain = who === 'player' ? this.playerElementChain : this.cpuElementChain;
        if (chain.element === element) {
            chain.count++;
        } else {
            chain.element = element;
            chain.count = 1;
        }
    }

    _getChainBonus(who) {
        const chain = who === 'player' ? this.playerElementChain : this.cpuElementChain;
        if (chain.count >= 4) return 4;
        if (chain.count >= 3) return 2;
        if (chain.count >= 2) return 1;
        return 0;
    }

    _renderChainIndicator() {
        let indicator = document.querySelector('.chain-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'chain-indicator';
            document.querySelector('.game-panel').insertBefore(indicator, document.getElementById('message'));
        }
        const pc = this.playerElementChain;
        const cc = this.cpuElementChain;
        let html = '';
        if (pc.count >= 2) {
            const bigClass = pc.count >= 2 ? ' chain-big' : '';
            html += `<div class="chain player-chain${bigClass}"><span class="chain-element element-bg-${pc.element}">${ELEMENT_NAMES[pc.element]}</span> ×${pc.count} (+${this._getChainBonus('player')})</div>`;
        }
        if (cc.count >= 2) {
            const bigClass = cc.count >= 2 ? ' chain-big' : '';
            html += `<div class="chain cpu-chain${bigClass}"><span class="chain-element element-bg-${cc.element}">${ELEMENT_NAMES[cc.element]}</span> ×${cc.count} (+${this._getChainBonus('cpu')})</div>`;
        }
        indicator.innerHTML = html;

        // チェイン3以上で大きなテキスト演出
        if (pc.count >= 3) {
            this._showChainPop(`CHAIN x${pc.count}!`);
        } else if (cc.count >= 3) {
            this._showChainPop(`CHAIN x${cc.count}!`);
        }
    }

    _showChainPop(text) {
        const field = document.querySelector('.field');
        if (!field) return;
        // 既存のpopを除去
        field.querySelectorAll('.chain-pop').forEach(e => e.remove());
        const pop = document.createElement('div');
        pop.className = 'chain-pop';
        pop.textContent = text;
        field.appendChild(pop);
        setTimeout(() => pop.remove(), 1000);
    }

    // ===== カードプレイ =====
    playCard(index) {
        if (this.phase !== 'select' || this.gameOver) return false;
        if (index < 0 || index >= this.playerHand.length) return false;

        soundEngine.play('cardPlay');
        this.playerPlayedCard = this.playerHand[index];
        this._playerHandSnapshot = [...this.playerHand]; // CPU判断用: 選択前の手札を保存
        this.playerHand.splice(index, 1);
        this.usedElements.add(this.playerPlayedCard.element);

        // チェイン更新
        this._updateChain('player', this.playerPlayedCard.element);

        this.phase = 'battle';
        this._cpuCardRevealed = false;
        this._playerCardRevealed = false;
        this.renderBoard();
        this.showMessage('CPUが考えています...');

        setTimeout(() => this.cpuTurn(), 800);
        return true;
    }

    // ===== CPU思考演出 [U6] + ターン処理 =====
    cpuTurn() {
        // CPU思考演出
        const cpuHandEl = document.getElementById('cpu-hand');
        const cards = cpuHandEl.querySelectorAll('.card');
        let highlightIdx = 0;
        const thinkInterval = setInterval(() => {
            cards.forEach(c => c.classList.remove('cpu-thinking'));
            if (cards[highlightIdx]) cards[highlightIdx].classList.add('cpu-thinking');
            highlightIdx = (highlightIdx + 1) % cards.length;
        }, 100);

        setTimeout(() => {
            clearInterval(thinkInterval);
            cards.forEach(c => c.classList.remove('cpu-thinking'));

            // CPUサクリファイス判断
            const sacrificed = this._cpuSacrificeDecision();

            if (sacrificed) {
                this.renderBoard();
                this.showMessage(`CPUが${sacrificed.name}をサクリファイス！ (+${Math.floor(sacrificed.power / 2)})`);
                setTimeout(() => this._cpuPlayCard(), 600);
            } else {
                this._cpuPlayCard();
            }
        }, 500);
    }

    _cpuPlayCard() {
        const cpuIndex = this.selectCpuCard();

        this.cpuPlayedCard = this.cpuHand[cpuIndex];
        this.cpuHand.splice(cpuIndex, 1);
        this._updateChain('cpu', this.cpuPlayedCard.element);

        // 両カード裏向きで場に出す
        this.renderBoard();
        this.showMessage('オープン！');

        // 両カード同時フリップ演出
        setTimeout(() => {
            // flip-out アニメーション適用（裏→90度回転）
            const playerCard = document.querySelector('#player-played .card');
            const cpuCard = document.querySelector('#cpu-played .card');
            if (playerCard) playerCard.classList.add('card-flip-out');
            if (cpuCard) cpuCard.classList.add('card-flip-out');
            soundEngine.play('flip');

            // 90度回転完了後、表向きにして flip-revealed で戻す
            setTimeout(() => {
                this._playerCardRevealed = true;
                this._cpuCardRevealed = true;
                this.renderBoard();
                setTimeout(() => this.resolveRound(), 500);
            }, 250);
        }, 400);
    }

    _cpuSacrificeDecision() {
        if (this.difficulty === 'easy') return null;
        if (this.cpuHand.length <= 1) return null;

        // 最弱カードを見つける
        let weakestIdx = 0;
        let weakestPower = this.cpuHand[0].power;
        for (let i = 1; i < this.cpuHand.length; i++) {
            if (this.cpuHand[i].power < weakestPower) {
                weakestPower = this.cpuHand[i].power;
                weakestIdx = i;
            }
        }

        // 難易度別の閾値
        const maxSacrificePower = this.difficulty === 'hard' ? 4 : 2;
        if (weakestPower > maxSacrificePower) return null;

        // Normal: 手札3枚以上の時のみ / Hard: 2枚以上ならOK
        const minHand = this.difficulty === 'hard' ? 2 : 3;
        if (this.cpuHand.length < minHand) return null;

        // Hard: サクリファイスが有効かどうか評価
        if (this.difficulty === 'hard') {
            const bonus = Math.floor(weakestPower / 2);
            const remaining = this.cpuHand.filter((_, i) => i !== weakestIdx);
            const bestPower = Math.max(...remaining.map(c => c.power));
            // ボーナスを足しても大した差にならない場合はスキップ
            if (bestPower + bonus <= bestPower) return null;
        }

        const card = this.cpuHand[weakestIdx];
        const bonus = Math.floor(card.power / 2);
        this.cpuSacrificeBonus += bonus;
        this.cpuSacrificedCards.push({ ...card });
        this.cpuHand.splice(weakestIdx, 1);
        return card;
    }

    selectCpuCard() {
        const validMoves = this.cpuHand.map((card, index) => ({ card, index }));
        if (validMoves.length === 0) return 0;

        let bestScore = -Infinity;
        let bestIndex = 0;

        for (const { card, index } of validMoves) {
            let score = card.power;

            // 属性相性
            let advantageCount = 0;
            let disadvantageCount = 0;
            let reversalCount = 0;
            const opponentHand = this._playerHandSnapshot || this.playerHand;
            for (const playerCard of opponentHand) {
                if (this.hasAdvantage(card.element, playerCard.element)) advantageCount++;
                else if (this.hasAdvantage(playerCard.element, card.element)) disadvantageCount++;
                if (isReversalMatchup(card.element, playerCard.element)) reversalCount++;
            }
            score += (advantageCount - disadvantageCount) * 2;

            // 光⇔闇反転: 低パワーが有利なのでスコアを反転
            if (reversalCount > 0) {
                score += (10 - card.power) * reversalCount * 0.5;
            }

            // 終盤戦略
            const remainingRounds = this.maxRounds - this.currentRound + 1;
            const cpuNeedWins = this.winsNeeded - this.cpuWins;
            const playerNeedWins = this.winsNeeded - this.playerWins;

            if (cpuNeedWins >= remainingRounds) score += card.power * 0.5;
            else if (playerNeedWins >= remainingRounds) score -= card.power * 0.3;

            // 難易度別調整 [G4]
            if (this.difficulty === 'easy') {
                score = card.power * 0.3 + Math.random() * 10;
            } else if (this.difficulty === 'hard') {
                // チェイン考慮
                if (this.cpuElementChain.element === card.element) score += this.cpuElementChain.count * 1.5;
                score += Math.random() * 0.5;
            } else {
                score += Math.random() * 2;
            }

            if (score > bestScore) { bestScore = score; bestIndex = index; }
        }

        return bestIndex;
    }

    hasAdvantage(attacker, defender) {
        return ELEMENT_ADVANTAGE[attacker] === defender;
    }

    calculatePower(card, opponentCard, who) {
        let power = card.power;
        const breakdown = [{ label: '基本', value: card.power, color: 'white' }];
        const reversal = isReversalMatchup(card.element, opponentCard.element);

        // サクリファイスボーナス
        const sacrificeBonus = who === 'player' ? this.playerSacrificeBonus : this.cpuSacrificeBonus;
        if (sacrificeBonus > 0) {
            power += sacrificeBonus;
            breakdown.push({ label: 'サクリファイス', value: sacrificeBonus, color: '#ff79c6' });
        }

        // 属性有利/不利
        const hasAdv = this.hasAdvantage(card.element, opponentCard.element);

        // チェイン4連: 不利無効
        const chain = who === 'player' ? this.playerElementChain : this.cpuElementChain;
        let hasDisadv = this.hasAdvantage(opponentCard.element, card.element);
        if (chain.count >= 4 && hasDisadv) hasDisadv = false;

        if (hasAdv) {
            power += 3;
            breakdown.push({ label: '属性有利', value: 3, color: 'green' });
        }

        // チェインボーナス
        const chainBonus = this._getChainBonus(who);
        if (chainBonus > 0) {
            power += chainBonus;
            breakdown.push({ label: 'チェイン', value: chainBonus, color: '#4dabf7' });
        }

        return { power, breakdown, reversal };
    }

    // ===== ラウンド解決 =====
    resolveRound() {
        const pc = this.playerPlayedCard;
        const cc = this.cpuPlayedCard;

        const playerCalc = this.calculatePower(pc, cc, 'player');
        const cpuCalc = this.calculatePower(cc, pc, 'cpu');

        const playerPower = playerCalc.power;
        const cpuPower = cpuCalc.power;
        const reversal = playerCalc.reversal;

        // 結果判定
        let resultMessage = '';
        const playerAdv = this.hasAdvantage(pc.element, cc.element);
        const cpuAdv = this.hasAdvantage(cc.element, pc.element);
        let winner = null; // 'player', 'cpu', null

        let advantageInfo = '';
        if (playerAdv) advantageInfo = `（${ELEMENT_NAMES[pc.element]}→${ELEMENT_NAMES[cc.element]}で有利！）`;
        else if (cpuAdv) advantageInfo = `（${ELEMENT_NAMES[cc.element]}→${ELEMENT_NAMES[pc.element]}でCPU有利）`;
        else if (reversal) advantageInfo = `（光⇔闇 パワー反転！）`;

        if (reversal) {
            // パワー反転: 低い方が勝つ
            if (playerPower < cpuPower) {
                winner = 'player';
            } else if (cpuPower < playerPower) {
                winner = 'cpu';
            }
        } else {
            if (playerPower > cpuPower) {
                winner = 'player';
            } else if (cpuPower > playerPower) {
                winner = 'cpu';
            }
        }

        if (winner === 'player') {
            this.playerWins++;
            resultMessage = `あなたの勝ち！ ${advantageInfo}\n${playerPower} vs ${cpuPower}`;
            soundEngine.play('win');
        } else if (winner === 'cpu') {
            this.cpuWins++;
            resultMessage = `CPUの勝ち！ ${advantageInfo}\n${playerPower} vs ${cpuPower}`;
            soundEngine.play('lose');
        } else {
            this.draws++;
            resultMessage = `引き分け！ ${advantageInfo}\n${playerPower} vs ${cpuPower}`;
        }

        // ラウンド履歴
        this.roundHistory.push({
            round: this.currentRound,
            playerCard: { ...pc },
            cpuCard: { ...cc },
            playerPower,
            cpuPower,
            winner,
            reversal,
            playerBreakdown: playerCalc.breakdown,
            cpuBreakdown: cpuCalc.breakdown,
            playerSacrificed: [...this.playerSacrificedCards],
            cpuSacrificed: [...this.cpuSacrificedCards]
        });

        // サクリファイスボーナスをリセット
        this.playerSacrificeBonus = 0;
        this.cpuSacrificeBonus = 0;
        this.playerSacrificedCards = [];
        this.cpuSacrificedCards = [];

        this.phase = 'result';
        this.updateInfo();
        this.showMessage(resultMessage);

        // ===== アニメーション演出 =====
        this._animateClash(winner, pc, cc, playerPower, cpuPower);
        this._showPowerBreakdown(playerCalc.breakdown, cpuCalc.breakdown, reversal);
        this._renderTimeline();

        setTimeout(() => this.nextRound(), 2500);
    }

    // ===== カード衝突アニメーション [V1] =====
    _animateClash(winner, pc, cc, playerPower, cpuPower) {
        const playerPlayedEl = document.getElementById('player-played');
        const cpuPlayedEl = document.getElementById('cpu-played');
        const playerCard = playerPlayedEl.querySelector('.card');
        const cpuCard = cpuPlayedEl.querySelector('.card');

        if (!playerCard || !cpuCard) return;

        // スライドイン
        playerCard.classList.add('clash-slide-up');
        cpuCard.classList.add('clash-slide-down');

        soundEngine.play('clash');

        // バーストエフェクト
        setTimeout(() => {
            const field = document.querySelector('.field');
            const rect = field.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;

            // パーティクル
            const winElement = winner === 'player' ? pc.element : (winner === 'cpu' ? cc.element : pc.element);
            spawnParticles(winElement, cx, cy, 20, field);

            // 勝者グロー / 敗者グレースケール
            if (winner === 'player') {
                playerCard.classList.add('winner-glow');
                cpuCard.classList.add('loser-card');
            } else if (winner === 'cpu') {
                cpuCard.classList.add('winner-glow');
                playerCard.classList.add('loser-card');
            }

            // 画面シェイク [V1-1] - CPUが勝った（プレイヤーがダメージを受けた）ときのみ揺らす
            if (winner === 'cpu') {
                this._screenShake();
            }
            if (winner) {
                this._screenFlash(winElement);
            }

            // 属性ボーナス音
            const playerAdv = this.hasAdvantage(pc.element, cc.element);
            const cpuAdv = this.hasAdvantage(cc.element, pc.element);
            if ((winner === 'player' && playerAdv) || (winner === 'cpu' && cpuAdv)) {
                soundEngine.play('elementBonus');
            }
        }, 400);
    }

    // ===== 画面シェイク＆フラッシュ [V4 -> 1-1] =====
    _screenShake() {
        const container = document.querySelector('.container');
        container.classList.add('screen-shake');
        setTimeout(() => container.classList.remove('screen-shake'), 300);
    }

    _screenFlash(element) {
        const flash = document.createElement('div');
        flash.className = `screen-flash flash-${element}`;
        document.body.appendChild(flash);
        requestAnimationFrame(() => flash.classList.add('active'));
        setTimeout(() => { flash.classList.remove('active'); setTimeout(() => flash.remove(), 200); }, 200);
    }

    // ===== パワー計算内訳表示 [U2] =====
    _showPowerBreakdown(playerBreakdown, cpuBreakdown, reversal) {
        const existing = document.querySelectorAll('.power-breakdown, .reversal-banner');
        existing.forEach(e => e.remove());

        const playerEl = document.getElementById('player-played');
        const cpuEl = document.getElementById('cpu-played');

        this._renderBreakdown(playerBreakdown, playerEl, 'player');
        this._renderBreakdown(cpuBreakdown, cpuEl, 'cpu');

        // 光⇔闇 パワー反転バナー
        if (reversal) {
            const field = document.querySelector('.field');
            const banner = document.createElement('div');
            banner.className = 'reversal-banner';
            banner.innerHTML = '⟲ パワー反転<span class="reversal-sub">低い方が勝ち！</span>';
            field.appendChild(banner);
        }
    }

    _renderBreakdown(breakdown, parentEl, who) {
        const el = document.createElement('div');
        el.className = `power-breakdown breakdown-${who}`;
        let html = '';
        let total = 0;
        breakdown.forEach((item, i) => {
            const sign = item.value >= 0 ? (i === 0 ? '' : '+') : '';
            html += `<span class="breakdown-item" style="color:${item.color};animation-delay:${i * 0.15}s">[${item.label}: ${sign}${item.value}]</span> `;
            total += item.value;
        });
        html += `<span class="breakdown-total" style="animation-delay:${breakdown.length * 0.15}s">= ${total}</span>`;
        el.innerHTML = html;
        parentEl.appendChild(el);
    }

    // ===== ラウンド履歴タイムライン [U4 -> 1-4] =====
    _renderTimeline() {
        let timeline = document.querySelector('.round-timeline');
        if (!timeline) {
            timeline = document.createElement('div');
            timeline.className = 'round-timeline';
            document.querySelector('.game-panel').appendChild(timeline);
        }

        timeline.innerHTML = '<div class="timeline-label">履歴</div>';
        this.roundHistory.forEach((rh, i) => {
            const entry = document.createElement('div');
            entry.className = `timeline-entry timeline-entry-new`;
            entry.style.animationDelay = `${i * 0.05}s`;

            const indicator = rh.winner === 'player' ? '<span class="tl-win">✓</span>' :
                              rh.winner === 'cpu' ? '<span class="tl-lose">✗</span>' :
                              '<span class="tl-draw">−</span>';

            const reversalMark = rh.reversal ? '<div class="tl-reversal">⟲</div>' : '';
            const playerSac = rh.playerSacrificed && rh.playerSacrificed.length > 0 ? '<span class="tl-sacrifice">⚡</span>' : '';
            const cpuSac = rh.cpuSacrificed && rh.cpuSacrificed.length > 0 ? '<span class="tl-sacrifice">⚡</span>' : '';
            entry.innerHTML = `
                <div class="tl-round">R${rh.round}</div>
                <div class="tl-cards">
                    ${playerSac}<span class="tl-dot element-bg-${rh.playerCard.element}">${rh.playerCard.power}</span>
                    <span class="tl-vs">vs</span>
                    <span class="tl-dot element-bg-${rh.cpuCard.element}">${rh.cpuCard.power}</span>${cpuSac}
                </div>
                ${reversalMark}${indicator}
            `;
            timeline.appendChild(entry);
        });
    }

    nextRound() {
        // パワー内訳・反転バナーを消す
        document.querySelectorAll('.power-breakdown, .reversal-banner').forEach(e => e.remove());

        if (this.playerWins >= this.winsNeeded || this.cpuWins >= this.winsNeeded) {
            this.endGame();
            return;
        }

        // カードが尽きた場合も終了
        if (this.playerHand.length === 0 && this.playerDeck.length === 0) {
            this.endGame();
            return;
        }

        this.currentRound++;
        this.playerPlayedCard = null;
        this.cpuPlayedCard = null;
        this._cpuCardRevealed = false;
        this._playerCardRevealed = false;

        if (this.playerDeck.length > 0) this.playerHand.push(this.playerDeck.pop());
        if (this.cpuDeck.length > 0) this.cpuHand.push(this.cpuDeck.pop());

        this.phase = 'select';
        this.renderBoard();
        this.updateInfo();
        this.showMessage('カードを選んでください');
        this._updateRoundDisplay();
    }

    endGame() {
        this.gameOver = true;
        this.phase = 'gameover';

        let resultText, resultClass;
        if (this.playerWins > this.cpuWins) {
            resultText = 'YOU WIN!';
            resultClass = 'result-win';
        } else if (this.cpuWins > this.playerWins) {
            resultText = 'YOU LOSE...';
            resultClass = 'result-lose';
        } else {
            resultText = 'DRAW';
            resultClass = 'result-draw';
        }

        // メッセージ欄も更新
        const messageElement = document.getElementById('message');
        messageElement.textContent = `ゲーム終了！ (${this.playerWins} - ${this.cpuWins})`;
        messageElement.className = 'message winner';

        // 最大チェイン計算
        let maxChain = 0;
        let tempChains = {};
        for (const rh of this.roundHistory) {
            const el = rh.playerCard.element;
            if (!tempChains[el]) tempChains[el] = 0;
            // 直前のカードと同じ属性か確認
            const idx = this.roundHistory.indexOf(rh);
            if (idx > 0 && this.roundHistory[idx - 1].playerCard.element === el) {
                tempChains[el]++;
            } else {
                tempChains[el] = 1;
            }
            if (tempChains[el] > maxChain) maxChain = tempChains[el];
        }

        // リザルトオーバーレイ生成
        const overlay = document.createElement('div');
        overlay.className = 'result-overlay';
        overlay.innerHTML = `
            <div class="result-content">
                <h2 class="${resultClass}">${resultText}</h2>
                <div class="result-score">${this.playerWins} - ${this.cpuWins}</div>
                <div class="result-stats">
                    <div class="result-stat">
                        <div class="result-stat-label">ラウンド数</div>
                        <div class="result-stat-value">${this.currentRound}</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-label">引き分け</div>
                        <div class="result-stat-value">${this.draws}</div>
                    </div>
                    <div class="result-stat">
                        <div class="result-stat-label">最大チェイン</div>
                        <div class="result-stat-value">${maxChain}</div>
                    </div>
                </div>
                <button class="result-btn" onclick="document.querySelector('.result-overlay')?.remove(); game.init();">もう一度プレイ</button>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    updateInfo() {
        document.getElementById('current-round').textContent = this.currentRound;

        // ドット形式のスコア表示
        const playerDots = document.querySelectorAll('#player-win-dots .win-dot');
        const cpuDots = document.querySelectorAll('#cpu-win-dots .win-dot');
        playerDots.forEach((dot, i) => {
            dot.classList.toggle('filled', i < this.playerWins);
        });
        cpuDots.forEach((dot, i) => {
            dot.classList.toggle('filled', i < this.cpuWins);
        });
    }

    _updateRoundDisplay() {
        const rd = document.getElementById('current-round');
        if (rd) {
            rd.textContent = this.currentRound;
        }
    }

    showMessage(msg) {
        const messageElement = document.getElementById('message');
        messageElement.textContent = msg;
        messageElement.className = 'message';
    }

    // ===== Agent-Browser API =====
    getLastRoundResult() {
        if (this.roundHistory.length === 0) return null;
        return this.roundHistory[this.roundHistory.length - 1];
    }

    getUsedCards() {
        return {
            player: this.roundHistory.map(h => ({ ...h.playerCard })),
            cpu: this.roundHistory.map(h => ({ ...h.cpuCard }))
        };
    }

    getValidMoves() {
        if (this.phase !== 'select' || this.gameOver) return [];

        const canSacrifice = this.playerHand.length > 1;
        return this.playerHand.map((card, index) => ({
            index,
            card: {
                name: card.name,
                element: card.element,
                power: card.power
            },
            action: 'play',
            chainBonus: this._getChainBonus('player'),
            isChainElement: this.playerElementChain.element === card.element,
            reversalPossible: card.element === 'light' || card.element === 'dark',
            sacrificeBonus: this.playerSacrificeBonus,
            canSacrifice,
            sacrificeValue: Math.floor(card.power / 2)
        }));
    }

    getGameState() {
        return {
            phase: this.phase,
            round: this.currentRound,
            maxRounds: this.maxRounds,
            winsNeeded: this.winsNeeded,
            playerWins: this.playerWins,
            cpuWins: this.cpuWins,
            draws: this.draws,
            playerHand: this.playerHand.map(c => ({ ...c })),
            cpuHandCount: this.cpuHand.length,
            cpuHandElements: this.cpuHand.map(c => c.element),
            playerDeckCount: this.playerDeck.length,
            cpuDeckCount: this.cpuDeck.length,
            playerPlayedCard: this.playerPlayedCard,
            cpuPlayedCard: this.cpuPlayedCard,
            gameOver: this.gameOver,
            difficulty: this.difficulty,
            playerChain: { ...this.playerElementChain },
            cpuChain: { ...this.cpuElementChain },
            roundHistory: this.roundHistory,
            playerSacrificeBonus: this.playerSacrificeBonus,
            playerSacrificedCards: [...this.playerSacrificedCards]
        };
    }

    isReady() {
        return this.phase === 'select' && !this.gameOver;
    }
}
