// カードバトルゲーム - 定数・定義

// ===== 属性定義 =====
const ELEMENTS = {
    FIRE: 'fire',
    WATER: 'water',
    GRASS: 'grass',
    LIGHT: 'light',
    DARK: 'dark',
    NEUTRAL: 'neutral'
};

const ELEMENT_ADVANTAGE = {
    [ELEMENTS.FIRE]: ELEMENTS.GRASS,
    [ELEMENTS.GRASS]: ELEMENTS.WATER,
    [ELEMENTS.WATER]: ELEMENTS.FIRE
};

// 光⇔闇: パワー反転（低い方が勝つ）
function isReversalMatchup(element1, element2) {
    return (element1 === ELEMENTS.LIGHT && element2 === ELEMENTS.DARK) ||
           (element1 === ELEMENTS.DARK && element2 === ELEMENTS.LIGHT);
}

const ELEMENT_NAMES = {
    [ELEMENTS.FIRE]: '火',
    [ELEMENTS.WATER]: '水',
    [ELEMENTS.GRASS]: '草',
    [ELEMENTS.LIGHT]: '光',
    [ELEMENTS.DARK]: '闇',
    [ELEMENTS.NEUTRAL]: '無'
};

const ELEMENT_COLORS = {
    fire: '#ff6b6b',
    water: '#4dabf7',
    grass: '#69db7c',
    light: '#fab005',
    dark: '#845ef7',
    neutral: '#adb5bd'
};

const ELEMENT_EMOJI = {
    fire: '🔥', water: '💧', grass: '🌿', light: '✨', dark: '🌑', neutral: '⚪'
};

const ELEMENT_IMAGE = {
    fire: 'images/fire.png',
    water: 'images/water.png',
    grass: 'images/grass.png',
    light: 'images/light.png',
    dark: 'images/dark.png',
    neutral: null
};


