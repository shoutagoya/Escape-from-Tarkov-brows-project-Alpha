// ホーム画面のJavaScript

// DOM要素の取得
const deployButton = document.getElementById('deployButton');
const characterButton = document.getElementById('characterButton');
const traderButton = document.getElementById('traderButton');
const hideoutButton = document.getElementById('hideoutButton');
const questButton = document.getElementById('questButton');
const settingsButton = document.getElementById('settingsButton');
const devMenuButton = document.getElementById('devMenuButton');
const logoutButton = document.getElementById('logoutButton');
const usernameDisplay = document.getElementById('usernameDisplay');
const backgroundLayer = document.getElementById('backgroundLayer');
const timeOfDayModal = document.getElementById('timeOfDayModal');
const timeModalCloseButton = document.getElementById('timeModalCloseButton');
const timeModalCancelButton = document.getElementById('timeModalCancelButton');
const timeModeButtons = document.querySelectorAll('.time-mode-button');

// 設定モーダル要素
const settingsModal = document.getElementById('settingsModal');
const settingsCloseButton = document.getElementById('settingsCloseButton');
const settingsSaveButton = document.getElementById('settingsSaveButton');
const settingsResetButton = document.getElementById('settingsResetButton');
const resolutionScaleSlider = document.getElementById('resolutionScaleSlider');
const resolutionScaleValue = document.getElementById('resolutionScaleValue');
const textureQualitySelect = document.getElementById('textureQualitySelect');
const shadowQualitySelect = document.getElementById('shadowQualitySelect');
const drawDistanceSelect = document.getElementById('drawDistanceSelect');
const vegetationDensitySelect = document.getElementById('vegetationDensitySelect');
const fogDensitySelect = document.getElementById('fogDensitySelect');

// トレーダーモーダル要素
const traderModal = document.getElementById('traderModal');
const traderCloseButton = document.getElementById('traderCloseButton');
const traderListElement = document.getElementById('traderList');
const traderInventoryContainer = document.getElementById('traderInventoryItems');
const traderPlayerItemsContainer = document.getElementById('traderPlayerItems');
const rarityVisualizationContainer = document.getElementById('rarityVisualization');
const traderCurrencyValue = document.getElementById('traderCurrencyValue');
const traderPanelTitle = document.getElementById('traderPanelTitle');
const traderPanelDescription = document.getElementById('traderPanelDescription');
const playerLevelLabel = document.getElementById('playerLevelLabel');
const playerXpSummary = document.getElementById('playerXpSummary');
const homePlayerLevel = document.getElementById('homePlayerLevel');
const homePlayerXpFill = document.getElementById('homePlayerXpFill');
const homePlayerXpText = document.getElementById('homePlayerXpText');
const traderTabButtons = document.querySelectorAll('.trader-tab-button');
const traderBuyContent = document.getElementById('traderBuyContent');
const traderSellContent = document.getElementById('traderSellContent');
const RARITY_CATEGORY_LABELS = {
    medical: '医療品',
    weapon: '武器',
    backpack: 'バックパック',
    rig: 'リグ',
    magazine: 'マガジン',
    ammo: '弾薬',
    flare: 'フレア',
    ticket: 'ハイドアウト'
};
const traderState = {
    data: null,
    activeTraderId: null,
    activeTab: 'buy',
    loading: false,
    playerProgress: null,
    traderLevels: {}
};

// クエスト要素
const questModal = document.getElementById('questModal');
const questCloseButton = document.getElementById('questCloseButton');
const activeQuestList = document.getElementById('activeQuestList');
const completedQuestList = document.getElementById('completedQuestList');
const lockedQuestList = document.getElementById('lockedQuestList');
const questState = {
    tasks: [],
    loading: false
};

let homePlayerProgress = null;

// DEVメニュー表示用の変数

// ビデオ設定
const VIDEO_SETTINGS_KEY = 'videoSettings';
const VIDEO_SETTING_DEFAULTS = {
    resolutionScale: 1.0,
    textureQuality: 'high',
    shadowQuality: 'high',
    drawDistance: 'medium',
    vegetationDensity: 'medium',
    fogDensity: 'medium'
};
const TIME_OF_DAY_KEY = 'timeOfDay';

// 背景画像の読み込み
function loadBackgroundImage() {
    const savedBg = localStorage.getItem('homeBackgroundImage');
    if (savedBg) {
        backgroundLayer.style.backgroundImage = `url(${savedBg})`;
        backgroundLayer.style.backgroundSize = 'cover';
        backgroundLayer.style.backgroundPosition = 'center';
        backgroundLayer.style.backgroundRepeat = 'no-repeat';
    } else {
        // デフォルトの背景画像を設定
        const defaultBg = '/pic/background/home.png';
        backgroundLayer.style.backgroundImage = `url(${defaultBg})`;
        backgroundLayer.style.backgroundSize = 'cover';
        backgroundLayer.style.backgroundPosition = 'center';
        backgroundLayer.style.backgroundRepeat = 'no-repeat';
    }
}

// ユーザー名の表示
function loadUserInfo() {
    // セッションからユーザー名を取得（サーバーサイドで設定されている場合）
    // ここでは一時的にlocalStorageから取得するか、サーバーから取得
    // 実際の実装では、サーバーからユーザー情報を取得するAPIを呼び出す
    fetch('/api/user')
        .then(response => response.json())
        .then(data => {
            if (data.username) {
                usernameDisplay.textContent = data.username;
                // ユーザー名が「Dev」の場合、開発者メニューを表示
                if (data.username === 'Dev' && devMenuButton) {
                    devMenuButton.classList.remove('hidden');
                }
            }
        })
        .catch(() => {
            // エラー時はデフォルト表示
            usernameDisplay.textContent = 'ゲスト';
        });
}

async function fetchHomePlayerProgress() {
    try {
        const response = await fetch('/api/player/progress');
        const data = await response.json();
        if (!data.success) return;
        homePlayerProgress = data.player_progress || homePlayerProgress;
        if (data.trader_levels) {
            traderState.traderLevels = data.trader_levels;
        }
        updateHomePlayerOverview(homePlayerProgress);
    } catch (error) {
        console.error('Failed to fetch player progress', error);
    }
}

function getSavedVideoSettings() {
    try {
        const raw = localStorage.getItem(VIDEO_SETTINGS_KEY);
        if (!raw) return { ...VIDEO_SETTING_DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...VIDEO_SETTING_DEFAULTS, ...parsed };
    } catch (error) {
        console.warn('ビデオ設定の読み込みに失敗しました:', error);
        return { ...VIDEO_SETTING_DEFAULTS };
    }
}

function saveVideoSettings(settings) {
    localStorage.setItem(VIDEO_SETTINGS_KEY, JSON.stringify(settings));
}

function updateResolutionScaleDisplay(value) {
    if (resolutionScaleValue) {
        resolutionScaleValue.textContent = `${Math.round(value * 100)}%`;
    }
}

function applyVideoSettingsToInputs(settings) {
    if (!settingsModal) return;
    if (resolutionScaleSlider) {
        resolutionScaleSlider.value = settings.resolutionScale;
        updateResolutionScaleDisplay(settings.resolutionScale);
    }
    if (textureQualitySelect) textureQualitySelect.value = settings.textureQuality;
    if (shadowQualitySelect) shadowQualitySelect.value = settings.shadowQuality;
    if (drawDistanceSelect) drawDistanceSelect.value = settings.drawDistance;
    if (vegetationDensitySelect) vegetationDensitySelect.value = settings.vegetationDensity;
    if (fogDensitySelect) fogDensitySelect.value = settings.fogDensity;
}

function gatherVideoSettingsFromInputs() {
    return {
        resolutionScale: resolutionScaleSlider ? parseFloat(resolutionScaleSlider.value) : VIDEO_SETTING_DEFAULTS.resolutionScale,
        textureQuality: textureQualitySelect ? textureQualitySelect.value : VIDEO_SETTING_DEFAULTS.textureQuality,
        shadowQuality: shadowQualitySelect ? shadowQualitySelect.value : VIDEO_SETTING_DEFAULTS.shadowQuality,
        drawDistance: drawDistanceSelect ? drawDistanceSelect.value : VIDEO_SETTING_DEFAULTS.drawDistance,
        vegetationDensity: vegetationDensitySelect ? vegetationDensitySelect.value : VIDEO_SETTING_DEFAULTS.vegetationDensity,
        fogDensity: fogDensitySelect ? fogDensitySelect.value : VIDEO_SETTING_DEFAULTS.fogDensity
    };
}

function getSavedTimeOfDay() {
    const saved = localStorage.getItem(TIME_OF_DAY_KEY);
    return saved === 'night' ? 'night' : 'day';
}

function openSettingsModal() {
    const settings = getSavedVideoSettings();
    applyVideoSettingsToInputs(settings);
    if (settingsModal) {
        settingsModal.classList.remove('hidden');
    }
}

function closeSettingsModal() {
    if (settingsModal) {
        settingsModal.classList.add('hidden');
    }
}

function openTimeOfDayModal() {
    if (!timeOfDayModal) {
        window.location.href = '/deploy';
        return;
    }
    const current = getSavedTimeOfDay();
    timeModeButtons.forEach(button => {
        if (button.dataset.timeMode === current) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    timeOfDayModal.classList.remove('hidden');
}

function closeTimeOfDayModal() {
    if (timeOfDayModal) {
        timeOfDayModal.classList.add('hidden');
    }
}

function handleTimeOfDaySelection(mode) {
    localStorage.setItem(TIME_OF_DAY_KEY, mode);
    closeTimeOfDayModal();
    window.location.href = '/deploy';
}

// ボタンイベント（後で実装）
deployButton.addEventListener('click', (e) => {
    e.preventDefault();
    openTimeOfDayModal();
});

characterButton.addEventListener('click', () => {
    window.location.href = '/character';
});

traderButton.addEventListener('click', () => {
    openTraderModal();
});

hideoutButton.addEventListener('click', () => {
    // ハイドアウトボタン - 後で実装
    console.log('ハイドアウトボタンがクリックされました');
    // 例: window.location.href = '/hideout';
});

if (questButton) {
    questButton.addEventListener('click', () => {
        openQuestModal();
    });
    }
    
// 設定ボタンのクリック
settingsButton.addEventListener('click', () => {
    openSettingsModal();
});

if (settingsCloseButton) {
    settingsCloseButton.addEventListener('click', () => {
        closeSettingsModal();
    });
}

if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });
}

if (timeModeButtons.length) {
    timeModeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.timeMode || 'day';
            handleTimeOfDaySelection(mode);
        });
    });
}

if (timeModalCloseButton) {
    timeModalCloseButton.addEventListener('click', () => {
        closeTimeOfDayModal();
    });
}

if (timeModalCancelButton) {
    timeModalCancelButton.addEventListener('click', () => {
        closeTimeOfDayModal();
    });
}

if (timeOfDayModal) {
    timeOfDayModal.addEventListener('click', (e) => {
        if (e.target === timeOfDayModal) {
            closeTimeOfDayModal();
        }
    });
}

if (settingsSaveButton) {
    settingsSaveButton.addEventListener('click', () => {
        const settings = gatherVideoSettingsFromInputs();
        saveVideoSettings(settings);
        closeSettingsModal();
    });
}

if (settingsResetButton) {
    settingsResetButton.addEventListener('click', () => {
        applyVideoSettingsToInputs({ ...VIDEO_SETTING_DEFAULTS });
    });
}

if (resolutionScaleSlider) {
    resolutionScaleSlider.addEventListener('input', (event) => {
        const value = parseFloat(event.target.value);
        updateResolutionScaleDisplay(value);
    });
}

function formatCurrency(value) {
    const number = Number(value || 0);
    return number.toLocaleString('ja-JP');
}

function openTraderModal() {
    if (!traderModal) return;
    traderModal.classList.remove('hidden');
    traderState.activeTab = 'buy';
    updateTraderTabVisibility();
    fetchTraderData();
}

function closeTraderModal() {
    if (!traderModal) return;
    traderModal.classList.add('hidden');
}

function openQuestModal() {
    if (!questModal) return;
    questModal.classList.remove('hidden');
    fetchQuestTasks();
}

function closeQuestModal() {
    if (!questModal) return;
    questModal.classList.add('hidden');
}

function setTraderTab(tab) {
    if (!tab || !['buy', 'sell'].includes(tab)) {
        tab = 'buy';
    }
    traderState.activeTab = tab;
    updateTraderTabVisibility();
}

function updateTraderTabVisibility() {
    traderTabButtons.forEach((button) => {
        if (!button.dataset.tab) return;
        button.classList.toggle('active', button.dataset.tab === traderState.activeTab);
    });
    if (traderBuyContent) {
        traderBuyContent.classList.toggle('hidden', traderState.activeTab !== 'buy');
    }
    if (traderSellContent) {
        traderSellContent.classList.toggle('hidden', traderState.activeTab !== 'sell');
    }
}

// 武器データ（character.jsからコピー）
const WEAPON_DATA = {
    'M4A1': { fireRate: 800, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 84, horizontalRecoil: 243, moa: 1.82 },
    'AK-74M': { fireRate: 650, ammoType: '5.45x39mm BP', fireModes: ['semi', 'full'], verticalRecoil: 84, horizontalRecoil: 226, moa: 1.89 },
    'Ash-12': { fireRate: 650, ammoType: '12.7x55mm PS12B', fireModes: ['semi', 'full'], verticalRecoil: 106, horizontalRecoil: 353, moa: 1.63 },
    'AS VAL': { fireRate: 900, ammoType: '9x39mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 52, horizontalRecoil: 176, moa: 3.44 },
    'M16A2': { fireRate: 800, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'burst'], verticalRecoil: 75, horizontalRecoil: 218, moa: 1.24 },
    'Custom Guns NL545': { fireRate: 800, ammoType: '5.45x39mm BP', fireModes: ['semi', 'full'], verticalRecoil: 63, horizontalRecoil: 184, moa: 1.30 },
    'DS Arms SA-58 7.62x51 assault rifle': { fireRate: 700, ammoType: '7.62x51mm M80', fireModes: ['semi', 'full'], verticalRecoil: 101, horizontalRecoil: 245, moa: 2.8 },
    'Desert Tech MDR 5.56x45 assault rifle': { fireRate: 650, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 62, horizontalRecoil: 203, moa: 1.43 },
    'Desert Tech MDR 7.62x51 assault rifle': { fireRate: 650, ammoType: '7.62x51mm M80', fireModes: ['semi', 'full'], verticalRecoil: 84, horizontalRecoil: 261, moa: 1.46 },
    'FN SCAR-H 7.62x51 assault rifle LB': { fireRate: 600, ammoType: '7.62x51mm M80', fireModes: ['semi', 'full'], verticalRecoil: 103, horizontalRecoil: 251, moa: 1.27 },
    'FN SCAR-L 5.56x45 assault rifle LB': { fireRate: 650, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 81, horizontalRecoil: 273, moa: 1.56 },
    'HK 416A5 5.56x45 assault rifle': { fireRate: 850, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 85, horizontalRecoil: 243, moa: 1.93 },
    'HK G36 5.56x45 assault rifle': { fireRate: 750, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'burst', 'full'], verticalRecoil: 74, horizontalRecoil: 228, moa: 1.73 },
    'Kalashnikov AK-101 5.56x45 assault rifle': { fireRate: 650, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 78, horizontalRecoil: 213, moa: 1.72 },
    'Kalashnikov AKM 7.62x39 assault rifle': { fireRate: 600, ammoType: '7.62x39mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 118, horizontalRecoil: 294, moa: 2.3 },
    'SIG MCX SPEAR 6.8x51 assault rifle': { fireRate: 800, ammoType: '6.8x51mm SIG FMJ', fireModes: ['semi', 'full'], verticalRecoil: 65, horizontalRecoil: 185, moa: 1.43 },
    'Steyr AUG A1 5.56x45 assault rifle': { fireRate: 715, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 45, horizontalRecoil: 178, moa: 1.24 },
    'Aklys Defense Velociraptor .300 Blackout assault rifle': { fireRate: 600, ammoType: '.300 blackout BCP FMJ', fireModes: ['semi', 'full'], verticalRecoil: 83, horizontalRecoil: 223, moa: 2.23 },
    'CMMG Mk47 Mutant 7.62x39 assault rifle': { fireRate: 650, ammoType: '7.62x39mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 109, horizontalRecoil: 205, moa: 2.48 },
    'SIG MCX .300 Blackout assault rifle': { fireRate: 800, ammoType: '.300 blackout BCP FMJ', fireModes: ['semi', 'full'], verticalRecoil: 81, horizontalRecoil: 225, moa: 2.75 },
    'Rifle Dynamics RD-704 7.62x39 assault rifle': { fireRate: 600, ammoType: '7.62x39mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 102, horizontalRecoil: 247, moa: 2.03 },
    'Radian Weapons Model 1 FA 5.56x45 assault rifle': { fireRate: 800, ammoType: '5.56x45mm FMJ', fireModes: ['semi', 'full'], verticalRecoil: 62, horizontalRecoil: 186, moa: 0.99 }
};

// マガジンデータ（簡易版）
const MAGAZINE_DATA = {
    '5.56x45mm standard 30連マガジン': { capacity: 30, caliber: '5.56x45mm' },
    '5.45x39mm standard 30連マガジン': { capacity: 30, caliber: '5.45x39mm' },
    'Ash-12用 10連マガジン': { capacity: 10, caliber: '12.7x55mm' },
    'Ash-12用 20連マガジン': { capacity: 20, caliber: '12.7x55mm' },
    'AS VAL用15連マガジン': { capacity: 15, caliber: '9x39mm' },
    'AS VAL用 30連マガジン': { capacity: 30, caliber: '9x39mm' },
    '5.56x45mm over 100連マガジン': { capacity: 100, caliber: '5.56x45mm' },
    '7.61x51mm standard 30連マガジン': { capacity: 30, caliber: '7.62x51mm' },
    '7.61x51mm short 20連マガジン': { capacity: 20, caliber: '7.62x51mm' },
    '7.62x39mm standard 30連マガジン': { capacity: 30, caliber: '7.62x39mm' },
    '7.62x39mm short 15連マガジン': { capacity: 15, caliber: '7.62x39mm' },
    '6.8x51mm standard 30連マガジン': { capacity: 30, caliber: '6.8x51mm' },
    '6.8x51mm short 15連マガジン': { capacity: 15, caliber: '6.8x51mm' },
    '.300 blackout standard 30連マガジン': { capacity: 30, caliber: '.300 blackout' }
};

function createItemTooltip(stats) {
    if (!stats) return null;
    const tooltip = document.createElement('div');
    tooltip.className = 'item-tooltip';
    const parts = [];
    if (stats.type === 'medical') {
        parts.push('<div class="tooltip-title">医療品</div>');
        if (stats.durability !== undefined) {
            parts.push(`<div class="tooltip-line"><span>耐久値</span>${stats.durability}</div>`);
        }
        if (stats.effects?.length) {
            const effects = stats.effects.map(effect => `<li>${effect}</li>`).join('');
            parts.push('<div class="tooltip-subtitle">効果</div>');
            parts.push(`<ul>${effects}</ul>`);
        }
    } else if (stats.type === 'ammo') {
        parts.push('<div class="tooltip-title">弾薬</div>');
        if (stats.damage !== undefined) {
            parts.push(`<div class="tooltip-line"><span>ダメージ</span>${stats.damage}</div>`);
        }
        if (stats.penetration !== undefined) {
            parts.push(`<div class="tooltip-line"><span>貫通力</span>${stats.penetration}</div>`);
        }
    } else if (stats.type === 'weapon') {
        // 武器名からデータを取得
        const weaponName = stats.name || stats.item_name;
        const weaponData = WEAPON_DATA[weaponName];
        if (weaponData) {
            parts.push('<div class="tooltip-title">武器</div>');
            if (weaponData.fireRate !== undefined) {
                parts.push(`<div class="tooltip-line"><span>発射速度</span>${weaponData.fireRate} rpm</div>`);
            }
            if (weaponData.ammoType !== undefined) {
                parts.push(`<div class="tooltip-line"><span>使用弾薬</span>${weaponData.ammoType}</div>`);
            }
            if (weaponData.fireModes?.length) {
                const fireModeNames = weaponData.fireModes.map(mode => {
                    if (mode === 'semi') return 'セミオート';
                    if (mode === 'full') return 'フルオート';
                    if (mode === 'burst') return 'バースト';
                    return mode;
                }).join(', ');
                parts.push(`<div class="tooltip-line"><span>発射モード</span>${fireModeNames}</div>`);
            }
            if (weaponData.verticalRecoil !== undefined) {
                parts.push(`<div class="tooltip-line"><span>垂直反動</span>${weaponData.verticalRecoil}</div>`);
            }
            if (weaponData.horizontalRecoil !== undefined) {
                parts.push(`<div class="tooltip-line"><span>水平反動</span>${weaponData.horizontalRecoil}</div>`);
            }
            if (weaponData.moa !== undefined) {
                parts.push(`<div class="tooltip-line"><span>精度 (MOA)</span>${weaponData.moa}</div>`);
            }
        }
    } else if (stats.type === 'magazine') {
        // マガジン名からデータを取得
        const magazineName = stats.name || stats.item_name;
        const magazineData = MAGAZINE_DATA[magazineName];
        if (magazineData) {
            parts.push('<div class="tooltip-title">マガジン</div>');
            if (magazineData.capacity !== undefined) {
                parts.push(`<div class="tooltip-line"><span>容量</span>${magazineData.capacity}発</div>`);
            }
            if (magazineData.caliber !== undefined) {
                parts.push(`<div class="tooltip-line"><span>対応弾種</span>${magazineData.caliber}</div>`);
            }
        }
    } else if (stats.type === 'armor') {
        parts.push('<div class="tooltip-title">ボディーアーマー</div>');
        if (stats.durability !== undefined) {
            parts.push(`<div class="tooltip-line"><span>耐久値</span>${stats.durability}</div>`);
        }
        if (stats.armor_class !== undefined) {
            parts.push(`<div class="tooltip-line"><span>防御力</span>${stats.armor_class}</div>`);
        }
        if (stats.movement_speed_debuff !== undefined && stats.movement_speed_debuff !== 0) {
            const debuffPercent = (Math.abs(stats.movement_speed_debuff) * 100).toFixed(1);
            parts.push(`<div class="tooltip-line"><span>移動速度デバフ</span>-${debuffPercent}%</div>`);
        }
    } else if (stats.type === 'helmet') {
        parts.push('<div class="tooltip-title">ヘルメット</div>');
        if (stats.durability !== undefined) {
            parts.push(`<div class="tooltip-line"><span>耐久値</span>${stats.durability}</div>`);
        }
        if (stats.armor_class !== undefined) {
            parts.push(`<div class="tooltip-line"><span>防御力</span>${stats.armor_class}</div>`);
        }
        if (stats.movement_speed_debuff !== undefined && stats.movement_speed_debuff !== 0) {
            const debuffPercent = (Math.abs(stats.movement_speed_debuff) * 100).toFixed(1);
            parts.push(`<div class="tooltip-line"><span>移動速度デバフ</span>-${debuffPercent}%</div>`);
        }
    }
    if (!parts.length) return null;
    tooltip.innerHTML = parts.join('');
    return tooltip;
}

async function fetchTraderData() {
    if (traderState.loading) return;
    traderState.loading = true;
    try {
        const response = await fetch('/api/traders/data');
        const data = await response.json();
        if (!data.success) {
            alert(data.message || 'トレーダー情報の取得に失敗しました。');
            return;
        }
        traderState.data = data;
        traderState.playerProgress = data.player_progress || traderState.playerProgress;
        traderState.traderLevels = data.trader_levels || traderState.traderLevels || {};
        if (!traderState.activeTraderId && data.traders?.length) {
            traderState.activeTraderId = data.traders[0].id;
        }
        renderTraderUI();
    } catch (error) {
        console.error('Failed to load trader data', error);
        alert('トレーダー情報の取得に失敗しました。');
    } finally {
        traderState.loading = false;
    }
}

function renderTraderUI() {
    if (!traderState.data) return;
    if (traderCurrencyValue) {
        traderCurrencyValue.textContent = formatCurrency(traderState.data.currency || 0);
    }
    renderPlayerProgress();
    renderTraderList();
    renderTraderInventory();
    renderPlayerInventory();
    renderRarityVisualization();
    updateTraderTabVisibility();
}

function renderPlayerProgress() {
    if (!traderState.playerProgress) return;
    const progress = traderState.playerProgress;
    if (playerLevelLabel) {
        playerLevelLabel.textContent = `Lv.${progress.level || 1}`;
    }
    if (playerXpSummary) {
        if (progress.nextThreshold && progress.nextThreshold > (progress.xp || 0)) {
            playerXpSummary.textContent = `${formatCurrency(progress.xp || 0)} / ${formatCurrency(progress.nextThreshold)} XP`;
        } else {
            playerXpSummary.textContent = `${formatCurrency(progress.xp || 0)} XP`;
        }
    }
    updateHomePlayerOverview(progress);
}

function updateHomePlayerOverview(progressOverride) {
    const progress = progressOverride || homePlayerProgress;
    if (!progress) return;
    homePlayerProgress = progress;
    if (homePlayerLevel) {
        homePlayerLevel.textContent = `Lv.${progress.level || 1}`;
    }
    const next = progress.nextThreshold || 0;
    const xp = progress.xp || 0;
    let percent = 1;
    if (next > 0) {
        percent = Math.min(Math.max(xp / next, 0), 1);
    } else if (progress.xpToNext && progress.xpToNext > 0) {
        const total = xp + progress.xpToNext;
        percent = Math.min(Math.max(xp / total, 0), 1);
    }
    if (homePlayerXpFill) {
        homePlayerXpFill.style.width = `${(percent * 100).toFixed(1)}%`;
    }
    if (homePlayerXpText) {
        if (next > 0) {
            homePlayerXpText.textContent = `${formatCurrency(xp)} / ${formatCurrency(next)} XP`;
        } else if (progress.xpToNext) {
            homePlayerXpText.textContent = `${formatCurrency(xp)} XP (+${formatCurrency(progress.xpToNext)} で次のレベル)`;
        } else {
            homePlayerXpText.textContent = `${formatCurrency(xp)} XP`;
        }
    }
}

function renderTraderList() {
    if (!traderListElement || !traderState.data) return;
    traderListElement.innerHTML = '';
    (traderState.data.traders || []).forEach((trader) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `trader-card${trader.id === traderState.activeTraderId ? ' active' : ''}`;
        const header = document.createElement('div');
        header.className = 'trader-card-header';
        const title = document.createElement('strong');
        title.textContent = `${trader.icon || '💼'} ${trader.name}`;
        header.appendChild(title);
        const levelInfo = traderState.traderLevels?.[trader.id] || {
            level: trader.level || 1,
            xp: trader.xp || 0,
            nextThreshold: trader.nextThreshold,
            xpToNext: trader.xpToNext
        };
        const levelBadge = document.createElement('span');
        levelBadge.className = 'trader-level-badge';
        levelBadge.textContent = `Lv.${levelInfo.level || 1}`;
        header.appendChild(levelBadge);
        card.appendChild(header);

        const desc = document.createElement('span');
        desc.textContent = trader.description || '';
        card.appendChild(desc);

        if (levelInfo) {
            const progress = document.createElement('small');
            progress.className = 'trader-level-progress';
            if (levelInfo.nextThreshold && levelInfo.nextThreshold > (levelInfo.xp || 0)) {
                progress.textContent = `XP: ${formatCurrency(levelInfo.xp || 0)} / ${formatCurrency(levelInfo.nextThreshold)}`;
            } else {
                progress.textContent = `XP: ${formatCurrency(levelInfo.xp || 0)}`;
            }
            card.appendChild(progress);
        }

        card.addEventListener('click', () => {
            traderState.activeTraderId = trader.id;
            renderTraderUI();
        });
        traderListElement.appendChild(card);
    });
}

function renderTraderInventory() {
    if (!traderInventoryContainer || !traderState.data) return;
    const traders = traderState.data.traders || [];
    const active = traders.find((trader) => trader.id === traderState.activeTraderId) || traders[0];
    if (!active) {
        traderInventoryContainer.innerHTML = '<p class="empty-state">利用可能なトレーダーがいません。</p>';
        if (traderPanelTitle) traderPanelTitle.textContent = '在庫';
        if (traderPanelDescription) traderPanelDescription.textContent = '';
        return;
    }
    traderState.activeTraderId = active.id;
    if (traderPanelTitle) traderPanelTitle.textContent = `${active.name} の在庫`;
    if (traderPanelDescription) traderPanelDescription.textContent = active.description || '';
    traderInventoryContainer.innerHTML = '';
    const sections = active.inventorySections || [];
    const fragment = document.createDocumentFragment();
    let hasItems = false;
    sections.forEach((section) => {
        const items = section.items || [];
        if (!items.length) return;
        hasItems = true;
        const sectionEl = document.createElement('div');
        sectionEl.className = 'trader-section';
        const header = document.createElement('h4');
        header.textContent = section.label || 'カテゴリー';
        sectionEl.appendChild(header);
        const grid = document.createElement('div');
        grid.className = 'trader-grid';
        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'trader-item-card';
            if (item.imagePath) {
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'item-image';
                const image = document.createElement('img');
                image.src = item.imagePath;
                image.alt = item.name;
                image.loading = 'lazy';
                imageWrapper.appendChild(image);
                card.appendChild(imageWrapper);
            }
            const title = document.createElement('div');
            title.className = 'item-title';
            title.textContent = item.name;
            const meta = document.createElement('div');
            meta.className = 'item-meta';
            const priceTag = document.createElement('span');
            priceTag.className = 'price-tag';
            meta.innerHTML = `<span class="rarity-pill ${item.rarityLabel}">${item.rarityLabel}</span>`;
            meta.appendChild(priceTag);
            card.appendChild(title);
            card.appendChild(meta);

            const maxQuantity = item.maxQuantity || 1;
            const canAdjust = !!item.canAdjustQuantity;
            let qtyInput = null;
            const updatePrice = () => {
                if (!canAdjust) {
                    priceTag.textContent = `${formatCurrency(item.price || 0)} ₽`;
                    return;
                }
                const qty = Math.min(Math.max(parseInt(qtyInput ? qtyInput.value : '1', 10) || 1, 1), maxQuantity);
                if (qtyInput) qtyInput.value = qty;
                const unitPrice = item.unitPrice || 0;
                priceTag.textContent = `${formatCurrency(unitPrice * qty)} ₽`;
            };

            if (canAdjust && maxQuantity > 1) {
                const quantityRow = document.createElement('div');
                quantityRow.className = 'quantity-row';
                const label = document.createElement('span');
                label.textContent = `数量 (最大 ${maxQuantity})`;
                qtyInput = document.createElement('input');
                qtyInput.type = 'number';
                qtyInput.min = 1;
                qtyInput.max = maxQuantity;
                qtyInput.value = 1;
                qtyInput.className = 'quantity-input';
                qtyInput.addEventListener('input', updatePrice);
                quantityRow.appendChild(label);
                quantityRow.appendChild(qtyInput);
                card.appendChild(quantityRow);
            } else if (maxQuantity > 1) {
                const quantityLabel = document.createElement('small');
                quantityLabel.textContent = '最大耐久値で購入';
                card.appendChild(quantityLabel);
            }

            updatePrice();

            const button = document.createElement('button');
            button.textContent = '購入';
            button.addEventListener('click', () => {
                const qty = !canAdjust ? maxQuantity : (qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1);
                handleBuy(item.name, qty, button);
            });
            card.appendChild(button);
            const tooltip = createItemTooltip({ ...item.stats, name: item.name, item_name: item.name });
            if (tooltip) {
                card.appendChild(tooltip);
            }
            grid.appendChild(card);
        });
        sectionEl.appendChild(grid);
        fragment.appendChild(sectionEl);
    });
    if (!hasItems) {
        traderInventoryContainer.innerHTML = '<p class="empty-state">現在購入できるアイテムはありません。</p>';
        return;
    }
    traderInventoryContainer.appendChild(fragment);
}

function renderPlayerInventory() {
    if (!traderPlayerItemsContainer || !traderState.data) return;
    const items = [...(traderState.data.player_items || [])];
    traderPlayerItemsContainer.innerHTML = '';
    if (!items.length) {
        traderPlayerItemsContainer.innerHTML = '<p class="empty-state">売却可能なアイテムがありません。</p>';
        return;
    }
    items.sort((a, b) => (b.sellPrice || 0) - (a.sellPrice || 0));
    items.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'player-item-card';
        const title = document.createElement('div');
        title.className = 'item-title';
        title.textContent = item.name;
        const meta = document.createElement('div');
        meta.className = 'item-meta';
        const priceTag = document.createElement('span');
        priceTag.className = 'price-tag';
        meta.innerHTML = `<span class="rarity-pill ${item.rarityLabel || 'Common'}">${item.rarityLabel || 'Common'}</span>`;
        meta.appendChild(priceTag);
        card.appendChild(title);
        card.appendChild(meta);

        const maxQuantity = item.maxQuantity || item.quantity || 1;
        let qtyInput = null;
        const updatePrice = () => {
            // 耐久度があるアイテム（医薬品、武器、アーマー、ヘルメット）の場合は計算済みの売価を直接表示
            if (item.type === 'medical' || item.type === 'weapon' || item.type === 'armor' || item.type === 'helmet') {
                priceTag.textContent = `${formatCurrency(item.sellPrice || 0)} ₽`;
                return;
            }
            // 弾薬などの場合は数量に応じて計算
            const qty = Math.min(Math.max(parseInt(qtyInput ? qtyInput.value : '1', 10) || 1, 1), maxQuantity);
            if (qtyInput) qtyInput.value = qty;
            const unitPrice = item.unitPrice || item.sellPrice || 0;
            priceTag.textContent = `${formatCurrency(unitPrice * qty)} ₽`;
        };

        if (maxQuantity > 1) {
            const quantityRow = document.createElement('div');
            quantityRow.className = 'quantity-row';
            const label = document.createElement('span');
            label.textContent = `売却数 (最大 ${maxQuantity})`;
            qtyInput = document.createElement('input');
            qtyInput.type = 'number';
            qtyInput.min = 1;
            qtyInput.max = maxQuantity;
            qtyInput.value = 1;
            qtyInput.className = 'quantity-input';
            qtyInput.addEventListener('input', updatePrice);
            quantityRow.appendChild(label);
            quantityRow.appendChild(qtyInput);
            card.appendChild(quantityRow);
        } else if (item.quantity) {
            const quantity = document.createElement('small');
            quantity.textContent = `数量: ${item.quantity}`;
            card.appendChild(quantity);
        }

        updatePrice();

        const button = document.createElement('button');
        button.textContent = '売却';
        button.addEventListener('click', () => {
            const qty = qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1;
            handleSell(item.id, qty, button);
        });
        card.appendChild(button);
        const tooltip = createItemTooltip({ ...item.stats, name: item.item_name, item_name: item.item_name });
        if (tooltip) {
            card.appendChild(tooltip);
        }
        traderPlayerItemsContainer.appendChild(card);
    });
}

function renderRarityVisualization() {
    if (!rarityVisualizationContainer || !traderState.data) return;
    const categories = traderState.data.rarity_visualization || [];
    rarityVisualizationContainer.innerHTML = '';
    if (!categories.length) {
        rarityVisualizationContainer.innerHTML = '<p class="empty-state">レア度情報がありません。</p>';
        return;
    }
    categories.forEach((category) => {
        const block = document.createElement('div');
        block.className = 'rarity-row';
        const header = document.createElement('strong');
        header.textContent = `${RARITY_CATEGORY_LABELS[category.type] || category.type} (${category.items.length})`;
        block.appendChild(header);
        (category.items || []).forEach((entry) => {
            const row = document.createElement('div');
            row.className = 'rarity-item';
            const label = document.createElement('div');
            label.className = 'rarity-item-label';
            label.innerHTML = `<span>${entry.name}</span><small>${entry.rarityLabel}</small>`;
            const bar = document.createElement('div');
            bar.className = 'rarity-bar';
            const fill = document.createElement('span');
            const width = Math.max(3, Math.round((entry.dropRate || 0) * 100));
            fill.style.width = `${width}%`;
            bar.appendChild(fill);
            row.appendChild(label);
            row.appendChild(bar);
            block.appendChild(row);
        });
        rarityVisualizationContainer.appendChild(block);
    });
}

async function fetchQuestTasks() {
    if (questState.loading) return;
    questState.loading = true;
    try {
        const response = await fetch('/api/quests/tasks');
        const data = await response.json();
        if (!data.success) {
            alert(data.message || 'クエスト情報の取得に失敗しました。');
            return;
        }
        questState.tasks = data.tasks || [];
        renderQuestLists();
    } catch (error) {
        console.error('Failed to load quests', error);
        alert('クエスト情報の取得に失敗しました。');
    } finally {
        questState.loading = false;
    }
}

function renderQuestLists() {
    if (!activeQuestList || !completedQuestList || !lockedQuestList) return;
    const groups = { active: [], completed: [], locked: [] };
    questState.tasks.forEach((task) => {
        if (task.status === 'completed') {
            groups.completed.push(task);
        } else if (task.status === 'active') {
            groups.active.push(task);
        } else {
            groups.locked.push(task);
        }
    });
    populateQuestList(activeQuestList, groups.active, '進行中のタスクはありません。');
    populateQuestList(completedQuestList, groups.completed, '完了済みのタスクはありません。');
    populateQuestList(lockedQuestList, groups.locked, '待機中のタスクはありません。');
}

function populateQuestList(container, tasks, emptyText) {
    container.innerHTML = '';
    if (!tasks.length) {
        container.innerHTML = `<p class="empty-state">${emptyText}</p>`;
        return;
    }
    tasks.forEach((task) => {
        container.appendChild(createQuestCard(task));
    });
}

function createQuestCard(task) {
    const card = document.createElement('div');
    card.className = 'quest-card';
    const title = document.createElement('h4');
    title.textContent = task.name || 'タスク';
    card.appendChild(title);

    if (task.giver) {
        const giver = document.createElement('div');
        giver.className = 'quest-status';
        giver.textContent = `依頼主: ${task.giver}`;
        card.appendChild(giver);
    }

    if (task.description) {
        const desc = document.createElement('p');
        desc.textContent = task.description;
        card.appendChild(desc);
    }

    const objective = document.createElement('div');
    objective.className = 'quest-objective';
    if (task.objective?.item_name) {
        objective.innerHTML = `<strong>目的:</strong> ${task.objective.item_name} × ${task.required}`;
    } else {
        objective.innerHTML = '<strong>目的:</strong> 詳細は説明を参照';
    }
    card.appendChild(objective);

    if (task.objective?.hint) {
        const hint = document.createElement('small');
        hint.textContent = `ヒント: ${task.objective.hint}`;
        card.appendChild(hint);
    }

    if (task.rewards) {
        const rewards = document.createElement('div');
        rewards.className = 'quest-status';
        const rewardParts = [];
        if (task.rewards.currency) rewardParts.push(`${formatCurrency(task.rewards.currency)} ₽`);
        if (task.rewards.exp) rewardParts.push(`${formatCurrency(task.rewards.exp)} EXP`);
        if (task.rewards.description) rewardParts.push(task.rewards.description);
        rewards.textContent = `報酬: ${rewardParts.join(' / ')}`;
        card.appendChild(rewards);
    }

    const statusLine = document.createElement('div');
    statusLine.className = 'quest-status';
    statusLine.textContent = formatQuestStatus(task.status);
    card.appendChild(statusLine);

    if (task.status === 'active') {
        const progressLine = document.createElement('div');
        progressLine.className = 'quest-status';
        progressLine.textContent = `所持: ${task.available}/${task.required}`;
        card.appendChild(progressLine);
        const button = document.createElement('button');
        button.textContent = '納品';
        button.disabled = !task.canTurnIn;
        button.addEventListener('click', () => handleQuestTurnIn(task.id, button));
        card.appendChild(button);
    } else if (task.status === 'locked') {
        const lockedLine = document.createElement('div');
        lockedLine.className = 'quest-status';
        lockedLine.textContent = '前のタスクを完了すると解放されます。';
        card.appendChild(lockedLine);
    }

    return card;
}

function formatQuestStatus(status) {
    switch (status) {
        case 'active':
            return '状態: 進行中';
        case 'completed':
            return '状態: 完了済み';
        default:
            return '状態: 未開放';
    }
}

async function handleQuestTurnIn(taskId, button) {
    if (!taskId) return;
    if (button) button.disabled = true;
    try {
        const response = await fetch('/api/quests/turn-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_id: taskId })
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.message || '納品に失敗しました。');
            return;
        }
        if (traderState.data && typeof data.currency === 'number') {
            traderState.data.currency = data.currency;
        }
        if (data.playerProgress) {
            traderState.playerProgress = data.playerProgress;
        }
        if (data.traderProgress && data.traderId) {
            traderState.traderLevels = traderState.traderLevels || {};
            traderState.traderLevels[data.traderId] = data.traderProgress;
        }
        renderTraderUI();
        await fetchQuestTasks();
        alert(data.message || 'タスクを完了しました。');
    } catch (error) {
        console.error('Failed to turn in quest items', error);
        alert('納品に失敗しました。');
    } finally {
        if (button) button.disabled = false;
    }
}

async function handleBuy(itemName, quantity, button) {
    if (!itemName || !traderState.activeTraderId) return;
    let qty = parseInt(quantity, 10) || 1;
    qty = Math.max(1, qty);
    if (button) button.disabled = true;
    try {
        const response = await fetch('/api/traders/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trader_id: traderState.activeTraderId, item_name: itemName, quantity: qty })
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.message || '購入に失敗しました。');
            return;
        }
        if (traderState.data) {
            traderState.data.currency = data.currency;
        }
        await fetchTraderData();
    } catch (error) {
        console.error('Failed to buy item', error);
        alert('購入に失敗しました。');
    } finally {
        if (button) button.disabled = false;
    }
}

async function handleSell(itemId, quantity, button) {
    if (!itemId) return;
    let qty = parseInt(quantity, 10) || 1;
    qty = Math.max(1, qty);
    if (button) button.disabled = true;
    try {
        const response = await fetch('/api/traders/sell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_id: itemId, quantity: qty })
        });
        const data = await response.json();
        if (!data.success) {
            alert(data.message || '売却に失敗しました。');
            return;
        }
        if (traderState.data) {
            traderState.data.currency = data.currency;
        }
        await fetchTraderData();
    } catch (error) {
        console.error('Failed to sell item', error);
        alert('売却に失敗しました。');
    } finally {
        if (button) button.disabled = false;
    }
}

if (traderCloseButton) {
    traderCloseButton.addEventListener('click', () => {
        closeTraderModal();
    });
}

if (traderModal) {
    traderModal.addEventListener('click', (event) => {
        if (event.target === traderModal) {
            closeTraderModal();
        }
    });
}

if (questCloseButton) {
    questCloseButton.addEventListener('click', () => {
        closeQuestModal();
    });
}

if (questModal) {
    questModal.addEventListener('click', (event) => {
        if (event.target === questModal) {
            closeQuestModal();
        }
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (traderModal && !traderModal.classList.contains('hidden')) {
        closeTraderModal();
    }
    if (questModal && !questModal.classList.contains('hidden')) {
        closeQuestModal();
    }
});

if (traderTabButtons.length) {
    traderTabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.tab) {
                setTraderTab(button.dataset.tab);
            }
        });
    });
}

// DEVメニューの要素取得
const devMenuModal = document.getElementById('devMenuModal');
const devMenuCloseButton = document.getElementById('devMenuCloseButton');
const enemyMovementToggle = document.getElementById('enemyMovementToggle');

// DEVメニューボタンのクリックイベント
if (devMenuButton) {
    devMenuButton.addEventListener('click', () => {
        if (devMenuModal) {
            devMenuModal.classList.remove('hidden');
            // 設定を読み込んで反映
            loadDevSettings();
            // トレーダーレベルを読み込んで表示
            loadTraderLevelsForDev();
        }
    });
}

// DEVメニューを閉じる
if (devMenuCloseButton) {
    devMenuCloseButton.addEventListener('click', () => {
        if (devMenuModal) {
            devMenuModal.classList.add('hidden');
        }
    });
}

// モーダルの外側をクリックで閉じる
if (devMenuModal) {
    devMenuModal.addEventListener('click', (e) => {
        if (e.target === devMenuModal) {
            devMenuModal.classList.add('hidden');
        }
    });
}

// DEV設定の読み込み
function loadDevSettings() {
    const enemyMovementEnabled = localStorage.getItem('devEnemyMovementEnabled');
    if (enemyMovementToggle) {
        // デフォルトはtrue（動かす）
        enemyMovementToggle.checked = enemyMovementEnabled !== 'false';
    }
}

// DEV設定の保存
function saveDevSettings() {
    if (enemyMovementToggle) {
        localStorage.setItem('devEnemyMovementEnabled', enemyMovementToggle.checked.toString());
    }
}

// 敵の移動設定の変更イベント
if (enemyMovementToggle) {
    enemyMovementToggle.addEventListener('change', () => {
        saveDevSettings();
    });
}

// トレーダーレベルの読み込み（開発者モード用）
async function loadTraderLevelsForDev() {
    try {
        const response = await fetch('/api/player/progress');
        const data = await response.json();
        if (data.success && data.trader_levels) {
            renderTraderLevelControls(data.trader_levels);
        }
    } catch (error) {
        console.error('トレーダーレベルの読み込みに失敗しました:', error);
    }
}

// トレーダーレベルコントロールの描画
function renderTraderLevelControls(traderLevels) {
    const container = document.getElementById('traderLevelControls');
    if (!container) return;
    
    const traderNames = {
        'therapist': 'セラピスト',
        'prapor': 'プリャポル',
        'skier': 'スキアー',
        'ragman': 'ラグマン',
        'jaeger': 'イェーガー',
        'mechanic': 'メカニック',
        'peacekeeper': 'ピースキーパー'
    };
    
    container.innerHTML = '';
    
    Object.keys(traderNames).forEach(traderId => {
        const traderName = traderNames[traderId];
        const levelInfo = traderLevels[traderId] || { level: 1, xp: 0 };
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'dev-setting-item';
        itemDiv.innerHTML = `
            <label class="dev-setting-label">
                <span>${traderName}</span>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <select id="traderLevel_${traderId}" style="padding: 5px;">
                        <option value="1" ${levelInfo.level === 1 ? 'selected' : ''}>レベル1</option>
                        <option value="2" ${levelInfo.level === 2 ? 'selected' : ''}>レベル2</option>
                        <option value="3" ${levelInfo.level === 3 ? 'selected' : ''}>レベル3</option>
                        <option value="4" ${levelInfo.level === 4 ? 'selected' : ''}>レベル4</option>
                        <option value="5" ${levelInfo.level === 5 ? 'selected' : ''}>レベル5</option>
                    </select>
                    <button class="dev-button" onclick="setTraderLevel('${traderId}')">設定</button>
                </div>
            </label>
        `;
        container.appendChild(itemDiv);
    });
}

// トレーダーレベルの設定（グローバルスコープ）
window.setTraderLevel = async function(traderId) {
    const selectElement = document.getElementById(`traderLevel_${traderId}`);
    if (!selectElement) return;
    
    const level = parseInt(selectElement.value);
    
    try {
        const response = await fetch('/api/dev/set-trader-level', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                trader_id: traderId,
                level: level
            })
        });
        
        const data = await response.json();
        if (data.success) {
            alert(`${traderId}のレベルを${level}に設定しました。`);
            // トレーダーレベルを再読み込み
            loadTraderLevelsForDev();
        } else {
            alert('エラー: ' + data.message);
        }
    } catch (error) {
        console.error('トレーダーレベルの設定に失敗しました:', error);
        alert('エラーが発生しました: ' + error.message);
    }
};

// ログアウトボタン
logoutButton.addEventListener('click', () => {
    if (confirm('ログアウトしますか？')) {
        window.location.href = '/logout';
    }
});

// エネルギー・水分の回復処理（ホーム画面）
function updateEnergyHydrationOnHome() {
    const lastUpdate = localStorage.getItem('lastEnergyHydrationUpdate');
    if (!lastUpdate) return;
    
    const now = Date.now();
    const elapsedMinutes = (now - parseInt(lastUpdate)) / 60000;
    
    if (elapsedMinutes > 0) {
        let energy = parseFloat(localStorage.getItem('playerEnergy') || '100');
        let hydration = parseFloat(localStorage.getItem('playerHydration') || '100');
        
        // 5/mずつ回復
        energy = Math.min(100, energy + 5 * elapsedMinutes);
        hydration = Math.min(100, hydration + 5 * elapsedMinutes);
        
        localStorage.setItem('playerEnergy', energy.toString());
        localStorage.setItem('playerHydration', hydration.toString());
        localStorage.setItem('lastEnergyHydrationUpdate', now.toString());
    }
}

// ページ読み込み時の初期化
// リップル効果を追加する関数
function createRipple(event, button) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');
    
    button.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

// すべてのボタンにリップル効果を適用
function addRippleToButtons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.addEventListener('click', function(e) {
            createRipple(e, this);
        });
    });
}

window.addEventListener('DOMContentLoaded', () => {
    loadBackgroundImage();
    addRippleToButtons();
    loadUserInfo();
    fetchHomePlayerProgress();
    updateEnergyHydrationOnHome();
    
    // 定期的にエネルギー・水分を回復（1分ごと）
    setInterval(updateEnergyHydrationOnHome, 60000);
});

