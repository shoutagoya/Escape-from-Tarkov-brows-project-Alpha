// キャラクター画面のJavaScript

// グローバル変数
const STASH_SIZE = { width: 12, height: 100 }; // 横12マス固定、縦は可変
const DEFAULT_BACKPACK_SIZE = { width: 5, height: 4 }; // バックパックのデフォルトサイズ
const DEFAULT_RIG_SIZE = { width: 4, height: 2 }; // リグのデフォルトサイズ
const RIG_SLOT_SIZES = {
    1: { width: 1, height: 2 },
    2: { width: 1, height: 2 },
    3: { width: 1, height: 3 },
    4: { width: 2, height: 2 }
};
const GRID_CELL_SIZE = 45; // ピクセル（表示サイズをコンパクトに）
const STASH_GRID_CELL_SIZE = GRID_CELL_SIZE * 1.40625; // 倉庫スタッシュ用のマスサイズ（従来比1.25倍）
const BACKPACK_GRID_CELL_SIZE = GRID_CELL_SIZE * 1.25; // バックパック用マスサイズ
const RIG_GRID_CELL_SIZE = GRID_CELL_SIZE * 1.25; // リグ用マスサイズ
const GRID_GAP = 2;
const GRID_PADDING = 5;
const AMMO_IMAGE_BASE_PATH = '/pic/ammo/';
const BACKPACK_IMAGE_BASE_PATH = '/pic/backpack/';
const RIG_IMAGE_BASE_PATH = '/pic/rig/';
const GUN_IMAGE_BASE_PATH = '/pic/gun/';
const MEDICAL_IMAGE_BASE_PATH = '/pic/medkit/';
const MAGAZINE_IMAGE_BASE_PATH = '/pic/magazin/';
const ARMOR_IMAGE_BASE_PATH = '/pic/armor/';
const HELMET_IMAGE_BASE_PATH = '/pic/helmet/';
const TICKET_IMAGE_BASE_PATH = '/pic/ticket/';
const WEAPON_DURABILITY_MAX = 100;
let items = [];
let draggedItem = null;
let dragOffset = { x: 0, y: 0 };
let isCtrlPressed = false;
let stashGrid = null;
let backpackGrid = null;
let rigGrid = null;
let equippedBackpack = null;
let equippedRig = null;
let highlightedMagazineElement = null;
let currentBackpackSize = { ...DEFAULT_BACKPACK_SIZE };
let currentRigGridSize = { ...DEFAULT_RIG_SIZE };
let rigUsesSlots = false;
let rigSlots = [];
let rigSlotOccupancy = new Map(); // slotId -> Array of items in the slot
let lastMousePosition = null;
let currentTooltipContainer = null;

const AMMO_DATA = {
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
        imageFile: '5.45x39mm BT gs.png'
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
    '5.45x39mm PS gs': {
        fullName: '5.45x39mm PS gs',
        caliber: '5.45x39mm',
        stackSize: 60,
        damage: 56,
        penetration: 28,
        velocity: 890,
        special: 'なし',
        imageFile: '5.45x39mm PS gs.png'
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
    },
    '12x70mm 8.5mm Magnum Buckshot': {
        fullName: '12x70mm 8.5mm Magnum Buckshot',
        caliber: '12x70mm',
        stackSize: 20,
        damage: 400,
        penetration: 2,
        velocity: 385,
        special: '精度-15%,反動+115%',
        imageFile: '12x70mm 8.5mm Magnum Buckshot.png'
    }
};

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
    'CMS surgical kit (CMS)': {
        name: 'CMS surgical kit (CMS)',
        cures: ['blackedOut'],
        blackedOutCost: 1,
        durability: 3,
        useTime: 16,
        stashSize: { width: 2, height: 1 },
        imageFile: 'CMS surgical kit.png'
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
    }
};

const MAGAZINE_DATA = {
    '5.56x45mm standard 30連マガジン': { capacity: 30, caliber: '5.56x45mm', imageFile: '5.56x45mm standard 30連マガジン.png' },
    '5.45x39mm standard 30連マガジン': { capacity: 30, caliber: '5.45x39mm', imageFile: '5.45x39mm standard 30連マガジン.png' },
    'Ash-12用 10連マガジン': { capacity: 10, caliber: '12.7x55mm', imageFile: 'Ash-12用 10連マガジン.png' },
    'Ash-12用 20連マガジン': { capacity: 20, caliber: '12.7x55mm', imageFile: 'Ash-12用 20連マガジン.png' },
    'AS VAL用15連マガジン': { capacity: 15, caliber: '9x39mm', imageFile: 'AS VAL用 15連マガジン.png' },
    'AS VAL用 30連マガジン': { capacity: 30, caliber: '9x39mm', imageFile: 'AS VAL用 30連マガジン.png' },
    '5.56x45mm over 100連マガジン': { capacity: 100, caliber: '5.56x45mm', imageFile: '5.56x45mm over 100連マガジン.png' },
    '7.61x51mm standard 30連マガジン': { capacity: 30, caliber: '7.62x51mm', imageFile: '7.61x51mm standard 30連マガジン.png' },
    '7.61x51mm short 20連マガジン': { capacity: 20, caliber: '7.62x51mm', imageFile: '7.61x51mm short 20連マガジン.png' },
    '7.62x39mm standard 30連マガジン': { capacity: 30, caliber: '7.62x39mm', imageFile: '7.62x39mm standard 30連マガジン.png' },
    '7.62x39mm short 15連マガジン': { capacity: 15, caliber: '7.62x39mm', imageFile: '7.62x39mm short 15連マガジン.png' },
    '6.8x51mm standard 30連マガジン': { capacity: 30, caliber: '6.8x51mm', imageFile: '6.8x51mm standard 30連マガジン.png' },
    '6.8x51mm short 15連マガジン': { capacity: 15, caliber: '6.8x51mm', imageFile: '6.8x51mm short 15連マガジン.png' },
    '.300 blackout standard 30連マガジン': { capacity: 30, caliber: '.300 blackout', imageFile: '.300 blackout standard 30連マガジン.png' }
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
        moa: 3.44
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
        explosionRadius: 500,
        baseDamage: 99999999,
        damageDecayPerMeter: 0.1,
        projectileSpeed: 50,
        range: Infinity,
        isDisposable: true
    },
    'Benelli M3 Super 90 dual-mode 12ga shotgun': {
        fireRate: 60,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [],
        stashSize: { width: 5, height: 2 },
        imageFile: 'Benelli M3 Super 90 dual-mode 12ga shotgun.png',
        verticalRecoil: 242,
        horizontalRecoil: 428,
        moa: 18.22
    },
    'MP-133 12ga pump-action shotgun': {
        fireRate: 30,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [],
        stashSize: { width: 5, height: 1 },
        imageFile: 'MP-133 12ga pump-action shotgun.png',
        verticalRecoil: 290,
        horizontalRecoil: 381,
        moa: 21.31
    },
    'MP-153 12ga semi-automatic shotgun': {
        fireRate: 40,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [],
        stashSize: { width: 7, height: 1 },
        imageFile: 'MP-153 12ga semi-automatic shotgun.png',
        verticalRecoil: 230,
        horizontalRecoil: 313,
        moa: 10.31
    },
    'MP-43 12ga sawed-off double-barrel shotgun': {
        fireRate: 900,
        ammoType: '12x70mm',
        fireModes: ['semi', 'double'],
        compatibleMagazines: [],
        stashSize: { width: 3, height: 1 },
        imageFile: 'MP-43 12ga sawed-off double-barrel shotgun.png',
        verticalRecoil: 279,
        horizontalRecoil: 413,
        moa: 21.31
    },
    'MP-43-1C 12ga double-barrel shotgun': {
        fireRate: 900,
        ammoType: '12x70mm',
        fireModes: ['semi', 'double'],
        compatibleMagazines: [],
        stashSize: { width: 6, height: 1 },
        imageFile: 'MP-43-1C 12ga double-barrel shotgun.png',
        verticalRecoil: 240,
        horizontalRecoil: 355,
        moa: 13.06
    },
    'MTs-255-12 12ga shotgun': {
        fireRate: 30,
        ammoType: '12x70mm',
        fireModes: ['semi'],
        compatibleMagazines: [],
        stashSize: { width: 6, height: 1 },
        imageFile: 'MTs-255-12 12ga shotgun.png',
        verticalRecoil: 293,
        horizontalRecoil: 416,
        moa: 9.34
    }
};

const BACKPACK_DATA = {
    'バックパック': {
        contentSize: { width: 5, height: 4 },
        stashSize: { width: 2, height: 2 }
    },
    '大型バックパック': {
        contentSize: { width: 6, height: 6 },
        stashSize: { width: 3, height: 3 }
    },
    '6SH118': {
        contentSize: { width: 9, height: 5 },
        stashSize: { width: 6, height: 7 },
        imageFile: '6SH11B.png'
    },
    'Paratus': {
        contentSize: { width: 7, height: 5 },
        stashSize: { width: 5, height: 7 },
        imageFile: 'paratus.png'
    },
    'Beta2': {
        contentSize: { width: 6, height: 5 },
        stashSize: { width: 5, height: 5 },
        imageFile: 'Beta2.png'
    },
    'MBSS': {
        contentSize: { width: 4, height: 4 },
        stashSize: { width: 4, height: 4 },
        imageFile: 'MBSS.png'
    },
    'T20': {
        contentSize: { width: 5, height: 5 },
        stashSize: { width: 5, height: 5 },
        imageFile: 'T20.png'
    },
    'Takedown': {
        contentSize: { width: 8, height: 3 },
        stashSize: { width: 3, height: 7 },
        imageFile: 'Takedown.png'
    },
    'Daypack': {
        contentSize: { width: 5, height: 4 },
        stashSize: { width: 4, height: 5 },
        imageFile: 'Day pack.png'
    },
    'pilgrim': {
        contentSize: { width: 7, height: 5 },
        stashSize: { width: 5, height: 7 },
        imageFile: 'Pilgrim.png'
    },
    'Pilgrim': {
        contentSize: { width: 7, height: 5 },
        stashSize: { width: 5, height: 7 },
        imageFile: 'Pilgrim.png'
    },
    'ScavBP': {
        contentSize: { width: 5, height: 4 },
        stashSize: { width: 4, height: 5 },
        imageFile: 'ScavBP.png'
    },
    'VKBO': {
        contentSize: { width: 2, height: 4 },
        stashSize: { width: 3, height: 4 },
        imageFile: 'VKBO.png'
    }
};

const RIG_DATA = {
    'IDEA Rig': {
        stashSize: { width: 3, height: 2 },
        slots: [
            { type: 2, count: 4 },
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

// DOM要素の取得
const stashGridElement = document.getElementById('stashGrid');
const backpackGridElement = document.getElementById('backpackGrid');
const rigGridElement = document.getElementById('rigGrid');
const backpackPanel = document.getElementById('backpackPanel');
const rigPanel = document.getElementById('rigPanel');
const gearPanel = document.getElementById('gearPanel');
const rightPanel = document.getElementById('rightPanel');
const backpackName = document.getElementById('backpackName');
const backpackCapacity = document.getElementById('backpackCapacity');
const rigName = document.getElementById('rigName');
const rigCapacity = document.getElementById('rigCapacity');
const itemTooltip = document.getElementById('itemTooltip');
const backButton = document.getElementById('backButton');
const characterName = document.getElementById('characterName');
const stashCapacity = document.getElementById('stashCapacity');
const backgroundLayer = document.getElementById('backgroundLayer');
const itemContextMenu = document.getElementById('itemContextMenu');
const contextDetailButton = document.getElementById('contextDetailButton');
const contextUnloadAmmoButton = document.getElementById('contextUnloadAmmoButton');
const contextUnloadMagazineButton = document.getElementById('contextUnloadMagazineButton');
const contextCheckMagazineCompositionButton = document.getElementById('contextCheckMagazineCompositionButton');
const contextSplitButton = document.getElementById('contextSplitButton');
const itemDetailModal = document.getElementById('itemDetailModal');
const magazineCompositionModal = document.getElementById('magazineCompositionModal');
const magazineCompositionTitle = document.getElementById('magazineCompositionTitle');
const magazineCompositionContent = document.getElementById('magazineCompositionContent');
const magazineCompositionCloseButton = document.getElementById('magazineCompositionCloseButton');
const detailTitle = document.getElementById('detailTitle');
const detailStats = document.getElementById('detailStats');
const detailCloseButton = document.getElementById('detailCloseButton');

function getBackpackData(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.item_name;
    if (!name) return null;
    return BACKPACK_DATA[name] || null;
}

function getBackpackContentSize(itemOrName) {
    const data = getBackpackData(itemOrName);
    return data?.contentSize || { ...DEFAULT_BACKPACK_SIZE };
}

function getRigData(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.item_name;
    if (!name) return null;
    return RIG_DATA[name] || null;
}

function getArmorData(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.item_name;
    if (!name) return null;
    return ARMOR_DATA[name] || null;
}

function getHelmetData(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.item_name;
    if (!name) return null;
    return HELMET_DATA[name] || null;
}

function cloneSize(size) {
    if (!size) {
        return { width: 0, height: 0 };
    }
    return { width: size.width ?? 0, height: size.height ?? 0 };
}

function getItemIdentifier(item) {
    if (item.id !== null && item.id !== undefined) {
        return `db-${item.id}`;
    }
    if (!item.client_id) {
        item.client_id = `tmp-${Math.random().toString(36).slice(2, 11)}`;
    }
    return item.client_id;
}

function findItemByIdentifier(identifier) {
    if (!identifier) return null;
    return items.find(item => getItemIdentifier(item) === identifier) || null;
}

function getItemFromElement(element) {
    if (!element) return null;
    const identifier = element.dataset.itemId;
    return findItemByIdentifier(identifier);
}

function buildAmmoImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${AMMO_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildMedicalImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${MEDICAL_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
}

function buildGunImageUrl(imageFile) {
    if (!imageFile) return null;
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

function buildMagazineImageUrl(imageFile) {
    if (!imageFile) return null;
    return `${MAGAZINE_IMAGE_BASE_PATH}${encodeURIComponent(imageFile)}`;
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

function buildTicketImageUrl(name) {
    if (!name) return null;
    if (name.includes('☆☆☆')) {
        return `${TICKET_IMAGE_BASE_PATH}tier3.png`;
    }
    if (name.includes('☆☆')) {
        return `${TICKET_IMAGE_BASE_PATH}tier2.png`;
    }
    if (name.includes('☆')) {
        return `${TICKET_IMAGE_BASE_PATH}tier1.png`;
    }
    return `${TICKET_IMAGE_BASE_PATH}tier1.png`;
}

function getItemImageUrl(item) {
    if (!item) return null;
    if (item.item_type === 'ammo') {
        const ammoData = getAmmoData(item);
        if (ammoData && ammoData.imageFile) {
            return buildAmmoImageUrl(ammoData.imageFile);
        }
    } else if (item.item_type === 'weapon') {
        const weaponData = WEAPON_DATA[item.item_name];
        if (weaponData && weaponData.imageFile) {
            return buildGunImageUrl(weaponData.imageFile);
        }
    } else if (item.item_type === 'backpack') {
        const backpackData = BACKPACK_DATA[item.item_name];
        if (backpackData && backpackData.imageFile) {
            return buildBackpackImageUrl(backpackData.imageFile);
        }
    } else if (item.item_type === 'rig') {
        const rigData = RIG_DATA[item.item_name];
        if (rigData && rigData.imageFile) {
            return buildRigImageUrl(rigData.imageFile);
        }
    } else if (item.item_type === 'armor') {
        // アーマーの画像ファイル名はアイテム名と同じ（拡張子は.pngを想定）
        const imageFile = `${item.item_name}.png`;
        return buildArmorImageUrl(imageFile);
    } else if (item.item_type === 'helmet') {
        // ヘルメットの画像ファイル名はアイテム名と同じ（拡張子は.pngを想定）
        const imageFile = `${item.item_name}.png`;
        return buildHelmetImageUrl(imageFile);
    } else if (item.item_type === 'medical') {
        const medicalData = getMedicalData(item);
        if (medicalData && medicalData.imageFile) {
            return buildMedicalImageUrl(medicalData.imageFile);
        }
    } else if (item.item_type === 'magazine') {
        const magazineData = getMagazineData(item);
        if (magazineData && magazineData.imageFile) {
            return buildMagazineImageUrl(magazineData.imageFile);
        }
    } else if (item.item_type === 'flare') {
        const flareData = FLARE_DATA[item.item_name];
        if (flareData && flareData.imageFile) {
            return buildFlareImageUrl(flareData.imageFile);
        }
    } else if (item.item_type === 'ticket') {
        if (item.image_path) {
            return item.image_path;
        }
        return buildTicketImageUrl(item.item_name);
    } else if (item.item_type === 'other') {
        // Other items (for hideout upgrades and tasks)
        const imageFile = `${item.item_name}.png`;
        return `/pic/item/${encodeURIComponent(imageFile)}`;
    }
    return null;
}

function normalizeWeaponDurability(item) {
    if (!item || item.item_type !== 'weapon') return;
    const value = typeof item.weapon_durability === 'number' ? item.weapon_durability : WEAPON_DURABILITY_MAX;
    item.weapon_durability = Math.max(0, Math.min(WEAPON_DURABILITY_MAX, value));
}

function getItemElementUnderMouse(clientX, clientY, draggedElement) {
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

function getMagazineData(item) {
    const name = typeof item === 'string' ? item : item?.item_name;
    return name ? MAGAZINE_DATA[name] || null : null;
}

function getAmmoData(item) {
    const name = typeof item === 'string' ? item : item?.item_name;
    return name ? AMMO_DATA[name] || null : null;
}

function getMedicalData(item) {
    const name = typeof item === 'string' ? item : item?.item_name;
    return name ? MEDICAL_DATA[name] || null : null;
}

function canLoadAmmoIntoMagazine(ammoItem, magazineItem) {
    const magazineData = getMagazineData(magazineItem);
    const ammoData = getAmmoData(ammoItem);
    if (!magazineData || !ammoData) return false;
    if (magazineData.caliber !== ammoData.caliber) return false;
    const capacity = magazineData.capacity || 0;
    const current = magazineItem.quantity || 0;
    const available = ammoItem.quantity || 0;
    return capacity > current && available > 0;
}

function processAmmoToMagazineDrop(ammoItem, magazineItem) {
    clearMagazineHighlight();
    const magazineData = getMagazineData(magazineItem);
    const ammoData = getAmmoData(ammoItem);
    
    if (!magazineData || !ammoData || magazineData.caliber !== ammoData.caliber) {
        renderItems();
        return true;
    }
    
    const capacity = magazineData.capacity || 0;
    const current = magazineItem.quantity || 0;
    const available = ammoItem.quantity || 0;
    
    if (capacity <= current || available <= 0) {
        renderItems();
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
    
    if (ammoItem.quantity <= 0) {
        removeItem(ammoItem);
    }
    
    saveItems();
    renderItems();
    return true;
}

function removeItem(targetItem) {
    // リグスロットから削除
    if (rigUsesSlots && targetItem.grid_x !== null && targetItem.grid_x < 0) {
        const slotId = Math.abs(targetItem.grid_x);
        unmarkRigSlotOccupied(slotId, targetItem);
    }
    
    const index = items.indexOf(targetItem);
    if (index !== -1) {
        items.splice(index, 1);
    }
}

function getItemQuantityText(item) {
    if (item.item_type === 'magazine') {
        const magazineData = getMagazineData(item);
        const capacity = magazineData?.capacity ?? null;
        const current = item.quantity || 0;
        const displayCapacity = capacity !== null ? capacity : '?';
        return `${current}/${displayCapacity}`;
    }
    
    if (item.item_type === 'ammo') {
        const ammoData = getAmmoData(item);
        const stackSize = ammoData?.stackSize ?? null;
        const current = item.quantity || 0;
        return `${current}`;
    }
    
    if (item.item_type === 'medical') {
        // 医薬品の場合は常に耐久値を表示
        const medicalData = getMedicalData(item);
        const current = item.quantity !== null && item.quantity !== undefined 
            ? item.quantity 
            : (medicalData?.durability || 0);
        return String(current);
    }
    
    if (item.quantity && item.quantity > 1) {
        return String(item.quantity);
    }
    
    return null;
}

// 弾薬の表示名を取得（括弧内の短縮名を優先）
function getAmmoDisplayName(item) {
    if (item.item_type !== 'ammo') {
        return item.item_name;
    }
    
    const ammoData = getAmmoData(item);
    if (!ammoData) {
        return item.item_name;
    }
    
    // 正式名称から括弧内の名前を取得
    const fullName = ammoData.fullName || item.item_name;
    
    // 括弧内のテキストを抽出（例: "5.56x45mm M855 (M855)" → "M855"）
    const match = fullName.match(/\(([^)]+)\)/);
    if (match && match[1]) {
        return match[1].trim();
    }
    
    // 括弧がない場合は、口径を除いた部分を取得
    const caliber = ammoData.caliber || '';
    if (caliber && fullName.startsWith(caliber)) {
        const displayName = fullName.substring(caliber.length).trim();
        return displayName || fullName; // 空の場合は正式名称を返す
    }
    
    return fullName;
}

// 医薬品の表示名を取得（（）の中の部分のみ）
function getMedicalDisplayName(item) {
    if (item.item_type !== 'medical') {
        return item.item_name;
    }
    
    const name = item.item_name || '';
    // （）の中の部分を抽出
    const match = name.match(/\(([^)]+)\)/);
    if (match && match[1]) {
        return match[1];
    }
    
    // （）がない場合は正式名称を返す
    return name;
}

function highlightMagazineTarget(element, isValid) {
    if (!element) return;
    clearMagazineHighlight();
    highlightedMagazineElement = element;
    if (isValid) {
        element.classList.add('magazine-highlight');
    } else {
        element.classList.add('magazine-highlight-invalid');
    }
}

function clearMagazineHighlight() {
    if (highlightedMagazineElement) {
        highlightedMagazineElement.classList.remove('magazine-highlight');
        highlightedMagazineElement.classList.remove('magazine-highlight-invalid');
        highlightedMagazineElement = null;
    }
}

let contextMenuItem = null;

function showContextMenu(x, y, item) {
    if (!itemContextMenu) return;
    hideContextMenu();
    itemContextMenu.classList.remove('hidden');
    itemContextMenu.style.left = `${x}px`;
    itemContextMenu.style.top = `${y}px`;
    if (contextDetailButton) {
        contextDetailButton.disabled = false;
        // 武器、弾薬、または医薬品の場合に詳細ボタンを表示
        if (item.item_type === 'ammo' || item.item_type === 'weapon' || item.item_type === 'medical') {
            contextDetailButton.classList.remove('hidden');
        } else {
            contextDetailButton.classList.add('hidden');
        }
    }
    // マガジンがリグ、バックパック、またはスタッシュにある場合のみ「弾薬を抜く」を表示
    if (contextUnloadAmmoButton) {
        if (item.item_type === 'magazine' && (item.quantity || 0) > 0) {
            // 武器に装填されているマガジンは除外（grid_xとgrid_yがnull）
            const isInWeapon = item.grid_x === null && item.grid_y === null && item.parent_item_id !== null;
            
            // リグ、バックパック、またはスタッシュにあるかチェック
            const isInRig = equippedRig && item.parent_item_id === equippedRig.id && item.grid_x !== null && item.grid_y !== null;
            const isInBackpack = equippedBackpack && item.parent_item_id === equippedBackpack.id && item.grid_x !== null && item.grid_y !== null;
            const isInStash = item.parent_item_id === null && item.equipped_slot === null && item.grid_x !== null && item.grid_y !== null;
            
            if (!isInWeapon && (isInRig || isInBackpack || isInStash)) {
                contextUnloadAmmoButton.classList.remove('hidden');
            } else {
                contextUnloadAmmoButton.classList.add('hidden');
            }
        } else {
            contextUnloadAmmoButton.classList.add('hidden');
        }
    }
    
    // 武器に装填されているマガジンがある場合は「アンリロード」を表示
    if (contextUnloadMagazineButton) {
        if (item.item_type === 'weapon') {
            const loadedMagazine = items.find(mag => 
                mag.item_type === 'magazine' && 
                mag.parent_item_id === item.id &&
                mag.grid_x === null && 
                mag.grid_y === null
            );
            if (loadedMagazine) {
                contextUnloadMagazineButton.classList.remove('hidden');
            } else {
                contextUnloadMagazineButton.classList.add('hidden');
            }
        } else {
            contextUnloadMagazineButton.classList.add('hidden');
        }
    }
    
    // マガジンの場合「構成を確認する」を表示
    if (contextCheckMagazineCompositionButton) {
        if (item.item_type === 'magazine' && (item.quantity || 0) > 0) {
            contextCheckMagazineCompositionButton.classList.remove('hidden');
        } else {
            contextCheckMagazineCompositionButton.classList.add('hidden');
        }
    }
    
    if (contextSplitButton) {
        if (canSplitItem(item)) {
            contextSplitButton.classList.remove('hidden');
        } else {
            contextSplitButton.classList.add('hidden');
        }
    }
    const rect = itemContextMenu.getBoundingClientRect();
    let adjustedX = x;
    let adjustedY = y;
    if (rect.right > window.innerWidth) {
        adjustedX = Math.max(8, window.innerWidth - rect.width - 8);
    }
    if (rect.bottom > window.innerHeight) {
        adjustedY = Math.max(8, window.innerHeight - rect.height - 8);
    }
    itemContextMenu.style.left = `${adjustedX}px`;
    itemContextMenu.style.top = `${adjustedY}px`;
    contextMenuItem = item;
}

function hideContextMenu() {
    if (!itemContextMenu) return;
    if (!itemContextMenu.classList.contains('hidden')) {
        itemContextMenu.classList.add('hidden');
    }
    if (contextDetailButton) {
        contextDetailButton.blur();
    }
    contextMenuItem = null;
}

function showAmmoDetails(item) {
    if (!itemDetailModal || !detailTitle || !detailStats) return;
    hideTooltip();
    const ammoData = getAmmoData(item) || {};
    detailTitle.textContent = ammoData.fullName || item.item_name;
    const rows = [
        { label: 'アイテム名', value: ammoData.fullName || item.item_name },
        { label: '弾種', value: ammoData.caliber || '-' },
        { label: 'ダメージ', value: ammoData.damage ?? '-' },
        { label: '貫通力', value: ammoData.penetration ?? '-' },
        { label: '弾速', value: ammoData.velocity ? `${ammoData.velocity} m/s` : '-' },
        { label: '特殊効果', value: ammoData.special || 'なし' }
    ];
    detailStats.innerHTML = '';
    detailStats.innerHTML = rows.map(row => `
        <div class="detail-row">
            <div class="detail-label">${row.label}</div>
            <div class="detail-value">${row.value}</div>
        </div>
    `).join('');
    
    // アタッチメント欄を非表示
    const attachmentsEl = document.getElementById('weaponAttachments');
    if (attachmentsEl) {
        attachmentsEl.classList.add('hidden');
    }
    
    itemDetailModal.classList.remove('hidden');
}

// 武器の詳細を表示
function showWeaponDetails(item) {
    if (!itemDetailModal || !detailTitle || !detailStats) return;
    hideTooltip();
    const weaponData = WEAPON_DATA[item.item_name] || {};
    detailTitle.textContent = item.item_name;
    // 武器の装備スロットを保存（renderWeaponAttachmentsで使用）
    if (item.equipped_slot) {
        detailTitle.dataset.weaponSlot = item.equipped_slot;
    } else {
        delete detailTitle.dataset.weaponSlot;
    }
    
    // 武器に装填されているマガジンを取得
    const loadedMagazine = items.find(mag => 
        mag.item_type === 'magazine' && 
        mag.parent_item_id === item.id &&
        mag.grid_x === null && 
        mag.grid_y === null
    );
    
    const magazineData = loadedMagazine ? getMagazineData(loadedMagazine) : null;
    const currentAmmo = loadedMagazine ? (loadedMagazine.quantity || 0) : 0;
    const maxAmmo = magazineData ? (magazineData.capacity || 0) : 0;
    
    const rows = [
        { label: '武器名', value: item.item_name },
        { label: '連射速度', value: weaponData.fireRate ? `${weaponData.fireRate} RPM` : '-' },
        { label: '射撃モード', value: weaponData.fireModes ? weaponData.fireModes.join('・') : '-' },
        { label: '使用弾薬', value: weaponData.ammoType || '-' },
        { label: '装弾数', value: loadedMagazine ? `${currentAmmo}/${maxAmmo}` : '未装填' }
    ];
    
    detailStats.innerHTML = rows.map(row => `
        <div class="detail-row">
            <div class="detail-label">${row.label}</div>
            <div class="detail-value">${row.value}</div>
        </div>
    `).join('');
    
    // アタッチメント欄を表示
    const attachmentsEl = document.getElementById('weaponAttachments');
    if (attachmentsEl) {
        attachmentsEl.classList.remove('hidden');
        renderWeaponAttachments(item);
    }
    
    itemDetailModal.classList.remove('hidden');
}

// 医薬品の詳細を表示
function showMedicalDetails(item) {
    if (!itemDetailModal || !detailTitle || !detailStats) return;
    hideTooltip();
    const medicalData = getMedicalData(item) || {};
    detailTitle.textContent = item.item_name;
    
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
    
    detailStats.innerHTML = rows.map(row => `
        <div class="detail-row">
            <div class="detail-label">${row.label}</div>
            <div class="detail-value">${row.value}</div>
        </div>
    `).join('');
    
    // アタッチメント欄を非表示
    const attachmentsEl = document.getElementById('weaponAttachments');
    if (attachmentsEl) {
        attachmentsEl.classList.add('hidden');
    }
    
    itemDetailModal.classList.remove('hidden');
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
        const loadedMagazine = items.find(mag => 
            mag.item_type === 'magazine' && 
            mag.parent_item_id === weaponItem.id &&
            mag.grid_x === null && 
            mag.grid_y === null
        );
        
        if (loadedMagazine) {
            magazineSlot.innerHTML = '';
            const magazineElement = createItemElement(loadedMagazine, false);
            magazineElement.style.width = '45px';
            magazineElement.style.height = '45px';
            magazineElement.style.position = 'relative';
            magazineElement.style.fontSize = '0.7em';
            magazineSlot.appendChild(magazineElement);
        }
    }
}

function hideDetailModal() {
    if (!itemDetailModal) return;
    if (!itemDetailModal.classList.contains('hidden')) {
        itemDetailModal.classList.add('hidden');
    }
    if (detailStats) {
        detailStats.innerHTML = '';
    }
    if (detailTitle) {
        detailTitle.textContent = '';
    }
}

// マガジンの構成を表示
function showMagazineComposition(magazineItem) {
    if (!magazineItem || magazineItem.item_type !== 'magazine' || !magazineCompositionModal || !magazineCompositionTitle || !magazineCompositionContent) return;
    
    const magazineData = getMagazineData(magazineItem);
    const capacity = magazineData?.capacity || 0;
    const currentAmmo = magazineItem.quantity || 0;
    
    // タイトルを設定
    magazineCompositionTitle.textContent = `${magazineItem.item_name} の構成 (${currentAmmo}/${capacity})`;
    
    // ammo_stackを取得
    let ammoStack = [];
    if (magazineItem.ammo_stack) {
        if (typeof magazineItem.ammo_stack === 'string') {
            try {
                ammoStack = JSON.parse(magazineItem.ammo_stack);
            } catch (e) {
                ammoStack = [];
            }
        } else if (Array.isArray(magazineItem.ammo_stack)) {
            ammoStack = magazineItem.ammo_stack;
        }
    }
    
    // ammo_stackが空で、quantityがある場合はマガジンの口径から対応する弾薬を推測
    if (ammoStack.length === 0 && currentAmmo > 0) {
        const caliber = magazineData?.caliber;
        if (caliber) {
            // 口径から対応する弾薬を探す
            let foundAmmo = null;
            for (const [ammoName, ammoData] of Object.entries(AMMO_DATA)) {
                if (ammoData.caliber === caliber) {
                    foundAmmo = ammoName;
                    break;
                }
            }
            if (foundAmmo) {
                ammoStack = [{ type: foundAmmo, count: currentAmmo }];
            } else {
                ammoStack = [{ type: '不明な弾薬', count: currentAmmo }];
            }
        } else {
            ammoStack = [{ type: '不明な弾薬', count: currentAmmo }];
        }
    }
    
    // デバッグ用ログ
    console.log('マガジン構成表示:', {
        item_name: magazineItem.item_name,
        quantity: currentAmmo,
        ammo_stack: ammoStack,
        ammo_stack_raw: magazineItem.ammo_stack
    });
    
    // 構成を解析して表示用の配列を作成
    // ammo_stackはLIFO順（最後に込めた弾が先頭）なので、表示用には逆順にする
    const displayStack = [...ammoStack].reverse();
    const composition = [];
    let currentPosition = 1;
    
    for (const ammoEntry of displayStack) {
        const ammoType = ammoEntry.type || '不明な弾薬';
        const count = ammoEntry.count || 0;
        
        if (count > 0) {
            const startPosition = currentPosition;
            const endPosition = currentPosition + count - 1;
            
            if (startPosition === endPosition) {
                composition.push({
                    range: `${startPosition}発目`,
                    ammoType: ammoType
                });
            } else {
                composition.push({
                    range: `${startPosition}-${endPosition}発目`,
                    ammoType: ammoType
                });
            }
            
            currentPosition += count;
        }
    }
    
    // HTMLを生成
    if (composition.length === 0) {
        magazineCompositionContent.innerHTML = '<p style="color: rgba(255, 255, 255, 0.7); text-align: center; padding: 20px;">マガジンは空です</p>';
    } else {
        magazineCompositionContent.innerHTML = composition.map(comp => `
            <div style="padding: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); display: flex; justify-content: space-between; align-items: center;">
                <span style="color: rgba(255, 255, 255, 0.9); font-weight: 600;">${comp.range}:</span>
                <span style="color: rgba(255, 255, 255, 0.8);">${comp.ammoType}</span>
            </div>
        `).join('');
    }
    
    // モーダルを表示
    magazineCompositionModal.classList.remove('hidden');
}

// 武器からマガジンを外す処理
function unloadMagazineFromWeapon(weaponItem) {
    if (!weaponItem || weaponItem.item_type !== 'weapon') return;
    
    // 武器に装填されているマガジンを探す
    const loadedMagazine = items.find(mag => 
        mag.item_type === 'magazine' && 
        mag.parent_item_id === weaponItem.id &&
        mag.grid_x === null && 
        mag.grid_y === null
    );
    
    if (!loadedMagazine) return;
    
    // リグまたはバックパックに空きスペースを探す
    let moved = false;
    
    if (equippedRig) {
        let space = null;
        if (rigUsesSlots) {
            // スロットベースのリグの場合、空きスロットを探す
                for (const slot of rigSlots) {
                    const slotSize = RIG_SLOT_SIZES[slot.type];
                    if (slotSize && slotSize.width >= loadedMagazine.width && slotSize.height >= loadedMagazine.height) {
                        const occupants = rigSlotOccupancy.get(slot.id) || [];
                        // スロット内に空きスペースがあるかチェック
                        const usedSpaces = [];
                        for (const occupant of occupants) {
                            const slotRelativeX = occupant.rig_slot_x || 0;
                            const slotRelativeY = occupant.rig_slot_y || 0;
                            usedSpaces.push({
                                x: slotRelativeX,
                                y: slotRelativeY,
                                width: occupant.width,
                                height: occupant.height
                            });
                        }
                        // 配置可能な位置を探す（横方向優先）
                        let found = false;
                        for (let x = 0; x <= slotSize.width - loadedMagazine.width && !found; x++) {
                            for (let y = 0; y <= slotSize.height - loadedMagazine.height && !found; y++) {
                                let canPlace = true;
                                for (const used of usedSpaces) {
                                    if (!(x + loadedMagazine.width <= used.x || x >= used.x + used.width ||
                                          y + loadedMagazine.height <= used.y || y >= used.y + used.height)) {
                                        canPlace = false;
                                        break;
                                    }
                                }
                                if (canPlace) {
                                    space = { x: -slot.id, y: 0, isSlot: true, slotId: slot.id, slotRelativeX: x, slotRelativeY: y };
                                    found = true;
                                }
                            }
                        }
                        if (found) break;
                    }
                }
        } else {
            // グリッドベースのリグの場合
            space = findEmptySpaceInRig(loadedMagazine.width, loadedMagazine.height);
        }
        
        if (space) {
            loadedMagazine.grid_x = space.x;
            loadedMagazine.grid_y = space.y || 0;
            loadedMagazine.parent_item_id = equippedRig.id;
            
            if (space.isSlot) {
                const slotRelativeX = space.slotRelativeX || 0;
                const slotRelativeY = space.slotRelativeY || 0;
                markRigSlotOccupied(space.slotId, loadedMagazine, slotRelativeX, slotRelativeY);
            }
            
            moved = true;
        }
    }
    
    // リグにスペースがない場合はバックパックを探す
    if (!moved && equippedBackpack) {
        const backpackSpace = findEmptySpaceInBackpack(loadedMagazine.width, loadedMagazine.height);
        if (backpackSpace) {
            loadedMagazine.grid_x = backpackSpace.x;
            loadedMagazine.grid_y = backpackSpace.y;
            loadedMagazine.parent_item_id = equippedBackpack.id;
            moved = true;
        }
    }
    
    // リグとバックパックにスペースがない場合はスタッシュを探す
    if (!moved) {
        const stashSpace = findEmptySpace(loadedMagazine.width, loadedMagazine.height);
        if (stashSpace) {
            loadedMagazine.grid_x = stashSpace.x;
            loadedMagazine.grid_y = stashSpace.y;
            loadedMagazine.parent_item_id = null;
            moved = true;
        }
    }
    
    if (moved) {
        saveItems();
        renderItems();
    } else {
        console.warn('マガジンを外す空きスペースが見つかりません');
    }
}

// マガジンから弾薬を抜く処理
let unloadAmmoInterval = null;

function unloadAmmoFromMagazine(magazineItem) {
    if (!magazineItem || magazineItem.item_type !== 'magazine') return;
    
    const magazineData = getMagazineData(magazineItem);
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
    
    // ゲーム画面かどうかを判定
    const isGameScreen = window.location.pathname === '/game';
    
    if (isGameScreen) {
        // ゲーム画面では1秒に1発ずつ抜く
        let remainingAmmo = currentAmmo;
        
        // 既存のインターバルをクリア
        if (unloadAmmoInterval) {
            clearInterval(unloadAmmoInterval);
        }
        
        unloadAmmoInterval = setInterval(() => {
            if (remainingAmmo <= 0 || !magazineItem || magazineItem.quantity <= 0) {
                clearInterval(unloadAmmoInterval);
                unloadAmmoInterval = null;
                saveItems();
                renderItems();
                return;
            }
            
            // ammo_stackから実際の弾薬タイプを取得（LIFO: 最初の要素が最後に込めた弾）
            let ammoName = null;
            let ammoStack = magazineItem.ammo_stack;
            
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
                    // スタックから1発減らす
                    topAmmo.count--;
                    // スタックが空になったら削除
                    if (topAmmo.count <= 0) {
                        ammoStack.shift();
                    }
                }
            }
            
            // ammo_stackから取得できなかった場合は、口径からデフォルトの弾薬を取得
            if (!ammoName) {
                ammoName = findAmmoNameByCaliber(caliber);
            }
            
            // 1発抜く
            magazineItem.quantity = (magazineItem.quantity || 0) - 1;
            remainingAmmo--;
            
            // 更新されたammo_stackを保存（必ず配列として保存）
            magazineItem.ammo_stack = ammoStack;
            
            // 弾薬をスタックに追加
            if (ammoName) {
                addAmmoToStack(ammoName, 1);
            }
            
            // リアルタイムで表示を更新
            renderItems();
            
            if (remainingAmmo <= 0) {
                clearInterval(unloadAmmoInterval);
                unloadAmmoInterval = null;
                saveItems();
            }
        }, 1000); // 1秒ごと
    } else {
        // ゲーム画面以外では即座にすべて抜く
        const ammoToUnload = currentAmmo;
        magazineItem.quantity = 0;
        
        // ammo_stackから実際の弾薬タイプを取得して、すべて抜く
        let ammoStack = magazineItem.ammo_stack;
        
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
        
        // ammo_stackからすべての弾薬を抜く
        if (ammoStack.length > 0) {
            // 各スタックから弾薬を抜く
            for (const ammoEntry of ammoStack) {
                if (ammoEntry && ammoEntry.type && ammoEntry.count > 0) {
                    addAmmoToStack(ammoEntry.type, ammoEntry.count);
                }
            }
        } else {
            // ammo_stackが空の場合は、口径からデフォルトの弾薬を取得
        const ammoName = findAmmoNameByCaliber(caliber);
        if (ammoName) {
            addAmmoToStack(ammoName, ammoToUnload);
            }
        }
        
        // ammo_stackをクリア
        magazineItem.ammo_stack = [];
        
        saveItems();
        renderItems();
    }
}

// 口径から弾薬名を取得
function findAmmoNameByCaliber(caliber) {
    for (const [ammoName, ammoData] of Object.entries(AMMO_DATA)) {
        if (ammoData.caliber === caliber) {
            return ammoName;
        }
    }
    return null;
}

// 弾薬スタックに弾薬を追加（リグ→バックパック→倉庫の順）
function addAmmoToStack(ammoName, amount) {
    if (!ammoName || amount <= 0) return;
    
    const ammoData = getAmmoData(ammoName);
    if (!ammoData) return;
    
    const stackSize = ammoData.stackSize || 60;
    let remaining = amount;
    
    // 1. リグ内の既存スタックを探す
    if (equippedRig) {
        for (const item of items) {
            if (remaining <= 0) break;
            if (item.item_type === 'ammo' && 
                item.item_name === ammoName && 
                item.parent_item_id === equippedRig.id &&
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
            if (rigUsesSlots) {
                // スロットベースのリグの場合、空きスロットを探す
                for (const slot of rigSlots) {
                    const slotSize = RIG_SLOT_SIZES[slot.type];
                    if (slotSize && slotSize.width >= 1 && slotSize.height >= 1) {
                        const occupants = rigSlotOccupancy.get(slot.id) || [];
                        // スロット内に空きスペースがあるかチェック
                        const usedSpaces = [];
                        for (const occupant of occupants) {
                            const slotRelativeX = occupant.rig_slot_x || 0;
                            const slotRelativeY = occupant.rig_slot_y || 0;
                            usedSpaces.push({
                                x: slotRelativeX,
                                y: slotRelativeY,
                                width: occupant.width,
                                height: occupant.height
                            });
                        }
                        // 配置可能な位置を探す（横方向優先）
                        let found = false;
                        for (let x = 0; x <= slotSize.width - 1 && !found; x++) {
                            for (let y = 0; y <= slotSize.height - 1 && !found; y++) {
                                let canPlace = true;
                                for (const used of usedSpaces) {
                                    if (!(x + 1 <= used.x || x >= used.x + used.width ||
                                          y + 1 <= used.y || y >= used.y + used.height)) {
                                        canPlace = false;
                                        break;
                                    }
                                }
                                if (canPlace) {
                                    space = { x: -slot.id, y: 0, isSlot: true, slotId: slot.id, slotRelativeX: x, slotRelativeY: y };
                                    found = true;
                                }
                            }
                        }
                        if (found) break;
                    }
                }
            } else {
                // グリッドベースのリグの場合
                space = findEmptySpaceInRig(1, 1);
            }
            
            if (space) {
                const addAmount = Math.min(remaining, stackSize);
                const newAmmoItem = {
                    item_type: 'ammo',
                    item_name: ammoName,
                    grid_x: space.x,
                    grid_y: space.y || 0,
                    width: 1,
                    height: 1,
                    quantity: addAmount,
                    equipped_slot: null,
                    parent_item_id: equippedRig.id
                };
                items.push(newAmmoItem);
                
                if (space.isSlot) {
                    const slotRelativeX = space.slotRelativeX || 0;
                    const slotRelativeY = space.slotRelativeY || 0;
                    markRigSlotOccupied(space.slotId, newAmmoItem, slotRelativeX, slotRelativeY);
                }
                
                remaining -= addAmount;
            } else {
                break; // リグにスペースがない
            }
        }
    }
    
    // 2. バックパック内の既存スタックを探す
    if (remaining > 0 && equippedBackpack) {
        for (const item of items) {
            if (remaining <= 0) break;
            if (item.item_type === 'ammo' && 
                item.item_name === ammoName && 
                item.parent_item_id === equippedBackpack.id &&
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
            const space = findEmptySpaceInBackpack(1, 1);
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
                    parent_item_id: equippedBackpack.id
                };
                items.push(newAmmoItem);
                remaining -= addAmount;
            } else {
                break; // バックパックにスペースがない
            }
        }
    }
    
    // 3. 倉庫（スタッシュ）内の既存スタックを探す
    if (remaining > 0) {
        for (const item of items) {
            if (remaining <= 0) break;
            if (item.item_type === 'ammo' && 
                item.item_name === ammoName && 
                !item.equipped_slot && 
                !item.parent_item_id &&
                item.grid_x !== null && 
                item.grid_y !== null &&
                (item.quantity || 0) < stackSize) {
                const currentQuantity = item.quantity || 0;
                const availableSpace = stackSize - currentQuantity;
                const addAmount = Math.min(remaining, availableSpace);
                item.quantity = currentQuantity + addAmount;
                remaining -= addAmount;
            }
        }
        
        // 倉庫に新しいスタックを作成
        while (remaining > 0) {
            const space = findEmptySpace(1, 1);
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
                    parent_item_id: null
                };
                items.push(newAmmoItem);
                remaining -= addAmount;
            } else {
                console.warn('弾薬を追加する空きスペースが見つかりません');
                break;
            }
        }
    }
}

// リグ内の空きスペースを探す
function findEmptySpaceInRig(width, height) {
    if (!equippedRig || !rigGrid) return null;
    
    for (let y = 0; y <= currentRigGridSize.height - height; y++) {
        for (let x = 0; x <= currentRigGridSize.width - width; x++) {
            if (isValidRigPosition(x, y, width, height, null)) {
                return { x, y };
            }
        }
    }
    return null;
}

// バックパック内の空きスペースを探す
function findEmptySpaceInBackpack(width, height) {
    if (!equippedBackpack || !backpackGrid) return null;
    
    for (let y = 0; y <= currentBackpackSize.height - height; y++) {
        for (let x = 0; x <= currentBackpackSize.width - width; x++) {
            if (isValidBackpackPosition(x, y, width, height, null)) {
                return { x, y };
            }
        }
    }
    return null;
}

// アイテムのダブルクリック処理
function handleItemDoubleClick(e, item) {
    if (!item) return;
    
    // リグ内のアイテムの場合のみ倉庫に移動
    const isInRig = equippedRig && item.parent_item_id === equippedRig.id;
    
    if (isInRig) {
        e.preventDefault();
        e.stopPropagation();
        moveItemFromRigToStash(item);
    }
}

// リグ内のアイテムを倉庫に移動
function moveItemFromRigToStash(item) {
    if (!item) return;
    
    // 装備中のアイテムは移動できない
    if (item.equipped_slot) return;
    
    // リグ内のアイテムかどうかを確認
    if (!equippedRig || item.parent_item_id !== equippedRig.id) return;
    
    const width = item.width || 1;
    const height = item.height || 1;
    
    // リグスロットから削除
    if (rigUsesSlots && item.grid_x !== null && item.grid_x < 0) {
        const slotId = Math.abs(item.grid_x);
        unmarkRigSlotOccupied(slotId, item);
    }
    
    // 倉庫（スタッシュ）内の空きスペースを探す
    const stashSpace = findEmptySpace(width, height);
    if (stashSpace) {
        item.grid_x = stashSpace.x;
        item.grid_y = stashSpace.y;
        item.parent_item_id = null;
        item.equipped_slot = null;
        saveItems();
        renderItems();
    } else {
        console.warn('倉庫に空きスペースが見つかりません');
    }
}

// Ctrl+クリックでアイテムを素早く移動（現在の位置を考慮）
function quickMoveItem(item) {
    if (!item) return;
    
    // 装備中のアイテムは移動できない
    if (item.equipped_slot) return;
    
    const width = item.width || 1;
    const height = item.height || 1;
    
    // 現在のアイテムの位置を確認
    const isInRig = equippedRig && item.parent_item_id === equippedRig.id;
    const isInBackpack = equippedBackpack && item.parent_item_id === equippedBackpack.id;
    const isInStash = !item.equipped_slot && !item.parent_item_id && item.grid_x !== null && item.grid_y !== null;
    
    // リグ内のアイテムの場合：バックパック→倉庫の順で移動
    if (isInRig) {
        // リグスロットから削除
        if (rigUsesSlots && item.grid_x !== null && item.grid_x < 0) {
            const slotId = Math.abs(item.grid_x);
            unmarkRigSlotOccupied(slotId, item);
        }
        
        // 1. バックパック内の空きスペースを探す
        if (equippedBackpack) {
            const backpackSpace = findEmptySpaceInBackpack(width, height);
            if (backpackSpace) {
                item.grid_x = backpackSpace.x;
                item.grid_y = backpackSpace.y;
                item.parent_item_id = equippedBackpack.id;
                item.equipped_slot = null;
                saveItems();
                renderItems();
                return;
            }
        }
        
        // 2. 倉庫（スタッシュ）内の空きスペースを探す
        const stashSpace = findEmptySpace(width, height);
        if (stashSpace) {
            item.grid_x = stashSpace.x;
            item.grid_y = stashSpace.y;
            item.parent_item_id = null;
            item.equipped_slot = null;
            saveItems();
            renderItems();
            return;
        }
    }
    // バックパック内のアイテムの場合：倉庫に移動
    else if (isInBackpack) {
        const stashSpace = findEmptySpace(width, height);
        if (stashSpace) {
            item.grid_x = stashSpace.x;
            item.grid_y = stashSpace.y;
            item.parent_item_id = null;
            item.equipped_slot = null;
            saveItems();
            renderItems();
            return;
        }
    }
    // 倉庫内のアイテムの場合：リグ→バックパック→倉庫の順で移動
    else if (isInStash) {
        // 1. リグ内の空きスペースを探す
        if (equippedRig) {
            if (rigUsesSlots) {
                // スロットベースのリグの場合
                for (const slot of rigSlots) {
                    const slotSize = RIG_SLOT_SIZES[slot.type];
                    if (slotSize && width <= slotSize.width && height <= slotSize.height) {
                        const occupants = rigSlotOccupancy.get(slot.id) || [];
                        // スロット内に空きスペースがあるかチェック
                        const usedSpaces = [];
                        for (const occupant of occupants) {
                            if (occupant === item) continue;
                            const slotRelativeX = occupant.rig_slot_x || 0;
                            const slotRelativeY = occupant.rig_slot_y || 0;
                            usedSpaces.push({
                                x: slotRelativeX,
                                y: slotRelativeY,
                                width: occupant.width,
                                height: occupant.height
                            });
                        }
                        // 配置可能な位置を探す（横方向優先）
                        for (let x = 0; x <= slotSize.width - width; x++) {
                            for (let y = 0; y <= slotSize.height - height; y++) {
                                let canPlace = true;
                                for (const used of usedSpaces) {
                                    if (!(x + width <= used.x || x >= used.x + used.width ||
                                          y + height <= used.y || y >= used.y + used.height)) {
                                        canPlace = false;
                                        break;
                                    }
                                }
                                if (canPlace) {
                                    // 既にリグスロットにある場合は削除
                                    if (item.grid_x !== null && item.grid_x < 0) {
                                        const oldSlotId = Math.abs(item.grid_x);
                                        if (oldSlotId !== slot.id) {
                                            unmarkRigSlotOccupied(oldSlotId, item);
                                        }
                                    }
                                    
                                    // アイテムをリグスロットに移動
                                    item.grid_x = -slot.id;
                                    item.grid_y = 0;
                                    item.parent_item_id = equippedRig.id;
                                    item.equipped_slot = null;
                                    markRigSlotOccupied(slot.id, item, x, y);
                                    saveItems();
                                    renderItems();
                                    return;
                                }
                            }
                        }
                    }
                }
            } else {
                // グリッドベースのリグの場合
                const rigSpace = findEmptySpaceInRig(width, height);
                if (rigSpace) {
                    item.grid_x = rigSpace.x;
                    item.grid_y = rigSpace.y;
                    item.parent_item_id = equippedRig.id;
                    item.equipped_slot = null;
                    saveItems();
                    renderItems();
                    return;
                }
            }
        }
        
        // 2. バックパック内の空きスペースを探す
        if (equippedBackpack) {
            const backpackSpace = findEmptySpaceInBackpack(width, height);
            if (backpackSpace) {
                item.grid_x = backpackSpace.x;
                item.grid_y = backpackSpace.y;
                item.parent_item_id = equippedBackpack.id;
                item.equipped_slot = null;
                saveItems();
                renderItems();
                return;
            }
        }
        
        // 3. 倉庫（スタッシュ）内の別の場所に移動
        const stashSpace = findEmptySpace(width, height);
        if (stashSpace) {
            item.grid_x = stashSpace.x;
            item.grid_y = stashSpace.y;
            item.parent_item_id = null;
            item.equipped_slot = null;
            saveItems();
            renderItems();
            return;
        }
    }
    
    // 空きスペースが見つからない場合は何もしない
    console.warn('アイテムを移動する空きスペースが見つかりません');
}

// 弾薬スタックを分割
function splitAmmoStack(ammoItem, dropLocation, parentId) {
    if (!ammoItem || ammoItem.item_type !== 'ammo') return false;
    
    const currentQuantity = ammoItem.quantity || 0;
    if (currentQuantity <= 1) return false;
    
    const ammoData = getAmmoData(ammoItem);
    if (!ammoData) return false;
    
    const stackSize = ammoData.stackSize || 60;
    
    // 数量を入力
    const splitAmount = prompt(`分割する数量を入力してください（1〜${Math.min(currentQuantity - 1, stackSize)}）:`, Math.floor(currentQuantity / 2));
    
    if (splitAmount === null) {
        // キャンセルされた場合は元の位置に戻す
        renderItems();
        return false;
    }
    
    const amount = parseInt(splitAmount, 10);
    
    if (isNaN(amount) || amount <= 0 || amount >= currentQuantity || amount > stackSize) {
        alert('無効な数量です。');
        renderItems();
        return false;
    }
    
    // 元のスタックから数量を減らす
    ammoItem.quantity = currentQuantity - amount;
    
    // 新しいスタックを作成
    const newAmmoItem = {
        item_type: 'ammo',
        item_name: ammoItem.item_name,
        grid_x: dropLocation.x,
        grid_y: dropLocation.y,
        width: 1,
        height: 1,
        quantity: amount,
        equipped_slot: null,
        parent_item_id: parentId
    };
    
    items.push(newAmmoItem);
    
    // 元のスタックが0になった場合は削除
    if (ammoItem.quantity <= 0) {
        removeItem(ammoItem);
    }
    
    saveItems();
    renderItems();
    return true;
}

function canSplitItem(item) {
    if (!item) return false;
    const quantity = item.quantity || 0;
    return quantity > 1;
}

function getItemStackLimit(item) {
    if (!item) return 0;
    if (item.item_type === 'ammo') {
        const ammoData = getAmmoData(item);
        return ammoData?.stackSize || item.quantity || 0;
    }
    return item.quantity || 0;
}

function findSplitDropLocation(item, width = 1, height = 1) {
    if (!item) return null;
    if (item.parent_item_id) {
        const parentItem = items.find(i => i.id === item.parent_item_id);
        if (parentItem?.item_type === 'backpack') {
            const space = findEmptySpaceInBackpack(width, height);
            if (space) {
                return { x: space.x, y: space.y, parentId: parentItem.id };
            }
        } else if (parentItem?.item_type === 'rig' && !rigUsesSlots && rigGrid) {
            const space = findEmptySpaceInRig(width, height);
            if (space) {
                return { x: space.x, y: space.y, parentId: parentItem.id };
            }
        }
    }
    
    const stashSpace = findEmptySpace(width, height);
    if (stashSpace) {
        return { x: stashSpace.x, y: stashSpace.y, parentId: null };
    }
    
    return null;
}

function splitItemStackViaPrompt(item) {
    if (!canSplitItem(item)) {
        alert('分割できません。数量が不足しています。');
        return;
    }
    
    const quantity = item.quantity || 0;
    const maxStack = getItemStackLimit(item);
    const maxSplit = Math.min(quantity - 1, maxStack);
    const defaultSplit = Math.max(1, Math.min(Math.floor(quantity / 2), maxSplit));
    const splitAmount = prompt(`分割する数量を入力してください（1〜${maxSplit}）:`, defaultSplit);
    
    if (splitAmount === null) {
        return;
    }
    
    const amount = parseInt(splitAmount, 10);
    if (isNaN(amount) || amount <= 0 || amount >= quantity || amount > maxSplit) {
        alert('無効な数量です。');
        return;
    }
    
    const width = item.width || 1;
    const height = item.height || 1;
    const dropLocation = findSplitDropLocation(item, width, height);
    if (!dropLocation) {
        alert('分割したアイテムを配置する空きスペースがありません。');
        return;
    }
    
    item.quantity = quantity - amount;
    
    const newItem = {
        item_type: item.item_type,
        item_name: item.item_name,
        grid_x: dropLocation.x,
        grid_y: dropLocation.y,
        width,
        height,
        quantity: amount,
        equipped_slot: null,
        parent_item_id: dropLocation.parentId || null,
        ammo_stack: item.item_type === 'ammo' ? [] : null
    };
    
    normalizeWeaponDurability(newItem);
    items.push(newItem);
    saveItems();
    renderItems();
}

// 弾薬スタックをまとめる
function mergeAmmoStacks(sourceItem, targetItem) {
    if (!sourceItem || !targetItem || 
        sourceItem.item_type !== 'ammo' || targetItem.item_type !== 'ammo' ||
        sourceItem.item_name !== targetItem.item_name ||
        sourceItem === targetItem) {
        return false;
    }
    
    const ammoData = getAmmoData(sourceItem);
    if (!ammoData) return false;
    
    const stackSize = ammoData.stackSize || 60;
    const sourceQuantity = sourceItem.quantity || 0;
    const targetQuantity = targetItem.quantity || 0;
    
    if (sourceQuantity <= 0) return false;
    
    // ターゲットスタックの空き容量を計算
    const availableSpace = stackSize - targetQuantity;
    
    if (availableSpace <= 0) {
        // ターゲットスタックが満杯の場合は何もしない
        renderItems();
        return false;
    }
    
    // 移動できる数量を計算
    const transferAmount = Math.min(sourceQuantity, availableSpace);
    
    // ターゲットスタックに追加
    targetItem.quantity = targetQuantity + transferAmount;
    
    // ソーススタックから減らす
    sourceItem.quantity = sourceQuantity - transferAmount;
    
    // ソーススタックが0になった場合は削除
    if (sourceItem.quantity <= 0) {
        removeItem(sourceItem);
    }
    
    saveItems();
    renderItems();
    return true;
}

function handleItemContextMenu(event, item) {
    // 常にブラウザのデフォルトのコンテキストメニューを無効化
    event.preventDefault();
    event.stopPropagation();
    
    if (draggedItem) return;
    // 武器、弾薬、マガジンのみコンテキストメニューを表示
    if (item.item_type !== 'ammo' && item.item_type !== 'magazine' && item.item_type !== 'weapon') return;
    hideTooltip();
    hideContextMenu();
    hideDetailModal();
    showContextMenu(event.clientX, event.clientY, item);
}

// 初期化
function init() {
    createStashGrid();
    createBackpackGrid(DEFAULT_BACKPACK_SIZE);
    setupRigStructure(null);
    loadItems();
    loadUserInfo();
    loadBackgroundImage();
    setupEventListeners();
}

// スタッシュグリッドの作成
function createStashGrid() {
    stashGrid = [];
    stashGridElement.innerHTML = '';
    stashGridElement.style.gridTemplateColumns = `repeat(${STASH_SIZE.width}, ${STASH_GRID_CELL_SIZE}px)`;
    stashGridElement.style.gridAutoRows = `${STASH_GRID_CELL_SIZE}px`;
    // grid-auto-rowsを使用するため、gridTemplateRowsは設定しない
    
    // 十分な行数を生成（縦は可変だが、初期表示用に十分な行を生成）
    for (let y = 0; y < STASH_SIZE.height; y++) {
        const row = [];
        for (let x = 0; x < STASH_SIZE.width; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            stashGridElement.appendChild(cell);
            row.push(cell);
        }
        stashGrid.push(row);
    }
}

// スタッシュグリッドに行を追加する関数
function ensureStashRows(requiredRows) {
    while (stashGrid.length < requiredRows) {
        const y = stashGrid.length;
        const row = [];
        for (let x = 0; x < STASH_SIZE.width; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            stashGridElement.appendChild(cell);
            row.push(cell);
        }
        stashGrid.push(row);
    }
}

function getStashGridCoordinates(clientX, clientY) {
    if (!stashGridElement) return null;
    const rect = stashGridElement.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - GRID_PADDING) / (STASH_GRID_CELL_SIZE + GRID_GAP));
    const y = Math.floor((clientY - rect.top - GRID_PADDING) / (STASH_GRID_CELL_SIZE + GRID_GAP));
    return { rect, x, y };
}

function getBackpackGridCoordinates(clientX, clientY) {
    if (!backpackGridElement) return null;
    const rect = backpackGridElement.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - GRID_PADDING) / (BACKPACK_GRID_CELL_SIZE + GRID_GAP));
    const y = Math.floor((clientY - rect.top - GRID_PADDING) / (BACKPACK_GRID_CELL_SIZE + GRID_GAP));
    return { rect, x, y };
}

function getRigGridCoordinates(clientX, clientY) {
    if (!rigGridElement) return null;
    const rect = rigGridElement.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - GRID_PADDING) / (RIG_GRID_CELL_SIZE + GRID_GAP));
    const y = Math.floor((clientY - rect.top - GRID_PADDING) / (RIG_GRID_CELL_SIZE + GRID_GAP));
    return { rect, x, y };
}

// バックパックグリッドの作成
function createBackpackGrid(size = currentBackpackSize) {
    currentBackpackSize = cloneSize(size);
    backpackGrid = [];
    backpackGridElement.innerHTML = '';
    backpackGridElement.style.gridTemplateColumns = `repeat(${currentBackpackSize.width}, ${BACKPACK_GRID_CELL_SIZE}px)`;
    backpackGridElement.style.gridTemplateRows = `repeat(${currentBackpackSize.height}, ${BACKPACK_GRID_CELL_SIZE}px)`;
    
    for (let y = 0; y < currentBackpackSize.height; y++) {
        const row = [];
        for (let x = 0; x < currentBackpackSize.width; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            backpackGridElement.appendChild(cell);
            row.push(cell);
        }
        backpackGrid.push(row);
    }
}

function createRigCellGrid(size = currentRigGridSize) {
    currentRigGridSize = cloneSize(size);
    rigGrid = [];
    rigGridElement.innerHTML = '';
    rigGridElement.classList.remove('slot-mode');
    rigGridElement.style.gridTemplateColumns = `repeat(${currentRigGridSize.width}, ${RIG_GRID_CELL_SIZE}px)`;
    rigGridElement.style.gridTemplateRows = `repeat(${currentRigGridSize.height}, ${RIG_GRID_CELL_SIZE}px)`;
    
    for (let y = 0; y < currentRigGridSize.height; y++) {
        const row = [];
        for (let x = 0; x < currentRigGridSize.width; x++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            rigGridElement.appendChild(cell);
            row.push(cell);
        }
        rigGrid.push(row);
    }
}

function createRigSlotLayout(rigData) {
    rigGridElement.innerHTML = '';
    rigGridElement.classList.add('slot-mode');
    rigGridElement.style.gridTemplateColumns = '';
    rigGridElement.style.gridTemplateRows = '';
    rigSlots = [];
    rigSlotOccupancy = new Map();
    let slotId = 1;
    rigData.slots.forEach(slotInfo => {
        const size = RIG_SLOT_SIZES[slotInfo.type];
        if (!size) return;
        for (let i = 0; i < slotInfo.count; i++) {
            const slotElement = document.createElement('div');
            slotElement.className = 'rig-slot';
            slotElement.dataset.slotId = String(slotId);
            slotElement.dataset.slotType = String(slotInfo.type);
            const widthPx = size.width * (RIG_GRID_CELL_SIZE + GRID_GAP) - GRID_GAP;
            const heightPx = size.height * (RIG_GRID_CELL_SIZE + GRID_GAP) - GRID_GAP;
            slotElement.style.width = `${widthPx}px`;
            slotElement.style.height = `${heightPx}px`;
            rigGridElement.appendChild(slotElement);
            rigSlots.push({
                id: slotId,
                type: slotInfo.type,
                width: size.width,
                height: size.height,
                element: slotElement
            });
            slotId++;
        }
    });
}

function setupRigStructure(rigItem) {
    const rigData = getRigData(rigItem);
    if (rigData && rigData.slots && rigData.slots.length > 0) {
        rigUsesSlots = true;
        createRigSlotLayout(rigData);
        rigGrid = null;
    } else {
        rigUsesSlots = false;
        const size = rigData?.contentSize || DEFAULT_RIG_SIZE;
        createRigCellGrid(size);
        rigSlots = [];
        rigSlotOccupancy = new Map();
    }
}

function getRigSlotIdFromItem(item) {
    if (item.grid_x !== null && item.grid_x < 0) {
        return Math.abs(item.grid_x);
    }
    if (item.rig_slot_id) {
        return item.rig_slot_id;
    }
    return null;
}

function getRigSlotById(slotId) {
    if (!slotId) return null;
    return rigSlots.find(slot => slot.id === slotId) || null;
}

function getRigSlotUnderMouse(clientX, clientY) {
    if (!rigSlots || rigSlots.length === 0) return null;
    return rigSlots.find(slot => {
        const rect = slot.element.getBoundingClientRect();
        return clientX >= rect.left && clientX <= rect.right &&
               clientY >= rect.top && clientY <= rect.bottom;
    }) || null;
}

function canPlaceInRigSlot(item, slot, ignoreItem = null) {
    if (!slot) return false;
    const size = RIG_SLOT_SIZES[slot.type];
    if (!size) return false;
    if (item.width > size.width || item.height > size.height) {
        return false;
    }
    
    // スロット内の既存アイテムを取得
    const occupants = rigSlotOccupancy.get(slot.id) || [];
    
    // スロット内の使用済みスペースを計算
    const usedSpaces = [];
    for (const occupant of occupants) {
        if (occupant === item || occupant === ignoreItem) continue;
        // スロット内の相対位置を取得（grid_xが負の値でスロットIDを表す場合）
        const slotRelativeX = occupant.rig_slot_x || 0;
        const slotRelativeY = occupant.rig_slot_y || 0;
        usedSpaces.push({
            x: slotRelativeX,
            y: slotRelativeY,
            width: occupant.width,
            height: occupant.height
        });
    }
    
    // 新しいアイテムを配置できる位置を探す（横方向優先）
    for (let x = 0; x <= size.width - item.width; x++) {
        for (let y = 0; y <= size.height - item.height; y++) {
            // この位置に配置できるかチェック
            let canPlace = true;
            for (const used of usedSpaces) {
                if (!(x + item.width <= used.x || x >= used.x + used.width ||
                      y + item.height <= used.y || y >= used.y + used.height)) {
                    canPlace = false;
                    break;
                }
            }
            if (canPlace) {
    return true;
            }
        }
    }
    
    return false;
}

function highlightRigSlot(slot, isValid) {
    if (!slot) return;
    clearRigHighlight();
    if (isValid) {
        slot.element.classList.add('rig-slot-highlight-valid');
    } else {
        slot.element.classList.add('rig-slot-highlight-invalid');
    }
}

function positionItemInRigSlot(itemElement, slot, item) {
    const slotRelativeX = item.rig_slot_x || 0;
    const slotRelativeY = item.rig_slot_y || 0;
    const cellSize = RIG_GRID_CELL_SIZE;
    const step = cellSize + GRID_GAP;
    
    itemElement.style.position = 'absolute';
    itemElement.style.left = `${slotRelativeX * step}px`;
    itemElement.style.top = `${slotRelativeY * step}px`;
    itemElement.style.width = `${item.width * cellSize + Math.max(0, item.width - 1) * GRID_GAP}px`;
    itemElement.style.height = `${item.height * cellSize + Math.max(0, item.height - 1) * GRID_GAP}px`;
}

function markRigSlotOccupied(slotId, item, slotRelativeX = 0, slotRelativeY = 0) {
    if (!slotId) return;
    let occupants = rigSlotOccupancy.get(slotId) || [];
    // スロット内の相対位置を保存（既に含まれている場合でも更新）
    item.rig_slot_x = slotRelativeX;
    item.rig_slot_y = slotRelativeY;
    if (!occupants.includes(item)) {
        occupants.push(item);
        rigSlotOccupancy.set(slotId, occupants);
    }
    const slot = getRigSlotById(slotId);
    if (slot) {
        slot.element.classList.add('occupied');
    }
}

function unmarkRigSlotOccupied(slotId, item) {
    if (!slotId) return;
    let occupants = rigSlotOccupancy.get(slotId) || [];
    occupants = occupants.filter(occ => occ !== item);
    if (occupants.length === 0) {
        rigSlotOccupancy.delete(slotId);
        const slot = getRigSlotById(slotId);
        if (slot) {
            slot.element.classList.remove('occupied');
        }
    } else {
        rigSlotOccupancy.set(slotId, occupants);
    }
    delete item.rig_slot_x;
    delete item.rig_slot_y;
}

// アイテムの読み込み
async function loadItems() {
    try {
        const response = await fetch('/api/character/items');
        const data = await response.json();
        
        if (data.success) {
            items = data.items || [];
            
            // ammo_stackをパースし、武器サイズを最新データに合わせる
            items.forEach(item => {
                if (item.ammo_stack) {
                    if (typeof item.ammo_stack === 'string') {
                        try {
                            item.ammo_stack = JSON.parse(item.ammo_stack);
                        } catch (e) {
                            item.ammo_stack = [];
                        }
                    }
                } else {
                    item.ammo_stack = [];
                }
                
                if (item.item_type === 'weapon') {
                    const weaponData = WEAPON_DATA[item.item_name];
                    if (weaponData && weaponData.stashSize) {
                        item.width = weaponData.stashSize.width;
                        item.height = weaponData.stashSize.height;
                    }
                    normalizeWeaponDurability(item);
                } else if (item.item_type === 'backpack') {
                    const backpackData = BACKPACK_DATA[item.item_name];
                    if (backpackData && backpackData.stashSize) {
                        item.width = backpackData.stashSize.width;
                        item.height = backpackData.stashSize.height;
                    }
                } else if (item.item_type === 'rig') {
                    const rigData = RIG_DATA[item.item_name];
                    if (rigData && rigData.stashSize) {
                        item.width = rigData.stashSize.width;
                        item.height = rigData.stashSize.height;
                    }
                } else if (item.item_type === 'medical') {
                    const medicalData = getMedicalData(item);
                    if (medicalData && medicalData.stashSize) {
                        item.width = medicalData.stashSize.width;
                        item.height = medicalData.stashSize.height;
                    }
                    // 医薬品のquantityが1以下の場合、MEDICAL_DATAのdurabilityを設定
                    if (medicalData) {
                        if (!item.quantity || item.quantity <= 1) {
                            item.quantity = medicalData.durability || 1;
                        }
                    }
                } else if (item.item_type === 'armor') {
                    // アーマーのarmor_durabilityがnullの場合は最大耐久値を設定
                    if (item.armor_durability === null || item.armor_durability === undefined) {
                        const armorData = getArmorData(item.item_name);
                        if (armorData) {
                            item.armor_durability = armorData.durability;
                        }
                    }
                }
            });
            
            renderItems();
            updateStashCapacity();
        }
    } catch (error) {
        console.error('アイテムの読み込みに失敗しました:', error);
    }
}

// アイテムの描画
function renderItems() {
    clearMagazineHighlight();
    hideContextMenu();
    items.forEach(item => {
        getItemIdentifier(item);
    });
    
    // 既存のアイテムを削除
    document.querySelectorAll('.item').forEach(item => item.remove());
    
    // グリッドをクリア
    stashGrid.forEach(row => {
        row.forEach(cell => {
            cell.classList.remove('occupied');
        });
    });
    
    if (backpackGrid) {
        backpackGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('occupied');
            });
        });
    }
    
    if (rigGrid) {
        rigGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('occupied');
                cell.classList.remove('drag-over');
            });
        });
    }
    
    if (rigSlots && rigSlots.length > 0) {
        rigSlots.forEach(slot => {
            slot.element.classList.remove('occupied');
            slot.element.classList.remove('rig-slot-highlight-valid');
            slot.element.classList.remove('rig-slot-highlight-invalid');
        });
    }
    if (rigUsesSlots) {
        rigSlotOccupancy = new Map();
    }
    
    // 装備スロットをクリア
    document.querySelectorAll('.equipment-slot .slot-content').forEach(slot => {
        slot.innerHTML = '';
    });
    
    // バックパックとリグを探す
    equippedBackpack = items.find(item => item.equipped_slot === 'backpack');
    equippedRig = items.find(item => item.equipped_slot === 'rig');
    
    // バックパックパネルの表示/非表示
    let hasBackpack = false;
    if (equippedBackpack) {
        const backpackSize = getBackpackContentSize(equippedBackpack);
        createBackpackGrid(backpackSize);
        backpackPanel.classList.remove('hidden');
        backpackName.textContent = equippedBackpack.item_name;
        updateBackpackCapacity();
        hasBackpack = true;
    } else {
        createBackpackGrid(DEFAULT_BACKPACK_SIZE);
        backpackPanel.classList.add('hidden');
    }
    
    // リグパネルの表示/非表示
    let hasRig = false;
    if (equippedRig) {
        setupRigStructure(equippedRig);
        rigPanel.classList.remove('hidden');
        rigName.textContent = equippedRig.item_name;
        updateRigCapacity();
        hasRig = true;
    } else {
        setupRigStructure(null);
        rigPanel.classList.add('hidden');
    }

    if (gearPanel) {
        if (hasBackpack || hasRig) {
            gearPanel.classList.remove('hidden');
        } else {
            gearPanel.classList.add('hidden');
        }
    }
    
    // スタッシュに配置されるアイテムの最大行数を計算
    let maxStashRow = 0;
    items.forEach(item => {
        if (!item.equipped_slot && !item.parent_item_id && item.grid_x !== null && item.grid_y !== null) {
            const itemBottom = item.grid_y + item.height;
            if (itemBottom > maxStashRow) {
                maxStashRow = itemBottom;
            }
        }
    });
    // 必要な行数を確保（最低でも初期行数は確保）
    ensureStashRows(Math.max(maxStashRow, STASH_SIZE.height));
    
    items.forEach(item => {
        if (item.equipped_slot) {
            // 装備スロットに表示
            const slot = document.querySelector(`[data-slot="${item.equipped_slot}"] .slot-content`);
            if (slot) {
                const itemElement = createItemElement(item, true);
                slot.appendChild(itemElement);
            }
        } else if (item.parent_item_id) {
            // バックパック内のアイテム
            if (equippedBackpack && item.parent_item_id === equippedBackpack.id) {
                const itemElement = createItemElement(item, false);
                backpackGridElement.appendChild(itemElement);
                positionItemInBackpack(itemElement, item);
                markBackpackCellsOccupied(item);
            }
            // リグ内のアイテム
            else if (equippedRig && item.parent_item_id === equippedRig.id) {
                if (rigUsesSlots) {
                    const slotId = getRigSlotIdFromItem(item);
                    const slot = getRigSlotById(slotId);
            if (slot) {
                const itemElement = createItemElement(item, false);
                slot.element.appendChild(itemElement);
                positionItemInRigSlot(itemElement, slot, item);
                const slotRelativeX = item.rig_slot_x || 0;
                const slotRelativeY = item.rig_slot_y || 0;
                markRigSlotOccupied(slot.id, item, slotRelativeX, slotRelativeY);
            } else if (rigGridElement) {
                        const itemElement = createItemElement(item, false);
                        rigGridElement.appendChild(itemElement);
                        positionItemInRig(itemElement, item);
                    }
                } else {
                    const itemElement = createItemElement(item, false);
                    rigGridElement.appendChild(itemElement);
                    positionItemInRig(itemElement, item);
                    markRigCellsOccupied(item);
                }
            }
        } else if (item.grid_x !== null && item.grid_y !== null) {
            // スタッシュに表示
            const itemElement = createItemElement(item, false);
            stashGridElement.appendChild(itemElement);
            positionItem(itemElement, item);
            markCellsOccupied(item);
        }
    });
    
    updateStashCapacity();
    if (equippedBackpack) {
        updateBackpackCapacity();
    }
    if (equippedRig) {
        updateRigCapacity();
    }
    
    // 武器詳細モーダルが開いている場合はアタッチメント欄を再描画
    const modal = document.getElementById('itemDetailModal');
    if (modal && !modal.classList.contains('hidden')) {
        const weaponTitle = document.getElementById('detailTitle');
        if (weaponTitle && weaponTitle.textContent) {
            // 武器名と装備スロットで武器を検索（IDが変わっている可能性があるため）
            const weaponSlot = weaponTitle.dataset.weaponSlot;
            const weaponItem = items.find(i => 
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

// アイテム要素の作成
function createItemElement(item, isEquipped) {
    const itemElement = document.createElement('div');
    itemElement.className = 'item';
    const identifier = getItemIdentifier(item);
    itemElement.dataset.itemId = identifier;
    itemElement.dataset.itemType = item.item_type;
    itemElement.dataset.width = item.width;
    itemElement.dataset.height = item.height;
    
    if (isEquipped) {
        itemElement.dataset.equipped = 'true';
        itemElement.style.width = '100%';
        itemElement.style.height = '100%';
        itemElement.style.position = 'relative';
    } else {
        itemElement.dataset.equipped = 'false';
        // グリッドセルサイズ + ギャップを考慮
        itemElement.style.width = `${item.width * GRID_CELL_SIZE + Math.max(0, item.width - 1) * GRID_GAP}px`;
        itemElement.style.height = `${item.height * GRID_CELL_SIZE + Math.max(0, item.height - 1) * GRID_GAP}px`;
        itemElement.style.position = 'absolute';
    }
    
    const quantityText = getItemQuantityText(item);
    const showName = item.item_type !== 'magazine';
    const imageUrl = getItemImageUrl(item);
    const shouldShowName = showName && !imageUrl;
    // 弾薬の場合は短縮名、医薬品の場合は（）の中の部分、それ以外は正式名称
    let displayName;
    if (item.item_type === 'ammo') {
        displayName = getAmmoDisplayName(item);
    } else if (item.item_type === 'medical') {
        displayName = getMedicalDisplayName(item);
    } else {
        displayName = item.item_name;
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
        const armorData = getArmorData(item.item_name);
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
        const helmetData = getHelmetData(item.item_name);
        if (helmetData) {
            const maxDurability = helmetData.durability;
            const durability = item.helmet_durability !== null && item.helmet_durability !== undefined 
                ? item.helmet_durability 
                : maxDurability;
            itemContent += `<div class="item-armor-durability">${durability}/${maxDurability}</div>`;
        }
    }
    itemElement.innerHTML = itemContent;
    
    // ドラッグイベント（装備済みアイテムもドラッグ可能）
    itemElement.addEventListener('mousedown', (e) => startDrag(e, itemElement, item));
    itemElement.addEventListener('dblclick', (e) => handleItemDoubleClick(e, item));
    itemElement.addEventListener('mouseenter', (e) => showTooltip(e, item));
    itemElement.addEventListener('mousemove', moveTooltip);
    itemElement.addEventListener('mouseleave', () => hideTooltip());
    // capture phaseで処理して、グローバルなイベントリスナーより先に実行されるようにする
    itemElement.addEventListener('contextmenu', (e) => handleItemContextMenu(e, item), true);
    
    return itemElement;
}

// アイテムの位置設定
function positionItem(itemElement, item) {
    const cellSize = STASH_GRID_CELL_SIZE;
    const step = cellSize + GRID_GAP;
    const x = item.grid_x * step + GRID_PADDING;
    const y = item.grid_y * step + GRID_PADDING;
    itemElement.style.left = `${x}px`;
    itemElement.style.top = `${y}px`;
    itemElement.style.width = `${item.width * cellSize + Math.max(0, item.width - 1) * GRID_GAP}px`;
    itemElement.style.height = `${item.height * cellSize + Math.max(0, item.height - 1) * GRID_GAP}px`;
}

// バックパック内のアイテムの位置設定
function positionItemInBackpack(itemElement, item) {
    const cellSize = BACKPACK_GRID_CELL_SIZE;
    const step = cellSize + GRID_GAP;
    const x = item.grid_x * step + GRID_PADDING;
    const y = item.grid_y * step + GRID_PADDING;
    itemElement.style.left = `${x}px`;
    itemElement.style.top = `${y}px`;
    itemElement.style.width = `${item.width * cellSize + Math.max(0, item.width - 1) * GRID_GAP}px`;
    itemElement.style.height = `${item.height * cellSize + Math.max(0, item.height - 1) * GRID_GAP}px`;
}

// バックパック内のセルを占有としてマーク
function markBackpackCellsOccupied(item) {
    for (let y = item.grid_y; y < item.grid_y + item.height; y++) {
        for (let x = item.grid_x; x < item.grid_x + item.width; x++) {
            if (y < currentBackpackSize.height && x < currentBackpackSize.width) {
                backpackGrid[y][x].classList.add('occupied');
            }
        }
    }
}

// リグ内のアイテムの位置設定
function positionItemInRig(itemElement, item) {
    const cellSize = RIG_GRID_CELL_SIZE;
    const step = cellSize + GRID_GAP;
    const x = item.grid_x * step + GRID_PADDING;
    const y = item.grid_y * step + GRID_PADDING;
    itemElement.style.left = `${x}px`;
    itemElement.style.top = `${y}px`;
    itemElement.style.width = `${item.width * cellSize + Math.max(0, item.width - 1) * GRID_GAP}px`;
    itemElement.style.height = `${item.height * cellSize + Math.max(0, item.height - 1) * GRID_GAP}px`;
}

// リグ内のセルを占有としてマーク
function markRigCellsOccupied(item) {
    if (rigUsesSlots) return;
    for (let y = item.grid_y; y < item.grid_y + item.height; y++) {
        for (let x = item.grid_x; x < item.grid_x + item.width; x++) {
            if (y < currentRigGridSize.height && x < currentRigGridSize.width) {
                rigGrid[y][x].classList.add('occupied');
            }
        }
    }
}

// セルを占有としてマーク
function markCellsOccupied(item) {
    for (let y = item.grid_y; y < item.grid_y + item.height; y++) {
        for (let x = item.grid_x; x < item.grid_x + item.width; x++) {
            if (y < STASH_SIZE.height && x < STASH_SIZE.width) {
                stashGrid[y][x].classList.add('occupied');
            }
        }
    }
}

// ドラッグ開始
function startDrag(e, itemElement, item) {
    if (e.button !== 0) {
        return;
    }
    hideContextMenu();
    hideDetailModal();
    
    e.preventDefault();
    e.stopPropagation();
    
    // Ctrlキーの初期状態を記録
    isCtrlPressed = e.ctrlKey || e.metaKey;
    
    draggedItem = { element: itemElement, item: item, hasMoved: false };
    
    const rect = itemElement.getBoundingClientRect();
    // マウス位置からアイテム内の相対位置を計算
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    if (itemElement.dataset.equipped === 'true') {
        itemElement.style.width = `${rect.width}px`;
        itemElement.style.height = `${rect.height}px`;
    }
    
    // すべてのアイテムを固定位置で表示（画面座標で追従）
    itemElement.style.position = 'fixed';
    itemElement.style.zIndex = '10000';
    // 現在の画面位置を設定
    itemElement.style.left = `${rect.left}px`;
    itemElement.style.top = `${rect.top}px`;
    
    itemElement.classList.add('dragging');
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('keydown', checkCtrlKey);
    document.addEventListener('keyup', checkCtrlKey);
}

// ドラッグ中
function onDrag(e) {
    if (!draggedItem) return;
    
    const itemElement = draggedItem.element;
    const item = draggedItem.item;
    draggedItem.hasMoved = true;
    
    // マウス位置に追従
    itemElement.style.left = `${e.clientX - dragOffset.x}px`;
    itemElement.style.top = `${e.clientY - dragOffset.y}px`;
    
    clearMagazineHighlight();
    if (item.item_type === 'ammo') {
        const targetItemElement = getItemElementUnderMouse(e.clientX, e.clientY, itemElement);
        const targetItem = getItemFromElement(targetItemElement);
        if (targetItem && targetItem.item_type === 'magazine') {
            const isValid = canLoadAmmoIntoMagazine(item, targetItem);
            highlightMagazineTarget(targetItemElement, isValid);
            clearHighlight();
            clearBackpackHighlight();
            clearRigHighlight();
            clearEquipmentHighlight();
            return;
        }
    }
    
    // アタッチメントスロットをチェック
    const attachmentSlot = getAttachmentSlotUnderMouse(e.clientX, e.clientY);
    if (attachmentSlot) {
        highlightAttachmentSlot(attachmentSlot, item);
        clearHighlight();
        clearBackpackHighlight();
        clearRigHighlight();
        clearEquipmentHighlight();
        return;
    }
    
    // 装備スロットの上にいるかチェック
    const equipmentSlot = getEquipmentSlotUnderMouse(e.clientX, e.clientY);
    if (equipmentSlot) {
        // 装備スロットをハイライト
        highlightEquipmentSlot(equipmentSlot, item);
        clearHighlight();
        clearBackpackHighlight();
    } else {
        // リググリッドの上にいるかチェック
        if (equippedRig && !rigPanel.classList.contains('hidden')) {
            if (rigUsesSlots) {
                const slot = getRigSlotUnderMouse(e.clientX, e.clientY);
                if (slot) {
                    const isValid = canPlaceInRigSlot(item, slot, item);
                    highlightRigSlot(slot, isValid);
                    clearHighlight();
                    clearBackpackHighlight();
                    clearEquipmentHighlight();
                    return;
                } else {
                    clearRigHighlight();
                }
            } else {
                const rigCoords = getRigGridCoordinates(e.clientX, e.clientY);
                if (rigCoords) {
                    const { rect: rigRect, x: gridX, y: gridY } = rigCoords;
                if (e.clientX >= rigRect.left && e.clientX <= rigRect.right &&
                    e.clientY >= rigRect.top && e.clientY <= rigRect.bottom) {
                    highlightRigDropZone(gridX, gridY, item);
                    clearHighlight();
                    clearBackpackHighlight();
                    clearEquipmentHighlight();
                    return;
                    }
                }
            }
        }
        
        // バックパックグリッドの上にいるかチェック
        if (equippedBackpack && !backpackPanel.classList.contains('hidden')) {
            const backpackCoords = getBackpackGridCoordinates(e.clientX, e.clientY);
            if (backpackCoords) {
                const { rect: backpackRect, x: gridX, y: gridY } = backpackCoords;
            if (e.clientX >= backpackRect.left && e.clientX <= backpackRect.right &&
                e.clientY >= backpackRect.top && e.clientY <= backpackRect.bottom) {
                highlightBackpackDropZone(gridX, gridY, item);
                clearHighlight();
                clearRigHighlight();
                clearEquipmentHighlight();
                return;
                }
            }
        }
        
        // スタッシュグリッドの上にいるかチェック
        const stashCoords = getStashGridCoordinates(e.clientX, e.clientY);
        if (stashCoords) {
            const { rect: gridRect, x: gridX, y: gridY } = stashCoords;
        if (e.clientX >= gridRect.left && e.clientX <= gridRect.right &&
            e.clientY >= gridRect.top && e.clientY <= gridRect.bottom) {
            highlightDropZone(gridX, gridY, item);
            clearEquipmentHighlight();
            clearBackpackHighlight();
            clearRigHighlight();
        } else {
            clearHighlight();
            clearEquipmentHighlight();
            clearBackpackHighlight();
            clearRigHighlight();
        }
        } else {
            clearHighlight();
            clearEquipmentHighlight();
            clearBackpackHighlight();
            clearRigHighlight();
        }
    }
}

// Ctrlキーの状態をチェック
function checkCtrlKey(e) {
    if (draggedItem) {
        isCtrlPressed = e.ctrlKey || e.metaKey;
    }
}

// ドラッグ終了
function stopDrag(e) {
    if (!draggedItem) return;
    
    const itemElement = draggedItem.element;
    const item = draggedItem.item;
    
    // イベントリスナーを削除
    document.removeEventListener('keydown', checkCtrlKey);
    document.removeEventListener('keyup', checkCtrlKey);
    
    // Ctrlキーが押されている場合の最終チェック
    const ctrlPressed = e.ctrlKey || e.metaKey || isCtrlPressed;
    const hasMoved = draggedItem.hasMoved;
    
    if (ctrlPressed && !hasMoved) {
        quickMoveItem(item);
        itemElement.classList.remove('dragging');
        clearHighlight();
        clearEquipmentHighlight();
        clearBackpackHighlight();
        clearRigHighlight();
    clearMagazineHighlight();
        clearAttachmentHighlight();
        draggedItem = null;
        isCtrlPressed = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('keydown', checkCtrlKey);
        document.removeEventListener('keyup', checkCtrlKey);
        return;
    }
    
    // Ctrl+左クリック（ドラッグ無し）時の即時移動
    if (ctrlPressed && (!draggedItem || (dragOffset.x === 0 && dragOffset.y === 0))) {
        quickMoveItem(item);
        cleanupDragState();
        return;
    }
    
    clearMagazineHighlight();
    clearAttachmentHighlight();
    let handledSpecialDrop = false;
    
    // Ctrl+ドラッグで弾薬を分割
    if (ctrlPressed && item.item_type === 'ammo' && (item.quantity || 0) > 1) {
        const targetElement = getItemElementUnderMouse(e.clientX, e.clientY, itemElement);
        const targetItem = getItemFromElement(targetElement);
        
        // 空きスペースにドロップした場合のみ分割
        if (!targetItem || targetItem === item) {
            const rigCoords = getRigGridCoordinates(e.clientX, e.clientY);
            const backpackCoords = getBackpackGridCoordinates(e.clientX, e.clientY);
            const stashCoords = getStashGridCoordinates(e.clientX, e.clientY);
            
            let dropLocation = null;
            let parentId = null;
            
            // リグ、バックパック、スタッシュの順でチェック
            if (rigCoords) {
                const { rect: rigRect, x: gridX, y: gridY } = rigCoords;
                if (e.clientX >= rigRect.left && e.clientX <= rigRect.right &&
                    e.clientY >= rigRect.top && e.clientY <= rigRect.bottom &&
                    isValidRigPosition(gridX, gridY, 1, 1, null)) {
                    dropLocation = { x: gridX, y: gridY };
                    parentId = equippedRig?.id;
                }
            } else if (backpackCoords) {
                const { rect: bpRect, x: gridX, y: gridY } = backpackCoords;
                if (e.clientX >= bpRect.left && e.clientX <= bpRect.right &&
                    e.clientY >= bpRect.top && e.clientY <= bpRect.bottom &&
                    isValidBackpackPosition(gridX, gridY, 1, 1, null)) {
                    dropLocation = { x: gridX, y: gridY };
                    parentId = equippedBackpack?.id;
                }
            } else if (stashCoords) {
                const { rect: gridRect, x: gridX, y: gridY } = stashCoords;
                if (e.clientX >= gridRect.left && e.clientX <= gridRect.right &&
                    e.clientY >= gridRect.top && e.clientY <= gridRect.bottom &&
                    isValidPosition(gridX, gridY, 1, 1, null)) {
                    dropLocation = { x: gridX, y: gridY };
                    parentId = null;
                }
            }
            
            if (dropLocation) {
                handledSpecialDrop = splitAmmoStack(item, dropLocation, parentId);
            }
        }
    }
    
    if (item.item_type === 'ammo' && !handledSpecialDrop) {
        const targetElement = getItemElementUnderMouse(e.clientX, e.clientY, itemElement);
        const targetItem = getItemFromElement(targetElement);
        
        // マガジンにドロップした場合
        if (targetItem && targetItem !== item && targetItem.item_type === 'magazine') {
            handledSpecialDrop = processAmmoToMagazineDrop(item, targetItem);
        }
        // 同じ種類の弾薬スタックにドロップした場合（Ctrlキーが押されていない場合のみ）
        else if (!ctrlPressed && targetItem && targetItem !== item && targetItem.item_type === 'ammo' && 
                 targetItem.item_name === item.item_name) {
            handledSpecialDrop = mergeAmmoStacks(item, targetItem);
        }
    }
    
    // アタッチメントスロットにドロップした場合
    const attachmentSlot = getAttachmentSlotUnderMouse(e.clientX, e.clientY);
    if (attachmentSlot && !handledSpecialDrop) {
        if (item.item_type === 'magazine' && attachmentSlot.dataset.attachmentType === 'magazine') {
            // モーダルが開いているか確認
            const modal = document.getElementById('itemDetailModal');
            if (modal && !modal.classList.contains('hidden')) {
                const weaponTitle = document.getElementById('detailTitle');
                if (weaponTitle) {
                    const weaponItem = items.find(i => i.item_name === weaponTitle.textContent && i.item_type === 'weapon');
                    if (weaponItem && canLoadMagazineIntoWeapon(item, weaponItem)) {
                        // 既に武器に装填されているマガジンを探す
                        const existingMagazine = items.find(i => 
                            i.item_type === 'magazine' && 
                            i.parent_item_id === weaponItem.id &&
                            i.grid_x === null && 
                            i.grid_y === null
                        );
                        
                        // 既存のマガジンをスタッシュに戻す
                        if (existingMagazine) {
                            const emptySpace = findEmptySpace(existingMagazine.width, existingMagazine.height);
                            if (emptySpace) {
                                existingMagazine.grid_x = emptySpace.x;
                                existingMagazine.grid_y = emptySpace.y;
                                existingMagazine.parent_item_id = null;
                            } else {
                                // 空きがない場合は元の位置に戻す
                                renderItems();
                                itemElement.classList.remove('dragging');
                                clearHighlight();
                                clearEquipmentHighlight();
                                clearBackpackHighlight();
                                clearMagazineHighlight();
                                clearAttachmentHighlight();
                                draggedItem = null;
                                document.removeEventListener('mousemove', onDrag);
                                document.removeEventListener('mouseup', stopDrag);
                                return;
                            }
                        }
                        
                        // マガジンを武器に装填
                        item.parent_item_id = weaponItem.id;
                        item.grid_x = null;
                        item.grid_y = null;
                        item.equipped_slot = null;
                        saveItems();
                        renderItems();
                        
                        // アタッチメント欄を再描画
                        renderWeaponAttachments(weaponItem);
                        
                        itemElement.classList.remove('dragging');
                        clearHighlight();
                        clearEquipmentHighlight();
                        clearBackpackHighlight();
                        clearMagazineHighlight();
                        clearAttachmentHighlight();
                        draggedItem = null;
                        document.removeEventListener('mousemove', onDrag);
                        document.removeEventListener('mouseup', stopDrag);
                        return;
                    }
                }
            }
        }
    }
    
    if (handledSpecialDrop) {
        itemElement.classList.remove('dragging');
        itemElement.style.pointerEvents = '';
        clearHighlight();
        clearEquipmentHighlight();
        clearBackpackHighlight();
        clearRigHighlight();
        clearAttachmentHighlight();
        draggedItem = null;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        return;
    }
    
    // 装備スロットの上にドロップしたかチェック
    const equipmentSlot = getEquipmentSlotUnderMouse(e.clientX, e.clientY);
    const slotType = equipmentSlot ? equipmentSlot.dataset.slot : null;
    
    // マガジンを武器スロットにドロップした場合
    if (equipmentSlot && item.item_type === 'magazine' && (slotType === 'primary' || slotType === 'secondary')) {
        const weaponItem = items.find(i => i.equipped_slot === slotType);
        if (weaponItem && canLoadMagazineIntoWeapon(item, weaponItem)) {
            // 既に武器に装填されているマガジンを探す
            const existingMagazine = items.find(i => 
                i.item_type === 'magazine' && 
                i.parent_item_id === weaponItem.id &&
                i.grid_x === null && 
                i.grid_y === null
            );
            
            // 既存のマガジンをスタッシュに戻す
            if (existingMagazine) {
                const emptySpace = findEmptySpace(existingMagazine.width, existingMagazine.height);
                if (emptySpace) {
                    existingMagazine.grid_x = emptySpace.x;
                    existingMagazine.grid_y = emptySpace.y;
                    existingMagazine.parent_item_id = null;
                } else {
                    // 空きがない場合は元の位置に戻す
                    renderItems();
                    itemElement.classList.remove('dragging');
                    clearHighlight();
                    clearEquipmentHighlight();
                    clearBackpackHighlight();
                    clearMagazineHighlight();
                    draggedItem = null;
                    document.removeEventListener('mousemove', onDrag);
                    document.removeEventListener('mouseup', stopDrag);
                    return;
                }
            }
            
            // マガジンを武器に装填
            item.parent_item_id = weaponItem.id;
            item.grid_x = null;
            item.grid_y = null;
            item.equipped_slot = null;
            saveItems();
            renderItems();
            
            // アタッチメント欄を再描画（武器詳細モーダルが開いている場合）
            const modal = document.getElementById('itemDetailModal');
            if (modal && !modal.classList.contains('hidden')) {
                const weaponTitle = document.getElementById('detailTitle');
                if (weaponTitle && weaponTitle.textContent === weaponItem.item_name) {
                    renderWeaponAttachments(weaponItem);
                }
            }
            
            itemElement.classList.remove('dragging');
            clearHighlight();
            clearEquipmentHighlight();
            clearBackpackHighlight();
            clearMagazineHighlight();
            draggedItem = null;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            return;
        } else {
            // 互換性がない場合は元の位置に戻す
            renderItems();
            itemElement.classList.remove('dragging');
            clearHighlight();
            clearEquipmentHighlight();
            clearBackpackHighlight();
            clearMagazineHighlight();
            draggedItem = null;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
            return;
        }
    }
    
    if (equipmentSlot && canEquipItem(item, slotType)) {
        // 既に装備されているアイテムがあるかチェック
        const existingItem = items.find(i => i.equipped_slot === slotType);
        if (existingItem) {
            // 既存のアイテムをスタッシュに戻す
            const emptySpace = findEmptySpace(existingItem.width, existingItem.height);
            if (emptySpace) {
                existingItem.grid_x = emptySpace.x;
                existingItem.grid_y = emptySpace.y;
                existingItem.equipped_slot = null;
                existingItem.parent_item_id = null;
            } else {
                // 空きがない場合は元の位置に戻す
                renderItems();
                itemElement.classList.remove('dragging');
                clearHighlight();
                clearEquipmentHighlight();
                clearBackpackHighlight();
                clearMagazineHighlight();
                draggedItem = null;
                document.removeEventListener('mousemove', onDrag);
                document.removeEventListener('mouseup', stopDrag);
                return;
            }
        }
        
        // 既にリグスロットにある場合は削除
        if (rigUsesSlots && item.grid_x !== null && item.grid_x < 0) {
            const oldSlotId = Math.abs(item.grid_x);
            unmarkRigSlotOccupied(oldSlotId, item);
        }
        
        // アイテムを装備
        item.equipped_slot = equipmentSlot.dataset.slot;
        item.grid_x = null;
        item.grid_y = null;
        item.parent_item_id = null;
        
        // アーマー装備時は耐久値を設定
        if (slotType === 'armor' && item.item_type === 'armor') {
            // アーマーデータを取得（item_data.pyから取得する必要があるが、ここではデフォルト値を設定）
            // 実際の値はサーバー側で設定される
            if (item.armor_durability === null || item.armor_durability === undefined) {
                // デフォルト耐久値はサーバー側で設定されるため、ここではnullのまま
                item.armor_durability = null;
            }
        }
        
        // ヘルメット装備時は耐久値を設定
        if (slotType === 'head' && item.item_type === 'helmet') {
            // ヘルメットデータを取得（item_data.pyから取得する必要があるが、ここではデフォルト値を設定）
            // 実際の値はサーバー側で設定される
            if (item.helmet_durability === null || item.helmet_durability === undefined) {
                // デフォルト耐久値はサーバー側で設定されるため、ここではnullのまま
                item.helmet_durability = null;
            }
        }
        
        saveItems();
        renderItems();
    } else {
        // リグ、バックパック、スタッシュの順でチェック
        let handled = false;
        
        // 既にリグスロットにある場合は削除
        if (rigUsesSlots && item.grid_x !== null && item.grid_x < 0) {
            const oldSlotId = Math.abs(item.grid_x);
            unmarkRigSlotOccupied(oldSlotId, item);
        }
        
        // リグのチェック
        if (equippedRig && !rigPanel.classList.contains('hidden')) {
        if (rigUsesSlots) {
            const slot = getRigSlotUnderMouse(e.clientX, e.clientY);
            if (slot) {
                if (canPlaceInRigSlot(item, slot, item)) {
                        // スロット内の適切な位置を見つける
                        const size = RIG_SLOT_SIZES[slot.type];
                        const occupants = rigSlotOccupancy.get(slot.id) || [];
                        const usedSpaces = [];
                        for (const occupant of occupants) {
                            if (occupant === item) continue;
                            const slotRelativeX = occupant.rig_slot_x || 0;
                            const slotRelativeY = occupant.rig_slot_y || 0;
                            usedSpaces.push({
                                x: slotRelativeX,
                                y: slotRelativeY,
                                width: occupant.width,
                                height: occupant.height
                            });
                        }
                        
                        // 配置可能な位置を探す（横方向優先）
                        let placed = false;
                        for (let x = 0; x <= size.width - item.width && !placed; x++) {
                            for (let y = 0; y <= size.height - item.height && !placed; y++) {
                                let canPlace = true;
                                for (const used of usedSpaces) {
                                    if (!(x + item.width <= used.x || x >= used.x + used.width ||
                                          y + item.height <= used.y || y >= used.y + used.height)) {
                                        canPlace = false;
                                        break;
                                    }
                                }
                                if (canPlace) {
                                    // 既にリグスロットにある場合は削除
                                    if (item.grid_x !== null && item.grid_x < 0) {
                                        const oldSlotId = Math.abs(item.grid_x);
                                        if (oldSlotId !== slot.id) {
                                            unmarkRigSlotOccupied(oldSlotId, item);
                                        }
                                    }
                                    
                    item.grid_x = -slot.id;
                    item.grid_y = 0;
                    item.equipped_slot = null;
                    item.parent_item_id = equippedRig.id;
                                    markRigSlotOccupied(slot.id, item, x, y);
                    saveItems();
                    renderItems();
                handled = true;
                                    placed = true;
                                }
                            }
                        }
                    }
            }
        } else if (rigGridElement) {
                const rigCoords = getRigGridCoordinates(e.clientX, e.clientY);
                if (rigCoords) {
                    const { rect: rigRect, x: gridX, y: gridY } = rigCoords;
            if (e.clientX >= rigRect.left && e.clientX <= rigRect.right &&
                e.clientY >= rigRect.top && e.clientY <= rigRect.bottom) {
                if (isValidRigPosition(gridX, gridY, item.width, item.height, item)) {
                    item.grid_x = gridX;
                    item.grid_y = gridY;
                    item.equipped_slot = null;
                    item.parent_item_id = equippedRig.id;
                    saveItems();
                    renderItems();
                handled = true;
            }
        }
                }
            }
        }
        
        // バックパックのチェック（リグで処理されなかった場合）
        if (!handled && equippedBackpack && !backpackPanel.classList.contains('hidden')) {
            const backpackCoords = getBackpackGridCoordinates(e.clientX, e.clientY);
            if (backpackCoords) {
                const { rect: backpackRect, x: gridX, y: gridY } = backpackCoords;
                if (e.clientX >= backpackRect.left && e.clientX <= backpackRect.right &&
                    e.clientY >= backpackRect.top && e.clientY <= backpackRect.bottom) {
                    if (isValidBackpackPosition(gridX, gridY, item.width, item.height, item)) {
                        // 既にリグスロットにある場合は削除（まだ削除されていない場合）
                        if (rigUsesSlots && item.grid_x !== null && item.grid_x < 0) {
                            const oldSlotId = Math.abs(item.grid_x);
                            unmarkRigSlotOccupied(oldSlotId, item);
                        }
                        item.grid_x = gridX;
                        item.grid_y = gridY;
                        item.equipped_slot = null;
                        item.parent_item_id = equippedBackpack.id;
                        saveItems();
                        renderItems();
                        handled = true;
                    }
                }
            }
        }
        
        // スタッシュのチェック（リグとバックパックで処理されなかった場合）
        if (!handled) {
            const stashCoords = getStashGridCoordinates(e.clientX, e.clientY);
            if (stashCoords) {
                const { rect: gridRect, x: gridX, y: gridY } = stashCoords;
                    if (e.clientX >= gridRect.left && e.clientX <= gridRect.right &&
                    e.clientY >= gridRect.top && e.clientY <= gridRect.bottom &&
                    isValidPosition(gridX, gridY, item.width, item.height, item)) {
                    // 既にリグスロットにある場合は削除（まだ削除されていない場合）
                    if (rigUsesSlots && item.grid_x !== null && item.grid_x < 0) {
                        const oldSlotId = Math.abs(item.grid_x);
                        unmarkRigSlotOccupied(oldSlotId, item);
                    }
                        item.grid_x = gridX;
                        item.grid_y = gridY;
                        item.equipped_slot = null;
                        item.parent_item_id = null;
                        saveItems();
                        renderItems();
                    handled = true;
                }
            }
        }
        
        if (!handled) {
            renderItems();
        }
    }
    
    itemElement.classList.remove('dragging');
    clearHighlight();
    clearEquipmentHighlight();
    clearBackpackHighlight();
    clearRigHighlight();
    clearMagazineHighlight();
    clearAttachmentHighlight();
    draggedItem = null;
    isCtrlPressed = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('keydown', checkCtrlKey);
    document.removeEventListener('keyup', checkCtrlKey);
}

// 有効な位置かチェック
function isValidPosition(x, y, width, height, currentItem) {
    // 横15マス固定、縦は可変なので縦の上限チェックは行わない
    if (x < 0 || y < 0 || x + width > STASH_SIZE.width) {
        return false;
    }
    
    // 他のアイテムと重複していないかチェック
    for (const item of items) {
        if (item === currentItem) continue;
        if (item.equipped_slot) continue;
        if (item.parent_item_id) continue; // バックパック内のアイテムは除外
        if (item.grid_x === null || item.grid_y === null) continue;
        
        if (!(x + width <= item.grid_x || x >= item.grid_x + item.width ||
              y + height <= item.grid_y || y >= item.grid_y + item.height)) {
            return false;
        }
    }
    
    return true;
}

// ドロップゾーンのハイライト
function highlightDropZone(gridX, gridY, item) {
    clearHighlight();
    
    for (let y = gridY; y < gridY + item.height; y++) {
        for (let x = gridX; x < gridX + item.width; x++) {
            if (y >= 0 && y < STASH_SIZE.height && x >= 0 && x < STASH_SIZE.width) {
                stashGrid[y][x].classList.add('drag-over');
            }
        }
    }
}

// ハイライトをクリア
function clearHighlight() {
    stashGrid.forEach(row => {
        row.forEach(cell => {
            cell.classList.remove('drag-over');
        });
    });
}

// 装備スロットの上にマウスがあるかチェック
function getEquipmentSlotUnderMouse(x, y) {
    const slots = document.querySelectorAll('.equipment-slot');
    for (const slot of slots) {
        const rect = slot.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return slot;
        }
    }
    return null;
}

// アイテムを装備できるかチェック
function canEquipItem(item, slotType) {
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

// アタッチメントスロットを取得
function getAttachmentSlotUnderMouse(x, y) {
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
function highlightAttachmentSlot(slot, item) {
    if (!slot || !item) return;
    
    // マガジンをマガジンスロットにドラッグしている場合
    if (item.item_type === 'magazine' && slot.dataset.attachmentType === 'magazine') {
        // モーダルが開いているか確認
        const modal = document.getElementById('itemDetailModal');
        if (modal && !modal.classList.contains('hidden')) {
            // 武器を取得（モーダルに表示されている武器）
            const weaponTitle = document.getElementById('detailTitle');
            if (weaponTitle) {
                const weaponItem = items.find(i => i.item_name === weaponTitle.textContent && i.item_type === 'weapon');
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
function clearAttachmentHighlight() {
    const slots = document.querySelectorAll('.attachment-slot');
    slots.forEach(slot => {
        slot.style.border = '';
    });
}

// 装備スロットをハイライト
function highlightEquipmentSlot(slot, item) {
    clearEquipmentHighlight();
    if (canEquipItem(item, slot.dataset.slot)) {
        slot.classList.add('drag-over');
    } else {
        slot.classList.add('drag-invalid');
    }
}

// 装備スロットのハイライトをクリア
function clearEquipmentHighlight() {
    document.querySelectorAll('.equipment-slot').forEach(slot => {
        slot.classList.remove('drag-over');
        slot.classList.remove('drag-invalid');
    });
}

// 空きスペースを探す
function findEmptySpace(width, height) {
    // 縦は可変なので、現在のグリッド行数まで探索
    const maxY = stashGrid ? stashGrid.length : STASH_SIZE.height;
    for (let y = 0; y <= maxY - height; y++) {
        for (let x = 0; x <= STASH_SIZE.width - width; x++) {
            if (isValidPosition(x, y, width, height, null)) {
                return { x, y };
            }
        }
    }
    // 見つからない場合は、さらに下の行を探索（必要に応じて行を追加）
    const startY = Math.max(0, maxY - height);
    for (let y = startY; y < startY + 50; y++) { // 最大50行追加を試行
        // 必要な行数を確保
        if (y + height > stashGrid.length) {
            ensureStashRows(y + height);
        }
        for (let x = 0; x <= STASH_SIZE.width - width; x++) {
            if (isValidPosition(x, y, width, height, null)) {
                return { x, y };
            }
        }
    }
    return null;
}

// ツールチップ表示
function showTooltip(e, item) {
    itemTooltip.classList.remove('hidden');
    const ammoData = getAmmoData(item);
    const magazineData = getMagazineData(item);
    const medicalData = getMedicalData(item);
    
    // ツールチップには正式名称を表示
    let tooltipName = item.item_name;
    if (ammoData && ammoData.fullName) {
        tooltipName = ammoData.fullName;
    }
    
    let extraInfo = '';
    if (magazineData) {
        const current = item.quantity || 0;
        const capacity = magazineData.capacity ?? '?';
        extraInfo = `
            <div class="tooltip-stats">現在の装填数: ${current}</div>
            <div class="tooltip-stats">最大装填数: ${capacity}</div>
        `;
    } else if (ammoData) {
        extraInfo = `
            <div class="tooltip-stats">ダメージ: ${ammoData.damage ?? '-'}</div>
            <div class="tooltip-stats">貫通力: ${ammoData.penetration ?? '-'}</div>
            <div class="tooltip-stats">弾速: ${ammoData.velocity ? ammoData.velocity + ' m/s' : '-'}</div>
            <div class="tooltip-stats">特殊効果: ${ammoData.special || 'なし'}</div>
        `;
    } else if (medicalData) {
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
        
        extraInfo = `
            <div class="tooltip-stats">耐久値: ${currentDurability}/${maxDurability}</div>
            <div class="tooltip-stats">使用時間: ${medicalData.useTime || '-'}秒</div>
            ${effects.length > 0 ? `<div class="tooltip-stats">効果: ${effects.join(', ')}</div>` : ''}
        `;
    } else if (item.quantity > 1) {
        extraInfo = `<div class="tooltip-stats">数量: ${item.quantity}</div>`;
    }
    itemTooltip.innerHTML = `
        <div class="tooltip-name">${tooltipName}</div>
        <div class="tooltip-type">${item.item_type}</div>
        ${extraInfo}
    `;
    
    lastMousePosition = { clientX: e.clientX, clientY: e.clientY };
    currentTooltipContainer = getTooltipContainer(e.target);
    positionTooltip(lastMousePosition);
    itemTooltip.dataset.followCursor = 'true';
}

function moveTooltip(e) {
    if (!itemTooltip || itemTooltip.classList.contains('hidden')) return;
    if (itemTooltip.dataset.followCursor !== 'true') return;
    lastMousePosition = { clientX: e.clientX, clientY: e.clientY };
    currentTooltipContainer = getTooltipContainer(e.target);
    positionTooltip(lastMousePosition);
}

// ツールチップ非表示
function hideTooltip() {
    itemTooltip.classList.add('hidden');
    delete itemTooltip.dataset.followCursor;
    lastMousePosition = null;
    currentTooltipContainer = null;
}

function positionTooltip(e) {
    if (!itemTooltip) return;
    const clientX = e?.clientX ?? (lastMousePosition ? lastMousePosition.clientX : 0);
    const clientY = e?.clientY ?? (lastMousePosition ? lastMousePosition.clientY : 0);
    
    // ツールチップをfixed位置で表示するため、画面座標で直接配置
    // まず、ツールチップを表示してサイズを取得
    itemTooltip.style.position = 'fixed';
    itemTooltip.style.left = '0px';
    itemTooltip.style.top = '0px';
    
    const tooltipRect = itemTooltip.getBoundingClientRect();
    const tooltipWidth = tooltipRect.width || 200;
    const tooltipHeight = tooltipRect.height || 100;
    
    // マウスカーソルの位置からオフセットを計算
    let x = clientX + 10;
    let y = clientY + 10;
    
    // 右端からはみ出さないように調整
    if (x + tooltipWidth > window.innerWidth) {
        x = Math.max(0, clientX - tooltipWidth - 10);
    }
    // 下端からはみ出さないように調整
    if (y + tooltipHeight > window.innerHeight) {
        y = Math.max(0, clientY - tooltipHeight - 10);
    }
    
    itemTooltip.style.left = `${x}px`;
    itemTooltip.style.top = `${y}px`;
}

function getTooltipContainer(target) {
    // ツールチップは常にrightPanel内にあるため、常にrightPanelを返す
    // これにより、どのコンテナ内のアイテムでもマウスカーソルの位置に正確に表示される
    return rightPanel || document.body;
}

// アイテムの保存
async function saveItems() {
    try {
        // アイテムデータを準備（parent_item_idを含む）
        // リグやバックパックを外した際に、中身のアイテムも保存する
        const itemsToSave = items.map(item => ({
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
            ammo_stack: item.ammo_stack ? (Array.isArray(item.ammo_stack) ? JSON.stringify(item.ammo_stack) : item.ammo_stack) : null,
            rig_slot_x: item.rig_slot_x !== undefined ? item.rig_slot_x : null,
            rig_slot_y: item.rig_slot_y !== undefined ? item.rig_slot_y : null,
            weapon_durability: item.weapon_durability !== undefined ? item.weapon_durability : null,
            armor_durability: item.armor_durability !== undefined ? item.armor_durability : null,
            helmet_durability: item.helmet_durability !== undefined ? item.helmet_durability : null
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
            // 保存後にアイテムを再読み込みして、parent_item_idが正しく更新されたか確認
            await loadItems();
        }
    } catch (error) {
        console.error('アイテムの保存に失敗しました:', error);
    }
}

// スタッシュ容量の更新
function updateStashCapacity() {
    let used = 0;
    items.forEach(item => {
        if (!item.equipped_slot && !item.parent_item_id && item.grid_x !== null && item.grid_y !== null) {
            used += item.width * item.height;
        }
    });
    
    // 横15マス固定、縦は可変なので使用量のみ表示
    stashCapacity.textContent = `${used}`;
}

// バックパック容量の更新
function updateBackpackCapacity() {
    if (!equippedBackpack) return;
    
    let used = 0;
    items.forEach(item => {
        if (item.parent_item_id === equippedBackpack.id) {
            used += item.width * item.height;
        }
    });
    
    backpackCapacity.textContent = `${used} / ${currentBackpackSize.width * currentBackpackSize.height}`;
}

// リグ容量の更新
function updateRigCapacity() {
    if (!equippedRig) return;
    
    let used = 0;
    items.forEach(item => {
        if (item.parent_item_id === equippedRig.id) {
            used += item.width * item.height;
        }
    });
    
    if (rigUsesSlots) {
        let total = 0;
        const rigData = getRigData(equippedRig);
        if (rigData && rigData.slots) {
            rigData.slots.forEach(slot => {
                const size = RIG_SLOT_SIZES[slot.type];
                if (size) {
                    total += slot.count * size.width * size.height;
                }
            });
        }
        if (total === 0) total = DEFAULT_RIG_SIZE.width * DEFAULT_RIG_SIZE.height;
        rigCapacity.textContent = `${used} / ${total}`;
    } else {
        rigCapacity.textContent = `${used} / ${currentRigGridSize.width * currentRigGridSize.height}`;
    }
}

// バックパック内の有効な位置かチェック
function isValidBackpackPosition(x, y, width, height, currentItem) {
    if (x < 0 || y < 0 || x + width > currentBackpackSize.width || y + height > currentBackpackSize.height) {
        return false;
    }
    
    // 他のアイテムと重複していないかチェック
    for (const item of items) {
        if (item === currentItem) continue;
        if (item.parent_item_id !== equippedBackpack.id) continue;
        if (item.grid_x === null || item.grid_y === null) continue;
        
        if (!(x + width <= item.grid_x || x >= item.grid_x + item.width ||
              y + height <= item.grid_y || y >= item.grid_y + item.height)) {
            return false;
        }
    }
    
    return true;
}

// リグ内の有効な位置かチェック
function isValidRigPosition(x, y, width, height, currentItem) {
    if (rigUsesSlots) return false;
    if (x < 0 || y < 0 || x + width > currentRigGridSize.width || y + height > currentRigGridSize.height) {
        return false;
    }
    
    // 他のアイテムと重複していないかチェック
    for (const item of items) {
        if (item === currentItem) continue;
        if (item.parent_item_id !== equippedRig.id) continue;
        if (item.grid_x === null || item.grid_y === null) continue;
        
        if (!(x + width <= item.grid_x || x >= item.grid_x + item.width ||
              y + height <= item.grid_y || y >= item.grid_y + item.height)) {
            return false;
        }
    }
    
    return true;
}

// バックパック内のドロップゾーンのハイライト
function highlightBackpackDropZone(gridX, gridY, item) {
    clearBackpackHighlight();
    
    for (let y = gridY; y < gridY + item.height; y++) {
        for (let x = gridX; x < gridX + item.width; x++) {
            if (y >= 0 && y < currentBackpackSize.height && x >= 0 && x < currentBackpackSize.width) {
                backpackGrid[y][x].classList.add('drag-over');
            }
        }
    }
}

// バックパックのハイライトをクリア
function clearBackpackHighlight() {
    if (backpackGrid) {
        backpackGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('drag-over');
            });
        });
    }
}

// リグ内のドロップゾーンのハイライト
function highlightRigDropZone(gridX, gridY, item) {
    if (rigUsesSlots) return;
    clearRigHighlight();
    
    for (let y = gridY; y < gridY + item.height; y++) {
        for (let x = gridX; x < gridX + item.width; x++) {
            if (y >= 0 && y < currentRigGridSize.height && x >= 0 && x < currentRigGridSize.width) {
                rigGrid[y][x].classList.add('drag-over');
            }
        }
    }
}

// リグのハイライトをクリア
function clearRigHighlight() {
    if (rigGrid) {
        rigGrid.forEach(row => {
            row.forEach(cell => {
                cell.classList.remove('drag-over');
            });
        });
    }
    if (rigSlots && rigSlots.length > 0) {
        rigSlots.forEach(slot => {
            slot.element.classList.remove('rig-slot-highlight-valid');
            slot.element.classList.remove('rig-slot-highlight-invalid');
        });
    }
}

// ユーザー情報の読み込み
function loadUserInfo() {
    fetch('/api/user')
        .then(response => response.json())
        .then(data => {
            if (data.username) {
                characterName.textContent = data.username;
            }
        })
        .catch(() => {
            characterName.textContent = 'ゲスト';
        });
}

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

// イベントリスナーの設定
function setupEventListeners() {
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = '/home';
        });
    }
    
    if (contextDetailButton) {
        contextDetailButton.addEventListener('click', () => {
            if (contextMenuItem) {
                if (contextMenuItem.item_type === 'ammo') {
                showAmmoDetails(contextMenuItem);
                } else if (contextMenuItem.item_type === 'weapon') {
                    showWeaponDetails(contextMenuItem);
                } else if (contextMenuItem.item_type === 'medical') {
                    showMedicalDetails(contextMenuItem);
                }
            }
            hideContextMenu();
        });
    }
    
    if (contextUnloadAmmoButton) {
        contextUnloadAmmoButton.addEventListener('click', () => {
            if (contextMenuItem && contextMenuItem.item_type === 'magazine') {
                unloadAmmoFromMagazine(contextMenuItem);
            }
            hideContextMenu();
        });
    }
    
    if (contextUnloadMagazineButton) {
        contextUnloadMagazineButton.addEventListener('click', () => {
            if (contextMenuItem && contextMenuItem.item_type === 'weapon') {
                unloadMagazineFromWeapon(contextMenuItem);
            }
            hideContextMenu();
        });
    }
    
    if (contextCheckMagazineCompositionButton) {
        contextCheckMagazineCompositionButton.addEventListener('click', () => {
            if (contextMenuItem && contextMenuItem.item_type === 'magazine') {
                showMagazineComposition(contextMenuItem);
            }
            hideContextMenu();
        });
    }
    
    if (contextSplitButton) {
        contextSplitButton.addEventListener('click', () => {
            if (contextMenuItem) {
                splitItemStackViaPrompt(contextMenuItem);
            }
            hideContextMenu();
        });
    }
    
    if (magazineCompositionCloseButton) {
        magazineCompositionCloseButton.addEventListener('click', () => {
            if (magazineCompositionModal) {
                magazineCompositionModal.classList.add('hidden');
            }
        });
    }
    
    // モーダルの外側をクリックで閉じる
    if (magazineCompositionModal) {
        magazineCompositionModal.addEventListener('click', (e) => {
            if (e.target === magazineCompositionModal) {
                magazineCompositionModal.classList.add('hidden');
            }
        });
    }
    
    if (detailCloseButton) {
        detailCloseButton.addEventListener('click', () => {
            hideDetailModal();
        });
    }
    
    if (itemDetailModal) {
        itemDetailModal.addEventListener('click', (event) => {
            if (event.target === itemDetailModal) {
                hideDetailModal();
            }
        });
    }
    
    document.addEventListener('click', (event) => {
        if (!itemContextMenu || itemContextMenu.classList.contains('hidden')) return;
        if (!itemContextMenu.contains(event.target)) {
            hideContextMenu();
        }
    });
    
    // 右クリックのコンテキストメニューを完全に無効化（サイト全体）
    // ただし、アイテムの場合はスキップ（アイテムのコンテキストメニューを表示するため）
    document.addEventListener('contextmenu', (e) => {
        // アイテム（.itemクラス）の場合はスキップ
        const target = e.target;
        if (target && target.closest('.item')) {
            return; // アイテムのコンテキストメニューを許可
        }
        e.preventDefault();
        e.stopPropagation();
    }, true); // capture phaseで処理して確実に無効化
    
    document.addEventListener('contextmenu', (event) => {
        if (!event.target.closest('.item')) {
            hideContextMenu();
        }
    });
    
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideContextMenu();
            hideDetailModal();
            if (magazineCompositionModal && !magazineCompositionModal.classList.contains('hidden')) {
                magazineCompositionModal.classList.add('hidden');
            }
        }
    });
    
    document.addEventListener('scroll', hideContextMenu, true);
    window.addEventListener('resize', hideContextMenu);
    document.addEventListener('mousemove', moveTooltip);
    
    // 装備スロットのドラッグオーバーイベント（視覚的フィードバック用）
    document.querySelectorAll('.equipment-slot').forEach(slot => {
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
    });
}

// エネルギー・水分の回復処理（キャラクター画面）
function updateEnergyHydrationOnCharacter() {
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

// ページ読み込み時の初期化
window.addEventListener('DOMContentLoaded', () => {
    init();
    updateEnergyHydrationOnCharacter();
    addRippleToButtons();
    
    // 定期的にエネルギー・水分を回復（1分ごと）
    setInterval(updateEnergyHydrationOnCharacter, 60000);
});



