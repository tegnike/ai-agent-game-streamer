// カードバトルゲーム - ユーティリティ関数

// ===== パーティクルエンジン [V2] =====
function spawnParticles(element, x, y, count, container) {
    const colors = {
        fire: ['#ff6b6b', '#ff8c42', '#ffd700'],
        water: ['#4dabf7', '#74c0fc', '#a5d8ff'],
        grass: ['#69db7c', '#8ce99a', '#b2f2bb'],
        light: ['#fab005', '#ffd43b', '#fff3bf'],
        dark: ['#845ef7', '#9775fa', '#b197fc'],
        neutral: ['#adb5bd', '#ced4da', '#dee2e6']
    };
    const palette = colors[element] || colors.neutral;
    const parent = container || document.querySelector('.container');
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = `particle particle-${element}`;
        const dx = (Math.random() - 0.5) * 200;
        const dy = (Math.random() - 0.5) * 200;
        const delay = Math.random() * 0.2;
        const size = 3 + Math.random() * 6;
        p.style.cssText = `
            left:${x}px;top:${y}px;
            width:${size}px;height:${size}px;
            background:${palette[Math.floor(Math.random() * palette.length)]};
            --dx:${dx}px;--dy:${dy}px;--delay:${delay}s;
            animation-delay:${delay}s;
        `;
        parent.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
    }
}

// ===== カードプール生成 =====
function createCardPool() {
    const pool = [];
    const elements = [ELEMENTS.FIRE, ELEMENTS.WATER, ELEMENTS.GRASS, ELEMENTS.LIGHT, ELEMENTS.DARK];
    const powers = [2, 4, 6, 8, 10];

    for (const element of elements) {
        for (const power of powers) {
            pool.push({
                element,
                power,
                name: `${ELEMENT_NAMES[element]}${power}`
            });
        }
    }
    return pool;
}

function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

