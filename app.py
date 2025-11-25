from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import json
from functools import wraps
from item_data import (
    DEFAULT_STARTING_CURRENCY,
    SELL_PRICE_RATE,
    BASE_PRICE_BY_TYPE,
    TRADER_PROFILES,
    ITEM_DEFINITIONS,
    RARITY_VISUALIZATION,
    MAX_RARITY_RANK_BY_TYPE,
    THERAPIST_SECTIONS,
    THERAPIST_SECTION_MAP,
    SKIER_SECTION_ORDER,
    RAGMAN_SECTION_ORDER,
    JAEGER_SECTION_ORDER,
    ARMOR_DATA,
    HELMET_DATA,
    WEAPON_RARITY_ORDER,
    MAGAZINE_RARITY_ORDER,
    AMMO_RARITY_ORDER,
    MEDICAL_RARITY_ORDER,
    BACKPACK_SIZE_DATA,
    RIG_SIZE_DATA,
    WEAPON_MAGAZINE_MAP,
    MAGAZINE_CALIBER_MAP,
    MAGAZINE_CAPACITY_MAP,
    ITEM_SIZE_DATA,
    get_item_definition,
    build_item_stats
)
import random
from quest_data import TASK_DEFINITIONS, get_task_definition

PLAYER_LEVEL_THRESHOLDS = [0, 10000, 25000, 50000, 80000, 120000, 170000, 230000, 300000, 380000, 470000, 580000, 700000, 850000, 1000000 ,1200000, 1400000, 1600000, 1800000, 2000000, 2200000, 2400000, 2600000, 2800000, 3000000, 3200000, 3400000, 3600000, 3800000, 4000000, 4200000, 4400000, 4600000, 4800000, 5000000, 5200000, 5400000, 5600000, 5800000, 6000000, 6200000, 6400000, 6600000, 6800000, 7000000, 7200000, 7400000, 7600000, 7800000, 8000000, 8200000, 8400000, 8600000, 8800000, 9000000, 9200000, 9400000, 9600000, 9800000, 10000000, 12000000, 14000000, 16000000, 18000000, 20000000, 22000000, 24000000, 26000000, 28000000, 30000000, 32000000, 34000000, 36000000, 38000000, 40000000, 42000000, 44000000, 46000000, 48000000, 50000000, 52000000, 54000000, 56000000, 58000000, 60000000, 62000000, 64000000, 66000000, 68000000, 70000000, 72000000, 74000000, 76000000, 78000000, 80000000, 82000000, 84000000, 86000000, 88000000, 90000000, 92000000, 94000000, 96000000, 98000000, ]
TRADER_LEVEL_THRESHOLDS = {
    'therapist': [0, 15000, 40000, 80000, 130000],
    'prapor': [0, 20000, 90000, 300000, 1000000],
    'skier': [0, 18000, 90000, 300000, 1000000],
    'ragman': [0, 17000, 42000, 78000, 120000],
    'jaeger': [0, 19000, 90000, 300000, 1000000],
    'mechanic': [0, 16000, 90000, 300000, 1000000],
    'peacekeeper': [0, 18000, 90000, 300000, 1000000]
}
PLAYER_EVENT_DEFAULTS = {
    'kill': {'base': 140, 'elite_bonus': 110, 'boss_bonus': 260},
    'heal': {'per_point': 0.8, 'max': 750},
    'status_cure': {'base': 90},
    'survival': {'per_second': 0.3, 'max': 2200},
    'extraction': {'normal': 1800, 'green_flare': 1300, 'yellow_flare': 900}
}
TRADER_GIVER_MAP = {
    'セラピスト': 'therapist',
    'プリャポル': 'prapor',
    'スキアー': 'skier',
    'ラグマン': 'ragman',
    'イェーガー': 'jaeger',
    'メカニック': 'mechanic',
    'ピースキーパー': 'peacekeeper'
}
LEVEL_RARITY_ACCESS = {
    1: {'Common'},
    2: {'Common', 'Uncommon'},
    3: {'Common', 'Uncommon', 'Rare'},
    4: {'Common', 'Uncommon', 'Rare', 'Epic'},
    5: {'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'}
}

app = Flask(__name__)
app.secret_key = os.urandom(24)  # セッション用の秘密鍵

# データベース設定
DATABASE = 'eft_game.db'
STASH_WIDTH = 12
STASH_HEIGHT = 100

# データベース初期化
def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            item_type TEXT NOT NULL,
            item_name TEXT NOT NULL,
            grid_x INTEGER,
            grid_y INTEGER,
            width INTEGER DEFAULT 1,
            height INTEGER DEFAULT 1,
            equipped_slot TEXT,
            quantity INTEGER DEFAULT 1,
            parent_item_id INTEGER,
            ammo_stack TEXT,
            weapon_durability INTEGER DEFAULT 100,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (parent_item_id) REFERENCES items(id)
        )
    ''')
    
    # ammo_stackカラムが存在しない場合は追加
    try:
        cursor.execute('ALTER TABLE items ADD COLUMN ammo_stack TEXT')
    except sqlite3.OperationalError:
        pass  # カラムが既に存在する場合はスキップ
    
    # rig_slot_xカラムが存在しない場合は追加
    try:
        cursor.execute('ALTER TABLE items ADD COLUMN rig_slot_x INTEGER')
    except sqlite3.OperationalError:
        pass  # カラムが既に存在する場合はスキップ
    
    # rig_slot_yカラムが存在しない場合は追加
    try:
        cursor.execute('ALTER TABLE items ADD COLUMN rig_slot_y INTEGER')
    except sqlite3.OperationalError:
        pass  # カラムが既に存在する場合はスキップ
    
    # weapon_durabilityカラムが存在しない場合は追加
    try:
        cursor.execute('ALTER TABLE items ADD COLUMN weapon_durability INTEGER DEFAULT 100')
    except sqlite3.OperationalError:
        pass  # カラムが既に存在する場合はスキップ
    # armor_durabilityカラムが存在しない場合は追加
    try:
        cursor.execute('ALTER TABLE items ADD COLUMN armor_durability INTEGER')
    except sqlite3.OperationalError:
        pass  # カラムが既に存在する場合はスキップ
    # helmet_durabilityカラムが存在しない場合は追加
    try:
        cursor.execute('ALTER TABLE items ADD COLUMN helmet_durability INTEGER')
    except sqlite3.OperationalError:
        pass  # カラムが既に存在する場合はスキップ
    try:
        cursor.execute(f'ALTER TABLE users ADD COLUMN currency INTEGER DEFAULT {DEFAULT_STARTING_CURRENCY}')
    except sqlite3.OperationalError:
        pass  # 既存環境
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN player_level INTEGER DEFAULT 1')
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute('ALTER TABLE users ADD COLUMN player_xp INTEGER DEFAULT 0')
    except sqlite3.OperationalError:
        pass
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            task_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'locked',
            progress INTEGER NOT NULL DEFAULT 0,
            order_index INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, task_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_trader_levels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            trader_id TEXT NOT NULL,
            level INTEGER NOT NULL DEFAULT 1,
            xp INTEGER NOT NULL DEFAULT 0,
            UNIQUE(user_id, trader_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    
    conn.commit()
    conn.close()

# データベース接続ヘルパー
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def load_user_items(conn, user_id):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, item_name, item_type, grid_x, grid_y, width, height,
               equipped_slot, quantity, parent_item_id, weapon_durability, armor_durability, helmet_durability
        FROM items
        WHERE user_id = ?
    ''', (user_id,))
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


def fetch_user_currency(conn, user_id):
    cursor = conn.cursor()
    cursor.execute('SELECT currency FROM users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    if not row:
        return DEFAULT_STARTING_CURRENCY
    currency = row['currency']
    if currency is None:
        currency = DEFAULT_STARTING_CURRENCY
        cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (currency, user_id))
    return currency


def update_user_currency(conn, user_id, new_value):
    cursor = conn.cursor()
    cursor.execute('UPDATE users SET currency = ? WHERE id = ?', (max(0, new_value), user_id))


def adjust_user_currency(conn, user_id, delta):
    current = fetch_user_currency(conn, user_id)
    new_value = max(0, current + delta)
    update_user_currency(conn, user_id, new_value)
    return new_value


def calculate_level_from_thresholds(xp, thresholds):
    level = 1
    next_threshold = None
    for idx, threshold in enumerate(thresholds[1:], start=2):
        if xp >= threshold:
            level = idx
        else:
            next_threshold = threshold
            break
    if next_threshold is None and thresholds:
        next_threshold = thresholds[-1]
    return level, next_threshold


def get_player_progress(conn, user_id):
    cursor = conn.cursor()
    cursor.execute('SELECT player_level, player_xp FROM users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    if not row:
        return {'level': 1, 'xp': 0, 'xpToNext': PLAYER_LEVEL_THRESHOLDS[1] if len(PLAYER_LEVEL_THRESHOLDS) > 1 else 0}
    xp = row['player_xp'] or 0
    level = row['player_level'] or 1
    computed_level, next_threshold = calculate_level_from_thresholds(xp, PLAYER_LEVEL_THRESHOLDS)
    if computed_level != level:
        level = computed_level
        cursor.execute('UPDATE users SET player_level = ? WHERE id = ?', (level, user_id))
        conn.commit()
    xp_to_next = max((next_threshold or 0) - xp, 0)
    return {'level': level, 'xp': xp, 'nextThreshold': next_threshold, 'xpToNext': xp_to_next}


def grant_player_xp(conn, user_id, amount, reason=None):
    if not amount:
        return get_player_progress(conn, user_id)
    cursor = conn.cursor()
    cursor.execute('SELECT player_xp FROM users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    current_xp = row['player_xp'] if row and row['player_xp'] is not None else 0
    new_xp = max(0, int(current_xp) + int(amount))
    new_level, next_threshold = calculate_level_from_thresholds(new_xp, PLAYER_LEVEL_THRESHOLDS)
    cursor.execute('UPDATE users SET player_xp = ?, player_level = ? WHERE id = ?', (new_xp, new_level, user_id))
    conn.commit()
    return {
        'level': new_level,
        'xp': new_xp,
        'xpToNext': max((next_threshold or 0) - new_xp, 0),
        'nextThreshold': next_threshold
    }


def get_trader_level_thresholds(trader_id):
    return TRADER_LEVEL_THRESHOLDS.get(trader_id, [0, 1200, 3200, 6500, 11000])


def get_allowed_rarity_labels_for_level(level):
    if not level:
        return LEVEL_RARITY_ACCESS[min(LEVEL_RARITY_ACCESS.keys())]
    keys = sorted(LEVEL_RARITY_ACCESS.keys())
    allowed_key = keys[0]
    for key in keys:
        if level >= key:
            allowed_key = key
        else:
            break
    return LEVEL_RARITY_ACCESS.get(allowed_key, LEVEL_RARITY_ACCESS[max(keys)])


def ensure_trader_levels(conn, user_id):
    cursor = conn.cursor()
    cursor.execute('SELECT trader_id FROM user_trader_levels WHERE user_id = ?', (user_id,))
    existing = {row['trader_id'] for row in cursor.fetchall()}
    expected_ids = set(TRADER_LEVEL_THRESHOLDS.keys())
    for profile in TRADER_PROFILES:
        expected_ids.add(profile['id'])
    for trader_id in expected_ids:
        if trader_id not in existing:
            cursor.execute(
                'INSERT OR IGNORE INTO user_trader_levels (user_id, trader_id, level, xp) VALUES (?, ?, ?, ?)',
                (user_id, trader_id, 1, 0)
            )
    conn.commit()


def calculate_trader_progress(xp, thresholds):
    level, next_threshold = calculate_level_from_thresholds(xp, thresholds)
    return {
        'level': level,
        'xp': xp,
        'xpToNext': max((next_threshold or 0) - xp, 0),
        'nextThreshold': next_threshold
    }


def get_user_trader_levels(conn, user_id):
    ensure_trader_levels(conn, user_id)
    cursor = conn.cursor()
    cursor.execute('SELECT trader_id, xp FROM user_trader_levels WHERE user_id = ?', (user_id,))
    rows = cursor.fetchall()
    progress = {}
    for row in rows:
        trader_id = row['trader_id']
        xp = row['xp'] or 0
        progress[trader_id] = calculate_trader_progress(xp, get_trader_level_thresholds(trader_id))
    return progress


def add_trader_xp(conn, user_id, trader_id, amount):
    if not trader_id or not amount:
        return None
    ensure_trader_levels(conn, user_id)
    cursor = conn.cursor()
    cursor.execute('SELECT xp FROM user_trader_levels WHERE user_id = ? AND trader_id = ?', (user_id, trader_id))
    row = cursor.fetchone()
    current_xp = row['xp'] if row and row['xp'] is not None else 0
    new_xp = max(0, int(current_xp) + int(amount))
    thresholds = get_trader_level_thresholds(trader_id)
    level, next_threshold = calculate_level_from_thresholds(new_xp, thresholds)
    cursor.execute(
        'UPDATE user_trader_levels SET xp = ?, level = ? WHERE user_id = ? AND trader_id = ?',
        (new_xp, level, user_id, trader_id)
    )
    conn.commit()
    return {
        'traderId': trader_id,
        'level': level,
        'xp': new_xp,
        'xpToNext': max((next_threshold or 0) - new_xp, 0),
        'nextThreshold': next_threshold
    }


def map_giver_to_trader_id(giver):
    if not giver:
        return None
    return TRADER_GIVER_MAP.get(giver)


def calculate_event_xp(event_type, payload):
    if not event_type:
        return 0
    event = event_type.lower()
    if event == 'kill':
        enemy_type = (payload or {}).get('enemy_type', 'normal')
        xp = PLAYER_EVENT_DEFAULTS['kill']['base']
        if enemy_type == 'elite':
            xp += PLAYER_EVENT_DEFAULTS['kill']['elite_bonus']
        elif enemy_type == 'boss':
            xp += PLAYER_EVENT_DEFAULTS['kill']['boss_bonus']
        return int(xp)
    if event == 'heal':
        amount = max(0.0, float((payload or {}).get('amount', 0)))
        xp = min(amount * PLAYER_EVENT_DEFAULTS['heal']['per_point'], PLAYER_EVENT_DEFAULTS['heal']['max'])
        return int(xp)
    if event == 'status_cure':
        cures = max(1, int((payload or {}).get('count', 1)))
        xp = PLAYER_EVENT_DEFAULTS['status_cure']['base'] * cures
        return int(xp)
    if event == 'survival':
        seconds = max(0.0, float((payload or {}).get('seconds', 0)))
        xp = min(seconds * PLAYER_EVENT_DEFAULTS['survival']['per_second'], PLAYER_EVENT_DEFAULTS['survival']['max'])
        return int(xp)
    if event == 'extraction':
        method = (payload or {}).get('method', 'normal').lower()
        xp = PLAYER_EVENT_DEFAULTS['extraction'].get(method)
        return int(xp or 0)
    if event == 'task_reward':
        amount = int((payload or {}).get('xp', 0))
        return max(0, amount)
    return 0


def ensure_user_tasks(conn, user_id):
    cursor = conn.cursor()
    cursor.execute('SELECT task_id, status, progress FROM user_tasks WHERE user_id = ?', (user_id,))
    existing = {row['task_id']: row for row in cursor.fetchall()}
    for order_index, definition in enumerate(TASK_DEFINITIONS):
        task_id = definition['id']
        if task_id not in existing:
            cursor.execute('''
                INSERT INTO user_tasks (user_id, task_id, status, progress, order_index)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, task_id, 'locked', 0, order_index))
    conn.commit()

    cursor.execute('SELECT task_id, status FROM user_tasks WHERE user_id = ? ORDER BY order_index', (user_id,))
    rows = cursor.fetchall()
    if not any(row['status'] == 'active' for row in rows):
        for row in rows:
            if row['status'] != 'completed':
                cursor.execute('UPDATE user_tasks SET status = ? WHERE user_id = ? AND task_id = ?', ('active', user_id, row['task_id']))
                conn.commit()
                break


def get_user_tasks(conn, user_id):
    ensure_user_tasks(conn, user_id)
    cursor = conn.cursor()
    cursor.execute('SELECT task_id, status, progress, order_index FROM user_tasks WHERE user_id = ? ORDER BY order_index', (user_id,))
    rows = cursor.fetchall()
    return {row['task_id']: row for row in rows}


def find_stash_slot(items, width, height):
    width = max(1, width or 1)
    height = max(1, height or 1)
    grid = [[False] * STASH_WIDTH for _ in range(STASH_HEIGHT)]
    for item in items:
        if item.get('parent_item_id'):
            continue
        if item.get('equipped_slot'):
            continue
        gx = item.get('grid_x')
        gy = item.get('grid_y')
        if gx is None or gy is None:
            continue
        item_width = max(1, item.get('width') or 1)
        item_height = max(1, item.get('height') or 1)
        for dy in range(item_height):
            for dx in range(item_width):
                x = gx + dx
                y = gy + dy
                if 0 <= x < STASH_WIDTH and 0 <= y < STASH_HEIGHT:
                    grid[y][x] = True
    for y in range(STASH_HEIGHT - height + 1):
        for x in range(STASH_WIDTH - width + 1):
            fits = True
            for dy in range(height):
                for dx in range(width):
                    if grid[y + dy][x + dx]:
                        fits = False
                        break
                if not fits:
                    break
            if fits:
                return x, y
    return None


def delete_item_tree(conn, user_id, root_id):
    cursor = conn.cursor()
    cursor.execute('SELECT id, parent_item_id FROM items WHERE user_id = ?', (user_id,))
    rows = cursor.fetchall()
    child_map = {}
    for row in rows:
        parent = row['parent_item_id']
        if parent is None:
            continue
        child_map.setdefault(parent, []).append(row['id'])
    to_delete = set()
    stack = [root_id]
    while stack:
        current = stack.pop()
        if current in to_delete:
            continue
        to_delete.add(current)
        stack.extend(child_map.get(current, []))
    if not to_delete:
        return
    placeholders = ','.join('?' * len(to_delete))
    cursor.execute(
        f'DELETE FROM items WHERE user_id = ? AND id IN ({placeholders})',
        (user_id, *to_delete)
    )


def remove_items_by_name(conn, user_id, item_name, quantity):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id FROM items
        WHERE user_id = ? AND item_name = ? AND equipped_slot IS NULL
        ORDER BY id ASC
        LIMIT ?
    ''', (user_id, item_name, quantity))
    rows = cursor.fetchall()
    if len(rows) < quantity:
        return False
    for row in rows:
        delete_item_tree(conn, user_id, row['id'])
    return True


def calculate_item_price(item_name, item_type, quantity=None, action='buy', trader_markup=1.0, definition=None):
    definition = definition or get_item_definition(item_name)
    resolved_type = (definition['type'] if definition else item_type) or 'misc'
    base_price = BASE_PRICE_BY_TYPE.get(resolved_type, 12000)
    max_rank = MAX_RARITY_RANK_BY_TYPE.get(resolved_type, 1) or 1
    rarity_rank = definition['rarity_rank'] if definition else max_rank
    rarity_bonus = max(max_rank - rarity_rank, 0) / max_rank if max_rank else 0
    price = base_price * (1 + rarity_bonus * 1.25)
    stack_size = definition.get('stack_size', 1) if definition else 1
    default_quantity = definition.get('default_quantity', stack_size) if definition else stack_size
    uses_stack = resolved_type in ('ammo', 'medical') and default_quantity
    qty = quantity if quantity is not None else (default_quantity if uses_stack else 1)
    qty = max(1, int(qty))
    if uses_stack and default_quantity:
        price *= (qty / default_quantity)
    elif qty and qty > 1:
        price *= qty
    if action == 'buy':
        price *= trader_markup
    elif action == 'sell':
        price *= SELL_PRICE_RATE
    return max(200, int(price // 100 * 100))


def build_trader_inventory(profile, allowed_rarity_labels=None, trader_level=None):
    categories = set(profile.get('categories', []))
    inventory = []
    for name, definition in ITEM_DEFINITIONS.items():
        item_type = definition['type']
        if item_type not in categories:
            continue
        required_level = definition.get('required_trader_level')
        if required_level and (trader_level or 0) < required_level:
            continue
        rarity_label = definition.get('rarity_label', 'Common')
        if allowed_rarity_labels and rarity_label not in allowed_rarity_labels:
            continue
        total_stack_qty = definition.get('default_quantity', definition.get('stack_size', 1))
        price = calculate_item_price(
            name,
            item_type,
            quantity=total_stack_qty,
            action='buy',
            trader_markup=profile.get('markup', 1.0),
            definition=definition
        )
        unit_price = calculate_item_price(
            name,
            item_type,
            quantity=1,
            action='buy',
            trader_markup=profile.get('markup', 1.0),
            definition=definition
        )
        stats = build_item_stats(name, definition)
        can_adjust_quantity = item_type == 'ammo'
        inventory.append({
            'name': name,
            'type': item_type,
            'price': price,
            'rarityLabel': rarity_label,
            'rarityRank': definition['rarity_rank'],
            'stackSize': definition.get('stack_size', 1),
            'defaultQuantity': definition.get('default_quantity', 1),
            'width': definition['width'],
            'height': definition['height'],
            'unitPrice': unit_price,
            'maxQuantity': total_stack_qty if item_type in ('ammo', 'medical') else 1,
            'stats': stats,
            'imagePath': definition.get('image_path'),
            'canAdjustQuantity': can_adjust_quantity
        })
    inventory.sort(key=lambda item: item['rarityRank'])
    return group_inventory_by_profile(profile.get('id'), inventory)


def group_inventory_by_profile(trader_id, inventory):
    if not inventory:
        return []
    sections = []
    if trader_id == 'therapist':
        buckets = {label: [] for label, _ in THERAPIST_SECTIONS}
        buckets.setdefault('その他医療品', [])
        for item in inventory:
            label = THERAPIST_SECTION_MAP.get(item['name'], 'その他医療品')
            buckets.setdefault(label, []).append(item)
        for label, _ in THERAPIST_SECTIONS:
            if buckets.get(label):
                sections.append({'label': label, 'items': buckets[label]})
        if buckets.get('その他医療品'):
            sections.append({'label': 'その他医療品', 'items': buckets['その他医療品']})
    elif trader_id == 'skier':
        buckets = {'武器': [], 'マガジン': []}
        for item in inventory:
            label = '武器' if item['type'] == 'weapon' else 'マガジン'
            buckets[label].append(item)
        for label in SKIER_SECTION_ORDER:
            if buckets[label]:
                sections.append({'label': label, 'items': buckets[label]})
    elif trader_id == 'ragman':
        buckets = {'バックパック': [], 'リグ': [], 'ボディーアーマー': [], 'ヘルメット': []}
        for item in inventory:
            if item['type'] == 'backpack':
                label = 'バックパック'
            elif item['type'] == 'rig':
                label = 'リグ'
            elif item['type'] == 'armor':
                label = 'ボディーアーマー'
            elif item['type'] == 'helmet':
                label = 'ヘルメット'
            else:
                label = 'バックパック'  # デフォルト
            buckets[label].append(item)
        for label in RAGMAN_SECTION_ORDER:
            if buckets[label]:
                sections.append({'label': label, 'items': buckets[label]})
    elif trader_id == 'jaeger':
        buckets = {'高性能弾薬': [], '通常弾薬': [], 'フレア': []}
        for item in inventory:
            if item['type'] == 'flare':
                buckets['フレア'].append(item)
            else:
                label = '高性能弾薬' if item.get('rarityLabel') in ('Legendary', 'Epic') else '通常弾薬'
                buckets[label].append(item)
        for label in JAEGER_SECTION_ORDER:
            if buckets[label]:
                sections.append({'label': label, 'items': buckets[label]})
    else:
        sections.append({'label': '取扱商品', 'items': inventory})
    return sections

# 初期アイテムの作成
def create_initial_items(cursor, user_id):
    """新規ユーザーに初期装備と武器を配布"""
    initial_items = [
        # バックパック（横12マスに収まるように配置）
        {'item_type': 'backpack', 'item_name': '6SH118', 'grid_x': 0, 'grid_y': 0, 'width': 6, 'height': 7, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'Paratus', 'grid_x': 6, 'grid_y': 0, 'width': 5, 'height': 7, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'Beta2', 'grid_x': 0, 'grid_y': 7, 'width': 5, 'height': 5, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'Daypack', 'grid_x': 5, 'grid_y': 7, 'width': 4, 'height': 5, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'Takedown', 'grid_x': 9, 'grid_y': 7, 'width': 3, 'height': 7, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'MBSS', 'grid_x': 0, 'grid_y': 12, 'width': 4, 'height': 4, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'T20', 'grid_x': 4, 'grid_y': 12, 'width': 5, 'height': 5, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'ScavBP', 'grid_x': 0, 'grid_y': 17, 'width': 4, 'height': 5, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'pilgrim', 'grid_x': 4, 'grid_y': 17, 'width': 5, 'height': 7, 'quantity': 1},
        {'item_type': 'backpack', 'item_name': 'VKBO', 'grid_x': 9, 'grid_y': 14, 'width': 3, 'height': 4, 'quantity': 1},
        
        # リグ
        {'item_type': 'rig', 'item_name': 'Alpha', 'grid_x': 0, 'grid_y': 24, 'width': 4, 'height': 4, 'quantity': 1},
        {'item_type': 'rig', 'item_name': 'khamelion', 'grid_x': 4, 'grid_y': 24, 'width': 4, 'height': 3, 'quantity': 1},
        {'item_type': 'rig', 'item_name': 'Azimut', 'grid_x': 8, 'grid_y': 24, 'width': 4, 'height': 3, 'quantity': 1},
        
        # 武器（4x2）
        {'item_type': 'weapon', 'item_name': 'M4A1', 'grid_x': 0, 'grid_y': 28, 'width': 5, 'height': 2, 'quantity': 1},
        {'item_type': 'weapon', 'item_name': 'AK-74M', 'grid_x': 5, 'grid_y': 28, 'width': 5, 'height': 2, 'quantity': 1},
        {'item_type': 'weapon', 'item_name': 'Ash-12', 'grid_x': 0, 'grid_y': 30, 'width': 4, 'height': 2, 'quantity': 1},
        {'item_type': 'weapon', 'item_name': 'AS VAL', 'grid_x': 4, 'grid_y': 30, 'width': 5, 'height': 2, 'quantity': 1},
        
        # 弾薬（1x1）
        {'item_type': 'ammo', 'item_name': '5.56x45mm FMJ', 'grid_x': 0, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 120},
        {'item_type': 'ammo', 'item_name': '5.45x39mm BP', 'grid_x': 1, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 120},
        {'item_type': 'ammo', 'item_name': '12.7x55mm PS12B', 'grid_x': 2, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 80},
        {'item_type': 'ammo', 'item_name': '9x39mm FMJ', 'grid_x': 3, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 90},
        # 9x39mm弾薬（新規追加）
        {'item_type': 'ammo', 'item_name': '9x39mm BP gs', 'grid_x': 2, 'grid_y': 34, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '9x39mm PAB-9 gs', 'grid_x': 3, 'grid_y': 34, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '9x39mm SP-5 gs', 'grid_x': 4, 'grid_y': 34, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '9x39mm SP-6 gs', 'grid_x': 5, 'grid_y': 34, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '9x39mm SPP gs', 'grid_x': 6, 'grid_y': 34, 'width': 1, 'height': 1, 'quantity': 60},
        # 5.56x45mm弾薬（新規追加）
        {'item_type': 'ammo', 'item_name': '5.56x45mm HP', 'grid_x': 4, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm M855 (M855)', 'grid_x': 5, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm M855A1 (M855A1)', 'grid_x': 6, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm M856 (M856)', 'grid_x': 7, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm M856A1 (856AI)', 'grid_x': 8, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm M995 (M995)', 'grid_x': 9, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm Mk255 Mod 0 (RRLP)', 'grid_x': 10, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm Mk318 Mod 0 (SOFT)', 'grid_x': 11, 'grid_y': 33, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm SSA AP', 'grid_x': 0, 'grid_y': 34, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.56x45mm Warmageddon', 'grid_x': 1, 'grid_y': 34, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm 7N40', 'grid_x': 0, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm BS', 'grid_x': 1, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm BT', 'grid_x': 2, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm FMJ', 'grid_x': 3, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm HP', 'grid_x': 4, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm PP', 'grid_x': 5, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm PPBS gs Igolnik', 'grid_x': 6, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm PRS gs', 'grid_x': 7, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm PS gs', 'grid_x': 8, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm SP', 'grid_x': 9, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm T gs', 'grid_x': 10, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '5.45x39mm US gs', 'grid_x': 11, 'grid_y': 36, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '12.7x55mm PS12', 'grid_x': 0, 'grid_y': 37, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '12.7x55mm PS12A', 'grid_x': 1, 'grid_y': 37, 'width': 1, 'height': 1, 'quantity': 60},
        {'item_type': 'ammo', 'item_name': '12.7x55mm PS12B', 'grid_x': 2, 'grid_y': 37, 'width': 1, 'height': 1, 'quantity': 60},
        
        # マガジン
        {'item_type': 'magazine', 'item_name': '5.56x45mm standard 30連マガジン', 'grid_x': 0, 'grid_y': 35, 'width': 1, 'height': 2, 'quantity': 0},
        {'item_type': 'magazine', 'item_name': '5.45x39mm standard 30連マガジン', 'grid_x': 1, 'grid_y': 35, 'width': 1, 'height': 2, 'quantity': 0},
        {'item_type': 'magazine', 'item_name': 'Ash-12用 10連マガジン', 'grid_x': 2, 'grid_y': 35, 'width': 1, 'height': 2, 'quantity': 0},
        {'item_type': 'magazine', 'item_name': 'Ash-12用 20連マガジン', 'grid_x': 3, 'grid_y': 35, 'width': 1, 'height': 2, 'quantity': 0},
        {'item_type': 'magazine', 'item_name': 'AS VAL用15連マガジン', 'grid_x': 4, 'grid_y': 35, 'width': 1, 'height': 1, 'quantity': 0},
        {'item_type': 'magazine', 'item_name': 'AS VAL用 30連マガジン', 'grid_x': 5, 'grid_y': 35, 'width': 1, 'height': 2, 'quantity': 0},
        
        # 医薬品（quantityは耐久値）
        {'item_type': 'medical', 'item_name': 'AI-2 medkit (AI-2)', 'grid_x': 0, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 100},
        {'item_type': 'medical', 'item_name': 'Salewa first aid kit (Salewa)', 'grid_x': 1, 'grid_y': 38, 'width': 1, 'height': 2, 'quantity': 400},
        {'item_type': 'medical', 'item_name': 'Aseptic bandage (Bandage)', 'grid_x': 2, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 1},
        {'item_type': 'medical', 'item_name': 'Esmarch tourniquet (Esmarch)', 'grid_x': 3, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 1},
        {'item_type': 'medical', 'item_name': 'Immobilizing splint (Splint)', 'grid_x': 4, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 1},
        {'item_type': 'medical', 'item_name': 'Analgin painkillers (Analgin)', 'grid_x': 5, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 4},
        {'item_type': 'medical', 'item_name': 'Aluminum splint', 'grid_x': 6, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 5},
        {'item_type': 'medical', 'item_name': 'Army bandage', 'grid_x': 7, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 2},
        {'item_type': 'medical', 'item_name': 'CALOK-B hemostatic applicator', 'grid_x': 8, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 3},
        {'item_type': 'medical', 'item_name': 'CAT hemostatic tourniquet', 'grid_x': 9, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 1},
        {'item_type': 'medical', 'item_name': 'Golden star balm', 'grid_x': 10, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 10},
        {'item_type': 'medical', 'item_name': 'Vaseline balm', 'grid_x': 11, 'grid_y': 38, 'width': 1, 'height': 1, 'quantity': 6},
        {'item_type': 'medical', 'item_name': 'Augmentin antibiotic pills', 'grid_x': 0, 'grid_y': 39, 'width': 1, 'height': 1, 'quantity': 1},
        {'item_type': 'medical', 'item_name': 'Ibuprofen painkillers', 'grid_x': 2, 'grid_y': 39, 'width': 1, 'height': 1, 'quantity': 15},
        {'item_type': 'medical', 'item_name': 'AFAK tactical individual first aid kit', 'grid_x': 3, 'grid_y': 39, 'width': 1, 'height': 1, 'quantity': 400},
        {'item_type': 'medical', 'item_name': 'IFAK individual first aid kit', 'grid_x': 4, 'grid_y': 39, 'width': 1, 'height': 1, 'quantity': 300},
        {'item_type': 'medical', 'item_name': 'Car first aid kit', 'grid_x': 5, 'grid_y': 39, 'width': 2, 'height': 1, 'quantity': 220},
        {'item_type': 'medical', 'item_name': 'Grizzly medical kit', 'grid_x': 7, 'grid_y': 39, 'width': 2, 'height': 2, 'quantity': 1800},
        {'item_type': 'medical', 'item_name': 'CMS surgical kit (CMS)', 'grid_x': 9, 'grid_y': 39, 'width': 2, 'height': 1, 'quantity': 3},
        {'item_type': 'medical', 'item_name': 'Surv12 field surgical kit', 'grid_x': 0, 'grid_y': 40, 'width': 3, 'height': 1, 'quantity': 15},
        {'item_type': 'medical', 'item_name': 'Water', 'grid_x': 3, 'grid_y': 40, 'width': 1, 'height': 2, 'quantity': 1},
        {'item_type': 'medical', 'item_name': 'MRE', 'grid_x': 4, 'grid_y': 40, 'width': 1, 'height': 2, 'quantity': 1},
        
        # フレア
        {'item_type': 'flare', 'item_name': 'Red Flare', 'grid_x': 6, 'grid_y': 40, 'width': 1, 'height': 2, 'quantity': 1},
        {'item_type': 'flare', 'item_name': 'Green Flare', 'grid_x': 7, 'grid_y': 40, 'width': 1, 'height': 2, 'quantity': 1},
        {'item_type': 'flare', 'item_name': 'Yellow Flare', 'grid_x': 8, 'grid_y': 40, 'width': 1, 'height': 2, 'quantity': 1},
    ]
    
    for item in initial_items:
        cursor.execute('''
            INSERT INTO items (user_id, item_type, item_name, grid_x, grid_y, 
                             width, height, equipped_slot, quantity, parent_item_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            item['item_type'],
            item['item_name'],
            item['grid_x'],
            item['grid_y'],
            item['width'],
            item['height'],
            None,  # equipped_slot
            item['quantity'],
            None   # parent_item_id
        ))

# ログイン必須デコレータ
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# ルーティング
@app.route('/')
def title():
    return render_template('title.html')

@app.route('/login')
def login():
    # 既にログインしている場合はホーム画面へ
    if 'user_id' in session:
        return redirect(url_for('home'))
    return render_template('login.html')

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    # バリデーション
    if not username or not password:
        return jsonify({'success': False, 'message': 'ユーザー名とパスワードを入力してください。'}), 400
    
    if len(username) < 3:
        return jsonify({'success': False, 'message': 'ユーザー名は3文字以上で入力してください。'}), 400
    
    if len(password) < 6:
        return jsonify({'success': False, 'message': 'パスワードは6文字以上で入力してください。'}), 400
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # ユーザー名の重複チェック
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': 'このユーザー名は既に使用されています。'}), 400
        
        # パスワードをハッシュ化して保存
        password_hash = generate_password_hash(password)
        cursor.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            (username, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        
        # 初期装備と武器を配布
        create_initial_items(cursor, user_id)
        conn.commit()
        conn.close()
        
        # セッションにユーザーIDを保存
        session['user_id'] = user_id
        session['username'] = username
        
        return jsonify({'success': True, 'message': 'アカウントを作成しました。'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラーが発生しました: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    
    # バリデーション
    if not username or not password:
        return jsonify({'success': False, 'message': 'ユーザー名とパスワードを入力してください。'}), 400
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # ユーザーを検索
        cursor.execute('SELECT id, username, password FROM users WHERE username = ?', (username,))
        user = cursor.fetchone()
        conn.close()
        
        if user and check_password_hash(user['password'], password):
            # ログイン成功
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({'success': True, 'message': 'ログインに成功しました。'})
        else:
            return jsonify({'success': False, 'message': 'ユーザー名またはパスワードが正しくありません。'}), 401
    
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラーが発生しました: {str(e)}'}), 500

@app.route('/api/user')
@login_required
def get_user():
    return jsonify({
        'username': session.get('username', 'ゲスト'),
        'user_id': session.get('user_id')
    })


@app.route('/api/traders/buy', methods=['POST'])
@login_required
def buy_from_trader():
    data = request.get_json() or {}
    trader_id = data.get('trader_id')
    item_name = data.get('item_name')
    if not trader_id or not item_name:
        return jsonify({'success': False, 'message': 'トレーダーとアイテムを指定してください。'}), 400

    profile = next((p for p in TRADER_PROFILES if p['id'] == trader_id), None)
    if not profile:
        return jsonify({'success': False, 'message': '指定されたトレーダーは存在しません。'}), 400

    definition = get_item_definition(item_name)
    if not definition or definition['type'] not in profile.get('categories', []):
        return jsonify({'success': False, 'message': 'このアイテムは現在購入できません。'}), 400

    quantity = data.get('quantity', 1)
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': '数量は数値で指定してください。'}), 400
    if quantity < 1:
        return jsonify({'success': False, 'message': '数量は1以上を指定してください。'}), 400

    item_type = definition['type']
    is_stackable = item_type in ('ammo', 'medical')
    default_quantity = definition.get('default_quantity', definition.get('stack_size', 1))
    max_quantity = default_quantity if is_stackable else 1
    can_adjust_quantity = item_type == 'ammo'
    if not is_stackable and quantity != 1:
        return jsonify({'success': False, 'message': 'このアイテムは1個ずつのみ購入できます。'}), 400
    if can_adjust_quantity:
        if quantity > max_quantity:
            return jsonify({'success': False, 'message': f'最大 {max_quantity} 個まで購入できます。'}), 400
    else:
        quantity = default_quantity if is_stackable else 1

    user_id = session['user_id']
    conn = get_db()
    currency = None
    price = 0
    try:
        currency = fetch_user_currency(conn, user_id)
        price = calculate_item_price(
            item_name,
            definition['type'],
            quantity=quantity,
            action='buy',
            trader_markup=profile.get('markup', 1.0),
            definition=definition
        )
        if currency < price:
            return jsonify({'success': False, 'message': '資金が不足しています。'}), 400

        items = load_user_items(conn, user_id)
        slot = find_stash_slot(items, definition['width'], definition['height'])
        if slot is None:
            return jsonify({'success': False, 'message': 'スタッシュに空きがありません。'}), 400

        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO items (
                user_id, item_type, item_name, grid_x, grid_y,
                width, height, equipped_slot, quantity, parent_item_id,
                ammo_stack, rig_slot_x, rig_slot_y, weapon_durability
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            definition['type'],
            item_name,
            slot[0],
            slot[1],
            definition['width'],
            definition['height'],
            None,
            quantity if is_stackable else 1,
            None,
            None,
            None,
            None,
            100 if definition['type'] == 'weapon' else None
        ))

        update_user_currency(conn, user_id, currency - price)
        conn.commit()
    finally:
        conn.close()

    return jsonify({
        'success': True,
        'currency': max(0, currency - price),
        'message': f'{item_name} を購入しました。'
    })


@app.route('/api/traders/sell', methods=['POST'])
@login_required
def sell_to_trader():
    data = request.get_json() or {}
    item_id = data.get('item_id')
    if not item_id:
        return jsonify({'success': False, 'message': '売却するアイテムを指定してください。'}), 400

    quantity = data.get('quantity', 1)
    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return jsonify({'success': False, 'message': '数量は数値で指定してください。'}), 400
    if quantity < 1:
        return jsonify({'success': False, 'message': '数量は1以上を指定してください。'}), 400

    user_id = session['user_id']
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, item_name, item_type, quantity, weapon_durability, armor_durability, helmet_durability FROM items WHERE id = ? AND user_id = ?', (item_id, user_id))
    item = cursor.fetchone()
    if not item:
        conn.close()
        return jsonify({'success': False, 'message': 'アイテムが見つかりません。'}), 404

    definition = get_item_definition(item['item_name'])
    current_qty = item['quantity'] or 1
    item_type = definition['type'] if definition else item['item_type']
    
    # 耐久度があるアイテム（医薬品、武器、アーマー、ヘルメット）の場合はアイテムごとに売る（数量調整不可）
    if item_type in ('medical', 'weapon', 'armor', 'helmet'):
        quantity = 1
        
        # 最大耐久度と現在の耐久度を取得
        if item_type == 'medical':
            max_durability = definition.get('default_quantity', definition.get('stack_size', 1)) if definition else current_qty
            current_durability = current_qty
        elif item_type == 'weapon':
            max_durability = 100  # 武器の最大耐久度は100
            current_durability = item['weapon_durability'] if item['weapon_durability'] is not None else max_durability
        elif item_type == 'armor':
            armor_data = ARMOR_DATA.get(item['item_name'])
            max_durability = armor_data['durability'] if armor_data else 100
            current_durability = item['armor_durability'] if item['armor_durability'] is not None else max_durability
        elif item_type == 'helmet':
            helmet_data = HELMET_DATA.get(item['item_name'])
            max_durability = helmet_data['durability'] if helmet_data else 100
            current_durability = item['helmet_durability'] if item['helmet_durability'] is not None else max_durability
        
        # 耐久度を考慮した価格計算
        # 最大耐久度での価格を計算
        max_durability_price = calculate_item_price(
            item['item_name'],
            item['item_type'],
            quantity=1,
            action='sell',
            definition=definition
        )
        # 現在の耐久度 / 最大耐久度の比率で価格を計算
        durability_ratio = current_durability / max_durability if max_durability > 0 else 0
        sell_price = int(max_durability_price * durability_ratio)
        
        # 耐久度があるアイテムは常にアイテム全体を削除
        delete_item_tree(conn, user_id, item_id)
    else:
        # 弾薬などのスタック可能アイテム
        is_stackable = item_type == 'ammo'
        max_sellable = current_qty if is_stackable else 1
        if quantity > max_sellable:
            conn.close()
            return jsonify({'success': False, 'message': '指定数量が所持数を超えています。'}), 400
        if not is_stackable:
            quantity = 1
        sell_price = calculate_item_price(
            item['item_name'],
            item['item_type'],
            quantity=quantity,
            action='sell',
            definition=definition
        )
        if is_stackable and quantity < current_qty:
            cursor.execute(
                'UPDATE items SET quantity = ? WHERE id = ? AND user_id = ?',
                (current_qty - quantity, item_id, user_id)
            )
        else:
            delete_item_tree(conn, user_id, item_id)
    new_currency = adjust_user_currency(conn, user_id, sell_price)
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'currency': new_currency,
        'earned': sell_price,
        'message': f"{item['item_name']} を売却しました。"
    })


@app.route('/api/items/rarity', methods=['GET'])
@login_required
def get_item_rarity():
    return jsonify({'success': True, 'categories': RARITY_VISUALIZATION})


@app.route('/api/quests/tasks', methods=['GET'])
@login_required
def get_user_tasks_api():
    user_id = session['user_id']
    conn = get_db()
    tasks_map = get_user_tasks(conn, user_id)
    items = load_user_items(conn, user_id)
    tasks_payload = []
    for definition in TASK_DEFINITIONS:
        task_id = definition['id']
        row = tasks_map.get(task_id)
        status = row['status'] if row else 'locked'
        progress = row['progress'] if row else 0
        objective = definition.get('objective', {})
        available = 0
        can_turn_in = False
        required_qty = objective.get('quantity', 0)
        if objective.get('type') == 'deliver':
            available = sum(1 for item in items if item['item_name'] == objective.get('item_name'))
            can_turn_in = status == 'active' and available >= required_qty
        tasks_payload.append({
            'id': task_id,
            'name': definition['name'],
            'giver': definition.get('giver'),
            'description': definition.get('description'),
            'status': status,
            'objective': objective,
            'required': required_qty,
            'progress': progress,
            'available': available,
            'canTurnIn': can_turn_in,
            'rewards': definition.get('rewards')
        })
    conn.close()
    return jsonify({'success': True, 'tasks': tasks_payload})


@app.route('/api/quests/turn-in', methods=['POST'])
@login_required
def turn_in_quest_items():
    data = request.get_json() or {}
    task_id = data.get('task_id')
    if not task_id:
        return jsonify({'success': False, 'message': 'タスクIDを指定してください。'}), 400
    definition = get_task_definition(task_id)
    if not definition:
        return jsonify({'success': False, 'message': '指定されたタスクは存在しません。'}), 404
    objective = definition.get('objective', {})
    if objective.get('type') != 'deliver':
        return jsonify({'success': False, 'message': 'このタスクは納品が不要です。'}), 400

    user_id = session['user_id']
    conn = get_db()
    try:
        tasks_map = get_user_tasks(conn, user_id)
        row = tasks_map.get(task_id)
        if not row or row['status'] != 'active':
            return jsonify({'success': False, 'message': 'このタスクは進行中ではありません。'}), 400

        required_qty = objective.get('quantity', 0)
        item_name = objective.get('item_name')
        if required_qty <= 0 or not item_name:
            return jsonify({'success': False, 'message': 'タスクの定義が正しくありません。'}), 500

        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as count FROM items WHERE user_id = ? AND item_name = ? AND equipped_slot IS NULL', (user_id, item_name))
        available = cursor.fetchone()['count']
        if available < required_qty:
            return jsonify({'success': False, 'message': '必要数のアイテムを所持していません。'}), 400

        if not remove_items_by_name(conn, user_id, item_name, required_qty):
            return jsonify({'success': False, 'message': 'アイテムの削除に失敗しました。'}), 500

        cursor.execute('UPDATE user_tasks SET status = ?, progress = ? WHERE user_id = ? AND task_id = ?', ('completed', required_qty, user_id, task_id))
        conn.commit()

        cursor.execute('SELECT task_id, status FROM user_tasks WHERE user_id = ? ORDER BY order_index', (user_id,))
        task_rows = cursor.fetchall()
        if not any(r['status'] == 'active' for r in task_rows):
            for r in task_rows:
                if r['status'] != 'completed':
                    cursor.execute('UPDATE user_tasks SET status = ? WHERE user_id = ? AND task_id = ?', ('active', user_id, r['task_id']))
                    conn.commit()
                    break

        rewards = definition.get('rewards', {})
        currency_delta = rewards.get('currency', 0)
        new_currency = adjust_user_currency(conn, user_id, currency_delta)
        xp_reward = int(rewards.get('exp') or 0)
        player_progress = grant_player_xp(conn, user_id, xp_reward, reason='task_reward') if xp_reward else get_player_progress(conn, user_id)
        trader_progress = None
        trader_id = map_giver_to_trader_id(definition.get('giver'))
        if trader_id:
            trader_xp_gain = xp_reward if xp_reward else 500
            trader_progress = add_trader_xp(conn, user_id, trader_id, trader_xp_gain)

        return jsonify({
            'success': True,
            'message': f"{definition['name']} を完了しました。",
            'currency': new_currency,
            'rewards': rewards,
            'playerProgress': player_progress,
            'traderProgress': trader_progress,
            'traderId': trader_id
        })
    finally:
        conn.close()

@app.route('/api/traders/data', methods=['GET'])
@login_required
def get_trader_data():
    user_id = session['user_id']
    conn = get_db()
    items = load_user_items(conn, user_id)
    currency = fetch_user_currency(conn, user_id)
    player_progress = get_player_progress(conn, user_id)
    trader_levels = get_user_trader_levels(conn, user_id)
    conn.commit()
    conn.close()

    player_items = []
    for item in items:
        if item.get('equipped_slot'):
            continue
        definition = get_item_definition(item['item_name'])
        item_type = definition.get('type') if definition else item.get('item_type')
        current_qty = item.get('quantity') or 1
        
        # 耐久度があるアイテム（医薬品、武器、アーマー、ヘルメット）の場合はアイテムごとに売る（数量調整不可）
        if item_type in ('medical', 'weapon', 'armor', 'helmet'):
            # 最大耐久度と現在の耐久度を取得
            if item_type == 'medical':
                max_durability = definition.get('default_quantity', definition.get('stack_size', 1)) if definition else current_qty
                current_durability = current_qty
            elif item_type == 'weapon':
                max_durability = 100  # 武器の最大耐久度は100
                current_durability = item.get('weapon_durability') if item.get('weapon_durability') is not None else max_durability
            elif item_type == 'armor':
                armor_data = ARMOR_DATA.get(item['item_name'])
                max_durability = armor_data['durability'] if armor_data else 100
                current_durability = item.get('armor_durability') if item.get('armor_durability') is not None else max_durability
            elif item_type == 'helmet':
                helmet_data = HELMET_DATA.get(item['item_name'])
                max_durability = helmet_data['durability'] if helmet_data else 100
                current_durability = item.get('helmet_durability') if item.get('helmet_durability') is not None else max_durability
            
            # 最大耐久度での価格を計算
            max_durability_price = calculate_item_price(
                item['item_name'],
                item['item_type'],
                quantity=1,
                action='sell',
                definition=definition
            )
            # 現在の耐久度 / 最大耐久度の比率で価格を計算
            durability_ratio = current_durability / max_durability if max_durability > 0 else 0
            sell_price = int(max_durability_price * durability_ratio)
            unit_sell_price = sell_price  # 耐久度があるアイテムは1個のみ
            max_quantity = 1  # 耐久度があるアイテムは数量調整不可
        else:
            # 弾薬などのスタック可能アイテム
            sell_price = calculate_item_price(
                item['item_name'],
                item['item_type'],
                quantity=item.get('quantity'),
                action='sell',
                definition=definition
            )
            unit_sell_price = calculate_item_price(
                item['item_name'],
                item['item_type'],
                quantity=1,
                action='sell',
                definition=definition
            )
            max_quantity = current_qty if item_type == 'ammo' else 1
        
        player_items.append({
            'id': item['id'],
            'name': item['item_name'],
            'type': item['item_type'],
            'quantity': item.get('quantity'),
            'sellPrice': sell_price,
            'unitPrice': unit_sell_price,
            'maxQuantity': max_quantity,
            'rarityLabel': definition['rarity_label'] if definition else 'Common',
            'rarityRank': definition['rarity_rank'] if definition else None,
            'stats': build_item_stats(item['item_name'], definition)
        })

    trader_payloads = []
    for profile in TRADER_PROFILES:
        level_info = trader_levels.get(profile['id'])
        allowed_labels = get_allowed_rarity_labels_for_level(level_info['level']) if level_info else None
        trader_payloads.append({
            'id': profile['id'],
            'name': profile['name'],
            'icon': profile.get('icon'),
            'description': profile.get('description'),
            'categories': profile.get('categories'),
            'inventorySections': build_trader_inventory(
                profile,
                allowed_labels,
                trader_level=level_info['level'] if level_info else 1
            ),
            'level': level_info['level'] if level_info else 1,
            'xp': level_info['xp'] if level_info else 0,
            'xpToNext': level_info['xpToNext'] if level_info else 0,
            'nextThreshold': level_info['nextThreshold'] if level_info else None
        })

    return jsonify({
        'success': True,
        'currency': currency,
        'traders': trader_payloads,
        'player_items': player_items,
        'rarity_visualization': RARITY_VISUALIZATION,
        'player_progress': player_progress,
        'trader_levels': trader_levels
    })


@app.route('/api/player/progress', methods=['GET'])
@login_required
def api_player_progress():
    user_id = session['user_id']
    conn = get_db()
    player_progress = get_player_progress(conn, user_id)
    trader_levels = get_user_trader_levels(conn, user_id)
    conn.close()
    return jsonify({'success': True, 'player_progress': player_progress, 'trader_levels': trader_levels})


@app.route('/api/player/xp', methods=['POST'])
@login_required
def api_player_xp():
    data = request.get_json() or {}
    event = data.get('event')
    xp_gain = calculate_event_xp(event, data)
    if xp_gain <= 0:
        return jsonify({'success': False, 'message': '経験値を付与できるイベントではありません。'}), 400
    user_id = session['user_id']
    conn = get_db()
    try:
        player_progress = grant_player_xp(conn, user_id, xp_gain, reason=event)
        trader_progress = None
        trader_id = data.get('trader_id')
        if event == 'task_reward' and trader_id:
            trader_progress = add_trader_xp(conn, user_id, trader_id, xp_gain)
        return jsonify({
            'success': True,
            'xpGained': xp_gain,
            'playerProgress': player_progress,
            'traderProgress': trader_progress
        })
    finally:
        conn.close()

@app.route('/api/dev/set-trader-level', methods=['POST'])
@login_required
def set_trader_level():
    """開発者モード用：トレーダーレベルを直接設定"""
    # ユーザー名が「Dev」でない場合は拒否
    username = session.get('username', '')
    if username != 'Dev':
        return jsonify({'success': False, 'message': '開発者モードへのアクセスが拒否されました。'}), 403
    
    data = request.get_json() or {}
    trader_id = data.get('trader_id')
    level = data.get('level')
    
    if not trader_id or not level:
        return jsonify({'success': False, 'message': 'トレーダーIDとレベルを指定してください。'}), 400
    
    try:
        level = int(level)
        if level < 1 or level > 5:
            return jsonify({'success': False, 'message': 'レベルは1から5の間で指定してください。'}), 400
        
        user_id = session['user_id']
        conn = get_db()
        cursor = conn.cursor()
        
        # トレーダーの閾値を取得
        thresholds = get_trader_level_thresholds(trader_id)
        if not thresholds:
            conn.close()
            return jsonify({'success': False, 'message': '無効なトレーダーIDです。'}), 400
        
        # 指定されたレベルに必要な最小XPを取得
        # レベル1は0、レベル2以降は前のレベルの閾値
        if level == 1:
            required_xp = 0
        elif level <= len(thresholds):
            required_xp = thresholds[level - 1]
        else:
            required_xp = thresholds[-1] if thresholds else 0
        
        # トレーダーレベルを更新
        ensure_trader_levels(conn, user_id)
        cursor.execute(
            'UPDATE user_trader_levels SET xp = ?, level = ? WHERE user_id = ? AND trader_id = ?',
            (required_xp, level, user_id, trader_id)
        )
        
        # 更新されなかった場合は新規作成
        if cursor.rowcount == 0:
            cursor.execute(
                'INSERT INTO user_trader_levels (user_id, trader_id, level, xp) VALUES (?, ?, ?, ?)',
                (user_id, trader_id, level, required_xp)
            )
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'トレーダー{trader_id}のレベルを{level}に設定しました。',
            'trader_id': trader_id,
            'level': level,
            'xp': required_xp
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'エラーが発生しました: {str(e)}'}), 500

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('title'))

@app.route('/home')
@login_required
def home():
    return render_template('home.html')


@app.route('/pic/<path:filename>')
def serve_pic(filename):
    """picディレクトリ内の画像を提供"""
    return send_from_directory('pic', filename)

@app.route('/3dmodel/<path:filename>')
def serve_3dmodel(filename):
    """3dmodelディレクトリ内のモデルデータを提供"""
    return send_from_directory('3dmodel', filename)

@app.route('/character')
@login_required
def character():
    return render_template('character.html')

@app.route('/deploy')
@login_required
def deploy():
    return render_template('deploy.html')

@app.route('/api/character/items', methods=['GET'])
@login_required
def get_items():
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, item_type, item_name, grid_x, grid_y, width, height, 
                   equipped_slot, quantity, parent_item_id, ammo_stack, rig_slot_x, rig_slot_y,
                   weapon_durability, armor_durability, helmet_durability
            FROM items 
            WHERE user_id = ?
        ''', (session['user_id'],))
        items = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/character/equipped', methods=['GET'])
@login_required
def get_equipped_items():
    """装備中のアイテムを取得"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, item_type, item_name, grid_x, grid_y, width, height, 
                   equipped_slot, quantity, parent_item_id, ammo_stack, 
                   weapon_durability, armor_durability, helmet_durability
            FROM items 
            WHERE user_id = ? AND equipped_slot IS NOT NULL
        ''', (session['user_id'],))
        items = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/character/items', methods=['POST'])
@login_required
def update_items():
    try:
        data = request.get_json()
        items = data.get('items', [])
        
        conn = get_db()
        cursor = conn.cursor()
        
        # 削除前に、古いアイテム情報を取得（parent_item_idのマッピング用）
        cursor.execute('''
            SELECT id, item_name, equipped_slot, ammo_stack
            FROM items 
            WHERE user_id = ?
        ''', (session['user_id'],))
        old_items = {row[0]: (row[1], row[2]) for row in cursor.fetchall()}
        
        # 既存のアイテムを削除
        cursor.execute('DELETE FROM items WHERE user_id = ?', (session['user_id'],))
        
        # 古いIDから新しいIDへのマッピングを作成
        # まず、すべてのアイテムを保存して新しいIDを取得
        id_mapping = {}  # 古いID -> 新しいID
        
        # リグやバックパックのアイテム名と装備スロットの組み合わせでマッピングを作成
        # これにより、外したリグやバックパックを再度装備した際に、中身を復元できる
        name_slot_mapping = {}  # (item_name, equipped_slot) -> 新しいID
        
        # バックパック、リグ、武器を先に保存（parent_item_idが必要なアイテムの参照先）
        # 装備中だけでなく、外したリグやバックパックも保存する（中身を保持するため）
        for item in items:
            item_type = item.get('item_type', '')
            equipped_slot = item.get('equipped_slot')
            
            # バックパックまたはリグの場合（装備中または外したもの）
            if (item_type in ['backpack', 'rig'] and equipped_slot in ['backpack', 'rig']) or \
               (item_type in ['backpack', 'rig'] and not equipped_slot and item.get('grid_x') is not None):
                old_id = item.get('id')
                item_name = item.get('item_name', '')
                
                # 装備スロットが設定されている場合はそのまま、そうでない場合はnull
                slot_value = equipped_slot if equipped_slot in ['backpack', 'rig'] else None
                
                # アーマーの場合、初期耐久値を設定
                armor_durability = None
                if item_type == 'armor':
                    from item_data import ARMOR_DATA
                    armor_data = ARMOR_DATA.get(item_name)
                    if armor_data:
                        armor_durability = item.get('armor_durability')
                        if armor_durability is None:
                            armor_durability = armor_data['durability']
                
                # ヘルメットの場合、初期耐久値を設定
                helmet_durability = None
                if item_type == 'helmet':
                    from item_data import HELMET_DATA
                    helmet_data = HELMET_DATA.get(item_name)
                    if helmet_data:
                        helmet_durability = item.get('helmet_durability')
                        if helmet_durability is None:
                            helmet_durability = helmet_data['durability']
                
                cursor.execute('''
                    INSERT INTO items (user_id, item_type, item_name, grid_x, grid_y, 
                                     width, height, equipped_slot, quantity, parent_item_id, ammo_stack, rig_slot_x, rig_slot_y, weapon_durability, armor_durability, helmet_durability)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    session['user_id'],
                    item_type,
                    item_name,
                    item.get('grid_x'),
                    item.get('grid_y'),
                    item.get('width', 1),
                    item.get('height', 1),
                    slot_value,
                    item.get('quantity', 1),
                    None,
                    item.get('ammo_stack'),
                    item.get('rig_slot_x'),
                    item.get('rig_slot_y'),
                    item.get('weapon_durability', 100),
                    armor_durability,
                    helmet_durability
                ))
                new_id = cursor.lastrowid
                if old_id:
                    id_mapping[old_id] = new_id
                # アイテム名と装備スロットの組み合わせでマッピング（装備中の場合のみ）
                if slot_value:
                    name_slot_mapping[(item_name, slot_value)] = new_id
            
            # 武器の場合（装備中の場合のみ）
            elif item_type == 'weapon' and equipped_slot in ['primary', 'secondary']:
                old_id = item.get('id')
                item_name = item.get('item_name', '')
                
                # アーマーの場合、初期耐久値を設定
                armor_durability = None
                if item_type == 'armor':
                    from item_data import ARMOR_DATA
                    armor_data = ARMOR_DATA.get(item_name)
                    if armor_data:
                        armor_durability = item.get('armor_durability')
                        if armor_durability is None:
                            armor_durability = armor_data['durability']
                
                # ヘルメットの場合、初期耐久値を設定
                helmet_durability = None
                if item_type == 'helmet':
                    from item_data import HELMET_DATA
                    helmet_data = HELMET_DATA.get(item_name)
                    if helmet_data:
                        helmet_durability = item.get('helmet_durability')
                        if helmet_durability is None:
                            helmet_durability = helmet_data['durability']
                
                cursor.execute('''
                    INSERT INTO items (user_id, item_type, item_name, grid_x, grid_y, 
                                     width, height, equipped_slot, quantity, parent_item_id, ammo_stack, rig_slot_x, rig_slot_y, weapon_durability, armor_durability, helmet_durability)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    session['user_id'],
                    item_type,
                    item_name,
                    item.get('grid_x'),
                    item.get('grid_y'),
                    item.get('width', 1),
                    item.get('height', 1),
                    equipped_slot,
                    item.get('quantity', 1),
                    None,
                    item.get('ammo_stack'),
                    item.get('rig_slot_x'),
                    item.get('rig_slot_y'),
                    item.get('weapon_durability', 100),
                    armor_durability,
                    helmet_durability
                ))
                new_id = cursor.lastrowid
                if old_id:
                    id_mapping[old_id] = new_id
                # アイテム名と装備スロットの組み合わせでマッピング
                name_slot_mapping[(item_name, equipped_slot)] = new_id
        
        # 次に、バックパック、リグ、武器以外のアイテムを保存（parent_item_idをマッピング）
        # リグやバックパックの中身のアイテム、武器に装填されているマガジンも保存する
        for item in items:
            item_type = item.get('item_type', '')
            equipped_slot = item.get('equipped_slot')
            
            # バックパック、リグ、武器以外のアイテム、またはリグやバックパックの中身のアイテム、または武器に装填されているマガジン
            if (item_type not in ['backpack', 'rig', 'weapon'] or 
                (equipped_slot not in ['backpack', 'rig', 'primary', 'secondary'] and item.get('parent_item_id')) or
                (item_type == 'weapon' and equipped_slot not in ['primary', 'secondary'])):
                parent_item_id = None
                old_parent_id = item.get('parent_item_id')
                
                if old_parent_id:
                    # まず、IDマッピングで確認
                    if old_parent_id in id_mapping:
                        parent_item_id = id_mapping[old_parent_id]
                    else:
                        # IDマッピングにない場合は、古いparent_item_idを持つアイテムを検索
                        # 削除前に取得した古いアイテム情報から、アイテム名と装備スロットを特定
                        if old_parent_id in old_items:
                            old_parent_name, old_parent_slot = old_items[old_parent_id]
                            
                            # 同じアイテム名と装備スロットの組み合わせで新しいIDを探す
                            if (old_parent_name, old_parent_slot) in name_slot_mapping:
                                parent_item_id = name_slot_mapping[(old_parent_name, old_parent_slot)]
                
                # アーマーの場合、初期耐久値を設定
                armor_durability = None
                if item_type == 'armor':
                    from item_data import ARMOR_DATA
                    armor_data = ARMOR_DATA.get(item.get('item_name', ''))
                    if armor_data:
                        armor_durability = item.get('armor_durability')
                        if armor_durability is None:
                            armor_durability = armor_data['durability']
                
                # ヘルメットの場合、初期耐久値を設定
                helmet_durability = None
                if item_type == 'helmet':
                    from item_data import HELMET_DATA
                    helmet_data = HELMET_DATA.get(item.get('item_name', ''))
                    if helmet_data:
                        helmet_durability = item.get('helmet_durability')
                        if helmet_durability is None:
                            helmet_durability = helmet_data['durability']
                
                cursor.execute('''
                    INSERT INTO items (user_id, item_type, item_name, grid_x, grid_y, 
                                     width, height, equipped_slot, quantity, parent_item_id, ammo_stack, rig_slot_x, rig_slot_y, weapon_durability, armor_durability, helmet_durability)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    session['user_id'],
                    item_type,
                    item.get('item_name', ''),
                    item.get('grid_x'),
                    item.get('grid_y'),
                    item.get('width', 1),
                    item.get('height', 1),
                    equipped_slot,
                    item.get('quantity', 1),
                    parent_item_id,
                    item.get('ammo_stack'),
                    item.get('rig_slot_x'),
                    item.get('rig_slot_y'),
                    item.get('weapon_durability', 100),
                    armor_durability,
                    helmet_durability
                ))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/game/start/pmc', methods=['POST'])
@login_required
def start_pmc_game():
    """PMCゲームを開始（装備アイテムをセッションに保存）"""
    try:
        data = request.get_json()
        equipped_items = data.get('equipped_items', [])
        
        # 装備アイテムをセッションに保存
        session['equipped_items'] = equipped_items
        session['game_mode'] = 'pmc'
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/game/start/scav', methods=['POST'])
@login_required
def start_scav_game():
    """SCAVゲームを開始（ランダムアイテムを生成して装備）"""
    try:
        user_id = session['user_id']
        conn = get_db()
        cursor = conn.cursor()
        
        # 既存の装備アイテムを削除（SCAVモードではプレイヤーの持ち物は持っていけない）
        cursor.execute('DELETE FROM items WHERE user_id = ? AND equipped_slot IS NOT NULL', (user_id,))
        
        # ランダムアイテム生成
        scav_items = generate_scav_items()
        
        # アイテムをデータベースに保存（武器とリグのIDを取得してから子アイテムを保存）
        weapon_id_map = {}  # 仮のID -> 実際のIDのマッピング
        rig_id_map = {}  # 仮のID -> 実際のIDのマッピング
        
        # まず、武器とリグ以外のアイテムを保存
        for item in scav_items:
            if item.get('item_type') not in ('rig', 'weapon') and item.get('parent_item_id') is None:
                cursor.execute('''
                    INSERT INTO items (
                        user_id, item_type, item_name, grid_x, grid_y, width, height,
                        equipped_slot, quantity, parent_item_id, ammo_stack,
                        weapon_durability, armor_durability, helmet_durability
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    item['item_type'],
                    item['item_name'],
                    item.get('grid_x'),
                    item.get('grid_y'),
                    item.get('width', 1),
                    item.get('height', 1),
                    item.get('equipped_slot'),
                    item.get('quantity', 1),
                    None,
                    item.get('ammo_stack'),
                    item.get('weapon_durability'),
                    item.get('armor_durability'),
                    item.get('helmet_durability')
                ))
        
        # 次に、武器を保存してIDを取得
        for item in scav_items:
            if item.get('item_type') == 'weapon':
                cursor.execute('''
                    INSERT INTO items (
                        user_id, item_type, item_name, grid_x, grid_y, width, height,
                        equipped_slot, quantity, parent_item_id, ammo_stack,
                        weapon_durability, armor_durability, helmet_durability
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    item['item_type'],
                    item['item_name'],
                    item.get('grid_x'),
                    item.get('grid_y'),
                    item.get('width', 1),
                    item.get('height', 1),
                    item.get('equipped_slot'),
                    item.get('quantity', 1),
                    None,
                    item.get('ammo_stack'),
                    item.get('weapon_durability'),
                    item.get('armor_durability'),
                    item.get('helmet_durability')
                ))
                if 'temp_id' in item:
                    weapon_id_map[item['temp_id']] = cursor.lastrowid
        
        # 次に、リグを保存してIDを取得
        for item in scav_items:
            if item.get('item_type') == 'rig':
                cursor.execute('''
                    INSERT INTO items (
                        user_id, item_type, item_name, grid_x, grid_y, width, height,
                        equipped_slot, quantity, parent_item_id, ammo_stack,
                        weapon_durability, armor_durability, helmet_durability
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    user_id,
                    item['item_type'],
                    item['item_name'],
                    item.get('grid_x'),
                    item.get('grid_y'),
                    item.get('width', 1),
                    item.get('height', 1),
                    item.get('equipped_slot'),
                    item.get('quantity', 1),
                    None,
                    item.get('ammo_stack'),
                    item.get('weapon_durability'),
                    item.get('armor_durability'),
                    item.get('helmet_durability')
                ))
                if 'temp_id' in item:
                    rig_id_map[item['temp_id']] = cursor.lastrowid
        
        # 最後に、武器とリグの子アイテム（マガジン、弾薬）を保存
        for item in scav_items:
            if item.get('parent_item_id') is not None:
                # 武器の子アイテムかリグの子アイテムかを判定
                parent_item_id = weapon_id_map.get(item.get('parent_item_id'))
                if not parent_item_id:
                    parent_item_id = rig_id_map.get(item.get('parent_item_id'))
                
                if parent_item_id:
                    cursor.execute('''
                        INSERT INTO items (
                            user_id, item_type, item_name, grid_x, grid_y, width, height,
                            equipped_slot, quantity, parent_item_id, ammo_stack,
                            weapon_durability, armor_durability, helmet_durability
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        user_id,
                        item['item_type'],
                        item['item_name'],
                        item.get('grid_x'),
                        item.get('grid_y'),
                        item.get('width', 1),
                        item.get('height', 1),
                        item.get('equipped_slot'),
                        item.get('quantity', 1),
                        parent_item_id,
                        item.get('ammo_stack'),
                        item.get('weapon_durability'),
                        item.get('armor_durability'),
                        item.get('helmet_durability')
                    ))
        
        conn.commit()
        conn.close()
        
        # ゲームモードをセッションに保存
        session['game_mode'] = 'scav'
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


def generate_scav_items():
    """SCAVモード用のランダムアイテムを生成"""
    items = []
    
    # 1. ランダムに武器を選択（レアリティを考慮）
    weapon = select_random_item_by_rarity(WEAPON_RARITY_ORDER, 'weapon')
    weapon_durability = random.randint(0, 100)  # 0-100%の間でランダム
    weapon_temp_id = 0  # 仮のID（実際のIDはデータベースで生成される）
    items.append({
        'item_type': 'weapon',
        'item_name': weapon,
        'equipped_slot': 'primary',
        'weapon_durability': weapon_durability,
        'width': ITEM_SIZE_DATA.get(weapon, {}).get('width', 5),
        'height': ITEM_SIZE_DATA.get(weapon, {}).get('height', 2),
        'temp_id': weapon_temp_id
    })
    
    # 2. 武器に対応するマガジンを3つ選択
    compatible_magazines = WEAPON_MAGAZINE_MAP.get(weapon, [])
    if compatible_magazines:
        # マガジンをランダムに選択（レアリティを考慮）
        selected_magazines = []
        for _ in range(3):
            magazine = select_random_item_by_rarity(compatible_magazines, 'magazine')
            if magazine:
                selected_magazines.append(magazine)
        
        # マガジンに対応する弾薬を選択（ランダム）
        if selected_magazines:
            caliber = MAGAZINE_CALIBER_MAP.get(selected_magazines[0], '')
            # 弾薬名に口径が含まれているかで判定
            compatible_ammo = []
            for ammo in AMMO_RARITY_ORDER:
                # 口径を正規化して比較
                normalized_caliber = caliber.replace(' ', '').replace('.', '').lower()
                normalized_ammo = ammo.replace(' ', '').replace('.', '').lower()
                if normalized_caliber in normalized_ammo:
                    compatible_ammo.append(ammo)
            
            if compatible_ammo:
                # ランダムに弾薬を選択（レアリティを考慮）
                selected_ammo = select_random_item_by_rarity(compatible_ammo, 'ammo')
                if selected_ammo:
                    # マガジンの容量を取得
                    magazine_capacity = MAGAZINE_CAPACITY_MAP.get(selected_magazines[0], 30)
                    
                    # 武器に装填するマガジン（最初の1つ）に最大容量までランダムな弾薬を装填
                    weapon_magazine = selected_magazines[0]
                    weapon_magazine_ammo_stack = json.dumps([{
                        'type': selected_ammo,
                        'count': magazine_capacity
                    }])
                    items.append({
                        'item_type': 'magazine',
                        'item_name': weapon_magazine,
                        'equipped_slot': None,
                        'parent_item_id': weapon_temp_id,  # 武器に装填
                        'grid_x': None,  # 武器に装填されていることを示す
                        'grid_y': None,
                        'quantity': magazine_capacity,
                        'ammo_stack': weapon_magazine_ammo_stack,
                        'width': ITEM_DEFINITIONS.get(weapon_magazine, {}).get('width', 1),
                        'height': ITEM_DEFINITIONS.get(weapon_magazine, {}).get('height', 2)
                    })
                    
                    # 残りのマガジンはリグに入れる
                    remaining_magazines = selected_magazines[1:]
                    
                    # リグを先に生成（マガジンをリグに入れるため）
                    rig = select_random_item_by_rarity(list(RIG_SIZE_DATA.keys()), 'rig')
                    rig_temp_id = len(items)  # 仮のID（実際のIDはデータベースで生成される）
                    items.append({
                        'item_type': 'rig',
                        'item_name': rig,
                        'equipped_slot': 'rig',
                        'width': RIG_SIZE_DATA[rig]['width'],
                        'height': RIG_SIZE_DATA[rig]['height'],
                        'temp_id': rig_temp_id
                    })
                    
                    # マガジンをリグに入れる（リグのスロットに配置）
                    rig_data = RIG_SIZE_DATA[rig]
                    rig_slots = []
                    for y in range(rig_data['height']):
                        for x in range(rig_data['width']):
                            rig_slots.append((x, y))
                    
                    magazine_slot_index = 0
                    for magazine in remaining_magazines:
                        if magazine_slot_index < len(rig_slots):
                            slot = rig_slots[magazine_slot_index]
                            magazine_def = ITEM_DEFINITIONS.get(magazine)
                            items.append({
                                'item_type': 'magazine',
                                'item_name': magazine,
                                'equipped_slot': None,
                                'parent_item_id': rig_temp_id,  # 仮のID（後で実際のIDに変換）
                                'grid_x': slot[0],
                                'grid_y': slot[1],
                                'width': magazine_def['width'] if magazine_def else 1,
                                'height': magazine_def['height'] if magazine_def else 2,
                                'quantity': 0,  # 空のマガジン
                                'ammo_stack': None
                            })
                            magazine_slot_index += 1
                    
                    # 3. 残りのマガジン分の弾薬をリグに入れる
                    total_ammo = magazine_capacity * len(remaining_magazines)
                    ammo_def = ITEM_DEFINITIONS.get(selected_ammo)
                    stack_size = ammo_def.get('stack_size', 60) if ammo_def else 60
                    
                    # スタック可能な弾薬をリグに入れる
                    remaining_ammo = total_ammo
                    ammo_slot_index = magazine_slot_index
                    while remaining_ammo > 0 and ammo_slot_index < len(rig_slots):
                        ammo_quantity = min(remaining_ammo, stack_size)
                        slot = rig_slots[ammo_slot_index]
                        items.append({
                            'item_type': 'ammo',
                            'item_name': selected_ammo,
                            'equipped_slot': None,
                            'parent_item_id': rig_temp_id,  # 仮のID（後で実際のIDに変換）
                            'grid_x': slot[0],
                            'grid_y': slot[1],
                            'quantity': ammo_quantity,
                            'width': 1,
                            'height': 1
                        })
                        remaining_ammo -= ammo_quantity
                        ammo_slot_index += 1
    
    # 4. ランダムにバックパックを選択
    backpack = select_random_item_by_rarity(list(BACKPACK_SIZE_DATA.keys()), 'backpack')
    if backpack:
        items.append({
            'item_type': 'backpack',
            'item_name': backpack,
            'equipped_slot': 'backpack',
            'width': BACKPACK_SIZE_DATA[backpack]['width'],
            'height': BACKPACK_SIZE_DATA[backpack]['height']
        })
    
    # 5. ランダムにアーマーを選択
    armor = select_random_item_by_rarity(list(ARMOR_DATA.keys()), 'armor')
    if armor:
        # 0-100%の間でランダム（等しい確率）
        durability_percent = random.randint(0, 100)
        max_durability = ARMOR_DATA[armor]['durability']
        current_durability = int(max_durability * durability_percent / 100)
        items.append({
            'item_type': 'armor',
            'item_name': armor,
            'equipped_slot': 'armor',
            'armor_durability': current_durability,
            'width': ARMOR_DATA[armor]['width'],
            'height': ARMOR_DATA[armor]['height']
        })
    
    # 6. ランダムにヘルメットを選択
    helmet = select_random_item_by_rarity(list(HELMET_DATA.keys()), 'helmet')
    if helmet:
        # 0-100%の間でランダム（等しい確率）
        durability_percent = random.randint(0, 100)
        max_durability = HELMET_DATA[helmet]['durability']
        current_durability = int(max_durability * durability_percent / 100)
        items.append({
            'item_type': 'helmet',
            'item_name': helmet,
            'equipped_slot': 'helmet',
            'helmet_durability': current_durability,
            'width': HELMET_DATA[helmet]['width'],
            'height': HELMET_DATA[helmet]['height']
        })
    
    # 7. ランダムに医薬品を選択（数もランダム、1-5個）
    medical_count = random.randint(1, 5)
    for _ in range(medical_count):
        medical = select_random_item_by_rarity(MEDICAL_RARITY_ORDER, 'medical')
        if medical:
            medical_def = ITEM_DEFINITIONS.get(medical)
            max_durability = medical_def.get('default_quantity', 1) if medical_def else 1
            # 医薬品の耐久値もランダム（0-100%）
            medical_durability = random.randint(0, 100)
            current_durability = int(max_durability * medical_durability / 100)
            items.append({
                'item_type': 'medical',
                'item_name': medical,
                'equipped_slot': None,
                'quantity': current_durability,
                'width': ITEM_SIZE_DATA.get(medical, {}).get('width', 1),
                'height': ITEM_SIZE_DATA.get(medical, {}).get('height', 1)
            })
    
    return items


def select_random_item_by_rarity(item_list, item_type):
    """レアリティを考慮してランダムにアイテムを選択"""
    if not item_list:
        return None
    
    # アイテムのレアリティランクを取得
    weighted_items = []
    for item_name in item_list:
        definition = ITEM_DEFINITIONS.get(item_name)
        if definition and definition.get('type') == item_type:
            # レアリティランクが高いほど重みを小さく（出現しにくく）
            rarity_rank = definition.get('rarity_rank', 1)
            rarity_total = definition.get('rarity_total', 1)
            # 重み = (総数 - ランク + 1) / 総数
            weight = (rarity_total - rarity_rank + 1) / rarity_total
            weighted_items.append((item_name, weight))
    
    if not weighted_items:
        # 定義が見つからない場合は等確率
        return random.choice(item_list) if item_list else None
    
    # 重み付きランダム選択
    total_weight = sum(weight for _, weight in weighted_items)
    if total_weight == 0:
        return random.choice(item_list) if item_list else None
    
    r = random.uniform(0, total_weight)
    cumulative = 0
    for item_name, weight in weighted_items:
        cumulative += weight
        if r <= cumulative:
            return item_name
    
    return weighted_items[0][0] if weighted_items else None

@app.route('/api/game/equipped', methods=['GET'])
@login_required
def get_game_equipped_items():
    """ゲーム画面で使用する装備アイテムを取得"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        # 装備アイテムとリグ内のアイテム（parent_item_idが設定されているアイテム）を取得
        cursor.execute('''
            SELECT id, item_type, item_name, grid_x, grid_y, width, height, 
                   equipped_slot, quantity, parent_item_id, ammo_stack, 
                   weapon_durability, armor_durability, helmet_durability
            FROM items 
            WHERE user_id = ? AND (equipped_slot IS NOT NULL OR parent_item_id IS NOT NULL)
        ''', (session['user_id'],))
        items = [dict(row) for row in cursor.fetchall()]
        conn.close()
        game_mode = session.get('game_mode', 'pmc')
        return jsonify({
            'success': True,
            'items': items,
            'game_mode': game_mode
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/game/armor-durability', methods=['POST'])
@login_required
def update_armor_durability():
    """アーマーの耐久値を更新"""
    try:
        data = request.get_json()
        durability = data.get('durability')
        if durability is None:
            return jsonify({'success': False, 'message': '耐久値が指定されていません'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE items 
            SET armor_durability = ? 
            WHERE user_id = ? AND equipped_slot = 'armor'
        ''', (int(durability), session['user_id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/game/helmet-durability', methods=['POST'])
@login_required
def update_helmet_durability():
    """ヘルメットの耐久値を更新"""
    try:
        data = request.get_json()
        durability = data.get('durability')
        if durability is None:
            return jsonify({'success': False, 'message': '耐久値が指定されていません'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE items 
            SET helmet_durability = ? 
            WHERE user_id = ? AND equipped_slot = 'head'
        ''', (int(durability), session['user_id']))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/game')
@login_required
def game():
    return render_template('index.html')

@app.route('/api/game/clear-items', methods=['POST'])
@login_required
def clear_items():
    """ゲームオーバー時に装備中のアイテムを削除（スタッシュは残す）"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # 装備中のアイテム（equipped_slotがnullでない）のIDを取得
        cursor.execute('''
            SELECT id FROM items 
            WHERE user_id = ? AND equipped_slot IS NOT NULL
        ''', (session['user_id'],))
        equipped_item_ids = [row[0] for row in cursor.fetchall()]
        
        if equipped_item_ids:
            # 装備中のアイテムと、その中に入っているアイテム（再帰的に）を削除
            # まず、装備中のアイテムのIDリストを作成
            ids_to_delete = set(equipped_item_ids)
            
            # 再帰的に中身のアイテムを取得
            while True:
                # 現在のIDリストに含まれるアイテムを親として持つアイテムを検索
                placeholders = ','.join(['?'] * len(ids_to_delete))
                cursor.execute(f'''
                    SELECT id FROM items 
                    WHERE user_id = ? AND parent_item_id IN ({placeholders})
                ''', [session['user_id']] + list(ids_to_delete))
                child_ids = [row[0] for row in cursor.fetchall()]
                
                # 新しい子アイテムが見つからなければ終了
                new_ids = set(child_ids) - ids_to_delete
                if not new_ids:
                    break
                ids_to_delete.update(new_ids)
            
            # すべての削除対象アイテムを削除
            if ids_to_delete:
                placeholders = ','.join(['?'] * len(ids_to_delete))
                cursor.execute(f'''
                    DELETE FROM items 
                    WHERE user_id = ? AND id IN ({placeholders})
                ''', [session['user_id']] + list(ids_to_delete))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': '装備中のアイテムを削除しました。'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# アプリケーション起動時にデータベースを初期化
if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
