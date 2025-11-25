function isInsideMansionArea(x, z, padding = 0) {
    if (!MANSION_CONFIG) return false;
    const halfWidth = MANSION_CONFIG.size.width / 2 + padding;
    const halfDepth = MANSION_CONFIG.size.depth / 2 + padding;
    return (
        Math.abs(x - MANSION_CONFIG.position.x) <= halfWidth &&
        Math.abs(z - MANSION_CONFIG.position.z) <= halfDepth
    );
}

function isAreaIntersectingMansion(x, z, size) {
    if (!MANSION_CONFIG) return false;
    const radius = Math.max(size.x || size, size.z || size) / 2;
    return isInsideMansionArea(x, z, radius + MANSION_CONFIG.clearance);
}
// Three.js 3Dゲーム - EFT風
let scene, camera, renderer;
let player, playerVelocity = new THREE.Vector3();
let enemies = [];
let zombies = []; // ゾンビの配列
let bossZombie = null; // ボスゾンビ（1体のみ）
let obstacles = [];
let treePositions = [];
let lootCrates = [];
let crateLootItems = [];
let raidPartPickups = [];
let droppedLootItems = []; // ゾンビからドロップしたアイテム
let focusedInteractable = null;
const obstacleSpatialHash = new Map();
let generators = [];
let raidPartsInventory = { sparkPlug: 0, fuel: 0 };
let generatorRepairState = null;
let extractionUnlocked = false;
let trainCrossing = null;
let extractionCountdownState = null;
let raidStartTimestamp = null;
let activeFlareType = null;
let flareProjectile = null; // フレア弾の3Dオブジェクト
let flareCountdownState = null; // フレア弾のカウントダウン状態
let flareLight = null; // フレアのライト
let flareGlow = null; // フレアのグロー効果
let flareParticles = null; // フレアの光の粒子
let flareSmoke = null; // フレアの煙
let rocketProjectile = null; // ロケットランチャーの弾
let rocketSmoke = null; // ロケットの弾道の煙
let explosionMushroomCloud = null; // 爆発のキノコ雲
let explosionLight = null; // 爆発の光
let targets = []; // 的の配列
let raycaster = new THREE.Raycaster(); // レイキャスター
const lootRaycaster = new THREE.Raycaster();
const LOOT_RAY_ORIGIN = new THREE.Vector2(0, 0);
let keys = {};
let mouseMovement = { x: 0, y: 0 };
let isPointerLocked = false;
let weaponModel = null; // 銃の3Dモデル
let weaponModelLoadId = 0; // モデル読み込みの識別子
let currentMagazine = null; // 現在装填中のマガジン
let currentAmmoStack = []; // 現在装填中のマガジンの弾薬スタック（LIFO順）
let lastFireTime = 0; // 最後に発射した時刻
let isFiring = false; // 発射中フラグ
let lastFireAmmoUpdate = 0; // 最後に発射で弾数を更新した時刻
let recoilState = { vertical: 0, horizontal: 0 }; // 反動の状態（減衰用）
let recoilDecayRate = 0.95; // 反動の減衰率（フレームごと）
let gltfLoaderPromise = null; // GLTFLoader読み込み用
let playerParts = null; // プレイヤーモデルの各部位参照
const mansionElements = {
    stairZone: null
};
let playerFloorLevel = 0;
let exitHandlerSuppressed = false;
let exitListenersAttached = false;
let lootPromptElement = null;
let lootPromptTimeoutHandle = null;
let lootPromptOverrideText = null;
let lootPromptOverrideIsError = false;
let lootCrateTexture = null;
let lootCrateMaterial = null;
let sharedTextureLoader = null;
let treeTrunkTexture = null;
let treeCanopyTexture = null;
let treeTrunkMaterial = null;
let treeCanopyMaterial = null;
let groundTexture = null;
let groundMaterial = null;
let grassTexture = null;
let bushTexture = null;
let grassMaterial = null;
let bushMaterial = null;
let grassInstancedMesh = null;
let bushInstancedMesh = null;
let celestialBodyMesh = null;

function sendPlayerXpEvent(event, payload = {}) {
    if (!event) return Promise.resolve();
    const body = JSON.stringify({ event, ...payload });
    if (navigator.sendBeacon) {
        try {
            const blob = new Blob([body], { type: 'application/json' });
            const success = navigator.sendBeacon('/api/player/xp', blob);
            if (success) {
                return Promise.resolve(true);
            }
        } catch (error) {
            console.error('sendBeacon XP failed', error);
        }
    }
    return fetch('/api/player/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
    }).catch((error) => {
        console.error('Failed to send XP event', error);
    });
}
const WEAPON_DURABILITY_MAX = 100;
const DURABILITY_LOSS_PER_SHOT = 0.08;
const DURABILITY_LOSS_PER_RELOAD = 0.4;
const CHAMBER_CHECK_DURATION_MS = 1100;
const MALFUNCTION_CLEAR_DURATION_MS = 1500;
const T_DOUBLE_TAP_WINDOW_MS = 350;
const WEAPON_MALFUNCTION_THRESHOLDS = [
    { threshold: 10, misfireOdds: 20, spreadMultiplier: 1.5 },
    { threshold: 20, misfireOdds: 50, spreadMultiplier: 1.35 },
    { threshold: 30, misfireOdds: 100, spreadMultiplier: 1.25 },
    { threshold: 40, misfireOdds: 150, spreadMultiplier: 1.18 },
    { threshold: 50, misfireOdds: 180, spreadMultiplier: 1.14 },
    { threshold: 60, misfireOdds: 200, spreadMultiplier: 1.1 },
    { threshold: 70, misfireOdds: 250, spreadMultiplier: 1.07 },
    { threshold: 80, misfireOdds: 270, spreadMultiplier: 1.05 },
    { threshold: 90, misfireOdds: 300, spreadMultiplier: 1.03 }
];
const WEAPON_MALFUNCTION_PROMPT_COOLDOWN_MS = 2000;
let weaponChamberCheckTimer = null;
let weaponClearTimer = null;
let weaponDoubleTapTimer = null;
let lastWeaponAnomalyHintTime = 0;
let weaponPromptActive = false;

const LEAN_MAX_ANGLE = THREE.Math.degToRad(18); // 最大リーン角度（左右）
const LEAN_TRANSITION_SPEED = 0.15; // 目標角度への追従係数
let leanTargetAngle = 0;
let currentLeanAngle = 0;

// FPS計算用の変数
let fps = 0;
let frameCount = 0;
let lastFpsUpdate = Date.now();

// アーマーデータ
const ARMOR_DATA = {
    'PACA Soft Armor': {
        durability: 100,
        armor_class: 20,
        movement_speed_debuff: -0.01
    },
    'BNTI Module-3M body armor': {
        durability: 80,
        armor_class: 20,
        movement_speed_debuff: -0.01
    },
    '6B23-1 body armor (Digital Flora)': {
        durability: 206,
        armor_class: 30,
        movement_speed_debuff: -0.04
    },
    'NPP KlASS Kora-Kulon body armor (Black)': {
        durability: 120,
        armor_class: 30,
        movement_speed_debuff: -0.03
    },
    'HighCom Trooper TFO body armor (MultiCam)': {
        durability: 180,
        armor_class: 40,
        movement_speed_debuff: -0.03
    },
    '6B23-2 body armor (Mountain Flora)': {
        durability: 246,
        armor_class: 40,
        movement_speed_debuff: -0.05
    },
    '6B2 body armor (Flora)': {
        durability: 128,
        armor_class: 20,
        movement_speed_debuff: -0.03
    },
    'PACA Soft Armor (Rivals Edition)': {
        durability: 100,
        armor_class: 20,
        movement_speed_debuff: -0.01
    },
    'IOTV Gen4 body armor (Full Protection Kit, MultiCam)': {
        durability: 398,
        armor_class: 50,
        movement_speed_debuff: -0.12
    },
    'FORT Redut-M body armor': {
        durability: 358,
        armor_class: 50,
        movement_speed_debuff: -0.06
    },
    'BNTI Zhuk body armor (Digital Flora)': {
        durability: 305,
        armor_class: 60,
        movement_speed_debuff: -0.07
    },
    '5.11 Tactical Hexgrid plate carrier': {
        durability: 100,
        armor_class: 60,
        movement_speed_debuff: -0.04
    }
};

// ヘルメットデータ
const HELMET_DATA = {
    'Tac-Kek FAST MT helmet (Replica)': {
        durability: 48,
        armor_class: 10,
        movement_speed_debuff: 0
    },
    'TSh-4M-L soft tank crew helmet': {
        durability: 105,
        armor_class: 10,
        movement_speed_debuff: 0
    },
    'PSh-97 DJETA riot helmet': {
        durability: 156,
        armor_class: 20,
        movement_speed_debuff: 0
    },
    'ShPM Firefighter helmet': {
        durability: 96,
        armor_class: 20,
        movement_speed_debuff: 0
    },
    '6B47 Ratnik-BSh helmet (Digital Flora cover)': {
        durability: 45,
        armor_class: 30,
        movement_speed_debuff: 0
    },
    'SSh-68 steel helmet (Olive Drab)': {
        durability: 54,
        armor_class: 30,
        movement_speed_debuff: 0
    },
    'Ballistic Armor Co. Bastion helmet (OD Green)': {
        durability: 50,
        armor_class: 40,
        movement_speed_debuff: 0
    },
    'HighCom Striker ULACH IIIA helmet (Desert Tan)': {
        durability: 66,
        armor_class: 40,
        movement_speed_debuff: 0
    },
    'Altyn bulletproof helmet (Olive Drab)': {
        durability: 81,
        armor_class: 50,
        movement_speed_debuff: 0
    },
    'Vulkan-5 LShZ-5 bulletproof helmet (Black)': {
        durability: 99,
        armor_class: 50,
        movement_speed_debuff: 0
    }
};

// ゲーム設定
const GAME_CONFIG = {
    moveSpeed: 0.1,
    mouseSensitivity: 0.002,
    playerHeight: 1.6,
    gravity: -0.02,
    jumpForce: 0.45,
    groundY: 0,
    ammo: 0,
    totalAmmo: 0,
    weapon: '未装備',
    equippedArmor: null, // 装備中のアーマー
    armorDurability: null, // アーマーの現在の耐久値
    armorMaxDurability: null, // アーマーの最大耐久値
    fireRate: null,
    fireModes: [],
    ammoType: null,
    compatibleMagazines: [],
    currentFireMode: 'semi', // 現在の発射モード
    currentWeaponSlot: null, // 現在使用中の武器スロット（'primary'または'secondary'）
    magazineCapacity: 0, // 現在装填中のマガジンの最大装填数
    weaponDurability: WEAPON_DURABILITY_MAX,
    weaponMalfunction: {
        active: false,
        diagnosed: false,
        checkInProgress: false,
        clearInProgress: false,
        awaitingDoubleTap: false,
        lastTapTime: 0
    },
    // スタミナ
    upperBodyStamina: 100,
    maxUpperBodyStamina: 100,
    lowerBodyStamina: 100,
    maxLowerBodyStamina: 100,
    // エネルギーと水分
    energy: 100,
    maxEnergy: 100,
    hydration: 100,
    maxHydration: 100,
    // 部位別体力
    bodyParts: {
        head: { health: 35, maxHealth: 35 },
        face: { health: 35, maxHealth: 35 }, // 顔（ヘルメットの上、ダメージは頭に転送）
        chest: { health: 85, maxHealth: 85 },
        stomach: { health: 70, maxHealth: 70 },
        leftArm: { health: 60, maxHealth: 60 },
        rightArm: { health: 60, maxHealth: 60 },
        leftLeg: { health: 65, maxHealth: 65 },
        rightLeg: { health: 65, maxHealth: 65 }
    },
    // 状態異常
    statusEffects: {
        lightBleeding: [], // [{ part: 'head', time: 0 }]
        heavyBleeding: [],
        fracture: [],
        pain: false,
        concussion: false,
        blackedOut: [] // 壊死部位
    },
    // 医薬品使用中
    usingMedicalItem: false,
    painkillersActive: false,
    painkillersDuration: 0,
    // ゲーム状態
    isInGame: false,
    lastUpdateTime: Date.now(),
    escapeAvailable: false
};

const WEAPON_DATA = {
    'M4A1': {
        fireRate: 800,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'M4A1.png',
        verticalRecoil: 84,
        horizontalRecoil: 243,
        moa: 1.82
    },
    'AK-74M': {
        fireRate: 650,
        ammoType: '5.45x39mm BP',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.45x39mm standard 30連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'AK-74M.png',
        verticalRecoil: 84,
        horizontalRecoil: 226,
        moa: 1.89
    },
    'Ash-12': {
        fireRate: 650,
        ammoType: '12.7x55mm PS12B',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['Ash-12用 10連マガジン', 'Ash-12用 20連マガジン'],
        stashSize: { width: 4, height: 2 },
        imageFile: 'Ash-12.png',
        verticalRecoil: 106,
        horizontalRecoil: 353,
        moa: 1.63
    },
    'AS VAL': {
        fireRate: 900,
        ammoType: '9x39mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['AS VAL用15連マガジン', 'AS VAL用 30連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'AS VAL.png',
        verticalRecoil: 52,
        horizontalRecoil: 176,
        moa: 3.44,
        modelPath: '/3dmodel/gun/AS VAL.glb',
        modelSettings: {
            scale: { x: 12, y: 12, z: 12 },
            rotation: { x: 0, y: Math.PI, z: 0 },
            position: { x: 0, y: -0.05, z: 0.05 }
        }
    },
    'M16A2': {
        fireRate: 800,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'burst'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
        stashSize: { width: 6, height: 2 },
        imageFile: 'M16A2.png',
        verticalRecoil: 75,
        horizontalRecoil: 218,
        moa: 1.24
    },
    'Custom Guns NL545': {
        fireRate: 800,
        ammoType: '5.45x39mm BP',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.45x39mm standard 30連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'Custom Guns NL545.png',
        verticalRecoil: 63,
        horizontalRecoil: 184,
        moa: 1.30
    },
    'DS Arms SA-58 7.62x51 assault rifle': {
        fireRate: 700,
        ammoType: '7.62x51mm M80',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['7.61x51mm standard 30連マガジン', '7.61x51mm short 20連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'DS Arms SA-58 7.62x51 assault rifle.png',
        verticalRecoil: 101,
        horizontalRecoil: 245,
        moa: 2.8
    },
    'Desert Tech MDR 5.56x45 assault rifle': {
        fireRate: 650,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン'],
        stashSize: { width: 4, height: 2 },
        imageFile: 'Desert Tech MDR 5.56x45 assault rifle.png',
        verticalRecoil: 62,
        horizontalRecoil: 203,
        moa: 1.43
    },
    'Desert Tech MDR 7.62x51 assault rifle': {
        fireRate: 650,
        ammoType: '7.62x51mm M80',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['7.61x51mm standard 30連マガジン'],
        stashSize: { width: 4, height: 2 },
        imageFile: 'Desert Tech MDR 7.62x51 assault rifle.png',
        verticalRecoil: 84,
        horizontalRecoil: 261,
        moa: 1.46
    },
    'FN SCAR-H 7.62x51 assault rifle LB': {
        fireRate: 600,
        ammoType: '7.62x51mm M80',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['7.61x51mm standard 30連マガジン', '7.61x51mm short 20連マガジン'],
        stashSize: { width: 6, height: 2 },
        imageFile: 'FN SCAR-H 7.62x51 assault rifle LB.png',
        verticalRecoil: 103,
        horizontalRecoil: 251,
        moa: 1.27
    },
    'FN SCAR-L 5.56x45 assault rifle LB': {
        fireRate: 650,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
        stashSize: { width: 6, height: 2 },
        imageFile: 'FN SCAR-L 5.56x45 assault rifle LB.png',
        verticalRecoil: 81,
        horizontalRecoil: 273,
        moa: 1.56
    },
    'HK 416A5 5.56x45 assault rifle': {
        fireRate: 850,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'HK 416A5 5.56x45 assault rifle.png',
        verticalRecoil: 85,
        horizontalRecoil: 243,
        moa: 1.93
    },
    'HK G36 5.56x45 assault rifle': {
        fireRate: 750,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'burst', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
        stashSize: { width: 6, height: 2 },
        imageFile: 'HK G36 5.56x45 assault rifle.png',
        verticalRecoil: 74,
        horizontalRecoil: 228,
        moa: 1.73
    },
    'Kalashnikov AK-101 5.56x45 assault rifle': {
        fireRate: 650,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'Kalashnikov AK-101 5.56x45 assault rifle.png',
        verticalRecoil: 78,
        horizontalRecoil: 213,
        moa: 1.72
    },
    'Kalashnikov AKM 7.62x39 assault rifle': {
        fireRate: 600,
        ammoType: '7.62x39mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['7.62x39mm standard 30連マガジン', '7.62x39mm short 15連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'Kalashnikov AKM 7.62x39 assault rifle.png',
        verticalRecoil: 118,
        horizontalRecoil: 294,
        moa: 2.3
    },
    'SIG MCX SPEAR 6.8x51 assault rifle': {
        fireRate: 800,
        ammoType: '6.8x51mm SIG FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['6.8x51mm standard 30連マガジン', '6.8x51mm short 15連マガジン'],
        stashSize: { width: 6, height: 2 },
        imageFile: 'SIG MCX SPEAR 6.8x51 assault rifle.png',
        verticalRecoil: 65,
        horizontalRecoil: 185,
        moa: 1.43
    },
    'Steyr AUG A1 5.56x45 assault rifle': {
        fireRate: 715,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'Steyr AUG A1 5.56x45 assault rifle.png',
        verticalRecoil: 45,
        horizontalRecoil: 178,
        moa: 1.24
    },
    'Aklys Defense Velociraptor .300 Blackout assault rifle': {
        fireRate: 600,
        ammoType: '.300 blackout BCP FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['.300 blackout standard 30連マガジン'],
        stashSize: { width: 4, height: 2 },
        imageFile: 'Aklys Defense Velociraptor .300 Blackout assault rifle.png',
        verticalRecoil: 83,
        horizontalRecoil: 223,
        moa: 2.23
    },
    'CMMG Mk47 Mutant 7.62x39 assault rifle': {
        fireRate: 650,
        ammoType: '7.62x39mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['7.62x39mm standard 30連マガジン'],
        stashSize: { width: 4, height: 2 },
        imageFile: 'CMMG Mk47 Mutant 7.62x39 assault rifle.png',
        verticalRecoil: 109,
        horizontalRecoil: 205,
        moa: 2.48
    },
    'SIG MCX .300 Blackout assault rifle': {
        fireRate: 800,
        ammoType: '.300 blackout BCP FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['.300 blackout standard 30連マガジン'],
        stashSize: { width: 4, height: 2 },
        imageFile: 'SIG MCX .300 Blackout assault rifle.png',
        verticalRecoil: 81,
        horizontalRecoil: 225,
        moa: 2.75
    },
    'Rifle Dynamics RD-704 7.62x39 assault rifle': {
        fireRate: 600,
        ammoType: '7.62x39mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['7.62x39mm standard 30連マガジン'],
        stashSize: { width: 4, height: 2 },
        imageFile: 'Rifle Dynamics RD-704 7.62x39 assault rifle.png',
        verticalRecoil: 102,
        horizontalRecoil: 247,
        moa: 2.03
    },
    'Radian Weapons Model 1 FA 5.56x45 assault rifle': {
        fireRate: 800,
        ammoType: '5.56x45mm FMJ',
        fireModes: ['semi', 'full'],
        compatibleMagazines: ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
        stashSize: { width: 5, height: 2 },
        imageFile: 'Radian Weapons Model 1 FA 5.56x45 assault rifle.png',
        verticalRecoil: 62,
        horizontalRecoil: 186,
        moa: 0.99
    },
    'RShG-2 72.5mm rocket launcher': {
        fireRate: 1,
        ammoType: null,
        fireModes: ['semi'],
        compatibleMagazines: [],
        stashSize: { width: 4, height: 1 },
        imageFile: 'special/RShG-2 72.5mm rocket launcher.png',
        verticalRecoil: 0,
        horizontalRecoil: 0,
        moa: 1,
        isRocketLauncher: true,
        explosionRadius: 100, // 半径100（ゲーム内の距離単位）
        baseDamage: 99999999,
        damageDecayPerMeter: 0.01, // 1単位につき1%減衰
        projectileSpeed: 50,
        range: Infinity,
        isDisposable: true
    },
    'Benelli M3 Super 90 dual-mode 12ga shotgun': {
        fireRate: 60,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [], // マガジン不要（直接装填）
        stashSize: { width: 5, height: 2 },
        imageFile: 'Benelli M3 Super 90 dual-mode 12ga shotgun.png',
        verticalRecoil: 242,
        horizontalRecoil: 428,
        moa: 18.22,
        isShotgun: true, // 散弾銃フラグ
        magazineCapacity: 5 // 直接装填数
    },
    'MP-133 12ga pump-action shotgun': {
        fireRate: 30,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [], // マガジン不要（直接装填）
        stashSize: { width: 5, height: 1 },
        imageFile: 'MP-133 12ga pump-action shotgun.png',
        verticalRecoil: 290,
        horizontalRecoil: 381,
        moa: 21.31,
        isShotgun: true,
        magazineCapacity: 6
    },
    'MP-153 12ga semi-automatic shotgun': {
        fireRate: 40,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [], // マガジン不要（直接装填）
        stashSize: { width: 7, height: 1 },
        imageFile: 'MP-153 12ga semi-automatic shotgun.png',
        verticalRecoil: 230,
        horizontalRecoil: 313,
        moa: 10.31,
        isShotgun: true,
        magazineCapacity: 4
    },
    'MP-43 12ga sawed-off double-barrel shotgun': {
        fireRate: 900,
        ammoType: '12x70mm',
        fireModes: ['semi', 'double'],
        compatibleMagazines: [], // マガジン不要（直接装填）
        stashSize: { width: 3, height: 1 },
        imageFile: 'MP-43 12ga sawed-off double-barrel shotgun.png',
        verticalRecoil: 279,
        horizontalRecoil: 413,
        moa: 21.31, // MOA未指定のため、他の散弾銃と同程度の値を設定
        isShotgun: true,
        magazineCapacity: 2
    },
    'MP-43-1C 12ga double-barrel shotgun': {
        fireRate: 900,
        ammoType: '12x70mm',
        fireModes: ['semi', 'double'],
        compatibleMagazines: [], // マガジン不要（直接装填）
        stashSize: { width: 6, height: 1 },
        imageFile: 'MP-43-1C 12ga double-barrel shotgun.png',
        verticalRecoil: 240,
        horizontalRecoil: 355,
        moa: 13.06,
        isShotgun: true,
        magazineCapacity: 2
    },
    'MTs-255-12 12ga shotgun': {
        fireRate: 30,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [], // マガジン不要（直接装填）
        stashSize: { width: 6, height: 1 },
        imageFile: 'MTs-255-12 12ga shotgun.png',
        verticalRecoil: 293,
        horizontalRecoil: 416,
        moa: 9.34,
        isShotgun: true,
        magazineCapacity: 5
    }
};

const DEFAULT_WEAPON_VIEW_OFFSET = { x: 0.3, y: -0.2, z: -0.5 };
const DEFAULT_WEAPON_VIEW_ROTATION = { x: 0, y: THREE.Math.degToRad(68), z: 0 };
const MAP_SIZE = 1000;
const MAP_HALF = MAP_SIZE / 2;
const OBSTACLE_GRID_CELL_SIZE = 25;
const CRATE_COUNT = 200;
const CRATE_SIZE = { width: 1.6, height: 1.2, depth: 1.6 };
const CRATE_TREE_BUFFER = 2.5;
const CRATE_MIN_DISTANCE_BETWEEN_CRATES = 4;
const CRATE_ITEM_HEIGHT = 0.25;
const LOOT_INTERACT_DISTANCE = 3.5;
const LOOT_PROMPT_HIDE_DELAY = 1400;
const GENERATOR_COUNT = 5;
const GENERATOR_MIN_DISTANCE = 40;
const GENERATOR_INTERACTION_HEIGHT = 3;
const GENERATOR_STATE_CHANCES = [
    { spark: true, fuel: true, chance: 0.01 },
    { spark: true, fuel: false, chance: 0.10 },
    { spark: false, fuel: true, chance: 0.10 },
    { spark: false, fuel: false, chance: 0.79 }
];
const EXTRACTION_RADIUS = 10;
const EXTRACTION_COUNTDOWN_MS = 10000;
const FLARE_ESCAPE_COUNTDOWN_MS = 19000; // 60秒
const FLARE_TARGET_HEIGHT = 32; // 500m
const FLARE_VELOCITY = 4; // 25m/s
const TRAIN_CROSSING_DISTANCE_FROM_EDGE = 10;
const RAID_PART_CONFIG = {
    sparkPlug: {
        key: 'sparkPlug',
        name: 'スパークプラグ Raid Only',
        color: 0xffd93d,
        repairDuration: 15000
    },
    fuel: {
        key: 'fuel',
        name: '燃料 Raid Only',
        color: 0x4ac6ff,
        repairDuration: 10000
    }
};
const LOOT_ITEM_POOL = [
    // 医薬品（多機能なものは低確率、単機能なものは高確率）
    { name: 'Grizzly medical kit', color: 0xd67229, itemType: 'medical', weight: 0.3 }, // 耐久値1800、3つの異常状態
    { name: 'Salewa first aid kit (Salewa)', color: 0xff4c4c, itemType: 'medical', weight: 0.5 }, // 耐久値400、2つの異常状態
    { name: 'AFAK tactical individual first aid kit', color: 0xff4c4c, itemType: 'medical', weight: 0.6 }, // 耐久値400、2つの異常状態
    { name: 'Surv12 field surgical kit', color: 0x8844ff, itemType: 'medical', weight: 0.4 }, // 壊死を直せる、耐久値15
    { name: 'CMS surgical kit (CMS)', color: 0x8844ff, itemType: 'medical', weight: 0.5 }, // 壊死を直せる、耐久値3
    { name: 'IFAK individual first aid kit', color: 0xff4c4c, itemType: 'medical', weight: 0.8 }, // 耐久値300、2つの異常状態
    { name: 'Car first aid kit', color: 0xff4c4c, itemType: 'medical', weight: 1.0 }, // 耐久値220、1つの異常状態
    { name: 'AI-2 medkit (AI-2)', color: 0xff4c4c, itemType: 'medical', weight: 2.0 }, // 耐久値100、何も直せない
    { name: 'Aseptic bandage (Bandage)', color: 0xffffff, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Esmarch tourniquet (Esmarch)', color: 0xff4c4c, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Immobilizing splint (Splint)', color: 0xc7c7c7, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Army bandage', color: 0xffffff, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'CAT hemostatic tourniquet', color: 0xff4c4c, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'CALOK-B hemostatic applicator', color: 0xff4c4c, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Aluminum splint', color: 0xc7c7c7, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Analgin painkillers (Analgin)', color: 0xf7d77b, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Augmentin antibiotic pills', color: 0xf7d77b, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Ibuprofen painkillers', color: 0xf7d77b, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Golden star balm', color: 0xf7d77b, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Vaseline balm', color: 0xf7d77b, itemType: 'medical', weight: 2.5 }, // 単機能
    { name: 'Water', color: 0x4dabff, itemType: 'medical', weight: 3.0 }, // 単機能
    { name: 'MRE', color: 0xb37d4c, itemType: 'medical', weight: 3.0 }, // 単機能
    // 銃（高ダメージ・高貫通の弾を使うものは低確率）
    { name: 'AS VAL', color: 0x9a7ff2, itemType: 'weapon', weight: 0.2 }, // 9x39mm弾（高ダメージ・高貫通）
    { name: 'M4A1', color: 0x4b7bec, itemType: 'weapon', weight: 0.4 }, // 5.56x45mm弾（中ダメージ・中貫通）
    { name: 'AK-74M', color: 0x50c878, itemType: 'weapon', weight: 0.4 }, // 5.45x39mm弾（中ダメージ・中貫通）
    { name: 'Ash-12', color: 0x9a7ff2, itemType: 'weapon', weight: 0.3 }, // 12.7x55mm弾（極高ダメージ）
    // バックパック（スタッシュサイズが大きいものは低確率）
    { name: '6SH118', color: 0x8d6e63, itemType: 'backpack', weight: 0.2 }, // 6x7
    { name: 'Paratus', color: 0xc9975d, itemType: 'backpack', weight: 0.3 }, // 5x7
    { name: 'pilgrim', color: 0xc9975d, itemType: 'backpack', weight: 0.3 }, // 5x7
    { name: 'Beta2', color: 0xc9975d, itemType: 'backpack', weight: 0.5 }, // 5x5
    { name: 'T20', color: 0xc9975d, itemType: 'backpack', weight: 0.5 }, // 5x5
    { name: 'Daypack', color: 0xc9975d, itemType: 'backpack', weight: 0.7 }, // 4x5
    { name: 'Takedown', color: 0xc9975d, itemType: 'backpack', weight: 0.7 }, // 3x7
    { name: 'MBSS', color: 0xc9975d, itemType: 'backpack', weight: 1.0 }, // 4x4
    { name: 'ScavBP', color: 0xc9975d, itemType: 'backpack', weight: 1.0 }, // 4x5
    { name: 'VKBO', color: 0xc9975d, itemType: 'backpack', weight: 1.2 }, // 3x4
    // リグ（スタッシュサイズが大きいものは低確率）
    { name: 'Alpha', color: 0xffc857, itemType: 'rig', weight: 0.3 }, // 4x4
    { name: 'IDEA Rig', color: 0xf2a365, itemType: 'rig', weight: 0.5 }, // 2x2
    { name: 'khamelion', color: 0xffc857, itemType: 'rig', weight: 0.4 }, // 4x3
    { name: 'Azimut', color: 0xffc857, itemType: 'rig', weight: 0.4 }, // 4x3
    // マガジン（最大装填数が多いものは低確率）
    { name: '5.56x45mm standard 30連マガジン', color: 0x8b7355, itemType: 'magazine', weight: 0.5 }, // 30連
    { name: '5.45x39mm standard 30連マガジン', color: 0x8b7355, itemType: 'magazine', weight: 0.5 }, // 30連
    { name: 'AS VAL用 30連マガジン', color: 0x8b7355, itemType: 'magazine', weight: 0.5 }, // 30連
    { name: 'Ash-12用 20連マガジン', color: 0x8b7355, itemType: 'magazine', weight: 0.8 }, // 20連
    { name: 'AS VAL用15連マガジン', color: 0x8b7355, itemType: 'magazine', weight: 1.0 }, // 15連
    { name: 'Ash-12用 10連マガジン', color: 0x8b7355, itemType: 'magazine', weight: 1.5 }, // 10連
    // 弾薬（高貫通力または極端に高ダメージのものは低確率）
    { name: '5.56x45mm M995 (M995)', color: 0xffd700, itemType: 'ammo', weight: 0.3 }, // 貫通53
    { name: '5.56x45mm SSA AP', color: 0xffd700, itemType: 'ammo', weight: 0.3 }, // 貫通57
    { name: '5.45x39mm PPBS gs Igolnik', color: 0xffd700, itemType: 'ammo', weight: 0.3 }, // 貫通62
    { name: '5.45x39mm BS', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // 貫通54
    { name: '9x39mm BP gs', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // 貫通54
    { name: '5.56x45mm M855A1 (M855A1)', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // 貫通44
    { name: '5.56x45mm M856A1 (856AI)', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // 貫通38
    { name: '5.45x39mm BP', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // 貫通45
    { name: '9x39mm SP-6 gs', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // 貫通48
    { name: '9x39mm PAB-9 gs', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // 貫通43
    { name: '9x39mm SPP gs', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // 貫通35
    { name: '12.7x55mm PS12B', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // 貫通46、ダメージ102
    { name: '12.7x55mm PS12A', color: 0xffd700, itemType: 'ammo', weight: 0.3 }, // ダメージ165（極高）
    { name: '5.56x45mm Warmageddon', color: 0xffd700, itemType: 'ammo', weight: 0.3 }, // ダメージ88（極高）
    { name: '5.56x45mm HP', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // ダメージ79（極高）
    { name: '5.45x39mm HP', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // ダメージ76（極高）
    { name: '5.45x39mm PRS gs', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // ダメージ70（極高）
    { name: '5.45x39mm SP', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // ダメージ67（極高）
    { name: '5.45x39mm US gs', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // ダメージ65（極高）
    { name: '9x39mm SP-5 gs', color: 0xffd700, itemType: 'ammo', weight: 0.4 }, // ダメージ71（極高）
    { name: '5.56x45mm M855 (M855)', color: 0xffd700, itemType: 'ammo', weight: 1.0 }, // 中程度
    { name: '5.56x45mm M856 (M856)', color: 0xffd700, itemType: 'ammo', weight: 1.0 }, // 中程度
    { name: '5.56x45mm Mk318 Mod 0 (SOFT)', color: 0xffd700, itemType: 'ammo', weight: 1.0 }, // 中程度
    { name: '5.45x39mm PS', color: 0xffd700, itemType: 'ammo', weight: 1.0 }, // 中程度
    { name: '5.45x39mm PP', color: 0xffd700, itemType: 'ammo', weight: 1.0 }, // 中程度
    { name: '5.45x39mm BT', color: 0xffd700, itemType: 'ammo', weight: 1.0 }, // 中程度
    { name: '5.45x39mm T gs', color: 0xffd700, itemType: 'ammo', weight: 1.0 }, // 中程度
    { name: '5.45x39mm 7N40', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // 貫通42、特殊効果多
    { name: '9x39mm FMJ', color: 0xffd700, itemType: 'ammo', weight: 0.8 }, // 中程度
    { name: '12.7x55mm PS12', color: 0xffd700, itemType: 'ammo', weight: 0.5 }, // ダメージ115（極高）
    { name: '5.56x45mm FMJ', color: 0xffd700, itemType: 'ammo', weight: 2.0 }, // 低性能
    { name: '5.56x45mm Mk255 Mod 0 (RRLP)', color: 0xffd700, itemType: 'ammo', weight: 2.0 }, // 低性能
    { name: '5.45x39mm FMJ', color: 0xffd700, itemType: 'ammo', weight: 2.0 }, // 低性能
    // フレア（かなり低確率）
    { name: 'Red Flare', color: 0xff0000, itemType: 'flare', weight: 0.1 },
    { name: 'Green Flare', color: 0x00ff00, itemType: 'flare', weight: 0.1 },
    { name: 'Yellow Flare', color: 0xffff00, itemType: 'flare', weight: 0.1 },
    // Other items (for hideout upgrades and tasks)
    // レア度1 (Common) - 43.9%
    { name: 'CPU fan', color: 0x888888, itemType: 'other', weight: 2.5 },
    { name: 'cord', color: 0x654321, itemType: 'other', weight: 2.5 },
    { name: 'PCB', color: 0x4a4a4a, itemType: 'other', weight: 2.5 },
    { name: 'Tube', color: 0xcccccc, itemType: 'other', weight: 2.5 },
    { name: 'wier', color: 0xaaaaaa, itemType: 'other', weight: 2.5 },
    { name: 'Bolt', color: 0x666666, itemType: 'other', weight: 2.5 },
    { name: 'caps', color: 0x777777, itemType: 'other', weight: 2.5 },
    { name: 'vitamin', color: 0xffd700, itemType: 'other', weight: 2.5 },
    { name: 'NaCl', color: 0xffffff, itemType: 'other', weight: 2.5 },
    // レア度2 (Uncommon) - 25%
    { name: 'fabric', color: 0xffb6c1, itemType: 'other', weight: 1.2 },
    { name: 'Power Unit', color: 0x4169e1, itemType: 'other', weight: 1.2 },
    { name: 'T-Plug', color: 0x32cd32, itemType: 'other', weight: 1.2 },
    { name: 'Meds', color: 0xff69b4, itemType: 'other', weight: 1.2 },
    { name: 'sadium', color: 0xffff00, itemType: 'other', weight: 1.2 },
    { name: 'Nuts', color: 0x8b4513, itemType: 'other', weight: 1.2 },
    { name: 'poxeram', color: 0x9370db, itemType: 'other', weight: 1.2 },
    { name: 'screw', color: 0x708090, itemType: 'other', weight: 1.2 },
    { name: 'ES lamp', color: 0xffd700, itemType: 'other', weight: 1.2 },
    { name: 'manual', color: 0xdeb887, itemType: 'other', weight: 1.2 },
    { name: 'WD-40', color: 0x4682b4, itemType: 'other', weight: 1.2 },
    { name: 'Shus', color: 0xda70d6, itemType: 'other', weight: 1.2 },
    { name: 'Duct tape', color: 0x808080, itemType: 'other', weight: 1.2 },
    { name: 'weapon parts', color: 0x2f4f4f, itemType: 'other', weight: 1.2 },
    { name: 'Thermite', color: 0xff4500, itemType: 'other', weight: 1.2 },
    { name: 'Bloodset', color: 0xdc143c, itemType: 'other', weight: 1.2 },
    { name: 'Med tool', color: 0xff1493, itemType: 'other', weight: 1.2 },
    { name: 'Oscope', color: 0x00ced1, itemType: 'other', weight: 1.2 },
    // レア度3 (Rare) - 20%
    { name: 'Relay', color: 0x1e90ff, itemType: 'other', weight: 0.8 },
    { name: 'M.parts', color: 0x4682b4, itemType: 'other', weight: 0.8 },
    { name: 'wrench', color: 0x696969, itemType: 'other', weight: 0.8 },
    { name: 'Hose', color: 0x0000ff, itemType: 'other', weight: 0.8 },
    { name: 'Majaica', color: 0x9370db, itemType: 'other', weight: 0.8 },
    { name: 'MTape', color: 0x808080, itemType: 'other', weight: 0.8 },
    { name: 'Master', color: 0x2f4f4f, itemType: 'other', weight: 0.8 },
    { name: 'Nails', color: 0x708090, itemType: 'other', weight: 0.8 },
    { name: 'Ellte', color: 0x4169e1, itemType: 'other', weight: 0.8 },
    // レア度4 (Epic) - 10%
    { name: 'spark plug', color: 0xff6347, itemType: 'other', weight: 0.3 },
    { name: 'VPX', color: 0x9370db, itemType: 'other', weight: 0.3 },
    { name: 'Pfilter', color: 0x00ced1, itemType: 'other', weight: 0.3 },
    { name: 'Mortor', color: 0x8b4513, itemType: 'other', weight: 0.3 },
    { name: 'Buldex', color: 0x4b0082, itemType: 'other', weight: 0.3 },
    { name: 'cleaner', color: 0x87ceeb, itemType: 'other', weight: 0.3 },
    { name: 'skull', color: 0xf5f5dc, itemType: 'other', weight: 0.3 },
    { name: 'T set', color: 0x2f4f4f, itemType: 'other', weight: 0.3 },
    { name: 'KEK', color: 0xffd700, itemType: 'other', weight: 0.3 },
    // レア度5 (Legendary) - 1%
    { name: 'syringe', color: 0xff1493, itemType: 'other', weight: 0.05 },
    { name: 'Tang battery', color: 0x32cd32, itemType: 'other', weight: 0.05 },
    { name: 'salt', color: 0xffffff, itemType: 'other', weight: 0.05 },
    { name: 'alkali', color: 0xffd700, itemType: 'other', weight: 0.05 },
    { name: 'Roostar', color: 0xff6347, itemType: 'other', weight: 0.05 },
    { name: 'Roler', color: 0xffd700, itemType: 'other', weight: 0.05 },
    { name: 'gold chain', color: 0xffd700, itemType: 'other', weight: 0.05 },
    { name: 'Lion', color: 0xffa500, itemType: 'other', weight: 0.05 },
    { name: 'E dril', color: 0x696969, itemType: 'other', weight: 0.05 },
    { name: 'Hand drill', color: 0x708090, itemType: 'other', weight: 0.05 },
    // レア度6 (Mythic) - 0.1%
    { name: 'LEDX', color: 0xff00ff, itemType: 'other', weight: 0.01 }
];

// ドッグタグデータ
const DOGTAG_DATA = {
    'ドッグタグ king of zombie': {
        name: 'ドッグタグ king of zombie',
        stashSize: { width: 1, height: 1 },
        imageFile: 'dogtag.png'
    }
};

// フレアデータ
const FLARE_DATA = {
    'Red Flare': {
        name: 'Red Flare',
        stashSize: { width: 1, height: 2 },
        imageFile: 'Red Flare.png',
        purpose: 'ケアパッケージの要請'
    },
    'Green Flare': {
        name: 'Green Flare',
        stashSize: { width: 1, height: 2 },
        imageFile: 'Green Flare.png',
        purpose: '特定脱出'
    },
    'Yellow Flare': {
        name: 'Yellow Flare',
        stashSize: { width: 1, height: 2 },
        imageFile: 'Yellow Flare.png',
        purpose: '緊急脱出'
    }
};
const BASE_FOREST_TREE_COUNT = 10400;
const TREE_COLLISION_PROBABILITY = 0.55;
const BASE_GRASS_BLADE_COUNT = 200000;
const BASE_BUSH_CLUSTER_COUNT = 600;
const TERRAIN_SEGMENTS = 256;
const TERRAIN_HILL_DATA = [
    { x: 220, z: -180, radius: 140, amplitude: 16 },
    { x: -260, z: 140, radius: 150, amplitude: 18 },
    { x: -120, z: -260, radius: 120, amplitude: 12 },
    { x: 260, z: 260, radius: 130, amplitude: 10 }
];
const TIME_OF_DAY_KEY = 'timeOfDay';
const VIDEO_SETTINGS_KEY = 'videoSettings';
const VIDEO_SETTINGS_DEFAULTS = {
    resolutionScale: 1.0,
    textureQuality: 'high',
    shadowQuality: 'high',
    drawDistance: 'medium',
    vegetationDensity: 'medium',
    fogDensity: 'medium'
};
const DRAW_DISTANCE_PRESETS = {
    short: { near: 80, mid: 220, far: 450, chase: 140, disengage: 140 * 3.9 },
    medium: { near: 100, mid: 300, far: 600, chase: 180, disengage: 180 * 3.9 },
    long: { near: 140, mid: 380, far: 780, chase: 230, disengage: 230 * 3.9 }
};
const VEGETATION_DENSITY_MULTIPLIERS = {
    low: 0.6,
    medium: 1.0,
    high: 1.4
};
const SHADOW_QUALITY_PRESETS = {
    off: { enabled: false },
    low: { enabled: true, mapSize: 1024, type: THREE.BasicShadowMap },
    medium: { enabled: true, mapSize: 2048, type: THREE.PCFShadowMap },
    high: { enabled: true, mapSize: 4096, type: THREE.PCFSoftShadowMap }
};
const FOG_DENSITY_PRESETS = {
    off: { background: 0x87ceeb, density: 0 },
    low: { background: 0x7fb1d3, density: 0.00008 },
    medium: { background: 0x6c91c0, density: 0.00018 },
    high: { background: 0x4c5a73, density: 0.00032 }
};
const MANSION_CONFIG = {
    position: { x: 120, z: -80 },
    size: { width: 80, depth: 60 },
    height: 26,
    secondFloorHeight: 12,
    wallThickness: 1.2,
    door: { width: 10, height: 9 },
    clearance: 25
};

const TERRAIN_FLATTEN_ZONES = [
    { x: 0, z: 0, radius: 28, height: 0 },
    { x: MANSION_CONFIG.position.x, z: MANSION_CONFIG.position.z, radius: Math.max(MANSION_CONFIG.size.width, MANSION_CONFIG.size.depth) * 0.75 + MANSION_CONFIG.clearance, height: 0 }
];

let cachedVideoSettings = null;
let cachedVegetationConfig = null;

function smoothstep01(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
}

function hillContribution(x, z, hill) {
    const dx = x - hill.x;
    const dz = z - hill.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance >= hill.radius) return 0;
    const normalized = distance / hill.radius;
    const falloff = Math.cos(normalized * Math.PI) * 0.5 + 0.5;
    return hill.amplitude * falloff * falloff;
}

function applyFlattenZones(height, x, z) {
    let result = height;
    for (const zone of TERRAIN_FLATTEN_ZONES) {
        const dx = x - zone.x;
        const dz = z - zone.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance >= zone.radius) continue;
        const blend = smoothstep01(distance / zone.radius);
        result = THREE.MathUtils.lerp(zone.height, result, blend);
    }
    return result;
}

function getTerrainHeight(x, z) {
    const freq1 = 0.0014;
    const freq2 = 0.0036;
    let height = Math.sin(x * freq1) * 6 + Math.cos(z * freq1) * 6;
    height += Math.sin((x + z) * freq2) * 3;
    height += Math.cos((x - z) * 0.0025) * 4;
    height += Math.sin(Math.sqrt(x * x + z * z) * 0.015) * 2.5;
    for (const hill of TERRAIN_HILL_DATA) {
        height += hillContribution(x, z, hill);
    }
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const edgeFade = THREE.MathUtils.clamp((distanceFromCenter - MAP_SIZE * 0.45) / (MAP_SIZE * 0.1), 0, 1);
    if (edgeFade > 0) {
        height *= 1 - edgeFade * 0.6;
    }
    return applyFlattenZones(height, x, z);
}

function loadVideoSettings() {
    try {
        const raw = localStorage.getItem(VIDEO_SETTINGS_KEY);
        if (!raw) return { ...VIDEO_SETTINGS_DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...VIDEO_SETTINGS_DEFAULTS, ...parsed };
    } catch (error) {
        console.warn('ビデオ設定の読み込みに失敗しました:', error);
        return { ...VIDEO_SETTINGS_DEFAULTS };
    }
}

function getVideoSettings() {
    if (!cachedVideoSettings) {
        cachedVideoSettings = loadVideoSettings();
    }
    return cachedVideoSettings;
}

function getVideoSettingValue(key) {
    const settings = getVideoSettings();
    if (settings && Object.prototype.hasOwnProperty.call(settings, key)) {
        return settings[key];
    }
    return VIDEO_SETTINGS_DEFAULTS[key];
}

function getTextureAnisotropy() {
    const base = renderer?.capabilities?.getMaxAnisotropy?.() || 1;
    const quality = getVideoSettingValue('textureQuality');
    const factorMap = { low: 0.35, medium: 0.65, high: 1 };
    const factor = factorMap[quality] ?? 1;
    return Math.max(1, Math.floor(base * factor));
}

function getVegetationConfig() {
    if (cachedVegetationConfig) {
        return cachedVegetationConfig;
    }
    const density = VEGETATION_DENSITY_MULTIPLIERS[getVideoSettingValue('vegetationDensity')] ?? 1;
    cachedVegetationConfig = {
        treeCount: Math.max(500, Math.floor(BASE_FOREST_TREE_COUNT * density)),
        grassCount: Math.max(0, Math.floor(BASE_GRASS_BLADE_COUNT * density)),
        bushCount: Math.max(0, Math.floor(BASE_BUSH_CLUSTER_COUNT * density))
    };
    return cachedVegetationConfig;
}

function applyRendererSizing() {
    if (!renderer) return;
    const resolutionScale = Math.min(Math.max(getVideoSettingValue('resolutionScale') || 1, 0.1), 2.0);
    const pixelRatio = Math.min((window.devicePixelRatio || 1) * resolutionScale, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function applyShadowQuality(light) {
    const preset = SHADOW_QUALITY_PRESETS[getVideoSettingValue('shadowQuality')] || SHADOW_QUALITY_PRESETS.high;
    if (!preset.enabled) {
        renderer.shadowMap.enabled = false;
        light.castShadow = false;
        return;
    }
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = preset.type;
    light.castShadow = true;
    light.shadow.mapSize.width = preset.mapSize;
    light.shadow.mapSize.height = preset.mapSize;
}

function getTimeOfDayMode() {
    const stored = localStorage.getItem(TIME_OF_DAY_KEY);
    return stored === 'night' ? 'night' : 'day';
}

function getFogConfig(timeOfDayMode) {
    const preset = FOG_DENSITY_PRESETS[getVideoSettingValue('fogDensity')] || FOG_DENSITY_PRESETS.medium;
    let background = preset.background;
    let density = preset.density;
    if (timeOfDayMode === 'night') {
        background = 0x050912;
        density = density > 0 ? density * 1.35 : 0.00012;
    }
    const fog = density > 0 ? new THREE.FogExp2(background, density) : null;
    return {
        background,
        fog
    };
}

function createCelestialBody(light, mode) {
    if (!scene || !light) return;
    if (celestialBodyMesh) {
        scene.remove(celestialBodyMesh);
        celestialBodyMesh.geometry.dispose();
        celestialBodyMesh.material.dispose();
    }
    const isNight = mode === 'night';
    const radius = isNight ? 15 : 25;
    const color = isNight ? 0xcfd9ff : 0xfff4c2;
    const emissiveIntensity = isNight ? 0.9 : 1.5;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color,
        emissive: color,
        emissiveIntensity
    });
    celestialBodyMesh = new THREE.Mesh(geometry, material);
    const direction = light.position.clone().normalize();
    const distance = isNight ? 950 : 1200;
    celestialBodyMesh.position.copy(direction.multiplyScalar(distance));
    celestialBodyMesh.renderOrder = -1;
    scene.add(celestialBodyMesh);
}

function getDrawDistanceConfig() {
    return DRAW_DISTANCE_PRESETS[getVideoSettingValue('drawDistance')] || DRAW_DISTANCE_PRESETS.medium;
}

const WEAPON_MODEL_CONFIGS = {
    default: {
        bodyLength: 0.55,
        bodyHeight: 0.1,
        bodyDepth: 0.09,
        barrelLength: 0.35,
        stockLength: 0.25,
        magazineHeight: 0.18,
        gripLength: 0.12,
        handguardLength: 0.25,
        magazineTilt: -15,
        bodyColor: 0x2f3236,
        accentColor: 0x1b1d1f,
        detailColor: 0x555555
    },
    M4A1: {
        bodyLength: 0.6,
        bodyHeight: 0.1,
        bodyDepth: 0.08,
        barrelLength: 0.45,
        stockLength: 0.35,
        magazineHeight: 0.2,
        gripLength: 0.15,
        handguardLength: 0.3,
        magazineTilt: -18,
        bodyColor: 0x2e2f32,
        accentColor: 0x1a1b1d,
        detailColor: 0x45484d
    },
    'AK-74M': {
        bodyLength: 0.58,
        bodyHeight: 0.1,
        bodyDepth: 0.09,
        barrelLength: 0.4,
        stockLength: 0.32,
        magazineHeight: 0.22,
        gripLength: 0.13,
        handguardLength: 0.28,
        magazineTilt: -25,
        bodyColor: 0x3a2f23,
        accentColor: 0x1f140f,
        detailColor: 0x5c4a37
    },
    'Ash-12': {
        bodyLength: 0.5,
        bodyHeight: 0.12,
        bodyDepth: 0.12,
        barrelLength: 0.3,
        stockLength: 0.28,
        magazineHeight: 0.18,
        gripLength: 0.16,
        handguardLength: 0.2,
        magazineTilt: -10,
        bodyColor: 0x363b42,
        accentColor: 0x1f2328,
        detailColor: 0x565c66
    },
    'AS VAL': {
        bodyLength: 0.45,
        bodyHeight: 0.09,
        bodyDepth: 0.08,
        barrelLength: 0.25,
        stockLength: 0.2,
        magazineHeight: 0.17,
        gripLength: 0.12,
        handguardLength: 0.18,
        suppressorLength: 0.35,
        magazineTilt: -12,
        bodyColor: 0x2d3433,
        accentColor: 0x171d1c,
        detailColor: 0x4a5654,
        viewRotationDeg:{x: 0, y: -80, z: 0},
        viewOffset:{x: 0.5, y: -0.4, z: -0.4}
    }
};

const AMMO_DATA = {
    '5.56x45mm FMJ': { damage: 57, penetration: 23, velocity: 957, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm FMJ.png' },
    '5.56x45mm HP': { damage: 79, penetration: 7, velocity: 947, special: '軽度出血確率+15%,重度出血確率+15%', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm HP.png' },
    '5.56x45mm M855 (M855)': { damage: 54, penetration: 32, velocity: 922, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm M855 (M855).png' },
    '5.56x45mm M855A1 (M855A1)': { damage: 49, penetration: 44, velocity: 945, special: '精度-5%,反動+5%', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm M855A1 (M855A1).png' },
    '5.56x45mm M856 (M856)': { damage: 60, penetration: 18, velocity: 874, special: '精度-2%,反動-2%,曳光弾（赤）', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm M856 (M856).png' },
    '5.56x45mm M856A1 (856AI)': { damage: 52, penetration: 38, velocity: 940, special: '精度-4%,反動+4%,曳光弾（赤）', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm M856A1 (856AI).png' },
    '5.56x45mm M995 (M995)': { damage: 42, penetration: 53, velocity: 1013, special: '精度-7%,反動+8%', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm M995 (M995).png' },
    '5.56x45mm Mk255 Mod 0 (RRLP)': { damage: 72, penetration: 11, velocity: 936, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm Mk255 Mod 0 (RRLP).png' },
    '5.56x45mm Mk318 Mod 0 (SOFT)': { damage: 53, penetration: 33, velocity: 902, special: '精度+2%,反動+3%,軽度出血確率+15%,重度出血確率+10%', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm Mk318 Mod 0 (SOFT).png' },
    '5.56x45mm SSA AP': { damage: 38, penetration: 57, velocity: 1013, special: '精度-9%,反動+6%', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm SSA AP.png' },
    '5.56x45mm Warmageddon': { damage: 88, penetration: 3, velocity: 936, special: '精度+10%,反動+10%,軽度出血確率+20%,重度出血確率+20%', stashSize: { width: 1, height: 1 }, imageFile: '5.56x45mm Warmageddon.png' },
    '5.45x39mm BP': { damage: 48, penetration: 45, velocity: 890, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm BP.png' },
    '5.45x39mm 7N40': { damage: 55, penetration: 42, velocity: 915, special: '精度+50%,反動-10%,軽度出血確率+20%,重度出血確率+15%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm 7N40.png' },
    '5.45x39mm BS': { damage: 45, penetration: 54, velocity: 830, special: '精度-4%,反動+10%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm BS.png' },
    '5.45x39mm BT': { damage: 54, penetration: 37, velocity: 880, special: '曳光弾（赤）,精度-4%,反動+5%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm BT.png' },
    '5.45x39mm FMJ': { damage: 55, penetration: 24, velocity: 884, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm FMJ.png' },
    '5.45x39mm HP': { damage: 76, penetration: 9, velocity: 884, special: '精度+3%,反動-3%,軽度出血確率+15%,重度出血確率+15%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm HP.png' },
    '5.45x39mm PP': { damage: 51, penetration: 34, velocity: 886, special: '精度-2%,反動+3%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm PP.png' },
    '5.45x39mm PPBS gs Igolnik': { damage: 37, penetration: 62, velocity: 905, special: '精度-5%,反動+15%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm PPBS.png' },
    '5.45x39mm PRS gs': { damage: 70, penetration: 13, velocity: 866, special: '反動-5%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm PRS.png' },
    '5.45x39mm PS': { damage: 56, penetration: 28, velocity: 890, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm PS.png' },
    '5.45x39mm SP': { damage: 67, penetration: 15, velocity: 873, special: '精度+5%,反動-5%,軽度出血確率+10%,重度出血確率+10%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm SP.png' },
    '5.45x39mm T gs': { damage: 59, penetration: 20, velocity: 883, special: '精度-3%,曳光弾（赤）', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm T gs.png' },
    '5.45x39mm US gs': { damage: 65, penetration: 17, velocity: 303, special: '亜音速,反動-15%', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm US gs.png' },
    '12.7x55mm PS12': { damage: 115, penetration: 28, velocity: 300, special: '亜音速,精度+10%,軽度出血確率+30%,重度出血確率+20%', stashSize: { width: 1, height: 1 }, imageFile: '12.7x55mm PS12.png' },
    '12.7x55mm PS12A': { damage: 165, penetration: 10, velocity: 870, special: '亜音速,精度-15%,反動-12%,軽度出血確率35%,重度出血確率+30%', stashSize: { width: 1, height: 1 }, imageFile: '12.7x55mm PS12A.png' },
    '12.7x55mm PS12B': { damage: 102, penetration: 46, velocity: 570, special: '亜音速', stashSize: { width: 1, height: 1 }, imageFile: '12.7x55mm PS12B.png' },
    '9x39mm FMJ': { damage: 75, penetration: 17, velocity: 330, special: '亜音速', stashSize: { width: 1, height: 1 }, imageFile: '9x39mm FMJ.png' },
    '9x39mm BP gs': { damage: 58, penetration: 54, velocity: 295, special: '精度+10%,反動+15%,亜音速', stashSize: { width: 1, height: 1 }, imageFile: '9x39mm BP gs.png' },
    '9x39mm PAB-9 gs': { damage: 62, penetration: 43, velocity: 320, special: '精度-15%,反動+10%,軽度出血確率+10%,重度出血確率+12%,亜音速', stashSize: { width: 1, height: 1 }, imageFile: '9x39mm PAB-9 gs.png' },
    '9x39mm SP-5 gs': { damage: 71, penetration: 28, velocity: 290, special: '重度出血確率+10%,亜音速', stashSize: { width: 1, height: 1 }, imageFile: '9x39mm SP-5 gs.png' },
    '9x39mm SP-6 gs': { damage: 60, penetration: 48, velocity: 305, special: '反動+5%,軽度出血確率+10%,重度出血確率+10%,亜音速', stashSize: { width: 1, height: 1 }, imageFile: '9x39mm SP-6 gs.png' },
    '9x39mm SPP gs': { damage: 68, penetration: 35, velocity: 310, special: '精度+10%,反動+7%,軽度出血確率+10%,重度出血確率+20%,亜音速', stashSize: { width: 1, height: 1 }, imageFile: '9x39mm SPP gs.png' },
    '7.62x51mm BCP FMJ': { damage: 83, penetration: 37, velocity: 800, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm BCP FMJ.png' },
    '7.62x51mm M61': { damage: 75, penetration: 55, velocity: 838, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm M61.png' },
    '7.62x51mm M62 Tracer': { damage: 82, penetration: 42, velocity: 838, special: '曳光弾（緑）', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm M62 Tracer.png' },
    '7.62x51mm M80': { damage: 80, penetration: 43, velocity: 838, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm M80.png' },
    '7.62x51mm M80A1': { damage: 73, penetration: 60, velocity: 899, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm M80A1.png' },
    '7.62x51mm M993': { damage: 70, penetration: 65, velocity: 930, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm M993.png' },
    '7.62x51mm TCW SP': { damage: 85, penetration: 30, velocity: 771, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm TCW SP.png' },
    '7.62x51mm Ultra Noiser': { damage: 105, penetration: 15, velocity: 823, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x51mm Ultra Noiser.png' },
    '.300 blackout AP': { damage: 51, penetration: 48, velocity: 635, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '.300 blackout AP.png' },
    '.300 blackout BCP FMJ': { damage: 60, penetration: 30, velocity: 605, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '.300 blackout BCP FMJ.png' },
    '.300 blackout CBJ': { damage: 58, penetration: 43, velocity: 725, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '.300 blackout CBJ.png' },
    '.300 blackout M62 Tracer': { damage: 54, penetration: 36, velocity: 442, special: '曳光弾（赤）', stashSize: { width: 1, height: 1 }, imageFile: '.300 blackout M62 Tracer.png' },
    '.300 blackout V-Max': { damage: 72, penetration: 20, velocity: 723, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '.300 blackout V-Max.png' },
    '.300 blackout Whisper': { damage: 90, penetration: 14, velocity: 853, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '.300 blackout Whisper.png' },
    '7.62x39mm BP gzh': { damage: 58, penetration: 47, velocity: 730, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm BP gzh.png' },
    '7.62x39mm FMJ': { damage: 63, penetration: 26, velocity: 775, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm FMJ.png' },
    '7.62x39mm HP': { damage: 80, penetration: 15, velocity: 754, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm HP.png' },
    '7.62x39mm MAI AP': { damage: 53, penetration: 58, velocity: 875, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm MAI AP.png' },
    '7.62x39mm PP gzh': { damage: 59, penetration: 41, velocity: 732, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm PP gzh.png' },
    '7.62x39mm PS gzh': { damage: 61, penetration: 35, velocity: 717, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm PS gzh.png' },
    '7.62x39mm SP': { damage: 68, penetration: 20, velocity: 772, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm SP.png' },
    '7.62x39mm T-45M1 gzh': { damage: 65, penetration: 30, velocity: 720, special: '曳光弾（赤）', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm T-45M1 gzh.png' },
    '7.62x39mm US gzh': { damage: 56, penetration: 29, velocity: 301, special: '亜音速', stashSize: { width: 1, height: 1 }, imageFile: '7.62x39mm US gzh.png' },
    '6.8x51mm SIG FMJ': { damage: 80, penetration: 36, velocity: 899, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '6.8x51mm SIG FMJ.png' },
    '6.8x51mm SIG Hybrid': { damage: 72, penetration: 47, velocity: 914, special: 'None', stashSize: { width: 1, height: 1 }, imageFile: '6.8x51mm SIG Hybrid.png' },
    '12x70mm 8.5mm Magnum Buckshot': { 
        damage: 50, // 1発あたりのダメージ（8発同時発射で合計400）
        penetration: 2, 
        velocity: 385, 
        special: '精度-15%,反動+115%', 
        stashSize: { width: 1, height: 1 }, 
        imageFile: '12x70mm 8.5mm Magnum Buckshot.png',
        isBuckshot: true, // バックショットフラグ
        pelletCount: 8 // 散弾数
    }
};

const MAGAZINE_DATA = {
    '5.56x45mm standard 30連マガジン': { capacity: 30, ammoType: '5.56x45mm', stashSize: { width: 1, height: 2 }, imageFile: '5.56x45mm standard 30連マガジン.png' },
    '5.45x39mm standard 30連マガジン': { capacity: 30, ammoType: '5.45x39mm', stashSize: { width: 1, height: 2 }, imageFile: '5.45x39mm standard 30連マガジン.png' },
    'Ash-12用 10連マガジン': { capacity: 10, ammoType: '12.7x55mm', stashSize: { width: 1, height: 2 }, imageFile: 'Ash-12用 10連マガジン.png' },
    'Ash-12用 20連マガジン': { capacity: 20, ammoType: '12.7x55mm', stashSize: { width: 1, height: 2 }, imageFile: 'Ash-12用 20連マガジン.png' },
    'AS VAL用15連マガジン': { capacity: 15, ammoType: '9x39mm', stashSize: { width: 1, height: 1 }, imageFile: 'AS VAL用 15連マガジン.png' },
    'AS VAL用 30連マガジン': { capacity: 30, ammoType: '9x39mm', stashSize: { width: 1, height: 2 }, imageFile: 'AS VAL用 30連マガジン.png' },
    '5.56x45mm over 100連マガジン': { capacity: 100, ammoType: '5.56x45mm', stashSize: { width: 2, height: 2 }, imageFile: '5.56x45mm standard 30連マガジン.png' },
    '7.61x51mm standard 30連マガジン': { capacity: 30, ammoType: '7.62x51mm', stashSize: { width: 1, height: 2 }, imageFile: '5.56x45mm standard 30連マガジン.png' },
    '7.61x51mm short 20連マガジン': { capacity: 20, ammoType: '7.62x51mm', stashSize: { width: 1, height: 2 }, imageFile: '5.56x45mm standard 30連マガジン.png' },
    '7.62x39mm standard 30連マガジン': { capacity: 30, ammoType: '7.62x39mm', stashSize: { width: 1, height: 2 }, imageFile: '5.45x39mm standard 30連マガジン.png' },
    '7.62x39mm short 15連マガジン': { capacity: 15, ammoType: '7.62x39mm', stashSize: { width: 1, height: 1 }, imageFile: '5.45x39mm standard 30連マガジン.png' },
    '6.8x51mm standard 30連マガジン': { capacity: 30, ammoType: '6.8x51mm', stashSize: { width: 1, height: 2 }, imageFile: '5.56x45mm standard 30連マガジン.png' },
    '6.8x51mm short 15連マガジン': { capacity: 15, ammoType: '6.8x51mm', stashSize: { width: 1, height: 2 }, imageFile: '5.56x45mm standard 30連マガジン.png' },
    '.300 blackout standard 30連マガジン': { capacity: 30, ammoType: '.300 blackout', stashSize: { width: 1, height: 2 }, imageFile: '5.56x45mm standard 30連マガジン.png' }
};

const AMMO_IMAGE_BASE_PATH = '/pic/ammo/';
const BACKPACK_IMAGE_BASE_PATH = '/pic/backpack/';
const RIG_IMAGE_BASE_PATH = '/pic/rig/';
const GUN_IMAGE_BASE_PATH = '/pic/gun/';
const MEDICAL_IMAGE_BASE_PATH = '/pic/medkit/';
const MAGAZINE_IMAGE_BASE_PATH = '/pic/magazin/';
const ARMOR_IMAGE_BASE_PATH = '/pic/armor/';
const BODY_PART_KEYS = ['head', 'face', 'chest', 'stomach', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
const MEDICAL_PART_PRIORITY = ['head', 'chest', 'rightLeg', 'leftLeg', 'stomach', 'rightArm', 'leftArm'];
const SPECIAL_MEDICAL_ITEMS = new Set([
    'AFAK tactical individual first aid kit',
    'AI-2 medkit (AI-2)',
    'Car first aid kit',
    'Grizzly medical kit',
    'IFAK individual first aid kit',
    'Salewa first aid kit (Salewa)'
]);
const HEALING_MEDICAL_ITEMS = new Set([
    'AI-2 medkit (AI-2)',
    'Salewa first aid kit (Salewa)',
    'AFAK tactical individual first aid kit',
    'Car first aid kit',
    'Grizzly medical kit',
    'IFAK individual first aid kit'
]);

// 自己ダメージUI要素
const selfDamagePanel = document.getElementById('selfDamagePanel');
const selfDamageToggle = document.getElementById('selfDamageToggle');
const selfDamageBodySelect = document.getElementById('selfDamageBody');
const selfDamageAmountInput = document.getElementById('selfDamageAmount');
const selfDamageApplyButton = document.getElementById('selfDamageApply');
const selfDamageStatusButtons = document.querySelectorAll('#selfDamagePanel .status-btn');
const medicalProgressContainer = document.getElementById('medicalUseProgress');
const medicalProgressLabel = document.getElementById('medicalUseLabel');
const medicalProgressFill = document.getElementById('medicalUseProgressFill');
const medicalModeModal = document.getElementById('medicalModeModal');
const medicalModeHealButton = document.getElementById('medicalModeHealButton');
const medicalModeStatusButton = document.getElementById('medicalModeStatusButton');
const medicalModeCancelButton = document.getElementById('medicalModeCancelButton');
const raidSparkCountElement = document.getElementById('raidSparkCount');
const raidFuelCountElement = document.getElementById('raidFuelCount');
const INTERACTIVE_UI_SELECTORS = ['#selfDamageContainer', '#inventoryOverlay', '#inventoryScreen', '#medicalModeModal'];
let pendingMedicalSelection = null;
let medicalUseState = {
    active: false,
    start: 0,
    duration: 0,
    itemId: null,
    medicalName: null,
    mode: 'statusFirst',
    availableDurability: 0,
    currentTargetPart: null, // 現在治療中の部位
    currentTargetStatus: null // 現在治療中の異常状態タイプ ('lightBleeding', 'heavyBleeding', 'fracture', 'blackedOut', 'heal')
};

// 医薬品データ
const MEDICAL_DATA = {
    'AI-2 medkit (AI-2)': {
        name: 'AI-2 medkit (AI-2)',
        cures: [],
        durability: 100,
        useTime: 2,
        stashSize: { width: 1, height: 1 },
        imageFile: 'AI-2.png'
    },
    'Salewa first aid kit (Salewa)': {
        name: 'Salewa first aid kit (Salewa)',
        cures: ['lightBleeding', 'heavyBleeding'],
        lightBleedingCost: 45,
        heavyBleedingCost: 175,
        durability: 400,
        useTime: 3,
        stashSize: { width: 1, height: 2 },
        imageFile: 'Salewa.png'
    },
    'Aseptic bandage (Bandage)': {
        name: 'Aseptic bandage (Bandage)',
        cures: ['lightBleeding'],
        lightBleedingCost: 1,
        durability: 1,
        useTime: 2,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Bandage.png'
    },
    'Esmarch tourniquet (Esmarch)': {
        name: 'Esmarch tourniquet (Esmarch)',
        cures: ['heavyBleeding'],
        heavyBleedingCost: 1,
        durability: 1,
        useTime: 5,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Esmarch.png'
    },
    'Immobilizing splint (Splint)': {
        name: 'Immobilizing splint (Splint)',
        cures: ['fracture'],
        fractureCost: 1,
        durability: 1,
        useTime: 5,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Splint.png'
    },
    'Analgin painkillers (Analgin)': {
        name: 'Analgin painkillers (Analgin)',
        cures: ['pain'],
        painCost: 1,
        durability: 4,
        useTime: 3,
        duration: 80,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Analgin.png'
    },
    'Aluminum splint': {
        name: 'Aluminum splint',
        cures: ['fracture'],
        fractureCost: 1,
        durability: 5,
        useTime: 3,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Aluminum splint.png'
    },
    'Army bandage': {
        name: 'Army bandage',
        cures: ['lightBleeding'],
        lightBleedingCost: 1,
        durability: 2,
        useTime: 2,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Army bandage.png'
    },
    'CALOK-B hemostatic applicator': {
        name: 'CALOK-B hemostatic applicator',
        cures: ['heavyBleeding'],
        heavyBleedingCost: 1,
        durability: 3,
        useTime: 3,
        stashSize: { width: 1, height: 1 },
        imageFile: 'CALOK-B hemostatic applicator.png'
    },
    'CAT hemostatic tourniquet': {
        name: 'CAT hemostatic tourniquet',
        cures: ['heavyBleeding'],
        heavyBleedingCost: 1,
        durability: 1,
        useTime: 3,
        stashSize: { width: 1, height: 1 },
        imageFile: 'CAT hemostatic tourniquet.png'
    },
    'Golden star balm': {
        name: 'Golden star balm',
        cures: ['pain'],
        painCost: 1,
        durability: 10,
        useTime: 7,
        duration: 350,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Golden Star balm.png'
    },
    'Surv12 field surgical kit': {
        name: 'Surv12 field surgical kit',
        cures: ['blackedOut'],
        blackedOutCost: 1,
        durability: 15,
        useTime: 20,
        stashSize: { width: 3, height: 1 },
        imageFile: 'Surv12 field surgical kit.png'
    },
    'Vaseline balm': {
        name: 'Vaseline balm',
        cures: ['pain'],
        painCost: 1,
        durability: 6,
        useTime: 6,
        duration: 300,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Vaseline balm.png'
    },
    'AFAK tactical individual first aid kit': {
        name: 'AFAK tactical individual first aid kit',
        cures: ['lightBleeding', 'heavyBleeding'],
        lightBleedingCost: 30,
        heavyBleedingCost: 170,
        durability: 400,
        useTime: 3,
        stashSize: { width: 1, height: 1 },
        imageFile: 'AFAK tactical individual first aid kit (2).png'
    },
    'Car first aid kit': {
        name: 'Car first aid kit',
        cures: ['lightBleeding'],
        lightBleedingCost: 50,
        durability: 220,
        useTime: 3,
        stashSize: { width: 2, height: 1 },
        imageFile: 'Car first aid kit.png'
    },
    'Grizzly medical kit': {
        name: 'Grizzly medical kit',
        cures: ['lightBleeding', 'heavyBleeding', 'fracture'],
        lightBleedingCost: 40,
        heavyBleedingCost: 130,
        fractureCost: 50,
        durability: 1800,
        useTime: 5,
        stashSize: { width: 2, height: 2 },
        imageFile: 'Grizzly medical kit.png'
    },
    'IFAK individual first aid kit': {
        name: 'IFAK individual first aid kit',
        cures: ['lightBleeding', 'heavyBleeding'],
        lightBleedingCost: 30,
        heavyBleedingCost: 210,
        durability: 300,
        useTime: 3,
        stashSize: { width: 1, height: 1 },
        imageFile: 'IFAK individual first aid kit.png'
    },
    'Augmentin antibiotic pills': {
        name: 'Augmentin antibiotic pills',
        cures: ['pain'],
        painCost: 1,
        durability: 1,
        useTime: 5,
        duration: 150,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Augmentin antibiotic pills.png'
    },
    'Ibuprofen painkillers': {
        name: 'Ibuprofen painkillers',
        cures: ['pain'],
        painCost: 1,
        durability: 15,
        useTime: 5,
        duration: 280,
        stashSize: { width: 1, height: 1 },
        imageFile: 'Ibuprofen painkillers.png'
    },
    'Water': {
        name: '水',
        hydrationGain: 60,
        energyGain: 0,
        durability: 1,
        useTime: 4,
        stashSize: { width: 1, height: 2 },
        imageFile: 'Water.png'
    },
    'MRE': {
        name: 'MRE',
        hydrationGain: 20,
        energyGain: 100,
        durability: 1,
        useTime: 5,
        stashSize: { width: 1, height: 2 },
        imageFile: 'MRE.png'
    },
    'CMS surgical kit (CMS)': {
        name: 'CMS surgical kit (CMS)',
        cures: ['blackedOut'],
        blackedOutCost: 1,
        durability: 3,
        useTime: 16,
        stashSize: { width: 2, height: 1 },
        imageFile: 'CMS surgical kit.png'
    }
};

// 当たり判定用のバウンディングボックス
class CollisionBox {
    constructor(position, size) {
        this.position = position;
        this.size = size; // {x, y, z}
        this.min = new THREE.Vector3(
            position.x - size.x / 2,
            position.y - size.y / 2,
            position.z - size.z / 2
        );
        this.max = new THREE.Vector3(
            position.x + size.x / 2,
            position.y + size.y / 2,
            position.z + size.z / 2
        );
    }

    update(position) {
        this.position.copy(position);
        this.min.set(
            position.x - this.size.x / 2,
            position.y - this.size.y / 2,
            position.z - this.size.z / 2
        );
        this.max.set(
            position.x + this.size.x / 2,
            position.y + this.size.y / 2,
            position.z + this.size.z / 2
        );
    }

    intersects(other) {
        return (
            this.min.x <= other.max.x &&
            this.max.x >= other.min.x &&
            this.min.y <= other.max.y &&
            this.max.y >= other.min.y &&
            this.min.z <= other.max.z &&
            this.max.z >= other.min.z
        );
    }
}

function getObstacleCellKey(cellX, cellZ) {
    return `${cellX},${cellZ}`;
}

function addObstacleToSpatialHash(obstacle) {
    if (!obstacle || !obstacle.collision) return;
    const { min, max } = obstacle.collision;
    const minCellX = Math.floor(min.x / OBSTACLE_GRID_CELL_SIZE);
    const maxCellX = Math.floor(max.x / OBSTACLE_GRID_CELL_SIZE);
    const minCellZ = Math.floor(min.z / OBSTACLE_GRID_CELL_SIZE);
    const maxCellZ = Math.floor(max.z / OBSTACLE_GRID_CELL_SIZE);
    for (let x = minCellX; x <= maxCellX; x++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
            const key = getObstacleCellKey(x, z);
            if (!obstacleSpatialHash.has(key)) {
                obstacleSpatialHash.set(key, []);
            }
            obstacleSpatialHash.get(key).push(obstacle);
        }
    }
}

function registerObstacle(obstacle) {
    if (!obstacle || !obstacle.collision) return;
    obstacles.push(obstacle);
    addObstacleToSpatialHash(obstacle);
}

function getNearbyObstacles(target, padding = 0) {
    if (!target) return [];
    let minX, maxX, minZ, maxZ;
    if (target.min && target.max) {
        minX = target.min.x - padding;
        maxX = target.max.x + padding;
        minZ = target.min.z - padding;
        maxZ = target.max.z + padding;
    } else if (typeof target.x === 'number' && typeof target.z === 'number') {
        minX = target.x - padding;
        maxX = target.x + padding;
        minZ = target.z - padding;
        maxZ = target.z + padding;
    } else {
        return [];
    }

    const minCellX = Math.floor(minX / OBSTACLE_GRID_CELL_SIZE);
    const maxCellX = Math.floor(maxX / OBSTACLE_GRID_CELL_SIZE);
    const minCellZ = Math.floor(minZ / OBSTACLE_GRID_CELL_SIZE);
    const maxCellZ = Math.floor(maxZ / OBSTACLE_GRID_CELL_SIZE);
    const nearbySet = new Set();

    for (let x = minCellX; x <= maxCellX; x++) {
        for (let z = minCellZ; z <= maxCellZ; z++) {
            const cell = obstacleSpatialHash.get(getObstacleCellKey(x, z));
            if (!cell) continue;
            cell.forEach(obstacle => nearbySet.add(obstacle));
        }
    }

    return Array.from(nearbySet);
}

// プレイヤーの当たり判定
let playerCollision = new CollisionBox(
    new THREE.Vector3(0, getTerrainHeight(0, 0) + GAME_CONFIG.playerHeight / 2, 0),
    { x: 0.5, y: GAME_CONFIG.playerHeight, z: 0.5 }
);

// 初期化
function init() {
    cachedVideoSettings = null;
    cachedVegetationConfig = null;
    const timeOfDayMode = getTimeOfDayMode();
    const isNight = timeOfDayMode === 'night';
    const fogConfig = getFogConfig(timeOfDayMode);
    
    // シーン作成
    scene = new THREE.Scene();
    scene.background = new THREE.Color(fogConfig.background);
    scene.fog = fogConfig.fog || null;

    // カメラ作成
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    const spawnHeight = getTerrainHeight(0, 0);
    camera.position.set(0, spawnHeight + GAME_CONFIG.playerHeight, 0);

    // レンダラー作成
    renderer = new THREE.WebGLRenderer({ antialias: true });
    applyRendererSizing();
    document.getElementById('gameContainer').appendChild(renderer.domElement);

    // ライト設定
    const ambientLight = new THREE.AmbientLight(isNight ? 0x1a2333 : 0xffffff, isNight ? 0.3 : 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(isNight ? 0xcad6ff : 0xfff8dc, isNight ? 0.45 : 1.25);
    directionalLight.position.set(300, isNight ? 180 : 260, -160);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(directionalLight.target);
    applyShadowQuality(directionalLight);
    directionalLight.shadow.camera.left = -450;
    directionalLight.shadow.camera.right = 450;
    directionalLight.shadow.camera.top = 450;
    directionalLight.shadow.camera.bottom = -450;
    directionalLight.shadow.camera.near = 50;
    directionalLight.shadow.camera.far = 900;
    directionalLight.shadow.bias = isNight ? -0.00025 : -0.0004;
    scene.add(directionalLight);
    createCelestialBody(directionalLight, timeOfDayMode);

    // 地面作成
    createGround();
    createMansion();
    createLootCrates();
    resetRaidPartInventory();
    createGenerators();
    createTrainCrossing();
    updateTrainCrossingState();

    // プレイヤーモデル作成
    createPlayerCharacter();
    
    // ゾンビ作成
    createZombies();
    
    // ボスゾンビ作成（30%の確率）
    if (Math.random() < 0.3) {
        createBossZombie();
    }

    // 的作成
    createTargets();

    // 銃のモデル作成
    createWeaponModel();

    // イベントリスナー
    setupEventListeners();

    // マップ初期化
    initMap();
    
    // ルートプロンプト初期化
    lootPromptElement = document.getElementById('lootPrompt');
    updateInteractionPrompt();
    updateRaidPartStatusUI();

    // 照準器設定を読み込んで適用
    const ironsightSettings = loadIronsightSettings();
    applyIronsightSettings(ironsightSettings);

    // アニメーションループ開始
    animate();
}

// 地面作成
function createGround() {
    const groundGeometry = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
    groundGeometry.rotateX(-Math.PI / 2);
    const positions = groundGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const height = getTerrainHeight(x, z);
        positions.setY(i, height);
    }
    groundGeometry.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeometry, getGroundMaterial());
    ground.receiveShadow = true;
    scene.add(ground);

    createForest();
    createGroundFoliage();
}

function createForest() {
    treePositions = [];
    const trunkMaterial = getTreeTrunkMaterial();
    const canopyMaterial = getTreeCanopyMaterial();
    const vegetationConfig = getVegetationConfig();
    const treeCount = vegetationConfig.treeCount;

    const trunkGeometry = new THREE.CylinderGeometry(0.35, 0.5, 1, 8);
    const canopyGeometry = new THREE.ConeGeometry(1.5, 1, 10);

    const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
    const canopyMesh = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, treeCount);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    canopyMesh.castShadow = true;
    canopyMesh.receiveShadow = true;

    const trunkMatrix = new THREE.Matrix4();
    const canopyMatrix = new THREE.Matrix4();
    const trunkQuaternion = new THREE.Quaternion();
    const canopyQuaternion = new THREE.Quaternion();

    const clearingRadius = 60;

    for (let i = 0; i < treeCount; i++) {
        let x, z, attempts = 0;
        do {
            x = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.95);
            z = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.95);
            attempts++;
        } while ((Math.hypot(x, z) < clearingRadius || isInsideMansionArea(x, z, MANSION_CONFIG.clearance)) && attempts < 10);

        const clusterNoise = (Math.random() - 0.5) * 12;
        x += clusterNoise;
        z += clusterNoise;

        const trunkHeight = 4 + Math.random() * 5.5;
        const canopyHeight = (4 + Math.random() * 4.5) * 2;
        const canopyRadius = (0.9 + Math.random() * 1.6) * 2;
        const baseHeight = getTerrainHeight(x, z);

        trunkMatrix.compose(
            new THREE.Vector3(x, baseHeight + trunkHeight / 2, z),
            trunkQuaternion,
            new THREE.Vector3(1, trunkHeight, 1)
        );
        trunkMesh.setMatrixAt(i, trunkMatrix);

        canopyMatrix.compose(
            new THREE.Vector3(x, baseHeight + trunkHeight + canopyHeight / 2, z),
            canopyQuaternion,
            new THREE.Vector3(canopyRadius / 1.5, canopyHeight, canopyRadius / 1.5)
        );
        canopyMesh.setMatrixAt(i, canopyMatrix);

        treePositions.push({
            x,
            z,
            radius: canopyRadius + 0.5,
            height: baseHeight
        });

        const trunkCollisionSize = {
            x: 0.8,
            y: trunkHeight,
            z: 0.8
        };
        const collision = new CollisionBox(
            new THREE.Vector3(x, baseHeight + trunkHeight / 2, z),
            trunkCollisionSize
        );
        registerObstacle({ mesh: null, collision });
    }

    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh);
    scene.add(canopyMesh);
}

function disposeGroundFoliage() {
    if (grassInstancedMesh) {
        scene.remove(grassInstancedMesh);
        grassInstancedMesh.geometry.dispose();
        grassInstancedMesh = null;
    }
    if (bushInstancedMesh) {
        scene.remove(bushInstancedMesh);
        bushInstancedMesh.geometry.dispose();
        bushInstancedMesh = null;
    }
}

function createGroundFoliage() {
    disposeGroundFoliage();
    const grassMat = getGrassMaterial();
    const bushMat = getBushMaterial();
    const vegetationConfig = getVegetationConfig();
    const grassCount = vegetationConfig.grassCount;
    const bushCount = vegetationConfig.bushCount;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();

    if (grassCount > 0) {
        const grassGeometry = new THREE.PlaneGeometry(1.8, 1.2);
        grassGeometry.translate(0, 0.6, 0);
        const grassMesh = new THREE.InstancedMesh(grassGeometry, grassMat, grassCount);
        grassMesh.castShadow = false;
        grassMesh.receiveShadow = true;

        for (let i = 0; i < grassCount; i++) {
            const x = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.95);
            const z = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.95);
            const rotationY = Math.random() * Math.PI * 2;
            const baseScale = 0.85 + Math.random() * 0.45;

            position.set(x, getTerrainHeight(x, z), z);
            euler.set(0, rotationY, 0);
            quaternion.setFromEuler(euler);
            const widthScale = baseScale * (1.3 + Math.random() * 0.4);
            const heightScale = baseScale * (0.75 + Math.random() * 0.35);
            scale.set(widthScale, heightScale, 1);

            matrix.compose(position, quaternion, scale);
            grassMesh.setMatrixAt(i, matrix);
        }
        grassMesh.instanceMatrix.needsUpdate = true;
        grassInstancedMesh = grassMesh;
        scene.add(grassInstancedMesh);
    }

    if (bushCount > 0) {
        const bushGeometry = new THREE.PlaneGeometry(3.2, 2.8);
        bushGeometry.translate(0, 1.4, 0);
        const bushPlaneCount = bushCount * 2;
        const bushMesh = new THREE.InstancedMesh(bushGeometry, bushMat, bushPlaneCount);
        bushMesh.castShadow = false;
        bushMesh.receiveShadow = true;

        let index = 0;
        for (let i = 0; i < bushCount; i++) {
            let x, z, attempts = 0;
            do {
                x = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.9);
                z = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.9);
                attempts++;
            } while (isInsideMansionArea(x, z, MANSION_CONFIG.clearance + 6) && attempts < 8);

            const baseScale = 0.9 + Math.random() * 0.9;
            for (let j = 0; j < 2; j++) {
                const rotationOffset = (j * Math.PI) / 2 + Math.random() * 0.6;
                position.set(x, getTerrainHeight(x, z), z);
                euler.set(0, rotationOffset, 0);
                quaternion.setFromEuler(euler);
                scale.set(baseScale, baseScale, 1);
                matrix.compose(position, quaternion, scale);
                bushMesh.setMatrixAt(index++, matrix);
            }
        }
        bushMesh.instanceMatrix.needsUpdate = true;
        bushInstancedMesh = bushMesh;
        scene.add(bushInstancedMesh);
    }
}

function isPointClearOfTrees(x, z) {
    if (!treePositions || treePositions.length === 0) return true;
    const buffer = CRATE_TREE_BUFFER;
    for (const tree of treePositions) {
        const dx = tree.x - x;
        const dz = tree.z - z;
        const minDist = (tree.radius || 0) + buffer;
        if (dx * dx + dz * dz < minDist * minDist) {
            return false;
        }
    }
    return true;
}

function getSharedTextureLoader() {
    if (!sharedTextureLoader) {
        sharedTextureLoader = new THREE.TextureLoader();
    }
    return sharedTextureLoader;
}

function loadTreeTrunkTexture() {
    if (treeTrunkTexture) return treeTrunkTexture;
    const loader = getSharedTextureLoader();
    const texturePath = '/pic/texture/wood.png';
    treeTrunkTexture = loader.load(
        texturePath,
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(0.6, 2.5);
            texture.anisotropy = getTextureAnisotropy();
            texture.needsUpdate = true;
        },
        undefined,
        (error) => {
            console.error('木の幹テクスチャの読み込みに失敗しました:', texturePath, error);
        }
    );
    return treeTrunkTexture;
}

function loadTreeCanopyTexture() {
    if (treeCanopyTexture) return treeCanopyTexture;
    const loader = getSharedTextureLoader();
    const texturePath = '/pic/texture/leef.png';
    treeCanopyTexture = loader.load(
        texturePath,
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1.8, 1.8);
            texture.anisotropy = getTextureAnisotropy();
            texture.needsUpdate = true;
        },
        undefined,
        (error) => {
            console.error('木の葉テクスチャの読み込みに失敗しました:', texturePath, error);
        }
    );
    return treeCanopyTexture;
}

function getTreeTrunkMaterial() {
    if (treeTrunkMaterial) return treeTrunkMaterial;
    const texture = loadTreeTrunkTexture();
    treeTrunkMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        metalness: 0.05,
        color: 0xffffff
    });
    treeTrunkMaterial.castShadow = false;
    treeTrunkMaterial.receiveShadow = false;
    return treeTrunkMaterial;
}

function getTreeCanopyMaterial() {
    if (treeCanopyMaterial) return treeCanopyMaterial;
    const texture = loadTreeCanopyTexture();
    treeCanopyMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.7,
        metalness: 0.02,
        color: 0xffffff
    });
    treeCanopyMaterial.castShadow = false;
    treeCanopyMaterial.receiveShadow = true;
    return treeCanopyMaterial;
}

function loadGroundTexture() {
    if (groundTexture) return groundTexture;
    const loader = getSharedTextureLoader();
    const texturePath = '/pic/texture/base.png';
    groundTexture = loader.load(
        texturePath,
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(MAP_SIZE / 35, MAP_SIZE / 35);
            texture.anisotropy = getTextureAnisotropy();
            texture.needsUpdate = true;
        },
        undefined,
        (error) => {
            console.error('地面テクスチャの読み込みに失敗しました:', texturePath, error);
        }
    );
    return groundTexture;
}

function getGroundMaterial() {
    if (groundMaterial) return groundMaterial;
    const texture = loadGroundTexture();
    groundMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.95,
        metalness: 0.03,
        color: 0xffffff
    });
    groundMaterial.receiveShadow = true;
    return groundMaterial;
}

function generateGrassTexture() {
    if (grassTexture) return grassTexture;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    for (let i = 0; i < 34; i++) {
        const startX = size * (0.25 + Math.random() * 0.5);
        const startY = size;
        const tipX = startX + (Math.random() - 0.5) * 45;
        const tipY = size * (0.05 + Math.random() * 0.2);
        const controlX = (startX + tipX) / 2 + (Math.random() - 0.5) * 35;
        const controlY = size * (0.35 + Math.random() * 0.35);

        const gradient = ctx.createLinearGradient(startX, startY, tipX, tipY);
        gradient.addColorStop(0, 'rgba(26,71,39,0.85)');
        gradient.addColorStop(0.6, 'rgba(44,107,59,0.65)');
        gradient.addColorStop(1, 'rgba(101,175,99,0.35)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3 + Math.random() * 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(controlX, controlY, tipX, tipY);
        ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = getTextureAnisotropy();
    grassTexture = texture;
    return grassTexture;
}

function getGrassMaterial() {
    if (grassMaterial) return grassMaterial;
    const texture = generateGrassTexture();
    grassMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.2,
        depthWrite: false,
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide,
        color: 0xffffff
    });
    return grassMaterial;
}

function generateBushTexture() {
    if (bushTexture) return bushTexture;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(70, 42, 22, 0.8)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
        const startX = size / 2 + (Math.random() - 0.5) * 70;
        const startY = size * 0.95;
        const controlX = size / 2 + (Math.random() - 0.5) * 220;
        const controlY = size * 0.6 + Math.random() * 90;
        const endX = size / 2 + (Math.random() - 0.5) * 200;
        const endY = size * 0.2 + Math.random() * 100;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        ctx.stroke();
    }

    for (let i = 0; i < 150; i++) {
        const radius = 18 + Math.random() * 35;
        const x = size * (0.15 + Math.random() * 0.7);
        const y = size * (0.2 + Math.random() * 0.65);
        const gradient = ctx.createRadialGradient(
            x, y, radius * 0.2,
            x, y, radius
        );
        gradient.addColorStop(0, `rgba(52,120,61,${0.45 + Math.random() * 0.25})`);
        gradient.addColorStop(0.65, `rgba(36,88,44,${0.25 + Math.random() * 0.2})`);
        gradient.addColorStop(1, 'rgba(24,58,30,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = getTextureAnisotropy();
    bushTexture = texture;
    return bushTexture;
}

function getBushMaterial() {
    if (bushMaterial) return bushMaterial;
    const texture = generateBushTexture();
    bushMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.08,
        depthWrite: false,
        roughness: 0.85,
        metalness: 0.02,
        side: THREE.DoubleSide,
        color: 0xffffff
    });
    return bushMaterial;
}

function loadLootCrateTexture() {
    if (lootCrateTexture) return lootCrateTexture;
    const loader = getSharedTextureLoader();
    const texturePath = '/pic/Texture/woodbox.png';
    lootCrateTexture = loader.load(
        texturePath,
        (texture) => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1.5, 1.5);
            texture.anisotropy = getTextureAnisotropy();
            texture.needsUpdate = true;
        },
        undefined,
        (error) => {
            console.error('木箱テクスチャの読み込みに失敗しました:', texturePath, error);
        }
    );
    return lootCrateTexture;
}

function getLootCrateMaterial() {
    if (lootCrateMaterial) return lootCrateMaterial;
    const texture = loadLootCrateTexture();
    lootCrateMaterial = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.85,
        metalness: 0.05,
        color: 0xffffff
    });
    return lootCrateMaterial;
}

function createLootCrates() {
    if (lootCrates.length > 0) {
        lootCrates.forEach(crate => {
            if (crate?.mesh) {
                scene.remove(crate.mesh);
            }
        });
    }
    if (crateLootItems.length > 0) {
        [...crateLootItems].forEach(mesh => removeLootItemMesh(mesh));
    }
    lootCrates = [];
    crateLootItems = [];

    const crateGeometry = new THREE.BoxGeometry(
        CRATE_SIZE.width,
        CRATE_SIZE.height,
        CRATE_SIZE.depth
    );
    const crateMaterial = getLootCrateMaterial();
    const placements = [];
    let attempts = 0;
    const maxAttempts = CRATE_COUNT * 80;

    while (placements.length < CRATE_COUNT && attempts < maxAttempts) {
        attempts++;
        const x = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.9);
        const z = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.9);

        if (isInsideMansionArea(x, z, 8)) continue;
        if (!isPointClearOfTrees(x, z)) continue;
        let tooCloseToCrate = false;
        for (const pos of placements) {
            const dx = pos.x - x;
            const dz = pos.z - z;
            if (dx * dx + dz * dz < CRATE_MIN_DISTANCE_BETWEEN_CRATES * CRATE_MIN_DISTANCE_BETWEEN_CRATES) {
                tooCloseToCrate = true;
                break;
            }
        }
        if (tooCloseToCrate) continue;

        const groundHeight = getTerrainHeight(x, z);
        const collision = new CollisionBox(
            new THREE.Vector3(x, groundHeight + CRATE_SIZE.height / 2, z),
            { x: CRATE_SIZE.width, y: CRATE_SIZE.height, z: CRATE_SIZE.depth }
        );
        const nearby = getNearbyObstacles(collision, 1);
        if (nearby.some(obstacle => collision.intersects(obstacle.collision))) {
            continue;
        }

        // 1%の確率で武器ウェポンケース（緑）を生成
        // 1%の確率で装備ボックス（青）を生成
        const rand = Math.random();
        const isWeaponCase = rand < 0.01;
        const isEquipmentBox = rand >= 0.01 && rand < 0.02;
        
        let crateMaterialFinal = crateMaterial;
        if (isWeaponCase) {
            crateMaterialFinal = new THREE.MeshLambertMaterial({ color: 0x4a7c59 }); // 緑色
        } else if (isEquipmentBox) {
            crateMaterialFinal = new THREE.MeshLambertMaterial({ color: 0x4169e1 }); // 青色
        }
        
        const crate = new THREE.Mesh(crateGeometry, crateMaterialFinal);
        crate.position.set(x, groundHeight + CRATE_SIZE.height / 2, z);
        crate.rotation.y = Math.random() * Math.PI * 2;
        crate.castShadow = true;
        crate.receiveShadow = true;
        scene.add(crate);

        const crateInfo = { mesh: crate, collision, isWeaponCase, isEquipmentBox };
        registerObstacle(crateInfo);
        lootCrates.push(crateInfo);
        spawnLootItemOnCrate(crateInfo);
        placements.push({ x, z });
    }

    console.log(`木箱を配置: ${placements.length}/${CRATE_COUNT}, 試行回数: ${attempts}`);
}

function clearRaidPartPickups() {
    raidPartPickups.forEach(pickup => {
        if (pickup.mesh) {
            scene.remove(pickup.mesh);
            pickup.mesh.geometry?.dispose?.();
            if (Array.isArray(pickup.mesh.material)) {
                pickup.mesh.material.forEach(mat => mat.dispose?.());
            } else {
                pickup.mesh.material?.dispose?.();
            }
        }
        if (pickup.glow) {
            scene.remove(pickup.glow);
        }
    });
    raidPartPickups = [];
}

function removeRaidPartPickup(pickup) {
    if (!pickup) return;
    const index = raidPartPickups.indexOf(pickup);
    if (index !== -1) {
        raidPartPickups.splice(index, 1);
    }
    if (pickup.mesh) {
        scene.remove(pickup.mesh);
        pickup.mesh.geometry?.dispose?.();
        if (Array.isArray(pickup.mesh.material)) {
            pickup.mesh.material.forEach(mat => mat.dispose?.());
        } else {
            pickup.mesh.material?.dispose?.();
        }
    }
    if (pickup.glow) {
        scene.remove(pickup.glow);
    }
    if (focusedInteractable?.kind === 'raidPart' && focusedInteractable.pickup === pickup) {
        setFocusedInteractable(null);
    }
}

function getRandomGroundPosition(minDistance, existingPositions = []) {
    const maxAttempts = 400;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.9);
        const z = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.9);
        if (isInsideMansionArea(x, z, 10)) continue;
        if (!isPointClearOfTrees(x, z)) continue;
        let tooClose = false;
        for (const pos of existingPositions) {
            const dx = pos.x - x;
            const dz = pos.z - z;
            if (dx * dx + dz * dz < minDistance * minDistance) {
                tooClose = true;
                break;
            }
        }
        if (tooClose) continue;
        const terrainHeight = getTerrainHeight(x, z);
        const collision = new CollisionBox(
            new THREE.Vector3(x, terrainHeight + 1, z),
            { x: 4, y: 2, z: 4 }
        );
        const nearby = getNearbyObstacles(collision, 1);
        if (nearby.some(obstacle => collision.intersects(obstacle.collision))) {
            continue;
        }
        return { x, z, y: terrainHeight };
    }
    return null;
}

function spawnRaidPartPickups(partType, count) {
    if (!RAID_PART_CONFIG[partType] || count <= 0) return;
    const positions = [];
    for (let i = 0; i < count; i++) {
        const pos = getRandomGroundPosition(10, positions);
        if (!pos) break;
        positions.push(pos);
        const config = RAID_PART_CONFIG[partType];
        const geometry = new THREE.CylinderGeometry(0.25, 0.25, 0.35, 12);
        const material = new THREE.MeshPhongMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.65,
            shininess: 60
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(pos.x, pos.y + 0.175, pos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const glow = new THREE.PointLight(config.color, 0.9, 6);
        glow.position.set(pos.x, pos.y + 1.1, pos.z);
        scene.add(glow);
        const pickup = { mesh, partType, glow };
        mesh.userData = mesh.userData || {};
        mesh.userData.itemName = config.name;
        mesh.userData.itemType = 'raidPart';
        mesh.userData.interaction = { kind: 'raidPart', partType, pickup };
        scene.add(mesh);
        raidPartPickups.push(pickup);
    }
}

function chooseCrossingPosition() {
    const side = Math.floor(Math.random() * 4);
    const distanceFromCenter = MAP_HALF - TRAIN_CROSSING_DISTANCE_FROM_EDGE;
    let x = 0;
    let z = 0;
    switch (side) {
        case 0: // north (positive z)
            x = THREE.MathUtils.randFloatSpread(MAP_HALF * 0.6);
            z = distanceFromCenter;
            break;
        case 1: // south
            x = THREE.MathUtils.randFloatSpread(MAP_HALF * 0.6);
            z = -distanceFromCenter;
            break;
        case 2: // east
            x = distanceFromCenter;
            z = THREE.MathUtils.randFloatSpread(MAP_HALF * 0.6);
            break;
        case 3: // west
        default:
            x = -distanceFromCenter;
            z = THREE.MathUtils.randFloatSpread(MAP_HALF * 0.6);
            break;
    }
    return { x, z };
}

function createTrainCrossing() {
    if (trainCrossing?.group) {
        scene.remove(trainCrossing.group);
    }
    const position = chooseCrossingPosition();
    const groundHeight = getTerrainHeight(position.x, position.z);
    const group = new THREE.Group();
    group.position.set(position.x, groundHeight, position.z);
    
    const baseGeometry = new THREE.BoxGeometry(6, 0.2, 2.5);
    const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.1;
    base.receiveShadow = true;
    group.add(base);
    
    const railGeometry = new THREE.BoxGeometry(6.5, 0.15, 0.3);
    const railMaterial = new THREE.MeshLambertMaterial({ color: 0xc0c0c0 });
    for (let i = -1; i <= 1; i += 2) {
        const rail = new THREE.Mesh(railGeometry, railMaterial);
        rail.position.set(0, 0.25, i * 0.6);
        rail.receiveShadow = true;
        group.add(rail);
    }
    
    const poleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 3.5, 12);
    const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xdcdcdc });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.set(-2.4, 1.75, 0);
    pole.castShadow = true;
    group.add(pole);
    
    const armGeometry = new THREE.BoxGeometry(3.5, 0.18, 0.4);
    const arm = new THREE.Mesh(armGeometry, new THREE.MeshLambertMaterial({ color: 0xffffff }));
    arm.position.set(-0.6, 2.2, 0);
    arm.rotation.z = THREE.Math.degToRad(-30);
    group.add(arm);
    
    const signalGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 16);
    const signalMaterial = new THREE.MeshPhongMaterial({ color: 0x660000, emissive: 0x220000 });
    const signal = new THREE.Mesh(signalGeometry, signalMaterial);
    signal.position.set(-2.4, 1.8, 0.5);
    group.add(signal);
    const signalLight = new THREE.PointLight(0xff2222, 0.8, 8);
    signalLight.position.set(-2.4, 1.8, 0.5);
    group.add(signalLight);
    
    const activationLight = new THREE.PointLight(0x22ff55, 0, 12);
    activationLight.position.set(-2.4, 3.1, 0);
    group.add(activationLight);
    
    const interactionGeometry = new THREE.CylinderGeometry(4, 4, 0.4, 16);
    const interactionMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const interactionMesh = new THREE.Mesh(interactionGeometry, interactionMaterial);
    interactionMesh.position.set(0, 0.2, 0);
    interactionMesh.userData = { kind: 'extractionZone' };
    group.add(interactionMesh);
    
    const collision = new CollisionBox(
        new THREE.Vector3(position.x, groundHeight + 0.3, position.z),
        { x: 6, y: 0.6, z: 4 }
    );
    registerObstacle({ mesh: group, collision });
    scene.add(group);
    
    trainCrossing = {
        group,
        position: new THREE.Vector3(position.x, groundHeight, position.z),
        active: false,
        signal,
        signalLight,
        activationLight,
        interactionMesh
    };
}

function updateTrainCrossingState() {
    if (!trainCrossing) return;
    if (trainCrossing.active) {
        trainCrossing.signal.material.color.setHex(0x116611);
        trainCrossing.signal.material.emissive.setHex(0x55ff99);
        trainCrossing.signalLight.color.setHex(0x55ff99);
        trainCrossing.signalLight.intensity = 1.0;
        trainCrossing.activationLight.intensity = 1.2;
    } else {
        trainCrossing.signal.material.color.setHex(0x660000);
        trainCrossing.signal.material.emissive.setHex(0x220000);
        trainCrossing.signalLight.color.setHex(0xff2222);
        trainCrossing.signalLight.intensity = 0.8;
        trainCrossing.activationLight.intensity = 0;
    }
}

function rollGeneratorState() {
    const categoryRoll = Math.random();
    let cumulative = 0;
    for (const state of GENERATOR_STATE_CHANCES) {
        cumulative += state.chance;
        if (categoryRoll <= cumulative) {
            return { spark: state.spark, fuel: state.fuel };
        }
    }
    const last = GENERATOR_STATE_CHANCES[GENERATOR_STATE_CHANCES.length - 1];
    return { spark: last.spark, fuel: last.fuel };
}

function clearGenerators() {
    generators.forEach(generator => {
        if (generator.group) {
            scene.remove(generator.group);
        }
    });
    generators = [];
    extractionUnlocked = false;
    GAME_CONFIG.escapeAvailable = false;
    cancelExtractionCountdown(true);
}

function updateGeneratorLight(generator) {
    if (!generator) return;
    const color = generator.isFixed ? 0x4dff88 : 0xff5555;
    if (generator.light?.material) {
        generator.light.material.color.setHex(color);
        if (generator.light.material.emissive) {
            generator.light.material.emissive.setHex(color);
        }
    }
    if (generator.indicatorLight) {
        generator.indicatorLight.color.setHex(color);
        generator.indicatorLight.intensity = generator.isFixed ? 1.6 : 1.0;
    }
}

function getPlayerPositionVector() {
    if (player?.position) {
        return player.position.clone();
    }
    if (camera?.position) {
        return camera.position.clone();
    }
    return null;
}

function activateTrainCrossing() {
    if (!trainCrossing) return;
    trainCrossing.active = true;
    updateTrainCrossingState();
}

function startExtractionCountdown() {
    extractionCountdownState = {
        startTime: performance.now(),
        duration: EXTRACTION_COUNTDOWN_MS
    };
    const seconds = (EXTRACTION_COUNTDOWN_MS / 1000).toFixed(1);
    setLootPromptOverride(`踏切で脱出準備中... ${seconds} 秒`);
}

function cancelExtractionCountdown(force = false) {
    if (!extractionCountdownState) return;
    extractionCountdownState = null;
    if (force) {
        lootPromptOverrideText = null;
        updateInteractionPrompt();
    } else {
        showLootPromptMessage('脱出を中断しました', true);
    }
}

function updateExtractionCountdown() {
    if (!trainCrossing || !trainCrossing.active || !GAME_CONFIG.escapeAvailable) {
        cancelExtractionCountdown(true);
        return;
    }
    const playerPos = getPlayerPositionVector();
    if (!playerPos) return;
    const distance = playerPos.distanceTo(trainCrossing.position);
    if (distance <= EXTRACTION_RADIUS) {
        if (!extractionCountdownState) {
            startExtractionCountdown();
        } else {
            const now = performance.now();
            const elapsed = now - extractionCountdownState.startTime;
            const remaining = Math.max(0, extractionCountdownState.duration - elapsed);
            const seconds = (remaining / 1000).toFixed(1);
            setLootPromptOverride(`踏切で脱出準備中... ${seconds} 秒`);
            if (remaining <= 0) {
                completeExtraction('normal');
            }
        }
    } else {
        cancelExtractionCountdown(true);
    }
}

async function completeExtraction(method = 'normal') {
    extractionCountdownState = null;
    flareCountdownState = null;
    setLootPromptOverride('脱出完了！', false);
    raidPartsInventory.sparkPlug = 0;
    raidPartsInventory.fuel = 0;
    updateRaidPartStatusUI();
    exitHandlerSuppressed = true;
    GAME_CONFIG.isInGame = false;
    try {
        // 散弾銃の弾薬状態を保存
        const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
        if (weaponData && weaponData.isShotgun) {
            await updateShotgunLoadedAmmo();
        }
        await saveInventoryItems();
    } catch (error) {
        console.error('脱出時のアイテム保存に失敗しました:', error);
    }
    const xpPromises = [];
    if (raidStartTimestamp) {
        const survivalSeconds = Math.max(0, (Date.now() - raidStartTimestamp) / 1000);
        xpPromises.push(sendPlayerXpEvent('survival', { seconds: survivalSeconds }));
        raidStartTimestamp = null;
    }
    xpPromises.push(sendPlayerXpEvent('extraction', { method }));
    await Promise.allSettled(xpPromises);
    activeFlareType = null;
    alert('脱出に成功しました！');
    window.location.href = '/';
}

// フレア弾の緊急脱出処理
function handleFlareEscape(isYellowFlare) {
    if (!camera) return;
    
    activeFlareType = isYellowFlare ? 'yellow_flare' : 'green_flare';
    // プレイヤーの位置から上に打ち上げる
    const playerPos = getPlayerPositionVector();
    if (!playerPos) return;
    
    const flareColor = isYellowFlare ? 0xffff00 : 0x00ff00;
    const startHeight = playerPos.y + GAME_CONFIG.playerHeight;
    
    // フレア弾の3Dオブジェクトを作成（黄色または緑の光）
    const flareGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const flareMaterial = new THREE.MeshBasicMaterial({ 
        color: flareColor,
        emissive: flareColor,
        emissiveIntensity: 2.0
    });
    flareProjectile = new THREE.Mesh(flareGeometry, flareMaterial);
    flareProjectile.position.set(playerPos.x, startHeight, playerPos.z);
    scene.add(flareProjectile);
    
    // フレアのライトを作成（周囲を照らす）
    flareLight = new THREE.PointLight(flareColor, 3, 100);
    flareLight.position.set(playerPos.x, startHeight, playerPos.z);
    scene.add(flareLight);
    
    // グロー効果を作成（スプライト）
    const glowTexture = createGlowTexture(flareColor);
    const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: flareColor,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.8
    });
    flareGlow = new THREE.Sprite(glowMaterial);
    flareGlow.scale.set(2, 2, 1);
    flareGlow.position.set(playerPos.x, startHeight, playerPos.z);
    scene.add(flareGlow);
    
    // 光の粒子を作成
    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        // 位置（フレアの周囲にランダムに配置）
        positions[i3] = (Math.random() - 0.5) * 0.5;
        positions[i3 + 1] = (Math.random() - 0.5) * 0.5;
        positions[i3 + 2] = (Math.random() - 0.5) * 0.5;
        
        // 色（フレアの色に近い）
        const r = (flareColor >> 16) / 255;
        const g = ((flareColor >> 8) & 0xff) / 255;
        const b = (flareColor & 0xff) / 255;
        colors[i3] = r;
        colors[i3 + 1] = g;
        colors[i3 + 2] = b;
        
        // サイズ
        sizes[i] = Math.random() * 0.1 + 0.05;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 0.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    flareParticles = new THREE.Points(particleGeometry, particleMaterial);
    flareParticles.position.set(playerPos.x, startHeight, playerPos.z);
    scene.add(flareParticles);
    
    // 煙のパーティクルを作成
    const smokeCount = 200;
    const smokeGeometry = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeVelocities = new Float32Array(smokeCount * 3);
    const smokeOpacities = new Float32Array(smokeCount);
    const smokeSizes = new Float32Array(smokeCount);
    
    for (let i = 0; i < smokeCount; i++) {
        const i3 = i * 3;
        // 初期位置（フレアの周囲）
        smokePositions[i3] = (Math.random() - 0.5) * 0.3;
        smokePositions[i3 + 1] = (Math.random() - 0.5) * 0.3;
        smokePositions[i3 + 2] = (Math.random() - 0.5) * 0.3;
        
        // 速度（上方向に移動）
        smokeVelocities[i3] = (Math.random() - 0.5) * 0.5; // 横方向の拡散
        smokeVelocities[i3 + 1] = Math.random() * 2 + 1; // 上方向
        smokeVelocities[i3 + 2] = (Math.random() - 0.5) * 0.5; // 横方向の拡散
        
        // 不透明度
        smokeOpacities[i] = Math.random() * 0.5 + 0.3;
        
        // サイズ
        smokeSizes[i] = Math.random() * 0.3 + 0.2;
    }
    
    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    
    const smokeMaterial = new THREE.PointsMaterial({
        size: 0.5,
        color: 0x666666,
        transparent: true,
        opacity: 0.6,
        blending: THREE.NormalBlending
    });
    
    flareSmoke = new THREE.Points(smokeGeometry, smokeMaterial);
    flareSmoke.position.set(playerPos.x, startHeight, playerPos.z);
    scene.add(flareSmoke);
    
    // フレアの初期状態を保存
    flareProjectile.userData = {
        startHeight: startHeight,
        currentHeight: startHeight,
        velocity: FLARE_VELOCITY, // m/s
        countdownStarted: false,
        lastUpdateTime: performance.now(),
        flareColor: flareColor,
        smokePositions: smokePositions,
        smokeVelocities: smokeVelocities,
        smokeOpacities: smokeOpacities,
        smokeSizes: smokeSizes,
        particlePositions: positions
    };
}

// グローテクスチャを作成
function createGlowTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    const r = (color >> 16) / 255;
    const g = ((color >> 8) & 0xff) / 255;
    const b = (color & 0xff) / 255;
    
    gradient.addColorStop(0, `rgba(${r * 255}, ${g * 255}, ${b * 255}, 1)`);
    gradient.addColorStop(0.5, `rgba(${r * 255}, ${g * 255}, ${b * 255}, 0.5)`);
    gradient.addColorStop(1, `rgba(${r * 255}, ${g * 255}, ${b * 255}, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// フレア弾の更新
function updateFlareProjectile() {
    if (flareProjectile && flareProjectile.userData) {
        const now = performance.now();
        const deltaTime = (now - (flareProjectile.userData.lastUpdateTime || now)) / 1000; // seconds
        flareProjectile.userData.lastUpdateTime = now;

        flareProjectile.userData.currentHeight += flareProjectile.userData.velocity * deltaTime; // m/s * seconds = meters

        if (flareProjectile.userData.currentHeight >= FLARE_TARGET_HEIGHT) {
            flareProjectile.userData.currentHeight = FLARE_TARGET_HEIGHT;
            if (!flareProjectile.userData.countdownStarted) {
                flareProjectile.userData.countdownStarted = true;
                startFlareCountdown();
            }
        }
        
        const currentY = flareProjectile.userData.currentHeight;
        
        // フレア本体の位置を更新
        flareProjectile.position.y = currentY;
        
        // ライトの位置と強度を更新
        if (flareLight) {
            flareLight.position.y = currentY;
            // 光の強度を脈動させる
            const intensity = 3 + Math.sin(now / 100) * 1;
            flareLight.intensity = intensity;
        }
        
        // グローの位置とサイズを更新
        if (flareGlow) {
            flareGlow.position.y = currentY;
            // グローのサイズを脈動させる
            const glowSize = 2 + Math.sin(now / 150) * 0.5;
            flareGlow.scale.set(glowSize, glowSize, 1);
            // 不透明度も変化させる
            flareGlow.material.opacity = 0.8 + Math.sin(now / 200) * 0.2;
        }
        
        // 光の粒子を更新
        if (flareParticles) {
            flareParticles.position.y = currentY;
            
            const positions = flareParticles.geometry.attributes.position.array;
            const particleCount = positions.length / 3;
            
            // 粒子を回転させ、拡散させる
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                const angle = now / 1000 + i * 0.1;
                const radius = 0.3 + Math.sin(angle) * 0.2;
                positions[i3] = Math.cos(angle) * radius;
                positions[i3 + 1] = Math.sin(angle * 2) * 0.2;
                positions[i3 + 2] = Math.sin(angle) * radius;
            }
            
            flareParticles.geometry.attributes.position.needsUpdate = true;
        }
        
        // 煙のパーティクルを更新
        if (flareSmoke && flareSmoke.geometry.attributes.position) {
            flareSmoke.position.y = currentY;
            
            const smokePositions = flareSmoke.geometry.attributes.position.array;
            const smokeVelocities = flareProjectile.userData.smokeVelocities;
            const smokeOpacities = flareProjectile.userData.smokeOpacities;
            const smokeCount = smokePositions.length / 3;
            
            for (let i = 0; i < smokeCount; i++) {
                const i3 = i * 3;
                
                // 煙を上に移動させ、拡散させる
                smokePositions[i3] += smokeVelocities[i3] * deltaTime * 0.5;
                smokePositions[i3 + 1] += smokeVelocities[i3 + 1] * deltaTime;
                smokePositions[i3 + 2] += smokeVelocities[i3 + 2] * deltaTime * 0.5;
                
                // 拡散を加速
                smokeVelocities[i3] *= 1.01;
                smokeVelocities[i3 + 2] *= 1.01;
                
                // 煙が遠くに行きすぎたらリセット
                const distance = Math.sqrt(
                    smokePositions[i3] * smokePositions[i3] +
                    smokePositions[i3 + 2] * smokePositions[i3 + 2]
                );
                
                if (distance > 5 || smokePositions[i3 + 1] > 10) {
                    // フレアの位置にリセット
                    smokePositions[i3] = (Math.random() - 0.5) * 0.3;
                    smokePositions[i3 + 1] = (Math.random() - 0.5) * 0.3;
                    smokePositions[i3 + 2] = (Math.random() - 0.5) * 0.3;
                    
                    // 速度をリセット
                    smokeVelocities[i3] = (Math.random() - 0.5) * 0.5;
                    smokeVelocities[i3 + 1] = Math.random() * 2 + 1;
                    smokeVelocities[i3 + 2] = (Math.random() - 0.5) * 0.5;
                }
            }
            
            flareSmoke.geometry.attributes.position.needsUpdate = true;
        }

        // フレアの光を表現
        if (flareProjectile.material.emissive) {
            flareProjectile.material.emissiveIntensity = 2.0 + Math.sin(now / 100) * 0.8; // より強い脈動
        }
    }
}

// フレア弾のカウントダウン開始
function startFlareCountdown() {
    flareCountdownState = {
        startTime: performance.now(),
        duration: FLARE_ESCAPE_COUNTDOWN_MS
    };
    const seconds = (FLARE_ESCAPE_COUNTDOWN_MS / 1000).toFixed(0);
    setLootPromptOverride(`緊急脱出準備中... ${seconds} 秒`);
}

// フレア弾のカウントダウン更新
function updateFlareCountdown() {
    if (!flareCountdownState) return;
    
    const now = performance.now();
    const elapsed = now - flareCountdownState.startTime;
    const remaining = Math.max(0, flareCountdownState.duration - elapsed);
    const seconds = (remaining / 1000).toFixed(0);
    
    if (remaining > 0) {
        setLootPromptOverride(`緊急脱出準備中... ${seconds} 秒`);
    } else {
        // カウントダウン終了、脱出処理
        flareCountdownState = null;
        
        // フレア関連のオブジェクトをすべて削除
        if (flareProjectile) {
            scene.remove(flareProjectile);
            if (flareProjectile.geometry) flareProjectile.geometry.dispose();
            if (flareProjectile.material) flareProjectile.material.dispose();
            flareProjectile = null;
        }
        
        if (flareLight) {
            scene.remove(flareLight);
            flareLight.dispose();
            flareLight = null;
        }
        
        if (flareGlow) {
            scene.remove(flareGlow);
            if (flareGlow.material) {
                if (flareGlow.material.map) flareGlow.material.map.dispose();
                flareGlow.material.dispose();
            }
            flareGlow = null;
        }
        
        if (flareParticles) {
            scene.remove(flareParticles);
            if (flareParticles.geometry) flareParticles.geometry.dispose();
            if (flareParticles.material) flareParticles.material.dispose();
            flareParticles = null;
        }
        
        if (flareSmoke) {
            scene.remove(flareSmoke);
            if (flareSmoke.geometry) flareSmoke.geometry.dispose();
            if (flareSmoke.material) flareSmoke.material.dispose();
            flareSmoke = null;
        }
        
        completeExtraction(activeFlareType || 'green_flare');
    }
}

function createGenerators() {
    clearGenerators();
    clearRaidPartPickups();
    let missingSpark = 0;
    let missingFuel = 0;
    const placements = [];
    let attempts = 0;
    while (generators.length < GENERATOR_COUNT && attempts < 2500) {
        attempts++;
        const position = getRandomGroundPosition(GENERATOR_MIN_DISTANCE, placements);
        if (!position) break;
        const state = rollGeneratorState();
        
        const groundHeight = position.y ?? getTerrainHeight(position.x, position.z);
        const group = new THREE.Group();
        group.position.set(position.x, groundHeight, position.z);
        
        const baseGeometry = new THREE.BoxGeometry(2.4, 1.2, 1.6);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4f5a });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.6;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);
        
        const poleGeometry = new THREE.CylinderGeometry(0.15, 0.15, 2.4, 12);
        const poleMaterial = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(0, 1.8, 0);
        pole.castShadow = true;
        group.add(pole);
        
        const lightGeometry = new THREE.SphereGeometry(0.32, 16, 16);
        const lightMaterial = new THREE.MeshPhongMaterial({ color: 0xff5555, emissive: 0xff0000, emissiveIntensity: 1.5 });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.set(0, 3.0, 0);
        light.castShadow = true;
        group.add(light);
        const indicatorLight = new THREE.PointLight(0xff5555, 1.2, 18);
        indicatorLight.position.set(0, 3.1, 0);
        group.add(indicatorLight);
        
        const interactionGeometry = new THREE.CylinderGeometry(1.2, 1.2, GENERATOR_INTERACTION_HEIGHT, 8);
        const interactionMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0 });
        const interactionMesh = new THREE.Mesh(interactionGeometry, interactionMaterial);
        interactionMesh.position.set(0, GENERATOR_INTERACTION_HEIGHT / 2, 0);
        group.add(interactionMesh);
        
        const collision = new CollisionBox(
            new THREE.Vector3(position.x, groundHeight + 1, position.z),
            { x: 2.5, y: 2, z: 2.5 }
        );
        registerObstacle({ mesh: group, collision });
        scene.add(group);
        
        const generator = {
            group,
            base,
            pole,
            light,
            interactionMesh,
            position,
            hasSparkPlug: state.spark,
            hasFuel: state.fuel,
            isFixed: state.spark && state.fuel,
            indicatorLight
        };
        interactionMesh.userData = interactionMesh.userData || {};
        interactionMesh.userData.interaction = { kind: 'generator', generator };
        updateGeneratorLight(generator);
        generators.push(generator);
        placements.push(position);
        
        if (!state.spark) missingSpark++;
        if (!state.fuel) missingFuel++;
    }
    
    const totalNeeded = missingSpark + missingFuel;
    spawnRaidPartPickups('sparkPlug', missingSpark);
    spawnRaidPartPickups('fuel', missingFuel);
    if (totalNeeded === 0) {
        spawnRaidPartPickups('sparkPlug', 1);
    } else {
        const extraType = missingSpark >= missingFuel ? 'sparkPlug' : 'fuel';
        spawnRaidPartPickups(extraType, 1);
    }
    checkGeneratorsCompletion();
}

function pickupRaidPart(pickup) {
    if (!pickup) return;
    const partType = pickup.partType;
    raidPartsInventory[partType] = (raidPartsInventory[partType] || 0) + 1;
    updateRaidPartStatusUI();
    const partName = RAID_PART_CONFIG[partType]?.name || 'パーツ';
    showLootPromptMessage(`${partName}を入手`, false);
    removeRaidPartPickup(pickup);
}

function attemptGeneratorRepair(generator) {
    if (!generator) return;
    if (generator.isFixed) {
        showLootPromptMessage('この発電機は既に稼働しています', false);
        return;
    }
    if (generatorRepairState) return;
    
    let partType = null;
    if (!generator.hasSparkPlug && raidPartsInventory.sparkPlug > 0) {
        partType = 'sparkPlug';
    } else if (!generator.hasFuel && raidPartsInventory.fuel > 0) {
        partType = 'fuel';
    } else if (!generator.hasSparkPlug) {
        showLootPromptMessage('スパークプラグが足りません', true);
        return;
    } else if (!generator.hasFuel) {
        showLootPromptMessage('燃料が足りません', true);
        return;
    }
    
    if (!partType) {
        showLootPromptMessage('必要な部品がありません', true);
        return;
    }
    
    const duration = RAID_PART_CONFIG[partType]?.repairDuration || 10000;
    generatorRepairState = {
        generator,
        partType,
        duration,
        startTime: performance.now()
    };
    const partName = RAID_PART_CONFIG[partType]?.name || 'パーツ';
    setLootPromptOverride(`${partName}を使用中... 0%`, false);
}

function updateGeneratorRepair() {
    if (!generatorRepairState) return;
    const now = performance.now();
    const elapsed = now - generatorRepairState.startTime;
    const progress = Math.min(elapsed / generatorRepairState.duration, 1);
    const percent = Math.floor(progress * 100);
    const partName = RAID_PART_CONFIG[generatorRepairState.partType]?.name || 'パーツ';
    setLootPromptOverride(`${partName}を使用中... ${percent}%`, false);
    if (progress >= 1) {
        completeGeneratorRepair();
    }
}

function completeGeneratorRepair() {
    if (!generatorRepairState) return;
    const { generator, partType } = generatorRepairState;
    generatorRepairState = null;
    raidPartsInventory[partType] = Math.max(0, (raidPartsInventory[partType] || 0) - 1);
    updateRaidPartStatusUI();
    
    if (partType === 'sparkPlug') {
        generator.hasSparkPlug = true;
    } else if (partType === 'fuel') {
        generator.hasFuel = true;
    }
    
    if (generator.hasSparkPlug && generator.hasFuel) {
        generator.isFixed = true;
        updateGeneratorLight(generator);
        showLootPromptMessage('発電機を修理しました', false);
        checkGeneratorsCompletion();
    } else {
        const partName = RAID_PART_CONFIG[partType]?.name || 'パーツ';
        showLootPromptMessage(`${partName}を装着しました`, false);
    }
}

function checkGeneratorsCompletion() {
    if (extractionUnlocked) return;
    const allFixed = generators.length > 0 && generators.every(gen => gen.isFixed);
    if (allFixed) {
        extractionUnlocked = true;
        GAME_CONFIG.escapeAvailable = true;
        activateTrainCrossing();
        showLootPromptMessage('全ての発電機が稼働しました。脱出が可能です！', false);
    }
}

// カテゴリーごとの確率（木箱用）
const LOOT_CATEGORY_PROBABILITIES = {
    'medical': 0.20,    // 医薬品: 20%
    'weapon': 0.05,     // 銃: 5%
    'magazine': 0.05,   // マガジン: 5%
    'rig': 0.05,        // リグ: 5%
    'backpack': 0.05,   // バックパック: 5%
    'ammo': 0.12,       // 弾: 12%
    'other': 0.55       // アイテム（その他）: 55%
};

function getRandomLootItemDefinition() {
    if (!LOOT_ITEM_POOL.length) return null;
    
    // カテゴリーを確率に基づいて選択
    const categoryRoll = Math.random();
    let selectedCategory = 'other';
    let cumulative = 0;
    
    for (const [category, probability] of Object.entries(LOOT_CATEGORY_PROBABILITIES)) {
        cumulative += probability;
        if (categoryRoll <= cumulative) {
            selectedCategory = category;
            break;
        }
    }
    
    // 選択されたカテゴリーのアイテムをフィルタリング
    let categoryItems = [];
    if (selectedCategory === 'other') {
        // その他のアイテム（dogtag, flareなど、定義済みカテゴリー以外）
        // ただし、ドッグタグ king of zombieは除外（ボス討伐専用）
        const definedCategories = ['medical', 'weapon', 'magazine', 'rig', 'backpack', 'ammo'];
        categoryItems = LOOT_ITEM_POOL.filter(item => 
            !definedCategories.includes(item.itemType) && 
            item.name !== 'ドッグタグ king of zombie'
        );
    } else {
        categoryItems = LOOT_ITEM_POOL.filter(item => item.itemType === selectedCategory);
    }
    
    // カテゴリー内にアイテムがない場合は、全アイテムからランダムに選択（ドッグタグ king of zombieは除外）
    if (categoryItems.length === 0) {
        categoryItems = LOOT_ITEM_POOL.filter(item => item.name !== 'ドッグタグ king of zombie');
    }
    
    // カテゴリー内でweightベースに選択
    if (categoryItems.length === 0) return null;
    const totalWeight = categoryItems.reduce((sum, item) => sum + (item.weight || 1), 0);
    let rand = Math.random() * totalWeight;
    for (const item of categoryItems) {
        rand -= (item.weight || 1);
        if (rand <= 0) {
            return item;
        }
    }
    return categoryItems[categoryItems.length - 1];
}

function createLootItemMesh(definition) {
    if (!definition) return null;
    const geometry = new THREE.BoxGeometry(0.35, CRATE_ITEM_HEIGHT, 0.35);
    const material = new THREE.MeshLambertMaterial({ color: definition.color || 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
        lootItem: true,
        itemName: definition.name,
        itemType: definition.itemType || 'medical'
    };
    return mesh;
}

function spawnLootItemOnCrate(crateInfo) {
    if (!crateInfo || !crateInfo.mesh) return;
    
    let lootDef;
    // 武器ウェポンケースの場合は銃を確定でスポーン
    if (crateInfo.isWeaponCase) {
        // 武器のみをフィルタリング
        const weaponPool = LOOT_ITEM_POOL.filter(item => item.itemType === 'weapon');
        if (weaponPool.length === 0) {
            // 武器がない場合は通常のルート
            lootDef = getRandomLootItemDefinition();
        } else {
            // ランダムに武器を選択
            const totalWeight = weaponPool.reduce((sum, item) => sum + (item.weight || 1), 0);
            let rand = Math.random() * totalWeight;
            for (const item of weaponPool) {
                rand -= (item.weight || 1);
                if (rand <= 0) {
                    lootDef = item;
                    break;
                }
            }
            if (!lootDef) {
                lootDef = weaponPool[weaponPool.length - 1];
            }
        }
    } else if (crateInfo.isEquipmentBox) {
        // 装備ボックスの場合はバックパック、リグ、ボディーアーマー、ヘルメットのどれかをランダムでスポーン
        const equipmentPool = LOOT_ITEM_POOL.filter(item => 
            item.itemType === 'backpack' || item.itemType === 'rig'
            // ボディーアーマーとヘルメットは未実装のため、現在はバックパックとリグのみ
        );
        if (equipmentPool.length === 0) {
            // 装備がない場合は通常のルート
            lootDef = getRandomLootItemDefinition();
        } else {
            // ランダムに装備を選択
            const totalWeight = equipmentPool.reduce((sum, item) => sum + (item.weight || 1), 0);
            let rand = Math.random() * totalWeight;
            for (const item of equipmentPool) {
                rand -= (item.weight || 1);
                if (rand <= 0) {
                    lootDef = item;
                    break;
                }
            }
            if (!lootDef) {
                lootDef = equipmentPool[equipmentPool.length - 1];
            }
        }
    } else {
        lootDef = getRandomLootItemDefinition();
    }
    
    if (!lootDef) return;
    
    const mesh = createLootItemMesh(lootDef);
    if (!mesh) return;
    
    mesh.position.set(
        crateInfo.mesh.position.x + THREE.MathUtils.randFloatSpread(0.4),
        crateInfo.mesh.position.y + CRATE_SIZE.height / 2 + CRATE_ITEM_HEIGHT / 2 + 0.05,
        crateInfo.mesh.position.z + THREE.MathUtils.randFloatSpread(0.4)
    );
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    mesh.userData.interaction = { kind: 'loot', mesh };
    crateInfo.lootItem = mesh;
    crateLootItems.push(mesh);
}

function getLootDisplayName(itemName, itemType = 'medical') {
    if (!itemName) return 'アイテム';
    if (itemType === 'medical') {
        const medicalData = MEDICAL_DATA[itemName];
        return medicalData?.name || itemName;
    }
    if (itemType === 'weapon') {
        const weaponData = WEAPON_DATA[itemName];
        return weaponData?.name || itemName;
    }
    if (itemType === 'backpack') {
        const backpackData = INVENTORY_BACKPACK_DATA[itemName];
        return backpackData?.name || itemName;
    }
    if (itemType === 'rig') {
        const rigData = INVENTORY_RIG_DATA[itemName];
        return rigData?.name || itemName;
    }
    if (itemType === 'magazine') {
        return itemName; // マガジン名をそのまま返す
    }
    if (itemType === 'ammo') {
        const ammoData = INVENTORY_AMMO_DATA[itemName];
        return ammoData?.fullName || itemName;
    }
    if (itemType === 'dogtag') {
        const dogtagData = DOGTAG_DATA[itemName];
        return dogtagData?.name || itemName;
    }
    if (itemType === 'flare') {
        const flareData = FLARE_DATA[itemName];
        return flareData?.name || itemName;
    }
    return itemName;
}

function setLootPromptOverride(message, isError = false) {
    lootPromptOverrideText = message;
    lootPromptOverrideIsError = isError;
    if (lootPromptTimeoutHandle) {
        clearTimeout(lootPromptTimeoutHandle);
        lootPromptTimeoutHandle = null;
    }
    updateInteractionPrompt();
}

function createInventoryItemFromLoot(itemName, itemType = 'medical') {
    if (itemType === 'medical') {
        const medicalData = MEDICAL_DATA[itemName];
        if (!medicalData) return null;
        const stashSize = medicalData.stashSize || { width: 1, height: 1 };
        return {
            id: null,
            item_type: 'medical',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 1,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: medicalData.durability || 1,
            ammo_stack: null
        };
    }
    
    if (itemType === 'weapon') {
        const weaponData = WEAPON_DATA[itemName];
        if (!weaponData) return null;
        const stashSize = weaponData.stashSize || { width: 4, height: 2 };
        return {
            id: null,
            item_type: 'weapon',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 1,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: 1,
            ammo_stack: [],
            weapon_durability: WEAPON_DURABILITY_MAX
        };
    }
    
    if (itemType === 'backpack') {
        const backpackData = INVENTORY_BACKPACK_DATA[itemName];
        if (!backpackData) return null;
        const stashSize = backpackData.stashSize || { width: 4, height: 4 };
        return {
            id: null,
            item_type: 'backpack',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 1,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: 1,
            ammo_stack: []
        };
    }
    
    if (itemType === 'rig') {
        const rigData = INVENTORY_RIG_DATA[itemName];
        if (!rigData) return null;
        const stashSize = rigData.stashSize || { width: 4, height: 3 };
        return {
            id: null,
            item_type: 'rig',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 1,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: 1,
            ammo_stack: []
        };
    }
    
    if (itemType === 'magazine') {
        const magazineData = MAGAZINE_DATA[itemName];
        if (!magazineData) return null;
        const stashSize = magazineData.stashSize || { width: 1, height: 2 };
        return {
            id: null,
            item_type: 'magazine',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 1,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: 0, // 空のマガジンとしてスポーン
            ammo_stack: []
        };
    }
    
    if (itemType === 'ammo') {
        const ammoData = INVENTORY_AMMO_DATA[itemName];
        if (!ammoData) return null;
        const stashSize = AMMO_DATA[itemName]?.stashSize || { width: 1, height: 1 };
        const stackSize = ammoData.stackSize || 60; // 最大スタック数
        return {
            id: null,
            item_type: 'ammo',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 1,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: stackSize, // 最大スタック数でスポーン
            ammo_stack: null
        };
    }
    
    if (itemType === 'dogtag') {
        const dogtagData = DOGTAG_DATA[itemName];
        if (!dogtagData) return null;
        const stashSize = dogtagData.stashSize || { width: 1, height: 1 };
        return {
            id: null,
            item_type: 'dogtag',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 1,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: 1,
            ammo_stack: null
        };
    }
    
    if (itemType === 'flare') {
        const flareData = FLARE_DATA[itemName];
        if (!flareData) return null;
        const stashSize = flareData.stashSize || { width: 1, height: 2 };
        return {
            id: null,
            item_type: 'flare',
            item_name: itemName,
            width: stashSize.width || 1,
            height: stashSize.height || 2,
            grid_x: null,
            grid_y: null,
            equipped_slot: null,
            parent_item_id: null,
            quantity: 1,
            ammo_stack: null
        };
    }
    
    return null;
}

function removeLootItemMesh(mesh) {
    if (!mesh) return;
    scene.remove(mesh);
    const index = crateLootItems.indexOf(mesh);
    if (index !== -1) {
        crateLootItems.splice(index, 1);
    }
    const droppedIndex = droppedLootItems.indexOf(mesh);
    if (droppedIndex !== -1) {
        droppedLootItems.splice(droppedIndex, 1);
    }
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => mat.dispose?.());
        } else {
            mesh.material.dispose?.();
        }
    }
    if (focusedInteractable?.kind === 'loot' && focusedInteractable.mesh === mesh) {
        setFocusedInteractable(null);
    }
}

// ゾンビからアイテムをドロップ
function dropLootFromZombie(zombie) {
    if (!zombie || zombie.hasDroppedLoot) return;
    zombie.hasDroppedLoot = true;
    
    const zombiePos = zombie.group.position;
    
    // ボスゾンビの場合
    if (zombie.isBoss) {
        // ドッグタグを確定ドロップ
        const dogtagMesh = createLootItemMesh({
            name: 'ドッグタグ king of zombie',
            color: 0xffd700,
            itemType: 'dogtag'
        });
        if (dogtagMesh) {
            dogtagMesh.position.set(
                zombiePos.x + THREE.MathUtils.randFloatSpread(0.8),
                zombiePos.y + 0.2,
                zombiePos.z + THREE.MathUtils.randFloatSpread(0.8)
            );
            dogtagMesh.rotation.y = Math.random() * Math.PI * 2;
            scene.add(dogtagMesh);
            dogtagMesh.userData.interaction = { kind: 'loot', mesh: dogtagMesh };
            droppedLootItems.push(dogtagMesh);
        }
        
        // ランダムアイテムを7個ドロップ（ドッグタグ king of zombieは除外）
        for (let i = 0; i < 7; i++) {
            const lootDef = getRandomLootItemDefinition();
            if (!lootDef) continue;
            // 念のため、ドッグタグ king of zombieが選択されないようにする
            if (lootDef.name === 'ドッグタグ king of zombie') continue;
            
            const mesh = createLootItemMesh(lootDef);
            if (!mesh) continue;
            
            mesh.position.set(
                zombiePos.x + THREE.MathUtils.randFloatSpread(1.5),
                zombiePos.y + 0.2,
                zombiePos.z + THREE.MathUtils.randFloatSpread(1.5)
            );
            mesh.rotation.y = Math.random() * Math.PI * 2;
            scene.add(mesh);
            mesh.userData.interaction = { kind: 'loot', mesh };
            droppedLootItems.push(mesh);
        }
    } else {
        // 通常ゾンビの場合
        const lootDef = getRandomLootItemDefinition();
        if (!lootDef) return;
        
        const mesh = createLootItemMesh(lootDef);
        if (!mesh) return;
        
        mesh.position.set(
            zombiePos.x + THREE.MathUtils.randFloatSpread(0.5),
            zombiePos.y + 0.2,
            zombiePos.z + THREE.MathUtils.randFloatSpread(0.5)
        );
        mesh.rotation.y = Math.random() * Math.PI * 2;
        scene.add(mesh);
        mesh.userData.interaction = { kind: 'loot', mesh };
        droppedLootItems.push(mesh);
    }
}

function setFocusedInteractable(target) {
    if (focusedInteractable === target) return;
    focusedInteractable = target;
    if (!lootPromptOverrideText) {
        updateInteractionPrompt();
    }
}

function updateInteractionPrompt() {
    if (!lootPromptElement) return;
    if (lootPromptOverrideText) {
        lootPromptElement.textContent = lootPromptOverrideText;
        lootPromptElement.classList.toggle('error', !!lootPromptOverrideIsError);
        lootPromptElement.classList.remove('hidden');
        return;
    }
    if (!focusedInteractable) {
        lootPromptElement.classList.add('hidden');
        lootPromptElement.classList.remove('error');
        return;
    }
    
    let text = '';
    let isError = false;
    if (focusedInteractable.kind === 'loot') {
        const mesh = focusedInteractable.mesh;
        const displayName = getLootDisplayName(
            mesh.userData?.itemName,
            mesh.userData?.itemType
        );
        text = `${displayName} - Fキーで取得`;
    } else if (focusedInteractable.kind === 'raidPart') {
        const partType = focusedInteractable.partType;
        const partName = RAID_PART_CONFIG[partType]?.name || 'パーツ';
        text = `${partName} - Fキーで取得`;
    } else if (focusedInteractable.kind === 'generator') {
        const generator = focusedInteractable.generator;
        if (generator.isFixed) {
            text = '発電機: 稼働中';
        } else {
            const missing = [];
            if (!generator.hasSparkPlug) {
                missing.push(`スパークプラグ (${raidPartsInventory.sparkPlug}所持)`);
            }
            if (!generator.hasFuel) {
                missing.push(`燃料 (${raidPartsInventory.fuel}所持)`);
            }
            text = `発電機: ${missing.join(' / ')} - Fキーで修理`;
            if (!missing.length) {
                text = '発電機: 部品を確認中...';
            }
        }
    }
    
    if (text) {
        lootPromptElement.textContent = text;
        lootPromptElement.classList.toggle('error', !!isError);
        lootPromptElement.classList.remove('hidden');
    } else {
        lootPromptElement.classList.add('hidden');
        lootPromptElement.classList.remove('error');
    }
}

function showLootPromptMessage(message, isError = false) {
    setLootPromptOverride(message, isError);
    if (lootPromptTimeoutHandle) {
        clearTimeout(lootPromptTimeoutHandle);
    }
    lootPromptTimeoutHandle = setTimeout(() => {
        lootPromptTimeoutHandle = null;
        lootPromptOverrideText = null;
        lootPromptOverrideIsError = false;
        updateInteractionPrompt();
    }, LOOT_PROMPT_HIDE_DELAY);
}

function updateRaidPartStatusUI() {
    if (raidSparkCountElement) {
        raidSparkCountElement.textContent = raidPartsInventory.sparkPlug ?? 0;
    }
    if (raidFuelCountElement) {
        raidFuelCountElement.textContent = raidPartsInventory.fuel ?? 0;
    }
}

function resetRaidPartInventory() {
    raidPartsInventory.sparkPlug = 0;
    raidPartsInventory.fuel = 0;
    updateRaidPartStatusUI();
}

function updateInteractionFocus() {
    if (!camera || inventoryOpen) {
        setFocusedInteractable(null);
        return;
    }
    
    const meshes = [];
    crateLootItems.forEach(mesh => {
        if (mesh && mesh.parent) {
            meshes.push(mesh);
        }
    });
    droppedLootItems.forEach(mesh => {
        if (mesh && mesh.parent) {
            meshes.push(mesh);
        }
    });
    raidPartPickups.forEach(pickup => {
        if (pickup.mesh && pickup.mesh.parent) {
            meshes.push(pickup.mesh);
        }
    });
    generators.forEach(generator => {
        if (generator.interactionMesh && generator.interactionMesh.parent) {
            meshes.push(generator.interactionMesh);
        }
    });
    
    if (!meshes.length) {
        setFocusedInteractable(null);
        return;
    }
    
    lootRaycaster.setFromCamera(LOOT_RAY_ORIGIN, camera);
    lootRaycaster.far = LOOT_INTERACT_DISTANCE;
    const intersects = lootRaycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
        const interaction = intersects[0].object?.userData?.interaction || null;
        setFocusedInteractable(interaction);
    } else {
        setFocusedInteractable(null);
    }
}

function handleFocusedInteraction() {
    if (inventoryOpen || !focusedInteractable || generatorRepairState) return;
    switch (focusedInteractable.kind) {
        case 'loot':
            pickupLootMesh(focusedInteractable.mesh);
            break;
        case 'raidPart':
            pickupRaidPart(focusedInteractable.pickup);
            break;
        case 'generator':
            attemptGeneratorRepair(focusedInteractable.generator);
            break;
        default:
            break;
    }
}

async function pickupLootMesh(mesh) {
    if (!mesh) return;
    const itemName = mesh.userData?.itemName;
    const itemType = mesh.userData?.itemType || 'medical';
    if (!itemName) return;
    
    // 武器、バックパック、リグの場合は装備スロットを優先するため、バックパックチェックをスキップ
    // 装備スロットがいっぱいの場合のみバックパックが必要
    if (itemType !== 'weapon' && itemType !== 'backpack' && itemType !== 'rig' && !inventoryEquippedBackpack) {
        showLootPromptMessage('バックパックがありません', true);
        return;
    }
    
    // 武器の場合、装備スロットがいっぱいでバックパックがない場合はエラー
    if (itemType === 'weapon' && !inventoryEquippedBackpack) {
        const primaryWeapon = inventoryItems.find(item => item.equipped_slot === 'primary');
        const secondaryWeapon = inventoryItems.find(item => item.equipped_slot === 'secondary');
        if (primaryWeapon && secondaryWeapon) {
            showLootPromptMessage('装備スロットがいっぱいです。バックパックが必要です', true);
            return;
        }
    }
    
    const newItem = createInventoryItemFromLoot(itemName, itemType);
    if (!newItem) {
        showLootPromptMessage('このアイテムは取得できません', true);
        return;
    }
    
    const storedIn = await storeLootItemInInventory(newItem);
    if (!storedIn) {
        showLootPromptMessage('空きがありません', true);
        return;
    }
    
    // 武器の場合、対応するマガジンをアタッチメントとして追加
    if (itemType === 'weapon') {
        // 武器が保存された後にIDを取得するため、少し待ってから処理
        await loadInventoryItems();
        await attachMagazineToWeapon(itemName);
    }
    
    const displayName = getLootDisplayName(itemName, itemType);
    let message = `${displayName}を取得`;
    switch (storedIn) {
        case 'backpack':
            message = `${displayName}をバックパックに収納`;
            break;
        case 'rig':
            message = `${displayName}をリグに収納`;
            break;
        case 'equip-backpack':
            message = `${displayName}をバックパックとして装備`;
            break;
        case 'equip-rig':
            message = `${displayName}をリグとして装備`;
            break;
        case 'equip-primary':
            message = `${displayName}をメイン武器スロットに装備`;
            break;
        case 'equip-secondary':
            message = `${displayName}をサブ武器スロットに装備`;
            break;
    }
    showLootPromptMessage(message, false);
    removeLootItemMesh(mesh);
    setFocusedInteractable(null);
}

// 武器にマガジンをアタッチメントとして追加
async function attachMagazineToWeapon(weaponName) {
    const weaponData = WEAPON_DATA[weaponName];
    if (!weaponData || !weaponData.compatibleMagazines || weaponData.compatibleMagazines.length === 0) {
        return;
    }
    
    // 対応するマガジンを選択（複数ある場合は最初のものを使用）
    const magazineName = weaponData.compatibleMagazines[0];
    const magazineData = MAGAZINE_DATA[magazineName];
    if (!magazineData) return;
    
    // 武器のIDを取得（最新のアイテムリストから）
    await loadInventoryItems();
    // 最新に追加された武器を探す（装備スロットに入った場合も含む）
    const weaponItem = inventoryItems.find(item => 
        item.item_type === 'weapon' && 
        item.item_name === weaponName
    );
    
    if (!weaponItem) {
        console.error(`武器が見つかりません: ${weaponName}`);
        return;
    }
    
    // マガジンを作成
    const magazineItem = createInventoryItemFromLoot(magazineName, 'magazine');
    if (!magazineItem) return;
    
    // マガジンに合った弾薬を選択
    const magazineAmmoType = magazineData.ammoType; // 例：'5.56x45mm'
    const compatibleAmmo = Object.keys(INVENTORY_AMMO_DATA).find(ammoName => {
        const ammoData = INVENTORY_AMMO_DATA[ammoName];
        return ammoData && ammoData.caliber === magazineAmmoType;
    });
    
    // マガジンに最低10発の弾を装填
    if (compatibleAmmo) {
        const capacity = magazineData.capacity || 0;
        // 最低10発、容量を超えない（容量が10未満の場合は容量まで）
        const ammoCount = Math.min(Math.max(10, 0), capacity);
        
        // ammo_stackを初期化
        magazineItem.ammo_stack = [{
            type: compatibleAmmo,
            count: ammoCount
        }];
        magazineItem.quantity = ammoCount;
    } else {
        // 互換性のある弾薬が見つからない場合は空のマガジン
        magazineItem.ammo_stack = [];
        magazineItem.quantity = 0;
    }
    
    // マガジンを武器の子アイテムとして設定
    magazineItem.parent_item_id = weaponItem.id;
    magazineItem.grid_x = null;
    magazineItem.grid_y = null;
    magazineItem.equipped_slot = null;
    clearInventoryItemRigSlotPosition(magazineItem);
    
    // インベントリに追加
    inventoryItems.push(magazineItem);
    
    console.log(`マガジンを追加: ${magazineName} (武器: ${weaponName}, ID: ${weaponItem.id})`);
    
    // 保存
    await saveInventoryItems();
    
    // 保存後に再読み込みしてIDを確認
    await loadInventoryItems();
}

function createMansion() {
    const config = MANSION_CONFIG;
    if (!config) return;
    const { position, size, height, wallThickness, door } = config;
    
    const floorMaterial = new THREE.MeshLambertMaterial({ color: 0x2c2d30 });
    const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x5c5f69 });
    const trimMaterial = new THREE.MeshLambertMaterial({ color: 0x3e4048 });
    
    const stairConfig = {
        steps: 18,
        width: 10,
        depth: 20,
        startX: position.x - size.width / 2 + 10 / 2 + 4,
        startZ: position.z - size.depth / 2 + 20 / 2 + 6
    };
    stairConfig.stepHeight = config.secondFloorHeight / stairConfig.steps;
    stairConfig.stepDepth = stairConfig.depth / stairConfig.steps;
    stairConfig.holeWidth = stairConfig.width + 4;
    stairConfig.holeDepth = stairConfig.depth + 6;
    stairConfig.holeCenterX = stairConfig.startX;
    stairConfig.holeCenterZ = stairConfig.startZ + stairConfig.depth / 2;
    
    function addFloorSection(sectionWidth, sectionDepth, centerY, centerX, centerZ) {
        const section = new THREE.Mesh(
            new THREE.BoxGeometry(sectionWidth, 0.5, sectionDepth),
            floorMaterial
        );
        section.position.set(centerX, centerY, centerZ);
        section.receiveShadow = true;
        scene.add(section);
    }
    
    for (let level = 0; level < 2; level++) {
        const y = level * config.secondFloorHeight + 0.25;
        if (level === 0) {
            addFloorSection(size.width, size.depth, y, position.x, position.z);
        } else {
            const frontEdge = position.z + size.depth / 2;
            const backEdge = position.z - size.depth / 2;
            const leftEdge = position.x - size.width / 2;
            const rightEdge = position.x + size.width / 2;
            const holeFrontEdge = stairConfig.holeCenterZ + stairConfig.holeDepth / 2;
            const holeBackEdge = stairConfig.holeCenterZ - stairConfig.holeDepth / 2;
            const holeLeftEdge = stairConfig.holeCenterX - stairConfig.holeWidth / 2;
            const holeRightEdge = stairConfig.holeCenterX + stairConfig.holeWidth / 2;
            
            const frontDepth = frontEdge - holeFrontEdge;
            if (frontDepth > 0) {
                addFloorSection(size.width, frontDepth, y, position.x, holeFrontEdge + frontDepth / 2);
            }
            const backDepth = holeBackEdge - backEdge;
            if (backDepth > 0) {
                addFloorSection(size.width, backDepth, y, position.x, backEdge + backDepth / 2);
            }
            const sideDepth = holeFrontEdge - holeBackEdge;
            if (sideDepth > 0) {
                const leftWidth = holeLeftEdge - leftEdge;
                if (leftWidth > 0) {
                    addFloorSection(leftWidth, sideDepth, y, leftEdge + leftWidth / 2, stairConfig.holeCenterZ);
                }
                const rightWidth = rightEdge - holeRightEdge;
                if (rightWidth > 0) {
                    addFloorSection(rightWidth, sideDepth, y, holeRightEdge + rightWidth / 2, stairConfig.holeCenterZ);
                }
            }
        }
    }
    
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(size.width + 2, 0.6, size.depth + 2),
        trimMaterial
    );
    roof.position.set(position.x, height + 0.3, position.z);
    roof.castShadow = true;
    scene.add(roof);
    
    const wallSegments = [];
    const halfWidth = size.width / 2;
    const halfDepth = size.depth / 2;
    const doorHalf = door.width / 2;
    
    function addWall(length, thickness, pos, rotY) {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(length, height, thickness),
            wallMaterial
        );
        wall.position.copy(pos);
        wall.rotation.y = rotY;
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        const sizeVec = rotY === 0
            ? { x: length, y: height, z: thickness }
            : { x: thickness, y: height, z: length };
        const collision = new CollisionBox(
            new THREE.Vector3(pos.x, pos.y, pos.z),
            sizeVec
        );
        registerObstacle({ mesh: wall, collision });
        wallSegments.push(wall);
    }
    
    // Front wall (with door gap)
    const frontZ = position.z + halfDepth - wallThickness / 2;
    const backZ = position.z - halfDepth + wallThickness / 2;
    const leftX = position.x - halfWidth + wallThickness / 2;
    const rightX = position.x + halfWidth - wallThickness / 2;
    
    const frontSegmentLength = halfWidth - doorHalf;
    addWall(frontSegmentLength * 2, wallThickness, new THREE.Vector3(position.x, height / 2, backZ), 0);
    addWall(frontSegmentLength, wallThickness, new THREE.Vector3(position.x - (doorHalf + frontSegmentLength / 2), height / 2, frontZ), 0);
    addWall(frontSegmentLength, wallThickness, new THREE.Vector3(position.x + (doorHalf + frontSegmentLength / 2), height / 2, frontZ), 0);
    
    // Door frame
    const doorFrameThickness = 0.5;
    const doorFrameHeight = door.height;
    const doorFrameLeft = new THREE.Mesh(
        new THREE.BoxGeometry(doorFrameThickness, doorFrameHeight, wallThickness),
        trimMaterial
    );
    doorFrameLeft.position.set(position.x - doorHalf + doorFrameThickness / 2, doorFrameHeight / 2, frontZ);
    scene.add(doorFrameLeft);
    const doorFrameRight = doorFrameLeft.clone();
    doorFrameRight.position.x = position.x + doorHalf - doorFrameThickness / 2;
    scene.add(doorFrameRight);
    const doorHeader = new THREE.Mesh(
        new THREE.BoxGeometry(door.width, doorFrameThickness, wallThickness),
        trimMaterial
    );
    doorHeader.position.set(position.x, door.height - doorFrameThickness / 2, frontZ);
    scene.add(doorHeader);
    
    // Back wall
    addWall(size.width, wallThickness, new THREE.Vector3(position.x, height / 2, backZ), 0);
    // Left wall
    addWall(size.depth, wallThickness, new THREE.Vector3(leftX, height / 2, position.z), Math.PI / 2);
    // Right wall
    addWall(size.depth, wallThickness, new THREE.Vector3(rightX, height / 2, position.z), Math.PI / 2);
    
    // Interior pillars
    const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x484a54 });
    const pillarGeometry = new THREE.CylinderGeometry(0.4, 0.4, height * 0.6, 10);
    const pillarPositions = [
        { x: -size.width / 4, z: -size.depth / 4 },
        { x: size.width / 4, z: -size.depth / 4 },
        { x: -size.width / 4, z: size.depth / 4 },
        { x: size.width / 4, z: size.depth / 4 }
    ];
    pillarPositions.forEach(p => {
        const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        pillar.position.set(position.x + p.x, pillarGeometry.parameters.height / 2 + 0.25, position.z + p.z);
        pillar.castShadow = true;
        scene.add(pillar);
        
        const collision = new CollisionBox(
            new THREE.Vector3(pillar.position.x, pillar.position.y, pillar.position.z),
            { x: 0.8, y: pillarGeometry.parameters.height, z: 0.8 }
        );
        registerObstacle({ mesh: pillar, collision });
    });
    
    // Interior walls (corridors on both floors)
    const interiorWallThickness = 0.8;
    const corridorWidth = 6;
    for (let level = 0; level < 2; level++) {
        const floorY = level * config.secondFloorHeight;
        addWall(size.depth - 10, interiorWallThickness, new THREE.Vector3(position.x - corridorWidth / 2, floorY + height / 2, position.z), Math.PI / 2);
        addWall(size.depth - 10, interiorWallThickness, new THREE.Vector3(position.x + corridorWidth / 2, floorY + height / 2, position.z), Math.PI / 2);
    }
    
    // Entrance walkway
    const walkway = new THREE.Mesh(
        new THREE.BoxGeometry(door.width + 4, 0.2, 14),
        floorMaterial
    );
    walkway.position.set(position.x, 0.1, frontZ + 7);
    walkway.receiveShadow = true;
    scene.add(walkway);
    
    // Staircase
    const stairSteps = stairConfig.steps;
    const stairWidth = stairConfig.width;
    const stairDepth = stairConfig.depth;
    const stepHeight = stairConfig.stepHeight;
    const stepDepth = stairConfig.stepDepth;
    const stairStartX = stairConfig.startX;
    const stairStartZ = stairConfig.startZ;
    
    for (let i = 0; i < stairSteps; i++) {
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(stairWidth, stepHeight, stepDepth),
            floorMaterial
        );
        step.position.set(
            stairStartX,
            (i + 0.5) * stepHeight,
            stairStartZ + i * stepDepth
        );
        step.receiveShadow = true;
        scene.add(step);
        
        // 階段は視覚的なものなので衝突は設定しない
    }
    
    const stairLanding = new THREE.Mesh(
        new THREE.BoxGeometry(stairWidth + 2, 0.4, 10),
        floorMaterial
    );
    stairLanding.position.set(
        stairStartX,
        config.secondFloorHeight + 0.2,
        stairStartZ + stairDepth
    );
    stairLanding.receiveShadow = true;
    scene.add(stairLanding);
    
    const railingMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2c32 });
    const railingHeight = 3.5;
    const railingThickness = 0.4;
    const railing = new THREE.Mesh(
        new THREE.BoxGeometry(stairWidth + 2, railingHeight, railingThickness),
        railingMaterial
    );
    railing.position.set(
        stairStartX,
        config.secondFloorHeight + railingHeight / 2,
        stairLanding.position.z + stairLanding.geometry.parameters.depth / 2 - railingThickness / 2
    );
    scene.add(railing);
    // stair zone data
    mansionElements.stairZone = {
        centerX: stairConfig.holeCenterX,
        width: stairConfig.holeWidth,
        startZ: stairConfig.startZ - stepDepth / 2,
        ascendEndZ: stairConfig.startZ + stairConfig.depth + stepDepth / 2,
        endZ: stairLanding.position.z + stairLanding.geometry.parameters.depth / 2,
        baseY: 0,
        topY: config.secondFloorHeight
    };
}

// ゾンビのアーマーとヘルメットの色マッピング（防御力ごと）
const ZOMBIE_ARMOR_COLORS = {
    10: 0xFFFFFF,  // 白
    20: 0x00FFFF,  // 水色
    30: 0x0000FF,  // 青
    40: 0x90EE90,  // 黄緑
    50: 0x006400,  // 深緑
    60: 0x800080   // 紫
};

// ゾンビのアーマー装備確率（防御力ごと）
const ZOMBIE_ARMOR_PROBABILITIES = [
    { armorClass: 10, probability: 0.50 },
    { armorClass: 20, probability: 0.30 },
    { armorClass: 30, probability: 0.10 },
    { armorClass: 40, probability: 0.05 },
    { armorClass: 50, probability: 0.03 },
    { armorClass: 60, probability: 0.02 }
];

// ゾンビのヘルメット装備確率（防御力ごと）
const ZOMBIE_HELMET_PROBABILITIES = [
    { armorClass: 10, probability: 0.50 },
    { armorClass: 20, probability: 0.30 },
    { armorClass: 30, probability: 0.10 },
    { armorClass: 40, probability: 0.07 },
    { armorClass: 50, probability: 0.03 }
];

// ゾンビのアーマークラスをランダムに選択
function selectZombieArmorClass() {
    const rand = Math.random();
    let cumulative = 0;
    for (const item of ZOMBIE_ARMOR_PROBABILITIES) {
        cumulative += item.probability;
        if (rand <= cumulative) {
            return item.armorClass;
        }
    }
    // フォールバック（確率の合計が1未満の場合）
    return 10;
}

// ゾンビのヘルメットクラスをランダムに選択
function selectZombieHelmetClass() {
    const rand = Math.random();
    let cumulative = 0;
    for (const item of ZOMBIE_HELMET_PROBABILITIES) {
        cumulative += item.probability;
        if (rand <= cumulative) {
            return item.armorClass;
        }
    }
    // フォールバック（確率の合計が1未満の場合）
    return 10;
}

// ゾンビ作成
function createZombies() {
    const zombieCount = 40; // 40体生成
    const zombiePositions = [];
    
    // ランダムな位置を生成（マンションエリアとプレイヤーの初期位置を避ける）
    const minDistanceFromPlayer = 30; // プレイヤーから最低30m離す
    const maxAttempts = 1000; // 位置生成の最大試行回数
    
    for (let i = 0; i < zombieCount; i++) {
        let x, z, attempts = 0;
        let validPosition = false;
        
        while (!validPosition && attempts < maxAttempts) {
            // マップ全体にランダムに配置（マップサイズの70%の範囲内）
            x = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.7);
            z = THREE.MathUtils.randFloatSpread(MAP_SIZE * 0.7);
            
            // プレイヤーの初期位置から離れているかチェック
            const distanceFromPlayer = Math.sqrt(x * x + z * z);
            
            // マンションエリアと重ならないかチェック
            const zombieSize = { x: 0.65, y: 2, z: 0.6 };
            const notInMansion = !isAreaIntersectingMansion(x, z, zombieSize);
            
            // プレイヤーから適切な距離にあるかチェック
            const farEnoughFromPlayer = distanceFromPlayer >= minDistanceFromPlayer;
            
            if (notInMansion && farEnoughFromPlayer) {
                validPosition = true;
            }
            
            attempts++;
        }
        
        if (validPosition) {
            zombiePositions.push({ x: x, y: getTerrainHeight(x, z), z: z });
        } else {
            // 位置が見つからない場合は、マンションから離れた固定位置に配置
            const fallbackPositions = [
                { x: 100, y: 0, z: 100 },
                { x: -100, y: 0, z: 100 },
                { x: 100, y: 0, z: -100 },
                { x: -100, y: 0, z: -100 },
                { x: 150, y: 0, z: 0 },
                { x: -150, y: 0, z: 0 },
                { x: 0, y: 0, z: 150 },
                { x: 0, y: 0, z: -150 }
            ];
            const fallbackIndex = i % fallbackPositions.length;
            const fallback = fallbackPositions[fallbackIndex];
            zombiePositions.push({ x: fallback.x, y: getTerrainHeight(fallback.x, fallback.z), z: fallback.z });
        }
    }

    const torsoHeight = 0.65;
    const torsoWidth = 0.42;
    const torsoDepth = 0.28;
    const upperLegLength = 0.48;
    const lowerLegLength = 0.48;
    const upperArmLength = 0.34;
    const lowerArmLength = 0.3;
    const legRadius = 0.095;
    const armRadius = 0.068;
    const headRadius = 0.18;
    const neckHeight = 0.08;
    const hipHeight = lowerLegLength + upperLegLength;
    const shoulderHeight = hipHeight + torsoHeight - 0.08;
    const zombieHeight = hipHeight + torsoHeight + neckHeight + headRadius * 2;

    for (let i = 0; i < zombieCount; i++) {
        const zombieGroup = new THREE.Group();

        // ゾンビのアーマーとヘルメットをランダムに選択
        const armorClass = selectZombieArmorClass();
        const helmetClass = selectZombieHelmetClass();
        const armorColor = new THREE.Color(ZOMBIE_ARMOR_COLORS[armorClass]);
        const helmetColor = new THREE.Color(ZOMBIE_ARMOR_COLORS[helmetClass]);

        // ゾンビの色（緑がかった色）
        const bodyColor = new THREE.Color().setHSL(0.15, 0.7, 0.3);
        const limbColor = bodyColor.clone().offsetHSL(0, 0, -0.05);
        const detailColor = bodyColor.clone().offsetHSL(0, -0.1, -0.1);

        // 骨盤
        const pelvis = new THREE.Mesh(
            new THREE.BoxGeometry(torsoWidth * 0.8, 0.18, torsoDepth * 0.8),
            new THREE.MeshLambertMaterial({ color: detailColor })
        );
        pelvis.position.set(0, hipHeight - 0.09, 0);
        pelvis.castShadow = true;
        zombieGroup.add(pelvis);

        // 胴体（胸部と腹部を含む）
        const torso = new THREE.Mesh(
            new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth),
            new THREE.MeshLambertMaterial({ color: bodyColor })
        );
        torso.position.set(0, hipHeight + torsoHeight / 2, 0);
        torso.castShadow = true;
        // 胴体の上半分は胸部、下半分は腹部として扱う（当たった位置で判定）
        torso.userData.bodyPart = 'torso'; // 後で当たった位置で判定
        zombieGroup.add(torso);
        
        // アーマーを視覚的に表示（胴体の上に少し大きめのボックスを重ねる）
        const armorMesh = new THREE.Mesh(
            new THREE.BoxGeometry(torsoWidth * 1.05, torsoHeight * 1.05, torsoDepth * 1.05),
            new THREE.MeshLambertMaterial({ color: armorColor, transparent: true, opacity: 0.7 })
        );
        armorMesh.position.set(0, hipHeight + torsoHeight / 2, 0);
        armorMesh.castShadow = true;
        armorMesh.userData.isArmor = true;
        zombieGroup.add(armorMesh);

        // 首
        const neck = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, neckHeight, 12),
            new THREE.MeshLambertMaterial({ color: detailColor })
        );
        neck.position.set(0, hipHeight + torsoHeight + neckHeight / 2, 0);
        neck.castShadow = true;
        zombieGroup.add(neck);

        // 頭
        const head = new THREE.Mesh(
            new THREE.SphereGeometry(headRadius, 16, 16),
            new THREE.MeshLambertMaterial({ color: bodyColor })
        );
        head.position.set(0, hipHeight + torsoHeight + neckHeight + headRadius, 0);
        head.castShadow = true;
        head.userData.bodyPart = 'head';
        zombieGroup.add(head);
        
        // ヘルメットを視覚的に表示（頭の上に少し大きめのスフィアを重ねる）
        const helmetMesh = new THREE.Mesh(
            new THREE.SphereGeometry(headRadius * 1.1, 16, 16),
            new THREE.MeshLambertMaterial({ color: helmetColor, transparent: true, opacity: 0.7 })
        );
        helmetMesh.position.set(0, hipHeight + torsoHeight + neckHeight + headRadius, 0);
        helmetMesh.castShadow = true;
        helmetMesh.userData.isHelmet = true;
        zombieGroup.add(helmetMesh);

        // 腕
        const shoulderOffset = torsoWidth / 2 + 0.03;
        let leftArmMesh = null;
        let rightArmMesh = null;
        ['left', 'right'].forEach(side => {
            const dir = side === 'left' ? -1 : 1;
            const armPart = side === 'left' ? 'leftArm' : 'rightArm';
            const upperArm = new THREE.Mesh(
                new THREE.CylinderGeometry(armRadius, armRadius, upperArmLength, 12),
                new THREE.MeshLambertMaterial({ color: limbColor })
            );
            upperArm.castShadow = true;
            upperArm.userData.bodyPart = armPart;
            zombieGroup.add(upperArm);
            if (side === 'left') leftArmMesh = upperArm;
            else rightArmMesh = upperArm;

            const lowerArm = new THREE.Mesh(
                new THREE.CylinderGeometry(armRadius * 0.95, armRadius * 0.95, lowerArmLength, 12),
                new THREE.MeshLambertMaterial({ color: limbColor })
            );
            lowerArm.castShadow = true;
            lowerArm.userData.bodyPart = armPart;
            zombieGroup.add(lowerArm);

            const hand = new THREE.Mesh(
                new THREE.BoxGeometry(0.09, 0.05, 0.12),
                new THREE.MeshLambertMaterial({ color: detailColor })
            );
            hand.castShadow = true;
            hand.userData.bodyPart = armPart;
            zombieGroup.add(hand);

            const upperArmPivot = new THREE.Object3D();
            upperArmPivot.position.set(dir * shoulderOffset, shoulderHeight, torsoDepth / 2);
            zombieGroup.add(upperArmPivot);
            upperArmPivot.add(upperArm);
            upperArmPivot.rotation.z = THREE.Math.degToRad(dir * 25);
            upperArm.position.set(0, -upperArmLength / 2, 0);

            const lowerArmPivot = new THREE.Object3D();
            lowerArmPivot.position.set(0, -upperArmLength, 0);
            upperArmPivot.add(lowerArmPivot);
            lowerArmPivot.add(lowerArm);
            lowerArm.position.set(0, -lowerArmLength / 2, 0);

            const handPivot = new THREE.Object3D();
            handPivot.position.set(0, -lowerArmLength, 0);
            lowerArmPivot.add(handPivot);
            handPivot.add(hand);
        });

        // 脚
        const legOffset = 0.14;
        let leftLegMesh = null;
        let rightLegMesh = null;
        ['left', 'right'].forEach(side => {
            const dir = side === 'left' ? -1 : 1;
            const legPart = side === 'left' ? 'leftLeg' : 'rightLeg';
            const upperLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(legRadius, legRadius, upperLegLength, 12),
                new THREE.MeshLambertMaterial({ color: limbColor })
            );
            upperLeg.position.set(
                dir * legOffset,
                lowerLegLength + upperLegLength / 2,
                0
            );
            upperLeg.castShadow = true;
            upperLeg.userData.bodyPart = legPart;
            zombieGroup.add(upperLeg);
            if (side === 'left') leftLegMesh = upperLeg;
            else rightLegMesh = upperLeg;

            const lowerLeg = new THREE.Mesh(
                new THREE.CylinderGeometry(legRadius * 0.9, legRadius * 0.9, lowerLegLength, 12),
                new THREE.MeshLambertMaterial({ color: limbColor })
            );
            lowerLeg.position.set(
                dir * legOffset,
                lowerLegLength / 2,
                0
            );
            lowerLeg.castShadow = true;
            lowerLeg.userData.bodyPart = legPart;
            zombieGroup.add(lowerLeg);

            const foot = new THREE.Mesh(
                new THREE.BoxGeometry(0.18, 0.08, 0.28),
                new THREE.MeshLambertMaterial({ color: detailColor })
            );
            foot.position.set(dir * legOffset, 0.04, 0.09);
            foot.castShadow = true;
            foot.receiveShadow = true;
            foot.userData.bodyPart = legPart;
            zombieGroup.add(foot);
        });

        // ゾンビの位置を設定
        const spawn = zombiePositions[i];
        zombieGroup.position.set(spawn.x, spawn.y, spawn.z);
        scene.add(zombieGroup);

        const zombieCollision = new CollisionBox(
            new THREE.Vector3(spawn.x, spawn.y + zombieHeight / 2, spawn.z),
            { x: 0.65, y: zombieHeight, z: 0.6 }
        );

        const bodyParts = {
            head: { health: 35, maxHealth: 35 },
            face: { health: 35, maxHealth: 35 }, // 顔（ヘルメットの上、ダメージは頭に転送）
            chest: { health: 85, maxHealth: 85 },
            stomach: { health: 70, maxHealth: 70 },
            leftArm: { health: 60, maxHealth: 60 },
            rightArm: { health: 60, maxHealth: 60 },
            leftLeg: { health: 65, maxHealth: 65 },
            rightLeg: { health: 65, maxHealth: 65 }
        };

        zombies.push({
            group: zombieGroup,
            collision: zombieCollision,
            height: zombieHeight,
            baseSpeed: GAME_CONFIG.moveSpeed * 0.8, // 基本速度（プレイヤーの0.8倍速）
            speed: GAME_CONFIG.moveSpeed * 0.8, // 現在の速度（壊死などで変動）
            bodyParts: bodyParts,
            blackedOut: [], // 壊死した部位のリスト
            isDead: false,
            hasDroppedLoot: false, // アイテムをドロップしたかどうか
            targetPosition: null, // 追跡目標位置
            lastSoundCheck: 0, // 最後に音をチェックした時刻
            lastUpdate: 0, // 最後に更新した時刻（パフォーマンス最適化用）
            lastDamageTime: 0, // 最後にダメージを与えた時刻
            hasFoundPlayer: false, // 一度プレイヤーを見つけたかどうか
            head: head,
            torso: torso,
            leftArm: leftArmMesh,
            rightArm: rightArmMesh,
            leftLeg: leftLegMesh,
            rightLeg: rightLegMesh,
            xpGranted: false,
            armorClass: armorClass, // アーマーの防御力
            helmetClass: helmetClass, // ヘルメットの防御力
            armorMesh: armorMesh, // アーマーのメッシュ
            helmetMesh: helmetMesh // ヘルメットのメッシュ
        });
    }
}

// ボスゾンビ作成
function createBossZombie() {
    if (bossZombie) return; // 既にボスが存在する場合は作成しない
    
    // 館周辺の位置を生成
    const mansionPos = MANSION_CONFIG.position;
    const mansionSize = MANSION_CONFIG.size;
    // 館のサイズを考慮（幅80m、奥行き60m、中心から端まで約40-50m）
    // 館の端から最低30m離すため、館の中心からは最低70m離す
    const minDistance = 70; // 館の中心から最低70m離す（館の端から約30m）
    const spawnRadius = 100; // 館から100m以内
    
    let x, z, attempts = 0;
    let validPosition = false;
    
    while (!validPosition && attempts < 200) {
        // 館周辺のランダムな位置
        const angle = Math.random() * Math.PI * 2;
        const distance = minDistance + Math.random() * (spawnRadius - minDistance);
        x = mansionPos.x + Math.cos(angle) * distance;
        z = mansionPos.z + Math.sin(angle) * distance;
        
        // マンションエリアと重ならないかチェック（より厳密に）
        const bossSize = { x: 0.65 * 3, y: 2 * 3, z: 0.6 * 3 };
        // 館の端からさらに余裕を持たせる（paddingを追加）
        const notInMansion = !isAreaIntersectingMansion(x, z, bossSize) && !isInsideMansionArea(x, z, 30);
        
        if (notInMansion) {
            validPosition = true;
        }
        attempts++;
    }
    
    if (!validPosition) {
        // フォールバック位置（館から十分離れた位置）
        x = mansionPos.x + 80;
        z = mansionPos.z + 80;
    }
    
    // ボスゾンビのサイズ（通常の3倍）
    const scale = 3;
    const torsoHeight = 0.65 * scale;
    const torsoWidth = 0.42 * scale;
    const torsoDepth = 0.28 * scale;
    const upperLegLength = 0.48 * scale;
    const lowerLegLength = 0.48 * scale;
    const upperArmLength = 0.34 * scale;
    const lowerArmLength = 0.3 * scale;
    const legRadius = 0.095 * scale;
    const armRadius = 0.068 * scale;
    const headRadius = 0.18 * scale;
    const neckHeight = 0.08 * scale;
    const hipHeight = lowerLegLength + upperLegLength;
    const shoulderHeight = hipHeight + torsoHeight - 0.08 * scale;
    const zombieHeight = hipHeight + torsoHeight + neckHeight + headRadius * 2;
    
    const zombieGroup = new THREE.Group();
    
    // ボスゾンビのアーマーとヘルメットをランダムに選択
    const bossArmorClass = selectZombieArmorClass();
    const bossHelmetClass = selectZombieHelmetClass();
    const bossArmorColor = new THREE.Color(ZOMBIE_ARMOR_COLORS[bossArmorClass]);
    const bossHelmetColor = new THREE.Color(ZOMBIE_ARMOR_COLORS[bossHelmetClass]);
    
    // ボスゾンビの色（より暗い赤みがかった色）
    const bodyColor = new THREE.Color().setHSL(0.0, 0.8, 0.2);
    const limbColor = bodyColor.clone().offsetHSL(0, 0, -0.05);
    const detailColor = bodyColor.clone().offsetHSL(0, -0.1, -0.1);
    
    // 骨盤
    const pelvis = new THREE.Mesh(
        new THREE.BoxGeometry(torsoWidth * 0.8, 0.18 * scale, torsoDepth * 0.8),
        new THREE.MeshLambertMaterial({ color: detailColor })
    );
    pelvis.position.set(0, hipHeight - 0.09 * scale, 0);
    pelvis.castShadow = true;
    zombieGroup.add(pelvis);
    
    // 胴体
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth),
        new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    torso.position.set(0, hipHeight + torsoHeight / 2, 0);
    torso.castShadow = true;
    torso.userData.bodyPart = 'torso';
    zombieGroup.add(torso);
    
    // アーマーを視覚的に表示（胴体の上に少し大きめのボックスを重ねる）
    const bossArmorMesh = new THREE.Mesh(
        new THREE.BoxGeometry(torsoWidth * 1.05, torsoHeight * 1.05, torsoDepth * 1.05),
        new THREE.MeshLambertMaterial({ color: bossArmorColor, transparent: true, opacity: 0.7 })
    );
    bossArmorMesh.position.set(0, hipHeight + torsoHeight / 2, 0);
    bossArmorMesh.castShadow = true;
    bossArmorMesh.userData.isArmor = true;
    zombieGroup.add(bossArmorMesh);
    
    // 首
    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, neckHeight, 12),
        new THREE.MeshLambertMaterial({ color: detailColor })
    );
    neck.position.set(0, hipHeight + torsoHeight + neckHeight / 2, 0);
    neck.castShadow = true;
    zombieGroup.add(neck);
    
    // 頭
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius, 16, 16),
        new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    head.position.set(0, hipHeight + torsoHeight + neckHeight + headRadius, 0);
    head.castShadow = true;
    head.userData.bodyPart = 'head';
    zombieGroup.add(head);
    
    // ヘルメットを視覚的に表示（頭の上に少し大きめのスフィアを重ねる）
    const bossHelmetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius * 1.1, 16, 16),
        new THREE.MeshLambertMaterial({ color: bossHelmetColor, transparent: true, opacity: 0.7 })
    );
    bossHelmetMesh.position.set(0, hipHeight + torsoHeight + neckHeight + headRadius, 0);
    bossHelmetMesh.castShadow = true;
    bossHelmetMesh.userData.isHelmet = true;
    zombieGroup.add(bossHelmetMesh);
    
    // 腕
    const shoulderOffset = torsoWidth / 2 + 0.03 * scale;
    let leftArmMesh = null;
    let rightArmMesh = null;
    ['left', 'right'].forEach(side => {
        const dir = side === 'left' ? -1 : 1;
        const armPart = side === 'left' ? 'leftArm' : 'rightArm';
        const upperArm = new THREE.Mesh(
            new THREE.CylinderGeometry(armRadius, armRadius, upperArmLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        upperArm.castShadow = true;
        upperArm.userData.bodyPart = armPart;
        zombieGroup.add(upperArm);
        if (side === 'left') leftArmMesh = upperArm;
        else rightArmMesh = upperArm;
        
        const lowerArm = new THREE.Mesh(
            new THREE.CylinderGeometry(armRadius * 0.95, armRadius * 0.95, lowerArmLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        lowerArm.castShadow = true;
        lowerArm.userData.bodyPart = armPart;
        zombieGroup.add(lowerArm);
        
        const hand = new THREE.Mesh(
            new THREE.BoxGeometry(0.09 * scale, 0.05 * scale, 0.12 * scale),
            new THREE.MeshLambertMaterial({ color: detailColor })
        );
        hand.castShadow = true;
        hand.userData.bodyPart = armPart;
        zombieGroup.add(hand);
        
        const upperArmPivot = new THREE.Object3D();
        upperArmPivot.position.set(dir * shoulderOffset, shoulderHeight, torsoDepth / 2);
        zombieGroup.add(upperArmPivot);
        upperArmPivot.add(upperArm);
        upperArmPivot.rotation.z = THREE.Math.degToRad(dir * 25);
        upperArm.position.set(0, -upperArmLength / 2, 0);
        
        const lowerArmPivot = new THREE.Object3D();
        lowerArmPivot.position.set(0, -upperArmLength, 0);
        upperArmPivot.add(lowerArmPivot);
        lowerArmPivot.add(lowerArm);
        lowerArm.position.set(0, -lowerArmLength / 2, 0);
        
        const handPivot = new THREE.Object3D();
        handPivot.position.set(0, -lowerArmLength, 0);
        lowerArmPivot.add(handPivot);
        handPivot.add(hand);
    });
    
    // 脚
    const legOffset = 0.14 * scale;
    let leftLegMesh = null;
    let rightLegMesh = null;
    ['left', 'right'].forEach(side => {
        const dir = side === 'left' ? -1 : 1;
        const legPart = side === 'left' ? 'leftLeg' : 'rightLeg';
        const upperLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(legRadius, legRadius, upperLegLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        upperLeg.position.set(
            dir * legOffset,
            lowerLegLength + upperLegLength / 2,
            0
        );
        upperLeg.castShadow = true;
        upperLeg.userData.bodyPart = legPart;
        zombieGroup.add(upperLeg);
        if (side === 'left') leftLegMesh = upperLeg;
        else rightLegMesh = upperLeg;
        
        const lowerLeg = new THREE.Mesh(
            new THREE.CylinderGeometry(legRadius * 0.9, legRadius * 0.9, lowerLegLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        lowerLeg.position.set(
            dir * legOffset,
            lowerLegLength / 2,
            0
        );
        lowerLeg.castShadow = true;
        lowerLeg.userData.bodyPart = legPart;
        zombieGroup.add(lowerLeg);
        
        const foot = new THREE.Mesh(
            new THREE.BoxGeometry(0.18 * scale, 0.08 * scale, 0.28 * scale),
            new THREE.MeshLambertMaterial({ color: detailColor })
        );
        foot.position.set(dir * legOffset, 0.04 * scale, 0.09 * scale);
        foot.castShadow = true;
        foot.receiveShadow = true;
        foot.userData.bodyPart = legPart;
        zombieGroup.add(foot);
    });
    
    // ボスゾンビの位置を設定
    const bossGroundHeight = getTerrainHeight(x, z);
    zombieGroup.position.set(x, bossGroundHeight, z);
    scene.add(zombieGroup);
    
    const zombieCollision = new CollisionBox(
        new THREE.Vector3(x, bossGroundHeight + zombieHeight / 2, z),
        { x: 0.65 * scale, y: zombieHeight, z: 0.6 * scale }
    );
    
    // ボスの体力は通常ゾンビの5倍
    const bodyParts = {
        head: { health: 35 * 5, maxHealth: 35 * 5 },
        face: { health: 35 * 5, maxHealth: 35 * 5 }, // 顔（ヘルメットの上、ダメージは頭に転送）
        chest: { health: 85 * 5, maxHealth: 85 * 5 },
        stomach: { health: 70 * 5, maxHealth: 70 * 5 },
        leftArm: { health: 60 * 5, maxHealth: 60 * 5 },
        rightArm: { health: 60 * 5, maxHealth: 60 * 5 },
        leftLeg: { health: 65 * 5, maxHealth: 65 * 5 },
        rightLeg: { health: 65 * 5, maxHealth: 65 * 5 }
    };
    
    bossZombie = {
        group: zombieGroup,
        collision: zombieCollision,
        height: zombieHeight,
        baseSpeed: GAME_CONFIG.moveSpeed * 0.8, // 基本速度（プレイヤーの0.8倍速）
        speed: GAME_CONFIG.moveSpeed * 0.8, // 現在の速度（壊死などで変動）
        bodyParts: bodyParts,
        blackedOut: [], // 壊死した部位のリスト
        isDead: false,
        hasDroppedLoot: false, // アイテムをドロップしたかどうか
        isBoss: true, // ボスフラグ
        targetPosition: null, // 追跡目標位置
        lastSoundCheck: 0, // 最後に音をチェックした時刻
        lastUpdate: 0, // 最後に更新した時刻（パフォーマンス最適化用）
        lastDamageTime: 0, // 最後にダメージを与えた時刻
        hasFoundPlayer: false, // 一度プレイヤーを見つけたかどうか
        head: head,
        torso: torso,
        leftArm: leftArmMesh,
        rightArm: rightArmMesh,
        leftLeg: leftLegMesh,
        rightLeg: rightLegMesh,
        xpGranted: false,
        armorClass: bossArmorClass, // アーマーの防御力
        helmetClass: bossHelmetClass, // ヘルメットの防御力
        armorMesh: bossArmorMesh, // アーマーのメッシュ
        helmetMesh: bossHelmetMesh // ヘルメットのメッシュ
    };
}

function createPlayerCharacter() {
    if (player && scene) {
        scene.remove(player);
    }
    
    const torsoHeight = 0.65;
    const torsoWidth = 0.42;
    const torsoDepth = 0.28;
    const upperLegLength = 0.48;
    const lowerLegLength = 0.48;
    const upperArmLength = 0.32;
    const lowerArmLength = 0.3;
    const legRadius = 0.09;
    const armRadius = 0.065;
    const headRadius = 0.17;
    const neckHeight = 0.08;
    const shoulderHeight = upperLegLength + lowerLegLength + torsoHeight - 0.1;
    
    player = new THREE.Group();
    const primaryColor = new THREE.Color(0x2f3a4d);
    const limbColor = primaryColor.clone().offsetHSL(0, -0.05, -0.05);
    const detailColor = new THREE.Color(0x1f2532);
    
    // 足
    const legOffset = 0.14;
    const hipHeight = lowerLegLength + upperLegLength;
    
    const createLeg = (dir) => {
        const group = new THREE.Group();
        const thigh = new THREE.Mesh(
            new THREE.CylinderGeometry(legRadius, legRadius, upperLegLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        thigh.position.set(dir * legOffset, hipHeight - upperLegLength / 2, 0);
        thigh.castShadow = true;
        group.add(thigh);
        
        const shin = new THREE.Mesh(
            new THREE.CylinderGeometry(legRadius * 0.9, legRadius * 0.9, lowerLegLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        shin.position.set(dir * legOffset, lowerLegLength / 2, 0);
        shin.castShadow = true;
        group.add(shin);
        
        const foot = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.08, 0.26),
            new THREE.MeshLambertMaterial({ color: detailColor })
        );
        foot.position.set(dir * legOffset, 0.04, 0.09);
        foot.castShadow = true;
        group.add(foot);
        
        return { group, thigh };
    };
    
    const leftLeg = createLeg(-1);
    const rightLeg = createLeg(1);
    player.add(leftLeg.group);
    player.add(rightLeg.group);
    
    // 骨盤
    const pelvis = new THREE.Mesh(
        new THREE.BoxGeometry(torsoWidth * 0.8, 0.18, torsoDepth * 0.8),
        new THREE.MeshLambertMaterial({ color: detailColor })
    );
    pelvis.position.set(0, hipHeight - 0.09, 0);
    pelvis.castShadow = true;
    player.add(pelvis);
    
    // 胴体（胸部・腹部）
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(torsoWidth, torsoHeight, torsoDepth),
        new THREE.MeshLambertMaterial({ color: primaryColor })
    );
    torso.position.set(0, hipHeight + torsoHeight / 2, 0);
    torso.castShadow = true;
    player.add(torso);
    
    // 首
    const neck = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, neckHeight, 12),
        new THREE.MeshLambertMaterial({ color: detailColor })
    );
    neck.position.set(0, hipHeight + torsoHeight + neckHeight / 2, 0);
    neck.castShadow = true;
    player.add(neck);
    
    // 頭
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(headRadius, 16, 16),
        new THREE.MeshLambertMaterial({ color: primaryColor })
    );
    head.position.set(0, hipHeight + torsoHeight + neckHeight + headRadius, 0);
    head.castShadow = true;
    player.add(head);
    
    // 腕（自然な構え）
    const shoulderOffset = torsoWidth / 2 + 0.05;
    const createArm = (dir) => {
        const upperArm = new THREE.Mesh(
            new THREE.CylinderGeometry(armRadius, armRadius, upperArmLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        upperArm.castShadow = true;
        
        const lowerArm = new THREE.Mesh(
            new THREE.CylinderGeometry(armRadius * 0.9, armRadius * 0.9, lowerArmLength, 12),
            new THREE.MeshLambertMaterial({ color: limbColor })
        );
        lowerArm.castShadow = true;
        
        const hand = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.05, 0.1),
            new THREE.MeshLambertMaterial({ color: detailColor })
        );
        hand.castShadow = true;
        
        const upperPivot = new THREE.Object3D();
        upperPivot.position.set(dir * shoulderOffset, shoulderHeight, 0);
        upperPivot.rotation.z = THREE.Math.degToRad(dir * 10);
        upperPivot.rotation.x = THREE.Math.degToRad(-8);
        player.add(upperPivot);
        
        upperArm.position.set(0, -upperArmLength / 2, 0);
        upperPivot.add(upperArm);
        
        const lowerPivot = new THREE.Object3D();
        lowerPivot.position.set(0, -upperArmLength, 0);
        lowerPivot.rotation.x = THREE.Math.degToRad(-12);
        upperPivot.add(lowerPivot);
        lowerArm.position.set(0, -lowerArmLength / 2, 0);
        lowerPivot.add(lowerArm);
        
        const handPivot = new THREE.Object3D();
        handPivot.position.set(0, -lowerArmLength, 0);
        handPivot.rotation.x = THREE.Math.degToRad(-5);
        lowerPivot.add(handPivot);
        handPivot.add(hand);
        
        return upperArm;
    };
    
    const leftArm = createArm(-1);
    const rightArm = createArm(1);
    
    playerParts = {
        head,
        chest: torso,
        stomach: torso,
        leftArm,
        rightArm,
        leftLeg: leftLeg.thigh,
        rightLeg: rightLeg.thigh
    };
    
    player.visible = false; // 一人称視点のため非表示
    scene.add(player);
    updatePlayerAvatarTransform();
}

// 的作成
function createTargets() {
    const targetPositions = [
        { x: 20, y: 0, z: 20 },
        { x: -20, y: 0, z: 20 },
        { x: 20, y: 0, z: -20 },
        { x: -20, y: 0, z: -20 },
        { x: 0, y: 0, z: 30 }
    ];

    targetPositions.forEach((pos, index) => {
        // 的のグループ
        const targetGroup = new THREE.Group();
        
        // 的の板（円形）
        const targetGeometry = new THREE.CylinderGeometry(1.0, 1.0, 0.1, 32);
        const targetMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const targetBoard = new THREE.Mesh(targetGeometry, targetMaterial);
        targetBoard.rotation.x = Math.PI / 2;
        targetBoard.position.set(0, 1.5, 0);
        targetBoard.castShadow = true;
        targetBoard.receiveShadow = true;
        targetGroup.add(targetBoard);
        
        // 的の中心（赤い円）
        const centerGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.11, 16);
        const centerMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.rotation.x = Math.PI / 2;
        center.position.set(0, 1.5, 0);
        targetGroup.add(center);
        
        // 的の位置を設定
        const groundHeight = getTerrainHeight(pos.x, pos.z);
        targetGroup.position.set(pos.x, groundHeight, pos.z);
        scene.add(targetGroup);
        
        // 的の情報表示用のテキスト（3Dテキストではなく、後でHTMLで表示）
        targets.push({
            group: targetGroup,
            board: targetBoard,
            center: center,
            position: pos,
            hitInfo: null, // 最後に当たった弾の情報
            hitTime: 0, // 当たった時刻
            hitMarks: [] // 命中位置の印（最大30個）
        });
    });
}

// イベントリスナー設定
function setupEventListeners() {
    // キーボード
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'KeyQ' || e.code === 'KeyE') {
            updateLeanTargetFromKeys();
        }
        if (e.code === 'Space') {
            e.preventDefault();
            jump();
        } else if (e.code === 'KeyJ' && !e.repeat) {
            e.preventDefault();
            toggleSelfDamagePanel();
        } else if (e.code === 'KeyF' && !e.repeat) {
            e.preventDefault();
            handleFocusedInteraction();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        if (e.code === 'KeyQ' || e.code === 'KeyE') {
            updateLeanTargetFromKeys();
        }
    });

    // マウス
    document.addEventListener('mousedown', (e) => {
        if (isUIInteractionTarget(e.target)) {
            return;
        }
        
        if (!isPointerLocked) {
            renderer.domElement.requestPointerLock();
        }
        
        // 右クリックで構え（ADS）
        if (e.button === 2) {
            e.preventDefault();
            if (GAME_CONFIG.weapon && GAME_CONFIG.weapon !== '未装備') {
            isAiming = true;
                updateADSState();
            }
        }
        
        // 中クリックで近接攻撃
        if (e.button === 1) {
            e.preventDefault();
            performMeleeAttack();
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        // 右クリックを離したら構え解除（ADS解除）
        if (e.button === 2) {
            e.preventDefault();
            isAiming = false;
            updateADSState();
        }
    });
    
    // 右クリックのコンテキストメニューを完全に無効化（サイト全体）
    // ただし、インベントリアイテムの場合はスキップ（インベントリのコンテキストメニューを表示するため）
    document.addEventListener('contextmenu', (e) => {
        // インベントリアイテム（.itemクラス）またはインベントリオーバーレイ内の場合はスキップ
        const target = e.target;
        if (target && (
            target.closest('.item') || 
            target.closest('#inventoryOverlay') ||
            target.closest('#inventoryItemContextMenu') ||
            target.closest('#inventoryItemDetailModal')
        )) {
            return; // インベントリのコンテキストメニューを許可
        }
        e.preventDefault();
        e.stopPropagation();
    }, true); // capture phaseで処理して確実に無効化

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
    });

    document.addEventListener('mousemove', (e) => {
        if (isPointerLocked) {
            mouseMovement.x -= e.movementX * GAME_CONFIG.mouseSensitivity;
            mouseMovement.y -= e.movementY * GAME_CONFIG.mouseSensitivity;
            mouseMovement.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseMovement.y));
        }
    });
}

function isUIInteractionTarget(target) {
    if (!target) return false;
    return INTERACTIVE_UI_SELECTORS.some(selector => target.closest(selector));
}

// インベントリ関連の定数と変数
const INVENTORY_DEFAULT_BACKPACK_SIZE = { width: 5, height: 4 };
const INVENTORY_DEFAULT_RIG_SIZE = { width: 4, height: 2 };
const INVENTORY_RIG_SLOT_SIZES = {
    1: { width: 1, height: 2 },
    2: { width: 1, height: 2 },
    3: { width: 1, height: 3 },
    4: { width: 2, height: 2 }
};
const INVENTORY_GRID_CELL_SIZE = 45;
const INVENTORY_GRID_GAP = 2;
const INVENTORY_GRID_PADDING = 5;

let inventoryItems = [];
let inventoryDraggedItem = null;
let inventoryDragOffset = { x: 0, y: 0 };
let inventoryBackpackGrid = null;
let inventoryRigGrid = null;
let inventoryEquippedBackpack = null;
let inventoryEquippedRig = null;
let inventoryHighlightedMagazineElement = null;
let inventoryCurrentBackpackSize = { ...INVENTORY_DEFAULT_BACKPACK_SIZE };
let inventoryCurrentRigGridSize = { ...INVENTORY_DEFAULT_RIG_SIZE };
let inventoryRigUsesSlots = false;
let inventoryRigSlots = [];
let inventoryRigSlotOccupancy = new Map();
let inventoryLastMousePosition = null;
let inventoryContextMenuItem = null;
let inventoryOpen = false;
let inventoryIsCtrlPressed = false;

const INVENTORY_AMMO_DATA = {
    '5.56x45mm FMJ': {
        fullName: '5.56x45mm FMJ',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 57,
        penetration: 23,
        velocity: 957,
        special: 'なし',
        imageFile: '5.56x45mm FMJ.png'
    },
    '5.56x45mm HP': {
        fullName: '5.56x45mm HP',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 79,
        penetration: 7,
        velocity: 947,
        special: '軽度出血確率+15%,重度出血確率+15%',
        imageFile: '5.56x45mm HP.png'
    },
    '5.56x45mm M855 (M855)': {
        fullName: '5.56x45mm M855 (M855)',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 54,
        penetration: 32,
        velocity: 922,
        special: 'なし',
        imageFile: '5.56x45mm M855 (M855).png'
    },
    '5.56x45mm M855A1 (M855A1)': {
        fullName: '5.56x45mm M855A1 (M855A1)',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 49,
        penetration: 44,
        velocity: 945,
        special: '精度-5%,反動+5%',
        imageFile: '5.56x45mm M855A1 (M855A1).png'
    },
    '5.56x45mm M856 (M856)': {
        fullName: '5.56x45mm M856 (M856)',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 60,
        penetration: 18,
        velocity: 874,
        special: '精度-2%,反動-2%,曳光弾（赤）',
        imageFile: '5.56x45mm M856 (M856).png'
    },
    '5.56x45mm M856A1 (856AI)': {
        fullName: '5.56x45mm M856A1 (856AI)',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 52,
        penetration: 38,
        velocity: 940,
        special: '精度-4%,反動+4%,曳光弾（赤）',
        imageFile: '5.56x45mm M856A1 (856AI).png'
    },
    '5.56x45mm M995 (M995)': {
        fullName: '5.56x45mm M995 (M995)',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 42,
        penetration: 53,
        velocity: 1013,
        special: '精度-7%,反動+8%',
        imageFile: '5.56x45mm M995 (M995).png'
    },
    '5.56x45mm Mk255 Mod 0 (RRLP)': {
        fullName: '5.56x45mm Mk255 Mod 0 (RRLP)',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 72,
        penetration: 11,
        velocity: 936,
        special: 'なし',
        imageFile: '5.56x45mm Mk255 Mod 0 (RRLP).png'
    },
    '5.56x45mm Mk318 Mod 0 (SOFT)': {
        fullName: '5.56x45mm Mk318 Mod 0 (SOFT)',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 53,
        penetration: 33,
        velocity: 902,
        special: '精度+2%,反動+3%,軽度出血確率+15%,重度出血確率+10%',
        imageFile: '5.56x45mm Mk318 Mod 0 (SOFT).png'
    },
    '5.56x45mm SSA AP': {
        fullName: '5.56x45mm SSA AP',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 38,
        penetration: 57,
        velocity: 1013,
        special: '精度-9%,反動+6%',
        imageFile: '5.56x45mm SSA AP.png'
    },
    '5.56x45mm Warmageddon': {
        fullName: '5.56x45mm Warmageddon',
        caliber: '5.56x45mm',
        stackSize: 60,
        damage: 88,
        penetration: 3,
        velocity: 936,
        special: '精度+10%,反動+10%,軽度出血確率+20%,重度出血確率+20%',
        imageFile: '5.56x45mm Warmageddon.png'
    },
    '5.45x39mm BP': {
        fullName: '5.45x39mm BP',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 48,
        penetration: 45,
        velocity: 890,
        special: 'なし',
        imageFile: '5.45x39mm BP.png'
    },
    '5.45x39mm 7N40': {
        fullName: '5.45x39mm 7N40',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 55,
        penetration: 42,
        velocity: 915,
        special: '精度+50%,反動-10%,軽度出血確率+20%,重度出血確率+15%',
        imageFile: '5.45x39mm 7N40.png'
    },
    '5.45x39mm BS': {
        fullName: '5.45x39mm BS',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 45,
        penetration: 54,
        velocity: 830,
        special: '精度-4%,反動+10%',
        imageFile: '5.45x39mm BS.png'
    },
    '5.45x39mm BT': {
        fullName: '5.45x39mm BT',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 54,
        penetration: 37,
        velocity: 880,
        special: '曳光弾（赤）,精度-4%,反動+5%',
        imageFile: '5.45x39mm BT.png'
    },
    '5.45x39mm FMJ': {
        fullName: '5.45x39mm FMJ',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 55,
        penetration: 24,
        velocity: 884,
        special: 'なし',
        imageFile: '5.45x39mm FMJ.png'
    },
    '5.45x39mm HP': {
        fullName: '5.45x39mm HP',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 76,
        penetration: 9,
        velocity: 884,
        special: '精度+3%,反動-3%,軽度出血確率+15%,重度出血確率+15%',
        imageFile: '5.45x39mm HP.png'
    },
    '5.45x39mm PP': {
        fullName: '5.45x39mm PP',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 51,
        penetration: 34,
        velocity: 886,
        special: '精度-2%,反動+3%',
        imageFile: '5.45x39mm PP.png'
    },
    '5.45x39mm PPBS gs Igolnik': {
        fullName: '5.45x39mm PPBS gs Igolnik',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 37,
        penetration: 62,
        velocity: 905,
        special: '精度-5%,反動+15%',
        imageFile: '5.45x39mm PPBS.png'
    },
    '5.45x39mm PRS gs': {
        fullName: '5.45x39mm PRS gs',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 70,
        penetration: 13,
        velocity: 866,
        special: '反動-5%',
        imageFile: '5.45x39mm PRS.png'
    },
    '5.45x39mm PS': {
        fullName: '5.45x39mm PS',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 56,
        penetration: 28,
        velocity: 890,
        special: 'なし',
        imageFile: '5.45x39mm PS.png'
    },
    '5.45x39mm SP': {
        fullName: '5.45x39mm SP',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 67,
        penetration: 15,
        velocity: 873,
        special: '精度+5%,反動-5%,軽度出血確率+10%,重度出血確率+10%',
        imageFile: '5.45x39mm SP.png'
    },
    '5.45x39mm 7N40': {
        fullName: '5.45x39mm 7N40',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 55,
        penetration: 42,
        velocity: 915,
        special: '精度+50%,反動-10%,軽度出血確率+20%,重度出血確率+15%',
        imageFile: '5.45x39mm 7N40.png'
    },
    '5.45x39mm T gs': {
        fullName: '5.45x39mm T gs',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 59,
        penetration: 20,
        velocity: 883,
        special: '精度-3%,曳光弾（赤）',
        imageFile: '5.45x39mm T gs.png'
    },
    '5.45x39mm US gs': {
        fullName: '5.45x39mm US gs',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 65,
        penetration: 17,
        velocity: 303,
        special: '亜音速,反動-15%',
        imageFile: '5.45x39mm US gs.png'
    },
    '5.45x39mm 7N40': {
        fullName: '5.45x39mm 7N40',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 55,
        penetration: 42,
        velocity: 915,
        special: '精度+50%,反動-10%,軽度出血確率+20%,重度出血確率+15%'
    },
    '5.45x39mm BS': {
        fullName: '5.45x39mm BS',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 45,
        penetration: 54,
        velocity: 830,
        special: '精度-4%,反動+10%'
    },
    '5.45x39mm BT': {
        fullName: '5.45x39mm BT',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 54,
        penetration: 37,
        velocity: 880,
        special: '曳光弾（赤）,精度-4%,反動+5%'
    },
    '5.45x39mm FMJ': {
        fullName: '5.45x39mm FMJ',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 55,
        penetration: 24,
        velocity: 884,
        special: 'なし'
    },
    '5.45x39mm HP': {
        fullName: '5.45x39mm HP',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 76,
        penetration: 9,
        velocity: 884,
        special: '精度+3%,反動-3%,軽度出血確率+15%,重度出血確率+15%'
    },
    '5.45x39mm PP': {
        fullName: '5.45x39mm PP',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 51,
        penetration: 34,
        velocity: 886,
        special: '精度-2%,反動+3%'
    },
    '5.45x39mm PPBS gs Igolnik': {
        fullName: '5.45x39mm PPBS gs Igolnik',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 37,
        penetration: 62,
        velocity: 905,
        special: '精度-5%,反動+15%'
    },
    '5.45x39mm PRS gs': {
        fullName: '5.45x39mm PRS gs',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 70,
        penetration: 13,
        velocity: 866,
        special: '反動-5%'
    },
    '5.45x39mm PS': {
        fullName: '5.45x39mm PS',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 56,
        penetration: 28,
        velocity: 890,
        special: 'なし'
    },
    '5.45x39mm SP': {
        fullName: '5.45x39mm SP',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 67,
        penetration: 15,
        velocity: 873,
        special: '精度+5%,反動-5%,軽度出血確率+10%,重度出血確率+10%'
    },
    '5.45x39mm T gs': {
        fullName: '5.45x39mm T gs',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 59,
        penetration: 20,
        velocity: 883,
        special: '精度-3%,曳光弾（赤）'
    },
    '5.45x39mm US gs': {
        fullName: '5.45x39mm US gs',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 65,
        penetration: 17,
        velocity: 303,
        special: '亜音速,反動-15%'
    },
    '12.7x55mm PS12': {
        fullName: '12.7x55mm PS12',
        caliber: '12.7x55mm',
        stackSize: 60,
        damage: 115,
        penetration: 28,
        velocity: 300,
        special: '亜音速,精度+10%,軽度出血確率+30%,重度出血確率+20%',
        imageFile: '12.7x55mm PS12.png'
    },
    '12.7x55mm PS12A': {
        fullName: '12.7x55mm PS12A',
        caliber: '12.7x55mm',
        stackSize: 60,
        damage: 165,
        penetration: 10,
        velocity: 870,
        special: '亜音速,精度-15%,反動-12%,軽度出血確率35%,重度出血確率+30%',
        imageFile: '12.7x55mm PS12A.png'
    },
    '12.7x55mm PS12B': {
        fullName: '12.7x55mm PS12B',
        caliber: '12.7x55mm',
        stackSize: 60,
        damage: 102,
        penetration: 46,
        velocity: 570,
        special: '亜音速',
        imageFile: '12.7x55mm PS12B.png'
    },
    '9x39mm FMJ': {
        fullName: '9x39mm FMJ',
        caliber: '9x39mm',
        stackSize: 60,
        damage: 75,
        penetration: 17,
        velocity: 330,
        special: '亜音速',
        imageFile: '9x39mm FMJ.png'
    },
    '9x39mm BP gs': {
        fullName: '9x39mm BP gs',
        caliber: '9x39mm',
        stackSize: 60,
        damage: 58,
        penetration: 54,
        velocity: 295,
        special: '精度+10%,反動+15%,亜音速',
        imageFile: '9x39mm BP gs.png'
    },
    '9x39mm PAB-9 gs': {
        fullName: '9x39mm PAB-9 gs',
        caliber: '9x39mm',
        stackSize: 60,
        damage: 62,
        penetration: 43,
        velocity: 320,
        special: '精度-15%,反動+10%,軽度出血確率+10%,重度出血確率+12%,亜音速',
        imageFile: '9x39mm PAB-9 gs.png'
    },
    '9x39mm SP-5 gs': {
        fullName: '9x39mm SP-5 gs',
        caliber: '9x39mm',
        stackSize: 60,
        damage: 71,
        penetration: 28,
        velocity: 290,
        special: '重度出血確率+10%,亜音速',
        imageFile: '9x39mm SP-5 gs.png'
    },
    '9x39mm SP-6 gs': {
        fullName: '9x39mm SP-6 gs',
        caliber: '9x39mm',
        stackSize: 60,
        damage: 60,
        penetration: 48,
        velocity: 305,
        special: '反動+5%,軽度出血確率+10%,重度出血確率+10%,亜音速',
        imageFile: '9x39mm SP-6 gs.png'
    },
    '9x39mm SPP gs': {
        fullName: '9x39mm SPP gs',
        caliber: '9x39mm',
        stackSize: 60,
        damage: 68,
        penetration: 35,
        velocity: 310,
        special: '精度+10%,反動+7%,軽度出血確率+10%,重度出血確率+20%,亜音速',
        imageFile: '9x39mm SPP gs.png'
    },
    '7.62x51mm BCP FMJ': {
        fullName: '7.62x51mm BCP FMJ',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 83,
        penetration: 37,
        velocity: 800,
        special: 'なし',
        imageFile: '7.62x51mm BCP FMJ.png'
    },
    '7.62x51mm M61': {
        fullName: '7.62x51mm M61',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 75,
        penetration: 55,
        velocity: 838,
        special: 'なし',
        imageFile: '7.62x51mm M61.png'
    },
    '7.62x51mm M62 Tracer': {
        fullName: '7.62x51mm M62 Tracer',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 82,
        penetration: 42,
        velocity: 838,
        special: '曳光弾（緑）',
        imageFile: '7.62x51mm M62 Tracer.png'
    },
    '7.62x51mm M80': {
        fullName: '7.62x51mm M80',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 80,
        penetration: 43,
        velocity: 838,
        special: 'なし',
        imageFile: '7.62x51mm M80.png'
    },
    '7.62x51mm M80A1': {
        fullName: '7.62x51mm M80A1',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 73,
        penetration: 60,
        velocity: 899,
        special: 'なし',
        imageFile: '7.62x51mm M80A1.png'
    },
    '7.62x51mm M993': {
        fullName: '7.62x51mm M993',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 70,
        penetration: 65,
        velocity: 930,
        special: 'なし',
        imageFile: '7.62x51mm M993.png'
    },
    '7.62x51mm TCW SP': {
        fullName: '7.62x51mm TCW SP',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 85,
        penetration: 30,
        velocity: 771,
        special: 'なし',
        imageFile: '7.62x51mm TCW SP.png'
    },
    '7.62x51mm Ultra Noiser': {
        fullName: '7.62x51mm Ultra Noiser',
        caliber: '7.62x51mm',
        stackSize: 60,
        damage: 105,
        penetration: 15,
        velocity: 823,
        special: 'なし',
        imageFile: '7.62x51mm Ultra Noiser.png'
    },
    '.300 blackout AP': {
        fullName: '.300 blackout AP',
        caliber: '.300 blackout',
        stackSize: 60,
        damage: 51,
        penetration: 48,
        velocity: 635,
        special: 'なし',
        imageFile: '.300 blackout AP.png'
    },
    '.300 blackout BCP FMJ': {
        fullName: '.300 blackout BCP FMJ',
        caliber: '.300 blackout',
        stackSize: 60,
        damage: 60,
        penetration: 30,
        velocity: 605,
        special: 'なし',
        imageFile: '.300 blackout BCP FMJ.png'
    },
    '.300 blackout CBJ': {
        fullName: '.300 blackout CBJ',
        caliber: '.300 blackout',
        stackSize: 60,
        damage: 58,
        penetration: 43,
        velocity: 725,
        special: 'なし',
        imageFile: '.300 blackout CBJ.png'
    },
    '.300 blackout M62 Tracer': {
        fullName: '.300 blackout M62 Tracer',
        caliber: '.300 blackout',
        stackSize: 60,
        damage: 54,
        penetration: 36,
        velocity: 442,
        special: '曳光弾（赤）',
        imageFile: '.300 blackout M62 Tracer.png'
    },
    '.300 blackout V-Max': {
        fullName: '.300 blackout V-Max',
        caliber: '.300 blackout',
        stackSize: 60,
        damage: 72,
        penetration: 20,
        velocity: 723,
        special: 'なし',
        imageFile: '.300 blackout V-Max.png'
    },
    '.300 blackout Whisper': {
        fullName: '.300 blackout Whisper',
        caliber: '.300 blackout',
        stackSize: 60,
        damage: 90,
        penetration: 14,
        velocity: 853,
        special: 'なし',
        imageFile: '.300 blackout Whisper.png'
    },
    '7.62x39mm BP gzh': {
        fullName: '7.62x39mm BP gzh',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 58,
        penetration: 47,
        velocity: 730,
        special: 'なし',
        imageFile: '7.62x39mm BP gzh.png'
    },
    '7.62x39mm FMJ': {
        fullName: '7.62x39mm FMJ',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 63,
        penetration: 26,
        velocity: 775,
        special: 'なし',
        imageFile: '7.62x39mm FMJ.png'
    },
    '7.62x39mm HP': {
        fullName: '7.62x39mm HP',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 80,
        penetration: 15,
        velocity: 754,
        special: 'なし',
        imageFile: '7.62x39mm HP.png'
    },
    '7.62x39mm MAI AP': {
        fullName: '7.62x39mm MAI AP',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 53,
        penetration: 58,
        velocity: 875,
        special: 'なし',
        imageFile: '7.62x39mm MAI AP.png'
    },
    '7.62x39mm PP gzh': {
        fullName: '7.62x39mm PP gzh',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 59,
        penetration: 41,
        velocity: 732,
        special: 'なし',
        imageFile: '7.62x39mm PP gzh.png'
    },
    '7.62x39mm PS gzh': {
        fullName: '7.62x39mm PS gzh',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 61,
        penetration: 35,
        velocity: 717,
        special: 'なし',
        imageFile: '7.62x39mm PS gzh.png'
    },
    '7.62x39mm SP': {
        fullName: '7.62x39mm SP',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 68,
        penetration: 20,
        velocity: 772,
        special: 'なし',
        imageFile: '7.62x39mm SP.png'
    },
    '7.62x39mm T-45M1 gzh': {
        fullName: '7.62x39mm T-45M1 gzh',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 65,
        penetration: 30,
        velocity: 720,
        special: '曳光弾（赤）',
        imageFile: '7.62x39mm T-45M1 gzh.png'
    },
    '7.62x39mm US gzh': {
        fullName: '7.62x39mm US gzh',
        caliber: '7.62x39mm',
        stackSize: 60,
        damage: 56,
        penetration: 29,
        velocity: 301,
        special: '亜音速',
        imageFile: '7.62x39mm US gzh.png'
    },
    '6.8x51mm SIG FMJ': {
        fullName: '6.8x51mm SIG FMJ',
        caliber: '6.8x51mm',
        stackSize: 60,
        damage: 80,
        penetration: 36,
        velocity: 899,
        special: 'なし',
        imageFile: '6.8x51mm SIG FMJ.png'
    },
    '6.8x51mm SIG Hybrid': {
        fullName: '6.8x51mm SIG Hybrid',
        caliber: '6.8x51mm',
        stackSize: 60,
        damage: 72,
        penetration: 47,
        velocity: 914,
        special: 'なし',
        imageFile: '6.8x51mm SIG Hybrid.png'
    }
};

const INVENTORY_MAGAZINE_DATA = {
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

const INVENTORY_BACKPACK_DATA = {
    '6SH118': { contentSize: { width: 9, height: 5 }, stashSize: { width: 6, height: 7 }, imageFile: '6SH11B.png' },
    'Paratus': { contentSize: { width: 7, height: 5 }, stashSize: { width: 5, height: 7 }, imageFile: 'paratus.png' },
    'Beta2': { contentSize: { width: 6, height: 5 }, stashSize: { width: 5, height: 5 }, imageFile: 'Beta2.png' },
    'Takedown': { contentSize: { width: 8, height: 3 }, stashSize: { width: 3, height: 7 }, imageFile: 'Takedown.png' },
    'MBSS': { contentSize: { width: 4, height: 4 }, stashSize: { width: 4, height: 4 }, imageFile: 'MBSS.png' },
    'T20': { contentSize: { width: 5, height: 5 }, stashSize: { width: 5, height: 5 }, imageFile: 'T20.png' },
    'Daypack': { contentSize: { width: 5, height: 4 }, stashSize: { width: 4, height: 5 }, imageFile: 'Day pack.png' },
    'pilgrim': { contentSize: { width: 7, height: 5 }, stashSize: { width: 5, height: 7 }, imageFile: 'Pilgrim.png' },
    'Pilgrim': { contentSize: { width: 7, height: 5 }, stashSize: { width: 5, height: 7 }, imageFile: 'Pilgrim.png' },
    'ScavBP': { contentSize: { width: 5, height: 4 }, stashSize: { width: 4, height: 5 }, imageFile: 'ScavBP.png' },
    'VKBO': { contentSize: { width: 2, height: 4 }, stashSize: { width: 3, height: 4 }, imageFile: 'VKBO.png' }
};

const INVENTORY_RIG_DATA = {
    'IDEA Rig': {
        stashSize: { width: 3, height: 2 },
        slots: [
            { type: 2, count: 4 },
            { type: 3, count: 0 },
            { type: 4, count: 0 }
        ],
        imageFile: 'IDEA Rig.png'
    },
    'Alpha': {
        stashSize: { width: 4, height: 4 },
        slots: [
            { type: 2, count: 2 },
            { type: 3, count: 4 },
            { type: 4, count: 1 }
        ],
        imageFile: 'Alpha.png'
    },
    'khamelion': {
        stashSize: { width: 4, height: 3 },
        slots: [
            { type: 1, count: 4 },
            { type: 2, count: 4 }
        ],
        imageFile: 'Khamelion.png'
    },
    'Khamelion': {
        stashSize: { width: 4, height: 3 },
        slots: [
            { type: 1, count: 4 },
            { type: 2, count: 4 }
        ],
        imageFile: 'Khamelion.png'
    },
    'Azimut': {
        stashSize: { width: 4, height: 3 },
        slots: [
            { type: 2, count: 8 }
        ],
        imageFile: 'Azimut.png'
    }
};

// プレイヤーの移動とジャンプ
let isOnGround = true;
let verticalVelocity = 0;
let isAiming = false; // 構え状態
const ADS_ZOOM_MULTIPLIER = 1.10; // ADSズーム倍率
const ADS_MOUSE_SENSITIVITY_MULTIPLIER = 0.5; // ADS中のマウス感度倍率（50%）
const DEFAULT_CAMERA_FOV = 75; // デフォルトのカメラFOV

// 照準器設定
const IRONSIGHT_SETTINGS_KEY = 'ironsightSettings';
const IRONSIGHT_SETTINGS_DEFAULTS = {
    positionX: 50.639998, // 位置X（%）
    positionY: 96, // 位置Y（%）
    size: 1500 // サイズ（px）
};

// 照準器設定の読み込み
function loadIronsightSettings() {
    try {
        const raw = localStorage.getItem(IRONSIGHT_SETTINGS_KEY);
        if (!raw) return { ...IRONSIGHT_SETTINGS_DEFAULTS };
        const parsed = JSON.parse(raw);
        return { ...IRONSIGHT_SETTINGS_DEFAULTS, ...parsed };
    } catch (error) {
        console.warn('照準器設定の読み込みに失敗しました:', error);
        return { ...IRONSIGHT_SETTINGS_DEFAULTS };
    }
}

// 照準器設定の保存
function saveIronsightSettings(settings) {
    try {
        localStorage.setItem(IRONSIGHT_SETTINGS_KEY, JSON.stringify(settings));
        applyIronsightSettings(settings);
    } catch (error) {
        console.error('照準器設定の保存に失敗しました:', error);
    }
}

// 照準器設定の適用
function applyIronsightSettings(settings) {
    const ironsightElement = document.getElementById('ironsight');
    const ironsightImage = document.getElementById('ironsightImage');
    
    if (ironsightElement && ironsightImage) {
        ironsightElement.style.left = `${settings.positionX}%`;
        ironsightElement.style.top = `${settings.positionY}%`;
        ironsightElement.style.transform = 'translate(-50%, -50%)';
        ironsightImage.style.maxWidth = `${settings.size}px`;
        ironsightImage.style.maxHeight = `${settings.size}px`;
    }
}
let isRunning = false; // 走っている状態
let isDashing = false; // ダッシュ状態
let playerStance = 'stand'; // プレイヤーの姿勢: 'stand', 'crouch', 'prone'
let lastStaminaUpdate = Date.now();
let sounds = []; // 音の配列 [{ position: Vector3, type: string, distance: number, timestamp: number }]
let lastMoveSoundTime = 0; // 最後に移動音を生成した時刻
let lastEnergyHydrationUpdate = Date.now();

// 音の距離定義
const SOUND_DISTANCES = {
    walk: 20,
    run: 45,
    jump: 60,
    crouch: 8,
    prone: 0,
    'M4A1': 600,
    'AS VAL': 30,
    'Ash-12': 900,
    'AK-74M': 750,
    medical: 60
};

// 音を生成する関数
function createSound(type, distance) {
    if (!camera) return;
    const sound = {
        position: camera.position.clone(),
        type: type,
        distance: distance,
        timestamp: Date.now()
    };
    sounds.push(sound);
    
    // 古い音を削除（5秒以上経過した音）
    const now = Date.now();
    sounds = sounds.filter(s => now - s.timestamp < 5000);
}
let lastBleedingUpdate = Date.now();
let lastEnergyDamageUpdate = Date.now();
let lastHydrationDeathCheck = Date.now();

function jump() {
    // 医薬品使用中はジャンプできない
    if (GAME_CONFIG.usingMedicalItem) {
        return;
    }
    if (GAME_CONFIG.lowerBodyStamina >= 15) {
        // 下半身スタミナを消費
        GAME_CONFIG.lowerBodyStamina = Math.max(0, GAME_CONFIG.lowerBodyStamina - 15);
        verticalVelocity = GAME_CONFIG.jumpForce;
        isOnGround = false;
        // ジャンプの音を生成
        createSound('jump', SOUND_DISTANCES.jump);
        updateStaminaUI();
    }
}

// プレイヤー移動
function updatePlayerMovement() {
    // 医薬品使用中は移動できない（特に骨折治療中）
    if (GAME_CONFIG.usingMedicalItem) {
        return;
    }
    
    // 骨折治療中（Splint使用中）は移動できない
    // これは医薬品使用中フラグで既に制御されている
    
    const direction = new THREE.Vector3();
    
    // 移動方向を取得
    if (keys['KeyW']) {
        direction.z -= 1;
    }
    if (keys['KeyS']) {
        direction.z += 1;
    }
    if (keys['KeyA']) {
        direction.x -= 1;
    }
    if (keys['KeyD']) {
        direction.x += 1;
    }
    
    // 方向を正規化
    direction.normalize();
    
    // カメラの向きに基づいて移動方向を回転
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const angle = Math.atan2(cameraDirection.x, cameraDirection.z);
    
    const rotatedDirection = new THREE.Vector3(
        direction.x * Math.cos(angle) - direction.z * Math.sin(angle),
        0,
        direction.x * Math.sin(angle) + direction.z * Math.cos(angle)
    );
    
    // 移動速度を計算
    let speed = GAME_CONFIG.walkSpeed;
    if (keys['ShiftLeft'] || keys['ShiftRight']) {
        if (canPlayerRun()) {
            speed = GAME_CONFIG.runSpeed;
            isRunning = true;
        }
    } else {
        isRunning = false;
    }
    
    // プレイヤーの位置を更新
    playerVelocity.x = rotatedDirection.x * speed;
    playerVelocity.z = rotatedDirection.z * speed;
    
    // 重力とジャンプの処理
    if (!isOnGround) {
        verticalVelocity -= GAME_CONFIG.gravity * (GAME_CONFIG.deltaTime / 1000);
    }
    
    playerVelocity.y = verticalVelocity;
    
    // プレイヤーの位置を更新
    const newPosition = player.position.clone();
    newPosition.add(playerVelocity.clone().multiplyScalar(GAME_CONFIG.deltaTime / 1000));
    
    // 衝突判定
    const newCollision = new CollisionBox(
        newPosition.x,
        newPosition.y,
        newPosition.z,
        playerCollision.width,
        playerCollision.height,
        playerCollision.depth
    );
    
    // 地面との衝突判定
    if (newCollision.y - newCollision.height / 2 <= 0) {
        newPosition.y = newCollision.height / 2;
        verticalVelocity = 0;
        isOnGround = true;
    } else {
        isOnGround = false;
    }
    
    // 障害物との衝突判定
    const nearbyObstacles = getNearbyObstacles(newCollision, 2);
    let canMove = true;
    for (const obstacle of nearbyObstacles) {
        if (newCollision.intersects(obstacle.collision)) {
            canMove = false;
            break;
        }
    }
    
    if (canMove) {
        player.position.copy(newPosition);
    } else {
        // 衝突した場合はXZ方向のみ移動を試みる
        const xzPosition = player.position.clone();
        xzPosition.x = newPosition.x;
        xzPosition.z = newPosition.z;
        xzPosition.y = player.position.y;
        
        const xzCollision = new CollisionBox(
            xzPosition.x,
            xzPosition.y,
            xzPosition.z,
            playerCollision.width,
            playerCollision.height,
            playerCollision.depth
        );
        
        const nearbyXZObstacles = getNearbyObstacles(xzCollision, 2);
        let canMoveXZ = true;
        for (const obstacle of nearbyXZObstacles) {
            if (xzCollision.intersects(obstacle.collision)) {
                canMoveXZ = false;
                break;
            }
        }
        
        if (canMoveXZ) {
            player.position.x = newPosition.x;
            player.position.z = newPosition.z;
        }
    }
    
    // カメラの位置を更新
    camera.position.copy(player.position);
    camera.position.y += 1.6; // 目の高さ
    
    // カメラの回転を適用
    camera.rotation.order = 'YXZ';
    camera.rotation.y = mouseMovement.x;
    camera.rotation.x = mouseMovement.y;
}

// 近接攻撃
function performMeleeAttack() {
    if (GAME_CONFIG.upperBodyStamina >= 25 && !GAME_CONFIG.usingMedicalItem) {
        // 上半身スタミナを消費
        GAME_CONFIG.upperBodyStamina = Math.max(0, GAME_CONFIG.upperBodyStamina - 25);
        updateStaminaUI();
        
        // 近接攻撃の処理（敵へのダメージなど）
        // TODO: 近接攻撃の実装
    }
}

// 走れるかチェック
function canPlayerRun() {
    // 両足が壊死していないか、鎮痛剤が効いているか
    const leftLegBlacked = GAME_CONFIG.bodyParts.leftLeg.blacked;
    const rightLegBlacked = GAME_CONFIG.bodyParts.rightLeg.blacked;
    const hasPainkillers = GAME_CONFIG.statusEffects.some(effect => effect.type === 'painkiller');
    
    return !(leftLegBlacked && rightLegBlacked) || hasPainkillers;
}

// スタミナ更新
function updateStamina() {
    const now = Date.now();
    const deltaTime = now - lastStaminaUpdate;
    
    if (deltaTime < 100) return; // 100ms未満の場合は更新しない
    lastStaminaUpdate = now;
    
    // スタミナ回復
    if (!isRunning && !isDashing && !isAiming) {
        // 上半身スタミナ回復
        if (GAME_CONFIG.upperBodyStamina < 100) {
            GAME_CONFIG.upperBodyStamina = Math.min(100, GAME_CONFIG.upperBodyStamina + GAME_CONFIG.staminaRegenRate * (deltaTime / 1000));
        }
        
        // 下半身スタミナ回復
        if (GAME_CONFIG.lowerBodyStamina < 100) {
            GAME_CONFIG.lowerBodyStamina = Math.min(100, GAME_CONFIG.lowerBodyStamina + GAME_CONFIG.staminaRegenRate * (deltaTime / 1000));
        }
    }
    
    // スタミナ消費
    if (isRunning || isDashing) {
        const consumptionRate = isDashing ? GAME_CONFIG.dashStaminaConsumption : GAME_CONFIG.runStaminaConsumption;
        GAME_CONFIG.lowerBodyStamina = Math.max(0, GAME_CONFIG.lowerBodyStamina - consumptionRate * (deltaTime / 1000));
    }
    
    if (isAiming) {
        GAME_CONFIG.upperBodyStamina = Math.max(0, GAME_CONFIG.upperBodyStamina - GAME_CONFIG.aimStaminaConsumption * (deltaTime / 1000));
    }
    
    updateStaminaUI();
}

// イベントリスナー設定
function setupEventListeners() {
    // キーボード
    document.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (e.code === 'KeyQ' || e.code === 'KeyE') {
            updateLeanTargetFromKeys();
        }
        if (e.code === 'Space') {
            e.preventDefault();
            jump();
        } else if (e.code === 'KeyJ' && !e.repeat) {
            e.preventDefault();
            toggleSelfDamagePanel();
        } else if (e.code === 'KeyF' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            handleFocusedInteraction();
        } else if (e.code === 'KeyR' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            reloadWeapon();
        } else if (e.code === 'KeyB' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            toggleFireMode();
        } else if (e.code === 'Digit1' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            switchWeapon('primary');
        } else if (e.code === 'Digit2' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            switchWeapon('secondary');
        } else if (e.code === 'KeyC' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            toggleCrouch();
        } else if (e.code === 'KeyZ' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            toggleProne();
        } else if (e.code === 'KeyT' && !e.repeat && !inventoryOpen) {
            e.preventDefault();
            handleWeaponMaintenanceKey();
        }
    });

    document.addEventListener('keyup', (e) => {
        keys[e.code] = false;
        if (e.code === 'KeyQ' || e.code === 'KeyE') {
            updateLeanTargetFromKeys();
        }
    });

    // マウス
    document.addEventListener('mousedown', (e) => {
        // インベントリが開いている場合はゲーム操作を無効化
        if (inventoryOpen) {
            const els = getInventoryElements();
            if (els.overlay && !els.overlay.classList.contains('hidden')) {
                // インベントリオーバーレイ内の場合はゲーム操作を無効化
                if (els.overlay.contains(e.target)) {
                    return;
                }
            }
        }
        
        if (isUIInteractionTarget(e.target)) {
            return;
        }
        
        if (!isPointerLocked) {
            renderer.domElement.requestPointerLock();
        }
        
        // 左クリックで発射
        if (e.button === 0 && !inventoryOpen) {
            fireWeapon();
        }
        
        // 右クリックで構え（ADS）または医薬品使用キャンセル
        if (e.button === 2) {
            e.preventDefault();
            // 医薬品使用中の場合、キャンセル処理を優先
            if (GAME_CONFIG.usingMedicalItem && medicalUseState.active) {
                cancelMedicalUse();
                return;
            }
            if (GAME_CONFIG.weapon && GAME_CONFIG.weapon !== '未装備') {
            isAiming = true;
                updateADSState();
            }
        }
        
        // 中クリックで近接攻撃
        if (e.button === 1) {
            e.preventDefault();
            performMeleeAttack();
        }
    });
    
    document.addEventListener('mouseup', (e) => {
        // 左クリックを離したら発射停止
        if (e.button === 0 && !inventoryOpen) {
            isFiring = false;
        }
        
        // 右クリックを離したら構え解除（ADS解除）
        if (e.button === 2) {
            e.preventDefault();
            isAiming = false;
            updateADSState();
        }
    });
    
    // 右クリックのコンテキストメニューを完全に無効化（重複を避けるため、このイベントリスナーは削除済み）

    document.addEventListener('pointerlockchange', () => {
        isPointerLocked = document.pointerLockElement === renderer.domElement;
    });

    document.addEventListener('mousemove', (e) => {
        if (isPointerLocked) {
            mouseMovement.x -= e.movementX * GAME_CONFIG.mouseSensitivity;
            mouseMovement.y -= e.movementY * GAME_CONFIG.mouseSensitivity;
            mouseMovement.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseMovement.y));
        }
    });

    // ウィンドウリサイズ
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        applyRendererSizing();
    });
}

// 足の骨折治し中かどうかを判定
function isTreatingLegFracture() {
    if (!GAME_CONFIG.usingMedicalItem || !medicalUseState.active) {
        return false;
    }
    const medicalData = MEDICAL_DATA[medicalUseState.medicalName];
    if (!medicalData) return false;
    
    // 骨折を治す医薬品かどうか
    const cures = Array.isArray(medicalData.cures) ? medicalData.cures : [];
    if (!cures.includes('fracture')) {
        return false;
    }
    
    // 足に骨折があるかどうか
    const hasLegFracture = GAME_CONFIG.statusEffects.fracture.some(f => 
        f.part === 'leftLeg' || f.part === 'rightLeg'
    );
    
    return hasLegFracture;
}

// プレイヤー移動
function updatePlayerMovement() {
    const direction = new THREE.Vector3();
    
    // 移動方向を取得
    if (keys['KeyW']) {
        direction.z -= 1;
    }
    if (keys['KeyS']) {
        direction.z += 1;
    }
    if (keys['KeyA']) {
        direction.x -= 1;
    }
    if (keys['KeyD']) {
        direction.x += 1;
    }

    // 医薬品使用中の処理
    const isTreatingLeg = isTreatingLegFracture();
    if (GAME_CONFIG.usingMedicalItem) {
        // 足の骨折治し中は移動できない（視点操作のみ可能）
        if (isTreatingLeg) {
            // 移動はブロック、視点操作は可能（既に処理されている）
            direction.set(0, 0, 0);
        } else {
            // その他の医薬品使用中は移動速度を0.7倍にする
            // 移動は続行
        }
    }

    // カメラの向きに基づいて移動方向を計算
    const euler = new THREE.Euler(0, mouseMovement.x, 0, 'YXZ');
    
    // 走れるかチェック（足が壊死していないか、鎮痛剤が効いているか）
    const canRun = canPlayerRun();
    const isShiftPressed = keys['ShiftLeft'] || keys['ShiftRight'];
    const isMoving = direction.length() > 0;
    
    // 医薬品使用中はダッシュと走りを無効化
    if (GAME_CONFIG.usingMedicalItem) {
        isDashing = false;
        isRunning = false;
    } else {
        // 走りとダッシュの判定
        if (isMoving && canRun && isShiftPressed && GAME_CONFIG.lowerBodyStamina > 0) {
            // ダッシュ：スタミナが十分にある場合はダッシュ
            if (GAME_CONFIG.lowerBodyStamina >= 30) {
                isDashing = true;
                isRunning = false;
            } else {
                // スタミナが少ない場合は通常の走り
                isDashing = false;
                isRunning = true;
            }
        } else {
            isDashing = false;
            isRunning = false;
        }
    }

    // 正規化
    if (direction.length() > 0) {
        direction.normalize();
        
        // カメラの向きに合わせて回転
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(euler.y);
        direction.applyMatrix4(rotationMatrix);
        
        // 移動速度を決定
        let moveSpeed = GAME_CONFIG.moveSpeed;
        let soundType = null;
        let soundDistance = 0;
        
        // 姿勢による速度調整
        if (playerStance === 'crouch') {
            moveSpeed = GAME_CONFIG.moveSpeed * 0.5;
            soundType = 'crouch';
            soundDistance = SOUND_DISTANCES.crouch;
        } else if (playerStance === 'prone') {
            moveSpeed = GAME_CONFIG.moveSpeed * 0.1;
            soundType = 'prone';
            soundDistance = SOUND_DISTANCES.prone;
        }
        
        // しゃがみ・匍匐中は走りとダッシュを無効化
        if (playerStance === 'stand') {
            if (GAME_CONFIG.usingMedicalItem && !isTreatingLeg) {
                // 医薬品使用中（足の骨折治し以外）は移動速度を0.7倍
                moveSpeed = GAME_CONFIG.moveSpeed * 0.7;
                soundType = 'walk';
                soundDistance = SOUND_DISTANCES.walk;
            } else if (isDashing && GAME_CONFIG.lowerBodyStamina > 0) {
                // ダッシュ：通常の3倍の速度
                moveSpeed = GAME_CONFIG.moveSpeed * 3;
                soundType = 'run';
                soundDistance = SOUND_DISTANCES.run;
            } else if (isRunning && GAME_CONFIG.lowerBodyStamina > 0) {
                // 走り：通常の2倍の速度
                moveSpeed = GAME_CONFIG.moveSpeed * 2;
                soundType = 'run';
                soundDistance = SOUND_DISTANCES.run;
            } else {
                soundType = 'walk';
                soundDistance = SOUND_DISTANCES.walk;
            }
        }
        
        // 移動音を生成（0.5秒ごと）
        if (soundType && soundDistance > 0) {
            const now = Date.now();
            if (!lastMoveSoundTime || now - lastMoveSoundTime > 500) {
                createSound(soundType, soundDistance);
                lastMoveSoundTime = now;
            }
        }
        
        // 移動
        const moveVector = direction.multiplyScalar(moveSpeed);
        const newPosition = camera.position.clone().add(moveVector);
        
        // 当たり判定チェック
        let collisionBaseHeight = getTerrainHeight(newPosition.x, newPosition.z);
        if (isInsideMansionArea(newPosition.x, newPosition.z)) {
            collisionBaseHeight = playerFloorLevel === 1 ? MANSION_CONFIG.secondFloorHeight : 0;
        }
        playerCollision.update(new THREE.Vector3(
            newPosition.x,
            collisionBaseHeight + GAME_CONFIG.playerHeight / 2,
            newPosition.z
        ));
        
        const nearbyObstacles = getNearbyObstacles(playerCollision, 2);
        let canMove = true;
        for (let obstacle of nearbyObstacles) {
            if (playerCollision.intersects(obstacle.collision)) {
                canMove = false;
                break;
            }
        }
        
        if (canMove) {
            camera.position.x = newPosition.x;
            camera.position.z = newPosition.z;
        }
    }

    // 重力とジャンプ
    verticalVelocity += GAME_CONFIG.gravity;
    const stanceHeight = getCurrentEyeHeight();
    const desiredY = camera.position.y + verticalVelocity;
    const handledByMansion = applyMansionFloorHeight(stanceHeight, desiredY);
    if (!handledByMansion) {
        const terrainHeight = getTerrainHeight(camera.position.x, camera.position.z);
        const groundLevel = terrainHeight + stanceHeight;
        if (desiredY <= groundLevel) {
            camera.position.y = groundLevel;
            verticalVelocity = 0;
            isOnGround = true;
        } else if (isOnGround && desiredY > groundLevel) {
            camera.position.y = groundLevel;
        verticalVelocity = 0;
        isOnGround = true;
    } else {
            camera.position.y = desiredY;
        isOnGround = false;
        }
    }

    // カメラの回転
    // 反動を減衰させる
    recoilState.vertical *= recoilDecayRate;
    recoilState.horizontal *= recoilDecayRate;
    
    // 反動が非常に小さくなったら0にリセット
    if (Math.abs(recoilState.vertical) < 0.001) recoilState.vertical = 0;
    if (Math.abs(recoilState.horizontal) < 0.001) recoilState.horizontal = 0;
    
    // カメラの回転を更新（反動を含む）
    camera.rotation.order = 'YXZ';
    camera.rotation.y = mouseMovement.x + recoilState.horizontal;
    camera.rotation.x = mouseMovement.y + recoilState.vertical;
    
    applyLeanToCamera();
    
    // スタミナ更新
    updateStamina();
}

// しゃがみの切り替え
function toggleCrouch() {
    if (playerStance === 'crouch') {
        playerStance = 'stand';
    } else {
        playerStance = 'crouch';
        // 匍匐中からしゃがみに切り替える場合
        if (playerStance === 'prone') {
            playerStance = 'crouch';
        }
    }
}

// 匍匐の切り替え
function toggleProne() {
    if (playerStance === 'prone') {
        playerStance = 'stand';
    } else {
        playerStance = 'prone';
        // しゃがみ中から匍匐に切り替える場合
        if (playerStance === 'crouch') {
            playerStance = 'prone';
        }
    }
}

function getCurrentEyeHeight() {
    if (playerStance === 'crouch') {
        return GAME_CONFIG.playerHeight * 0.5;
    }
    if (playerStance === 'prone') {
        return GAME_CONFIG.playerHeight * 0.2;
    }
    return GAME_CONFIG.playerHeight;
}

// プレイヤーの姿勢に応じてカメラの高さを調整
// 近接攻撃
function performMeleeAttack() {
    if (GAME_CONFIG.upperBodyStamina >= 25 && !GAME_CONFIG.usingMedicalItem) {
        // 上半身スタミナを消費
        GAME_CONFIG.upperBodyStamina = Math.max(0, GAME_CONFIG.upperBodyStamina - 25);
        updateStaminaUI();
        
        // 近接攻撃の処理（敵へのダメージなど）
        // ここでは実装しないが、将来的に追加可能
        console.log('近接攻撃！');
    }
}

// 走れるかチェック
function canPlayerRun() {
    // 足が壊死しているかチェック
    const leftLegBlacked = GAME_CONFIG.statusEffects.blackedOut.includes('leftLeg');
    const rightLegBlacked = GAME_CONFIG.statusEffects.blackedOut.includes('rightLeg');
    const leftLegFractured = GAME_CONFIG.statusEffects.fracture.find(e => e.part === 'leftLeg');
    const rightLegFractured = GAME_CONFIG.statusEffects.fracture.find(e => e.part === 'rightLeg');
    
    // 両足が壊死または骨折している場合
    if ((leftLegBlacked || leftLegFractured) && (rightLegBlacked || rightLegFractured)) {
        // 鎮痛剤が効いている場合は走れる
        return GAME_CONFIG.painkillersActive;
    }
    
    return true;
}

// スタミナ更新
function updateStamina() {
    const now = Date.now();
    const deltaTime = (now - lastStaminaUpdate) / 1000; // 秒
    
    if (deltaTime < 0.1) return; // 更新頻度を制限
    
    lastStaminaUpdate = now;
    
    // 構え時の上半身スタミナ消費
    if (isAiming) {
        const consumptionRate = 2; // -2/s
        // 腕が壊死している場合は1.25倍
        const leftArmBlacked = GAME_CONFIG.statusEffects.blackedOut.includes('leftArm');
        const rightArmBlacked = GAME_CONFIG.statusEffects.blackedOut.includes('rightArm');
        const multiplier = (leftArmBlacked || rightArmBlacked) ? 1.25 : 1.0;
        
        GAME_CONFIG.upperBodyStamina = Math.max(0, GAME_CONFIG.upperBodyStamina - consumptionRate * multiplier * deltaTime);
    }
    
    // ダッシュ時の下半身スタミナ消費
    if (isDashing) {
        const consumptionRate = 2; // -2/s（ダッシュは消費が大きい）
        GAME_CONFIG.lowerBodyStamina = Math.max(0, GAME_CONFIG.lowerBodyStamina - consumptionRate * deltaTime);
        
        // スタミナが30未満になったらダッシュから走りに切り替え
        if (GAME_CONFIG.lowerBodyStamina < 30) {
            isDashing = false;
            isRunning = true;
        }
    }
    
    // 走る時の下半身スタミナ消費
    if (isRunning && !isDashing) {
        const consumptionRate = 1; // -1/s
        GAME_CONFIG.lowerBodyStamina = Math.max(0, GAME_CONFIG.lowerBodyStamina - consumptionRate * deltaTime);
        
        // スタミナが0になったら走れなくなる
        if (GAME_CONFIG.lowerBodyStamina <= 0) {
            isRunning = false;
        }
    }
    
    // スタミナ回復（エネルギーが0の場合は回復速度が低下）
    const staminaRegenRate = GAME_CONFIG.energy <= 0 ? 0.5 : 1.0; // エネルギー0の場合は半分の速度
    
    if (!isAiming && GAME_CONFIG.upperBodyStamina < GAME_CONFIG.maxUpperBodyStamina) {
        GAME_CONFIG.upperBodyStamina = Math.min(GAME_CONFIG.maxUpperBodyStamina, 
            GAME_CONFIG.upperBodyStamina + staminaRegenRate * deltaTime);
    }
    
    if (!isRunning && !isDashing && GAME_CONFIG.lowerBodyStamina < GAME_CONFIG.maxLowerBodyStamina) {
        GAME_CONFIG.lowerBodyStamina = Math.min(GAME_CONFIG.maxLowerBodyStamina, 
            GAME_CONFIG.lowerBodyStamina + staminaRegenRate * deltaTime);
    }
    
    updateStaminaUI();
}

// ゾンビの更新
function updateZombies() {
    if (!camera) return;
    
    const now = Date.now();
    const playerPos = camera.position; // cloneを削減
    const drawConfig = getDrawDistanceConfig();
    
    // 通常ゾンビとボスゾンビを統合して処理
    const allZombies = [...zombies];
    if (bossZombie && !bossZombie.isDead) {
        allZombies.push(bossZombie);
    }
    
    allZombies.forEach((zombie, index) => {
        // ゾンビが死んでいる場合はスキップ
        if (zombie.isDead) return;
        const zombieHeight = zombie.height || (GAME_CONFIG.playerHeight + 0.5);
        
        // ゾンビが死んでいるかチェック（頭または胸部が壊死）
        if (zombie.blackedOut.includes('head') || zombie.blackedOut.includes('chest')) {
            if (!zombie.isDead) {
                zombie.isDead = true;
                // ゾンビを倒す（色を変えるなど）
                zombie.group.children.forEach(child => {
                    if (child.material) {
                        child.material.color.setHex(0x666666); // グレーに
                    }
                });
                // アイテムをドロップ
                dropLootFromZombie(zombie);
            }
            return;
        }
        
        // パフォーマンス最適化：距離が遠いゾンビは更新頻度を下げる
        const zombiePos = zombie.group.position;
        const distanceToPlayer = playerPos.distanceTo(zombiePos);
        const UPDATE_INTERVAL_NEAR = 16; // 近距離：毎フレーム（約60fps）
        const UPDATE_INTERVAL_MID = 50; // 中距離：50msごと
        const UPDATE_INTERVAL_FAR = 200; // 遠距離：200msごと
        
        let updateInterval = UPDATE_INTERVAL_NEAR;
        if (distanceToPlayer > drawConfig.far) {
            updateInterval = UPDATE_INTERVAL_FAR;
        } else if (distanceToPlayer > drawConfig.mid) {
            updateInterval = UPDATE_INTERVAL_MID;
        }
        
        // 更新間隔をチェック
        if (now - zombie.lastUpdate < updateInterval && !zombie.hasFoundPlayer) {
            return; // スキップ
        }
        zombie.lastUpdate = now;
        
        // 移動速度を更新（両足が壊死している場合はさらに半分）
        if (zombie.blackedOut.includes('leftLeg') && zombie.blackedOut.includes('rightLeg')) {
            zombie.speed = zombie.baseSpeed * 0.5;
        } else {
            zombie.speed = zombie.baseSpeed;
        }
        
        // 前方3m以内にプレイヤーがいるかチェック（距離が近い場合のみ）
        let isInFront = false;
        let isWithin3m = false;
        if (distanceToPlayer <= 3) {
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(zombie.group.quaternion);
            const toPlayer = new THREE.Vector3().subVectors(playerPos, zombiePos);
            toPlayer.y = 0;
            toPlayer.normalize();
            const dot = forward.dot(toPlayer);
            isInFront = dot > 0.5; // 約60度以内
            isWithin3m = true;
        }
        
        let shouldChase = false;
        let targetPos = null;
        const CHASE_DISTANCE = drawConfig.chase; // 追跡を続ける最大距離（m）
        const DISENGAGE_DISTANCE = drawConfig.disengage;
        
        // 一度プレイヤーを見つけた場合、700m離れるまで追跡を続ける
        if (zombie.hasFoundPlayer) {
            if (distanceToPlayer <= CHASE_DISTANCE) {
                shouldChase = true;
                targetPos = playerPos;
                zombie.targetPosition = playerPos.clone();
            } else {
                // 一定距離以上離れたら追跡を停止
                if (distanceToPlayer > DISENGAGE_DISTANCE) {
                    zombie.hasFoundPlayer = false;
                    zombie.targetPosition = null;
                }
            }
        } else {
            // プレイヤーを見つけていない場合、音や視覚で探す
            // 前方3m以内にプレイヤーがいる場合は音関係なく追いかける
            if (isInFront && isWithin3m) {
                shouldChase = true;
                targetPos = playerPos;
                zombie.targetPosition = playerPos.clone();
                zombie.hasFoundPlayer = true; // プレイヤーを見つけた
            } else {
                // 音をチェック（0.2秒ごと、パフォーマンス最適化）
                if (now - zombie.lastSoundCheck > 200) {
                    zombie.lastSoundCheck = now;
                    
                    let nearestSound = null;
                    let nearestSoundDistance = Infinity;
                    
                    // 音の配列を逆順にチェック（新しい音を優先）
                    for (let i = sounds.length - 1; i >= 0; i--) {
                        const sound = sounds[i];
                        const soundDistance = zombiePos.distanceTo(sound.position);
                        // 音が聞こえる範囲内にあるかチェック
                        if (soundDistance <= sound.distance) {
                            // 最も近い音を記録
                            if (soundDistance < nearestSoundDistance) {
                                nearestSoundDistance = soundDistance;
                                nearestSound = sound;
                            }
                        }
                    }
                    
                    // 音が聞こえた場合
                    if (nearestSound) {
                        shouldChase = true;
                        targetPos = nearestSound.position;
                        zombie.targetPosition = targetPos.clone();
                        zombie.hasFoundPlayer = true; // プレイヤーを見つけた
                    }
                } else if (zombie.targetPosition) {
                    // 音チェックの間隔中でも、既に目標がある場合は追跡を続ける
                    shouldChase = true;
                    targetPos = zombie.targetPosition;
                }
            }
        }
        
        // 追跡する場合
        if (shouldChase && targetPos) {
            if (!zombie.targetPosition || !zombie.targetPosition.equals(targetPos)) {
                zombie.targetPosition = targetPos.clone();
            }
            
        const direction = new THREE.Vector3();
            direction.subVectors(targetPos, zombiePos);
        direction.y = 0; // Y軸は無視
            const distance = direction.length();
            if (distance > 0.001) {
        direction.normalize();
            } else {
                return; // 目標が近すぎる場合はスキップ
            }
            
            // 移動
            const moveVector = direction.multiplyScalar(zombie.speed);
            let newPosition = new THREE.Vector3(
                zombiePos.x + moveVector.x,
                zombiePos.y,
                zombiePos.z + moveVector.z
            );
            newPosition.y = getTerrainHeight(newPosition.x, newPosition.z);
            
            // ゾンビの当たり判定チェック
            zombie.collision.update(new THREE.Vector3(
            newPosition.x,
                newPosition.y + zombieHeight / 2,
            newPosition.z
        ));

        let canMove = true;
            let hitObstacle = null;
            
            // 障害物との衝突チェック
            const nearbyObstacles = getNearbyObstacles(zombie.collision, 2);
            for (let obstacle of nearbyObstacles) {
                if (zombie.collision.intersects(obstacle.collision)) {
                canMove = false;
                    hitObstacle = obstacle;
                break;
            }
        }

            // 他のゾンビとの衝突チェック（距離が近いもののみ、パフォーマンス最適化）
        if (canMove) {
                const COLLISION_CHECK_DISTANCE = 5; // 5m以内のゾンビのみチェック
                for (let otherZombie of allZombies) {
                    // 自分自身はスキップ
                    if (otherZombie === zombie || otherZombie.isDead) continue;
                    
                    // 距離チェック（パフォーマンス最適化）
                    const distanceToOther = zombiePos.distanceTo(otherZombie.group.position);
                    if (distanceToOther > COLLISION_CHECK_DISTANCE) continue;
                    
                    // 他のゾンビの当たり判定を更新（現在位置で）
                    const otherHeight = otherZombie.height || (GAME_CONFIG.playerHeight + 0.5);
                    otherZombie.collision.update(new THREE.Vector3(
                        otherZombie.group.position.x,
                        otherZombie.group.position.y + otherHeight / 2,
                        otherZombie.group.position.z
                    ));
                    
                    if (zombie.collision.intersects(otherZombie.collision)) {
                        canMove = false;
                        break;
                    }
                }
            }
            
            // 障害物にぶつかった場合、迂回を試みる
            if (!canMove && hitObstacle && zombie.hasFoundPlayer) {
                // 左右に回り込む方向を試す
                const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x); // 右方向
                const perpendicularLeft = new THREE.Vector3(direction.z, 0, -direction.x); // 左方向
                
                // 右回りと左回りの位置を計算（cloneを削減）
                perpendicular.multiplyScalar(zombie.speed * 2);
                perpendicularLeft.multiplyScalar(zombie.speed * 2);
                const rightPosition = new THREE.Vector3(
                    zombiePos.x + perpendicular.x,
                    zombiePos.y,
                    zombiePos.z + perpendicular.z
                );
                rightPosition.y = getTerrainHeight(rightPosition.x, rightPosition.z);
                const leftPosition = new THREE.Vector3(
                    zombiePos.x + perpendicularLeft.x,
                    zombiePos.y,
                    zombiePos.z + perpendicularLeft.z
                );
                leftPosition.y = getTerrainHeight(leftPosition.x, leftPosition.z);
                
                // プレイヤーへの距離を計算（距離の2乗で比較、パフォーマンス最適化）
                const rightDistanceSq = rightPosition.distanceToSquared(playerPos);
                const leftDistanceSq = leftPosition.distanceToSquared(playerPos);
                
                // より近い方向を選択
                let bypassDirection;
                if (rightDistanceSq < leftDistanceSq) {
                    perpendicular.normalize();
                    bypassDirection = perpendicular;
                } else {
                    perpendicularLeft.normalize();
                    bypassDirection = perpendicularLeft;
                }
                
                // 迂回位置を計算
                const bypassPosition = new THREE.Vector3(
                    zombiePos.x + bypassDirection.x * zombie.speed,
                    zombiePos.y,
                    zombiePos.z + bypassDirection.z * zombie.speed
                );
                bypassPosition.y = getTerrainHeight(bypassPosition.x, bypassPosition.z);
                
                // 迂回位置の当たり判定をチェック
                zombie.collision.update(new THREE.Vector3(
                    bypassPosition.x,
                    bypassPosition.y + zombieHeight / 2,
                    bypassPosition.z
                ));
                
                let canBypass = true;
                const bypassObstacles = getNearbyObstacles(zombie.collision, 2);
                for (let obstacle of bypassObstacles) {
                    if (zombie.collision.intersects(obstacle.collision)) {
                        canBypass = false;
                        break;
                    }
                }
                
                // 他のゾンビとの衝突チェック（距離が近いもののみ）
                if (canBypass) {
                    const COLLISION_CHECK_DISTANCE = 5;
                    for (let otherZombie of allZombies) {
                        if (otherZombie === zombie || otherZombie.isDead) continue;
                        
                        const distanceToOther = zombiePos.distanceTo(otherZombie.group.position);
                        if (distanceToOther > COLLISION_CHECK_DISTANCE) continue;
                        
                        const otherHeight = otherZombie.height || (GAME_CONFIG.playerHeight + 0.5);
                        otherZombie.collision.update(new THREE.Vector3(
                            otherZombie.group.position.x,
                            otherZombie.group.position.y + otherHeight / 2,
                            otherZombie.group.position.z
                        ));
                        if (zombie.collision.intersects(otherZombie.collision)) {
                            canBypass = false;
                            break;
                        }
                    }
                }
                
                if (canBypass) {
                    newPosition = bypassPosition;
                    canMove = true;
                }
            }
            
            if (canMove) {
                zombie.group.position.x = newPosition.x;
                zombie.group.position.y = newPosition.y;
                zombie.group.position.z = newPosition.z;
                zombie.collision.update(new THREE.Vector3(
                    zombie.group.position.x,
                    zombie.group.position.y + zombieHeight / 2,
                    zombie.group.position.z
                ));
            }
            
            // ゾンビを目標の方向に向ける
            zombie.group.lookAt(new THREE.Vector3(targetPos.x, zombie.group.position.y, targetPos.z));
            zombie.group.rotation.x = 0;
            zombie.group.rotation.z = 0;
        } else {
            // 追跡を停止
            zombie.targetPosition = null;
        }

        // プレイヤーとの当たり判定
        let playerCollisionBase = getTerrainHeight(camera.position.x, camera.position.z);
        if (isInsideMansionArea(camera.position.x, camera.position.z)) {
            playerCollisionBase = playerFloorLevel === 1 ? MANSION_CONFIG.secondFloorHeight : 0;
        }
        playerCollision.update(new THREE.Vector3(
            camera.position.x,
            playerCollisionBase + GAME_CONFIG.playerHeight / 2,
            camera.position.z
        ));

        if (playerCollision.intersects(zombie.collision)) {
            // ダメージ間隔チェック（1秒ごと）
            const now = Date.now();
            if (now - zombie.lastDamageTime >= 1000) {
                zombie.lastDamageTime = now;
                applyZombieDamage(zombie);
            }
        }
    });
}

// ゾンビに当たったメッシュから部位を判定
function getZombieBodyPartFromHit(hitMesh, hitPoint, zombie) {
    // メッシュのuserDataから部位を取得
    if (hitMesh.userData && hitMesh.userData.bodyPart) {
        const bodyPart = hitMesh.userData.bodyPart;
        // 胴体の場合は当たった位置で胸部か腹部かを判定
        if (bodyPart === 'torso') {
            // 胴体の中心からの相対位置で判定（上半分は胸部、下半分は腹部）
            const torsoWorldPos = new THREE.Vector3();
            zombie.torso.getWorldPosition(torsoWorldPos);
            const relativeY = hitPoint.y - torsoWorldPos.y;
            // 胴体の高さの半分より上なら胸部、下なら腹部
            return relativeY > 0 ? 'chest' : 'stomach';
        }
        return bodyPart;
    }
    // userDataがない場合はランダム
    const bodyParts = Object.keys(zombie.bodyParts);
    return bodyParts[Math.floor(Math.random() * bodyParts.length)];
}

// ゾンビにダメージを与える
function damageZombie(zombie, amount, bodyPart, penetration = 0) {
    if (!zombie || zombie.isDead || !bodyPart) return;
    
    // 顔へのダメージは頭に転送（ヘルメットの防御は適用されない）
    if (bodyPart === 'face') {
        damageZombie(zombie, amount, 'head', penetration);
        return;
    }
    
    const part = zombie.bodyParts[bodyPart];
    if (!part) return;
    
    // 既に壊死している部位にはダメージを与えない（他の部位に分散しない）
    if (zombie.blackedOut.includes(bodyPart)) {
        return;
    }
    
    // アーマーとヘルメットの防御を適用
    let finalDamage = amount;
    const protectedParts = ['chest', 'stomach', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
    const isProtected = protectedParts.includes(bodyPart);
    const isHeadProtected = bodyPart === 'head';
    
    // ヘルメットの防御（頭部のみ）
    if (isHeadProtected && zombie.helmetClass) {
        if (penetration > 0) {
            // 弾丸ダメージの場合
            const result = calculateBulletDamageWithZombieHelmet(amount, penetration, zombie.helmetClass);
            finalDamage = result.damage;
        } else {
            // 物理ダメージの場合
            const reductionRate = zombie.helmetClass / 100;
            finalDamage = amount * (1 - reductionRate);
        }
    }
    
    // アーマーの防御
    if (isProtected && zombie.armorClass) {
        if (penetration > 0) {
            // 弾丸ダメージの場合
            const result = calculateBulletDamageWithZombieArmor(amount, penetration, zombie.armorClass);
            finalDamage = result.damage;
        } else {
            // 物理ダメージの場合
            const reductionRate = zombie.armorClass / 100;
            finalDamage = amount * (1 - reductionRate);
        }
    }
    
    // ダメージを適用
    part.health = Math.max(0, part.health - finalDamage);
    
    // 部位が0になった場合の処理
    if (part.health <= 0) {
        handleZombieBodyPartDestroyed(zombie, bodyPart);
    }
    
    // ゾンビが死んでいるかチェック（頭または胸部が壊死）
    if (zombie.blackedOut.includes('head') || zombie.blackedOut.includes('chest')) {
        if (!zombie.isDead) {
            zombie.isDead = true;
            // ゾンビを倒す（色を変えるなど）
            zombie.group.children.forEach(child => {
                if (child.material) {
                    child.material.color.setHex(0x666666); // グレーに
                }
            });
            // アイテムをドロップ
            dropLootFromZombie(zombie);
        }
    }
}

// ゾンビの部位が破壊されたときの処理
function handleZombieBodyPartDestroyed(zombie, bodyPart) {
    // 壊死状態にする
    if (!zombie.blackedOut.includes(bodyPart)) {
        zombie.blackedOut.push(bodyPart);
    }
    
    // 壊死した部位を灰色で表示
    updateZombieBodyPartColor(zombie, bodyPart);
    
    // 部位別の効果
    switch(bodyPart) {
        case 'leftLeg':
        case 'rightLeg':
            // 両足が壊死したら移動速度をさらに半分に
            if (zombie.blackedOut.includes('leftLeg') && zombie.blackedOut.includes('rightLeg')) {
                zombie.speed = zombie.baseSpeed * 0.5;
            }
            break;
        case 'leftArm':
        case 'rightArm':
            // 腕が壊死してもダメージは既に適用されているので、ここでは何もしない
            break;
    }
}

// ゾンビの部位の色を更新
function updateZombieBodyPartColor(zombie, bodyPart) {
    if (!zombie || zombie.isDead) return;
    
    // 部位に対応するメッシュを取得して灰色にする
    switch(bodyPart) {
        case 'head':
            if (zombie.head && zombie.head.material) {
                zombie.head.material.color.setHex(0x666666); // グレー
            }
            // ヘルメットも非表示にする
            if (zombie.helmetMesh) {
                zombie.helmetMesh.visible = false;
            }
            break;
        case 'chest':
        case 'stomach':
            // 胸部と腹部は同じ胴体メッシュを使用
            // 両方が壊死した場合、またはどちらかが壊死した場合は灰色にする
            if (zombie.torso && zombie.torso.material) {
                if (zombie.blackedOut.includes('chest') || zombie.blackedOut.includes('stomach')) {
                    zombie.torso.material.color.setHex(0x666666); // グレー
                }
            }
            // アーマーも非表示にする（胸部または腹部が壊死した場合）
            if (zombie.armorMesh && (zombie.blackedOut.includes('chest') || zombie.blackedOut.includes('stomach'))) {
                zombie.armorMesh.visible = false;
            }
            break;
        case 'leftArm':
            if (zombie.leftArm && zombie.leftArm.material) {
                zombie.leftArm.material.color.setHex(0x666666); // グレー
            }
            // 左腕の他の部分（lowerArm, hand）も灰色にする
            zombie.group.traverse((child) => {
                if (child.userData && child.userData.bodyPart === 'leftArm' && child.material) {
                    child.material.color.setHex(0x666666);
                }
            });
            break;
        case 'rightArm':
            if (zombie.rightArm && zombie.rightArm.material) {
                zombie.rightArm.material.color.setHex(0x666666); // グレー
            }
            // 右腕の他の部分（lowerArm, hand）も灰色にする
            zombie.group.traverse((child) => {
                if (child.userData && child.userData.bodyPart === 'rightArm' && child.material) {
                    child.material.color.setHex(0x666666);
                }
            });
            break;
        case 'leftLeg':
            if (zombie.leftLeg && zombie.leftLeg.material) {
                zombie.leftLeg.material.color.setHex(0x666666); // グレー
            }
            // 左足の他の部分（lowerLeg, foot）も灰色にする
            zombie.group.traverse((child) => {
                if (child.userData && child.userData.bodyPart === 'leftLeg' && child.material) {
                    child.material.color.setHex(0x666666);
                }
            });
            break;
        case 'rightLeg':
            if (zombie.rightLeg && zombie.rightLeg.material) {
                zombie.rightLeg.material.color.setHex(0x666666); // グレー
            }
            // 右足の他の部分（lowerLeg, foot）も灰色にする
            zombie.group.traverse((child) => {
                if (child.userData && child.userData.bodyPart === 'rightLeg' && child.material) {
                    child.material.color.setHex(0x666666);
                }
            });
            break;
    }
}

// 敵にダメージを与える（旧敵NPC用、ゾンビには使わない）
function damageEnemy(enemy, amount, bodyPart = null) {
    if (!enemy || enemy.isDead) return;
    
    // 部位が指定されていない場合はランダムに選択
    if (!bodyPart) {
        const parts = Object.keys(enemy.bodyParts);
        bodyPart = parts[Math.floor(Math.random() * parts.length)];
    }
    
    // 顔へのダメージは頭に転送
    if (bodyPart === 'face') {
        damageEnemy(enemy, amount, 'head');
        return;
    }
    
    const part = enemy.bodyParts[bodyPart];
    if (!part) return;
    
    // ダメージを適用
    part.health = Math.max(0, part.health - amount);
    
    // 部位が0になった場合の処理
    if (part.health <= 0) {
        handleEnemyBodyPartDestroyed(enemy, bodyPart);
    }
    
    // 敵が死んでいるかチェック
    if (enemy.bodyParts.head.health <= 0 || enemy.bodyParts.chest.health <= 0) {
        enemy.isDead = true;
        handleEnemyKilled(enemy);
        // 敵を倒す（色を変えるなど）
        enemy.group.children.forEach(child => {
            if (child.material) {
                child.material.color.setHex(0x666666); // グレーに
            }
        });
    }
}

// 爆発範囲ダメージを適用
function applyExplosionDamage(explosionPoint, weaponData) {
    if (!explosionPoint || !weaponData) {
        console.log('applyExplosionDamage: パラメータが無効', explosionPoint, weaponData);
        return;
    }
    
    const explosionRadius = weaponData.explosionRadius || 500; // 半径500m
    const baseDamage = weaponData.baseDamage || 99999999; // 中心点ダメージ
    const damageDecayPerMeter = weaponData.damageDecayPerMeter || 0.1; // 1mにつき10%減衰
    
    console.log(`爆発処理開始: 位置(${explosionPoint.x.toFixed(2)}, ${explosionPoint.y.toFixed(2)}, ${explosionPoint.z.toFixed(2)}), 範囲: ${explosionRadius}m, 敵数: ${enemies.length}, ゾンビ数: ${zombies.length}`);
    
    // すべての敵にダメージを適用
    enemies.forEach((enemy, index) => {
        if (!enemy || enemy.isDead) return;
        
        // 敵の位置を取得（グループの中心位置）
        const enemyPosition = new THREE.Vector3();
        if (enemy.group) {
            enemy.group.getWorldPosition(enemyPosition);
        } else {
            console.log(`敵${index}: groupが存在しません`);
            return;
        }
        
        // 爆発中心点からの距離を計算
        const distance = explosionPoint.distanceTo(enemyPosition);
        
        // 爆発範囲内かチェック
        if (distance <= explosionRadius) {
            // 距離に応じてダメージを減衰（1mにつき10%減衰）
            const decayFactor = Math.max(0, 1 - (distance * damageDecayPerMeter));
            const damage = baseDamage * decayFactor;
            
            // すべての部位にダメージを与える
            const bodyParts = Object.keys(enemy.bodyParts);
            bodyParts.forEach(bodyPart => {
                damageEnemy(enemy, damage, bodyPart);
            });
            
            console.log(`爆発ダメージ: 敵${index} (位置: ${enemyPosition.x.toFixed(2)}, ${enemyPosition.y.toFixed(2)}, ${enemyPosition.z.toFixed(2)}, 距離: ${distance.toFixed(2)}m, ダメージ: ${damage.toFixed(2)})`);
        } else {
            console.log(`敵${index}: 範囲外 (距離: ${distance.toFixed(2)}m)`);
        }
    });
    
    // すべてのゾンビにダメージを適用
    zombies.forEach((zombie, index) => {
        if (!zombie || zombie.isDead) return;
        
        // ゾンビの位置を取得（グループの中心位置）
        const zombiePosition = new THREE.Vector3();
        if (zombie.group) {
            zombie.group.getWorldPosition(zombiePosition);
        } else {
            console.log(`ゾンビ${index}: groupが存在しません`);
            return;
        }
        
        // 爆発中心点からの距離を計算
        const distance = explosionPoint.distanceTo(zombiePosition);
        
        // 爆発範囲内かチェック
        if (distance <= explosionRadius) {
            // 距離に応じてダメージを減衰（1mにつき10%減衰）
            const decayFactor = Math.max(0, 1 - (distance * damageDecayPerMeter));
            const damage = baseDamage * decayFactor;
            
            // すべての部位にダメージを与える（貫通力は最大）
            const bodyParts = Object.keys(zombie.bodyParts);
            bodyParts.forEach(bodyPart => {
                damageZombie(zombie, damage, bodyPart, 999999); // 最大貫通力
            });
            
            console.log(`爆発ダメージ: ゾンビ${index} (位置: ${zombiePosition.x.toFixed(2)}, ${zombiePosition.y.toFixed(2)}, ${zombiePosition.z.toFixed(2)}, 距離: ${distance.toFixed(2)}m, ダメージ: ${damage.toFixed(2)})`);
        } else {
            console.log(`ゾンビ${index}: 範囲外 (距離: ${distance.toFixed(2)}m)`);
        }
    });
    
    // ボスゾンビにもダメージを適用
    if (bossZombie && !bossZombie.isDead) {
        const bossPosition = new THREE.Vector3();
        bossZombie.group.getWorldPosition(bossPosition);
        
        const distance = explosionPoint.distanceTo(bossPosition);
        
        if (distance <= explosionRadius) {
            const decayFactor = Math.max(0, 1 - (distance * damageDecayPerMeter));
            const damage = baseDamage * decayFactor;
            
            const bodyParts = Object.keys(bossZombie.bodyParts);
            bodyParts.forEach(bodyPart => {
                damageZombie(bossZombie, damage, bodyPart, 999999);
            });
            
            console.log(`爆発ダメージ: ボスゾンビ (距離: ${distance.toFixed(2)}m, ダメージ: ${damage.toFixed(2)})`);
        }
    }
}

// ロケット弾の作成
function createRocketProjectile(startPoint, targetPoint, travelTime, weaponData) {
    if (rocketProjectile) {
        scene.remove(rocketProjectile);
        rocketProjectile = null;
    }
    if (rocketSmoke) {
        scene.remove(rocketSmoke);
        rocketSmoke = null;
    }

    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    rocketProjectile = new THREE.Mesh(geometry, material);
    rocketProjectile.position.copy(startPoint);
    scene.add(rocketProjectile);

    const direction = new THREE.Vector3().subVectors(targetPoint, startPoint).normalize();
    const distance = startPoint.distanceTo(targetPoint);
    const duration = distance / weaponData.projectileSpeed; // 弾速に基づいて時間を計算

    rocketProjectile.userData = {
        startPoint: startPoint.clone(),
        targetPoint: targetPoint,
        direction: direction,
        speed: weaponData.projectileSpeed,
        startTime: performance.now(),
        duration: duration,
        weaponData: weaponData,
        lastSmokeTime: performance.now(),
        lastUpdateTime: performance.now(),
        lastPosition: startPoint.clone() // 前回の位置を保存（衝突検出用）
    };

    // 煙のパーティクルシステムを初期化
    const smokeCount = 50;
    const smokeGeometry = new THREE.BufferGeometry();
    const smokePositions = new Float32Array(smokeCount * 3);
    const smokeOpacities = new Float32Array(smokeCount);
    const smokeSizes = new Float32Array(smokeCount);
    const smokeVelocities = new Float32Array(smokeCount * 3);

    for (let i = 0; i < smokeCount; i++) {
        const i3 = i * 3;
        smokePositions[i3] = 0;
        smokePositions[i3 + 1] = 0;
        smokePositions[i3 + 2] = 0;
        smokeOpacities[i] = 0;
        smokeSizes[i] = 0;
        smokeVelocities[i3] = 0;
        smokeVelocities[i3 + 1] = 0;
        smokeVelocities[i3 + 2] = 0;
    }

    smokeGeometry.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    smokeGeometry.setAttribute('opacity', new THREE.BufferAttribute(smokeOpacities, 1));
    smokeGeometry.setAttribute('size', new THREE.BufferAttribute(smokeSizes, 1));

    const smokeMaterial = new THREE.PointsMaterial({
        size: 0.5,
        color: 0x888888,
        transparent: true,
        opacity: 0.6,
        blending: THREE.NormalBlending,
        depthWrite: false // 煙が他のオブジェクトの前に描画されるように
    });

    rocketSmoke = new THREE.Points(smokeGeometry, smokeMaterial);
    scene.add(rocketSmoke);
    rocketSmoke.userData = {
        particles: [],
        maxParticles: smokeCount,
        particleGeometry: smokeGeometry,
        particleMaterial: smokeMaterial,
        smokePositions: smokePositions,
        smokeOpacities: smokeOpacities,
        smokeSizes: smokeSizes,
        smokeVelocities: smokeVelocities,
        nextParticleIndex: 0
    };
}

// ロケット弾の更新
function updateRocketProjectile() {
    if (!rocketProjectile || !rocketProjectile.userData) return;

    const now = performance.now();
    const userData = rocketProjectile.userData;
    const elapsedTime = (now - userData.startTime) / 1000; // seconds

    if (elapsedTime < userData.duration) {
        const progress = elapsedTime / userData.duration;
        const newPosition = new THREE.Vector3().lerpVectors(
            userData.startPoint,
            userData.targetPoint,
            progress
        );
        
        // 前回の位置から現在の位置へのレイキャストで障害物との衝突を検出
        const lastPos = userData.lastPosition;
        const direction = new THREE.Vector3().subVectors(newPosition, lastPos).normalize();
        const distance = lastPos.distanceTo(newPosition);
        
        // レイキャスターを設定
        const collisionRaycaster = new THREE.Raycaster();
        collisionRaycaster.set(lastPos, direction);
        collisionRaycaster.far = distance;
        
        // 障害物のメッシュを収集
        const intersectableObjects = [];
        obstacles.forEach(obstacle => {
            if (obstacle.mesh) {
                intersectableObjects.push(obstacle.mesh);
            }
        });
        
        // レイキャストを実行
        const intersects = collisionRaycaster.intersectObjects(intersectableObjects, true);
        
        if (intersects.length > 0) {
            // 衝突が検出された場合、衝突点で爆発
            const collisionPoint = intersects[0].point;
            applyExplosionDamage(collisionPoint, userData.weaponData);
            createExplosionMushroomCloud(collisionPoint);
            scene.remove(rocketProjectile);
            rocketProjectile = null;
            if (rocketSmoke) {
                scene.remove(rocketSmoke);
                rocketSmoke = null;
            }
            return; // 早期終了
        }
        
        rocketProjectile.position.copy(newPosition);
        userData.lastPosition = newPosition.clone(); // 現在の位置を保存

        // 煙の生成
        if (now - userData.lastSmokeTime > 50) { // 50msごとに煙を生成
            const smokePos = rocketProjectile.position.clone();
            const smokeData = rocketSmoke.userData;
            const index = smokeData.nextParticleIndex;
            const i3 = index * 3;

            smokeData.smokePositions[i3] = smokePos.x;
            smokeData.smokePositions[i3 + 1] = smokePos.y;
            smokeData.smokePositions[i3 + 2] = smokePos.z;
            smokeData.smokeOpacities[index] = 0.8;
            smokeData.smokeSizes[index] = 0.2 + Math.random() * 0.3;
            smokeData.smokeVelocities[i3] = (Math.random() - 0.5) * 0.5;
            smokeData.smokeVelocities[i3 + 1] = Math.random() * 0.5 + 0.1;
            smokeData.smokeVelocities[i3 + 2] = (Math.random() - 0.5) * 0.5;

            smokeData.particleGeometry.attributes.position.needsUpdate = true;
            smokeData.particleGeometry.attributes.opacity.needsUpdate = true;
            smokeData.particleGeometry.attributes.size.needsUpdate = true;

            smokeData.nextParticleIndex = (index + 1) % smokeData.maxParticles;
            userData.lastSmokeTime = now;
        }

        // 既存の煙パーティクルの更新
        const smokeData = rocketSmoke.userData;
        const deltaTime = (now - userData.lastUpdateTime) / 1000;
        for (let i = 0; i < smokeData.maxParticles; i++) {
            const i3 = i * 3;
            if (smokeData.smokeOpacities[i] > 0) {
                smokeData.smokePositions[i3] += smokeData.smokeVelocities[i3] * deltaTime;
                smokeData.smokePositions[i3 + 1] += smokeData.smokeVelocities[i3 + 1] * deltaTime;
                smokeData.smokePositions[i3 + 2] += smokeData.smokeVelocities[i3 + 2] * deltaTime;
                smokeData.smokeOpacities[i] -= 0.01; // 徐々に薄く
                smokeData.smokeSizes[i] *= 1.02; // 徐々に大きく
            }
        }
        smokeData.particleGeometry.attributes.position.needsUpdate = true;
        smokeData.particleGeometry.attributes.opacity.needsUpdate = true;
        smokeData.particleGeometry.attributes.size.needsUpdate = true;

        userData.lastUpdateTime = now;
    } else {
        // 目標地点に到達、爆発
        applyExplosionDamage(userData.targetPoint, userData.weaponData);
        createExplosionMushroomCloud(userData.targetPoint);
        scene.remove(rocketProjectile);
        rocketProjectile = null;
        if (rocketSmoke) {
            scene.remove(rocketSmoke);
            rocketSmoke = null;
        }
    }
}

// キノコ雲の作成
function createExplosionMushroomCloud(position) {
    if (explosionMushroomCloud) {
        scene.remove(explosionMushroomCloud);
        explosionMushroomCloud = null;
    }
    if (explosionLight) {
        scene.remove(explosionLight);
        explosionLight = null;
    }

    // 爆発の光
    explosionLight = new THREE.PointLight(0xffa500, 5, 200); // オレンジ色の強い光
    explosionLight.position.copy(position);
    scene.add(explosionLight);

    // キノコ雲の茎 (下から上に広がる煙)
    const stemGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const stemMaterial = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.8 });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.copy(position);
    stem.scale.set(1, 0.1, 1); // 初期は平ら
    stem.userData = {
        type: 'stem',
        startTime: performance.now(),
        duration: 2000 // 2秒で成長
    };
    scene.add(stem);

    // キノコ雲の頭 (上に広がる煙)
    const capGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const capMaterial = new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.9 });
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.copy(position);
    cap.position.y += 0.1; // 茎の上に配置
    cap.scale.set(0.1, 0.1, 0.1); // 初期は小さい
    cap.userData = {
        type: 'cap',
        startTime: performance.now(),
        duration: 5000 // 5秒で成長・フェードアウト
    };
    scene.add(cap);

    explosionMushroomCloud = new THREE.Group();
    explosionMushroomCloud.add(stem);
    explosionMushroomCloud.add(cap);
    explosionMushroomCloud.position.copy(position);
    scene.add(explosionMushroomCloud);

    // 爆発音
    createSound('explosion', 500);
}

// キノコ雲の更新
function updateExplosionMushroomCloud() {
    if (!explosionMushroomCloud) return;

    const now = performance.now();
    const children = explosionMushroomCloud.children;

    children.forEach(child => {
        const userData = child.userData;
        if (!userData || !userData.startTime) return;

        const elapsedTime = now - userData.startTime;
        const progress = elapsedTime / userData.duration;

        if (progress < 1) {
            if (userData.type === 'stem') {
                // 茎の成長
                const scaleY = Math.min(1, progress * 5); // 早く伸びる
                child.scale.set(1 + progress * 2, scaleY, 1 + progress * 2);
                child.position.y = explosionMushroomCloud.position.y + (scaleY * 0.5); // 根元を固定して上に伸びる
                child.material.opacity = 0.8 * (1 - progress * 0.5); // 徐々に薄く
            } else if (userData.type === 'cap') {
                // 頭の成長と上昇
                const scale = Math.min(1, progress * 3);
                child.scale.set(scale * 5, scale * 3, scale * 5); // 横に広く、縦に少し伸びる
                child.position.y = explosionMushroomCloud.position.y + (scale * 2); // 上に上昇
                child.material.opacity = 0.9 * (1 - progress * 0.8); // 徐々に薄く
            }
            if (explosionLight) {
                explosionLight.intensity = Math.max(0, 5 * (1 - progress)); // 光もフェードアウト
            }
        } else {
            // アニメーション終了
            scene.remove(child);
            if (explosionLight) {
                scene.remove(explosionLight);
                explosionLight = null;
            }
            if (explosionMushroomCloud.children.length === 0) {
                scene.remove(explosionMushroomCloud);
                explosionMushroomCloud = null;
            }
        }
    });
}

// 敵の部位が破壊されたときの処理
function handleEnemyBodyPartDestroyed(enemy, bodyPart) {
    // 部位別の視覚的フィードバック
    let partMesh = null;
    switch(bodyPart) {
        case 'head':
            partMesh = enemy.head;
            break;
        case 'chest':
        case 'stomach':
            partMesh = enemy.torso;
            break;
        case 'leftArm':
            partMesh = enemy.leftArmUpper;
            break;
        case 'rightArm':
            partMesh = enemy.rightArmUpper;
            break;
        case 'leftLeg':
            partMesh = enemy.leftLegUpper;
            break;
        case 'rightLeg':
            partMesh = enemy.rightLegUpper;
            break;
    }
    
    // 部位の色を変える（ダメージを受けたことを示す）
    if (partMesh && partMesh.material) {
        partMesh.material.color.setHex(0x8B0000); // ダークレッド
    }
}

function handleEnemyKilled(enemy) {
    if (!enemy || enemy.xpGranted) return;
    enemy.xpGranted = true;
    const payload = { enemy_type: enemy.isBoss ? 'boss' : 'normal' };
    sendPlayerXpEvent('kill', payload);
}

// ゾンビのダメージ値を抽選（10-40、確率分布に基づく）
function rollZombieDamage() {
    const rand = Math.random() * 100;
    if (rand < 34) return 10;      // 34%
    if (rand < 59) return 15;      // 25% (34+25)
    if (rand < 74) return 20;      // 15% (59+15)
    if (rand < 84) return 25;      // 10% (74+10)
    if (rand < 92) return 30;      // 8% (84+8)
    if (rand < 97) return 35;      // 5% (92+5)
    return 40;                      // 3% (97+3)
}

// ゾンビのダメージを与える部位の数を抽選（1-4、確率分布に基づく）
function rollZombieDamagePartCount() {
    const rand = Math.random() * 100;
    if (rand < 50) return 1;       // 50%
    if (rand < 92) return 2;       // 42% (50+42)
    if (rand < 97) return 3;       // 5% (92+5)
    return 4;                       // 3% (97+3)
}

// ゾンビのダメージを与える部位を抽選（確率分布に基づく）
function rollZombieDamagePart() {
    const rand = Math.random() * 100;
    if (rand < 3) return 'head';            // 3%
    if (rand < 11) return 'chest';          // 8% (3+8)
    if (rand < 26) return 'stomach';       // 15% (11+15)
    if (rand < 44.5) return 'leftLeg';     // 18.5% (26+18.5)
    if (rand < 63) return 'rightLeg';      // 18.5% (44.5+18.5)
    if (rand < 81.5) return 'leftArm';     // 18.5% (63+18.5)
    return 'rightArm';                      // 18.5% (81.5+18.5)
}

// ゾンビのダメージを適用
function applyZombieDamage(zombie = null) {
    // ダメージを与える部位の数を決定
    const partCount = rollZombieDamagePartCount();
    
    // 物理ダメージなのでisBulletDamage = false
    const damagedParts = new Set(); // 同じ部位に複数回ダメージを与えないように
    
    // ボスゾンビの場合はダメージを1.5倍にする
    const damageMultiplier = zombie && zombie.isBoss ? 1.5 : 1.0;
    
    for (let i = 0; i < partCount; i++) {
        // 部位を抽選（重複を避ける）
        let part = rollZombieDamagePart();
        let attempts = 0;
        while (damagedParts.has(part) && attempts < 20) {
            part = rollZombieDamagePart();
            attempts++;
        }
        damagedParts.add(part);
        
        // 各部位に対してダメージ値を抽選
        const damage = rollZombieDamage() * damageMultiplier;
        
        // ダメージを適用（物理ダメージなのでisBulletDamage = false）
        takeDamage(damage, part, false, false);
    }
}

// 部位別ダメージ処理（物理ダメージ用）
function takeDamage(amount, bodyPart = null, isDistributedDamage = false, isBulletDamage = false, penetration = 0, isStatusEffectDamage = false, skipStatusEffects = false) {
    // 部位が指定されていない場合はランダムに選択
    if (!bodyPart) {
        const parts = Object.keys(GAME_CONFIG.bodyParts);
        bodyPart = parts[Math.floor(Math.random() * parts.length)];
    }
    
    const part = GAME_CONFIG.bodyParts[bodyPart];
    if (!part) return;
    
    // 顔へのダメージは頭に転送（ヘルメットの防御は適用されない）
    if (bodyPart === 'face') {
        // 顔へのダメージを頭に転送（ヘルメットの防御は適用されない）
        takeDamage(amount, 'head', isDistributedDamage, isBulletDamage, penetration, isStatusEffectDamage, skipStatusEffects);
        return;
    }
    
    // アーマーで防護される部位かチェック
    const protectedParts = ['chest', 'stomach', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'];
    const isProtected = protectedParts.includes(bodyPart);
    const isHeadProtected = bodyPart === 'head';
    
    let finalDamage = amount;
    let armorDamaged = false;
    let helmetDamaged = false;
    
    // ヘルメットが装備されている場合の処理（頭部のみ、顔には適用されない）
    if (isHeadProtected && GAME_CONFIG.equippedHelmet && GAME_CONFIG.helmetDurability > 0) {
        const helmetData = HELMET_DATA[GAME_CONFIG.equippedHelmet];
        if (helmetData) {
            if (isBulletDamage) {
                // 弾丸ダメージの処理
                const result = calculateBulletDamageWithHelmet(amount, penetration, helmetData.armor_class, bodyPart);
                finalDamage = result.damage;
                helmetDamaged = result.helmetDamaged;
            } else {
                // 物理ダメージの処理
                const reductionRate = helmetData.armor_class / 100; // 防御力50なら50%軽減
                finalDamage = amount * (1 - reductionRate);
                // ヘルメットへのダメージは軽減後のダメージを10で割った数
                const helmetDamage = Math.floor(finalDamage / 10);
                if (helmetDamage > 0) {
                    GAME_CONFIG.helmetDurability = Math.max(0, GAME_CONFIG.helmetDurability - helmetDamage);
                    helmetDamaged = true;
                }
            }
        }
    }
    
    // アーマーが装備されている場合の処理
    if (isProtected && GAME_CONFIG.equippedArmor && GAME_CONFIG.armorDurability > 0) {
        const armorData = ARMOR_DATA[GAME_CONFIG.equippedArmor];
        if (armorData) {
            if (isBulletDamage) {
                // 弾丸ダメージの処理
                const result = calculateBulletDamageWithArmor(amount, penetration, armorData.armor_class, bodyPart);
                finalDamage = result.damage;
                armorDamaged = result.armorDamaged;
            } else {
                // 物理ダメージの処理
                const reductionRate = armorData.armor_class / 100; // 防御力60なら60%軽減
                finalDamage = amount * (1 - reductionRate);
                // アーマーへのダメージは軽減後のダメージを10で割った数
                const armorDamage = Math.floor(finalDamage / 10);
                if (armorDamage > 0) {
                    GAME_CONFIG.armorDurability = Math.max(0, GAME_CONFIG.armorDurability - armorDamage);
                    armorDamaged = true;
                }
            }
        }
    }
    
    // 壊死した部位にダメージが入った場合、他の部位に分散
    if (!isDistributedDamage && GAME_CONFIG.statusEffects.blackedOut.includes(bodyPart)) {
        distributeDamageToOtherParts(finalDamage, bodyPart);
        return;
    }
    
    // ダメージを適用
    part.health = Math.max(0, part.health - finalDamage);
    
    // 部位が0になった場合の処理
    if (part.health <= 0) {
        handleBodyPartDestroyed(bodyPart);
    }
    
    // アーマーの耐久値を保存
    if (armorDamaged) {
        saveArmorDurability();
    }
    
    // ヘルメットの耐久値を保存
    if (helmetDamaged) {
        saveHelmetDurability();
    }
    
    // 状態異常の適用（分散されたダメージや状態異常によるダメージ、または明示的にスキップする場合は適用しない）
    if (!isDistributedDamage && !isStatusEffectDamage && !skipStatusEffects) {
        applyStatusEffects(bodyPart, finalDamage);
    }
    
    updateHealthUI();
    
    // 即死条件チェック
    if (GAME_CONFIG.bodyParts.head.health <= 0 || GAME_CONFIG.bodyParts.chest.health <= 0) {
        gameOver();
    }
}

// 弾丸ダメージとアーマーの計算
function calculateBulletDamageWithArmor(damage, penetration, armorClass, bodyPart) {
    if (!GAME_CONFIG.equippedArmor || GAME_CONFIG.armorDurability <= 0) {
        return { damage: damage, armorDamaged: false }; // アーマーがないか耐久値が0なら全ダメージ
    }
    
    const armorData = ARMOR_DATA[GAME_CONFIG.equippedArmor];
    if (!armorData) {
        return { damage: damage, armorDamaged: false };
    }
    
    // アーマーの現在の防御力を計算（耐久値に応じて減少）
    const durabilityRatio = GAME_CONFIG.armorDurability / GAME_CONFIG.armorMaxDurability;
    const effectiveArmorClass = Math.floor(armorData.armor_class * durabilityRatio);
    
    let armorDamaged = false;
    
    // 貫通力が防御力以上なら必ず貫通
    if (penetration >= effectiveArmorClass) {
        // アーマーへのダメージ（貫通力を10で割った数）
        const armorDamage = Math.floor(penetration / 10);
        if (armorDamage > 0) {
            GAME_CONFIG.armorDurability = Math.max(0, GAME_CONFIG.armorDurability - armorDamage);
            armorDamaged = true;
        }
        return { damage: damage, armorDamaged: armorDamaged }; // 全ダメージ
    }
    
    // 貫通力が防御力未満の場合、差に基づく確率で貫通
    // 貫通力が防御力に近いほど貫通しやすく、離れているほど貫通しにくい
    const penetrationRatio = penetration / effectiveArmorClass;
    const penetrationChance = Math.max(0, Math.min(100, penetrationRatio * 100));
    const penetrated = Math.random() * 100 < penetrationChance;
    
    // アーマーへのダメージ（貫通力を10で割った数）
    const armorDamage = Math.floor(penetration / 10);
    if (armorDamage > 0) {
        GAME_CONFIG.armorDurability = Math.max(0, GAME_CONFIG.armorDurability - armorDamage);
        armorDamaged = true;
    }
    
    if (penetrated) {
        return { damage: damage, armorDamaged: armorDamaged }; // 貫通した場合は全ダメージ
    } else {
        return { damage: 0, armorDamaged: armorDamaged }; // 貫通しなかった場合はダメージなし
    }
}

// 貫通確率を取得
function getPenetrationChance(penetration, armorClass) {
    const diff = penetration - armorClass;
    if (diff >= 0) return 100; // 防御力以上なら必ず貫通（既にチェック済み）
    
    // 貫通力が防御力より低い場合の確率
    if (penetration >= 49 && penetration <= 59) return 70;
    if (penetration >= 39 && penetration <= 48) return 50;
    if (penetration >= 29 && penetration <= 38) return 30;
    if (penetration >= 19 && penetration <= 28) return 20;
    if (penetration >= 9 && penetration <= 18) return 10;
    if (penetration >= 1 && penetration <= 8) return 5;
    return 0;
}

// アーマーの耐久値を保存
async function saveArmorDurability() {
    if (!GAME_CONFIG.equippedArmor) return;
    
    // インベントリアイテムのarmor_durabilityも更新
    const armorItem = inventoryItems.find(item => item.equipped_slot === 'armor');
    if (armorItem) {
        armorItem.armor_durability = GAME_CONFIG.armorDurability;
    }
    
    try {
        const response = await fetch('/api/game/armor-durability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                durability: GAME_CONFIG.armorDurability
            })
        });
        if (!response.ok) {
            console.error('アーマー耐久値の保存に失敗しました');
        } else {
            // 保存成功後、インベントリを再描画して耐久値を表示更新
            renderInventoryItems();
        }
    } catch (error) {
        console.error('アーマー耐久値の保存エラー:', error);
    }
}

// ヘルメットの耐久値を保存
async function saveHelmetDurability() {
    if (!GAME_CONFIG.equippedHelmet) return;
    
    // インベントリアイテムのhelmet_durabilityも更新
    const helmetItem = inventoryItems.find(item => item.equipped_slot === 'head');
    if (helmetItem) {
        helmetItem.helmet_durability = GAME_CONFIG.helmetDurability;
    }
    
    try {
        const response = await fetch('/api/game/helmet-durability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                durability: GAME_CONFIG.helmetDurability
            })
        });
        if (!response.ok) {
            console.error('ヘルメット耐久値の保存に失敗しました');
        } else {
            // 保存成功後、インベントリを再描画して耐久値を表示更新
            renderInventoryItems();
        }
    } catch (error) {
        console.error('ヘルメット耐久値の保存エラー:', error);
    }
}

// 弾丸ダメージとヘルメットの計算
function calculateBulletDamageWithHelmet(damage, penetration, helmetClass, bodyPart) {
    if (!GAME_CONFIG.equippedHelmet || GAME_CONFIG.helmetDurability <= 0) {
        return { damage: damage, helmetDamaged: false }; // ヘルメットがないか耐久値が0なら全ダメージ
    }
    
    const helmetData = HELMET_DATA[GAME_CONFIG.equippedHelmet];
    if (!helmetData) {
        return { damage: damage, helmetDamaged: false };
    }
    
    // ヘルメットの現在の防御力を計算（耐久値に応じて減少）
    const durabilityRatio = GAME_CONFIG.helmetDurability / GAME_CONFIG.helmetMaxDurability;
    const effectiveHelmetClass = Math.floor(helmetData.armor_class * durabilityRatio);
    
    let helmetDamaged = false;
    
    // 貫通力が防御力+1以上なら必ず貫通
    if (penetration >= effectiveHelmetClass + 1) {
        // ヘルメットへのダメージ（貫通力を10で割った数）
        const helmetDamage = Math.floor(penetration / 10);
        if (helmetDamage > 0) {
            GAME_CONFIG.helmetDurability = Math.max(0, GAME_CONFIG.helmetDurability - helmetDamage);
            helmetDamaged = true;
        }
        return { damage: damage, helmetDamaged: helmetDamaged }; // 全ダメージ
    }
    
    // 貫通力が防御力以下の場合、確率で貫通
    const penetrationChance = getHelmetPenetrationChance(penetration, effectiveHelmetClass);
    const penetrated = Math.random() * 100 < penetrationChance;
    
    // ヘルメットへのダメージ（貫通力を10で割った数）
    const helmetDamage = Math.floor(penetration / 10);
    if (helmetDamage > 0) {
        GAME_CONFIG.helmetDurability = Math.max(0, GAME_CONFIG.helmetDurability - helmetDamage);
        helmetDamaged = true;
    }
    
    if (penetrated) {
        return { damage: damage, helmetDamaged: helmetDamaged }; // 貫通した場合は全ダメージ
    } else {
        return { damage: 0, helmetDamaged: helmetDamaged }; // 貫通しなかった場合はダメージなし
    }
}

// ヘルメットの貫通確率を取得
function getHelmetPenetrationChance(penetration, helmetClass) {
    const diff = penetration - helmetClass;
    if (diff >= 0) return 100; // 防御力以上なら必ず貫通（既にチェック済み）
    
    // 貫通力が防御力より低い場合の確率
    if (penetration >= 39 && penetration <= 49) return 70;
    if (penetration >= 29 && penetration <= 38) return 50;
    if (penetration >= 19 && penetration <= 28) return 30;
    if (penetration >= 9 && penetration <= 18) return 20;
    if (penetration >= 1 && penetration <= 8) return 10;
    return 0;
}

// ゾンビのヘルメットに対する弾丸ダメージ計算
function calculateBulletDamageWithZombieHelmet(damage, penetration, helmetClass) {
    if (!helmetClass) {
        return { damage: damage };
    }
    
    // 貫通力が防御力+1以上なら必ず貫通
    if (penetration >= helmetClass + 1) {
        return { damage: damage }; // 全ダメージ
    }
    
    // 貫通力が防御力以下の場合、確率で貫通
    const penetrationChance = getHelmetPenetrationChance(penetration, helmetClass);
    const penetrated = Math.random() * 100 < penetrationChance;
    
    if (penetrated) {
        return { damage: damage }; // 貫通した場合は全ダメージ
    } else {
        return { damage: 0 }; // 貫通しなかった場合はダメージなし
    }
}

// ゾンビのアーマーに対する弾丸ダメージ計算
function calculateBulletDamageWithZombieArmor(damage, penetration, armorClass) {
    if (!armorClass) {
        return { damage: damage };
    }
    
    // 貫通力が防御力以上なら必ず貫通
    if (penetration >= armorClass) {
        return { damage: damage }; // 全ダメージ
    }
    
    // 貫通力が防御力未満の場合、差に基づく確率で貫通
    // 貫通力が防御力に近いほど貫通しやすく、離れているほど貫通しにくい
    const penetrationRatio = penetration / armorClass;
    const penetrationChance = Math.max(0, Math.min(100, penetrationRatio * 100));
    const penetrated = Math.random() * 100 < penetrationChance;
    
    if (penetrated) {
        return { damage: damage }; // 貫通した場合は全ダメージ
    } else {
        return { damage: 0 }; // 貫通しなかった場合はダメージなし
    }
}

// 壊死した部位へのダメージを他の部位に分散
function distributeDamageToOtherParts(amount, blackedPart) {
    // 壊死していない部位のリストを取得
    const allParts = Object.keys(GAME_CONFIG.bodyParts);
    const healthyParts = allParts.filter(part => 
        part !== blackedPart && !GAME_CONFIG.statusEffects.blackedOut.includes(part)
    );
    
    // すべての部位が壊死している場合は通常のダメージ処理を行う
    if (healthyParts.length === 0) {
        const part = GAME_CONFIG.bodyParts[blackedPart];
        if (part) {
            part.health = Math.max(0, part.health - amount);
            if (part.health <= 0) {
                handleBodyPartDestroyed(blackedPart);
            }
        }
        updateHealthUI();
        // 即死条件チェック
        if (GAME_CONFIG.bodyParts.head.health <= 0 || GAME_CONFIG.bodyParts.chest.health <= 0) {
            gameOver();
        }
        return;
    }
    
    // ダメージを分散（小数点以下繰り上げ）
    const damagePerPart = Math.ceil(amount / healthyParts.length);
    
    // 各部位に分散ダメージを適用
    healthyParts.forEach(part => {
        takeDamage(damagePerPart, part, true); // isDistributedDamage = true
    });
}

// 部位が破壊されたときの処理
function handleBodyPartDestroyed(bodyPart) {
    // 壊死状態にする
    if (!GAME_CONFIG.statusEffects.blackedOut.includes(bodyPart)) {
        GAME_CONFIG.statusEffects.blackedOut.push(bodyPart);
    }
    
    // 部位別の効果
    switch(bodyPart) {
        case 'stomach':
            // 腹部が壊死するとエネルギーの値が大幅に減る
            GAME_CONFIG.energy = Math.max(0, GAME_CONFIG.energy - 50);
            break;
        case 'leftArm':
        case 'rightArm':
            // 腕が壊死するとリロード速度25%低下、上半身スタミナ1.25倍消費、構え時ぶれ
            // これは実際の動作時に適用される
            break;
        case 'leftLeg':
        case 'rightLeg':
            // 足が壊死すると走れなくなる（鎮痛剤が効いている間無効）
            // これは実際の動作時に適用される
            break;
    }
}

// 状態異常の適用
function applyStatusEffects(bodyPart, damage) {
    // 確率ベースで状態異常を適用（ダメージ量に関係なく一律の確率）
    
    // 重度出血: 20%の確率
    if (Math.random() * 100 < 20) {
        if (!GAME_CONFIG.statusEffects.heavyBleeding.find(e => e.part === bodyPart)) {
            GAME_CONFIG.statusEffects.heavyBleeding.push({ part: bodyPart, time: 0 });
            // 状態異常が発生した場合、痛みも発生
        GAME_CONFIG.statusEffects.pain = true;
        }
    }
    // 重度出血が発生しなかった場合、軽度出血: 30%の確率
    else if (Math.random() * 100 < 30) {
        if (!GAME_CONFIG.statusEffects.lightBleeding.find(e => e.part === bodyPart)) {
            GAME_CONFIG.statusEffects.lightBleeding.push({ part: bodyPart, time: 0 });
            // 状態異常が発生した場合、痛みも発生
        GAME_CONFIG.statusEffects.pain = true;
        }
    }
    
    // 頭へのダメージで脳震盪（既存のロジックを維持）
    if (bodyPart === 'head' && damage >= 15) {
        GAME_CONFIG.statusEffects.concussion = true;
    }
    
    // 腕や足へのダメージで骨折: 15%の確率
    if ((bodyPart === 'leftArm' || bodyPart === 'rightArm' || 
         bodyPart === 'leftLeg' || bodyPart === 'rightLeg')) {
        if (Math.random() * 100 < 15) {
        if (!GAME_CONFIG.statusEffects.fracture.find(e => e.part === bodyPart)) {
            GAME_CONFIG.statusEffects.fracture.push({ part: bodyPart });
                // 状態異常が発生した場合、痛みも発生
                GAME_CONFIG.statusEffects.pain = true;
            }
        }
    }
}

// UI更新
function updateHealthUI() {
    // 部位別アイコンの状態を更新
    updateBodyPartIcons();
    
    // 異常状態表示を更新
    updateStatusEffectsDisplay();
    
    // スタミナUI更新
    updateStaminaUI();
    
    // エネルギー・水分UI更新
    updateEnergyHydrationUI();
}

// 部位別体力の状態を更新
function updateBodyPartIcons() {
    const parts = GAME_CONFIG.bodyParts;
    const blackedOut = GAME_CONFIG.statusEffects.blackedOut;
    
    // 各部位の値を更新
    updateBodyPartValue('headHealth', parts.head, blackedOut.includes('head'));
    updateBodyPartValue('chestHealth', parts.chest, blackedOut.includes('chest'));
    updateBodyPartValue('stomachHealth', parts.stomach, blackedOut.includes('stomach'));
    updateBodyPartValue('leftArmHealth', parts.leftArm, blackedOut.includes('leftArm'));
    updateBodyPartValue('rightArmHealth', parts.rightArm, blackedOut.includes('rightArm'));
    updateBodyPartValue('leftLegHealth', parts.leftLeg, blackedOut.includes('leftLeg'));
    updateBodyPartValue('rightLegHealth', parts.rightLeg, blackedOut.includes('rightLeg'));
}

// 個別の部位の値を更新
function updateBodyPartValue(elementId, part, isBlacked) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    // 値を更新
    const currentHealth = Math.ceil(part.health);
    const maxHealth = part.maxHealth;
    element.textContent = `${currentHealth}/${maxHealth}`;
    
    // クラスをリセット
    element.classList.remove('healthy', 'damaged', 'blacked');
    
    if (isBlacked || part.health <= 0) {
        // 壊死：黒
        element.classList.add('blacked');
    } else {
        const healthPercent = (part.health / part.maxHealth) * 100;
        if (healthPercent >= 70) {
            // 健康：緑
            element.classList.add('healthy');
        } else {
            // ダメージ：赤
            element.classList.add('damaged');
        }
    }
}

// 異常状態表示を更新
function updateStatusEffectsDisplay() {
    const statusEffects = GAME_CONFIG.statusEffects;
    
    // ゲーム画面の異常状態表示
    const gameDisplay = document.getElementById('statusEffectsDisplay');
    if (gameDisplay) {
        const badges = [];
        
        // 骨折
        const fractureCount = statusEffects.fracture.length;
        if (fractureCount > 0) {
            badges.push(`<span class="status-effect-badge fracture">骨:${fractureCount}</span>`);
        }
        
        // 軽度出血
        const lightBleedingCount = statusEffects.lightBleeding.length;
        if (lightBleedingCount > 0) {
            badges.push(`<span class="status-effect-badge lightBleeding">軽:${lightBleedingCount}</span>`);
        }
        
        // 重度出血
        const heavyBleedingCount = statusEffects.heavyBleeding.length;
        if (heavyBleedingCount > 0) {
            badges.push(`<span class="status-effect-badge heavyBleeding">重:${heavyBleedingCount}</span>`);
        }
        
        // 壊死
        const blackedOutCount = statusEffects.blackedOut.length;
        if (blackedOutCount > 0) {
            badges.push(`<span class="status-effect-badge blackedOut">壊:${blackedOutCount}</span>`);
        }
        
        gameDisplay.innerHTML = badges.length > 0 ? badges.join('') : '<span style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">なし</span>';
    }
    
    // インベントリの異常状態表示
    const inventoryDisplay = document.getElementById('inventoryStatusEffectsDisplay');
    const inventoryDetailDisplay = document.getElementById('inventoryStatusEffectsDetailDisplay');
    
    if (inventoryDisplay) {
        const badges = [];
        
        // 骨折
        const fractureCount = statusEffects.fracture.length;
        if (fractureCount > 0) {
            badges.push(`<span class="status-effect-badge fracture">骨:${fractureCount}</span>`);
        }
        
        // 軽度出血
        const lightBleedingCount = statusEffects.lightBleeding.length;
        if (lightBleedingCount > 0) {
            badges.push(`<span class="status-effect-badge lightBleeding">軽:${lightBleedingCount}</span>`);
        }
        
        // 重度出血
        const heavyBleedingCount = statusEffects.heavyBleeding.length;
        if (heavyBleedingCount > 0) {
            badges.push(`<span class="status-effect-badge heavyBleeding">重:${heavyBleedingCount}</span>`);
        }
        
        // 壊死
        const blackedOutCount = statusEffects.blackedOut.length;
        if (blackedOutCount > 0) {
            badges.push(`<span class="status-effect-badge blackedOut">壊:${blackedOutCount}</span>`);
        }
        
        inventoryDisplay.innerHTML = badges.length > 0 ? badges.join('') : '<span style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">なし</span>';
    }
    
    // インベントリの詳細表示
    if (inventoryDetailDisplay) {
        const detailItems = [];
        
        // 部位名の日本語マッピング
        const partNames = {
            'head': '頭',
            'chest': '胸',
            'stomach': '腹',
            'leftArm': '左腕',
            'rightArm': '右腕',
            'leftLeg': '左脚',
            'rightLeg': '右脚'
        };
        
        // 骨折の詳細
        if (statusEffects.fracture.length > 0) {
            const fractureParts = statusEffects.fracture.map(f => partNames[f.part] || f.part).join('、');
            detailItems.push(`<div class="status-detail-item"><span style="color: rgba(255, 200, 0, 0.9);">骨折:</span> ${fractureParts}</div>`);
        }
        
        // 軽度出血の詳細
        if (statusEffects.lightBleeding.length > 0) {
            const lightBleedingParts = statusEffects.lightBleeding.map(b => partNames[b.part] || b.part).join('、');
            detailItems.push(`<div class="status-detail-item"><span style="color: rgba(255, 150, 0, 0.9);">軽度出血:</span> ${lightBleedingParts}</div>`);
        }
        
        // 重度出血の詳細
        if (statusEffects.heavyBleeding.length > 0) {
            const heavyBleedingParts = statusEffects.heavyBleeding.map(b => partNames[b.part] || b.part).join('、');
            detailItems.push(`<div class="status-detail-item"><span style="color: rgba(255, 0, 0, 0.9);">重度出血:</span> ${heavyBleedingParts}</div>`);
        }
        
        // 壊死の詳細
        if (statusEffects.blackedOut.length > 0) {
            const blackedOutParts = statusEffects.blackedOut.map(p => partNames[p] || p).join('、');
            detailItems.push(`<div class="status-detail-item"><span style="color: rgba(255, 255, 255, 0.9);">壊死:</span> ${blackedOutParts}</div>`);
        }
        
        inventoryDetailDisplay.innerHTML = detailItems.length > 0 ? detailItems.join('') : '<span style="color: rgba(255,255,255,0.5);">異常状態はありません</span>';
    }
}

function promptSelfDamage() {
    toggleSelfDamagePanel(true);
}

function toggleSelfDamagePanel(forceOpen = null) {
    if (!selfDamagePanel || !selfDamageToggle) return;
    if (!GAME_CONFIG.isInGame && (forceOpen === null || forceOpen === true)) return;
    
    const shouldShow = forceOpen !== null ? forceOpen : selfDamagePanel.classList.contains('hidden');
    if (shouldShow) {
        selfDamagePanel.classList.remove('hidden');
        selfDamageToggle.classList.add('active');
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    } else {
        selfDamagePanel.classList.add('hidden');
        selfDamageToggle.classList.remove('active');
    }
}

function setupMedicalUIControls() {
    if (medicalModeHealButton) {
        medicalModeHealButton.addEventListener('click', () => handleMedicalModeSelection('healOnly'));
    }
    if (medicalModeStatusButton) {
        medicalModeStatusButton.addEventListener('click', () => handleMedicalModeSelection('statusFirst'));
    }
    if (medicalModeCancelButton) {
        medicalModeCancelButton.addEventListener('click', () => {
            pendingMedicalSelection = null;
            hideMedicalModeModal();
        });
    }
}

function setupSelfDamageControls() {
    if (!selfDamageToggle || !selfDamagePanel) return;
    
    selfDamageToggle.addEventListener('click', () => {
        toggleSelfDamagePanel();
    });
    
    if (selfDamageApplyButton) {
        selfDamageApplyButton.addEventListener('click', () => {
            applyManualDamage();
        });
    }
    
    selfDamageStatusButtons.forEach(button => {
        button.addEventListener('click', () => {
            const status = button.dataset.status;
            if (status) {
                applyManualStatus(status);
            }
        });
    });
}

function getSelectedBodyPart() {
    if (selfDamageBodySelect && BODY_PART_KEYS.includes(selfDamageBodySelect.value)) {
        return selfDamageBodySelect.value;
    }
    return 'head';
}

function applyManualDamage() {
    if (!GAME_CONFIG.isInGame) return;
    const part = getSelectedBodyPart();
    const amount = parseInt(selfDamageAmountInput?.value ?? '0', 10);
    
    if (isNaN(amount) || amount <= 0) {
        alert('無効なダメージ量です。');
        return;
    }
    
    takeDamage(amount, part);
}

function applyManualStatus(statusType) {
    if (!GAME_CONFIG.isInGame) return;
    const part = getSelectedBodyPart();
    
    switch (statusType) {
        case 'lightBleeding':
            addBleedingStatus('lightBleeding', part);
            break;
        case 'heavyBleeding':
            addBleedingStatus('heavyBleeding', part);
            break;
        case 'fracture':
            addFractureStatus(part);
            break;
        case 'necrosis':
            addNecrosisStatus(part);
            break;
        default:
            return;
    }
    
    updateHealthUI();
}

function addBleedingStatus(type, part) {
    const list = type === 'heavyBleeding' ? GAME_CONFIG.statusEffects.heavyBleeding : GAME_CONFIG.statusEffects.lightBleeding;
    if (!list.find(e => e.part === part)) {
        list.push({ part, time: 0 });
    }
}

function addFractureStatus(part) {
    if (!GAME_CONFIG.statusEffects.fracture.find(e => e.part === part)) {
        GAME_CONFIG.statusEffects.fracture.push({ part });
    }
}

function addNecrosisStatus(part) {
    const partData = GAME_CONFIG.bodyParts[part];
    if (!partData) return;
    partData.health = 0;
    handleBodyPartDestroyed(part);
}

// スタミナUI更新
function updateStaminaUI() {
    // 上半身スタミナバー
    const upperStaminaBar = document.getElementById('upperStaminaBar');
    if (upperStaminaBar) {
        const percent = (GAME_CONFIG.upperBodyStamina / GAME_CONFIG.maxUpperBodyStamina) * 100;
        upperStaminaBar.style.width = percent + '%';
        
        // スタミナの状態に応じてクラスを変更
        upperStaminaBar.classList.remove('low', 'critical');
        if (percent < 30) {
            upperStaminaBar.classList.add('critical');
        } else if (percent < 60) {
            upperStaminaBar.classList.add('low');
        }
    }
    
    // 下半身スタミナバー
    const lowerStaminaBar = document.getElementById('lowerStaminaBar');
    if (lowerStaminaBar) {
        const percent = (GAME_CONFIG.lowerBodyStamina / GAME_CONFIG.maxLowerBodyStamina) * 100;
        lowerStaminaBar.style.width = percent + '%';
        
        // スタミナの状態に応じてクラスを変更
        lowerStaminaBar.classList.remove('low', 'critical');
        if (percent < 30) {
            lowerStaminaBar.classList.add('critical');
        } else if (percent < 60) {
            lowerStaminaBar.classList.add('low');
        }
    }
}

// エネルギー・水分UI更新
function updateEnergyHydrationUI() {
    const energyElement = document.getElementById('energy');
    if (energyElement) {
        energyElement.textContent = Math.ceil(GAME_CONFIG.energy);
    }
    
    const hydrationElement = document.getElementById('hydration');
    if (hydrationElement) {
        hydrationElement.textContent = Math.ceil(GAME_CONFIG.hydration);
    }
}

// 武器に装填されたマガジンをチェックして更新
let lastMagazineCheckTime = 0;
const MAGAZINE_CHECK_INTERVAL = 500; // 500msごとにチェック

async function checkAndUpdateLoadedMagazine() {
    const now = Date.now();
    if (now - lastMagazineCheckTime < MAGAZINE_CHECK_INTERVAL) {
        return; // チェック間隔を制限
    }
    lastMagazineCheckTime = now;
    
    // 武器が装備されていない場合はスキップ
    if (GAME_CONFIG.weapon === '未装備') {
        if (currentMagazine) {
            currentMagazine = null;
            currentAmmoStack = [];
            GAME_CONFIG.ammo = 0;
            GAME_CONFIG.magazineCapacity = 0;
        }
        return;
    }
    
    // 散弾銃の場合はスキップ（直接装填方式のため）
    const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
    if (weaponData && weaponData.isShotgun) {
        return;
    }
    
    // 通常の武器でマガジンが対応していない場合はスキップ
    if (!GAME_CONFIG.compatibleMagazines || GAME_CONFIG.compatibleMagazines.length === 0) {
        if (currentMagazine) {
            currentMagazine = null;
            currentAmmoStack = [];
            GAME_CONFIG.ammo = 0;
            GAME_CONFIG.magazineCapacity = 0;
        }
        return;
    }
    
    try {
        // 武器に装填されたマガジンを取得
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (!data.success || !data.items) {
            return;
        }
        
        // 武器を取得（現在使用中の武器スロットの武器を取得）
        let weapon = null;
        if (GAME_CONFIG.currentWeaponSlot) {
            weapon = data.items.find(item => 
                item.equipped_slot === GAME_CONFIG.currentWeaponSlot && 
                item.item_type === 'weapon'
            );
        } else {
            // 武器スロットが設定されていない場合はprimaryまたはsecondaryを取得
            const primaryWeapon = data.items.find(item => item.equipped_slot === 'primary');
            const secondaryWeapon = data.items.find(item => item.equipped_slot === 'secondary');
            weapon = primaryWeapon || secondaryWeapon;
        }
        
        if (!weapon) {
            if (currentMagazine) {
                currentMagazine = null;
                currentAmmoStack = [];
                GAME_CONFIG.ammo = 0;
                GAME_CONFIG.magazineCapacity = 0;
            }
            return;
        }
        
        // 武器に装填されたマガジンを探す
        const loadedMagazine = data.items.find(item => 
            item.item_type === 'magazine' && 
            item.parent_item_id === weapon.id &&
            (item.grid_x === null || item.grid_x === undefined) && 
            (item.grid_y === null || item.grid_y === undefined) &&
            GAME_CONFIG.compatibleMagazines.includes(item.item_name)
        );
        
        if (loadedMagazine) {
            // ammo_stackをパース
            if (loadedMagazine.ammo_stack && typeof loadedMagazine.ammo_stack === 'string') {
                try {
                    loadedMagazine.ammo_stack = JSON.parse(loadedMagazine.ammo_stack);
                } catch (e) {
                    loadedMagazine.ammo_stack = [];
                }
            } else if (!loadedMagazine.ammo_stack) {
                loadedMagazine.ammo_stack = [];
            }
            
            // マガジンが変更された場合、または初めて装填された場合
            if (!currentMagazine || currentMagazine.id !== loadedMagazine.id) {
                currentMagazine = loadedMagazine;
                const ammoInMagazine = loadedMagazine.quantity || 0;
                
                // ammo_stackを読み込む
                if (loadedMagazine.ammo_stack && Array.isArray(loadedMagazine.ammo_stack) && loadedMagazine.ammo_stack.length > 0) {
                    currentAmmoStack = JSON.parse(JSON.stringify(loadedMagazine.ammo_stack)); // ディープコピー
                } else {
                    // ammo_stackがない場合は、quantityから逆算して作成
                    currentAmmoStack = [];
                    if (ammoInMagazine > 0) {
                        const defaultAmmo = GAME_CONFIG.ammoType || '5.56x45mm FMJ';
                        currentAmmoStack.push({ type: defaultAmmo, count: ammoInMagazine });
                    }
                }
                
                GAME_CONFIG.ammo = ammoInMagazine;
                const magazineData = MAGAZINE_DATA[loadedMagazine.item_name];
                GAME_CONFIG.magazineCapacity = magazineData?.capacity || 0;
            } else {
                // 同じマガジンの場合、残弾数を更新（発射などで変更された可能性がある）
                // ただし、現在のGAME_CONFIG.ammoがAPIから取得した値より小さい場合は、APIから取得した値で上書きしない
                // （発射で減らされた値が、APIから取得した古い値（MAX）で上書きされることを防ぐ）
                const ammoInMagazine = loadedMagazine.quantity || 0;
                const currentMagazineQuantity = currentMagazine ? (currentMagazine.quantity || 0) : 0;
                
                // 現在のGAME_CONFIG.ammoがAPIから取得した値より小さい場合は、APIから取得した値で上書きしない
                // これにより、発射で減らされた値が、APIから取得した古い値（MAX）で上書きされることを防ぐ
                // ただし、現在のGAME_CONFIG.ammoが0で、APIから取得した値が0より大きい場合は更新する（マガジンを交換した場合など）
                // ただし、currentMagazine.quantityが0の場合（マガジンが0になった場合）は、APIから取得した値で上書きしない
                if (GAME_CONFIG.ammo === 0 && ammoInMagazine > 0 && currentMagazineQuantity > 0) {
                    // マガジンを交換した場合など、現在のGAME_CONFIG.ammoが0で、APIから取得した値が0より大きい場合は更新
                    // ただし、currentMagazine.quantityが0の場合は、マガジンが0になったので、APIから取得した値で上書きしない
                    GAME_CONFIG.ammo = ammoInMagazine;
                    
                    // ammo_stackも更新
                    if (loadedMagazine.ammo_stack && Array.isArray(loadedMagazine.ammo_stack) && loadedMagazine.ammo_stack.length > 0) {
                        currentAmmoStack = JSON.parse(JSON.stringify(loadedMagazine.ammo_stack)); // ディープコピー
                    } else {
                        currentAmmoStack = [];
                        if (ammoInMagazine > 0) {
                            const defaultAmmo = GAME_CONFIG.ammoType || '5.56x45mm FMJ';
                            currentAmmoStack.push({ type: defaultAmmo, count: ammoInMagazine });
                        }
                    }
                } else if (GAME_CONFIG.ammo > ammoInMagazine) {
                    // 現在のGAME_CONFIG.ammoがAPIから取得した値より大きい場合は、APIから取得した値で更新
                    // （マガジンに弾を込めた場合など）
                    GAME_CONFIG.ammo = ammoInMagazine;
                    
                    // ammo_stackも更新
                    if (loadedMagazine.ammo_stack && Array.isArray(loadedMagazine.ammo_stack) && loadedMagazine.ammo_stack.length > 0) {
                        currentAmmoStack = JSON.parse(JSON.stringify(loadedMagazine.ammo_stack)); // ディープコピー
                    } else {
                        currentAmmoStack = [];
                        if (ammoInMagazine > 0) {
                            const defaultAmmo = GAME_CONFIG.ammoType || '5.56x45mm FMJ';
                            currentAmmoStack.push({ type: defaultAmmo, count: ammoInMagazine });
                        }
                    }
                }
                // 現在のGAME_CONFIG.ammoがAPIから取得した値より小さい場合は、APIから取得した値で上書きしない
                // （発射で減らされた値が、APIから取得した古い値（MAX）で上書きされることを防ぐ）
                
                // currentMagazineも更新（発射などで変更された可能性がある）
                currentMagazine.quantity = GAME_CONFIG.ammo;
                currentMagazine.ammo_stack = JSON.parse(JSON.stringify(currentAmmoStack));
            }
        } else {
            // マガジンが装填されていない場合
            if (currentMagazine) {
                currentMagazine = null;
                currentAmmoStack = [];
                GAME_CONFIG.ammo = 0;
                GAME_CONFIG.magazineCapacity = 0;
            }
        }
    } catch (error) {
        console.error('マガジンのチェックに失敗しました:', error);
    }
}

function updateAmmoUI() {
    // 武器データを取得
    const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
    const isShotgun = weaponData && weaponData.isShotgun;
    
    // 散弾銃の場合はマガジンチェックをスキップ
    if (!isShotgun) {
    // 武器に装填されたマガジンをチェック（発射直後はスキップ）
    // ただし、定期的にチェックしてマガジンの変更を検出する
    const now = Date.now();
    if (now - lastMagazineCheckTime >= MAGAZINE_CHECK_INTERVAL) {
        checkAndUpdateLoadedMagazine();
        }
    }
    
    const currentAmmoEl = document.getElementById('currentAmmo');
    
    if (currentAmmoEl) {
        // マガジンが装填されている場合は「残弾/最大装填数」を表示
        if (GAME_CONFIG.magazineCapacity > 0) {
            currentAmmoEl.textContent = `${GAME_CONFIG.ammo}/${GAME_CONFIG.magazineCapacity}`;
        } else {
            currentAmmoEl.textContent = GAME_CONFIG.ammo;
        }
    }
    
    // 発射モードの表示を更新
    updateFireModeDisplay();
}

// 発射モードを切り替える
function toggleFireMode() {
    // 武器が装備されていない場合は何もしない
    if (GAME_CONFIG.weapon === '未装備' || !GAME_CONFIG.fireModes || GAME_CONFIG.fireModes.length === 0) {
        return;
    }
    
    // 現在の発射モードのインデックスを取得
    const currentIndex = GAME_CONFIG.fireModes.indexOf(GAME_CONFIG.currentFireMode);
    
    // 次の発射モードに切り替え（最後の場合は最初に戻る）
    const nextIndex = (currentIndex + 1) % GAME_CONFIG.fireModes.length;
    GAME_CONFIG.currentFireMode = GAME_CONFIG.fireModes[nextIndex];
    
    // 表示を更新
    updateFireModeDisplay();
}

// 発射モードの表示を更新
function updateFireModeDisplay() {
    const fireModeEl = document.getElementById('fireMode');
    if (fireModeEl) {
        if (GAME_CONFIG.weapon === '未装備' || !GAME_CONFIG.fireModes || GAME_CONFIG.fireModes.length === 0) {
            fireModeEl.textContent = '-';
        } else {
            const modeText = GAME_CONFIG.currentFireMode === 'semi' ? 'セミ' : 
                            GAME_CONFIG.currentFireMode === 'full' ? 'フル' : 
                            GAME_CONFIG.currentFireMode;
            fireModeEl.textContent = modeText;
        }
    }
}

// 武器を切り替える
async function switchWeapon(slot) {
    // スロットが無効な場合は何もしない
    if (slot !== 'primary' && slot !== 'secondary') {
        return;
    }
    
    // 現在の武器スロットと同じ場合は何もしない
    if (GAME_CONFIG.currentWeaponSlot === slot) {
        return;
    }
    
    try {
        // 装備アイテムを取得（データベースから最新の情報を取得）
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (!data.success || !data.items) {
            return;
        }
        
        // 指定されたスロットの武器を取得
        const weapon = data.items.find(item => 
            item.equipped_slot === slot && 
            item.item_type === 'weapon'
        );
        
        if (!weapon) {
            console.log(`スロット ${slot} に武器が装備されていません`);
            return; // そのスロットに武器がない
        }
        
        console.log(`武器を切り替え: ${weapon.item_name} (スロット: ${slot})`);
        
        // 武器データを取得
        const weaponData = WEAPON_DATA[weapon.item_name];
        
        // 武器を切り替え
        GAME_CONFIG.weapon = weapon.item_name;
        GAME_CONFIG.currentWeaponSlot = slot;
        setWeaponModelForWeapon(GAME_CONFIG.weapon);
        resetWeaponMalfunctionState({ silent: true });
        
        if (weaponData) {
            GAME_CONFIG.fireRate = weaponData.fireRate;
            GAME_CONFIG.fireModes = weaponData.fireModes;
            GAME_CONFIG.ammoType = weaponData.ammoType;
            GAME_CONFIG.compatibleMagazines = weaponData.compatibleMagazines;
            
            // 初期発射モードを設定（最初のモード）
            if (weaponData.fireModes && weaponData.fireModes.length > 0) {
                GAME_CONFIG.currentFireMode = weaponData.fireModes[0];
            }
            
            // マガジンを読み込む
            // ロケットランチャーの場合はマガジンを読み込まない
            if (weaponData.isRocketLauncher) {
                // ロケットランチャーの場合は装填数1として設定
                GAME_CONFIG.ammo = 1;
                GAME_CONFIG.magazineCapacity = 1;
                currentMagazine = null;
                currentAmmoStack = [];
            } else if (weaponData.isShotgun) {
                // 散弾銃の場合は直接装填方式
                await loadShotgunAmmo();
            } else {
            await loadInitialMagazine();
            }
            
            // 表示を更新
            updateFireModeDisplay();
            updateAmmoUI();
            
            setWeaponDurability(typeof weapon.weapon_durability === 'number' ? weapon.weapon_durability : WEAPON_DURABILITY_MAX, { weaponData });
            updateWeaponDisplayText(weaponData);
        } else {
            // 武器データが取得できない場合でも武器名を表示
            GAME_CONFIG.fireRate = null;
            GAME_CONFIG.fireModes = [];
            GAME_CONFIG.ammoType = null;
            GAME_CONFIG.compatibleMagazines = [];
            GAME_CONFIG.currentFireMode = 'semi';
            
            setWeaponModelForWeapon(null);
            
            GAME_CONFIG.ammo = 0;
            GAME_CONFIG.magazineCapacity = 0;
            currentMagazine = null;
            currentAmmoStack = [];
            
            // 表示を更新
            updateFireModeDisplay();
            updateAmmoUI();
            
            setWeaponDurability(typeof weapon.weapon_durability === 'number' ? weapon.weapon_durability : WEAPON_DURABILITY_MAX);
            updateWeaponDisplayText();
        }
    } catch (error) {
        console.error('武器の切り替えに失敗しました:', error);
    }
}

// 医薬品使用リクエスト
// フレアアイテムの使用処理
function useFlareItem(item) {
    if (!item) return;
    const flareData = FLARE_DATA[item.item_name];
    if (!flareData) {
        alert('このフレアは使用できません。');
        return;
    }
    
    // フレアを消費
    const itemIndex = inventoryItems.findIndex(i => i.id === item.id);
    if (itemIndex === -1) return;
    
    inventoryItems[itemIndex].quantity = (inventoryItems[itemIndex].quantity || 1) - 1;
    
    if (inventoryItems[itemIndex].quantity <= 0) {
        inventoryItems.splice(itemIndex, 1);
    }
    
    saveInventoryItems();
    renderInventoryItems();
    
    // フレアの種類に応じて処理
    if (item.item_name === 'Yellow Flare') {
        // 緊急脱出
        handleFlareEscape(true);
    } else if (item.item_name === 'Green Flare') {
        // 特定脱出（場所チェックは後で実装、今は緊急脱出と同じ処理）
        handleFlareEscape(false);
    } else if (item.item_name === 'Red Flare') {
        // ケアパッケージの要請（まだ実装しない）
        showLootPromptMessage('ケアパッケージの要請機能は未実装です', true);
    }
}

function requestMedicalItemUse(item) {
    if (!item) return;
    const medicalData = MEDICAL_DATA[item.item_name];
    if (!medicalData) {
        alert('この医薬品は使用できません。');
        return;
    }
    if (GAME_CONFIG.usingMedicalItem) {
        alert('別の医薬品を使用中です。');
        return;
    }
    if (!item.quantity || item.quantity <= 0) {
        item.quantity = medicalData.durability || 1;
    }
    const availableDurability = item.quantity || medicalData.durability || 0;
    if (availableDurability <= 0) {
        alert('この医薬品は使い切っています。');
        return;
    }
    
    if (SPECIAL_MEDICAL_ITEMS.has(item.item_name)) {
        pendingMedicalSelection = {
            itemId: getInventoryItemIdentifier(item),
            medicalName: item.item_name
        };
        showMedicalModeModal(medicalData);
    } else {
        beginMedicalUse(item, medicalData, 'statusFirst');
    }
}

function showMedicalModeModal(medicalData) {
    if (!medicalModeModal) return;
    const heading = medicalModeModal.querySelector('h3');
    if (heading && medicalData) {
        heading.textContent = `${medicalData.name || '医薬品'}の使用方法`;
    }
    medicalModeModal.classList.remove('hidden');
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
}

function hideMedicalModeModal() {
    if (medicalModeModal) {
        medicalModeModal.classList.add('hidden');
    }
}

function handleMedicalModeSelection(mode) {
    if (!pendingMedicalSelection) {
        hideMedicalModeModal();
        return;
    }
    const medicalData = MEDICAL_DATA[pendingMedicalSelection.medicalName];
    const item = findInventoryItemByIdentifier(pendingMedicalSelection.itemId);
    hideMedicalModeModal();
    const selectedMode = mode === 'healOnly' ? 'healOnly' : 'statusFirst';
    pendingMedicalSelection = null;
    if (!medicalData || !item) {
        alert('医薬品が見つかりませんでした。');
        return;
    }
    beginMedicalUse(item, medicalData, selectedMode);
}

function beginMedicalUse(item, medicalData, mode = 'statusFirst') {
    if (GAME_CONFIG.usingMedicalItem) {
        alert('別の医薬品を使用中です。');
        return;
    }
    const availableDurability = item.quantity || medicalData.durability || 0;
    if (availableDurability <= 0) {
        alert('この医薬品は使い切っています。');
        return;
    }
    pendingMedicalSelection = null;
    
    // 最初の治療対象を探す
    const firstTarget = findNextTreatmentTarget(medicalData, mode);
    if (!firstTarget) {
        alert('治療対象がありません。');
        return;
    }
    
    GAME_CONFIG.usingMedicalItem = true;
    
    // 医薬品使用の音を生成
    createSound('medical', SOUND_DISTANCES.medical);
    
    const useDuration = Math.max(0.1, medicalData.useTime || 1);
    medicalUseState = {
        active: true,
        start: performance.now(),
        duration: useDuration * 1000,
        itemId: getInventoryItemIdentifier(item),
        medicalName: item.item_name,
        mode,
        availableDurability,
        currentTargetPart: firstTarget.part,
        currentTargetStatus: firstTarget.status
    };
    
    // 医薬品使用中も視点操作を可能にするため、ポインターロックを維持
    // モーダルが開いていない場合はポインターロックを要求
    if (!medicalModeModal || medicalModeModal.classList.contains('hidden')) {
        if (renderer && renderer.domElement && !document.pointerLockElement) {
            renderer.domElement.requestPointerLock();
        }
    }
    
    if (medicalProgressContainer && medicalProgressLabel && medicalProgressFill) {
        const modeText = mode === 'healOnly' ? '回復のみ' : '異常状態治し';
        const partName = getPartDisplayName(firstTarget.part);
        const statusText = getStatusDisplayName(firstTarget.status);
        medicalProgressContainer.classList.remove('hidden');
        medicalProgressLabel.textContent = `${medicalData.name || item.item_name}（${modeText}） - ${partName}${statusText ? ` - ${statusText}` : ''}`;
        medicalProgressFill.style.width = '0%';
    }
}

function updateMedicalUseProgress() {
    if (!medicalProgressContainer || !medicalProgressFill) return;
    if (!medicalUseState.active) {
        medicalProgressContainer.classList.add('hidden');
        return;
    }
    const now = performance.now();
    const elapsed = now - medicalUseState.start;
    const ratio = medicalUseState.duration > 0 ? Math.min(1, elapsed / medicalUseState.duration) : 1;
    medicalProgressFill.style.width = `${(ratio * 100).toFixed(1)}%`;
    
    if (ratio >= 1) {
        completeMedicalUsage();
    }
}

function completeMedicalUsage() {
    if (!medicalUseState.active) return;
    
    const medicalData = MEDICAL_DATA[medicalUseState.medicalName];
    const item = findInventoryItemByIdentifier(medicalUseState.itemId);
    const availableDurability = item ? Math.max(0, item.quantity || 0) : medicalUseState.availableDurability || 0;
    
    if (!medicalData || availableDurability <= 0) {
        // 医薬品がなくなった場合は終了
        medicalUseState.active = false;
        GAME_CONFIG.usingMedicalItem = false;
        if (medicalProgressContainer) {
            medicalProgressContainer.classList.add('hidden');
        }
        return;
    }
    
    // 一か所ずつ効果を適用
    const result = applyMedicalEffectToOnePart(medicalData, {
        mode: medicalUseState.mode,
        availableDurability,
        currentTargetPart: medicalUseState.currentTargetPart,
        currentTargetStatus: medicalUseState.currentTargetStatus
    });

    if (result.healedAmount > 0) {
        sendPlayerXpEvent('heal', { amount: result.healedAmount });
    }
    if (result.statusCures > 0) {
        sendPlayerXpEvent('status_cure', { count: result.statusCures });
    }
    
    if (result.durabilityUsed > 0 && item) {
        item.quantity = Math.max(0, (item.quantity || 0) - result.durabilityUsed);
        medicalUseState.availableDurability = item.quantity;
        if (item.quantity <= 0) {
            const index = inventoryItems.indexOf(item);
            if (index !== -1) {
                inventoryItems.splice(index, 1);
            }
            // 医薬品がなくなった場合は終了
            medicalUseState.active = false;
            GAME_CONFIG.usingMedicalItem = false;
            if (medicalProgressContainer) {
                medicalProgressContainer.classList.add('hidden');
            }
            saveInventoryItems();
            renderInventoryItems();
            return;
        }
        saveInventoryItems();
        renderInventoryItems();
    }
    
    // 次の部位を探す
    const nextTarget = findNextTreatmentTarget(medicalData, medicalUseState.mode);
    
    if (nextTarget) {
        // 次の部位がある場合は継続
        medicalUseState.currentTargetPart = nextTarget.part;
        medicalUseState.currentTargetStatus = nextTarget.status;
        medicalUseState.start = performance.now();
        
        // 進捗表示を更新
        if (medicalProgressContainer && medicalProgressLabel && medicalProgressFill) {
            const modeText = medicalUseState.mode === 'healOnly' ? '回復のみ' : '異常状態治し';
            const partName = getPartDisplayName(nextTarget.part);
            const statusText = getStatusDisplayName(nextTarget.status);
            medicalProgressLabel.textContent = `${medicalData.name || medicalUseState.medicalName}（${modeText}） - ${partName}${statusText ? ` - ${statusText}` : ''}`;
            medicalProgressFill.style.width = '0%';
        }
    } else {
        // 治療対象がなくなった場合は終了
        medicalUseState.active = false;
        GAME_CONFIG.usingMedicalItem = false;
        if (medicalProgressContainer) {
            medicalProgressContainer.classList.add('hidden');
        }
    }
    
    updateHealthUI();
}

// 医薬品使用をキャンセル
function cancelMedicalUse() {
    if (!medicalUseState.active) return;
    
    const medicalData = MEDICAL_DATA[medicalUseState.medicalName];
    const item = findInventoryItemByIdentifier(medicalUseState.itemId);
    
    if (!medicalData || !item) {
        // データが見つからない場合は単に終了
        medicalUseState.active = false;
        GAME_CONFIG.usingMedicalItem = false;
        if (medicalProgressContainer) {
            medicalProgressContainer.classList.add('hidden');
        }
        return;
    }
    
    // 現在の治療対象に必要な耐久値を取得
    let durabilityToConsume = 0;
    const currentStatus = medicalUseState.currentTargetStatus;
    
    if (currentStatus === 'lightBleeding' && medicalData.lightBleedingCost) {
        durabilityToConsume = medicalData.lightBleedingCost;
    } else if (currentStatus === 'heavyBleeding' && medicalData.heavyBleedingCost) {
        durabilityToConsume = medicalData.heavyBleedingCost;
    } else if (currentStatus === 'fracture' && medicalData.fractureCost) {
        durabilityToConsume = medicalData.fractureCost;
    } else if (currentStatus === 'pain' && medicalData.painCost) {
        durabilityToConsume = medicalData.painCost;
    } else if (currentStatus === 'blackedOut' && medicalData.blackedOutCost) {
        durabilityToConsume = medicalData.blackedOutCost;
    } else if (currentStatus === 'heal') {
        // 回復の場合は、現在の部位の不足分を計算（最大でも残り耐久値まで）
        const currentPart = medicalUseState.currentTargetPart;
        if (currentPart && GAME_CONFIG.bodyParts[currentPart]) {
            const partData = GAME_CONFIG.bodyParts[currentPart];
            const missing = partData.maxHealth - partData.health;
            const availableDurability = item.quantity || 0;
            durabilityToConsume = Math.min(missing, availableDurability);
        }
    } else if (currentStatus === 'consume' && (medicalData.energyGain || medicalData.hydrationGain)) {
        // 消費アイテム（水、MREなど）の場合は1消費
        durabilityToConsume = 1;
    }
    
    // 耐久値を減らす（治療効果は適用しない）
    if (durabilityToConsume > 0 && item) {
        item.quantity = Math.max(0, (item.quantity || 0) - durabilityToConsume);
        if (item.quantity <= 0) {
            const index = inventoryItems.indexOf(item);
            if (index !== -1) {
                inventoryItems.splice(index, 1);
            }
        }
        saveInventoryItems();
        renderInventoryItems();
    }
    
    // 医薬品使用状態をリセット
    medicalUseState.active = false;
    GAME_CONFIG.usingMedicalItem = false;
    if (medicalProgressContainer) {
        medicalProgressContainer.classList.add('hidden');
    }
}

// 部位名を日本語で取得
function getPartDisplayName(part) {
    if (!part) return '全身';
    const names = {
        'head': '頭',
        'chest': '胸',
        'stomach': '腹',
        'leftArm': '左腕',
        'rightArm': '右腕',
        'leftLeg': '左脚',
        'rightLeg': '右脚'
    };
    return names[part] || part;
}

// 異常状態名を日本語で取得
function getStatusDisplayName(status) {
    const names = {
        'lightBleeding': '軽度出血',
        'heavyBleeding': '重度出血',
        'fracture': '骨折',
        'blackedOut': '壊死',
        'heal': '回復',
        'consume': '補給'
    };
    return names[status] || '';
}

// 次の治療対象を探す
function findNextTreatmentTarget(medicalData, mode) {
    const cures = Array.isArray(medicalData.cures) ? medicalData.cures : [];
    const treatStatuses = mode !== 'healOnly';
    
    // 異常状態治しモードの場合
    if (treatStatuses) {
        // 優先順位に従って異常状態を探す
        for (const part of MEDICAL_PART_PRIORITY) {
            // 軽度出血
            if (cures.includes('lightBleeding') && medicalData.lightBleedingCost) {
                const index = GAME_CONFIG.statusEffects.lightBleeding.findIndex(e => e.part === part);
                if (index !== -1) {
                    return { part, status: 'lightBleeding' };
                }
            }
            
            // 重度出血
            if (cures.includes('heavyBleeding') && medicalData.heavyBleedingCost) {
                const index = GAME_CONFIG.statusEffects.heavyBleeding.findIndex(e => e.part === part);
                if (index !== -1) {
                    return { part, status: 'heavyBleeding' };
                }
            }
            
            // 骨折
            if (cures.includes('fracture') && medicalData.fractureCost) {
                const index = GAME_CONFIG.statusEffects.fracture.findIndex(e => e.part === part);
                if (index !== -1) {
                    return { part, status: 'fracture' };
                }
            }
            
            // 壊死
            if (cures.includes('blackedOut') && medicalData.blackedOutCost) {
                if (GAME_CONFIG.statusEffects.blackedOut.includes(part)) {
                    return { part, status: 'blackedOut' };
                }
            }
        }
        
        // 痛みの治療
        if (cures.includes('pain') && medicalData.painCost && GAME_CONFIG.statusEffects.pain) {
            return { part: null, status: 'pain' };
        }
    }
    
    // 回復モードまたは異常状態がなくなった場合
    if (HEALING_MEDICAL_ITEMS.has(medicalData.name)) {
        for (const part of MEDICAL_PART_PRIORITY) {
            const partData = GAME_CONFIG.bodyParts[part];
            if (!partData) continue;
            if (GAME_CONFIG.statusEffects.blackedOut.includes(part)) continue;
            if (partData.health < partData.maxHealth) {
                return { part, status: 'heal' };
            }
        }
    }
    
    if (medicalData.energyGain || medicalData.hydrationGain) {
        return { part: null, status: 'consume' };
    }
    
    return null;
}

// 一か所にのみ効果を適用
function applyMedicalEffectToOnePart(medicalData, options = {}) {
    const mode = options.mode || 'statusFirst';
    const tracker = createDurabilityTracker(Math.max(0, options.availableDurability ?? medicalData.durability ?? 0));
    const treatStatuses = mode !== 'healOnly';
    const currentTargetPart = options.currentTargetPart;
    const currentTargetStatus = options.currentTargetStatus;
    let statusCureCount = 0;
    let healedAmount = 0;
    const buildResult = () => ({
        durabilityUsed: tracker.used,
        healedAmount,
        statusCures: statusCureCount
    });
    
    if (currentTargetStatus === 'consume' && (medicalData.energyGain || medicalData.hydrationGain)) {
        if (tracker.remaining() > 0) {
            const consumeAmount = Math.min(tracker.remaining(), medicalData.durability || 1);
            if (medicalData.energyGain) {
                GAME_CONFIG.energy = Math.min(GAME_CONFIG.maxEnergy, GAME_CONFIG.energy + medicalData.energyGain);
            }
            if (medicalData.hydrationGain) {
                GAME_CONFIG.hydration = Math.min(GAME_CONFIG.maxHydration, GAME_CONFIG.hydration + medicalData.hydrationGain);
            }
            tracker.consume(consumeAmount);
            updateEnergyHydrationUI();
            return buildResult();
        }
        return buildResult();
    }
    
    if (!currentTargetPart && currentTargetStatus !== 'pain') {
        // 対象が指定されていない場合は何もしない
        return buildResult();
    }
    
    if (currentTargetStatus === 'lightBleeding' && treatStatuses) {
        const index = GAME_CONFIG.statusEffects.lightBleeding.findIndex(e => e.part === currentTargetPart);
        if (index !== -1 && medicalData.lightBleedingCost && tracker.canSpend(medicalData.lightBleedingCost)) {
            GAME_CONFIG.statusEffects.lightBleeding.splice(index, 1);
            tracker.consume(medicalData.lightBleedingCost);
            statusCureCount += 1;
            return buildResult();
        }
    }
    
    if (currentTargetStatus === 'heavyBleeding' && treatStatuses) {
        const index = GAME_CONFIG.statusEffects.heavyBleeding.findIndex(e => e.part === currentTargetPart);
        if (index !== -1 && medicalData.heavyBleedingCost && tracker.canSpend(medicalData.heavyBleedingCost)) {
            GAME_CONFIG.statusEffects.heavyBleeding.splice(index, 1);
            tracker.consume(medicalData.heavyBleedingCost);
            statusCureCount += 1;
            return buildResult();
        }
    }
    
    if (currentTargetStatus === 'fracture' && treatStatuses) {
        const index = GAME_CONFIG.statusEffects.fracture.findIndex(e => e.part === currentTargetPart);
        if (index !== -1 && medicalData.fractureCost && tracker.canSpend(medicalData.fractureCost)) {
            GAME_CONFIG.statusEffects.fracture.splice(index, 1);
            tracker.consume(medicalData.fractureCost);
            statusCureCount += 1;
            return buildResult();
        }
    }
    
    if (currentTargetStatus === 'blackedOut' && treatStatuses) {
        // 壊死治しは一回の使用ですべての箇所を治す
        if (medicalData.blackedOutCost) {
            const restored = restoreBlackedOutParts(medicalData.blackedOutCost, tracker);
            statusCureCount += restored;
            return buildResult();
        }
    }
    
    if (currentTargetStatus === 'pain' && treatStatuses) {
        const cures = Array.isArray(medicalData.cures) ? medicalData.cures : [];
        if (cures.includes('pain') && medicalData.painCost && GAME_CONFIG.statusEffects.pain && tracker.canSpend(medicalData.painCost)) {
            tracker.consume(medicalData.painCost);
            GAME_CONFIG.statusEffects.pain = false;
            
            // 鎮痛剤の効果
            if (medicalData.duration) {
                GAME_CONFIG.painkillersActive = true;
                GAME_CONFIG.painkillersDuration = medicalData.duration;
            }
            statusCureCount += 1;
            return buildResult();
        }
    }
    
    if (currentTargetStatus === 'heal' && currentTargetPart) {
        const partData = GAME_CONFIG.bodyParts[currentTargetPart];
        if (partData && !GAME_CONFIG.statusEffects.blackedOut.includes(currentTargetPart)) {
            const missing = partData.maxHealth - partData.health;
            if (missing > 0 && tracker.remaining() > 0) {
                // 一か所ずつ治療するため、その部位を完全に回復させるか、耐久値が尽きるまで回復
                const heal = Math.min(missing, tracker.remaining());
                partData.health += heal;
                tracker.consume(heal);
                healedAmount += heal;
                return buildResult();
            }
        }
    }
    
    return buildResult();
}

function applyMedicalEffect(medicalData, options = {}) {
    const cures = Array.isArray(medicalData.cures) ? medicalData.cures : [];
    const mode = options.mode || 'statusFirst';
    const tracker = createDurabilityTracker(Math.max(0, options.availableDurability ?? medicalData.durability ?? 0));
    const treatStatuses = mode !== 'healOnly';

    if (medicalData.energyGain || medicalData.hydrationGain) {
        if (tracker.remaining() > 0) {
            const consumeAmount = Math.min(tracker.remaining(), medicalData.durability || 1);
            if (medicalData.energyGain) {
                GAME_CONFIG.energy = Math.min(GAME_CONFIG.maxEnergy, GAME_CONFIG.energy + medicalData.energyGain);
            }
            if (medicalData.hydrationGain) {
                GAME_CONFIG.hydration = Math.min(GAME_CONFIG.maxHydration, GAME_CONFIG.hydration + medicalData.hydrationGain);
            }
            tracker.consume(consumeAmount);
            updateEnergyHydrationUI();
            return tracker.used;
        }
        return 0;
    }
    
    if (treatStatuses && cures.includes('lightBleeding') && medicalData.lightBleedingCost) {
        removeStatusEntriesByPriority(GAME_CONFIG.statusEffects.lightBleeding, medicalData.lightBleedingCost, tracker, entry => entry.part);
    }
    
    if (treatStatuses && cures.includes('heavyBleeding') && medicalData.heavyBleedingCost) {
        removeStatusEntriesByPriority(GAME_CONFIG.statusEffects.heavyBleeding, medicalData.heavyBleedingCost, tracker, entry => entry.part);
    }
    
    if (treatStatuses && cures.includes('fracture') && medicalData.fractureCost) {
        removeStatusEntriesByPriority(GAME_CONFIG.statusEffects.fracture, medicalData.fractureCost, tracker, entry => entry.part);
    }
    
    if (treatStatuses && cures.includes('pain') && medicalData.painCost && GAME_CONFIG.statusEffects.pain) {
        if (tracker.canSpend(medicalData.painCost)) {
            tracker.consume(medicalData.painCost);
            GAME_CONFIG.statusEffects.pain = false;
        }
    }
    
    if (treatStatuses && cures.includes('blackedOut') && medicalData.blackedOutCost) {
        restoreBlackedOutParts(medicalData.blackedOutCost, tracker);
    }
    
    if (treatStatuses && medicalData.duration && cures.includes('pain')) {
        GAME_CONFIG.painkillersActive = true;
        GAME_CONFIG.painkillersDuration = medicalData.duration;
    } else if (medicalData.duration && medicalData.name && medicalData.name.toLowerCase().includes('painkiller')) {
        GAME_CONFIG.painkillersActive = true;
        GAME_CONFIG.painkillersDuration = medicalData.duration;
    }
    
    if (HEALING_MEDICAL_ITEMS.has(medicalData.name) && tracker.remaining() > 0) {
        const healedAmount = healBodyPartsByPriority(tracker.remaining());
        tracker.consume(healedAmount);
    }
    
    updateHealthUI();
    return tracker.used;
}

function healBodyPartsByPriority(availableAmount) {
    let used = 0;
    if (availableAmount <= 0) return 0;
    for (const part of MEDICAL_PART_PRIORITY) {
        if (used >= availableAmount) break;
        const partData = GAME_CONFIG.bodyParts[part];
        if (!partData) continue;
        if (GAME_CONFIG.statusEffects.blackedOut.includes(part)) continue;
        const missing = partData.maxHealth - partData.health;
        if (missing <= 0) continue;
        const heal = Math.min(missing, availableAmount - used);
        partData.health += heal;
        used += heal;
    }
    return used;
}

function removeStatusEntriesByPriority(list, costPerEntry, tracker, accessor) {
    if (!Array.isArray(list) || !costPerEntry) return 0;
    let removed = 0;
    while (list.length > 0 && tracker.canSpend(costPerEntry)) {
        const index = findStatusIndexByPriority(list, accessor);
        if (index === -1) break;
        list.splice(index, 1);
        tracker.consume(costPerEntry);
        removed++;
    }
    return removed;
}

function restoreBlackedOutParts(costPerPart, tracker) {
    const list = GAME_CONFIG.statusEffects.blackedOut;
    if (!Array.isArray(list) || !costPerPart) return 0;
    let restored = 0;
    while (list.length > 0 && tracker.canSpend(costPerPart)) {
        const index = findStatusIndexByPriority(list, part => part);
        if (index === -1) break;
        const part = list.splice(index, 1)[0];
        if (part && GAME_CONFIG.bodyParts[part]) {
            GAME_CONFIG.bodyParts[part].health = Math.max(1, GAME_CONFIG.bodyParts[part].health);
        }
        tracker.consume(costPerPart);
        restored++;
    }
    return restored;
}

function findStatusIndexByPriority(list, accessor) {
    if (!Array.isArray(list) || list.length === 0) return -1;
    for (const part of MEDICAL_PART_PRIORITY) {
        const idx = list.findIndex(entry => (accessor ? accessor(entry) : entry.part) === part);
        if (idx !== -1) return idx;
    }
    return 0;
}

function createDurabilityTracker(maxAmount) {
    return {
        max: maxAmount,
        used: 0,
        remaining() {
            return Math.max(0, this.max - this.used);
        },
        canSpend(cost) {
            return this.remaining() >= cost;
        },
        consume(cost) {
            const spendAmount = Math.min(cost, this.remaining());
            this.used += spendAmount;
            return spendAmount;
        }
    };
}

// マップ初期化
function initMap() {
    const mapCanvas = document.getElementById('mapCanvas');
    const mapCtx = mapCanvas.getContext('2d');
    mapCanvas.width = 200;
    mapCanvas.height = 200;

    function drawMap() {
        // クリア
        mapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

        // グリッド
        mapCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        mapCtx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const pos = (i / 10) * mapCanvas.width;
            mapCtx.beginPath();
            mapCtx.moveTo(pos, 0);
            mapCtx.lineTo(pos, mapCanvas.height);
            mapCtx.stroke();
            mapCtx.beginPath();
            mapCtx.moveTo(0, pos);
            mapCtx.lineTo(mapCanvas.width, pos);
            mapCtx.stroke();
        }

        const mapScale = MAP_SIZE;

        // 障害物を描画
        mapCtx.fillStyle = 'rgba(139, 69, 19, 0.8)';
        obstacles.forEach(obstacle => {
            if (!obstacle || !obstacle.collision) return;
            const center = obstacle.mesh?.position || obstacle.collision.position;
            if (!center) return;
            const x = (center.x / mapScale) * mapCanvas.width + mapCanvas.width / 2;
            const y = (center.z / mapScale) * mapCanvas.height + mapCanvas.height / 2;
            const w = (obstacle.collision.size.x / mapScale) * mapCanvas.width;
            const h = (obstacle.collision.size.z / mapScale) * mapCanvas.height;
            mapCtx.fillRect(x - w / 2, y - h / 2, w, h);
        });

        // 敵を描画
        enemies.forEach(enemy => {
            if (enemy.isDead) {
                mapCtx.fillStyle = 'rgba(100, 100, 100, 0.8)'; // 死んでいる敵はグレー
            } else {
                mapCtx.fillStyle = 'rgba(255, 0, 0, 0.8)'; // 生きている敵は赤
            }
            const x = (enemy.group.position.x / mapScale) * mapCanvas.width + mapCanvas.width / 2;
            const y = (enemy.group.position.z / mapScale) * mapCanvas.height + mapCanvas.height / 2;
            mapCtx.beginPath();
            mapCtx.arc(x, y, 3, 0, Math.PI * 2);
            mapCtx.fill();
        });

        // プレイヤーを描画
        const playerX = (camera.position.x / mapScale) * mapCanvas.width + mapCanvas.width / 2;
        const playerY = (camera.position.z / mapScale) * mapCanvas.height + mapCanvas.height / 2;
        mapCtx.fillStyle = 'rgba(0, 255, 0, 1)';
        mapCtx.beginPath();
        mapCtx.arc(playerX, playerY, 4, 0, Math.PI * 2);
        mapCtx.fill();

        // プレイヤーの向き
        mapCtx.strokeStyle = 'rgba(0, 255, 0, 1)';
        mapCtx.lineWidth = 2;
        const angle = mouseMovement.x;
        const length = 10;
        mapCtx.beginPath();
        mapCtx.moveTo(playerX, playerY);
        mapCtx.lineTo(
            playerX + Math.sin(angle) * length,
            playerY + Math.cos(angle) * length
        );
        mapCtx.stroke();
    }

    // マップを定期的に更新
    setInterval(drawMap, 100);
    drawMap();
}

// ゲームオーバー
async function gameOver(reason) {
    exitHandlerSuppressed = true;
    GAME_CONFIG.isInGame = false;
    
    // すべてのアイテムを削除
    try {
        const response = await fetch('/api/game/clear-items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();
        if (!data.success) {
            console.error('アイテムの削除に失敗しました:', data.message);
        }
    } catch (error) {
        console.error('アイテムの削除中にエラーが発生しました:', error);
    }
    
    const message = reason ? `ゲームオーバー: ${reason}` : 'ゲームオーバー！';
    alert(message);
    window.location.href = '/';
}

function handleForcedExitEvent(event) {
    if (!GAME_CONFIG.isInGame || exitHandlerSuppressed) return;
    const reason = '任務中に離脱したため死亡扱いです。';
    if (event && event.type === 'beforeunload') {
        event.preventDefault();
        event.returnValue = '';
    }
    gameOver(reason);
}

// エネルギー・水分の保存
function saveEnergyHydration() {
    localStorage.setItem('playerEnergy', GAME_CONFIG.energy.toString());
    localStorage.setItem('playerHydration', GAME_CONFIG.hydration.toString());
    localStorage.setItem('lastEnergyHydrationUpdate', Date.now().toString());
}

// エネルギー・水分の読み込み
function loadEnergyHydration() {
    const savedEnergy = localStorage.getItem('playerEnergy');
    const savedHydration = localStorage.getItem('playerHydration');
    const lastUpdate = localStorage.getItem('lastEnergyHydrationUpdate');
    
    if (savedEnergy) {
        GAME_CONFIG.energy = parseFloat(savedEnergy);
    }
    if (savedHydration) {
        GAME_CONFIG.hydration = parseFloat(savedHydration);
    }
    
    // 最後の更新時刻から経過時間を計算して回復/減少を適用
    if (lastUpdate) {
        const now = Date.now();
        const elapsedMinutes = (now - parseInt(lastUpdate)) / 60000;
        
        // ゲーム画面以外（ホーム画面など）では回復
        if (!GAME_CONFIG.isInGame && elapsedMinutes > 0) {
            GAME_CONFIG.energy = Math.min(GAME_CONFIG.maxEnergy, GAME_CONFIG.energy + 5 * elapsedMinutes);
            GAME_CONFIG.hydration = Math.min(GAME_CONFIG.maxHydration, GAME_CONFIG.hydration + 5 * elapsedMinutes);
        }
    }
    
    updateEnergyHydrationUI();
}

// エネルギー・水分の更新
function updateEnergyHydration() {
    const now = Date.now();
    const deltaTime = (now - lastEnergyHydrationUpdate) / 60000; // 分
    
    if (deltaTime < 0.01) return; // 更新頻度を制限
    
    lastEnergyHydrationUpdate = now;
    
    if (GAME_CONFIG.isInGame) {
        // ゲーム中は-1/mずつ減少
        GAME_CONFIG.energy = Math.max(0, GAME_CONFIG.energy - 1 * deltaTime);
        GAME_CONFIG.hydration = Math.max(0, GAME_CONFIG.hydration - 1 * deltaTime);
        saveEnergyHydration();
    }
    
    updateEnergyHydrationUI();
    
    // エネルギーが0の場合の処理
    if (GAME_CONFIG.energy <= 0) {
        handleZeroEnergy();
    }
    
    // 水分が0の場合の処理
    if (GAME_CONFIG.hydration <= 0) {
        handleZeroHydration();
    }
}

// エネルギーが0の場合の処理
function handleZeroEnergy() {
    const now = Date.now();
    const deltaTime = (now - lastEnergyDamageUpdate) / 1000; // 秒
    
    if (deltaTime >= 10) {
        // 10秒ごとに各部位に1ダメージ（状態異常は付与しない）
        for (const part in GAME_CONFIG.bodyParts) {
            takeDamage(1, part, false, false, 0, false, true); // skipStatusEffects = true
        }
        lastEnergyDamageUpdate = now;
    }
}

// 水分が0の場合の処理
function handleZeroHydration() {
    const now = Date.now();
    const deltaTime = (now - lastHydrationDeathCheck) / 60000; // 分
    
    if (deltaTime >= 1) {
        // 1分ごとに1%の確率で即死
        if (Math.random() < 0.01) {
            gameOver();
        }
        lastHydrationDeathCheck = now;
    }
}

// 状態異常の更新
function updateStatusEffects() {
    const now = Date.now();
    const deltaTime = (now - lastBleedingUpdate) / 1000; // 秒
    
    if (deltaTime < 0.1) return; // 更新頻度を制限
    
    lastBleedingUpdate = now;
    
    // 軽度出血：5秒で1ダメージ
    GAME_CONFIG.statusEffects.lightBleeding.forEach((bleeding, index) => {
        bleeding.time += deltaTime;
        if (bleeding.time >= 5) {
            takeDamage(1, bleeding.part, false, false, 0, true); // isStatusEffectDamage = true
            bleeding.time = 0;
        }
    });
    
    // 重度出血：2秒で1ダメージ
    GAME_CONFIG.statusEffects.heavyBleeding.forEach((bleeding, index) => {
        bleeding.time += deltaTime;
        if (bleeding.time >= 2) {
            takeDamage(1, bleeding.part, false, false, 0, true); // isStatusEffectDamage = true
            bleeding.time = 0;
        }
    });
    
    // 痛みによるうめき声（痛みがあり、鎮痛剤が効いていない場合）
    if (GAME_CONFIG.statusEffects.pain && !GAME_CONFIG.painkillersActive) {
        // うめき声を出す（音声は実装しないが、ログに出力）
        // console.log('うめき声...');
    }
    
    // 鎮痛剤の持続時間更新
    if (GAME_CONFIG.painkillersActive) {
        GAME_CONFIG.painkillersDuration -= deltaTime;
        if (GAME_CONFIG.painkillersDuration <= 0) {
            GAME_CONFIG.painkillersActive = false;
            GAME_CONFIG.painkillersDuration = 0;
        }
    }
}

// アニメーションループ
function animate() {
    requestAnimationFrame(animate);
    
    // FPS計算
    frameCount++;
    const now = Date.now();
    const elapsed = now - lastFpsUpdate;
    
    if (elapsed >= 1000) { // 1秒ごとに更新
        fps = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastFpsUpdate = now;
        
        // FPS表示を更新
        const fpsValueElement = document.getElementById('fpsValue');
        if (fpsValueElement) {
            fpsValueElement.textContent = fps;
        }
    }

    updatePlayerMovement();
    updateZombies();
    updateHealthUI();
    updateAmmoUI();
    updateEnergyHydration();
    updateStatusEffects();
    updateMedicalUseProgress();
    updateWeaponPosition(); // 銃の位置を更新
    updateInteractionFocus();
    updateGeneratorRepair();
    updateExtractionCountdown();
    updateFlareProjectile(); // フレア弾の更新
    updateFlareCountdown(); // フレア弾のカウントダウン更新
    updateRocketProjectile(); // ロケット弾の更新
    updateExplosionMushroomCloud(); // キノコ雲のアニメーション更新

    renderer.render(scene, camera);
}

// 装備アイテムの読み込み
async function loadEquippedItems() {
    // 初期状態を未装備に設定
    GAME_CONFIG.weapon = '未装備';
    GAME_CONFIG.ammo = 0;
    GAME_CONFIG.totalAmmo = 0;
    GAME_CONFIG.fireRate = null;
    GAME_CONFIG.fireModes = [];
    GAME_CONFIG.ammoType = null;
    GAME_CONFIG.compatibleMagazines = [];
    setWeaponModelForWeapon(null);

    try {
        const response = await fetch('/api/game/equipped');
        const data = await response.json();
        
        if (data.success && data.items) {
            // 装備アイテムから武器と弾薬を取得
            const primaryWeapon = data.items.find(item => item.equipped_slot === 'primary');
            const secondaryWeapon = data.items.find(item => item.equipped_slot === 'secondary');
            
            // メイン武器を設定（primaryを優先）
            let selectedWeapon = null;
            let selectedSlot = null;
            
            if (primaryWeapon) {
                selectedWeapon = primaryWeapon;
                selectedSlot = 'primary';
            } else if (secondaryWeapon) {
                selectedWeapon = secondaryWeapon;
                selectedSlot = 'secondary';
            }
            
            let weaponData = null;
            
            if (selectedWeapon) {
                GAME_CONFIG.weapon = selectedWeapon.item_name;
                GAME_CONFIG.currentWeaponSlot = selectedSlot;
                weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
            }

            if (weaponData) {
                GAME_CONFIG.fireRate = weaponData.fireRate;
                GAME_CONFIG.fireModes = weaponData.fireModes;
                GAME_CONFIG.ammoType = weaponData.ammoType;
                GAME_CONFIG.compatibleMagazines = weaponData.compatibleMagazines;
                
                // 初期発射モードを設定（最初のモード）
                if (weaponData.fireModes && weaponData.fireModes.length > 0) {
                    GAME_CONFIG.currentFireMode = weaponData.fireModes[0];
                }
                
            setWeaponModelForWeapon(GAME_CONFIG.weapon);
                
                const selectedDurability = typeof selectedWeapon?.weapon_durability === 'number'
                    ? selectedWeapon.weapon_durability
                    : WEAPON_DURABILITY_MAX;
                setWeaponDurability(selectedDurability, { skipSync: true, weaponData });
                resetWeaponMalfunctionState({ silent: true });
                
                // 初期マガジンを装填（散弾銃の場合は直接装填方式）
                if (weaponData.isRocketLauncher) {
                    // ロケットランチャーの場合は装填数1として設定
                    GAME_CONFIG.ammo = 1;
                    GAME_CONFIG.magazineCapacity = 1;
                    currentMagazine = null;
                    currentAmmoStack = [];
                } else if (weaponData.isShotgun) {
                    // 散弾銃の場合は直接装填方式
                    await loadShotgunAmmo();
                } else {
                await loadInitialMagazine();
                }
                
                // 発射モードの表示を更新
                updateFireModeDisplay();
            } else if (selectedWeapon) {
                // 武器は存在するが、武器データが取得できない場合
                GAME_CONFIG.fireRate = null;
                GAME_CONFIG.fireModes = [];
                GAME_CONFIG.ammoType = null;
                GAME_CONFIG.compatibleMagazines = [];
                GAME_CONFIG.currentFireMode = 'semi'; // デフォルト値に戻す
                
            setWeaponModelForWeapon(null);
                
                GAME_CONFIG.ammo = 0;
                GAME_CONFIG.totalAmmo = 0;
                currentMagazine = null;
                currentAmmoStack = [];
                setWeaponDurability(selectedWeapon.weapon_durability ?? WEAPON_DURABILITY_MAX, { skipSync: true });
                resetWeaponMalfunctionState({ silent: true });
                
                // 発射モードの表示を更新
                updateFireModeDisplay();
            } else {
                // 武器が装備されていない場合
                GAME_CONFIG.fireRate = null;
                GAME_CONFIG.fireModes = [];
                GAME_CONFIG.ammoType = null;
                GAME_CONFIG.compatibleMagazines = [];
                GAME_CONFIG.currentFireMode = 'semi'; // デフォルト値に戻す
                GAME_CONFIG.currentWeaponSlot = null; // 武器スロットをリセット
                
            setWeaponModelForWeapon(null);
                
                GAME_CONFIG.ammo = 0;
                GAME_CONFIG.totalAmmo = 0;
                setWeaponDurability(WEAPON_DURABILITY_MAX, { skipSync: true });
                resetWeaponMalfunctionState({ silent: true });
                
                // 発射モードの表示を更新
                updateFireModeDisplay();
            }
            
            // アーマーを読み込み
            const equippedArmorItem = data.items.find(item => item.equipped_slot === 'armor');
            if (equippedArmorItem) {
                const armorData = ARMOR_DATA[equippedArmorItem.item_name];
                if (armorData) {
                    GAME_CONFIG.equippedArmor = equippedArmorItem.item_name;
                    GAME_CONFIG.armorMaxDurability = armorData.durability;
                    GAME_CONFIG.armorDurability = equippedArmorItem.armor_durability !== null && equippedArmorItem.armor_durability !== undefined
                        ? equippedArmorItem.armor_durability
                        : armorData.durability;
                    // 移動速度にデバフを適用
                    const baseMoveSpeed = 0.1;
                    GAME_CONFIG.moveSpeed = baseMoveSpeed * (1 + armorData.movement_speed_debuff);
                }
            } else {
                GAME_CONFIG.equippedArmor = null;
                GAME_CONFIG.armorDurability = null;
                GAME_CONFIG.armorMaxDurability = null;
            }
            
            // ヘルメットを読み込み
            const equippedHelmetItem = data.items.find(item => item.equipped_slot === 'head');
            if (equippedHelmetItem) {
                const helmetData = HELMET_DATA[equippedHelmetItem.item_name];
                if (helmetData) {
                    GAME_CONFIG.equippedHelmet = equippedHelmetItem.item_name;
                    GAME_CONFIG.helmetMaxDurability = helmetData.durability;
                    GAME_CONFIG.helmetDurability = equippedHelmetItem.helmet_durability !== null && equippedHelmetItem.helmet_durability !== undefined
                        ? equippedHelmetItem.helmet_durability
                        : helmetData.durability;
                    // 移動速度にデバフを適用（アーマーとヘルメットのデバフを合算）
                    if (GAME_CONFIG.equippedArmor) {
                        const armorData = ARMOR_DATA[GAME_CONFIG.equippedArmor];
                        const baseMoveSpeed = 0.1;
                        GAME_CONFIG.moveSpeed = baseMoveSpeed * (1 + armorData.movement_speed_debuff + helmetData.movement_speed_debuff);
                    } else {
                        const baseMoveSpeed = 0.1;
                        GAME_CONFIG.moveSpeed = baseMoveSpeed * (1 + helmetData.movement_speed_debuff);
                    }
                }
            } else {
                GAME_CONFIG.equippedHelmet = null;
                GAME_CONFIG.helmetDurability = null;
                GAME_CONFIG.helmetMaxDurability = null;
                // アーマーがない場合はデフォルト速度
                if (!GAME_CONFIG.equippedArmor) {
                    GAME_CONFIG.moveSpeed = 0.1;
                }
            }
            
            // 武器表示を更新
            updateWeaponDisplayText(weaponData);
            
            console.log('装備アイテムを読み込みました:', {
                weapon: GAME_CONFIG.weapon,
                ammo: GAME_CONFIG.ammo,
                totalAmmo: GAME_CONFIG.totalAmmo,
                fireRate: GAME_CONFIG.fireRate,
                fireModes: GAME_CONFIG.fireModes,
                ammoType: GAME_CONFIG.ammoType,
                compatibleMagazines: GAME_CONFIG.compatibleMagazines,
                armor: GAME_CONFIG.equippedArmor,
                armorDurability: GAME_CONFIG.armorDurability
            });
        } else {
            setWeaponDurability(WEAPON_DURABILITY_MAX, { skipSync: true });
            updateWeaponDisplayText();
        }
    } catch (error) {
        console.error('装備アイテムの読み込みに失敗しました:', error);
        updateWeaponDisplayText();
    }
}

// ========== 銃の実装 ==========

function createWeaponModel() {
    setWeaponModelForWeapon(GAME_CONFIG.weapon);
}

function setWeaponModelForWeapon(weaponName) {
    if (!scene) return;
    
    const loadId = ++weaponModelLoadId;
    
    if (weaponModel) {
        scene.remove(weaponModel);
        disposeWeaponModel(weaponModel);
        weaponModel = null;
    }
    
    if (!weaponName || weaponName === '未装備') {
        return;
    }
    
    const weaponData = WEAPON_DATA[weaponName] || {};
    
    if (weaponData.modelPath) {
        loadWeaponGLB(weaponData.modelPath)
            .then(gltfScene => {
                if (loadId !== weaponModelLoadId) {
                    disposeWeaponModel(gltfScene);
                    return;
                }
                const preparedModel = prepareGLBWeaponModel(gltfScene, weaponData);
                if (!preparedModel) throw new Error('モデルの準備に失敗しました');
                
                weaponModel = preparedModel;
                scene.add(weaponModel);
                updateWeaponPosition();
            })
            .catch(error => {
                console.error(`武器モデルの読み込みに失敗しました (${weaponName}):`, error);
                if (loadId === weaponModelLoadId) {
                    const fallbackModel = buildWeaponModelGeometry(weaponName);
                    if (fallbackModel) {
                        weaponModel = fallbackModel;
                        scene.add(weaponModel);
                        updateWeaponPosition();
                    }
                }
            });
        return;
    }
    
    const newModel = buildWeaponModelGeometry(weaponName);
    if (newModel) {
        weaponModel = newModel;
        scene.add(weaponModel);
        updateWeaponPosition();
    }
}

function getCurrentWeaponInventoryItem() {
    if (!GAME_CONFIG.currentWeaponSlot || !Array.isArray(inventoryItems)) return null;
    return inventoryItems.find(item =>
        item &&
        item.item_type === 'weapon' &&
        item.equipped_slot === GAME_CONFIG.currentWeaponSlot
    ) || null;
}

function updateWeaponDisplayText(weaponData = WEAPON_DATA[GAME_CONFIG.weapon]) {
    const weaponDisplay = document.getElementById('weapon');
    if (!weaponDisplay) return;
    if (!GAME_CONFIG.weapon || GAME_CONFIG.weapon === '未装備') {
        weaponDisplay.textContent = '未装備';
        return;
    }
    const durability = Math.round((GAME_CONFIG.weaponDurability ?? WEAPON_DURABILITY_MAX));
    const durabilityText = `耐久 ${durability}%`;
    if (weaponData && weaponData.fireRate && weaponData.fireModes) {
        weaponDisplay.textContent = `${GAME_CONFIG.weapon} (${weaponData.fireRate}RPM / ${weaponData.fireModes.join('・')}) | ${durabilityText}`;
    } else {
        weaponDisplay.textContent = `${GAME_CONFIG.weapon} | ${durabilityText}`;
    }
}

function syncWeaponDurabilityToInventory() {
    const weaponItem = getCurrentWeaponInventoryItem();
    if (!weaponItem) return;
    weaponItem.weapon_durability = Math.max(0, Math.min(WEAPON_DURABILITY_MAX, GAME_CONFIG.weaponDurability ?? WEAPON_DURABILITY_MAX));
}

function setWeaponDurability(value, options = {}) {
    const clamped = Math.max(0, Math.min(WEAPON_DURABILITY_MAX, Number.isFinite(value) ? value : WEAPON_DURABILITY_MAX));
    GAME_CONFIG.weaponDurability = clamped;
    if (!options.skipSync) {
        syncWeaponDurabilityToInventory();
    }
    if (!options.skipHud) {
        updateWeaponDisplayText(options.weaponData);
    }
}

function applyWeaponDurabilityWear(reason) {
    if (!GAME_CONFIG.weapon || GAME_CONFIG.weapon === '未装備') return;
    const loss = reason === 'reload' ? DURABILITY_LOSS_PER_RELOAD : DURABILITY_LOSS_PER_SHOT;
    if (loss <= 0) return;
    setWeaponDurability((GAME_CONFIG.weaponDurability ?? WEAPON_DURABILITY_MAX) - loss);
}

function getWeaponDurabilityStage(durability) {
    if (durability === undefined || durability === null) return null;
    for (const stage of WEAPON_MALFUNCTION_THRESHOLDS) {
        if (durability <= stage.threshold) {
            return stage;
        }
    }
    return null;
}

function getWeaponMisfireChance(durability) {
    const stage = getWeaponDurabilityStage(durability);
    if (!stage || !stage.misfireOdds) return 0;
    return 1 / stage.misfireOdds;
}

function getWeaponSpreadMultiplier(durability) {
    const stage = getWeaponDurabilityStage(durability);
    return stage ? stage.spreadMultiplier : 1;
}

function resetWeaponMalfunctionState(options = {}) {
    const { silent = false, preserveOverride = false } = options;
    if (weaponChamberCheckTimer) {
        clearTimeout(weaponChamberCheckTimer);
        weaponChamberCheckTimer = null;
    }
    if (weaponClearTimer) {
        clearTimeout(weaponClearTimer);
        weaponClearTimer = null;
    }
    if (weaponDoubleTapTimer) {
        clearTimeout(weaponDoubleTapTimer);
        weaponDoubleTapTimer = null;
    }
    GAME_CONFIG.weaponMalfunction = {
        active: false,
        diagnosed: false,
        checkInProgress: false,
        clearInProgress: false,
        awaitingDoubleTap: false,
        lastTapTime: 0
    };
    if (!preserveOverride && weaponPromptActive) {
        weaponPromptActive = false;
        lootPromptOverrideText = null;
        lootPromptOverrideIsError = false;
        updateInteractionPrompt();
    }
    if (!silent) {
        showLootPromptMessage('装填不良を復旧しました', false);
    }
}

function maybeShowWeaponAnomalyHint() {
    const now = performance.now();
    if (now - lastWeaponAnomalyHintTime < WEAPON_MALFUNCTION_PROMPT_COOLDOWN_MS) {
        return;
    }
    lastWeaponAnomalyHintTime = now;
    showLootPromptMessage('武器が反応しません。Tキーで確認してください', true);
}

function triggerWeaponMalfunction() {
    resetWeaponMalfunctionState({ silent: true, preserveOverride: true });
    GAME_CONFIG.weaponMalfunction.active = true;
    GAME_CONFIG.weaponMalfunction.diagnosed = false;
    maybeShowWeaponAnomalyHint();
}

function startWeaponChamberCheck() {
    if (GAME_CONFIG.weapon === '未装備') return;
    const state = GAME_CONFIG.weaponMalfunction;
    if (state.checkInProgress || state.clearInProgress) return;
    state.checkInProgress = true;
    setLootPromptOverride('チャンバーチェック中...', false);
    weaponPromptActive = true;
    if (weaponChamberCheckTimer) {
        clearTimeout(weaponChamberCheckTimer);
    }
    weaponChamberCheckTimer = setTimeout(() => {
        weaponChamberCheckTimer = null;
        state.checkInProgress = false;
        weaponPromptActive = false;
        lootPromptOverrideText = null;
        lootPromptOverrideIsError = false;
        updateInteractionPrompt();
        if (state.active) {
            state.diagnosed = true;
            state.awaitingDoubleTap = false;
            showLootPromptMessage('装填不良を確認。Tキーを素早く2回押してください', true);
        } else {
            showLootPromptMessage('チャンバーチェック: 異常なし', false);
        }
    }, CHAMBER_CHECK_DURATION_MS);
}

function startWeaponMalfunctionClear() {
    const state = GAME_CONFIG.weaponMalfunction;
    if (!state.active || state.clearInProgress || state.checkInProgress) return;
    state.clearInProgress = true;
    state.awaitingDoubleTap = false;
    setLootPromptOverride('装填不良を対処中...', false);
    weaponPromptActive = true;
    if (weaponClearTimer) {
        clearTimeout(weaponClearTimer);
    }
    weaponClearTimer = setTimeout(() => {
        weaponClearTimer = null;
        resetWeaponMalfunctionState({ silent: true });
        showLootPromptMessage('装填不良を復旧しました', false);
    }, MALFUNCTION_CLEAR_DURATION_MS);
}

function handleWeaponMaintenanceKey() {
    if (inventoryOpen || GAME_CONFIG.weapon === '未装備') return;
    const state = GAME_CONFIG.weaponMalfunction;
    if (state.checkInProgress || state.clearInProgress) return;
    if (!state.active) {
        startWeaponChamberCheck();
        return;
    }
    if (!state.diagnosed) {
        startWeaponChamberCheck();
        return;
    }
    const now = performance.now();
    if (state.awaitingDoubleTap && (now - state.lastTapTime) <= T_DOUBLE_TAP_WINDOW_MS) {
        if (weaponDoubleTapTimer) {
            clearTimeout(weaponDoubleTapTimer);
            weaponDoubleTapTimer = null;
        }
        startWeaponMalfunctionClear();
        return;
    }
    state.awaitingDoubleTap = true;
    state.lastTapTime = now;
    showLootPromptMessage('もう一度Tキーを素早く押すと対処します', false);
    if (weaponDoubleTapTimer) {
        clearTimeout(weaponDoubleTapTimer);
    }
    weaponDoubleTapTimer = setTimeout(() => {
        const currentState = GAME_CONFIG.weaponMalfunction;
        if (currentState) {
            currentState.awaitingDoubleTap = false;
        }
        weaponDoubleTapTimer = null;
    }, T_DOUBLE_TAP_WINDOW_MS);
}

function weaponOperationBlocked() {
    const state = GAME_CONFIG.weaponMalfunction;
    if (state.checkInProgress || state.clearInProgress) {
        maybeShowWeaponAnomalyHint();
        return true;
    }
    if (state.active) {
        maybeShowWeaponAnomalyHint();
        return true;
    }
    return false;
}

function getWeaponViewSettings(weaponName) {
    const weaponData = WEAPON_DATA[weaponName] || {};
    const modelConfig = WEAPON_MODEL_CONFIGS[weaponName] || {};
    
    const offset = weaponData.viewOffset
        || modelConfig.viewOffset
        || DEFAULT_WEAPON_VIEW_OFFSET;
    
    const rotationSource = weaponData.viewRotation
        || modelConfig.viewRotation
        || convertRotationDegrees(
            weaponData.viewRotationDeg
            || modelConfig.viewRotationDeg
            || modelConfig.viewRotationDegrees
        )
        || DEFAULT_WEAPON_VIEW_ROTATION;
    
    return {
        offset: {
            x: offset?.x ?? DEFAULT_WEAPON_VIEW_OFFSET.x,
            y: offset?.y ?? DEFAULT_WEAPON_VIEW_OFFSET.y,
            z: offset?.z ?? DEFAULT_WEAPON_VIEW_OFFSET.z
        },
        rotation: {
            x: rotationSource?.x ?? DEFAULT_WEAPON_VIEW_ROTATION.x,
            y: rotationSource?.y ?? DEFAULT_WEAPON_VIEW_ROTATION.y,
            z: rotationSource?.z ?? DEFAULT_WEAPON_VIEW_ROTATION.z
        }
    };
}

function convertRotationDegrees(rotationDeg) {
    if (!rotationDeg) return null;
    return {
        x: rotationDeg.x != null ? THREE.Math.degToRad(rotationDeg.x) : undefined,
        y: rotationDeg.y != null ? THREE.Math.degToRad(rotationDeg.y) : undefined,
        z: rotationDeg.z != null ? THREE.Math.degToRad(rotationDeg.z) : undefined
    };
}

function buildWeaponModelGeometry(weaponName) {
    const config = WEAPON_MODEL_CONFIGS[weaponName] || WEAPON_MODEL_CONFIGS.default;
    if (!config) return null;
    
    const group = new THREE.Group(); // 武器のグループ
    
    const body = new THREE.Mesh( // 本体
        new THREE.BoxGeometry(config.bodyLength, config.bodyHeight, config.bodyDepth),
        new THREE.MeshLambertMaterial({ color: config.bodyColor })
    );
    group.add(body);
    
    const barrel = new THREE.Mesh( // バレル
        new THREE.BoxGeometry(config.barrelLength, config.bodyHeight * 0.45, config.bodyDepth * 0.6),
        new THREE.MeshLambertMaterial({ color: config.accentColor })
    );
    barrel.position.set((config.bodyLength / 2) + (config.barrelLength / 2), 0, 0);
    group.add(barrel);
    
    const stock = new THREE.Mesh( // ストック
        new THREE.BoxGeometry(config.stockLength, config.bodyHeight * 0.7, config.bodyDepth * 0.9),
        new THREE.MeshLambertMaterial({ color: config.detailColor })
    );
    stock.position.set(-(config.bodyLength / 2) - (config.stockLength / 2), 0.02, 0);
    group.add(stock);
    
    const grip = new THREE.Mesh( // グリップ
        new THREE.BoxGeometry(config.bodyDepth * 0.45, config.gripLength, config.bodyDepth * 0.45),
        new THREE.MeshLambertMaterial({ color: config.accentColor })
    );
    grip.position.set(-config.bodyLength * 0.05, -(config.gripLength / 2), 0);
    grip.rotation.z = THREE.Math.degToRad(-12);
    group.add(grip);
    
    const magazine = new THREE.Mesh( // マガジン
        new THREE.BoxGeometry(config.bodyDepth * 0.5, config.magazineHeight, config.bodyDepth * 0.55),
        new THREE.MeshLambertMaterial({ color: config.detailColor })
    );
    magazine.position.set(config.bodyLength * 0.05, -(config.magazineHeight / 2), config.bodyDepth * -0.05);
    magazine.rotation.z = THREE.Math.degToRad(config.magazineTilt ?? -15);
    group.add(magazine);
    
    const rail = new THREE.Mesh( // レール
        new THREE.BoxGeometry(config.bodyLength * 0.6, config.bodyHeight * 0.2, config.bodyDepth * 0.9),
        new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    );
    rail.position.set(config.bodyLength * 0.05, config.bodyHeight * 0.35, 0);
    group.add(rail);
    
    if (config.handguardLength) {
        const handguard = new THREE.Mesh( // ハンドガード
            new THREE.BoxGeometry(config.handguardLength, config.bodyHeight * 0.7, config.bodyDepth * 1.05),
            new THREE.MeshLambertMaterial({ color: config.bodyColor })
        );
        handguard.position.set(config.bodyLength * 0.25, 0, 0);
        group.add(handguard);
    }
    
    if (config.suppressorLength) {
        const suppressor = new THREE.Mesh( // サプレッサ
            new THREE.BoxGeometry(config.suppressorLength, config.bodyHeight * 0.35, config.bodyDepth * 0.8),
            new THREE.MeshLambertMaterial({ color: config.accentColor })
        );
        suppressor.position.set(
            (config.bodyLength / 2) + config.barrelLength + (config.suppressorLength / 2),
            0,
            0
        );
        group.add(suppressor);
    }
    
    return group;
}

function ensureGLTFLoader() { // GLTFLoaderの読み込み
    if (typeof THREE === 'undefined') {
        return Promise.reject(new Error('THREE.js が読み込まれていません'));
    }
    
    if (THREE.GLTFLoader) {
        return Promise.resolve();
    }
    
    if (!gltfLoaderPromise) {
        gltfLoaderPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
            script.onload = () => {
                if (THREE.GLTFLoader) {
                    resolve();
                } else {
                    reject(new Error('GLTFLoaderの読み込みに失敗しました'));
                }
            };
            script.onerror = () => reject(new Error('GLTFLoaderスクリプトの読み込みに失敗しました'));
            document.head.appendChild(script);
        });
    }
    
    return gltfLoaderPromise;
}

function loadWeaponGLB(url) { // GLBモデルの読み込み
    return ensureGLTFLoader().then(() => {
        return new Promise((resolve, reject) => {
            const loader = new THREE.GLTFLoader();
            loader.load(
                url,
                (gltf) => {
                    if (!gltf || !gltf.scene) {
                        reject(new Error('GLBモデルにsceneが含まれていません'));
                        return;
                    }
                    resolve(gltf.scene);
                },
                undefined,
                (error) => reject(error)
            );
        });
    });
}

function prepareGLBWeaponModel(gltfScene, weaponData = {}) { // GLBモデルの準備
    if (!gltfScene) return null;
    const container = new THREE.Group();
    container.add(gltfScene);
    
    const settings = weaponData.modelSettings || {};
    const scale = settings.scale || {};
    gltfScene.scale.set(
        scale.x ?? gltfScene.scale.x ?? 1,
        scale.y ?? gltfScene.scale.y ?? 1,
        scale.z ?? gltfScene.scale.z ?? 1
    );
    
    const rotation = settings.rotation || {};
    gltfScene.rotation.x += rotation.x ?? 0;
    gltfScene.rotation.y += rotation.y ?? 0;
    gltfScene.rotation.z += rotation.z ?? 0;
    
    const position = settings.position || {};
    gltfScene.position.set(
        position.x ?? gltfScene.position.x ?? 0,
        position.y ?? gltfScene.position.y ?? 0,
        position.z ?? gltfScene.position.z ?? 0
    );
    
    return container;
}

function disposeWeaponModel(model) { // 武器モデルの破棄
    model.traverse((child) => {
        if (child.geometry) {
            child.geometry.dispose();
        }
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
            } else if (child.material.dispose) {
                child.material.dispose();
            }
        }
    });
}

// 銃の位置を更新（カメラに追従）
function updateWeaponPosition() { // 銃の位置を更新（カメラに追従）
    if (!weaponModel || !camera) return;
    
    // ADS中は武器モデルを非表示にする
    if (isAiming) {
        weaponModel.visible = false;
        return;
    }
    
    weaponModel.visible = true;
    
    const { offset: offsetConfig, rotation: rotationConfig } = getWeaponViewSettings(GAME_CONFIG.weapon);
    
    // カメラの位置と回転に追従
    const offset = new THREE.Vector3(offsetConfig.x, offsetConfig.y, offsetConfig.z);
    const cameraWorldPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPosition);
    
    const cameraQuaternion = new THREE.Quaternion();
    cameraQuaternion.copy(camera.quaternion);
    
    const offsetEuler = new THREE.Euler(rotationConfig.x, rotationConfig.y, rotationConfig.z, 'YXZ');
    const offsetQuaternion = new THREE.Quaternion().setFromEuler(offsetEuler);
    
    weaponModel.position.copy(cameraWorldPosition);
    weaponModel.quaternion.copy(cameraQuaternion).multiply(offsetQuaternion);
    
    const adjustedOffset = offset.clone().applyQuaternion(cameraQuaternion);
    weaponModel.position.add(adjustedOffset);
}

// ADS状態を更新
function updateADSState() {
    if (!camera) return;
    
    const ironsightElement = document.getElementById('ironsight');
    
    if (isAiming && GAME_CONFIG.weapon && GAME_CONFIG.weapon !== '未装備') {
        // ADS開始：カメラFOVを変更してズーム
        const zoomedFOV = DEFAULT_CAMERA_FOV / ADS_ZOOM_MULTIPLIER;
        camera.fov = zoomedFOV;
        camera.updateProjectionMatrix();
        
        // 照準器を表示
        if (ironsightElement) {
            ironsightElement.classList.remove('hidden');
            // 設定を適用
            const settings = loadIronsightSettings();
            applyIronsightSettings(settings);
        }
    } else {
        // ADS解除：カメラFOVを元に戻す
        camera.fov = DEFAULT_CAMERA_FOV;
        camera.updateProjectionMatrix();
        
        // 照準器を非表示
        if (ironsightElement) {
            ironsightElement.classList.add('hidden');
        }
    }
    
    // 武器モデルの表示状態を更新
    updateWeaponPosition();
}

function updateLeanTargetFromKeys() {
    if (inventoryOpen || GAME_CONFIG.usingMedicalItem) {
        leanTargetAngle = 0;
        return;
    }
    
    const leaningLeft = keys['KeyQ'];
    const leaningRight = keys['KeyE'];
    
    if (leaningLeft && !leaningRight) {
        leanTargetAngle = -LEAN_MAX_ANGLE;
    } else if (leaningRight && !leaningLeft) {
        leanTargetAngle = LEAN_MAX_ANGLE;
    } else {
        leanTargetAngle = 0;
    }
}

function applyLeanToCamera() {
    if (!camera) return;
    
    if (inventoryOpen || GAME_CONFIG.usingMedicalItem) {
        leanTargetAngle = 0;
    }
    
    currentLeanAngle += (leanTargetAngle - currentLeanAngle) * LEAN_TRANSITION_SPEED;
    if (Math.abs(currentLeanAngle) < 0.0001) {
        currentLeanAngle = 0;
    }
    
    // リーン回転（Z軸）のみ適用
    camera.rotation.z = currentLeanAngle;
    
    updatePlayerAvatarTransform();
}

function getMansionStairData(x, z) {
    const zone = mansionElements.stairZone;
    if (!zone) return null;
    if (Math.abs(x - zone.centerX) > zone.width / 2) return null;
    if (z < zone.startZ - 0.5 || z > zone.endZ + 0.5) return null;
    
    const ascendLength = zone.ascendEndZ - zone.startZ;
    if (ascendLength <= 0) return null;
    if (z <= zone.ascendEndZ) {
        const progressRaw = (z - zone.startZ) / ascendLength;
        const progress = THREE.MathUtils.clamp(progressRaw, 0, 1);
        return {
            progress,
            height: progress * zone.topY
        };
    }
    
    return {
        progress: 1,
        height: zone.topY
    };
}

function applyMansionFloorHeight(stanceHeight, desiredY) {
    if (!MANSION_CONFIG || !camera) return false;
    
    const stairData = getMansionStairData(camera.position.x, camera.position.z);
    let baseHeight = null;
    if (stairData) {
        baseHeight = stairData.height;
        if (stairData.progress >= 0.98) {
            playerFloorLevel = 1;
        } else if (stairData.progress <= 0.02) {
            playerFloorLevel = 0;
        }
    } else if (isInsideMansionArea(camera.position.x, camera.position.z)) {
        baseHeight = playerFloorLevel === 1 ? MANSION_CONFIG.secondFloorHeight : 0;
    } else {
        if (playerFloorLevel === 1) {
            playerFloorLevel = 0;
        }
        return false;
    }
    
    const groundLevel = baseHeight + stanceHeight;
    if (desiredY <= groundLevel) {
        camera.position.y = groundLevel;
        verticalVelocity = 0;
        isOnGround = true;
    } else if (isOnGround && desiredY > groundLevel) {
        camera.position.y = groundLevel;
        verticalVelocity = 0;
        isOnGround = true;
    } else {
        camera.position.y = desiredY;
        isOnGround = false;
    }
    return true;
}

function updatePlayerAvatarTransform() {
    if (!player || !camera) return;
    
    const stanceHeight = getCurrentEyeHeight();
    player.position.set(
        camera.position.x,
        camera.position.y - stanceHeight,
        camera.position.z
    );
    
    player.rotation.set(0, camera.rotation.y, currentLeanAngle);
}

// 特殊効果を解析して反動と精度の変動を取得
function parseSpecialEffects(special) { // 特殊効果を解析して反動と精度の変動を取得
    if (!special || special === 'None' || special === 'なし') {
        return { recoilModifier: 0, accuracyModifier: 0 };
    }
    
    let recoilModifier = 0;
    let accuracyModifier = 0;
    
    // 「精度±X%,反動±Y%」の形式を解析
    const effects = special.split(',');
    for (const effect of effects) {
        const trimmed = effect.trim();
        if (trimmed.includes('反動')) {
            const match = trimmed.match(/反動([+-]?\d+)%/);
            if (match) {
                recoilModifier = parseFloat(match[1]) / 100; // パーセンテージを小数に変換
            }
        } else if (trimmed.includes('精度')) {
            const match = trimmed.match(/精度([+-]?\d+)%/);
            if (match) {
                accuracyModifier = parseFloat(match[1]) / 100; // パーセンテージを小数に変換
            }
        }
    }
    
    return { recoilModifier, accuracyModifier };
}

// 散弾銃の弾丸を発射する処理
function fireShotgunPellets(ammoData, weaponData) {
    if (!camera || !ammoData || !ammoData.isBuckshot) return;
    
    const pelletCount = ammoData.pelletCount || 8;
    const pelletDamage = ammoData.damage || 50; // 1発あたりのダメージ
    const penetration = ammoData.penetration || 0;
    
    // 武器の精度（MOA）を取得
    let moa = weaponData ? (weaponData.moa || 18.0) : 18.0;
    
    // 弾薬の特殊効果から精度の変動を取得
    if (ammoData.special) {
        const specialEffects = parseSpecialEffects(ammoData.special);
        if (specialEffects.accuracyModifier !== 0) {
            moa *= (1 - specialEffects.accuracyModifier);
        }
    }
    
    // MOAをラジアンに変換
    const moaToRadians = 0.000290888;
    const spreadMultiplier = getWeaponSpreadMultiplier(GAME_CONFIG.weaponDurability);
    const spreadRadians = moa * moaToRadians * spreadMultiplier;
    
    // 衝突対象を収集
    const intersectableObjects = [];
    const objectMap = new Map();
    
    enemies.forEach(enemy => {
        if (!enemy.isDead) {
            enemy.group.children.forEach(child => {
                if (child.type === 'Mesh') {
                    intersectableObjects.push(child);
                    objectMap.set(child, { enemy: enemy, type: 'enemy' });
                }
            });
        }
    });
    
    zombies.forEach(zombie => {
        if (!zombie.isDead) {
            zombie.group.children.forEach(child => {
                if (child.type === 'Mesh') {
                    intersectableObjects.push(child);
                    objectMap.set(child, { zombie: zombie, type: 'zombie' });
                }
            });
        }
    });
    
    if (bossZombie && !bossZombie.isDead) {
        bossZombie.group.children.forEach(child => {
            if (child.type === 'Mesh') {
                intersectableObjects.push(child);
                objectMap.set(child, { zombie: bossZombie, type: 'zombie' });
            }
        });
    }
    
    targets.forEach(target => {
        target.group.children.forEach(child => {
            if (child.type === 'Mesh') {
                intersectableObjects.push(child);
                objectMap.set(child, { target: target, type: 'target' });
            }
        });
    });
    
    obstacles.forEach(obstacle => {
        if (obstacle.mesh) {
            intersectableObjects.push(obstacle.mesh);
            objectMap.set(obstacle.mesh, { type: 'obstacle' });
        }
    });
    
    // 8つの弾丸を発射
    for (let i = 0; i < pelletCount; i++) {
        // ランダムな方向にずらす（円形分布）
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spreadRadians;
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        
        // レイキャスターを設定
        const pelletRaycaster = new THREE.Raycaster();
        pelletRaycaster.setFromCamera(new THREE.Vector2(offsetX, offsetY), camera);
        pelletRaycaster.far = 1000;
        
        // レイキャストを実行
        const intersects = pelletRaycaster.intersectObjects(intersectableObjects);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitMetadata = objectMap.get(hit.object);
            
            if (hitMetadata) {
                if (hitMetadata.type === 'enemy') {
                    const enemy = hitMetadata.enemy;
                    const bodyParts = Object.keys(enemy.bodyParts);
                    const hitBodyPart = bodyParts[Math.floor(Math.random() * bodyParts.length)];
                    damageEnemy(enemy, pelletDamage, hitBodyPart);
                } else if (hitMetadata.type === 'zombie') {
                    const zombie = hitMetadata.zombie;
                    if (!zombie || zombie.isDead) continue;
                    
                    const hitBodyPart = getZombieBodyPartFromHit(hit.object, hit.point, zombie);
                    if (!hitBodyPart) continue;
                    
                    let damage = pelletDamage;
                    if (zombie.blackedOut.includes('leftArm')) {
                        damage = Math.max(0, damage - 2);
                    }
                    if (zombie.blackedOut.includes('rightArm')) {
                        damage = Math.max(0, damage - 2);
                    }
                    
                    damageZombie(zombie, damage, hitBodyPart, penetration);
                } else if (hitMetadata.type === 'target') {
                    const target = hitMetadata.target;
                    target.hitInfo = {
                        ammoType: '12x70mm 8.5mm Magnum Buckshot',
                        caliber: '12x70mm',
                        damage: pelletDamage,
                        penetration: penetration
                    };
                    target.hitTime = Date.now();
                    addHitMark(target, hit);
                    showTargetHitInfo(target.hitInfo);
                }
            }
        }
    }
}

// 武器を発射する処理
function fireWeapon() { // 武器を発射する処理
    // 医薬品使用中は発射できない
    if (GAME_CONFIG.usingMedicalItem) {
        isFiring = false;
        return;
    }
    
    // 武器データを取得
    const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
    const isRocketLauncher = weaponData && weaponData.isRocketLauncher;
    const isShotgun = weaponData && weaponData.isShotgun;
    
    // ロケットランチャーと散弾銃以外の場合、マガジンと弾薬のチェック
    if (!isRocketLauncher && !isShotgun) {
    // 武器未装備、マガジンが装填されていない、弾薬がない場合は発射できない
    if (GAME_CONFIG.weapon === '未装備' || !currentMagazine || GAME_CONFIG.ammo <= 0) {
        isFiring = false;
        return;
    }
    
    // ammo_stackが空で、GAME_CONFIG.ammoが0の場合は発射できない
    if (currentAmmoStack.length === 0 && GAME_CONFIG.ammo <= 0) {
        isFiring = false;
        return;
        }
    } else if (isRocketLauncher) {
        // ロケットランチャーの場合、武器未装備のみチェック
        if (GAME_CONFIG.weapon === '未装備') {
            isFiring = false;
            return;
        }
    } else if (isShotgun) {
        // 散弾銃の場合、武器未装備または弾薬がない場合は発射できない
        if (GAME_CONFIG.weapon === '未装備' || GAME_CONFIG.ammo <= 0) {
            isFiring = false;
            return;
        }
        
        // ammo_stackが空の場合は発射できない
        if (currentAmmoStack.length === 0) {
            isFiring = false;
            return;
        }
    }
    
    const now = Date.now();
    
    // 発射レートの制限
    if (GAME_CONFIG.fireRate) {
        const minInterval = 60000 / GAME_CONFIG.fireRate; // 1分あたりの発射数から1発あたりの最小間隔を計算
        if (now - lastFireTime < minInterval) {
            // フルオートモードの場合、次の発射をスケジュール
            if (GAME_CONFIG.currentFireMode === 'full' && isFiring) {
                const remainingTime = minInterval - (now - lastFireTime);
                setTimeout(() => {
                    if (isFiring && GAME_CONFIG.ammo > 0) {
                        fireWeapon();
                    }
                }, remainingTime);
            }
            return;
        }
    }
    
    // セミオートモードの場合、連続発射を防ぐ
    if (GAME_CONFIG.currentFireMode === 'semi' && isFiring) {
        return;
    }
    
    if (weaponOperationBlocked()) {
        isFiring = false;
        return;
    }
    
    const misfireChance = getWeaponMisfireChance(GAME_CONFIG.weaponDurability);
    if (misfireChance > 0 && Math.random() < misfireChance) {
        triggerWeaponMalfunction();
        isFiring = false;
        return;
    }
    
    // 発射処理
    isFiring = true;
    lastFireTime = now;
    
    // 武器発射の音を生成
    if (GAME_CONFIG.weapon && SOUND_DISTANCES[GAME_CONFIG.weapon]) {
        createSound(GAME_CONFIG.weapon, SOUND_DISTANCES[GAME_CONFIG.weapon]);
    }
    
    // ロケットランチャーと散弾銃の場合は特別な処理
    if (isRocketLauncher) {
        // ロケットランチャーの処理は後で行う
    } else if (isShotgun) {
        // 散弾銃の処理
        let currentAmmoType = null;
        let ammoData = null;
        
        // ammo_stackから1発取り出す
        if (currentAmmoStack.length > 0) {
            const topAmmo = currentAmmoStack[0];
            if (topAmmo && topAmmo.count > 0) {
                currentAmmoType = topAmmo.type;
                ammoData = INVENTORY_AMMO_DATA[currentAmmoType] || AMMO_DATA[currentAmmoType];
                
                topAmmo.count--;
                GAME_CONFIG.ammo--;
                
                // スタックが空になったら削除
                if (topAmmo.count <= 0) {
                    currentAmmoStack.shift();
                }
                
                // 散弾発射処理（8つの弾丸を同時発射）
                if (ammoData && ammoData.isBuckshot && ammoData.pelletCount) {
                    fireShotgunPellets(ammoData, weaponData);
                }
                
                // 武器に装填されている弾薬アイテムの数量を更新（非同期で保存）
                updateShotgunLoadedAmmo();
                
                // UIを更新
                updateAmmoUI();
                
                // 反動を適用
                if (weaponData && ammoData) {
                    const specialEffects = parseSpecialEffects(ammoData.special);
                    let verticalRecoil = weaponData.verticalRecoil || 0;
                    let horizontalRecoil = weaponData.horizontalRecoil || 0;
                    
                    if (specialEffects.recoilModifier !== 0) {
                        verticalRecoil *= (1 + specialEffects.recoilModifier);
                        horizontalRecoil *= (1 + specialEffects.recoilModifier);
                    }
                    
                    const recoilScale = 0.0005;
                    recoilState.vertical += verticalRecoil * recoilScale;
                    recoilState.horizontal += (Math.random() - 0.5) * 2 * horizontalRecoil * recoilScale;
                }
                
                isFiring = false;
                return;
            } else {
                isFiring = false;
                return;
            }
        } else {
            isFiring = false;
            return;
        }
    } else {
        // 通常の武器の弾薬処理
    // 現在発射する弾薬の情報を取得
    let currentAmmoType = null;
    let ammoData = null;
    
    // ammo_stackから1発取り出す（LIFO: 最後に込めた弾が最初に発射される）
    if (currentAmmoStack.length > 0) {
        const topAmmo = currentAmmoStack[0];
        if (topAmmo && topAmmo.count > 0) {
            currentAmmoType = topAmmo.type;
            ammoData = INVENTORY_AMMO_DATA[currentAmmoType] || AMMO_DATA[currentAmmoType];
            
            topAmmo.count--;
            GAME_CONFIG.ammo--;
            
            // スタックが空になったら削除
            if (topAmmo.count <= 0) {
                currentAmmoStack.shift();
            }
            
            // マガジンの残弾数を更新（データベースには保存しない）
            if (currentMagazine) {
                currentMagazine.quantity = GAME_CONFIG.ammo;
                // ammo_stackも更新
                currentMagazine.ammo_stack = JSON.parse(JSON.stringify(currentAmmoStack));
                
                // inventoryItems内の対応するマガジンも更新
                const inventoryMagazine = inventoryItems.find(mag => 
                    mag.id === currentMagazine.id ||
                    (mag.item_type === 'magazine' && 
                     mag.parent_item_id === currentMagazine.parent_item_id &&
                     mag.grid_x === null && 
                     mag.grid_y === null &&
                     mag.item_name === currentMagazine.item_name)
                );
                if (inventoryMagazine) {
                    inventoryMagazine.quantity = GAME_CONFIG.ammo;
                    inventoryMagazine.ammo_stack = JSON.parse(JSON.stringify(currentAmmoStack));
                }
                
                // 武器詳細モーダルが開いている場合はアタッチメント欄を更新
                const modal = document.getElementById('inventoryItemDetailModal');
                if (modal && !modal.classList.contains('hidden')) {
                    const weaponTitle = document.getElementById('inventoryDetailTitle');
                    if (weaponTitle && weaponTitle.textContent) {
                        // 武器名と装備スロットで武器を検索
                        const weaponSlot = weaponTitle.dataset.weaponSlot;
                        const weaponItem = inventoryItems.find(i => 
                            i.item_name === weaponTitle.textContent && 
                            i.item_type === 'weapon' &&
                            (weaponSlot ? i.equipped_slot === weaponSlot : (i.equipped_slot === 'primary' || i.equipped_slot === 'secondary'))
                        );
                        if (weaponItem) {
                            renderWeaponAttachments(weaponItem);
                        }
                    }
                }
            }
            
            // 発射直後フラグを設定（checkAndUpdateLoadedMagazineで上書きされないようにする）
            lastFireAmmoUpdate = now;
            
            // UIを更新
            updateAmmoUI();
            
            // 反動と精度の計算
            const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
            if (weaponData && ammoData) {
                // 特殊効果から反動と精度の変動を取得
                const specialEffects = parseSpecialEffects(ammoData.special);
                
                // 武器の基礎反動値に弾薬の変動を適用
                let verticalRecoil = weaponData.verticalRecoil || 0;
                let horizontalRecoil = weaponData.horizontalRecoil || 0;
                
                if (specialEffects.recoilModifier !== 0) {
                    verticalRecoil *= (1 + specialEffects.recoilModifier);
                    horizontalRecoil *= (1 + specialEffects.recoilModifier);
                }
                
                // 反動を適用（ラジアンに変換、スケーリング）
                // 反動値はEFTの値に基づいて、適切なラジアン値に変換
                const recoilScale = 0.0005; // 反動値からラジアンへの変換スケール
                recoilState.vertical += verticalRecoil * recoilScale;
                recoilState.horizontal += (Math.random() - 0.5) * 2 * horizontalRecoil * recoilScale;
            }
        } else {
            // ammo_stackが空の場合は発射できない
            isFiring = false;
            return;
        }
    } else {
        // ammo_stackが空の場合は発射できない
        isFiring = false;
        return;
    }
    }
    
    // ロケットランチャーの場合の処理
    if (isRocketLauncher && camera) {
        // レイキャスターを設定（ロケットランチャーは精度1MOAなのでずれは最小限）
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        raycaster.far = Infinity; // 射程無限
        
        // 障害物を追加（地面や壁など）
        const intersectableObjects = [];
        obstacles.forEach(obstacle => {
            if (obstacle.mesh) {
                intersectableObjects.push(obstacle.mesh);
            }
        });
        
        // レイキャストを実行して爆発位置を決定
        const intersects = raycaster.intersectObjects(intersectableObjects);
        let explosionPoint = null;
        
        if (intersects.length > 0) {
            explosionPoint = intersects[0].point;
        } else {
            // 何も当たらなかった場合、カメラの前方に一定距離で爆発
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            explosionPoint = camera.position.clone().add(direction.multiplyScalar(100));
        }
        
        console.log('ロケットランチャー発射:', explosionPoint);
        
        // プレイヤーの位置から少し前に発射
        const playerPos = getPlayerPositionVector();
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const startPoint = playerPos.clone().add(direction.multiplyScalar(1)); // プレイヤーの少し前から発射
        
        // ロケット弾と煙の軌道を作成
        const travelDistance = startPoint.distanceTo(explosionPoint);
        const travelTime = (travelDistance / weaponData.projectileSpeed) * 1000; // ミリ秒
        
        createRocketProjectile(startPoint, explosionPoint, travelTime, weaponData);
        
        // 使い捨て武器の場合、インベントリから削除
        if (weaponData.isDisposable) {
            const weaponItem = inventoryItems.find(item => 
                item.item_type === 'weapon' && 
                item.item_name === GAME_CONFIG.weapon &&
                (item.equipped_slot === GAME_CONFIG.currentWeaponSlot || item.equipped_slot === 'primary' || item.equipped_slot === 'secondary')
            );
            if (weaponItem) {
                removeInventoryItemAndChildren(weaponItem);
                saveInventoryItems();
                renderInventoryItems();
                
                // 武器を未装備にする
                GAME_CONFIG.weapon = '未装備';
                GAME_CONFIG.currentWeaponSlot = null;
                GAME_CONFIG.fireRate = 0;
                GAME_CONFIG.ammo = 0;
                currentMagazine = null;
                currentAmmoStack = [];
                updateAmmoUI();
                
                // 装備アイテムを再読み込み
                loadEquippedItems();
            }
        }
        
        isFiring = false;
        return;
    }
    
    // 通常の武器のレイキャスト処理
    if (ammoData && camera) {
        // 武器データと精度を取得
        const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
        let moa = weaponData ? (weaponData.moa || 3.0) : 3.0; // デフォルトは3.0 MOA
        
        // 弾薬の特殊効果から精度の変動を取得
        if (ammoData.special) {
            const specialEffects = parseSpecialEffects(ammoData.special);
            if (specialEffects.accuracyModifier !== 0) {
                moa *= (1 - specialEffects.accuracyModifier); // 精度が高いほどMOAは小さくなる
            }
        }
        
        // MOAをラジアンに変換（100mでのMOAを基準に）
        // 1 MOA ≈ 0.000290888 rad (100mでの1 MOA)
        const moaToRadians = 0.000290888;
        const spreadMultiplier = getWeaponSpreadMultiplier(GAME_CONFIG.weaponDurability);
        const spreadRadians = moa * moaToRadians * spreadMultiplier;
        
        // ランダムな方向にずらす（円形分布）
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * spreadRadians;
        const offsetX = Math.cos(angle) * radius;
        const offsetY = Math.sin(angle) * radius;
        
        // レイキャスターを設定（精度に基づいてずらす）
        raycaster.setFromCamera(new THREE.Vector2(offsetX, offsetY), camera);
        raycaster.far = 1000; // 最大距離
        
        // 衝突対象を収集（敵、的、障害物）
        const intersectableObjects = [];
        const objectMap = new Map(); // オブジェクトとメタデータのマッピング
        
        // 敵の各部位を追加
        enemies.forEach(enemy => {
            if (!enemy.isDead) {
                enemy.group.children.forEach(child => {
                    if (child.type === 'Mesh') {
                        intersectableObjects.push(child);
                        objectMap.set(child, { enemy: enemy, type: 'enemy' });
                    }
                });
            }
        });
        
        // ゾンビの各部位を追加
        zombies.forEach(zombie => {
            if (!zombie.isDead) {
                zombie.group.children.forEach(child => {
                    if (child.type === 'Mesh') {
                        intersectableObjects.push(child);
                        objectMap.set(child, { zombie: zombie, type: 'zombie' });
                    }
                });
            }
        });
        
        // ボスゾンビを追加
        if (bossZombie && !bossZombie.isDead) {
            bossZombie.group.children.forEach(child => {
                if (child.type === 'Mesh') {
                    intersectableObjects.push(child);
                    objectMap.set(child, { zombie: bossZombie, type: 'zombie' });
                }
            });
        }
        
        // 的を追加
        targets.forEach(target => {
            target.group.children.forEach(child => {
                if (child.type === 'Mesh') {
                    intersectableObjects.push(child);
                    objectMap.set(child, { target: target, type: 'target' });
                }
            });
        });
        
        // 障害物を追加（個別メッシュを持つ場合のみ）
        obstacles.forEach(obstacle => {
            if (!obstacle.mesh) return;
            intersectableObjects.push(obstacle.mesh);
            objectMap.set(obstacle.mesh, { type: 'obstacle' });
        });
        
        // レイキャストを実行
        const intersects = raycaster.intersectObjects(intersectableObjects);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            const hitMetadata = objectMap.get(hit.object);
            
            if (hitMetadata) {
                if (hitMetadata.type === 'enemy') {
                    // 敵に当たった場合
                    const enemy = hitMetadata.enemy;
                    // 当たった部位を判定（簡易的にランダム）
                    const bodyParts = Object.keys(enemy.bodyParts);
                    const hitBodyPart = bodyParts[Math.floor(Math.random() * bodyParts.length)];
                    
                    // ダメージを与える
                    damageEnemy(enemy, ammoData.damage || 50, hitBodyPart);
                    console.log(`敵に命中: ${currentAmmoType} (ダメージ: ${ammoData.damage})`);
                } else if (hitMetadata.type === 'zombie') {
                    // ゾンビに当たった場合
                    const zombie = hitMetadata.zombie;
                    if (!zombie || zombie.isDead) return;
                    
                    // 当たった部位を判定
                    const hitBodyPart = getZombieBodyPartFromHit(hit.object, hit.point, zombie);
                    if (!hitBodyPart) return;
                    
                    // ダメージを計算（腕が壊死している場合はダメージを下げる）
                    let damage = ammoData.damage || 50;
                    if (zombie.blackedOut.includes('leftArm')) {
                        damage = Math.max(0, damage - 2);
                    }
                    if (zombie.blackedOut.includes('rightArm')) {
                        damage = Math.max(0, damage - 2);
                    }
                    
                    // ダメージを与える（貫通力も渡す）
                    const penetration = ammoData.penetration || 0;
                    damageZombie(zombie, damage, hitBodyPart, penetration);
                    
                    console.log(`ゾンビに命中: ${currentAmmoType} (部位: ${hitBodyPart}, ダメージ: ${damage}, 貫通: ${penetration})`);
                } else if (hitMetadata.type === 'target') {
                    // 的に当たった場合
                    const target = hitMetadata.target;
                    target.hitInfo = {
                        ammoType: currentAmmoType,
                        caliber: ammoData.caliber || currentAmmoType.split(' ')[0],
                        damage: ammoData.damage || 0,
                        penetration: ammoData.penetration || 0
                    };
                    target.hitTime = now;
                    
                    // 命中位置に印をつける（hitオブジェクト全体を渡す）
                    addHitMark(target, hit);
                    
                    // 的の情報を表示
                    showTargetHitInfo(target.hitInfo);
                    console.log(`的に命中: ${currentAmmoType} (ダメージ: ${ammoData.damage}, 貫通: ${ammoData.penetration})`);
                }
            }
        }
    }
    
    applyWeaponDurabilityWear('fire');
    
    // フルオートモードの場合、マウスが押されている間は連続発射
    if (GAME_CONFIG.currentFireMode === 'full' && isFiring) {
        // 次の発射をスケジュール（発射レートに基づく）
        if (GAME_CONFIG.fireRate && GAME_CONFIG.ammo > 0) {
            const interval = 60000 / GAME_CONFIG.fireRate;
            setTimeout(() => {
                if (isFiring && GAME_CONFIG.ammo > 0) {
                    fireWeapon();
                }
            }, interval);
        } else {
            // 弾薬がない場合は発射を停止
            isFiring = false;
        }
    }
}

// 命中位置に印をつける
function addHitMark(target, hit) {
    if (!target || !target.group || !target.board || !hit) return;
    
    // hit.pointはワールド座標での命中位置
    // 的の板のメッシュのローカル座標に変換
    const localPoint = new THREE.Vector3();
    localPoint.copy(hit.point);
    target.board.worldToLocal(localPoint);
    
    // 的の板はrotation.x = Math.PI / 2で横に配置されている
    // つまり、CylinderGeometryが横になっているので、Y軸が法線方向
    // ローカル座標では、XZ平面が的の板の表面
    // 的の板の中心は(0, 0, 0)で、半径1.0、厚み0.1
    
    // 的の板の表面に配置（Y座標を板の表面に合わせる）
    // 板の厚みは0.1で、中心がY=0なので、表面はY=0.05
    const markPosition = new THREE.Vector3(localPoint.x, 0.05, localPoint.z);
    
    // 命中位置が的の範囲内かチェック（半径1.0以内）
    const distanceFromCenter = Math.sqrt(markPosition.x * markPosition.x + markPosition.z * markPosition.z);
    if (distanceFromCenter > 1.0) return; // 的の範囲外
    
    // 命中位置の印を作成（小さな黒い円）
    const markGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.02, 8);
    const markMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const mark = new THREE.Mesh(markGeometry, markMaterial);
    mark.rotation.x = Math.PI / 2; // 的の板と同じ向き
    
    // 的の板のメッシュのローカル座標で位置を設定
    mark.position.copy(markPosition);
    
    // 的の板に直接追加（的のグループではなく、的の板の子として追加）
    target.board.add(mark);
    
    // hitMarks配列に追加
    target.hitMarks.push(mark);
    
    // 最大30個を超えたら古いものから削除
    if (target.hitMarks.length > 30) {
        const oldMark = target.hitMarks.shift(); // 最初の要素を取得して削除
        if (oldMark && oldMark.parent) {
            oldMark.parent.remove(oldMark);
            oldMark.geometry.dispose();
            oldMark.material.dispose();
        }
    }
}

// 的の命中情報を表示
function showTargetHitInfo(hitInfo) {
    const targetInfo = document.getElementById('targetInfo');
    const targetAmmoType = document.getElementById('targetAmmoType');
    const targetCaliber = document.getElementById('targetCaliber');
    const targetDamage = document.getElementById('targetDamage');
    const targetPenetration = document.getElementById('targetPenetration');
    
    if (!targetInfo || !targetAmmoType || !targetCaliber || !targetDamage || !targetPenetration) {
        return;
    }
    
    // 情報を表示
    targetAmmoType.textContent = hitInfo.ammoType || '-';
    targetCaliber.textContent = hitInfo.caliber || '-';
    targetDamage.textContent = hitInfo.damage || '-';
    targetPenetration.textContent = hitInfo.penetration || '-';
    
    // 表示
    targetInfo.classList.remove('hidden');
    
    // 3秒後に非表示
    setTimeout(() => {
        if (targetInfo) {
            targetInfo.classList.add('hidden');
        }
    }, 3000);
}


// 初期マガジンを装填
// 散弾銃の直接装填処理
async function loadShotgunAmmo() {
    const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
    if (!weaponData || !weaponData.isShotgun) {
        GAME_CONFIG.ammo = 0;
        GAME_CONFIG.magazineCapacity = 0;
        currentMagazine = null;
        currentAmmoStack = [];
        updateAmmoUI();
        return;
    }
    
    // 武器に直接装填された弾薬を取得
    try {
        const response = await fetch('/api/character/items');
        const data = await response.json();
        if (data.success && data.items) {
            let weapon = null;
            if (GAME_CONFIG.currentWeaponSlot) {
                weapon = data.items.find(item => 
                    item.equipped_slot === GAME_CONFIG.currentWeaponSlot && 
                    item.item_type === 'weapon'
                );
            } else {
                weapon = data.items.find(item => 
                    (item.equipped_slot === 'primary' || item.equipped_slot === 'secondary') &&
                    item.item_type === 'weapon'
                );
            }
            
            if (weapon) {
                // 武器に直接装填された弾薬を探す（parent_item_idが武器のIDで、grid_x/grid_yがnull）
                const loadedAmmo = data.items.find(item => 
                    item.item_type === 'ammo' &&
                    item.parent_item_id === weapon.id &&
                    (item.grid_x === null || item.grid_x === undefined) &&
                    (item.grid_y === null || item.grid_y === undefined)
                );
                
                if (loadedAmmo) {
                    // ammo_stackを取得（文字列の場合はパース、配列の場合はそのまま使用）
                    if (loadedAmmo.ammo_stack) {
                        if (Array.isArray(loadedAmmo.ammo_stack)) {
                            currentAmmoStack = JSON.parse(JSON.stringify(loadedAmmo.ammo_stack));
                        } else if (typeof loadedAmmo.ammo_stack === 'string') {
                            try {
                                currentAmmoStack = JSON.parse(loadedAmmo.ammo_stack);
                            } catch (e) {
                                console.error('ammo_stackのパースに失敗しました:', e);
                                currentAmmoStack = [];
                            }
                        } else {
                            currentAmmoStack = [];
                        }
                    } else {
                        currentAmmoStack = [];
                    }
                    GAME_CONFIG.ammo = loadedAmmo.quantity || 0;
                } else {
                    currentAmmoStack = [];
                    GAME_CONFIG.ammo = 0;
                }
                
                GAME_CONFIG.magazineCapacity = weaponData.magazineCapacity || 0;
                currentMagazine = null; // 散弾銃はマガジンを使用しない
                updateAmmoUI();
                return;
            }
        }
    } catch (error) {
        console.error('散弾銃の弾薬読み込みに失敗しました:', error);
    }
    
    // エラー時は空にする
    GAME_CONFIG.ammo = 0;
    GAME_CONFIG.magazineCapacity = weaponData.magazineCapacity || 0;
    currentMagazine = null;
    currentAmmoStack = [];
    updateAmmoUI();
}

// 散弾銃に装填されている弾薬アイテムの数量を更新（非同期）
async function updateShotgunLoadedAmmo() {
    const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
    if (!weaponData || !weaponData.isShotgun) {
        return;
    }
    
    try {
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (!data.success || !data.items) {
            return;
        }
        
        // 現在装備している武器を取得
        let weapon = null;
        if (GAME_CONFIG.currentWeaponSlot) {
            weapon = data.items.find(item => 
                item.equipped_slot === GAME_CONFIG.currentWeaponSlot && 
                item.item_type === 'weapon'
            );
        } else {
            weapon = data.items.find(item => 
                (item.equipped_slot === 'primary' || item.equipped_slot === 'secondary') &&
                item.item_type === 'weapon'
            );
        }
        
        if (!weapon) {
            return;
        }
        
        // 武器に直接装填された弾薬を探す
        const loadedAmmo = data.items.find(item => 
            item.item_type === 'ammo' &&
            item.parent_item_id === weapon.id &&
            (item.grid_x === null || item.grid_x === undefined) &&
            (item.grid_y === null || item.grid_y === undefined)
        );
        
        if (loadedAmmo) {
            // 数量とammo_stackを更新
            loadedAmmo.quantity = GAME_CONFIG.ammo || 0;
            loadedAmmo.ammo_stack = currentAmmoStack.length > 0 ? JSON.stringify(currentAmmoStack) : null;
            
            // 数量が0になったら削除
            if (loadedAmmo.quantity <= 0) {
                const index = data.items.indexOf(loadedAmmo);
                if (index > -1) {
                    data.items.splice(index, 1);
                }
            }
            
            // アイテムを保存
            const itemsToSave = data.items.map(item => ({
                id: item.id,
                item_type: item.item_type,
                item_name: item.item_name,
                grid_x: item.grid_x,
                grid_y: item.grid_y,
                width: item.width,
                height: item.height,
                equipped_slot: item.equipped_slot,
                quantity: item.quantity,
                parent_item_id: item.parent_item_id || null,
                ammo_stack: item.ammo_stack ? (typeof item.ammo_stack === 'string' ? item.ammo_stack : JSON.stringify(item.ammo_stack)) : null,
                weapon_durability: item.weapon_durability !== undefined ? item.weapon_durability : null
            }));
            
            await fetch('/api/character/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ items: itemsToSave })
            });
        }
    } catch (error) {
        console.error('散弾銃の弾薬更新に失敗しました:', error);
    }
}

// 散弾銃のリロード処理
async function reloadShotgun() {
    if (weaponOperationBlocked()) {
        return;
    }
    
    const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
    if (!weaponData || !weaponData.isShotgun) {
        return;
    }
    
    const ammoType = weaponData.ammoType; // '12x70mm'
    const maxCapacity = weaponData.magazineCapacity || 0;
    
    try {
        // 現在のアイテムを取得
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (!data.success || !data.items) {
            return;
        }
        
        // 現在装備している武器を取得
        let weapon = null;
        if (GAME_CONFIG.currentWeaponSlot) {
            weapon = data.items.find(item => 
                item.equipped_slot === GAME_CONFIG.currentWeaponSlot && 
                item.item_type === 'weapon'
            );
        } else {
            weapon = data.items.find(item => 
                (item.equipped_slot === 'primary' || item.equipped_slot === 'secondary') &&
                item.item_type === 'weapon'
            );
        }
        
        if (!weapon) {
            return;
        }
        
        // 現在装填されている弾薬を取得
        let currentLoadedAmmo = data.items.find(item => 
            item.item_type === 'ammo' &&
            item.parent_item_id === weapon.id &&
            (item.grid_x === null || item.grid_x === undefined) &&
            (item.grid_y === null || item.grid_y === undefined)
        );
        
        // 現在の装填数を取得（ゲーム中の状態も考慮）
        let currentAmmoCount = 0;
        if (currentLoadedAmmo) {
            currentAmmoCount = currentLoadedAmmo.quantity || 0;
        } else {
            // ゲーム中の状態から取得
            currentAmmoCount = GAME_CONFIG.ammo || 0;
        }
        
        // 数量が0の弾薬アイテムは削除
        if (currentLoadedAmmo && currentAmmoCount <= 0) {
            const index = data.items.indexOf(currentLoadedAmmo);
            if (index > -1) {
                data.items.splice(index, 1);
            }
            currentLoadedAmmo = null;
        }
        
        const neededAmmo = maxCapacity - currentAmmoCount;
        
        if (neededAmmo <= 0) {
            return; // 既に満タン
        }
        
        // リグとバックパックから対応する弾薬を探す
        const rig = data.items.find(item => item.equipped_slot === 'rig');
        const backpack = data.items.find(item => item.equipped_slot === 'backpack');
        
        let availableAmmo = [];
        
        // リグから弾薬を探す
        if (rig) {
            const rigItems = data.items.filter(item => item.parent_item_id === rig.id);
            rigItems.forEach(item => {
                if (item.item_type === 'ammo' && item.item_name && item.item_name.startsWith(ammoType)) {
                    const quantity = item.quantity || 0;
                    if (quantity > 0) {
                        availableAmmo.push({ item: item, source: 'rig', quantity: quantity });
                    }
                }
            });
        }
        
        // バックパックから弾薬を探す
        if (backpack) {
            const backpackItems = data.items.filter(item => item.parent_item_id === backpack.id);
            backpackItems.forEach(item => {
                if (item.item_type === 'ammo' && item.item_name && item.item_name.startsWith(ammoType)) {
                    const quantity = item.quantity || 0;
                    if (quantity > 0) {
                        availableAmmo.push({ item: item, source: 'backpack', quantity: quantity });
                    }
                }
            });
        }
        
        if (availableAmmo.length === 0) {
            return; // 利用可能な弾薬がない
        }
        
        // 弾薬を取得（最初に見つかったものから）
        let totalLoaded = 0;
        const ammoToLoad = Math.min(neededAmmo, availableAmmo.reduce((sum, a) => sum + a.quantity, 0));
        
        // 現在装填されている弾薬のammo_stackを取得
        let loadedAmmoStack = [];
        if (currentLoadedAmmo && currentLoadedAmmo.ammo_stack) {
            if (Array.isArray(currentLoadedAmmo.ammo_stack)) {
                loadedAmmoStack = JSON.parse(JSON.stringify(currentLoadedAmmo.ammo_stack));
            } else if (typeof currentLoadedAmmo.ammo_stack === 'string') {
                loadedAmmoStack = JSON.parse(currentLoadedAmmo.ammo_stack);
            }
        }
        
        // ゲーム中の現在の弾薬スタックを反映（グローバル変数のcurrentAmmoStackを使用）
        if (loadedAmmoStack.length === 0 && currentAmmoCount > 0 && currentAmmoStack.length > 0) {
            loadedAmmoStack = JSON.parse(JSON.stringify(currentAmmoStack));
        }
        
        // 利用可能な弾薬から装填
        for (const ammoSource of availableAmmo) {
            if (totalLoaded >= ammoToLoad) break;
            
            const ammoItem = ammoSource.item;
            const available = ammoItem.quantity || 0;
            if (available <= 0) continue;
            
            const loadAmount = Math.min(ammoToLoad - totalLoaded, available);
            
            // ammo_stackから取得
            let ammoStack = [];
            if (ammoItem.ammo_stack) {
                if (Array.isArray(ammoItem.ammo_stack)) {
                    ammoStack = JSON.parse(JSON.stringify(ammoItem.ammo_stack));
                } else if (typeof ammoItem.ammo_stack === 'string') {
                    ammoStack = JSON.parse(ammoItem.ammo_stack);
                }
            }
            
            // スタックから取り出す（LIFO: 最後に追加されたものから）
            let loadedFromStack = 0;
            while (loadedFromStack < loadAmount && ammoStack.length > 0) {
                const topStack = ammoStack[ammoStack.length - 1];
                if (topStack && topStack.count > 0) {
                    const take = Math.min(loadAmount - loadedFromStack, topStack.count);
                    topStack.count -= take;
                    loadedFromStack += take;
                    
                    // 現在装填されている弾薬のスタックに追加
                    if (loadedAmmoStack.length > 0 && loadedAmmoStack[loadedAmmoStack.length - 1].type === topStack.type) {
                        loadedAmmoStack[loadedAmmoStack.length - 1].count += take;
                    } else {
                        loadedAmmoStack.push({ type: topStack.type, count: take });
                    }
                    
                    if (topStack.count <= 0) {
                        ammoStack.pop();
                    }
                } else {
                    ammoStack.pop();
                }
            }
            
            // スタックが空で、まだ必要な場合は残りから取得
            if (loadedFromStack < loadAmount && available > loadedFromStack) {
                const remaining = loadAmount - loadedFromStack;
                const defaultAmmoType = ammoItem.item_name;
                if (loadedAmmoStack.length > 0 && loadedAmmoStack[loadedAmmoStack.length - 1].type === defaultAmmoType) {
                    loadedAmmoStack[loadedAmmoStack.length - 1].count += remaining;
                } else {
                    loadedAmmoStack.push({ type: defaultAmmoType, count: remaining });
                }
                loadedFromStack += remaining;
            }
            
            // アイテムの数量とスタックを更新
            ammoItem.quantity = available - loadedFromStack;
            ammoItem.ammo_stack = ammoStack.length > 0 ? JSON.stringify(ammoStack) : null;
            
            // 数量が0になったら削除
            if (ammoItem.quantity <= 0) {
                const index = data.items.indexOf(ammoItem);
                if (index > -1) {
                    data.items.splice(index, 1);
                }
            }
            
            totalLoaded += loadedFromStack;
        }
        
        // 武器に装填された弾薬を更新または作成
        if (currentLoadedAmmo) {
            currentLoadedAmmo.quantity = currentAmmoCount + totalLoaded;
            currentLoadedAmmo.ammo_stack = loadedAmmoStack.length > 0 ? JSON.stringify(loadedAmmoStack) : null;
        } else {
            // 新しい弾薬アイテムを作成
            const newAmmoItem = {
                item_type: 'ammo',
                item_name: availableAmmo[0].item.item_name,
                grid_x: null,
                grid_y: null,
                width: 1,
                height: 1,
                quantity: totalLoaded,
                equipped_slot: null,
                parent_item_id: weapon.id,
                ammo_stack: loadedAmmoStack.length > 0 ? JSON.stringify(loadedAmmoStack) : null
            };
            data.items.push(newAmmoItem);
        }
        
        // 武器の耐久値を減らす
        applyWeaponDurabilityWear('reload');
        if (weapon) {
            weapon.weapon_durability = GAME_CONFIG.weaponDurability;
        }
        
        // アイテムを保存
        const itemsToSave = data.items.map(item => ({
            id: item.id,
            item_type: item.item_type,
            item_name: item.item_name,
            grid_x: item.grid_x,
            grid_y: item.grid_y,
            width: item.width,
            height: item.height,
            equipped_slot: item.equipped_slot,
            quantity: item.quantity,
            parent_item_id: item.parent_item_id || null,
            ammo_stack: item.ammo_stack ? (typeof item.ammo_stack === 'string' ? item.ammo_stack : JSON.stringify(item.ammo_stack)) : null,
            weapon_durability: item.weapon_durability !== undefined ? item.weapon_durability : null
        }));
        
        const saveResponse = await fetch('/api/character/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items: itemsToSave })
        });
        
        const saveData = await saveResponse.json();
        if (saveData.success) {
            // インベントリアイテムを更新
            await loadInventoryItems();
            // 散弾銃の弾薬を再読み込み
            await loadShotgunAmmo();
        }
    } catch (error) {
        console.error('散弾銃のリロード処理に失敗しました:', error);
    }
}

async function loadInitialMagazine() {
    // リグから対応するマガジンを取得（武器に装填されたマガジンも含む）
    const availableMagazines = await getMagazinesFromRig();
    
    if (availableMagazines.length === 0) {
        GAME_CONFIG.ammo = 0;
        GAME_CONFIG.magazineCapacity = 0;
        currentMagazine = null;
        currentAmmoStack = [];
        updateAmmoUI();
        return;
    }
    
    // 武器に装填されたマガジンを優先的に選択
    // APIから武器を取得（現在使用中の武器スロットの武器を取得）
    let weapon = null;
    try {
        const response = await fetch('/api/character/items');
        const data = await response.json();
        if (data.success && data.items) {
            if (GAME_CONFIG.currentWeaponSlot) {
                // 現在使用中の武器スロットの武器を取得
                weapon = data.items.find(item => 
                    item.equipped_slot === GAME_CONFIG.currentWeaponSlot && 
                    item.item_type === 'weapon'
                );
            } else {
                // 武器スロットが設定されていない場合はprimaryまたはsecondaryを取得
                weapon = data.items.find(item => 
                    (item.equipped_slot === 'primary' || item.equipped_slot === 'secondary') &&
                    item.item_type === 'weapon'
                );
            }
        }
    } catch (error) {
        console.error('武器の取得に失敗しました:', error);
    }
    
    let selectedMagazine = null;
    
    if (weapon) {
        // 武器に装填されたマガジンを探す
        selectedMagazine = availableMagazines.find(mag => 
            mag.parent_item_id === weapon.id && 
            (mag.grid_x === null || mag.grid_x === undefined) && 
            (mag.grid_y === null || mag.grid_y === undefined)
        );
    }
    
    // 武器に装填されたマガジンがない場合は、残弾が多いものから優先的に使用
    if (!selectedMagazine) {
        availableMagazines.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
        selectedMagazine = availableMagazines[0];
    }
    const magazineData = MAGAZINE_DATA[selectedMagazine.item_name];
    const ammoInMagazine = selectedMagazine.quantity || 0;
    
    // マガジンのammo_stackを読み込む
    if (selectedMagazine.ammo_stack && Array.isArray(selectedMagazine.ammo_stack) && selectedMagazine.ammo_stack.length > 0) {
        currentAmmoStack = JSON.parse(JSON.stringify(selectedMagazine.ammo_stack)); // ディープコピー
    } else {
        // ammo_stackがない場合は、quantityから逆算して作成
        currentAmmoStack = [];
        if (ammoInMagazine > 0) {
            // デフォルトの弾薬タイプを使用
            const defaultAmmo = GAME_CONFIG.ammoType || '5.56x45mm FMJ';
            currentAmmoStack.push({ type: defaultAmmo, count: ammoInMagazine });
        }
    }
    
    GAME_CONFIG.ammo = ammoInMagazine;
    GAME_CONFIG.magazineCapacity = magazineData?.capacity || 0;
    
    // 現在のマガジンを設定（残弾数は保持したまま）
    currentMagazine = selectedMagazine;
    
    updateAmmoUI();
}

// 武器をリロードする処理
async function reloadWeapon() {
    // 武器未装備の場合は何もしない
    if (GAME_CONFIG.weapon === '未装備') {
        return;
    }
    
    // 武器データを取得
    const weaponData = WEAPON_DATA[GAME_CONFIG.weapon];
    const isShotgun = weaponData && weaponData.isShotgun;
    
    // 散弾銃の場合は特別な処理
    if (isShotgun) {
        await reloadShotgun();
        return;
    }
    
    // 通常の武器の場合、マガジンが対応していない場合は何もしない
    if (!GAME_CONFIG.compatibleMagazines || GAME_CONFIG.compatibleMagazines.length === 0) {
        return;
    }
    
    if (weaponOperationBlocked()) {
        return;
    }
    
    try {
        // 現在のアイテムを取得
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (!data.success || !data.items) {
            return;
        }
        
        // 現在装備している武器を取得（現在使用中の武器スロットの武器を取得）
        let weapon = null;
        if (GAME_CONFIG.currentWeaponSlot) {
            weapon = data.items.find(item => 
                item.equipped_slot === GAME_CONFIG.currentWeaponSlot && 
                item.item_type === 'weapon'
            );
        } else {
            // 武器スロットが設定されていない場合はprimaryまたはsecondaryを取得
            weapon = data.items.find(item => 
                (item.equipped_slot === 'primary' || item.equipped_slot === 'secondary') &&
                item.item_type === 'weapon'
            );
        }
        
        if (!weapon) {
            return;
        }
        
        // 現在のマガジンを取得
        const currentMag = data.items.find(item => 
            item.item_type === 'magazine' && 
            item.parent_item_id === weapon.id &&
            (item.grid_x === null || item.grid_x === undefined) && 
            (item.grid_y === null || item.grid_y === undefined)
        );
        
        // リグを取得
        const rig = data.items.find(item => item.equipped_slot === 'rig');
        
        if (!rig) {
            return; // リグが装備されていない場合は何もしない
        }
        
        // 現在のマガジンのIDを記録（リグに戻した後も除外するため）
        const currentMagId = currentMag ? currentMag.id : null;
        
        let reloadPerformed = false;
        // 現在のマガジンをリグに戻す
        if (currentMag) {
            // ゲーム中の現在のマガジンの状態（発射で減った弾数）を反映
            if (currentMagazine && currentMagazine.id === currentMag.id) {
                currentMag.quantity = GAME_CONFIG.ammo || 0;
                currentMag.ammo_stack = JSON.parse(JSON.stringify(currentAmmoStack));
            }
            
            // リグ内の空きスペースを探す（簡易実装：最初に見つかった空きスペースを使用）
            const rigItems = data.items.filter(item => item.parent_item_id === rig.id);
            const rigData = INVENTORY_RIG_DATA[rig.item_name];
            
            let moved = false;
            
            if (rigData && rigData.slots) {
                // スロットベースのリグの場合
                const slotSizes = INVENTORY_RIG_SLOT_SIZES;
                for (const slotInfo of rigData.slots) {
                    const slotSize = slotSizes[slotInfo.type];
                    if (slotSize && slotSize.width >= currentMag.width && slotSize.height >= currentMag.height) {
                        // このスロットタイプで空きスロットを探す
                        const occupiedSlots = new Set();
                        rigItems.forEach(item => {
                            if (item.grid_x < 0) { // スロットIDは負の値
                                occupiedSlots.add(-item.grid_x);
                            }
                        });
                        
                        // 空きスロットを探す
                        for (let i = 1; i <= slotInfo.count; i++) {
                            if (!occupiedSlots.has(i)) {
                                currentMag.grid_x = -i;
                                currentMag.grid_y = 0;
                                currentMag.parent_item_id = rig.id;
                                moved = true;
                                break;
                            }
                        }
                        if (moved) break;
                    }
                }
            } else {
                // グリッドベースのリグの場合（簡易実装：最初の空きスペースを使用）
                const rigSize = rigData?.stashSize || { width: 4, height: 4 };
                const occupied = new Set();
                rigItems.forEach(item => {
                    if (item.grid_x >= 0 && item.grid_y >= 0) {
                        for (let y = item.grid_y; y < item.grid_y + (item.height || 1); y++) {
                            for (let x = item.grid_x; x < item.grid_x + (item.width || 1); x++) {
                                occupied.add(`${x},${y}`);
                            }
                        }
                    }
                });
                
                // 空きスペースを探す
                for (let y = 0; y <= rigSize.height - (currentMag.height || 1); y++) {
                    for (let x = 0; x <= rigSize.width - (currentMag.width || 1); x++) {
                        let canPlace = true;
                        for (let dy = 0; dy < (currentMag.height || 1); dy++) {
                            for (let dx = 0; dx < (currentMag.width || 1); dx++) {
                                if (occupied.has(`${x + dx},${y + dy}`)) {
                                    canPlace = false;
                                    break;
                                }
                            }
                            if (!canPlace) break;
                        }
                        if (canPlace) {
                            currentMag.grid_x = x;
                            currentMag.grid_y = y;
                            currentMag.parent_item_id = rig.id;
                            moved = true;
                            break;
                        }
                    }
                    if (moved) break;
                }
            }
            
            // リグにスペースがない場合は処理を中断
            if (!moved) {
                return;
            }
        }
        
        // リグ内の対応するマガジンを取得（現在のマガジンは除外）
        // 現在のマガジンをリグに戻した後、再度取得する
        const rigItemsAfterMove = data.items.filter(item => item.parent_item_id === rig.id);
        const rigMagazines = rigItemsAfterMove.filter(item => {
            if (item.item_type !== 'magazine') return false;
            if (currentMagId && item.id === currentMagId) return false; // 現在のマガジンは除外
            // 対応するマガジンかチェック
            return GAME_CONFIG.compatibleMagazines.includes(item.item_name);
        });
        
        // 残弾があるマガジンのみ
        const availableMagazines = rigMagazines.filter(mag => (mag.quantity || 0) > 0);
        
        if (availableMagazines.length === 0) {
            return; // リグに利用可能なマガジンがない
        }
        
        // 残弾が多い順にソート
        availableMagazines.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
        const newMagazine = availableMagazines[0];
        reloadPerformed = true;
        
        // 新しいマガジンを武器に装填
        newMagazine.parent_item_id = weapon.id;
        newMagazine.grid_x = null;
        newMagazine.grid_y = null;
        
        if (reloadPerformed) {
            applyWeaponDurabilityWear('reload');
            weapon.weapon_durability = GAME_CONFIG.weaponDurability;
        }
        
        // アイテムを保存
        const itemsToSave = data.items.map(item => ({
            id: item.id,
            item_type: item.item_type,
            item_name: item.item_name,
            grid_x: item.grid_x,
            grid_y: item.grid_y,
            width: item.width,
            height: item.height,
            equipped_slot: item.equipped_slot,
            quantity: item.quantity,
            parent_item_id: item.parent_item_id || null,
            ammo_stack: item.ammo_stack ? (typeof item.ammo_stack === 'string' ? item.ammo_stack : JSON.stringify(item.ammo_stack)) : null,
            weapon_durability: item.weapon_durability !== undefined ? item.weapon_durability : null
        }));
        
        const saveResponse = await fetch('/api/character/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items: itemsToSave })
        });
        
        const saveData = await saveResponse.json();
        if (saveData.success) {
            // インベントリアイテムを更新（インベントリが開いている場合に表示を更新するため）
            await loadInventoryItems();
            // ゲーム状態を更新
            await loadInitialMagazine();
        }
    } catch (error) {
        console.error('リロード処理に失敗しました:', error);
    }
}

// リグから対応するマガジンを取得（武器に装填されたマガジンも含む）
async function getMagazinesFromRig() {
    try {
        // インベントリアイテムを取得
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (!data.success || !data.items) {
            return [];
        }
        
        // リグを取得
        const rig = data.items.find(item => item.equipped_slot === 'rig');
        
        // 武器を取得（現在使用中の武器スロットの武器を取得）
        let weapon = null;
        if (GAME_CONFIG.currentWeaponSlot) {
            weapon = data.items.find(item => 
                item.equipped_slot === GAME_CONFIG.currentWeaponSlot && 
                item.item_type === 'weapon'
            );
        } else {
            // 武器スロットが設定されていない場合はprimaryまたはsecondaryを取得
            const primaryWeapon = data.items.find(item => item.equipped_slot === 'primary');
            const secondaryWeapon = data.items.find(item => item.equipped_slot === 'secondary');
            weapon = primaryWeapon || secondaryWeapon;
        }
        
        // リグ内のマガジンを取得
        let rigMagazines = [];
        if (rig) {
            const rigItems = data.items.filter(item => item.parent_item_id === rig.id);
            rigMagazines = rigItems.filter(item => {
                if (item.item_type !== 'magazine') return false;
                // 対応するマガジンかチェック
                return GAME_CONFIG.compatibleMagazines.includes(item.item_name);
            });
        }
        
        // 武器に装填されたマガジンを取得
        let weaponMagazines = [];
        if (weapon) {
            weaponMagazines = data.items.filter(item => {
                if (item.item_type !== 'magazine') return false;
                // 武器に装填されているかチェック（parent_item_idが武器のIDで、grid_xとgrid_yがnull）
                if (item.parent_item_id === weapon.id && 
                    (item.grid_x === null || item.grid_x === undefined) && 
                    (item.grid_y === null || item.grid_y === undefined)) {
                    // 対応するマガジンかチェック
                    return GAME_CONFIG.compatibleMagazines.includes(item.item_name);
                }
                return false;
            });
        }
        
        // リグと武器のマガジンを結合
        const magazines = [...rigMagazines, ...weaponMagazines];
        
        // ammo_stackをパース
        magazines.forEach(mag => {
            if (mag.ammo_stack && typeof mag.ammo_stack === 'string') {
                try {
                    mag.ammo_stack = JSON.parse(mag.ammo_stack);
                } catch (e) {
                    mag.ammo_stack = [];
                }
            } else if (!mag.ammo_stack) {
                mag.ammo_stack = [];
            }
        });
        
        // 残弾があるマガジンのみ返す
        return magazines.filter(mag => (mag.quantity || 0) > 0);
    } catch (error) {
        console.error('マガジンの取得に失敗しました:', error);
        return [];
    }
}

// ========== インベントリ機能 ==========

// インベントリDOM要素の取得（ゲーム画面用）
function getInventoryElements() {
    return {
        overlay: document.getElementById('inventoryOverlay'),
        backpackGrid: document.getElementById('inventoryBackpackGrid'),
        rigGrid: document.getElementById('inventoryRigGrid'),
        backpackPanel: document.getElementById('inventoryBackpackPanel'),
        rigPanel: document.getElementById('inventoryRigPanel'),
        gearPanel: document.getElementById('inventoryGearPanel'),
        backpackName: document.getElementById('inventoryBackpackName'),
        backpackCapacity: document.getElementById('inventoryBackpackCapacity'),
        rigName: document.getElementById('inventoryRigName'),
        rigCapacity: document.getElementById('inventoryRigCapacity'),
        itemTooltip: document.getElementById('inventoryItemTooltip'),
        itemContextMenu: document.getElementById('inventoryItemContextMenu'),
        contextDetailButton: document.getElementById('inventoryContextDetailButton'),
        contextUnloadAmmoButton: document.getElementById('inventoryContextUnloadAmmoButton'),
        contextUnloadMagazineButton: document.getElementById('inventoryContextUnloadMagazineButton'),
        contextUseButton: document.getElementById('inventoryContextUseButton'),
        contextDropButton: document.getElementById('inventoryContextDropButton'),
        itemDetailModal: document.getElementById('inventoryItemDetailModal'),
        detailTitle: document.getElementById('inventoryDetailTitle'),
        detailStats: document.getElementById('inventoryDetailStats'),
        detailCloseButton: document.getElementById('inventoryDetailCloseButton')
    };
}

// インベントリヘルパー関数
function getInventoryBackpackData(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.item_name;
    if (!name) return null;
    return INVENTORY_BACKPACK_DATA[name] || null;
}

function getInventoryBackpackContentSize(itemOrName) {
    const data = getInventoryBackpackData(itemOrName);
    return data?.contentSize || { ...INVENTORY_DEFAULT_BACKPACK_SIZE };
}

function getInventoryRigData(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.item_name;
    if (!name) return null;
    return INVENTORY_RIG_DATA[name] || null;
}

function getInventoryMagazineData(item) {
    const name = typeof item === 'string' ? item : item?.item_name;
    return name ? INVENTORY_MAGAZINE_DATA[name] || null : null;
}

function getInventoryAmmoData(item) {
    const name = typeof item === 'string' ? item : item?.item_name;
    return name ? INVENTORY_AMMO_DATA[name] || null : null;
}

function getInventoryItemIdentifier(item) {
    if (item.id !== null && item.id !== undefined) {
        return `db-${item.id}`;
    }
    if (!item.client_id) {
        item.client_id = `tmp-${Math.random().toString(36).slice(2, 11)}`;
    }
    return item.client_id;
}

function findInventoryItemByIdentifier(identifier) {
    if (!identifier) return null;
    return inventoryItems.find(item => getInventoryItemIdentifier(item) === identifier) || null;
}

function buildAmmoImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${AMMO_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildMedicalImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${MEDICAL_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildMagazineImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${MAGAZINE_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildGunImageUrl(imageFile) {
    if (!imageFile) return null;
    // special/で始まる場合は/pic/を直接使う
    if (imageFile.startsWith('special/')) {
        return `/pic/${encodeURIComponent(imageFile)}`;
    }
    return `${GUN_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildBackpackImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${BACKPACK_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildRigImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${RIG_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildFlareImageUrl(imageFile) {
    if (!imageFile) return null;
    return `/pic/item/${encodeURIComponent(imageFile)}`;
}

function buildArmorImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${ARMOR_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildHelmetImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${HELMET_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function getInventoryItemImageUrl(item) {
    if (!item) return null;
    if (item.item_type === 'ammo') {
        const ammoData = getInventoryAmmoData(item) || AMMO_DATA[item.item_name];
        if (ammoData && ammoData.imageFile) {
            return buildAmmoImageUrl(ammoData.imageFile);
        }
    } else if (item.item_type === 'weapon') {
        const weaponData = WEAPON_DATA[item.item_name];
        if (weaponData && weaponData.imageFile) {
            return buildGunImageUrl(weaponData.imageFile);
        }
    } else if (item.item_type === 'backpack') {
        const backpackData = INVENTORY_BACKPACK_DATA[item.item_name];
        if (backpackData && backpackData.imageFile) {
            return buildBackpackImageUrl(backpackData.imageFile);
        }
    } else if (item.item_type === 'rig') {
        const rigData = INVENTORY_RIG_DATA[item.item_name];
        if (rigData && rigData.imageFile) {
            return buildRigImageUrl(rigData.imageFile);
        }
    } else if (item.item_type === 'magazine') {
        const magazineData = INVENTORY_MAGAZINE_DATA[item.item_name];
        if (magazineData && magazineData.imageFile) {
            return buildMagazineImageUrl(magazineData.imageFile);
        }
    } else if (item.item_type === 'medical') {
        const medicalData = MEDICAL_DATA[item.item_name];
        if (medicalData && medicalData.imageFile) {
            return buildMedicalImageUrl(medicalData.imageFile);
        }
    } else if (item.item_type === 'flare') {
        const flareData = FLARE_DATA[item.item_name];
        if (flareData && flareData.imageFile) {
            return buildFlareImageUrl(flareData.imageFile);
        }
    } else if (item.item_type === 'armor') {
        // アーマーの画像ファイル名はアイテム名と同じ（拡張子は.pngを想定）
        const imageFile = `${item.item_name}.png`;
        return buildArmorImageUrl(imageFile);
    } else if (item.item_type === 'helmet') {
        // ヘルメットの画像ファイル名はアイテム名と同じ（拡張子は.pngを想定）
        const imageFile = `${item.item_name}.png`;
        return buildHelmetImageUrl(imageFile);
    }
    return null;
}
function getInventoryItemFromElement(element) {
    if (!element) return null;
    const identifier = element.dataset.itemId;
    return findInventoryItemByIdentifier(identifier);
}

function getInventoryItemQuantityText(item) {
    if (item.item_type === 'magazine') {
        const magazineData = getInventoryMagazineData(item);
        const capacity = magazineData?.capacity ?? null;
        const current = item.quantity || 0;
        const displayCapacity = capacity !== null ? capacity : '?';
        return `${current}/${displayCapacity}`;
    }
    
    if (item.item_type === 'ammo') {
        const current = item.quantity || 0;
        return `${current}`;
    }
    
    if (item.quantity && item.quantity > 1) {
        return String(item.quantity);
    }
    
    return null;
}

function canLoadInventoryAmmoIntoMagazine(ammoItem, magazineItem) {
    const magazineData = getInventoryMagazineData(magazineItem);
    const ammoData = getInventoryAmmoData(ammoItem);
    if (!magazineData || !ammoData) return false;
    if (magazineData.caliber !== ammoData.caliber) return false;
    const capacity = magazineData.capacity || 0;
    const current = magazineItem.quantity || 0;
    const available = ammoItem.quantity || 0;
    return capacity > current && available > 0;
}


function createInventoryBackpackGrid(size) {
    const els = getInventoryElements();
    if (!els.backpackGrid) return;
    
    inventoryCurrentBackpackSize = { ...size };
    inventoryBackpackGrid = [];
    els.backpackGrid.innerHTML = '';
    els.backpackGrid.style.gridTemplateColumns = `repeat(${inventoryCurrentBackpackSize.width}, ${INVENTORY_GRID_CELL_SIZE}px)`;
    els.backpackGrid.style.gridTemplateRows = `repeat(${inventoryCurrentBackpackSize.height}, ${INVENTORY_GRID_CELL_SIZE}px)`;
    
    for (let y = 0; y < inventoryCurrentBackpackSize.height; y++) {
        const row = [];
        for (let x = 0; x < inventoryCurrentBackpackSize.width; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            els.backpackGrid.appendChild(cell);
            row.push(cell);
        }
        inventoryBackpackGrid.push(row);
    }
}

function setupInventoryRigStructure(rigItem) {
    const els = getInventoryElements();
    if (!els.rigGrid) return;
    
    const rigData = getInventoryRigData(rigItem);
    if (rigData && rigData.slots && rigData.slots.length > 0) {
        inventoryRigUsesSlots = true;
        // スロットベースのリグ（簡易実装）
        els.rigGrid.innerHTML = '';
        els.rigGrid.classList.add('slot-mode');
        inventoryRigSlots = [];
        let slotId = 1;
        rigData.slots.forEach(slotInfo => {
            const size = INVENTORY_RIG_SLOT_SIZES[slotInfo.type];
            if (!size) return;
            for (let i = 0; i < slotInfo.count; i++) {
                const slotElement = document.createElement('div');
                slotElement.className = 'rig-slot';
                slotElement.dataset.slotId = String(slotId);
                const widthPx = size.width * (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP) - INVENTORY_GRID_GAP;
                const heightPx = size.height * (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP) - INVENTORY_GRID_GAP;
                slotElement.style.width = `${widthPx}px`;
                slotElement.style.height = `${heightPx}px`;
                els.rigGrid.appendChild(slotElement);
                inventoryRigSlots.push({
                    id: slotId,
                    type: slotInfo.type,
                    width: size.width,
                    height: size.height,
                    element: slotElement
                });
                slotId++;
            }
        });
        inventoryRigGrid = null;
    } else {
        inventoryRigUsesSlots = false;
        const size = rigData?.contentSize || INVENTORY_DEFAULT_RIG_SIZE;
        inventoryCurrentRigGridSize = { ...size };
        inventoryRigGrid = [];
        els.rigGrid.innerHTML = '';
        els.rigGrid.classList.remove('slot-mode');
        els.rigGrid.style.gridTemplateColumns = `repeat(${inventoryCurrentRigGridSize.width}, ${INVENTORY_GRID_CELL_SIZE}px)`;
        els.rigGrid.style.gridTemplateRows = `repeat(${inventoryCurrentRigGridSize.height}, ${INVENTORY_GRID_CELL_SIZE}px)`;
        
        for (let y = 0; y < inventoryCurrentRigGridSize.height; y++) {
            const row = [];
            for (let x = 0; x < inventoryCurrentRigGridSize.width; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                els.rigGrid.appendChild(cell);
                row.push(cell);
            }
            inventoryRigGrid.push(row);
        }
        inventoryRigSlots = [];
    }
}

// インベントリアイテムの読み込み
async function loadInventoryItems() {
    try {
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (data.success) {
            inventoryItems = (data.items || []).map(item => {
                // ammo_stackが文字列の場合はパース
                if (item.ammo_stack && typeof item.ammo_stack === 'string') {
                    try {
                        item.ammo_stack = JSON.parse(item.ammo_stack);
                    } catch (e) {
                        item.ammo_stack = [];
                    }
                } else if (!item.ammo_stack) {
                    item.ammo_stack = [];
                }
                
                if (item.item_type === 'weapon') {
                    const weaponData = WEAPON_DATA[item.item_name];
                    if (weaponData && weaponData.stashSize) {
                        item.width = weaponData.stashSize.width;
                        item.height = weaponData.stashSize.height;
                    }
                    item.weapon_durability = Math.max(0, Math.min(WEAPON_DURABILITY_MAX, typeof item.weapon_durability === 'number' ? item.weapon_durability : WEAPON_DURABILITY_MAX));
                } else if (item.item_type === 'backpack') {
                    const backpackData = INVENTORY_BACKPACK_DATA[item.item_name];
                    if (backpackData && backpackData.stashSize) {
                        item.width = backpackData.stashSize.width;
                        item.height = backpackData.stashSize.height;
                    }
                } else if (item.item_type === 'rig') {
                    const rigData = INVENTORY_RIG_DATA[item.item_name];
                    if (rigData && rigData.stashSize) {
                        item.width = rigData.stashSize.width;
                        item.height = rigData.stashSize.height;
                    }
                } else if (item.item_type === 'medical') {
                    const medicalData = MEDICAL_DATA[item.item_name];
                    if (medicalData && medicalData.stashSize) {
                        item.width = medicalData.stashSize.width;
                        item.height = medicalData.stashSize.height;
                    }
                    if (medicalData) {
                        if (!item.quantity || item.quantity <= 1) {
                            item.quantity = medicalData.durability || 1;
                        }
                    }
                }
                
                return item;
            });
            renderInventoryItems();
        }
    } catch (error) {
        console.error('インベントリアイテムの読み込みに失敗しました:', error);
    }
}

// インベントリアイテムの描画
function renderInventoryItems() {
    // 異常状態表示を更新（インベントリが開いている場合）
    updateStatusEffectsDisplay();
    
    // 装備中のアーマーのarmor_durabilityをGAME_CONFIGと同期
    if (GAME_CONFIG.equippedArmor && GAME_CONFIG.armorDurability !== null) {
        const armorItem = inventoryItems.find(item => item.equipped_slot === 'armor');
        if (armorItem) {
            armorItem.armor_durability = GAME_CONFIG.armorDurability;
        }
    }
    
    // 装備中のヘルメットのhelmet_durabilityをGAME_CONFIGと同期
    if (GAME_CONFIG.equippedHelmet && GAME_CONFIG.helmetDurability !== null) {
        const helmetItem = inventoryItems.find(item => item.equipped_slot === 'head');
        if (helmetItem) {
            helmetItem.helmet_durability = GAME_CONFIG.helmetDurability;
        }
    }
    
    const els = getInventoryElements();
    
    // 既存のアイテムを削除
    if (els.backpackGrid) els.backpackGrid.querySelectorAll('.item').forEach(item => item.remove());
    if (els.rigGrid) els.rigGrid.querySelectorAll('.item').forEach(item => item.remove());
    document.querySelectorAll('#inventoryEquipmentSlots .item').forEach(item => item.remove());
    
    // グリッドをクリア
    if (inventoryBackpackGrid) {
        inventoryBackpackGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('occupied');
            });
        });
    }
    
    if (inventoryRigGrid) {
        inventoryRigGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('occupied');
                cell.classList.remove('drag-over');
            });
        });
    }
    
    if (inventoryRigSlots && inventoryRigSlots.length > 0) {
        inventoryRigSlots.forEach(slot => {
            slot.element.classList.remove('occupied');
            slot.element.classList.remove('rig-slot-highlight-valid');
            slot.element.classList.remove('rig-slot-highlight-invalid');
        });
    }
    if (inventoryRigUsesSlots) {
        inventoryRigSlotOccupancy = new Map();
    }
    
    // バックパックとリグを探す
    inventoryEquippedBackpack = inventoryItems.find(item => item.equipped_slot === 'backpack');
    inventoryEquippedRig = inventoryItems.find(item => item.equipped_slot === 'rig');
    
    // バックパックパネルの表示/非表示
    if (inventoryEquippedBackpack && els.backpackPanel) {
        const backpackSize = getInventoryBackpackContentSize(inventoryEquippedBackpack);
        createInventoryBackpackGrid(backpackSize);
        els.backpackPanel.classList.remove('hidden');
        if (els.backpackName) els.backpackName.textContent = inventoryEquippedBackpack.item_name;
    } else {
        if (els.backpackPanel) els.backpackPanel.classList.add('hidden');
    }
    
    // リグパネルの表示/非表示
    if (inventoryEquippedRig && els.rigPanel) {
        setupInventoryRigStructure(inventoryEquippedRig);
        els.rigPanel.classList.remove('hidden');
        if (els.rigName) els.rigName.textContent = inventoryEquippedRig.item_name;
    } else {
        if (els.rigPanel) els.rigPanel.classList.add('hidden');
    }
    
    if (els.gearPanel) {
        if ((inventoryEquippedBackpack && !els.backpackPanel?.classList.contains('hidden')) ||
            (inventoryEquippedRig && !els.rigPanel?.classList.contains('hidden'))) {
            els.gearPanel.classList.remove('hidden');
        } else {
            els.gearPanel.classList.add('hidden');
        }
    }
    
    // アイテムを描画
    inventoryItems.forEach(item => {
        if (item.equipped_slot) {
            const slot = document.querySelector(`#inventoryEquipmentSlots [data-slot="${item.equipped_slot}"] .slot-content`);
            if (slot) {
                const itemElement = createInventoryItemElement(item, true);
                slot.appendChild(itemElement);
                
                // 武器に装填されているマガジンを表示
                if (item.item_type === 'weapon') {
                    const loadedMagazine = inventoryItems.find(mag => 
                        mag.item_type === 'magazine' && 
                        mag.parent_item_id === item.id &&
                        mag.grid_x === null && 
                        mag.grid_y === null
                    );
                    if (loadedMagazine) {
                        const magazineElement = createInventoryItemElement(loadedMagazine, true);
                        magazineElement.style.position = 'absolute';
                        magazineElement.style.bottom = '0';
                        magazineElement.style.right = '0';
                        magazineElement.style.width = '60%';
                        magazineElement.style.height = '40%';
                        magazineElement.style.fontSize = '0.7em';
                        slot.appendChild(magazineElement);
                    }
                }
            }
        } else if (item.parent_item_id) {
            if (inventoryEquippedBackpack && item.parent_item_id === inventoryEquippedBackpack.id && els.backpackGrid) {
                const itemElement = createInventoryItemElement(item, false);
                els.backpackGrid.appendChild(itemElement);
                positionInventoryItemInBackpack(itemElement, item);
                markInventoryBackpackCellsOccupied(item);
            } else if (inventoryEquippedRig && item.parent_item_id === inventoryEquippedRig.id && els.rigGrid) {
                if (inventoryRigUsesSlots) {
                    const slotId = getInventoryRigSlotIdFromItem(item);
                    const slot = getInventoryRigSlotById(slotId);
                    if (slot) {
                        const itemElement = createInventoryItemElement(item, false);
                        slot.element.appendChild(itemElement);
                        positionInventoryItemInRigSlot(itemElement, slot, item);
                        markInventoryRigSlotOccupied(slot.id, item, item.rig_slot_x || 0, item.rig_slot_y || 0);
                    }
                } else {
                    const itemElement = createInventoryItemElement(item, false);
                    els.rigGrid.appendChild(itemElement);
                    positionInventoryItemInRig(itemElement, item);
                    markInventoryRigCellsOccupied(item);
                }
            }
        }
    });
    
    if (inventoryEquippedBackpack) updateInventoryBackpackCapacity();
    if (inventoryEquippedRig) updateInventoryRigCapacity();
    
    // 武器詳細モーダルが開いている場合はアタッチメント欄を再描画
    const modal = document.getElementById('inventoryItemDetailModal');
    if (modal && !modal.classList.contains('hidden')) {
        const weaponTitle = document.getElementById('inventoryDetailTitle');
        if (weaponTitle && weaponTitle.textContent) {
            // 武器名と装備スロットで武器を検索（IDが変わっている可能性があるため）
            const weaponSlot = weaponTitle.dataset.weaponSlot;
            const weaponItem = inventoryItems.find(i => 
                i.item_name === weaponTitle.textContent && 
                i.item_type === 'weapon' &&
                (weaponSlot ? i.equipped_slot === weaponSlot : (i.equipped_slot === 'primary' || i.equipped_slot === 'secondary'))
            );
            if (weaponItem) {
                // 装備スロットを更新
                if (weaponItem.equipped_slot) {
                    weaponTitle.dataset.weaponSlot = weaponItem.equipped_slot;
                }
                renderWeaponAttachments(weaponItem);
            }
        }
    }
}

// インベントリアイテム要素の作成
function createInventoryItemElement(item, isEquipped) {
    const itemElement = document.createElement('div');
    itemElement.className = 'item';
    const identifier = getInventoryItemIdentifier(item);
    itemElement.dataset.itemId = identifier;
    itemElement.dataset.itemType = item.item_type;
    itemElement.dataset.width = item.width;
    itemElement.dataset.height = item.height;
    
    if (isEquipped) {
        itemElement.style.width = '100%';
        itemElement.style.height = '100%';
        itemElement.style.position = 'relative';
    } else {
        itemElement.style.width = `${item.width * INVENTORY_GRID_CELL_SIZE + Math.max(0, item.width - 1) * INVENTORY_GRID_GAP}px`;
        itemElement.style.height = `${item.height * INVENTORY_GRID_CELL_SIZE + Math.max(0, item.height - 1) * INVENTORY_GRID_GAP}px`;
        itemElement.style.position = 'absolute';
    }
    
    const quantityText = getInventoryItemQuantityText(item);
    const imageUrl = getInventoryItemImageUrl(item);
    const showName = item.item_type !== 'magazine';
    const shouldShowName = showName && !imageUrl;
    let displayName = item.item_name;
    if (item.item_type === 'ammo') {
        const ammoData = getInventoryAmmoData(item);
        if (ammoData && ammoData.fullName) {
            const caliber = ammoData.caliber || '';
            if (caliber && ammoData.fullName.startsWith(caliber)) {
                displayName = ammoData.fullName.substring(caliber.length).trim() || ammoData.fullName;
            } else {
                displayName = ammoData.fullName;
            }
        }
    }
    
    let itemContent = '';
    if (imageUrl) {
        itemElement.classList.add('has-image');
        itemContent += `<div class="item-image-wrapper"><img src="${imageUrl}" alt="${displayName}" draggable="false"></div>`;
    }
    itemContent += shouldShowName ? `<div class="item-name">${displayName}</div>` : '<div class="item-name hidden"></div>';
    if (quantityText !== null) {
        itemContent += `<div class="item-quantity">${quantityText}</div>`;
    }
    // アーマーの耐久値を表示
    if (item.item_type === 'armor') {
        const armorData = ARMOR_DATA[item.item_name];
        if (armorData) {
            const maxDurability = armorData.durability;
            const durability = item.armor_durability !== null && item.armor_durability !== undefined 
                ? item.armor_durability 
                : maxDurability;
            itemContent += `<div class="item-armor-durability">${durability}/${maxDurability}</div>`;
        }
    }
    // ヘルメットの耐久値を表示
    if (item.item_type === 'helmet') {
        const helmetData = HELMET_DATA[item.item_name];
        if (helmetData) {
            const maxDurability = helmetData.durability;
            const durability = item.helmet_durability !== null && item.helmet_durability !== undefined 
                ? item.helmet_durability 
                : maxDurability;
            itemContent += `<div class="item-armor-durability">${durability}/${maxDurability}</div>`;
        }
    }
    itemElement.innerHTML = itemContent;
    
    itemElement.addEventListener('mousedown', (e) => startInventoryDrag(e, itemElement, item));
    itemElement.addEventListener('mouseenter', (e) => showInventoryTooltip(e, item));
    itemElement.addEventListener('mousemove', moveInventoryTooltip);
    itemElement.addEventListener('mouseleave', () => hideInventoryTooltip());
    // capture phaseで処理して、グローバルなイベントリスナーより先に実行されるようにする
    itemElement.addEventListener('contextmenu', (e) => handleInventoryItemContextMenu(e, item), true);
    
    return itemElement;
}

function markInventoryBackpackCellsOccupied(item) {
    if (!inventoryBackpackGrid) return;
    for (let y = item.grid_y; y < item.grid_y + item.height; y++) {
        for (let x = item.grid_x; x < item.grid_x + item.width; x++) {
            if (y < inventoryCurrentBackpackSize.height && x < inventoryCurrentBackpackSize.width) {
                inventoryBackpackGrid[y][x].classList.add('occupied');
            }
        }
    }
}

function markInventoryRigCellsOccupied(item) {
    if (inventoryRigUsesSlots) return;
    if (!inventoryRigGrid) return;
    for (let y = item.grid_y; y < item.grid_y + item.height; y++) {
        for (let x = item.grid_x; x < item.grid_x + item.width; x++) {
            if (y < inventoryCurrentRigGridSize.height && x < inventoryCurrentRigGridSize.width) {
                inventoryRigGrid[y][x].classList.add('occupied');
            }
        }
    }
}

function getInventoryRigSlotIdFromItem(item) {
    if (item.grid_x !== null && item.grid_x < 0) {
        return Math.abs(item.grid_x);
    }
    if (item.rig_slot_id) {
        return item.rig_slot_id;
    }
    return null;
}

function getInventoryRigSlotById(slotId) {
    if (!slotId) return null;
    return inventoryRigSlots.find(slot => slot.id === slotId) || null;
}

function getInventoryRigSlotOccupants(slotId) {
    return inventoryRigSlotOccupancy.get(slotId) || [];
}

function findInventoryRigSlotPlacement(slot, item, ignoreItem = null) {
    if (!slot || !item) return null;
    const size = INVENTORY_RIG_SLOT_SIZES[slot.type];
    if (!size) return null;
    const width = item.width || 1;
    const height = item.height || 1;
    if (width > size.width || height > size.height) return null;
    
    const occupants = getInventoryRigSlotOccupants(slot.id);
    const usedSpaces = [];
    occupants.forEach(occ => {
        if (!occ || occ === item || occ === ignoreItem) return;
        const occWidth = occ.width || 1;
        const occHeight = occ.height || 1;
        const occX = occ.rig_slot_x || 0;
        const occY = occ.rig_slot_y || 0;
        usedSpaces.push({ x: occX, y: occY, width: occWidth, height: occHeight });
    });
    
    for (let y = 0; y <= size.height - height; y++) {
        for (let x = 0; x <= size.width - width; x++) {
            const overlaps = usedSpaces.some(used => {
                return !(x + width <= used.x || x >= used.x + used.width ||
                         y + height <= used.y || y >= used.y + used.height);
            });
            if (!overlaps) {
                return { x, y };
            }
        }
    }
    
    return null;
}

function positionInventoryItemInRigSlot(itemElement, slot, item) {
    const slotRelativeX = item?.rig_slot_x || 0;
    const slotRelativeY = item?.rig_slot_y || 0;
    const cellSize = INVENTORY_GRID_CELL_SIZE;
    const step = cellSize + INVENTORY_GRID_GAP;
    
    itemElement.style.position = 'absolute';
    itemElement.style.left = `${slotRelativeX * step}px`;
    itemElement.style.top = `${slotRelativeY * step}px`;
    itemElement.style.width = `${(item?.width || 1) * cellSize + Math.max(0, (item?.width || 1) - 1) * INVENTORY_GRID_GAP}px`;
    itemElement.style.height = `${(item?.height || 1) * cellSize + Math.max(0, (item?.height || 1) - 1) * INVENTORY_GRID_GAP}px`;
}

function markInventoryRigSlotOccupied(slotId, item, slotRelativeX = 0, slotRelativeY = 0) {
    if (!slotId || !item) return;
    let occupants = inventoryRigSlotOccupancy.get(slotId) || [];
    item.rig_slot_x = slotRelativeX;
    item.rig_slot_y = slotRelativeY;
    if (!occupants.includes(item)) {
        occupants.push(item);
        inventoryRigSlotOccupancy.set(slotId, occupants);
    }
    const slot = getInventoryRigSlotById(slotId);
    if (slot) {
        slot.element.classList.add('occupied');
    }
}

function clearInventoryItemRigSlotPosition(item) {
    if (!item) return;
    delete item.rig_slot_x;
    delete item.rig_slot_y;
}

function positionInventoryItemInBackpack(itemElement, item) {
    const x = item.grid_x * (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP) + INVENTORY_GRID_PADDING;
    const y = item.grid_y * (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP) + INVENTORY_GRID_PADDING;
    itemElement.style.left = `${x}px`;
    itemElement.style.top = `${y}px`;
}

function positionInventoryItemInRig(itemElement, item) {
    const x = item.grid_x * (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP) + INVENTORY_GRID_PADDING;
    const y = item.grid_y * (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP) + INVENTORY_GRID_PADDING;
    itemElement.style.left = `${x}px`;
    itemElement.style.top = `${y}px`;
}


function updateInventoryBackpackCapacity() {
    const els = getInventoryElements();
    if (!els.backpackCapacity || !inventoryEquippedBackpack) return;
    
    let used = 0;
    let total = 0;
    inventoryItems.forEach(item => {
        if (item.parent_item_id === inventoryEquippedBackpack.id) {
            used += item.width * item.height;
        }
    });
    
    const size = getInventoryBackpackContentSize(inventoryEquippedBackpack);
    total = size.width * size.height;
    
    els.backpackCapacity.textContent = `${used} / ${total}`;
}

function updateInventoryRigCapacity() {
    const els = getInventoryElements();
    if (!els.rigCapacity || !inventoryEquippedRig) return;
    
    let used = 0;
    inventoryItems.forEach(item => {
        if (item.parent_item_id === inventoryEquippedRig.id) {
            used += item.width * item.height;
        }
    });
    
    const rigData = getInventoryRigData(inventoryEquippedRig);
    let total = 0;
    if (rigData && rigData.slots) {
        rigData.slots.forEach(slotInfo => {
            const size = INVENTORY_RIG_SLOT_SIZES[slotInfo.type];
            if (size) {
                total += size.width * size.height * slotInfo.count;
            }
        });
    } else {
        const size = rigData?.contentSize || INVENTORY_DEFAULT_RIG_SIZE;
        total = size.width * size.height;
    }
    
    els.rigCapacity.textContent = `${used} / ${total}`;
}

// インベントリツールチップ
function showInventoryTooltip(e, item) {
    const els = getInventoryElements();
    if (!els.itemTooltip) return;
    
    const ammoData = getInventoryAmmoData(item);
    const magazineData = getInventoryMagazineData(item);
    const medicalData = MEDICAL_DATA[item.item_name];
    
    let tooltipText = '';
    if (item.item_type === 'ammo' && ammoData) {
        tooltipText = `${ammoData.fullName || item.item_name}<br>ダメージ: ${ammoData.damage ?? '-'}<br>貫通力: ${ammoData.penetration ?? '-'}<br>弾速: ${ammoData.velocity ? `${ammoData.velocity} m/s` : '-'}`;
    } else if (item.item_type === 'magazine' && magazineData) {
        tooltipText = `${item.item_name}<br>容量: ${magazineData.capacity ?? '-'}<br>対応弾種: ${magazineData.caliber ?? '-'}`;
    } else if (item.item_type === 'medical' && medicalData) {
        // 医薬品の詳細情報
        const effects = [];
        const cures = Array.isArray(medicalData.cures) ? medicalData.cures : [];
        
        if (cures.includes('lightBleeding')) {
            effects.push(`軽度出血 (耐久値-${medicalData.lightBleedingCost || 1})`);
        }
        if (cures.includes('heavyBleeding')) {
            effects.push(`重度出血 (耐久値-${medicalData.heavyBleedingCost || 1})`);
        }
        if (cures.includes('fracture')) {
            effects.push(`骨折 (耐久値-${medicalData.fractureCost || 1})`);
        }
        if (cures.includes('pain')) {
            const painInfo = `痛み (耐久値-${medicalData.painCost || 1})`;
            if (medicalData.duration) {
                effects.push(`${painInfo}, 効果時間: ${medicalData.duration}秒`);
            } else {
                effects.push(painInfo);
            }
        }
        if (cures.includes('blackedOut')) {
            effects.push(`壊死 (耐久値-${medicalData.blackedOutCost || 1})`);
        }
        if (medicalData.hydrationGain) {
            effects.push(`水分回復: +${medicalData.hydrationGain}`);
        }
        if (medicalData.energyGain) {
            effects.push(`エネルギー回復: +${medicalData.energyGain}`);
        }
        
        const currentDurability = item.quantity !== null && item.quantity !== undefined 
            ? item.quantity 
            : (medicalData.durability || 0);
        const maxDurability = medicalData.durability || 0;
        
        tooltipText = `${item.item_name}<br>耐久値: ${currentDurability}/${maxDurability}<br>使用時間: ${medicalData.useTime || '-'}秒`;
        if (effects.length > 0) {
            tooltipText += `<br>効果: ${effects.join(', ')}`;
        }
    } else {
        tooltipText = item.item_name;
    }
    
    els.itemTooltip.innerHTML = tooltipText;
    els.itemTooltip.classList.remove('hidden');
    positionInventoryTooltip(e);
    inventoryLastMousePosition = { x: e.clientX, y: e.clientY };
}

function hideInventoryTooltip() {
    const els = getInventoryElements();
    if (!els.itemTooltip) return;
    els.itemTooltip.classList.add('hidden');
}

function moveInventoryTooltip(e) {
    if (!inventoryLastMousePosition) return;
    inventoryLastMousePosition = { x: e.clientX, y: e.clientY };
    positionInventoryTooltip(e);
}

function positionInventoryTooltip(e) {
    const els = getInventoryElements();
    if (!els.itemTooltip || !inventoryLastMousePosition) return;
    
    const tooltip = els.itemTooltip;
    const x = inventoryLastMousePosition.x + 10;
    const y = inventoryLastMousePosition.y + 10;
    
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    
    // ウィンドウ外に出ないように調整
    setTimeout(() => {
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tooltip.style.left = `${window.innerWidth - rect.width - 10}px`;
        }
        if (rect.bottom > window.innerHeight) {
            tooltip.style.top = `${window.innerHeight - rect.height - 10}px`;
        }
    }, 0);
}

// インベントリコンテキストメニュー
function showInventoryContextMenu(x, y, item) {
    const els = getInventoryElements();
    if (!els.itemContextMenu) return;
    
    hideInventoryContextMenu();
    els.itemContextMenu.classList.remove('hidden');
    els.itemContextMenu.style.left = `${x}px`;
    els.itemContextMenu.style.top = `${y}px`;
    
    if (els.contextDetailButton) {
        if (item.item_type === 'ammo' || item.item_type === 'weapon' || item.item_type === 'medical') {
            els.contextDetailButton.classList.remove('hidden');
        } else {
            els.contextDetailButton.classList.add('hidden');
        }
    }
    
    if (els.contextUnloadAmmoButton) {
        // マガジンがリグ、バックパック、またはスタッシュにある場合のみ「弾薬を抜く」を表示
        if (item.item_type === 'magazine' && (item.quantity || 0) > 0) {
            // 武器に装填されているマガジンは除外（grid_xとgrid_yがnull）
            const isInWeapon = item.grid_x === null && item.grid_y === null && item.parent_item_id !== null;
            
            // リグ、バックパック、またはスタッシュにあるかチェック
            const isInRig = inventoryEquippedRig && item.parent_item_id === inventoryEquippedRig.id && item.grid_x !== null && item.grid_y !== null;
            const isInBackpack = inventoryEquippedBackpack && item.parent_item_id === inventoryEquippedBackpack.id && item.grid_x !== null && item.grid_y !== null;
            const isInStash = item.parent_item_id === null && item.equipped_slot === null && item.grid_x !== null && item.grid_y !== null;
            
            if (!isInWeapon && (isInRig || isInBackpack || isInStash)) {
                els.contextUnloadAmmoButton.classList.remove('hidden');
            } else {
                els.contextUnloadAmmoButton.classList.add('hidden');
            }
        } else {
            els.contextUnloadAmmoButton.classList.add('hidden');
        }
    }
    
    if (els.contextUnloadMagazineButton) {
        // 武器に装填されているマガジンがある場合は「アンリロード」を表示
        if (item.item_type === 'weapon') {
            const loadedMagazine = inventoryItems.find(mag => 
                mag.item_type === 'magazine' && 
                mag.parent_item_id === item.id &&
                mag.grid_x === null && 
                mag.grid_y === null
            );
            if (loadedMagazine) {
                els.contextUnloadMagazineButton.classList.remove('hidden');
            } else {
                els.contextUnloadMagazineButton.classList.add('hidden');
            }
        } else {
            els.contextUnloadMagazineButton.classList.add('hidden');
        }
    }

    if (els.contextUseButton) {
        if (item.item_type === 'medical' || item.item_type === 'flare') {
            els.contextUseButton.classList.remove('hidden');
        } else {
            els.contextUseButton.classList.add('hidden');
        }
    }
    
    if (els.contextDropButton) {
        // 装備中のアイテム（equipped_slotが設定されている）は捨てられない
        if (item.equipped_slot) {
            els.contextDropButton.classList.add('hidden');
        } else {
            els.contextDropButton.classList.remove('hidden');
        }
    }
    
    const rect = els.itemContextMenu.getBoundingClientRect();
    let adjustedX = x;
    let adjustedY = y;
    if (rect.right > window.innerWidth) {
        adjustedX = Math.max(8, window.innerWidth - rect.width - 8);
    }
    if (rect.bottom > window.innerHeight) {
        adjustedY = Math.max(8, window.innerHeight - rect.height - 8);
    }
    els.itemContextMenu.style.left = `${adjustedX}px`;
    els.itemContextMenu.style.top = `${adjustedY}px`;
    inventoryContextMenuItem = item;
}

function hideInventoryContextMenu() {
    const els = getInventoryElements();
    if (!els.itemContextMenu) return;
    els.itemContextMenu.classList.add('hidden');
    inventoryContextMenuItem = null;
}

function handleInventoryItemContextMenu(event, item) {
    // 常にブラウザのデフォルトのコンテキストメニューを無効化
    event.preventDefault();
    event.stopPropagation();
    
    if (inventoryDraggedItem) return;
    // 対象アイテムのみコンテキストメニューを表示
    if (item.item_type !== 'ammo' && item.item_type !== 'magazine' && item.item_type !== 'weapon' && item.item_type !== 'medical' && item.item_type !== 'flare') return;
    
    hideInventoryTooltip();
    hideInventoryContextMenu();
    hideInventoryDetailModal();
    showInventoryContextMenu(event.clientX, event.clientY, item);
}

// インベントリからアイテムを地面にドロップ
function dropInventoryItemToGround(item) {
    if (!item) return;
    
    // 装備中のアイテムは捨てられない
    if (item.equipped_slot) {
        console.warn('装備中のアイテムは捨てられません');
        return;
    }
    
    // プレイヤーの位置を取得
    const playerPos = getPlayerPositionVector();
    if (!playerPos) {
        console.error('プレイヤーの位置を取得できませんでした');
        return;
    }
    
    // カメラの向きを取得して、プレイヤーの前方にドロップ
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0; // 水平方向のみ
    cameraDirection.normalize();
    
    // プレイヤーの前方0.5mの位置にドロップ
    const dropPosition = playerPos.clone();
    dropPosition.add(cameraDirection.multiplyScalar(0.5));
    dropPosition.y = 0.2; // 地面の高さ
    
    // アイテムタイプに応じてルートアイテム定義を作成
    let lootDef = null;
    
    // LOOT_ITEM_POOLから一致するアイテムを探す
    lootDef = LOOT_ITEM_POOL.find(loot => loot.name === item.item_name && loot.itemType === item.item_type);
    
    // 見つからない場合は、アイテムタイプに基づいて定義を作成
    if (!lootDef) {
        // デフォルトの色を設定
        let defaultColor = 0xffffff;
        if (item.item_type === 'weapon') defaultColor = 0x4b7bec;
        else if (item.item_type === 'medical') defaultColor = 0xff4c4c;
        else if (item.item_type === 'ammo') defaultColor = 0xffd700;
        else if (item.item_type === 'magazine') defaultColor = 0x8b7355;
        else if (item.item_type === 'flare') {
            if (item.item_name === 'Red Flare') defaultColor = 0xff0000;
            else if (item.item_name === 'Green Flare') defaultColor = 0x00ff00;
            else if (item.item_name === 'Yellow Flare') defaultColor = 0xffff00;
        }
        
        lootDef = {
            name: item.item_name,
            color: defaultColor,
            itemType: item.item_type
        };
    }
    
    // アイテムを地面にドロップ
    const mesh = createLootItemMesh(lootDef);
    if (!mesh) {
        console.error('アイテムメッシュの作成に失敗しました');
        return;
    }
    
    mesh.position.set(
        dropPosition.x + THREE.MathUtils.randFloatSpread(0.1),
        dropPosition.y,
        dropPosition.z + THREE.MathUtils.randFloatSpread(0.1)
    );
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    mesh.userData.interaction = { kind: 'loot', mesh };
    droppedLootItems.push(mesh);
    
    // インベントリからアイテムを削除（子アイテムも含む）
    removeInventoryItemAndChildren(item);
    
    // インベントリを再描画
    renderInventoryItems();
    
    // データベースに保存
    saveInventoryItems();
}

// インベントリからアイテムとその子アイテムを削除
function removeInventoryItemAndChildren(item) {
    if (!item) return;
    
    // 子アイテムを再帰的に削除
    const childItems = inventoryItems.filter(child => child.parent_item_id === item.id);
    for (const child of childItems) {
        removeInventoryItemAndChildren(child);
    }
    
    // アイテムをインベントリから削除
    const index = inventoryItems.indexOf(item);
    if (index !== -1) {
        inventoryItems.splice(index, 1);
    }
}

function showInventoryAmmoDetails(item) {
    const els = getInventoryElements();
    if (!els.itemDetailModal || !els.detailTitle || !els.detailStats) return;
    
    hideInventoryTooltip();
    const ammoData = getInventoryAmmoData(item) || {};
    els.detailTitle.textContent = ammoData.fullName || item.item_name;
    const rows = [
        { label: 'アイテム名', value: ammoData.fullName || item.item_name },
        { label: '弾種', value: ammoData.caliber || '-' },
        { label: 'ダメージ', value: ammoData.damage ?? '-' },
        { label: '貫通力', value: ammoData.penetration ?? '-' },
        { label: '弾速', value: ammoData.velocity ? `${ammoData.velocity} m/s` : '-' },
        { label: '特殊効果', value: ammoData.special || 'なし' }
    ];
    els.detailStats.innerHTML = rows.map(row => `
        <div class="detail-row">
            <div class="detail-label">${row.label}</div>
            <div class="detail-value">${row.value}</div>
        </div>
    `).join('');
    
    // アタッチメント欄を非表示
    const attachmentsEl = document.getElementById('inventoryWeaponAttachments');
    if (attachmentsEl) {
        attachmentsEl.classList.add('hidden');
    }
    
    els.itemDetailModal.classList.remove('hidden');
}

// 武器の詳細を表示
function showInventoryWeaponDetails(item) {
    const els = getInventoryElements();
    if (!els.itemDetailModal || !els.detailTitle || !els.detailStats) return;
    
    hideInventoryTooltip();
    const weaponData = WEAPON_DATA[item.item_name] || {};
    els.detailTitle.textContent = item.item_name;
    // 武器の装備スロットを保存（renderWeaponAttachmentsで使用）
    if (item.equipped_slot) {
        els.detailTitle.dataset.weaponSlot = item.equipped_slot;
    } else {
        delete els.detailTitle.dataset.weaponSlot;
    }
    
    // 武器に装填されているマガジンを取得
    const loadedMagazine = inventoryItems.find(mag => 
        mag.item_type === 'magazine' && 
        mag.parent_item_id === item.id &&
        mag.grid_x === null && 
        mag.grid_y === null
    );
    
    const magazineData = loadedMagazine ? getInventoryMagazineData(loadedMagazine) : null;
    const currentAmmo = loadedMagazine ? (loadedMagazine.quantity || 0) : 0;
    const maxAmmo = magazineData ? (magazineData.capacity || 0) : 0;
    
    const rows = [
        { label: '武器名', value: item.item_name },
        { label: '連射速度', value: weaponData.fireRate ? `${weaponData.fireRate} RPM` : '-' },
        { label: '射撃モード', value: weaponData.fireModes ? weaponData.fireModes.join('・') : '-' },
        { label: '使用弾薬', value: weaponData.ammoType || '-' },
        { label: '装弾数', value: loadedMagazine ? `${currentAmmo}/${maxAmmo}` : '未装填' },
        { label: '耐久値', value: `${Math.round((item.weapon_durability ?? WEAPON_DURABILITY_MAX) * 10) / 10}%` }
    ];
    
    els.detailStats.innerHTML = rows.map(row => `
        <div class="detail-row">
            <div class="detail-label">${row.label}</div>
            <div class="detail-value">${row.value}</div>
        </div>
    `).join('');
    
    // アタッチメント欄を表示
    const attachmentsEl = document.getElementById('inventoryWeaponAttachments');
    if (attachmentsEl) {
        attachmentsEl.classList.remove('hidden');
        renderWeaponAttachments(item);
    }
    
    els.itemDetailModal.classList.remove('hidden');
}

// 医薬品の詳細を表示
function showInventoryMedicalDetails(item) {
    const els = getInventoryElements();
    if (!els.itemDetailModal || !els.detailTitle || !els.detailStats) return;
    
    hideInventoryTooltip();
    const medicalData = MEDICAL_DATA[item.item_name] || {};
    els.detailTitle.textContent = item.item_name;
    
    const currentDurability = item.quantity !== null && item.quantity !== undefined 
        ? item.quantity 
        : (medicalData.durability || 0);
    const maxDurability = medicalData.durability || 0;
    
    const rows = [
        { label: 'アイテム名', value: item.item_name },
        { label: '耐久値', value: `${currentDurability}/${maxDurability}` },
        { label: '使用時間', value: medicalData.useTime ? `${medicalData.useTime}秒` : '-' }
    ];
    
    // 効果の情報を追加
    const cures = Array.isArray(medicalData.cures) ? medicalData.cures : [];
    const effects = [];
    
    if (cures.includes('lightBleeding')) {
        effects.push(`軽度出血を治療 (耐久値-${medicalData.lightBleedingCost || 1})`);
    }
    if (cures.includes('heavyBleeding')) {
        effects.push(`重度出血を治療 (耐久値-${medicalData.heavyBleedingCost || 1})`);
    }
    if (cures.includes('fracture')) {
        effects.push(`骨折を治療 (耐久値-${medicalData.fractureCost || 1})`);
    }
    if (cures.includes('pain')) {
        const painInfo = `痛みを治療 (耐久値-${medicalData.painCost || 1})`;
        if (medicalData.duration) {
            effects.push(`${painInfo}, 鎮痛効果: ${medicalData.duration}秒`);
        } else {
            effects.push(painInfo);
        }
    }
    if (cures.includes('blackedOut')) {
        effects.push(`壊死を治療 (耐久値-${medicalData.blackedOutCost || 1})`);
    }
    if (medicalData.hydrationGain) {
        effects.push(`水分回復: +${medicalData.hydrationGain}`);
    }
    if (medicalData.energyGain) {
        effects.push(`エネルギー回復: +${medicalData.energyGain}`);
    }
    
    if (effects.length > 0) {
        rows.push({ label: '効果', value: effects.join('<br>') });
    } else {
        rows.push({ label: '効果', value: 'なし' });
    }
    
    els.detailStats.innerHTML = rows.map(row => `
        <div class="detail-row">
            <div class="detail-label">${row.label}</div>
            <div class="detail-value">${row.value}</div>
        </div>
    `).join('');
    
    // アタッチメント欄を非表示
    const attachmentsEl = document.getElementById('inventoryWeaponAttachments');
    if (attachmentsEl) {
        attachmentsEl.classList.add('hidden');
    }
    
    els.itemDetailModal.classList.remove('hidden');
}

// 武器のアタッチメントを描画
function renderWeaponAttachments(weaponItem) {
    if (!weaponItem || weaponItem.item_type !== 'weapon') return;
    
    // 各アタッチメントスロットをクリア
    const attachmentSlots = document.querySelectorAll('.attachment-slot');
    attachmentSlots.forEach(slot => {
        slot.innerHTML = '';
        // グリッドセルを作成
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.style.width = '45px';
        cell.style.height = '45px';
        slot.appendChild(cell);
    });
    
    // マガジンスロットに装填されているマガジンを表示
    const magazineSlot = document.querySelector('.attachment-slot[data-attachment-type="magazine"]');
    if (magazineSlot) {
        const loadedMagazine = inventoryItems.find(mag => 
            mag.item_type === 'magazine' && 
            mag.parent_item_id === weaponItem.id &&
            mag.grid_x === null && 
            mag.grid_y === null
        );
        
        if (loadedMagazine) {
            magazineSlot.innerHTML = '';
            const magazineElement = createInventoryItemElement(loadedMagazine, false);
            magazineElement.style.width = '45px';
            magazineElement.style.height = '45px';
            magazineElement.style.position = 'relative';
            magazineElement.style.fontSize = '0.7em';
            magazineSlot.appendChild(magazineElement);
        }
    }
}

function hideInventoryDetailModal() {
    const els = getInventoryElements();
    if (!els.itemDetailModal) return;
    els.itemDetailModal.classList.add('hidden');
    if (els.detailStats) els.detailStats.innerHTML = '';
    if (els.detailTitle) els.detailTitle.textContent = '';
}

// 武器からマガジンを外す処理
function unloadInventoryMagazineFromWeapon(weaponItem) {
    if (!weaponItem || weaponItem.item_type !== 'weapon') return;
    
    // 武器に装填されているマガジンを探す
    const loadedMagazine = inventoryItems.find(mag => 
        mag.item_type === 'magazine' && 
        mag.parent_item_id === weaponItem.id &&
        mag.grid_x === null && 
        mag.grid_y === null
    );
    
    if (!loadedMagazine) return;
    
    // リグまたはバックパックに空きスペースを探す
    let moved = false;
    
    if (inventoryEquippedRig) {
        let space = null;
        if (inventoryRigUsesSlots) {
                // スロットベースのリグの場合、空きスペースを探す
            for (const slot of inventoryRigSlots) {
                    const placement = findInventoryRigSlotPlacement(slot, loadedMagazine);
                    if (placement) {
                        space = { isSlot: true, slotId: slot.id, slotPosition: placement };
                        break;
                }
            }
        } else {
            // グリッドベースのリグの場合
            space = findInventoryEmptySpaceInRig(loadedMagazine.width, loadedMagazine.height);
        }
        
        if (space) {
            if (space.isSlot) {
                    loadedMagazine.grid_x = -space.slotId;
                    loadedMagazine.grid_y = 0;
                    loadedMagazine.parent_item_id = inventoryEquippedRig.id;
                    loadedMagazine.rig_slot_x = space.slotPosition?.x || 0;
                    loadedMagazine.rig_slot_y = space.slotPosition?.y || 0;
                    markInventoryRigSlotOccupied(
                        space.slotId,
                        loadedMagazine,
                        loadedMagazine.rig_slot_x,
                        loadedMagazine.rig_slot_y
                    );
                } else {
                    loadedMagazine.grid_x = space.x;
                    loadedMagazine.grid_y = space.y || 0;
                    loadedMagazine.parent_item_id = inventoryEquippedRig.id;
                    clearInventoryItemRigSlotPosition(loadedMagazine);
            }
            
            moved = true;
        }
    }
    
    // リグにスペースがない場合はバックパックを探す
    if (!moved && inventoryEquippedBackpack) {
        const backpackSpace = findInventoryEmptySpaceInBackpack(loadedMagazine.width, loadedMagazine.height);
        if (backpackSpace) {
            loadedMagazine.grid_x = backpackSpace.x;
            loadedMagazine.grid_y = backpackSpace.y;
            loadedMagazine.parent_item_id = inventoryEquippedBackpack.id;
            moved = true;
        }
    }
    
    if (moved) {
        saveInventoryItems();
        renderInventoryItems();
    } else {
        console.warn('マガジンを外す空きスペースが見つかりません');
    }
}

// マガジンから弾薬を抜く処理
let inventoryUnloadAmmoInterval = null;

function unloadInventoryAmmoFromMagazine(magazineItem) {
    if (!magazineItem || magazineItem.item_type !== 'magazine') return;
    
    const magazineData = getInventoryMagazineData(magazineItem);
    if (!magazineData) return;
    
    const currentAmmo = magazineItem.quantity || 0;
    if (currentAmmo <= 0) return;
    
    const caliber = magazineData.caliber;
    
    // ammo_stackを確実にパース（文字列の場合は配列に変換）
    if (magazineItem.ammo_stack && typeof magazineItem.ammo_stack === 'string') {
        try {
            magazineItem.ammo_stack = JSON.parse(magazineItem.ammo_stack);
        } catch (e) {
            magazineItem.ammo_stack = [];
        }
    } else if (!magazineItem.ammo_stack) {
        magazineItem.ammo_stack = [];
    }
    
    console.log(`[unloadAmmo] 関数開始 - マガジン: ${magazineItem.item_name}, 残弾: ${currentAmmo}, ammo_stack:`, JSON.stringify(magazineItem.ammo_stack));
    
    // ゲーム画面では1秒に1発ずつ抜く
    let remainingAmmo = currentAmmo;
    
    // 既存のインターバルをクリア
    if (inventoryUnloadAmmoInterval) {
        clearInterval(inventoryUnloadAmmoInterval);
    }
    
    inventoryUnloadAmmoInterval = setInterval(() => {
        // マガジンアイテムがまだ存在するか確認
        const currentMagazine = inventoryItems.find(item => item.id === magazineItem.id);
        if (!currentMagazine || currentMagazine.quantity <= 0 || remainingAmmo <= 0) {
            clearInterval(inventoryUnloadAmmoInterval);
            inventoryUnloadAmmoInterval = null;
            saveInventoryItems();
            renderInventoryItems();
            return;
        }
        
        // ammo_stackから実際の弾薬タイプを取得（LIFO: 最初の要素が最後に込めた弾）
        let ammoName = null;
        let ammoStack = currentMagazine.ammo_stack;
        
        console.log(`[unloadAmmo] 開始 - ammo_stack (raw):`, currentMagazine.ammo_stack, `type:`, typeof currentMagazine.ammo_stack);
        
        // ammo_stackが文字列の場合はパース
        if (typeof ammoStack === 'string') {
            try {
                ammoStack = JSON.parse(ammoStack);
            } catch (e) {
                ammoStack = [];
            }
        }
        
        // ammo_stackが配列でない場合は空配列に初期化
        if (!Array.isArray(ammoStack)) {
            ammoStack = [];
        }
        
        // ammo_stackが存在し、要素がある場合
        if (ammoStack.length > 0) {
            const topAmmo = ammoStack[0];
            if (topAmmo && topAmmo.count > 0 && topAmmo.type) {
                ammoName = topAmmo.type;
                console.log(`[unloadAmmo] ammo_stackから取得: ${ammoName}, 残り: ${topAmmo.count}`);
                // スタックから1発減らす
                topAmmo.count--;
                // スタックが空になったら削除
                if (topAmmo.count <= 0) {
                    ammoStack.shift();
                }
            } else {
                console.log(`[unloadAmmo] ammo_stackの最初の要素が無効:`, topAmmo);
            }
        } else {
            console.log(`[unloadAmmo] ammo_stackが空です`);
        }
        
        // ammo_stackから取得できなかった場合は、口径からデフォルトの弾薬を取得
        if (!ammoName) {
            ammoName = findInventoryAmmoNameByCaliber(caliber);
            console.log(`[unloadAmmo] 口径から取得: ${ammoName} (口径: ${caliber})`);
        }
        
        // 1発抜く
        currentMagazine.quantity = (currentMagazine.quantity || 0) - 1;
        remainingAmmo--;
        
        // 更新されたammo_stackを保存（必ず配列として保存）
        currentMagazine.ammo_stack = ammoStack;
        
        // 弾薬をスタックに追加
        if (ammoName) {
            addInventoryAmmoToStack(ammoName, 1);
        }
        
        // リアルタイムで表示を更新
        renderInventoryItems();
        
        if (remainingAmmo <= 0) {
            clearInterval(inventoryUnloadAmmoInterval);
            inventoryUnloadAmmoInterval = null;
            saveInventoryItems();
        }
    }, 1000); // 1秒ごと
}

// 口径から弾薬名を取得
function findInventoryAmmoNameByCaliber(caliber) {
    for (const [ammoName, ammoData] of Object.entries(INVENTORY_AMMO_DATA)) {
        if (ammoData.caliber === caliber) {
            return ammoName;
        }
    }
    return null;
}

// 弾薬スタックに弾薬を追加（リグ→バックパックの順）
function addInventoryAmmoToStack(ammoName, amount) {
    if (!ammoName || amount <= 0) return;
    
    const ammoData = getInventoryAmmoData(ammoName);
    if (!ammoData) return;
    
    const stackSize = ammoData.stackSize || 60;
    let remaining = amount;
    
    // 1. リグ内の既存スタックを探す
    if (inventoryEquippedRig) {
        for (const item of inventoryItems) {
            if (remaining <= 0) break;
            if (item.item_type === 'ammo' && 
                item.item_name === ammoName && 
                item.parent_item_id === inventoryEquippedRig.id &&
                (item.quantity || 0) < stackSize) {
                const currentQuantity = item.quantity || 0;
                const availableSpace = stackSize - currentQuantity;
                const addAmount = Math.min(remaining, availableSpace);
                item.quantity = currentQuantity + addAmount;
                remaining -= addAmount;
            }
        }
        
        // リグ内に新しいスタックを作成
        while (remaining > 0) {
            let space = null;
            if (inventoryRigUsesSlots) {
                // スロットベースのリグの場合、空きスペースを探す
                for (const slot of inventoryRigSlots) {
                    const placement = findInventoryRigSlotPlacement(slot, { width: 1, height: 1 });
                    if (placement) {
                        space = { isSlot: true, slotId: slot.id, slotPosition: placement };
                        break;
                    }
                }
            } else {
                // グリッドベースのリグの場合
                space = findInventoryEmptySpaceInRig(1, 1);
            }
            
            if (space) {
                const addAmount = Math.min(remaining, stackSize);
                const newAmmoItem = {
                    item_type: 'ammo',
                    item_name: ammoName,
                    grid_x: space.isSlot ? -space.slotId : space.x,
                    grid_y: space.isSlot ? 0 : (space.y || 0),
                    width: 1,
                    height: 1,
                    quantity: addAmount,
                    equipped_slot: null,
                    parent_item_id: inventoryEquippedRig.id
                };
                if (space.isSlot) {
                    newAmmoItem.rig_slot_x = space.slotPosition?.x || 0;
                    newAmmoItem.rig_slot_y = space.slotPosition?.y || 0;
                }
                inventoryItems.push(newAmmoItem);
                
                if (space.isSlot) {
                    markInventoryRigSlotOccupied(
                        space.slotId,
                        newAmmoItem,
                        newAmmoItem.rig_slot_x || 0,
                        newAmmoItem.rig_slot_y || 0
                    );
                } else {
                    clearInventoryItemRigSlotPosition(newAmmoItem);
                }
                
                remaining -= addAmount;
            } else {
                break; // リグにスペースがない
            }
        }
    }
    
    // 2. バックパック内の既存スタックを探す
    if (remaining > 0 && inventoryEquippedBackpack) {
        for (const item of inventoryItems) {
            if (remaining <= 0) break;
            if (item.item_type === 'ammo' && 
                item.item_name === ammoName && 
                item.parent_item_id === inventoryEquippedBackpack.id &&
                (item.quantity || 0) < stackSize) {
                const currentQuantity = item.quantity || 0;
                const availableSpace = stackSize - currentQuantity;
                const addAmount = Math.min(remaining, availableSpace);
                item.quantity = currentQuantity + addAmount;
                remaining -= addAmount;
            }
        }
        
        // バックパック内に新しいスタックを作成
        while (remaining > 0) {
            const space = findInventoryEmptySpaceInBackpack(1, 1);
            if (space) {
                const addAmount = Math.min(remaining, stackSize);
                const newAmmoItem = {
                    item_type: 'ammo',
                    item_name: ammoName,
                    grid_x: space.x,
                    grid_y: space.y,
                    width: 1,
                    height: 1,
                    quantity: addAmount,
                    equipped_slot: null,
                    parent_item_id: inventoryEquippedBackpack.id
                };
                inventoryItems.push(newAmmoItem);
                remaining -= addAmount;
            } else {
                console.warn('弾薬を追加する空きスペースが見つかりません');
                break; // バックパックにスペースがない
            }
        }
    }
    
    if (remaining > 0) {
        console.warn(`弾薬を追加できませんでした。残り: ${remaining}発`);
    }
}

// インベントリドラッグ&ドロップ（完全実装）
function getInventoryItemElementUnderMouse(clientX, clientY, draggedElement) {
    if (draggedElement) {
        draggedElement.style.pointerEvents = 'none';
    }
    const element = document.elementFromPoint(clientX, clientY);
    if (draggedElement) {
        draggedElement.style.pointerEvents = '';
    }
    if (!element) return null;
    return element.closest('.item');
}

function clearInventoryMagazineHighlight() {
    if (inventoryHighlightedMagazineElement) {
        inventoryHighlightedMagazineElement.classList.remove('magazine-highlight');
        inventoryHighlightedMagazineElement.classList.remove('magazine-highlight-invalid');
        inventoryHighlightedMagazineElement = null;
    }
}

function highlightInventoryMagazineTarget(element, isValid) {
    if (!element) return;
    clearInventoryMagazineHighlight();
    inventoryHighlightedMagazineElement = element;
    if (isValid) {
        element.classList.add('magazine-highlight');
    } else {
        element.classList.add('magazine-highlight-invalid');
    }
}

function processInventoryAmmoToMagazineDrop(ammoItem, magazineItem) {
    clearInventoryMagazineHighlight();
    const magazineData = getInventoryMagazineData(magazineItem);
    const ammoData = getInventoryAmmoData(ammoItem);
    
    if (!magazineData || !ammoData || magazineData.caliber !== ammoData.caliber) {
        renderInventoryItems();
        return true;
    }
    
    const capacity = magazineData.capacity || 0;
    const current = magazineItem.quantity || 0;
    const available = ammoItem.quantity || 0;
    
    if (capacity <= current || available <= 0) {
        renderInventoryItems();
        return true;
    }
    
    const transferAmount = Math.min(capacity - current, available);
    magazineItem.quantity = current + transferAmount;
    ammoItem.quantity = available - transferAmount;
    
    // マガジンのammo_stackに弾薬の順番を記録（LIFO: 最後に込めた弾が最初に発射される）
    if (!magazineItem.ammo_stack) {
        magazineItem.ammo_stack = [];
    }
    // ammo_stackが文字列の場合はパース
    if (typeof magazineItem.ammo_stack === 'string') {
        try {
            magazineItem.ammo_stack = JSON.parse(magazineItem.ammo_stack);
        } catch (e) {
            magazineItem.ammo_stack = [];
        }
    }
    
    // 最後に込めた弾をスタックの先頭に追加
    magazineItem.ammo_stack.unshift({
        type: ammoItem.item_name,
        count: transferAmount
    });
    console.log(`[loadAmmo] マガジンに弾を込めました: ${ammoItem.item_name} x${transferAmount}, ammo_stack:`, JSON.stringify(magazineItem.ammo_stack));
    
    if (ammoItem.quantity <= 0) {
        const index = inventoryItems.indexOf(ammoItem);
        if (index !== -1) {
            inventoryItems.splice(index, 1);
        }
    }
    
    saveInventoryItems();
    renderInventoryItems();
    return true;
}

function getInventoryEquipmentSlotUnderMouse(x, y) {
    const slots = document.querySelectorAll('#inventoryEquipmentSlots .equipment-slot');
    for (const slot of slots) {
        const rect = slot.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return slot;
        }
    }
    return null;
}

// アタッチメントスロットを取得
function getInventoryAttachmentSlotUnderMouse(x, y) {
    const slots = document.querySelectorAll('.attachment-slot');
    for (const slot of slots) {
        const rect = slot.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return slot;
        }
    }
    return null;
}

// アタッチメントスロットをハイライト
function highlightInventoryAttachmentSlot(slot, item) {
    if (!slot || !item) return;
    
    // マガジンをマガジンスロットにドラッグしている場合
    if (item.item_type === 'magazine' && slot.dataset.attachmentType === 'magazine') {
        // モーダルが開いているか確認
        const modal = document.getElementById('inventoryItemDetailModal');
        if (modal && !modal.classList.contains('hidden')) {
            // 武器を取得（モーダルに表示されている武器）
            const weaponTitle = document.getElementById('inventoryDetailTitle');
            if (weaponTitle) {
                const weaponItem = inventoryItems.find(i => i.item_name === weaponTitle.textContent && i.item_type === 'weapon');
                if (weaponItem && canLoadMagazineIntoWeapon(item, weaponItem)) {
                    slot.style.border = '2px solid #0f0';
                    return;
                }
            }
        }
    }
    
    slot.style.border = '2px solid #f00';
}

// アタッチメントスロットのハイライトをクリア
function clearInventoryAttachmentHighlight() {
    const slots = document.querySelectorAll('.attachment-slot');
    slots.forEach(slot => {
        slot.style.border = '';
    });
}

function canInventoryEquipItem(item, slotType) {
    const itemType = item.item_type;
    switch (slotType) {
        case 'head':
            return itemType === 'helmet' || itemType === 'head';
        case 'armor':
            return itemType === 'armor';
        case 'rig':
            return itemType === 'rig' || itemType === 'tactical';
        case 'backpack':
            return itemType === 'backpack';
        case 'primary':
        case 'secondary':
            // 武器スロットには武器またはマガジンを装備可能
            return itemType === 'weapon' || itemType === 'magazine';
        default:
            return false;
    }
}

// マガジンが武器と互換性があるかチェック
function canLoadMagazineIntoWeapon(magazineItem, weaponItem) {
    if (!magazineItem || magazineItem.item_type !== 'magazine') return false;
    if (!weaponItem || weaponItem.item_type !== 'weapon') return false;
    
    const weaponData = WEAPON_DATA[weaponItem.item_name];
    if (!weaponData || !weaponData.compatibleMagazines) return false;
    
    return weaponData.compatibleMagazines.includes(magazineItem.item_name);
}

function highlightInventoryEquipmentSlot(slot, item) {
    clearInventoryEquipmentHighlight();
    const slotType = slot.dataset.slot;
    
    // マガジンを武器スロットにドラッグしている場合
    if (item.item_type === 'magazine' && (slotType === 'primary' || slotType === 'secondary')) {
        const weaponItem = inventoryItems.find(i => i.equipped_slot === slotType);
        if (weaponItem && canLoadMagazineIntoWeapon(item, weaponItem)) {
            slot.classList.add('drag-over');
        } else {
            slot.classList.add('drag-invalid');
        }
    } else if (canInventoryEquipItem(item, slotType)) {
        slot.classList.add('drag-over');
    } else {
        slot.classList.add('drag-invalid');
    }
}

function clearInventoryEquipmentHighlight() {
    document.querySelectorAll('#inventoryEquipmentSlots .equipment-slot').forEach(slot => {
        slot.classList.remove('drag-over');
        slot.classList.remove('drag-invalid');
    });
}

function isValidInventoryBackpackPosition(x, y, width, height, currentItem) {
    if (!inventoryEquippedBackpack || !inventoryBackpackGrid) return false;
    if (x < 0 || y < 0 || x + width > inventoryCurrentBackpackSize.width || y + height > inventoryCurrentBackpackSize.height) {
        return false;
    }
    
    for (const item of inventoryItems) {
        if (item === currentItem) continue;
        if (item.parent_item_id !== inventoryEquippedBackpack.id) continue;
        if (item.grid_x === null || item.grid_y === null) continue;
        
        if (!(x + width <= item.grid_x || x >= item.grid_x + item.width ||
              y + height <= item.grid_y || y >= item.grid_y + item.height)) {
            return false;
        }
    }
    
    return true;
}

function isValidInventoryRigPosition(x, y, width, height, currentItem) {
    if (inventoryRigUsesSlots) return false;
    if (!inventoryEquippedRig || !inventoryRigGrid) return false;
    if (x < 0 || y < 0 || x + width > inventoryCurrentRigGridSize.width || y + height > inventoryCurrentRigGridSize.height) {
        return false;
    }
    
    for (const item of inventoryItems) {
        if (item === currentItem) continue;
        if (item.parent_item_id !== inventoryEquippedRig.id) continue;
        if (item.grid_x === null || item.grid_y === null) continue;
        
        if (!(x + width <= item.grid_x || x >= item.grid_x + item.width ||
              y + height <= item.grid_y || y >= item.grid_y + item.height)) {
            return false;
        }
    }
    
    return true;
}

function canPlaceInInventoryRigSlot(item, slot, ignoreItem = null) {
    if (!slot || !item) return false;
    return !!findInventoryRigSlotPlacement(slot, item, ignoreItem);
}

function getInventoryRigSlotUnderMouse(clientX, clientY) {
    if (!inventoryRigSlots || inventoryRigSlots.length === 0) return null;
    return inventoryRigSlots.find(slot => {
        const rect = slot.element.getBoundingClientRect();
        return clientX >= rect.left && clientX <= rect.right &&
               clientY >= rect.top && clientY <= rect.bottom;
    }) || null;
}

function highlightInventoryRigSlot(slot, isValid) {
    if (!slot) return;
    clearInventoryRigHighlight();
    if (isValid) {
        slot.element.classList.add('rig-slot-highlight-valid');
    } else {
        slot.element.classList.add('rig-slot-highlight-invalid');
    }
}

function highlightInventoryBackpackDropZone(gridX, gridY, item) {
    clearInventoryBackpackHighlight();
    if (!inventoryBackpackGrid) return;
    
    for (let y = gridY; y < gridY + item.height; y++) {
        for (let x = gridX; x < gridX + item.width; x++) {
            if (y >= 0 && y < inventoryCurrentBackpackSize.height && x >= 0 && x < inventoryCurrentBackpackSize.width) {
                inventoryBackpackGrid[y][x].classList.add('drag-over');
            }
        }
    }
}

function clearInventoryBackpackHighlight() {
    if (inventoryBackpackGrid) {
        inventoryBackpackGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('drag-over');
            });
        });
    }
}

function highlightInventoryRigDropZone(gridX, gridY, item) {
    if (inventoryRigUsesSlots) return;
    clearInventoryRigHighlight();
    if (!inventoryRigGrid) return;
    
    for (let y = gridY; y < gridY + item.height; y++) {
        for (let x = gridX; x < gridX + item.width; x++) {
            if (y >= 0 && y < inventoryCurrentRigGridSize.height && x >= 0 && x < inventoryCurrentRigGridSize.width) {
                inventoryRigGrid[y][x].classList.add('drag-over');
            }
        }
    }
}

function clearInventoryRigHighlight() {
    if (inventoryRigGrid) {
        inventoryRigGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('drag-over');
            });
        });
    }
    if (inventoryRigSlots && inventoryRigSlots.length > 0) {
        inventoryRigSlots.forEach(slot => {
            slot.element.classList.remove('rig-slot-highlight-valid');
            slot.element.classList.remove('rig-slot-highlight-invalid');
        });
    }
}

async function saveInventoryItems() {
    try {
        const itemsToSave = inventoryItems.map(item => ({
            id: item.id || null, // 新しいアイテムにはidがない場合がある
            item_type: item.item_type,
            item_name: item.item_name,
            grid_x: item.grid_x,
            grid_y: item.grid_y,
            width: item.width,
            height: item.height,
            equipped_slot: item.equipped_slot,
            quantity: item.quantity,
            parent_item_id: item.parent_item_id || null,
            ammo_stack: item.ammo_stack ? (typeof item.ammo_stack === 'string' ? item.ammo_stack : JSON.stringify(item.ammo_stack)) : null,
            rig_slot_x: item.rig_slot_x !== undefined ? item.rig_slot_x : null,
            rig_slot_y: item.rig_slot_y !== undefined ? item.rig_slot_y : null,
            weapon_durability: item.weapon_durability !== undefined ? item.weapon_durability : null
        }));
        
        const response = await fetch('/api/character/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ items: itemsToSave })
        });
        
        const data = await response.json();
        if (!data.success) {
            console.error('アイテムの保存に失敗しました:', data.message);
        } else {
            await loadInventoryItems();
        }
    } catch (error) {
        console.error('アイテムの保存に失敗しました:', error);
    }
}

function startInventoryDrag(e, itemElement, item) {
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    hideInventoryContextMenu();
    hideInventoryDetailModal();
    
    inventoryIsCtrlPressed = false;
    inventoryDraggedItem = { element: itemElement, item: item };
    
    const rect = itemElement.getBoundingClientRect();
    inventoryDragOffset.x = e.clientX - rect.left;
    inventoryDragOffset.y = e.clientY - rect.top;
    
    itemElement.style.position = 'fixed';
    itemElement.style.zIndex = '10000';
    itemElement.style.left = `${rect.left}px`;
    itemElement.style.top = `${rect.top}px`;
    itemElement.classList.add('dragging');
    
    document.addEventListener('mousemove', onInventoryDrag);
    document.addEventListener('mouseup', stopInventoryDrag);
    document.addEventListener('keydown', checkInventoryCtrlKey);
    document.addEventListener('keyup', checkInventoryCtrlKey);
}

function checkInventoryCtrlKey(e) {
    if (inventoryDraggedItem) {
        inventoryIsCtrlPressed = e.ctrlKey || e.metaKey;
    }
}

function onInventoryDrag(e) {
    if (!inventoryDraggedItem) return;
    
    const itemElement = inventoryDraggedItem.element;
    const item = inventoryDraggedItem.item;
    
    itemElement.style.left = `${e.clientX - inventoryDragOffset.x}px`;
    itemElement.style.top = `${e.clientY - inventoryDragOffset.y}px`;
    
    clearInventoryMagazineHighlight();
    if (item.item_type === 'ammo') {
        const targetItemElement = getInventoryItemElementUnderMouse(e.clientX, e.clientY, itemElement);
        const targetItem = getInventoryItemFromElement(targetItemElement);
        if (targetItem && targetItem.item_type === 'magazine') {
            const isValid = canLoadInventoryAmmoIntoMagazine(item, targetItem);
            highlightInventoryMagazineTarget(targetItemElement, isValid);
            clearInventoryBackpackHighlight();
            clearInventoryRigHighlight();
            clearInventoryEquipmentHighlight();
            return;
        }
    }
    
    // アタッチメントスロットをチェック
    const attachmentSlot = getInventoryAttachmentSlotUnderMouse(e.clientX, e.clientY);
    if (attachmentSlot) {
        highlightInventoryAttachmentSlot(attachmentSlot, item);
        clearInventoryBackpackHighlight();
        clearInventoryRigHighlight();
        clearInventoryEquipmentHighlight();
        return;
    }
    
    const equipmentSlot = getInventoryEquipmentSlotUnderMouse(e.clientX, e.clientY);
    if (equipmentSlot) {
        highlightInventoryEquipmentSlot(equipmentSlot, item);
        clearInventoryBackpackHighlight();
        clearInventoryRigHighlight();
    } else {
        const els = getInventoryElements();
        if (inventoryEquippedRig && els.rigPanel && !els.rigPanel.classList.contains('hidden')) {
            if (inventoryRigUsesSlots) {
                const slot = getInventoryRigSlotUnderMouse(e.clientX, e.clientY);
                if (slot) {
                    const isValid = canPlaceInInventoryRigSlot(item, slot, item);
                    highlightInventoryRigSlot(slot, isValid);
                    clearInventoryBackpackHighlight();
                    clearInventoryEquipmentHighlight();
                    return;
                } else {
                    clearInventoryRigHighlight();
                }
            } else if (els.rigGrid) {
                const rigRect = els.rigGrid.getBoundingClientRect();
                if (e.clientX >= rigRect.left && e.clientX <= rigRect.right &&
                    e.clientY >= rigRect.top && e.clientY <= rigRect.bottom) {
                    const gridX = Math.floor((e.clientX - rigRect.left - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                    const gridY = Math.floor((e.clientY - rigRect.top - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                    highlightInventoryRigDropZone(gridX, gridY, item);
                    clearInventoryBackpackHighlight();
                    clearInventoryEquipmentHighlight();
                    return;
                }
            }
        }
        
        if (inventoryEquippedBackpack && els.backpackPanel && !els.backpackPanel.classList.contains('hidden') && els.backpackGrid) {
            const backpackRect = els.backpackGrid.getBoundingClientRect();
            if (e.clientX >= backpackRect.left && e.clientX <= backpackRect.right &&
                e.clientY >= backpackRect.top && e.clientY <= backpackRect.bottom) {
                const gridX = Math.floor((e.clientX - backpackRect.left - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                const gridY = Math.floor((e.clientY - backpackRect.top - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                highlightInventoryBackpackDropZone(gridX, gridY, item);
                clearInventoryRigHighlight();
                clearInventoryEquipmentHighlight();
                return;
            }
        }
        
        clearInventoryBackpackHighlight();
        clearInventoryRigHighlight();
        clearInventoryEquipmentHighlight();
        clearInventoryAttachmentHighlight();
    }
}

function stopInventoryDrag(e) {
    if (!inventoryDraggedItem) return;
    
    const itemElement = inventoryDraggedItem.element;
    const item = inventoryDraggedItem.item;
    
    document.removeEventListener('keydown', checkInventoryCtrlKey);
    document.removeEventListener('keyup', checkInventoryCtrlKey);
    
    const ctrlPressed = e.ctrlKey || e.metaKey || inventoryIsCtrlPressed;
    
    clearInventoryMagazineHighlight();
    clearInventoryAttachmentHighlight();
    let handledSpecialDrop = false;
    
    if (item.item_type === 'ammo' && !handledSpecialDrop) {
        const targetElement = getInventoryItemElementUnderMouse(e.clientX, e.clientY, itemElement);
        const targetItem = getInventoryItemFromElement(targetElement);
        
        if (targetItem && targetItem !== item && targetItem.item_type === 'magazine') {
            handledSpecialDrop = processInventoryAmmoToMagazineDrop(item, targetItem);
        }
    }
    
    // アタッチメントスロットにドロップした場合
    const attachmentSlot = getInventoryAttachmentSlotUnderMouse(e.clientX, e.clientY);
    if (attachmentSlot && !handledSpecialDrop) {
        if (item.item_type === 'magazine' && attachmentSlot.dataset.attachmentType === 'magazine') {
            // モーダルが開いているか確認
            const modal = document.getElementById('inventoryItemDetailModal');
            if (modal && !modal.classList.contains('hidden')) {
                const weaponTitle = document.getElementById('inventoryDetailTitle');
                if (weaponTitle) {
                    const weaponItem = inventoryItems.find(i => i.item_name === weaponTitle.textContent && i.item_type === 'weapon');
                    if (weaponItem && canLoadMagazineIntoWeapon(item, weaponItem)) {
                        // 既に武器に装填されているマガジンを探す
                        const existingMagazine = inventoryItems.find(i => 
                            i.item_type === 'magazine' && 
                            i.parent_item_id === weaponItem.id &&
                            i.grid_x === null && 
                            i.grid_y === null
                        );
                        
                        // 既存のマガジンをリグまたはバックパックに戻す
                        if (existingMagazine) {
                            let moved = false;
                            if (inventoryEquippedRig) {
                                const rigSpace = findInventoryEmptySpaceInRig(existingMagazine.width, existingMagazine.height);
                                if (rigSpace) {
                                    existingMagazine.grid_x = rigSpace.x;
                                    existingMagazine.grid_y = rigSpace.y;
                                    existingMagazine.parent_item_id = inventoryEquippedRig.id;
                                    moved = true;
                                } else if (inventoryEquippedBackpack) {
                                    const backpackSpace = findInventoryEmptySpaceInBackpack(existingMagazine.width, existingMagazine.height);
                                    if (backpackSpace) {
                                        existingMagazine.grid_x = backpackSpace.x;
                                        existingMagazine.grid_y = backpackSpace.y;
                                        existingMagazine.parent_item_id = inventoryEquippedBackpack.id;
                                        moved = true;
                                    }
                                }
                            } else if (inventoryEquippedBackpack) {
                                const backpackSpace = findInventoryEmptySpaceInBackpack(existingMagazine.width, existingMagazine.height);
                                if (backpackSpace) {
                                    existingMagazine.grid_x = backpackSpace.x;
                                    existingMagazine.grid_y = backpackSpace.y;
                                    existingMagazine.parent_item_id = inventoryEquippedBackpack.id;
                                    moved = true;
                                }
                            }
                            
                            if (!moved) {
                                // 空きスペースがない場合は元の位置に戻す
                                renderInventoryItems();
                                itemElement.classList.remove('dragging');
                                clearInventoryBackpackHighlight();
                                clearInventoryRigHighlight();
                                clearInventoryEquipmentHighlight();
                                clearInventoryAttachmentHighlight();
                                inventoryDraggedItem = null;
                                document.removeEventListener('mousemove', onInventoryDrag);
                                document.removeEventListener('mouseup', stopInventoryDrag);
                                return;
                            }
                        }
                        
                        // マガジンを武器に装填
                        item.parent_item_id = weaponItem.id;
                        item.grid_x = null;
                        item.grid_y = null;
                        item.equipped_slot = null;
                        clearInventoryItemRigSlotPosition(item);
                        saveInventoryItems();
                        renderInventoryItems();
                        
                        // アタッチメント欄を再描画
                        renderWeaponAttachments(weaponItem);
                        
                        // マガジンを装填した後、ゲーム状態を更新
                        loadInitialMagazine();
                        
                        itemElement.classList.remove('dragging');
                        clearInventoryBackpackHighlight();
                        clearInventoryRigHighlight();
                        clearInventoryEquipmentHighlight();
                        clearInventoryAttachmentHighlight();
                        inventoryDraggedItem = null;
                        document.removeEventListener('mousemove', onInventoryDrag);
                        document.removeEventListener('mouseup', stopInventoryDrag);
                        return;
                    }
                }
            }
        }
    }
    
    if (handledSpecialDrop) {
        itemElement.classList.remove('dragging');
        itemElement.style.pointerEvents = '';
        clearInventoryBackpackHighlight();
        clearInventoryRigHighlight();
        clearInventoryEquipmentHighlight();
        clearInventoryAttachmentHighlight();
        inventoryDraggedItem = null;
        document.removeEventListener('mousemove', onInventoryDrag);
        document.removeEventListener('mouseup', stopInventoryDrag);
        return;
    }
    
    const equipmentSlot = getInventoryEquipmentSlotUnderMouse(e.clientX, e.clientY);
    const slotType = equipmentSlot ? equipmentSlot.dataset.slot : null;
    
    // マガジンを武器スロットにドロップした場合
    if (equipmentSlot && item.item_type === 'magazine' && (slotType === 'primary' || slotType === 'secondary')) {
        const weaponItem = inventoryItems.find(i => i.equipped_slot === slotType);
        if (weaponItem && canLoadMagazineIntoWeapon(item, weaponItem)) {
            // 既に武器に装填されているマガジンを探す
            const existingMagazine = inventoryItems.find(i => 
                i.item_type === 'magazine' && 
                i.parent_item_id === weaponItem.id &&
                i.grid_x === null && 
                i.grid_y === null
            );
            
            // 既存のマガジンをリグまたはバックパックに戻す
            if (existingMagazine) {
                let moved = false;
                if (inventoryEquippedRig) {
                    const rigSpace = findInventoryEmptySpaceInRig(existingMagazine.width, existingMagazine.height);
                    if (rigSpace) {
                        existingMagazine.grid_x = rigSpace.x;
                        existingMagazine.grid_y = rigSpace.y;
                        existingMagazine.parent_item_id = inventoryEquippedRig.id;
                        moved = true;
                    } else if (inventoryEquippedBackpack) {
                        const backpackSpace = findInventoryEmptySpaceInBackpack(existingMagazine.width, existingMagazine.height);
                        if (backpackSpace) {
                            existingMagazine.grid_x = backpackSpace.x;
                            existingMagazine.grid_y = backpackSpace.y;
                            existingMagazine.parent_item_id = inventoryEquippedBackpack.id;
                            moved = true;
                        }
                    }
                } else if (inventoryEquippedBackpack) {
                    const backpackSpace = findInventoryEmptySpaceInBackpack(existingMagazine.width, existingMagazine.height);
                    if (backpackSpace) {
                        existingMagazine.grid_x = backpackSpace.x;
                        existingMagazine.grid_y = backpackSpace.y;
                        existingMagazine.parent_item_id = inventoryEquippedBackpack.id;
                        moved = true;
                    }
                }
                
                if (!moved) {
                    // 空きスペースがない場合は元の位置に戻す
                    renderInventoryItems();
                    itemElement.classList.remove('dragging');
                    clearInventoryBackpackHighlight();
                    clearInventoryRigHighlight();
                    clearInventoryEquipmentHighlight();
                    inventoryDraggedItem = null;
                    document.removeEventListener('mousemove', onInventoryDrag);
                    document.removeEventListener('mouseup', stopInventoryDrag);
                    return;
                }
            }
            
            // マガジンを武器に装填
            item.parent_item_id = weaponItem.id;
            item.grid_x = null;
            item.grid_y = null;
            item.equipped_slot = null;
            clearInventoryItemRigSlotPosition(item);
            saveInventoryItems();
            renderInventoryItems();
            
            // アタッチメント欄を再描画（武器詳細モーダルが開いている場合）
            const modal = document.getElementById('inventoryItemDetailModal');
            if (modal && !modal.classList.contains('hidden')) {
                const weaponTitle = document.getElementById('inventoryDetailTitle');
                if (weaponTitle && weaponTitle.textContent === weaponItem.item_name) {
                    renderWeaponAttachments(weaponItem);
                }
            }
            
            // マガジンを装填した後、ゲーム状態を更新
            loadInitialMagazine();
            
            itemElement.classList.remove('dragging');
            clearInventoryBackpackHighlight();
            clearInventoryRigHighlight();
            clearInventoryEquipmentHighlight();
            inventoryDraggedItem = null;
            document.removeEventListener('mousemove', onInventoryDrag);
            document.removeEventListener('mouseup', stopInventoryDrag);
            return;
        } else {
            // 互換性がない場合は元の位置に戻す
            renderInventoryItems();
            itemElement.classList.remove('dragging');
            clearInventoryBackpackHighlight();
            clearInventoryRigHighlight();
            clearInventoryEquipmentHighlight();
            inventoryDraggedItem = null;
            document.removeEventListener('mousemove', onInventoryDrag);
            document.removeEventListener('mouseup', stopInventoryDrag);
            return;
        }
    }
    
    if (equipmentSlot && canInventoryEquipItem(item, slotType)) {
        const existingItem = inventoryItems.find(i => i.equipped_slot === slotType);
        if (existingItem) {
            // 既存のアイテムをリグまたはバックパックに移動
            if (inventoryEquippedRig) {
                const rigSpace = findInventoryEmptySpaceInRig(existingItem.width, existingItem.height);
                if (rigSpace) {
                    existingItem.grid_x = rigSpace.x;
                    existingItem.grid_y = rigSpace.y;
                    existingItem.equipped_slot = null;
                    existingItem.parent_item_id = inventoryEquippedRig.id;
                } else if (inventoryEquippedBackpack) {
                    const backpackSpace = findInventoryEmptySpaceInBackpack(existingItem.width, existingItem.height);
                    if (backpackSpace) {
                        existingItem.grid_x = backpackSpace.x;
                        existingItem.grid_y = backpackSpace.y;
                        existingItem.equipped_slot = null;
                        existingItem.parent_item_id = inventoryEquippedBackpack.id;
                    } else {
                        renderInventoryItems();
                        itemElement.classList.remove('dragging');
                        clearInventoryBackpackHighlight();
                        clearInventoryRigHighlight();
                        clearInventoryEquipmentHighlight();
                        inventoryDraggedItem = null;
                        document.removeEventListener('mousemove', onInventoryDrag);
                        document.removeEventListener('mouseup', stopInventoryDrag);
                        return;
                    }
                } else {
                    renderInventoryItems();
                    itemElement.classList.remove('dragging');
                    clearInventoryBackpackHighlight();
                    clearInventoryRigHighlight();
                    clearInventoryEquipmentHighlight();
                    inventoryDraggedItem = null;
                    document.removeEventListener('mousemove', onInventoryDrag);
                    document.removeEventListener('mouseup', stopInventoryDrag);
                    return;
                }
            } else if (inventoryEquippedBackpack) {
                const backpackSpace = findInventoryEmptySpaceInBackpack(existingItem.width, existingItem.height);
                if (backpackSpace) {
                    existingItem.grid_x = backpackSpace.x;
                    existingItem.grid_y = backpackSpace.y;
                    existingItem.equipped_slot = null;
                    existingItem.parent_item_id = inventoryEquippedBackpack.id;
                } else {
                    renderInventoryItems();
                    itemElement.classList.remove('dragging');
                    clearInventoryBackpackHighlight();
                    clearInventoryRigHighlight();
                    clearInventoryEquipmentHighlight();
                    inventoryDraggedItem = null;
                    document.removeEventListener('mousemove', onInventoryDrag);
                    document.removeEventListener('mouseup', stopInventoryDrag);
                    return;
                }
            } else {
                renderInventoryItems();
                itemElement.classList.remove('dragging');
                clearInventoryBackpackHighlight();
                clearInventoryRigHighlight();
                clearInventoryEquipmentHighlight();
                inventoryDraggedItem = null;
                document.removeEventListener('mousemove', onInventoryDrag);
                document.removeEventListener('mouseup', stopInventoryDrag);
                return;
            }
        }
        
        item.equipped_slot = equipmentSlot.dataset.slot;
        item.grid_x = null;
        item.grid_y = null;
        item.parent_item_id = null;
        clearInventoryItemRigSlotPosition(item);
        saveInventoryItems();
        renderInventoryItems();
    } else {
        const els = getInventoryElements();
        let handled = false;
        
        if (inventoryEquippedRig && els.rigPanel && !els.rigPanel.classList.contains('hidden')) {
            if (inventoryRigUsesSlots) {
                const slot = getInventoryRigSlotUnderMouse(e.clientX, e.clientY);
                if (slot) {
                    const placement = findInventoryRigSlotPlacement(slot, item, item);
                    if (placement) {
                        item.grid_x = -slot.id;
                        item.grid_y = 0;
                        item.equipped_slot = null;
                        item.parent_item_id = inventoryEquippedRig.id;
                        item.rig_slot_x = placement.x;
                        item.rig_slot_y = placement.y;
                        saveInventoryItems();
                        renderInventoryItems();
                        handled = true;
                    }
                }
            } else if (els.rigGrid) {
                const rigRect = els.rigGrid.getBoundingClientRect();
                if (e.clientX >= rigRect.left && e.clientX <= rigRect.right &&
                    e.clientY >= rigRect.top && e.clientY <= rigRect.bottom) {
                    const gridX = Math.floor((e.clientX - rigRect.left - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                    const gridY = Math.floor((e.clientY - rigRect.top - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                    
                    if (isValidInventoryRigPosition(gridX, gridY, item.width, item.height, item)) {
                        item.grid_x = gridX;
                        item.grid_y = gridY;
                        item.equipped_slot = null;
                        item.parent_item_id = inventoryEquippedRig.id;
                        clearInventoryItemRigSlotPosition(item);
                        saveInventoryItems();
                        renderInventoryItems();
                        handled = true;
                    }
                }
            }
        }
        
        if (!handled && inventoryEquippedBackpack && els.backpackPanel && !els.backpackPanel.classList.contains('hidden') && els.backpackGrid) {
            const backpackRect = els.backpackGrid.getBoundingClientRect();
            if (e.clientX >= backpackRect.left && e.clientX <= backpackRect.right &&
                e.clientY >= backpackRect.top && e.clientY <= backpackRect.bottom) {
                const gridX = Math.floor((e.clientX - backpackRect.left - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                const gridY = Math.floor((e.clientY - backpackRect.top - INVENTORY_GRID_PADDING) / (INVENTORY_GRID_CELL_SIZE + INVENTORY_GRID_GAP));
                
                if (isValidInventoryBackpackPosition(gridX, gridY, item.width, item.height, item)) {
                    item.grid_x = gridX;
                    item.grid_y = gridY;
                    item.equipped_slot = null;
                    item.parent_item_id = inventoryEquippedBackpack.id;
                    clearInventoryItemRigSlotPosition(item);
                    saveInventoryItems();
                    renderInventoryItems();
                    handled = true;
                }
            }
        }
        
        if (!handled) {
            renderInventoryItems();
        }
    }
    
    itemElement.classList.remove('dragging');
    clearInventoryBackpackHighlight();
    clearInventoryRigHighlight();
    clearInventoryEquipmentHighlight();
    clearInventoryAttachmentHighlight();
    inventoryDraggedItem = null;
    inventoryIsCtrlPressed = false;
    document.removeEventListener('mousemove', onInventoryDrag);
    document.removeEventListener('mouseup', stopInventoryDrag);
}

function findInventoryEmptySpaceInRig(width, height) {
    if (!inventoryEquippedRig || !inventoryRigGrid) return null;
    
    for (let y = 0; y <= inventoryCurrentRigGridSize.height - height; y++) {
        for (let x = 0; x <= inventoryCurrentRigGridSize.width - width; x++) {
            if (isValidInventoryRigPosition(x, y, width, height, null)) {
                return { x, y };
            }
        }
    }
    return null;
}

function findInventoryEmptySpaceInBackpack(width, height) {
    if (!inventoryEquippedBackpack || !inventoryBackpackGrid) return null;
    
    for (let y = 0; y <= inventoryCurrentBackpackSize.height - height; y++) {
        for (let x = 0; x <= inventoryCurrentBackpackSize.width - width; x++) {
            if (isValidInventoryBackpackPosition(x, y, width, height, null)) {
                return { x, y };
            }
        }
    }
    return null;
}

function ensureBackpackEquipped() {
    if (inventoryEquippedBackpack) return true;
    const candidate = inventoryItems.find(item => item.item_type === 'backpack');
    if (!candidate) return false;
    candidate.equipped_slot = 'backpack';
    candidate.parent_item_id = null;
    candidate.grid_x = null;
    candidate.grid_y = null;
    inventoryEquippedBackpack = candidate;
    renderInventoryItems();
    saveInventoryItems();
    return true;
}

function ensureRigEquipped() {
    if (inventoryEquippedRig) return true;
    const candidate = inventoryItems.find(item => item.item_type === 'rig');
    if (!candidate) return false;
    candidate.equipped_slot = 'rig';
    candidate.parent_item_id = null;
    candidate.grid_x = null;
    candidate.grid_y = null;
    inventoryEquippedRig = candidate;
    renderInventoryItems();
    saveInventoryItems();
    return true;
}

async function storeLootItemInInventory(newItem) {
    if (!newItem) return null;
    
    // 武器の場合、まず装備スロットをチェック
    if (newItem.item_type === 'weapon') {
        // primaryスロットが空いているかチェック
        const primaryWeapon = inventoryItems.find(item => item.equipped_slot === 'primary');
        if (!primaryWeapon) {
            newItem.equipped_slot = 'primary';
            newItem.parent_item_id = null;
            newItem.grid_x = null;
            newItem.grid_y = null;
            inventoryItems.push(newItem);
            renderInventoryItems();
            await saveInventoryItems();
            return 'equip-primary';
        }
        
        // secondaryスロットが空いているかチェック
        const secondaryWeapon = inventoryItems.find(item => item.equipped_slot === 'secondary');
        if (!secondaryWeapon) {
            newItem.equipped_slot = 'secondary';
            newItem.parent_item_id = null;
            newItem.grid_x = null;
            newItem.grid_y = null;
            inventoryItems.push(newItem);
            renderInventoryItems();
            await saveInventoryItems();
            return 'equip-secondary';
        }
        
        // 両方のスロットが埋まっている場合、バックパックが必要
        if (!inventoryEquippedBackpack) {
            return null; // バックパックが必要
        }
    }
    
    if (newItem.item_type === 'backpack' && !inventoryEquippedBackpack) {
        newItem.equipped_slot = 'backpack';
        newItem.parent_item_id = null;
        newItem.grid_x = null;
        newItem.grid_y = null;
        inventoryItems.push(newItem);
        inventoryEquippedBackpack = newItem;
        renderInventoryItems();
        await saveInventoryItems();
        return 'equip-backpack';
    }
    
    if (newItem.item_type === 'rig' && !inventoryEquippedRig) {
        newItem.equipped_slot = 'rig';
        newItem.parent_item_id = null;
        newItem.grid_x = null;
        newItem.grid_y = null;
        inventoryItems.push(newItem);
        inventoryEquippedRig = newItem;
        renderInventoryItems();
        await saveInventoryItems();
        return 'equip-rig';
    }
    
    if (inventoryEquippedBackpack) {
        const backpackSpace = findInventoryEmptySpaceInBackpack(newItem.width, newItem.height);
        if (backpackSpace) {
            newItem.grid_x = backpackSpace.x;
            newItem.grid_y = backpackSpace.y;
            newItem.parent_item_id = inventoryEquippedBackpack.id;
            inventoryItems.push(newItem);
            renderInventoryItems();
            await saveInventoryItems();
            return 'backpack';
        }
    }
    
    const canStoreInRig = newItem.item_type !== 'backpack' && newItem.item_type !== 'rig';
    if (canStoreInRig && inventoryEquippedRig) {
        const rigSpace = findInventoryEmptySpaceInRig(newItem.width, newItem.height);
        if (rigSpace) {
            newItem.grid_x = rigSpace.x;
            newItem.grid_y = rigSpace.y;
            newItem.parent_item_id = inventoryEquippedRig.id;
            inventoryItems.push(newItem);
            renderInventoryItems();
            await saveInventoryItems();
            return 'rig';
        }
    }
    
    return null;
}

// インベントリの開閉
function openInventory() {
    const els = getInventoryElements();
    if (!els.overlay) return;
    
    // ポインターロックを解除
    if (document.pointerLockElement) {
        document.exitPointerLock();
    }
    
    inventoryOpen = true;
    els.overlay.classList.remove('hidden');
    renderInventoryItems();
    // 異常状態表示を更新
    updateStatusEffectsDisplay();
}

function closeInventory() {
    const els = getInventoryElements();
    if (!els.overlay) return;
    
    inventoryOpen = false;
    els.overlay.classList.add('hidden');
    hideInventoryTooltip();
    hideInventoryContextMenu();
    hideInventoryDetailModal();
    
    // ポインターロックを再開
    if (renderer && renderer.domElement && !document.pointerLockElement) {
        renderer.domElement.requestPointerLock();
    }
}

// インベントリ初期化
function initInventory() {
    createInventoryBackpackGrid(INVENTORY_DEFAULT_BACKPACK_SIZE);
    setupInventoryRigStructure(null);
    
    // イベントリスナー設定
    const els = getInventoryElements();
    if (els.contextDetailButton) {
        els.contextDetailButton.addEventListener('click', () => {
            if (inventoryContextMenuItem) {
                if (inventoryContextMenuItem.item_type === 'ammo') {
                    showInventoryAmmoDetails(inventoryContextMenuItem);
                } else if (inventoryContextMenuItem.item_type === 'weapon') {
                    showInventoryWeaponDetails(inventoryContextMenuItem);
                } else if (inventoryContextMenuItem.item_type === 'medical') {
                    showInventoryMedicalDetails(inventoryContextMenuItem);
                }
                hideInventoryContextMenu();
            }
        });
    }
    
    if (els.detailCloseButton) {
        els.detailCloseButton.addEventListener('click', () => {
            hideInventoryDetailModal();
        });
    }
    
    if (els.contextUnloadAmmoButton) {
        els.contextUnloadAmmoButton.addEventListener('click', () => {
            if (inventoryContextMenuItem && inventoryContextMenuItem.item_type === 'magazine') {
                unloadInventoryAmmoFromMagazine(inventoryContextMenuItem);
                hideInventoryContextMenu();
            }
        });
    }
    
    if (els.contextUnloadMagazineButton) {
        els.contextUnloadMagazineButton.addEventListener('click', () => {
            if (inventoryContextMenuItem && inventoryContextMenuItem.item_type === 'weapon') {
                unloadInventoryMagazineFromWeapon(inventoryContextMenuItem);
                hideInventoryContextMenu();
            }
        });
    }

    if (els.contextUseButton) {
        els.contextUseButton.addEventListener('click', () => {
            if (inventoryContextMenuItem) {
                if (inventoryContextMenuItem.item_type === 'medical') {
                    requestMedicalItemUse(inventoryContextMenuItem);
                    hideInventoryContextMenu();
                } else if (inventoryContextMenuItem.item_type === 'flare') {
                    useFlareItem(inventoryContextMenuItem);
                    hideInventoryContextMenu();
                }
            }
        });
    }
    
    if (els.contextDropButton) {
        els.contextDropButton.addEventListener('click', () => {
            if (inventoryContextMenuItem) {
                dropInventoryItemToGround(inventoryContextMenuItem);
                hideInventoryContextMenu();
            }
        });
    }
    
    // Tabキーでインベントリを開閉
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            if (inventoryOpen) {
                closeInventory();
            } else {
                openInventory();
            }
        }
    });
    
    // コンテキストメニュー外をクリックで閉じる
    document.addEventListener('click', (e) => {
        if (inventoryOpen && els.itemContextMenu && !els.itemContextMenu.contains(e.target)) {
            hideInventoryContextMenu();
        }
    });
}

// ゲーム開始
async function startGame() {
    // エネルギー・水分を読み込み
    loadEnergyHydration();
    
    // 装備アイテムを読み込んでからゲームを初期化
    await loadEquippedItems();
    
    // インベントリを初期化
    initInventory();
    await loadInventoryItems();
    syncWeaponDurabilityToInventory();
    updateWeaponDisplayText();
    
    GAME_CONFIG.isInGame = true;
    GAME_CONFIG.lastUpdateTime = Date.now();
    raidStartTimestamp = Date.now();
    activeFlareType = null;
    exitHandlerSuppressed = false;
    
    if (!exitListenersAttached) {
        window.addEventListener('beforeunload', handleForcedExitEvent);
        window.addEventListener('pagehide', handleForcedExitEvent);
        exitListenersAttached = true;
    }
    
    init();
}

setupMedicalUIControls();
setupSelfDamageControls();
startGame();


