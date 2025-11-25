from collections import defaultdict


DEFAULT_STARTING_CURRENCY = 500_000
SELL_PRICE_RATE = 0.6

BASE_PRICE_BY_TYPE = {
    'medical': 15000,
    'weapon': 95000,
    'backpack': 32000,
    'rig': 30000,
    'magazine': 13000,
    'ammo': 8000,
    'flare': 42000,
    'armor': 45000,
    'helmet': 40000,
    'ticket': 60000,
    'other': 25000
}

TRADER_PROFILES = [
    {
        'id': 'therapist',
        'name': 'セラピスト',
        'icon': '🩺',
        'description': '医療品・救急用品を専門に扱うトレーダー。',
        'categories': ['medical', 'ticket'],
        'markup': 1.0
    },
    {
        'id': 'skier',
        'name': 'スキアー',
        'icon': '🔫',
        'description': '武器・マガジン中心の闇取引業者。',
        'categories': ['weapon', 'magazine'],
        'markup': 1.08
    },
    {
        'id': 'ragman',
        'name': 'ラグマン',
        'icon': '🎒',
        'description': 'バックパックやリグを扱う服飾ディーラー。',
        'categories': ['backpack', 'rig', 'armor', 'helmet'],
        'markup': 0.98
    },
    {
        'id': 'jaeger',
        'name': 'イェーガー',
        'icon': '🎯',
        'description': '弾薬やフレアを扱う狩猟の達人。',
        'categories': ['ammo', 'flare'],
        'markup': 1.12
    }
]

HIDEOUT_FACILITIES = [
    {'id': 'shooting_range', 'name': '射撃場'},
    {'id': 'workbench', 'name': 'ワークベンチ'},
    {'id': 'medical_station', 'name': '医療ステーション'},
    {'id': 'generator', 'name': '発電機'},
    {'id': 'kitchen', 'name': 'キッチン'},
    {'id': 'water_collector', 'name': '集水器'},
    {'id': 'bitcoin_farm', 'name': 'ビットコインファーマー'},
    {'id': 'random_box', 'name': 'ランダムボックス'}
]

HIDEOUT_TICKET_TIERS = {
    1: {
        'stars': '☆',
        'image': '/pic/ticket/tier1.png',
        'required_trader_level': 2,
        'rarity_label': 'Uncommon'
    },
    2: {
        'stars': '☆☆',
        'image': '/pic/ticket/tier2.png',
        'required_trader_level': 4,
        'rarity_label': 'Epic'
    },
    3: {
        'stars': '☆☆☆',
        'image': '/pic/ticket/tier3.png',
        'required_trader_level': 5,
        'rarity_label': 'Legendary'
    }
}


def _build_ticket_name(facility_label: str, stars: str) -> str:
    return f"{facility_label}のレベルアップ券({stars}）"


HIDEOUT_TICKET_ITEMS = []
HIDEOUT_TICKET_META = {}
HIDEOUT_LEVEL_REQUIREMENTS = {}
for facility in HIDEOUT_FACILITIES:
    requirements = {}
    for tier, tier_info in HIDEOUT_TICKET_TIERS.items():
        ticket_name = _build_ticket_name(facility['name'], tier_info['stars'])
        requirements[tier] = ticket_name
        meta = {
            'facility_id': facility['id'],
            'facility_name': facility['name'],
            'ticket_tier': tier,
            'image_path': tier_info['image'],
            'required_trader_level': tier_info['required_trader_level'],
            'rarity_label_override': tier_info.get('rarity_label')
        }
        HIDEOUT_TICKET_ITEMS.append({'name': ticket_name, **meta})
        HIDEOUT_TICKET_META[ticket_name] = meta
    HIDEOUT_LEVEL_REQUIREMENTS[facility['id']] = requirements

HIDEOUT_TICKET_ORDER = [ticket['name'] for ticket in HIDEOUT_TICKET_ITEMS]

MEDICAL_RARITY_ORDER = [
    'Grizzly medical kit',
    'Surv12 field surgical kit',
    'CMS surgical kit (CMS)',
    'Ibuprofen painkillers',
    'Salewa first aid kit (Salewa)',
    'Golden star balm',
    'Vaseline balm',
    'Water',
    'MRE',
    'AFAK tactical individual first aid kit',
    'IFAK individual first aid kit',
    'Car first aid kit',
    'Augmentin antibiotic pills',
    'CALOK-B hemostatic applicator',
    'Aluminum splint',
    'CAT hemostatic tourniquet',
    'Army bandage',
    'Esmarch tourniquet (Esmarch)',
    'Immobilizing splint (Splint)',
    'AI-2 medkit (AI-2)',
    'Analgin painkillers (Analgin)',
    'Aseptic bandage (Bandage)'
]

WEAPON_RARITY_ORDER = [
    'RShG-2 72.5mm rocket launcher',
    'Radian Weapons Model 1 FA 5.56x45 assault rifle',
    'Steyr AUG A1 5.56x45 assault rifle',
    'M16A2',
    'FN SCAR-H 7.62x51 assault rifle LB',
    'Custom Guns NL545',
    'SIG MCX SPEAR 6.8x51 assault rifle',
    'Desert Tech MDR 5.56x45 assault rifle',
    'Desert Tech MDR 7.62x51 assault rifle',
    'FN SCAR-L 5.56x45 assault rifle LB',
    'HK G36 5.56x45 assault rifle',
    'Kalashnikov AK-101 5.56x45 assault rifle',
    'HK 416A5 5.56x45 assault rifle',
    'Rifle Dynamics RD-704 7.62x39 assault rifle',
    'Aklys Defense Velociraptor .300 Blackout assault rifle',
    'Kalashnikov AKM 7.62x39 assault rifle',
    'CMMG Mk47 Mutant 7.62x39 assault rifle',
    'SIG MCX .300 Blackout assault rifle',
    'DS Arms SA-58 7.62x51 assault rifle',
    'Ash-12',
    'AS VAL',
    'M4A1',
    'AK-74M',
    'Benelli M3 Super 90 dual-mode 12ga shotgun',
    'MP-133 12ga pump-action shotgun',
    'MP-153 12ga semi-automatic shotgun',
    'MP-43 12ga sawed-off double-barrel shotgun',
    'MP-43-1C 12ga double-barrel shotgun',
    'MTs-255-12 12ga shotgun'
]

MAGAZINE_RARITY_ORDER = [
    '5.56x45mm over 100連マガジン',
    'Ash-12用 20連マガジン',
    'AS VAL用 30連マガジン',
    '7.61x51mm standard 30連マガジン',
    '7.62x39mm standard 30連マガジン',
    '6.8x51mm standard 30連マガジン',
    '.300 blackout standard 30連マガジン',
    'Ash-12用 10連マガジン',
    '5.56x45mm standard 30連マガジン',
    'AS VAL用15連マガジン',
    '5.45x39mm standard 30連マガジン',
    '7.61x51mm short 20連マガジン',
    '6.8x51mm short 15連マガジン',
    '7.62x39mm short 15連マガジン'
]

FLARE_RARITY_ORDER = [
    'Red Flare',
    'Yellow Flare',
    'Green Flare'
]

BASE_THERAPIST_SECTIONS = [
    ('体力回復', [
        'Grizzly medical kit',
        'Salewa first aid kit (Salewa)',
        'AFAK tactical individual first aid kit',
        'IFAK individual first aid kit',
        'Car first aid kit',
        'AI-2 medkit (AI-2)'
    ]),
    ('鎮痛', [
        'Analgin painkillers (Analgin)',
        'Ibuprofen painkillers',
        'Golden star balm',
        'Vaseline balm'
    ]),
    ('軽度出血治し', [
        'Aseptic bandage (Bandage)',
        'Army bandage'
    ]),
    ('重度出血治し', [
        'CAT hemostatic tourniquet',
        'CALOK-B hemostatic applicator',
        'Esmarch tourniquet (Esmarch)'
    ]),
    ('骨折治し', [
        'Immobilizing splint (Splint)',
        'Aluminum splint'
    ]),
    ('壊死治し', [
        'Surv12 field surgical kit',
        'CMS surgical kit (CMS)'
    ]),
    ('食料・飲料', [
        'Water',
        'MRE'
    ]),
    ('その他医療品', [
        'Augmentin antibiotic pills'
    ])
]

HIDEOUT_THERAPIST_SECTIONS = []
for facility in HIDEOUT_FACILITIES:
    requirements = HIDEOUT_LEVEL_REQUIREMENTS.get(facility['id'], {})
    ticket_names = [requirements.get(level) for level in (1, 2, 3) if requirements.get(level)]
    if not ticket_names:
        continue
    HIDEOUT_THERAPIST_SECTIONS.append((
        f"ハイドアウト: {facility['name']}",
        ticket_names
    ))

THERAPIST_SECTIONS = BASE_THERAPIST_SECTIONS + HIDEOUT_THERAPIST_SECTIONS

THERAPIST_SECTION_MAP = {}
for label, names in THERAPIST_SECTIONS:
    for name in names:
        THERAPIST_SECTION_MAP.setdefault(name, label)

SKIER_SECTION_ORDER = ['武器', 'マガジン']
RAGMAN_SECTION_ORDER = ['バックパック', 'リグ', 'ボディーアーマー', 'ヘルメット']
JAEGER_SECTION_ORDER = ['高性能弾薬', '通常弾薬', 'フレア']

BACKPACK_SIZE_DATA = {
    '6SH118': {'width': 6, 'height': 7, 'content': 45},
    'Paratus': {'width': 5, 'height': 7, 'content': 35},
    'pilgrim': {'width': 5, 'height': 7, 'content': 35},
    'Pilgrim': {'width': 5, 'height': 7, 'content': 35},
    'Beta2': {'width': 5, 'height': 5, 'content': 25},
    'T20': {'width': 5, 'height': 5, 'content': 25},
    'Daypack': {'width': 4, 'height': 5, 'content': 20},
    'Takedown': {'width': 3, 'height': 7, 'content': 21},
    'MBSS': {'width': 4, 'height': 4, 'content': 16},
    'ScavBP': {'width': 4, 'height': 5, 'content': 20},
    'VKBO': {'width': 3, 'height': 4, 'content': 12}
}

RIG_SIZE_DATA = {
    'Alpha': {'width': 4, 'height': 4, 'content': 16},
    'khamelion': {'width': 4, 'height': 3, 'content': 12},
    'Khamelion': {'width': 4, 'height': 3, 'content': 12},
    'Azimut': {'width': 4, 'height': 3, 'content': 12},
    'IDEA Rig': {'width': 3, 'height': 2, 'content': 8}
}

# ボディーアーマーデータ（防御力、耐久値、デバフ、スタッシュサイズ）
ARMOR_DATA = {
    'PACA Soft Armor': {
        'durability': 100,
        'armor_class': 20,
        'movement_speed_debuff': -0.01,
        'width': 3,
        'height': 3
    },
    'BNTI Module-3M body armor': {
        'durability': 80,
        'armor_class': 20,
        'movement_speed_debuff': -0.01,
        'width': 3,
        'height': 3
    },
    '6B23-1 body armor (Digital Flora)': {
        'durability': 206,
        'armor_class': 30,
        'movement_speed_debuff': -0.04,
        'width': 3,
        'height': 4
    },
    'NPP KlASS Kora-Kulon body armor (Black)': {
        'durability': 120,
        'armor_class': 30,
        'movement_speed_debuff': -0.03,
        'width': 3,
        'height': 3
    },
    'HighCom Trooper TFO body armor (MultiCam)': {
        'durability': 180,
        'armor_class': 40,
        'movement_speed_debuff': -0.03,
        'width': 3,
        'height': 3
    },
    '6B23-2 body armor (Mountain Flora)': {
        'durability': 246,
        'armor_class': 40,
        'movement_speed_debuff': -0.05,
        'width': 3,
        'height': 4
    },
    '6B2 body armor (Flora)': {
        'durability': 128,
        'armor_class': 20,
        'movement_speed_debuff': -0.03,
        'width': 3,
        'height': 3
    },
    'PACA Soft Armor (Rivals Edition)': {
        'durability': 100,
        'armor_class': 20,
        'movement_speed_debuff': -0.01,
        'width': 3,
        'height': 3
    },
    'IOTV Gen4 body armor (Full Protection Kit, MultiCam)': {
        'durability': 398,
        'armor_class': 50,
        'movement_speed_debuff': -0.12,
        'width': 4,
        'height': 4
    },
    'FORT Redut-M body armor': {
        'durability': 358,
        'armor_class': 50,
        'movement_speed_debuff': -0.06,
        'width': 3,
        'height': 4
    },
    'BNTI Zhuk body armor (Digital Flora)': {
        'durability': 305,
        'armor_class': 60,
        'movement_speed_debuff': -0.07,
        'width': 3,
        'height': 3
    },
    '5.11 Tactical Hexgrid plate carrier': {
        'durability': 100,
        'armor_class': 60,
        'movement_speed_debuff': -0.04,
        'width': 3,
        'height': 3
    }
}

# ヘルメットデータ（防御力、耐久値、デバフ、スタッシュサイズ）
HELMET_DATA = {
    'Tac-Kek FAST MT helmet (Replica)': {
        'durability': 48,
        'armor_class': 10,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'TSh-4M-L soft tank crew helmet': {
        'durability': 105,
        'armor_class': 10,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'PSh-97 DJETA riot helmet': {
        'durability': 156,
        'armor_class': 20,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'ShPM Firefighter helmet': {
        'durability': 96,
        'armor_class': 20,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    '6B47 Ratnik-BSh helmet (Digital Flora cover)': {
        'durability': 45,
        'armor_class': 30,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'SSh-68 steel helmet (Olive Drab)': {
        'durability': 54,
        'armor_class': 30,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'Ballistic Armor Co. Bastion helmet (OD Green)': {
        'durability': 50,
        'armor_class': 40,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'HighCom Striker ULACH IIIA helmet (Desert Tan)': {
        'durability': 66,
        'armor_class': 40,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'Altyn bulletproof helmet (Olive Drab)': {
        'durability': 81,
        'armor_class': 50,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    },
    'Vulkan-5 LShZ-5 bulletproof helmet (Black)': {
        'durability': 99,
        'armor_class': 50,
        'movement_speed_debuff': 0,
        'width': 2,
        'height': 2
    }
}

ITEM_SIZE_DATA = {
    # Armor
    'PACA Soft Armor': {'width': 3, 'height': 3},
    'BNTI Module-3M body armor': {'width': 3, 'height': 3},
    '6B23-1 body armor (Digital Flora)': {'width': 3, 'height': 4},
    'NPP KlASS Kora-Kulon body armor (Black)': {'width': 3, 'height': 3},
    'HighCom Trooper TFO body armor (MultiCam)': {'width': 3, 'height': 3},
    '6B23-2 body armor (Mountain Flora)': {'width': 3, 'height': 4},
    '6B2 body armor (Flora)': {'width': 3, 'height': 3},
    'PACA Soft Armor (Rivals Edition)': {'width': 3, 'height': 3},
    'IOTV Gen4 body armor (Full Protection Kit, MultiCam)': {'width': 4, 'height': 4},
    'FORT Redut-M body armor': {'width': 3, 'height': 4},
    'BNTI Zhuk body armor (Digital Flora)': {'width': 3, 'height': 3},
    '5.11 Tactical Hexgrid plate carrier': {'width': 3, 'height': 3},
    # Weapons
    'M4A1': {'width': 5, 'height': 2},
    'AK-74M': {'width': 5, 'height': 2},
    'Ash-12': {'width': 4, 'height': 2},
    'AS VAL': {'width': 5, 'height': 2},
    'M16A2': {'width': 6, 'height': 2},
    'Custom Guns NL545': {'width': 5, 'height': 2},
    'DS Arms SA-58 7.62x51 assault rifle': {'width': 5, 'height': 2},
    'Desert Tech MDR 5.56x45 assault rifle': {'width': 4, 'height': 2},
    'Desert Tech MDR 7.62x51 assault rifle': {'width': 4, 'height': 2},
    'FN SCAR-H 7.62x51 assault rifle LB': {'width': 6, 'height': 2},
    'FN SCAR-L 5.56x45 assault rifle LB': {'width': 6, 'height': 2},
    'HK 416A5 5.56x45 assault rifle': {'width': 5, 'height': 2},
    'HK G36 5.56x45 assault rifle': {'width': 6, 'height': 2},
    'Kalashnikov AK-101 5.56x45 assault rifle': {'width': 5, 'height': 2},
    'Kalashnikov AKM 7.62x39 assault rifle': {'width': 5, 'height': 2},
    'SIG MCX SPEAR 6.8x51 assault rifle': {'width': 6, 'height': 2},
    'Steyr AUG A1 5.56x45 assault rifle': {'width': 5, 'height': 2},
    'Aklys Defense Velociraptor .300 Blackout assault rifle': {'width': 4, 'height': 2},
    'CMMG Mk47 Mutant 7.62x39 assault rifle': {'width': 4, 'height': 2},
    'SIG MCX .300 Blackout assault rifle': {'width': 4, 'height': 2},
    'Rifle Dynamics RD-704 7.62x39 assault rifle': {'width': 4, 'height': 2},
    'Radian Weapons Model 1 FA 5.56x45 assault rifle': {'width': 5, 'height': 2},
    'RShG-2 72.5mm rocket launcher': {'width': 4, 'height': 1},
    'Benelli M3 Super 90 dual-mode 12ga shotgun': {'width': 5, 'height': 2},
    'MP-133 12ga pump-action shotgun': {'width': 5, 'height': 1},
    'MP-153 12ga semi-automatic shotgun': {'width': 7, 'height': 1},
    'MP-43 12ga sawed-off double-barrel shotgun': {'width': 3, 'height': 1},
    'MP-43-1C 12ga double-barrel shotgun': {'width': 6, 'height': 1},
    'MTs-255-12 12ga shotgun': {'width': 6, 'height': 1},
    # Magazines
    '5.56x45mm standard 30連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    '5.45x39mm standard 30連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    'Ash-12用 10連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    'Ash-12用 20連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    'AS VAL用15連マガジン': {'width': 1, 'height': 1, 'default_quantity': 0},
    'AS VAL用 30連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    '5.56x45mm over 100連マガジン': {'width': 2, 'height': 2, 'default_quantity': 0},
    '7.61x51mm standard 30連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    '7.61x51mm short 20連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    '7.62x39mm standard 30連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    '7.62x39mm short 15連マガジン': {'width': 1, 'height': 1, 'default_quantity': 0},
    '6.8x51mm standard 30連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    '6.8x51mm short 15連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    '.300 blackout standard 30連マガジン': {'width': 1, 'height': 2, 'default_quantity': 0},
    # Medical items
    'AI-2 medkit (AI-2)': {'width': 1, 'height': 1, 'default_quantity': 100},
    'Salewa first aid kit (Salewa)': {'width': 1, 'height': 2, 'default_quantity': 400},
    'Aseptic bandage (Bandage)': {'width': 1, 'height': 1, 'default_quantity': 1},
    'Esmarch tourniquet (Esmarch)': {'width': 1, 'height': 1, 'default_quantity': 1},
    'Immobilizing splint (Splint)': {'width': 1, 'height': 1, 'default_quantity': 1},
    'Analgin painkillers (Analgin)': {'width': 1, 'height': 1, 'default_quantity': 4},
    'Aluminum splint': {'width': 1, 'height': 1, 'default_quantity': 5},
    'Army bandage': {'width': 1, 'height': 1, 'default_quantity': 2},
    'CALOK-B hemostatic applicator': {'width': 1, 'height': 1, 'default_quantity': 3},
    'CAT hemostatic tourniquet': {'width': 1, 'height': 1, 'default_quantity': 1},
    'Golden star balm': {'width': 1, 'height': 1, 'default_quantity': 10},
    'Vaseline balm': {'width': 1, 'height': 1, 'default_quantity': 6},
    'Augmentin antibiotic pills': {'width': 1, 'height': 1, 'default_quantity': 1},
    'Ibuprofen painkillers': {'width': 1, 'height': 1, 'default_quantity': 15},
    'AFAK tactical individual first aid kit': {'width': 1, 'height': 1, 'default_quantity': 400},
    'IFAK individual first aid kit': {'width': 1, 'height': 1, 'default_quantity': 300},
    'Car first aid kit': {'width': 2, 'height': 1, 'default_quantity': 220},
    'Grizzly medical kit': {'width': 2, 'height': 2, 'default_quantity': 1800},
    'CMS surgical kit (CMS)': {'width': 2, 'height': 1, 'default_quantity': 3},
    'Surv12 field surgical kit': {'width': 3, 'height': 1, 'default_quantity': 15},
    'Water': {'width': 1, 'height': 2, 'default_quantity': 1},
    'MRE': {'width': 1, 'height': 2, 'default_quantity': 1},
    # Flares
    'Red Flare': {'width': 1, 'height': 2, 'default_quantity': 1},
    'Green Flare': {'width': 1, 'height': 2, 'default_quantity': 1},
    'Yellow Flare': {'width': 1, 'height': 2, 'default_quantity': 1},
    # Ammo
    '12x70mm 8.5mm Magnum Buckshot': {'width': 1, 'height': 1, 'default_quantity': 20},
    # Other items (for hideout upgrades and tasks)
    'spark plug': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 4},
    'syringe': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 5},
    'fabric': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'LEDX': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 6},
    'Power Unit': {'width': 2, 'height': 2, 'default_quantity': 1, 'rarity_level': 2},
    'CPU fan': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'cord': {'width': 2, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'VPX': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 4},
    'T-Plug': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'PCB': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'Relay': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'Pfilter': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 4},
    'Mortor': {'width': 2, 'height': 2, 'default_quantity': 1, 'rarity_level': 4},
    'Tang battery': {'width': 4, 'height': 2, 'default_quantity': 1, 'rarity_level': 5},
    'Tube': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'Buldex': {'width': 1, 'height': 2, 'default_quantity': 1, 'rarity_level': 4},
    'wier': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'M.parts': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'salt': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 5},
    'wrench': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'Hose': {'width': 2, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'alkali': {'width': 1, 'height': 2, 'default_quantity': 1, 'rarity_level': 5},
    'Meds': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'cleaner': {'width': 1, 'height': 2, 'default_quantity': 1, 'rarity_level': 4},
    'Majaica': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'sadium': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'Roostar': {'width': 2, 'height': 2, 'default_quantity': 1, 'rarity_level': 5},
    'Roler': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 5},
    'gold chain': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 5},
    'skull': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 4},
    'Lion': {'width': 3, 'height': 2, 'default_quantity': 1, 'rarity_level': 5},
    'Bolt': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'Nuts': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'MTape': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'poxeram': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'T set': {'width': 2, 'height': 2, 'default_quantity': 1, 'rarity_level': 4},
    'screw': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'E dril': {'width': 2, 'height': 2, 'default_quantity': 1, 'rarity_level': 5},
    'ES lamp': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'Master': {'width': 2, 'height': 2, 'default_quantity': 1, 'rarity_level': 3},
    'caps': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'manual': {'width': 1, 'height': 2, 'default_quantity': 1, 'rarity_level': 2},
    'WD-40': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'Nails': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'Hand drill': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 5},
    'Shus': {'width': 1, 'height': 2, 'default_quantity': 1, 'rarity_level': 2},
    'Duct tape': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'KEK': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 4},
    'Ellte': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 3},
    'weapon parts': {'width': 2, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'Thermite': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'vitamin': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'NaCl': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 1},
    'Bloodset': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'Med tool': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2},
    'Oscope': {'width': 1, 'height': 1, 'default_quantity': 1, 'rarity_level': 2}
}

for ticket in HIDEOUT_TICKET_ITEMS:
    ITEM_SIZE_DATA[ticket['name']] = {
        'width': 2,
        'height': 1,
        'default_quantity': 1,
        'image_path': ticket['image_path']
    }

AMMO_RARITY_ORDER = [
    '7.62x51mm M993',
    '7.62x51mm M80A1',
    '7.62x39mm MAI AP',
    '7.62x51mm M61',
    '.300 blackout AP',
    '7.62x39mm BP gzh',
    '6.8x51mm SIG Hybrid',
    '5.56x45mm SSA AP',
    '5.56x45mm M995 (M995)',
    '5.45x39mm PPBS gs Igolnik',
    '5.45x39mm 7N40',
    '5.45x39mm BS',
    '9x39mm SP-6 gs',
    '9x39mm BP gs',
    '12.7x55mm PS12B',
    '12.7x55mm PS12A',
    '7.62x51mm M62 Tracer',
    '7.62x51mm M80',
    '7.62x39mm PP gzh',
    '.300 blackout CBJ',
    '6.8x51mm SIG FMJ',
    '9x39mm SPP gs',
    '9x39mm SP-5 gs',
    '5.56x45mm Warmageddon',
    '5.56x45mm HP',
    '5.45x39mm HP',
    '5.45x39mm PRS gs',
    '7.62x39mm PS gzh',
    '7.62x39mm T-45M1 gzh',
    '5.45x39mm SP',
    '5.45x39mm US gs',
    '9x39mm PAB-9 gs',
    '7.62x51mm BCP FMJ',
    '7.62x39mm FMJ',
    '.300 blackout BCP FMJ',
    '9x39mm FMJ',
    '5.56x45mm M855A1 (M855A1)',
    '5.56x45mm M856A1 (856AI)',
    '5.45x39mm BP',
    '5.56x45mm Mk318 Mod 0 (SOFT)',
    '5.56x45mm Mk255 Mod 0 (RRLP)',
    '5.56x45mm M855 (M855)',
    '5.56x45mm M856 (M856)',
    '5.45x39mm BT',
    '5.45x39mm PS gs',
    '5.45x39mm PP',
    '5.45x39mm FMJ',
    '5.45x39mm T gs',
    '5.56x45mm FMJ',
    '7.62x39mm HP',
    '7.62x39mm SP',
    '7.62x39mm US gzh',
    '7.62x51mm TCW SP',
    '7.62x51mm Ultra Noiser',
    '.300 blackout M62 Tracer',
    '.300 blackout V-Max',
    '.300 blackout Whisper',
    '12.7x55mm PS12',
    '12x70mm 8.5mm Magnum Buckshot'
]

AMMO_STACK_SIZES = {name: 60 for name in AMMO_RARITY_ORDER}
AMMO_STACK_SIZES['12.7x55mm PS12B'] = 40
AMMO_STACK_SIZES['12.7x55mm PS12A'] = 40
AMMO_STACK_SIZES['12.7x55mm PS12'] = 40
AMMO_STACK_SIZES['12x70mm 8.5mm Magnum Buckshot'] = 20

MEDICAL_STATS = {
    'AI-2 medkit (AI-2)': {'durability': 100, 'effects': ['体力回復']},
    'Salewa first aid kit (Salewa)': {'durability': 400, 'effects': ['体力回復', '軽度出血治療', '重度出血治療']},
    'Aseptic bandage (Bandage)': {'durability': 1, 'effects': ['軽度出血治療']},
    'Esmarch tourniquet (Esmarch)': {'durability': 1, 'effects': ['重度出血治療']},
    'Immobilizing splint (Splint)': {'durability': 1, 'effects': ['骨折治療']},
    'Analgin painkillers (Analgin)': {'durability': 4, 'effects': ['鎮痛']},
    'Aluminum splint': {'durability': 5, 'effects': ['骨折治療']},
    'Army bandage': {'durability': 2, 'effects': ['軽度出血治療']},
    'CALOK-B hemostatic applicator': {'durability': 3, 'effects': ['重度出血治療']},
    'CAT hemostatic tourniquet': {'durability': 1, 'effects': ['重度出血治療']},
    'Golden star balm': {'durability': 10, 'effects': ['鎮痛']},
    'Vaseline balm': {'durability': 6, 'effects': ['鎮痛']},
    'Augmentin antibiotic pills': {'durability': 1, 'effects': ['鎮痛']},
    'Ibuprofen painkillers': {'durability': 15, 'effects': ['鎮痛']},
    'AFAK tactical individual first aid kit': {'durability': 400, 'effects': ['軽度出血治療', '重度出血治療']},
    'IFAK individual first aid kit': {'durability': 300, 'effects': ['軽度出血治療', '重度出血治療']},
    'Car first aid kit': {'durability': 220, 'effects': ['軽度出血治療']},
    'Grizzly medical kit': {'durability': 1800, 'effects': ['体力回復', '軽度出血治療', '重度出血治療', '骨折治療']},
    'CMS surgical kit (CMS)': {'durability': 3, 'effects': ['壊死治療']},
    'Surv12 field surgical kit': {'durability': 15, 'effects': ['壊死治療']},
    'Water': {'durability': 1, 'effects': ['水分 +60']},
    'MRE': {'durability': 1, 'effects': ['エネルギー +100', '水分 +20']}
}

AMMO_STATS = {
    '5.56x45mm FMJ': {'damage': 57, 'penetration': 23},
    '5.56x45mm HP': {'damage': 79, 'penetration': 7},
    '5.56x45mm M855 (M855)': {'damage': 54, 'penetration': 32},
    '5.56x45mm M855A1 (M855A1)': {'damage': 49, 'penetration': 44},
    '5.56x45mm M856 (M856)': {'damage': 60, 'penetration': 18},
    '5.56x45mm M856A1 (856AI)': {'damage': 52, 'penetration': 38},
    '5.56x45mm M995 (M995)': {'damage': 42, 'penetration': 53},
    '5.56x45mm Mk255 Mod 0 (RRLP)': {'damage': 72, 'penetration': 11},
    '5.56x45mm Mk318 Mod 0 (SOFT)': {'damage': 53, 'penetration': 33},
    '5.56x45mm SSA AP': {'damage': 38, 'penetration': 57},
    '5.56x45mm Warmageddon': {'damage': 88, 'penetration': 3},
    '5.45x39mm BP': {'damage': 48, 'penetration': 45},
    '5.45x39mm 7N40': {'damage': 55, 'penetration': 42},
    '5.45x39mm BS': {'damage': 45, 'penetration': 54},
    '5.45x39mm BT': {'damage': 54, 'penetration': 37},
    '5.45x39mm FMJ': {'damage': 55, 'penetration': 24},
    '5.45x39mm HP': {'damage': 76, 'penetration': 9},
    '5.45x39mm PP': {'damage': 51, 'penetration': 34},
    '5.45x39mm PPBS gs Igolnik': {'damage': 37, 'penetration': 62},
    '5.45x39mm PRS gs': {'damage': 70, 'penetration': 13},
    '5.45x39mm PS gs': {'damage': 56, 'penetration': 28},
    '5.45x39mm SP': {'damage': 67, 'penetration': 15},
    '5.45x39mm T gs': {'damage': 59, 'penetration': 20},
    '5.45x39mm US gs': {'damage': 65, 'penetration': 17},
    '9x39mm FMJ': {'damage': 75, 'penetration': 17},
    '9x39mm BP gs': {'damage': 58, 'penetration': 54},
    '9x39mm PAB-9 gs': {'damage': 62, 'penetration': 43},
    '9x39mm SP-5 gs': {'damage': 71, 'penetration': 28},
    '9x39mm SP-6 gs': {'damage': 60, 'penetration': 48},
    '9x39mm SPP gs': {'damage': 68, 'penetration': 35},
    '12.7x55mm PS12': {'damage': 115, 'penetration': 28},
    '12.7x55mm PS12A': {'damage': 165, 'penetration': 10},
    '12.7x55mm PS12B': {'damage': 102, 'penetration': 46},
    '7.62x51mm BCP FMJ': {'damage': 83, 'penetration': 37},
    '7.62x51mm M61': {'damage': 75, 'penetration': 55},
    '7.62x51mm M62 Tracer': {'damage': 82, 'penetration': 42},
    '7.62x51mm M80': {'damage': 80, 'penetration': 43},
    '7.62x51mm M80A1': {'damage': 73, 'penetration': 60},
    '7.62x51mm M993': {'damage': 70, 'penetration': 65},
    '7.62x51mm TCW SP': {'damage': 85, 'penetration': 30},
    '7.62x51mm Ultra Noiser': {'damage': 105, 'penetration': 15},
    '.300 blackout AP': {'damage': 51, 'penetration': 48},
    '.300 blackout BCP FMJ': {'damage': 60, 'penetration': 30},
    '.300 blackout CBJ': {'damage': 58, 'penetration': 43},
    '.300 blackout M62 Tracer': {'damage': 54, 'penetration': 36},
    '.300 blackout V-Max': {'damage': 72, 'penetration': 20},
    '.300 blackout Whisper': {'damage': 90, 'penetration': 14},
    '7.62x39mm BP gzh': {'damage': 58, 'penetration': 47},
    '7.62x39mm FMJ': {'damage': 63, 'penetration': 26},
    '7.62x39mm HP': {'damage': 80, 'penetration': 15},
    '7.62x39mm MAI AP': {'damage': 53, 'penetration': 58},
    '7.62x39mm PP gzh': {'damage': 59, 'penetration': 41},
    '7.62x39mm PS gzh': {'damage': 61, 'penetration': 35},
    '7.62x39mm SP': {'damage': 68, 'penetration': 20},
    '7.62x39mm T-45M1 gzh': {'damage': 65, 'penetration': 30},
    '7.62x39mm US gzh': {'damage': 56, 'penetration': 29},
    '6.8x51mm SIG FMJ': {'damage': 80, 'penetration': 36},
    '6.8x51mm SIG Hybrid': {'damage': 72, 'penetration': 47}
}

ITEM_ALIASES = {
    'Pilgrim': 'pilgrim',
    'Khamelion': 'khamelion'
}

CATEGORY_ORDER = ['medical', 'weapon', 'backpack', 'rig', 'armor', 'helmet', 'magazine', 'ammo', 'flare', 'ticket', 'other']

# レア度マッピング（1-6の数値からラベルへ）
RARITY_LEVEL_MAP = {
    1: 'Common',
    2: 'Uncommon',
    3: 'Rare',
    4: 'Epic',
    5: 'Legendary',
    6: 'Mythic'
}


def _rarity_label(rank: int, total: int) -> str:
    if total <= 1:
        return 'Common'
    percentile = (rank - 1) / (total - 1)
    if percentile <= 0.15:
        return 'Legendary'
    if percentile <= 0.35:
        return 'Epic'
    if percentile <= 0.6:
        return 'Rare'
    if percentile <= 0.8:
        return 'Uncommon'
    return 'Common'


def _register_item(definitions, category_map, name, item_type, width, height,
                   stack_size, default_quantity, rarity_rank, rarity_total, extra_meta=None):
    entry = definitions.setdefault(name, {})
    entry.update({
        'name': name,
        'type': item_type,
        'width': width or 1,
        'height': height or 1,
        'stack_size': stack_size or 1,
        'default_quantity': default_quantity if default_quantity is not None else stack_size or 1,
        'rarity_rank': rarity_rank,
        'rarity_total': rarity_total
    })
    if extra_meta:
        entry.update(extra_meta)
    category_map[item_type].add(name)


def build_item_stats(name, definition):
    if not definition:
        return None
    item_type = definition['type']
    if item_type == 'medical':
        stats = MEDICAL_STATS.get(name)
        if stats:
            return {'type': 'medical', 'name': name, **stats}
        durability = definition.get('default_quantity', definition.get('stack_size', 1))
        label = THERAPIST_SECTION_MAP.get(name)
        effects = [label] if label else []
        if durability or effects:
            return {'type': 'medical', 'name': name, 'durability': durability, 'effects': effects}
        return None
    if item_type == 'ammo':
        stats = AMMO_STATS.get(name)
        if stats:
            return {'type': 'ammo', 'name': name, **stats}
    if item_type == 'weapon':
        # 武器の場合は名前のみ返す（詳細はフロントエンドで取得）
        return {'type': 'weapon', 'name': name}
    if item_type == 'magazine':
        # マガジンの場合は名前のみ返す（詳細はフロントエンドで取得）
        return {'type': 'magazine', 'name': name}
    if item_type == 'armor':
        stats = ARMOR_DATA.get(name)
        if stats:
            return {
                'type': 'armor',
                'name': name,
                'durability': stats['durability'],
                'armor_class': stats['armor_class'],
                'movement_speed_debuff': stats['movement_speed_debuff']
            }
    if item_type == 'helmet':
        stats = HELMET_DATA.get(name)
        if stats:
            return {
                'type': 'helmet',
                'name': name,
                'durability': stats['durability'],
                'armor_class': stats['armor_class'],
                'movement_speed_debuff': stats['movement_speed_debuff']
            }
    if item_type == 'ticket':
        return {
            'type': 'ticket',
            'name': name,
            'facility': definition.get('facility_name'),
            'tier': definition.get('ticket_tier'),
            'required_trader_level': definition.get('required_trader_level')
        }
    return None


def build_item_definitions():
    definitions = {}
    category_map = defaultdict(set)

    def register_order(names, item_type):
        total = len(names)
        for idx, name in enumerate(names):
            size = ITEM_SIZE_DATA.get(name, {})
            stack = size.get('stack_size', 1)
            default_qty = size.get('default_quantity', stack)
            extra_meta = {}
            image_path = size.get('image_path')
            if image_path:
                extra_meta['image_path'] = image_path
            if name in HIDEOUT_TICKET_META:
                extra_meta.update(HIDEOUT_TICKET_META[name])
            _register_item(
                definitions,
                category_map,
                name,
                item_type,
                size.get('width', 1),
                size.get('height', 1),
                stack,
                default_qty,
                idx + 1,
                total,
                extra_meta=extra_meta or None
            )

    register_order(MEDICAL_RARITY_ORDER, 'medical')
    register_order(WEAPON_RARITY_ORDER, 'weapon')
    register_order(MAGAZINE_RARITY_ORDER, 'magazine')
    register_order(FLARE_RARITY_ORDER, 'flare')
    register_order(HIDEOUT_TICKET_ORDER, 'ticket')

    # アーマーを防御力と耐久値の合計でソート（高い順）
    armor_order = sorted(
        ARMOR_DATA.items(),
        key=lambda kv: kv[1]['armor_class'] + kv[1]['durability'],
        reverse=True
    )
    total_armors = len(armor_order)
    rank = 1
    for name, data in armor_order:
        _register_item(
            definitions,
            category_map,
            name,
            'armor',
            data['width'],
            data['height'],
            1,
            1,
            rank,
            total_armors
        )
        rank += 1

    # ヘルメットを防御力と耐久値の合計でソート（高い順）
    helmet_order = sorted(
        HELMET_DATA.items(),
        key=lambda kv: kv[1]['armor_class'] + kv[1]['durability'],
        reverse=True
    )
    total_helmets = len(helmet_order)
    rank = 1
    for name, data in helmet_order:
        _register_item(
            definitions,
            category_map,
            name,
            'helmet',
            data['width'],
            data['height'],
            1,
            1,
            rank,
            total_helmets
        )
        rank += 1

    backpack_order = sorted(
        BACKPACK_SIZE_DATA.items(),
        key=lambda kv: kv[1]['content'],
        reverse=True
    )
    total_backpacks = len([name for name, _ in backpack_order if name not in ITEM_ALIASES])
    rank = 1
    for name, data in backpack_order:
        canonical = ITEM_ALIASES.get(name, name)
        if canonical != name:
            continue
        _register_item(
            definitions,
            category_map,
            name,
            'backpack',
            data['width'],
            data['height'],
            1,
            1,
            rank,
            total_backpacks
        )
        rank += 1

    rig_order = sorted(
        RIG_SIZE_DATA.items(),
        key=lambda kv: kv[1]['content'],
        reverse=True
    )
    total_rigs = len([name for name, _ in rig_order if name not in ITEM_ALIASES])
    rank = 1
    for name, data in rig_order:
        canonical = ITEM_ALIASES.get(name, name)
        if canonical != name:
            continue
        _register_item(
            definitions,
            category_map,
            name,
            'rig',
            data['width'],
            data['height'],
            1,
            1,
            rank,
            total_rigs
        )
        rank += 1

    total_ammo = len(AMMO_RARITY_ORDER)
    for idx, name in enumerate(AMMO_RARITY_ORDER):
        _register_item(
            definitions,
            category_map,
            name,
            'ammo',
            1,
            1,
            AMMO_STACK_SIZES.get(name, 60),
            AMMO_STACK_SIZES.get(name, 60),
            idx + 1,
            total_ammo
        )

    # Other items (for hideout upgrades and tasks)
    other_items = []
    for name, size_data in ITEM_SIZE_DATA.items():
        if 'rarity_level' in size_data:
            other_items.append((name, size_data))
    
    # レア度でソート（1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary, 6=Mythic）
    other_items.sort(key=lambda x: (x[1].get('rarity_level', 1), x[0]))
    
    total_other = len(other_items)
    for rank, (name, size_data) in enumerate(other_items, 1):
        rarity_level = size_data.get('rarity_level', 1)
        rarity_label = RARITY_LEVEL_MAP.get(rarity_level, 'Common')
        image_path = f'/pic/item/{name}.png'
        _register_item(
            definitions,
            category_map,
            name,
            'other',
            size_data.get('width', 1),
            size_data.get('height', 1),
            1,
            size_data.get('default_quantity', 1),
            rank,
            total_other,
            extra_meta={
                'rarity_level': rarity_level,
                'rarity_label_override': rarity_label,
                'image_path': image_path
            }
        )

    max_rank_by_type = defaultdict(int)
    category_weights = defaultdict(float)
    for meta in definitions.values():
        max_rank_by_type[meta['type']] = max(max_rank_by_type[meta['type']], meta['rarity_rank'])
    for meta in definitions.values():
        weight = max(meta['rarity_total'] - meta['rarity_rank'] + 1, 1)
        meta['rarity_weight'] = weight
        category_weights[meta['type']] += weight
    for meta in definitions.values():
        weight = meta.get('rarity_weight', 1)
        total_weight = category_weights.get(meta['type'], weight)
        meta['drop_rate'] = weight / total_weight if total_weight else 0
        meta['rarity_label'] = _rarity_label(meta['rarity_rank'], meta['rarity_total'])
        if meta.get('rarity_label_override'):
            meta['rarity_label'] = meta['rarity_label_override']

    rarity_visualization = []
    for cat in CATEGORY_ORDER:
        names = [n for n in category_map.get(cat, []) if ITEM_ALIASES.get(n, n) == n]
        if not names:
            continue
        sorted_names = sorted(names, key=lambda n: definitions[n]['rarity_rank'])
        rarity_visualization.append({
            'type': cat,
            'items': [
                {
                    'name': name,
                    'rarityLabel': definitions[name]['rarity_label'],
                    'rarityRank': definitions[name]['rarity_rank'],
                    'dropRate': definitions[name]['drop_rate']
                }
                for name in sorted_names
            ]
        })

    definition_index = {name.lower(): meta for name, meta in definitions.items()}
    for alias, target in ITEM_ALIASES.items():
        target_meta = definitions.get(target)
        if target_meta:
            definition_index[alias.lower()] = target_meta
    return definitions, rarity_visualization, dict(max_rank_by_type), definition_index


ITEM_DEFINITIONS, RARITY_VISUALIZATION, MAX_RARITY_RANK_BY_TYPE, ITEM_DEFINITION_INDEX = build_item_definitions()

# 武器とマガジンの対応関係
WEAPON_MAGAZINE_MAP = {
    'M4A1': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'AK-74M': ['5.45x39mm standard 30連マガジン'],
    'Ash-12': ['Ash-12用 10連マガジン', 'Ash-12用 20連マガジン'],
    'AS VAL': ['AS VAL用15連マガジン', 'AS VAL用 30連マガジン'],
    'M16A2': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'Radian Weapons Model 1 FA 5.56x45 assault rifle': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'Steyr AUG A1 5.56x45 assault rifle': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'FN SCAR-H 7.62x51 assault rifle LB': ['7.61x51mm standard 30連マガジン', '7.61x51mm short 20連マガジン'],
    'Custom Guns NL545': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'SIG MCX SPEAR 6.8x51 assault rifle': ['6.8x51mm standard 30連マガジン', '6.8x51mm short 15連マガジン'],
    'Desert Tech MDR 5.56x45 assault rifle': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'Desert Tech MDR 7.62x51 assault rifle': ['7.61x51mm standard 30連マガジン', '7.61x51mm short 20連マガジン'],
    'FN SCAR-L 5.56x45 assault rifle LB': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'HK G36 5.56x45 assault rifle': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'Kalashnikov AK-101 5.56x45 assault rifle': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'HK 416A5 5.56x45 assault rifle': ['5.56x45mm standard 30連マガジン', '5.56x45mm over 100連マガジン'],
    'Rifle Dynamics RD-704 7.62x39 assault rifle': ['7.62x39mm standard 30連マガジン', '7.62x39mm short 15連マガジン'],
    'Aklys Defense Velociraptor .300 Blackout assault rifle': ['.300 blackout standard 30連マガジン'],
    'Kalashnikov AKM 7.62x39 assault rifle': ['7.62x39mm standard 30連マガジン', '7.62x39mm short 15連マガジン'],
    'CMMG Mk47 Mutant 7.62x39 assault rifle': ['7.62x39mm standard 30連マガジン', '7.62x39mm short 15連マガジン'],
    'SIG MCX .300 Blackout assault rifle': ['.300 blackout standard 30連マガジン'],
    'DS Arms SA-58 7.62x51 assault rifle': ['7.61x51mm standard 30連マガジン', '7.61x51mm short 20連マガジン'],
}

# マガジンと弾薬の口径対応関係
MAGAZINE_CALIBER_MAP = {
    '5.56x45mm standard 30連マガジン': '5.56x45mm',
    '5.56x45mm over 100連マガジン': '5.56x45mm',
    '5.45x39mm standard 30連マガジン': '5.45x39mm',
    'Ash-12用 10連マガジン': '12.7x55mm',
    'Ash-12用 20連マガジン': '12.7x55mm',
    'AS VAL用15連マガジン': '9x39mm',
    'AS VAL用 30連マガジン': '9x39mm',
    '7.61x51mm standard 30連マガジン': '7.62x51mm',
    '7.61x51mm short 20連マガジン': '7.62x51mm',
    '7.62x39mm standard 30連マガジン': '7.62x39mm',
    '7.62x39mm short 15連マガジン': '7.62x39mm',
    '6.8x51mm standard 30連マガジン': '6.8x51mm',
    '6.8x51mm short 15連マガジン': '6.8x51mm',
    '.300 blackout standard 30連マガジン': '.300 blackout',
}

# マガジンの容量
MAGAZINE_CAPACITY_MAP = {
    '5.56x45mm standard 30連マガジン': 30,
    '5.56x45mm over 100連マガジン': 100,
    '5.45x39mm standard 30連マガジン': 30,
    'Ash-12用 10連マガジン': 10,
    'Ash-12用 20連マガジン': 20,
    'AS VAL用15連マガジン': 15,
    'AS VAL用 30連マガジン': 30,
    '7.61x51mm standard 30連マガジン': 30,
    '7.61x51mm short 20連マガジン': 20,
    '7.62x39mm standard 30連マガジン': 30,
    '7.62x39mm short 15連マガジン': 15,
    '6.8x51mm standard 30連マガジン': 30,
    '6.8x51mm short 15連マガジン': 15,
    '.300 blackout standard 30連マガジン': 30,
}


def get_item_definition(name: str):
    if not name:
        return None
    return ITEM_DEFINITIONS.get(name) or ITEM_DEFINITION_INDEX.get(name.lower())


