// カードバトルゲーム - UI・モーダル・イベントリスナー

// ===== カード一覧モーダル =====
function showCardListModal() {
    const existing = document.querySelector('.collection-modal');
    if (existing) { existing.remove(); return; }

    const allCards = createCardPool();
    const modal = document.createElement('div');
    modal.className = 'collection-modal';
    modal.innerHTML = `
        <div class="collection-content">
            <h3>カード一覧 (${allCards.length}枚)</h3>
            <button class="modal-close">&times;</button>
            <div class="collection-grid">
                ${allCards.map((c, i) => {
                    return `<div class="collection-card element-${c.element}" data-card-index="${i}">
                        <div class="col-element">${ELEMENT_NAMES[c.element]}</div>
                        <div class="col-power">${c.power}</div>
                        <div class="col-sacrifice">⚡${Math.floor(c.power / 2)}</div>
                    </div>`;
                }).join('')}
            </div>
            <div class="card-detail-panel" style="display:none"></div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // カードクリックで詳細表示
    modal.querySelectorAll('.collection-card').forEach(cardEl => {
        cardEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(cardEl.dataset.cardIndex);
            const card = allCards[idx];
            const detailPanel = modal.querySelector('.card-detail-panel');
            detailPanel.innerHTML = `
                <div class="detail-header element-${card.element}">
                    <span class="detail-element">${ELEMENT_NAMES[card.element]}</span>
                    <span class="detail-power">${card.power}</span>
                </div>
            `;
            detailPanel.style.display = 'block';

            // 選択状態のハイライト
            modal.querySelectorAll('.collection-card').forEach(c => c.classList.remove('card-detail-active'));
            cardEl.classList.add('card-detail-active');
        });
    });
}

// ===== 初期化 =====
const game = new CardBattleGame();

// UIコントロール初期化
document.addEventListener('DOMContentLoaded', () => {
    // 難易度選択 [G4]
    const diffButtons = document.getElementById('difficulty-buttons');
    if (diffButtons) {
        // 初期状態を反映
        diffButtons.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.difficulty === game.difficulty);
        });
        diffButtons.addEventListener('click', (e) => {
            const btn = e.target.closest('.difficulty-btn');
            if (!btn) return;
            diffButtons.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            game.difficulty = btn.dataset.difficulty;
            game._saveDifficulty();
        });
    }

    // ミュートボタン [V3]
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            const muted = soundEngine.toggle();
            muteBtn.textContent = muted ? '🔇' : '🔊';
        });
    }

    // カード一覧ボタン
    document.getElementById('collection-btn')?.addEventListener('click', showCardListModal);
});

// リセットボタン
document.getElementById('reset-btn').addEventListener('click', () => {
    document.querySelector('.result-overlay')?.remove();
    game.init();
});
