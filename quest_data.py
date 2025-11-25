def _deliver_task(task_id, name, giver, description, item_name, quantity, hint,
                  reward_currency, reward_exp, reward_desc):
    return {
        'id': task_id,
        'name': name,
        'giver': giver,
        'description': description,
        'objective': {
            'type': 'deliver',
            'item_name': item_name,
            'quantity': quantity,
            'hint': hint
        },
        'rewards': {
            'currency': reward_currency,
            'exp': reward_exp,
            'description': reward_desc
        }
    }


def _build_tasks(default_giver, default_description, default_hint, default_reward_desc, specs):
    tasks = []
    for spec in specs:
        description = spec.get('description') or default_description.format(
            item=spec['item'], quantity=spec['quantity']
        )
        hint = spec.get('hint') or default_hint
        reward_desc = spec.get('reward_desc') or default_reward_desc
        tasks.append(
            _deliver_task(
                spec['id'],
                spec['name'],
                spec.get('giver', default_giver),
                description,
                spec['item'],
                spec['quantity'],
                hint,
                spec['currency'],
                spec['exp'],
                reward_desc
            )
        )
    return tasks


THERAPIST_SPECS = [
    {
        'id': 'shortage',
        'name': 'Shortage',
        'item': 'Salewa first aid kit (Salewa)',
        'quantity': 3,
        'currency': 45000,
        'exp': 3200,
        'description': 'レイドでSalewa救急キットを3つ見つけ、トレーダーに納品してください。',
        'hint': '医療品スポーンやメディカルバッグから見つかります。',
        'reward_desc': 'Therapistの信頼が向上します。'
    },
    {
        'id': 'painkiller',
        'name': 'Painkiller',
        'item': 'Analgin painkillers (Analgin)',
        'quantity': 4,
        'currency': 30000,
        'exp': 2900,
        'description': 'Analgin鎮痛剤を4つ揃えて納品し、鎮痛薬備蓄を確保しましょう。',
        'hint': '雑貨棚や救急車の中で見つかりやすい物資です。',
        'reward_desc': 'Therapistのタスクが次に進行します。'
    },
    {
        'id': 'first_aid_training',
        'name': 'First Aid Training',
        'item': 'Aseptic bandage (Bandage)',
        'quantity': 5,
        'currency': 20000,
        'exp': 2200,
        'description': 'Aseptic bandageを5つ納品して、応急手当の訓練用に提供してください。',
        'hint': '医療バッグやロッカー、救急箱での発見率が高いです。',
        'reward_desc': '追加の医療系タスクが解放されます。'
    },
    {
        'id': 'therapist_triage_drills',
        'name': 'Triage Drills',
        'item': 'Car first aid kit',
        'quantity': 4,
        'currency': 38000,
        'exp': 3000,
        'reward_desc': '救急要員との取引が拡大します。'
    },
    {
        'id': 'therapist_fracture_response',
        'name': 'Fracture Response',
        'item': 'Immobilizing splint (Splint)',
        'quantity': 4,
        'currency': 26000,
        'exp': 2400
    },
    {
        'id': 'therapist_splint_drive',
        'name': 'Aluminum Splint Drive',
        'item': 'Aluminum splint',
        'quantity': 4,
        'currency': 28000,
        'exp': 2500
    },
    {
        'id': 'therapist_bandage_aid',
        'name': 'Bandage Aid',
        'item': 'Army bandage',
        'quantity': 8,
        'currency': 32000,
        'exp': 2600
    },
    {
        'id': 'therapist_calok_delivery',
        'name': 'CALOK Delivery',
        'item': 'CALOK-B hemostatic applicator',
        'quantity': 3,
        'currency': 36000,
        'exp': 3000
    },
    {
        'id': 'therapist_tourniquet_order',
        'name': 'Tourniquet Order',
        'item': 'CAT hemostatic tourniquet',
        'quantity': 5,
        'currency': 34000,
        'exp': 2800
    },
    {
        'id': 'therapist_afak_supply',
        'name': 'AFAK Supply',
        'item': 'AFAK tactical individual first aid kit',
        'quantity': 2,
        'currency': 42000,
        'exp': 3300
    },
    {
        'id': 'therapist_ifak_supply',
        'name': 'IFAK Supply',
        'item': 'IFAK individual first aid kit',
        'quantity': 3,
        'currency': 36000,
        'exp': 3000
    },
    {
        'id': 'therapist_ai2_relief',
        'name': 'AI-2 Relief',
        'item': 'AI-2 medkit (AI-2)',
        'quantity': 8,
        'currency': 24000,
        'exp': 2100
    },
    {
        'id': 'therapist_surgical_support',
        'name': 'Surgical Support',
        'item': 'Surv12 field surgical kit',
        'quantity': 1,
        'currency': 50000,
        'exp': 3600,
        'reward_desc': '高度な手術キットの購入が許可されます。'
    },
    {
        'id': 'therapist_cms_backup',
        'name': 'CMS Backup',
        'item': 'CMS surgical kit (CMS)',
        'quantity': 2,
        'currency': 42000,
        'exp': 3200
    },
    {
        'id': 'therapist_grizzly_need',
        'name': 'Grizzly Need',
        'item': 'Grizzly medical kit',
        'quantity': 1,
        'currency': 60000,
        'exp': 4000
    },
    {
        'id': 'therapist_water_convoy',
        'name': 'Water Convoy',
        'item': 'Water',
        'quantity': 10,
        'currency': 22000,
        'exp': 2000
    },
    {
        'id': 'therapist_mre_stock',
        'name': 'MRE Stock',
        'item': 'MRE',
        'quantity': 6,
        'currency': 26000,
        'exp': 2100
    },
    {
        'id': 'therapist_pain_buffer',
        'name': 'Pain Buffer',
        'item': 'Ibuprofen painkillers',
        'quantity': 5,
        'currency': 34000,
        'exp': 2800
    },
    {
        'id': 'therapist_balms_request',
        'name': 'Balms Request',
        'item': 'Golden star balm',
        'quantity': 3,
        'currency': 38000,
        'exp': 3000
    }
]

THERAPIST_TASKS = _build_tasks(
    'セラピスト',
    '{item}を{quantity}個集め、セラピストの医療班に納品してください。',
    '医療バッグや医療倉庫を探索しましょう。',
    'Therapistの医療在庫が拡大します。',
    THERAPIST_SPECS
)

PRAPOR_SPECS = [
    {
        'id': 'prapor_supply_route',
        'name': 'Supply Route',
        'item': 'AK-74M',
        'quantity': 2,
        'currency': 90000,
        'exp': 4200,
        'description': '護衛班へAK-74Mが2丁必要だ。敵装備からでも構わない、状態の良いものを渡せ。',
        'hint': '軍の武器ラックやPMCリーダーが高確率で所持している。',
        'reward_desc': 'Praporからの武器取引枠が拡張される。'
    },
    {
        'id': 'prapor_magazine_cache',
        'name': 'Magazine Cache',
        'item': '5.45x39mm standard 30連マガジン',
        'quantity': 8,
        'currency': 52000,
        'exp': 3100
    },
    {
        'id': 'prapor_ps_stock',
        'name': 'PS Stock',
        'item': '5.45x39mm PS gs',
        'quantity': 180,
        'currency': 60000,
        'exp': 3200
    },
    {
        'id': 'prapor_bp_barrel',
        'name': 'BP Barrel',
        'item': '5.45x39mm BP',
        'quantity': 180,
        'currency': 72000,
        'exp': 3600
    },
    {
        'id': 'prapor_bt_defense',
        'name': 'BT Defense',
        'item': '5.45x39mm BT',
        'quantity': 180,
        'currency': 65000,
        'exp': 3300
    },
    {
        'id': 'prapor_pp_line',
        'name': 'PP Line',
        'item': '5.45x39mm PP',
        'quantity': 160,
        'currency': 62000,
        'exp': 3100
    },
    {
        'id': 'prapor_bs_bundle',
        'name': 'BS Bundle',
        'item': '5.45x39mm BS',
        'quantity': 120,
        'currency': 78000,
        'exp': 3800
    },
    {
        'id': 'prapor_ppbs_contract',
        'name': 'PPBS Contract',
        'item': '5.45x39mm PPBS gs Igolnik',
        'quantity': 90,
        'currency': 82000,
        'exp': 4000
    },
    {
        'id': 'prapor_7n40_order',
        'name': '7N40 Order',
        'item': '5.45x39mm 7N40',
        'quantity': 120,
        'currency': 70000,
        'exp': 3500
    },
    {
        'id': 'prapor_prs_training',
        'name': 'PRS Training',
        'item': '5.45x39mm PRS gs',
        'quantity': 200,
        'currency': 54000,
        'exp': 2800
    },
    {
        'id': 'prapor_sp_scav',
        'name': 'Soft Point Donation',
        'item': '5.45x39mm SP',
        'quantity': 160,
        'currency': 58000,
        'exp': 3000
    },
    {
        'id': 'prapor_t_flash',
        'name': 'Tracer Flash',
        'item': '5.45x39mm T gs',
        'quantity': 160,
        'currency': 56000,
        'exp': 2800
    },
    {
        'id': 'prapor_us_subsonic',
        'name': 'Subsonic Case',
        'item': '5.45x39mm US gs',
        'quantity': 200,
        'currency': 60000,
        'exp': 3100
    },
    {
        'id': 'prapor_hp_shipment',
        'name': 'HP Shipment',
        'item': '5.45x39mm HP',
        'quantity': 200,
        'currency': 52000,
        'exp': 2600
    }
]

PRAPOR_TASKS = _build_tasks(
    'プリャポル',
    '{item}を{quantity}発確保し、プリャポルの倉庫に納品してください。',
    '弾薬箱や軍需倉庫を探索しましょう。',
    'Praporの補給ルートが強化されます。',
    PRAPOR_SPECS
)

SKIER_SPECS = [
    {
        'id': 'skier_m4_package',
        'name': 'M4 Package',
        'item': 'M4A1',
        'quantity': 2,
        'currency': 110000,
        'exp': 4600,
        'description': 'カスタムベース用にM4A1を2丁確保して持ち込んでくれ。',
        'hint': '武器ケースや高額PMCから奪取するのが早い。',
        'reward_desc': '米式プラットフォームの取引が拡張される。'
    },
    {
        'id': 'skier_asval_swap',
        'name': 'VAL Swap',
        'item': 'AS VAL',
        'quantity': 2,
        'currency': 120000,
        'exp': 4900
    },
    {
        'id': 'skier_ash12_showcase',
        'name': 'Ash-12 Showcase',
        'item': 'Ash-12',
        'quantity': 1,
        'currency': 150000,
        'exp': 5200
    },
    {
        'id': 'skier_mag_crate',
        'name': '5.56 Mag Crate',
        'item': '5.56x45mm standard 30連マガジン',
        'quantity': 10,
        'currency': 65000,
        'exp': 3500
    },
    {
        'id': 'skier_ssa_ap',
        'name': 'SSA AP Batch',
        'item': '5.56x45mm SSA AP',
        'quantity': 120,
        'currency': 90000,
        'exp': 4200
    },
    {
        'id': 'skier_m995_request',
        'name': 'M995 Request',
        'item': '5.56x45mm M995 (M995)',
        'quantity': 150,
        'currency': 98000,
        'exp': 4500
    },
    {
        'id': 'skier_m855a1_stack',
        'name': 'M855A1 Stack',
        'item': '5.56x45mm M855A1 (M855A1)',
        'quantity': 180,
        'currency': 78000,
        'exp': 3800
    },
    {
        'id': 'skier_m855_delivery',
        'name': 'M855 Delivery',
        'item': '5.56x45mm M855 (M855)',
        'quantity': 180,
        'currency': 64000,
        'exp': 3200
    },
    {
        'id': 'skier_mk318_contract',
        'name': 'Mk318 Contract',
        'item': '5.56x45mm Mk318 Mod 0 (SOFT)',
        'quantity': 160,
        'currency': 82000,
        'exp': 3600
    },
    {
        'id': 'skier_mk255_rrlp',
        'name': 'Mk255 RRLP',
        'item': '5.56x45mm Mk255 Mod 0 (RRLP)',
        'quantity': 160,
        'currency': 76000,
        'exp': 3400
    },
    {
        'id': 'skier_warmageddon_test',
        'name': 'Warmageddon Test',
        'item': '5.56x45mm Warmageddon',
        'quantity': 140,
        'currency': 70000,
        'exp': 3200
    },
    {
        'id': 'skier_hp_dump',
        'name': 'HP Dump',
        'item': '5.56x45mm HP',
        'quantity': 200,
        'currency': 56000,
        'exp': 3000
    },
    {
        'id': 'skier_fmj_buffer',
        'name': 'FMJ Buffer',
        'item': '5.56x45mm FMJ',
        'quantity': 200,
        'currency': 52000,
        'exp': 2800
    },
    {
        'id': 'skier_tracer_mix',
        'name': 'Tracer Mix',
        'item': '5.56x45mm M856 (M856)',
        'quantity': 180,
        'currency': 64000,
        'exp': 3100
    },
    {
        'id': 'skier_m856a1_signal',
        'name': 'M856A1 Signal',
        'item': '5.56x45mm M856A1 (856AI)',
        'quantity': 150,
        'currency': 72000,
        'exp': 3300
    }
]

SKIER_TASKS = _build_tasks(
    'スキアー',
    '{item}を{quantity}単位集め、スキアーの闇取引に渡してください。',
    'PMC武器庫やボスから奪取すると早い。',
    'スキアーのブラックマーケットが拡大します。',
    SKIER_SPECS
)

RAGMAN_SPECS = [
    {
        'id': 'ragman_highcap_drop',
        'name': 'High-Cap Drop',
        'item': '6SH118',
        'quantity': 1,
        'currency': 90000,
        'exp': 3800
    },
    {
        'id': 'ragman_paratus_bundle',
        'name': 'Paratus Bundle',
        'item': 'Paratus',
        'quantity': 2,
        'currency': 82000,
        'exp': 3400
    },
    {
        'id': 'ragman_pilgrim_convoy',
        'name': 'Pilgrim Convoy',
        'item': 'pilgrim',
        'quantity': 2,
        'currency': 78000,
        'exp': 3300
    },
    {
        'id': 'ragman_beta2_supply',
        'name': 'Beta2 Supply',
        'item': 'Beta2',
        'quantity': 2,
        'currency': 60000,
        'exp': 3000
    },
    {
        'id': 'ragman_t20_cache',
        'name': 'T20 Cache',
        'item': 'T20',
        'quantity': 2,
        'currency': 56000,
        'exp': 2800
    },
    {
        'id': 'ragman_daypack_refresh',
        'name': 'Daypack Refresh',
        'item': 'Daypack',
        'quantity': 3,
        'currency': 48000,
        'exp': 2600
    },
    {
        'id': 'ragman_takedown_issue',
        'name': 'Takedown Issue',
        'item': 'Takedown',
        'quantity': 2,
        'currency': 62000,
        'exp': 3000
    },
    {
        'id': 'ragman_mbss_patrol',
        'name': 'MBSS Patrol',
        'item': 'MBSS',
        'quantity': 3,
        'currency': 52000,
        'exp': 2700
    },
    {
        'id': 'ragman_scavbp_drive',
        'name': 'ScavBP Drive',
        'item': 'ScavBP',
        'quantity': 3,
        'currency': 48000,
        'exp': 2500
    },
    {
        'id': 'ragman_vkbo_distribution',
        'name': 'VKBO Distribution',
        'item': 'VKBO',
        'quantity': 4,
        'currency': 42000,
        'exp': 2300
    },
    {
        'id': 'ragman_alpha_line',
        'name': 'Alpha Line',
        'item': 'Alpha',
        'quantity': 2,
        'currency': 70000,
        'exp': 3400
    },
    {
        'id': 'ragman_khamelion_order',
        'name': 'Khamelion Order',
        'item': 'khamelion',
        'quantity': 2,
        'currency': 62000,
        'exp': 3100
    },
    {
        'id': 'ragman_azimut_support',
        'name': 'Azimut Support',
        'item': 'Azimut',
        'quantity': 2,
        'currency': 60000,
        'exp': 3000
    },
    {
        'id': 'ragman_idea_rig_briefing',
        'name': 'IDEA Rig Briefing',
        'item': 'IDEA Rig',
        'quantity': 1,
        'currency': 95000,
        'exp': 4200
    }
]

RAGMAN_TASKS = _build_tasks(
    'ラグマン',
    '{item}を{quantity}個集めてラグマンの倉庫に補充してください。',
    '衣料コンテナやスカブ装備を探索してください。',
    'ラグマンの衣料取引が強化されます。',
    RAGMAN_SPECS
)

JAEGER_SPECS = [
    {'id': 'jaeger_sp6_cache', 'name': 'SP-6 Cache', 'item': '9x39mm SP-6 gs', 'quantity': 120, 'currency': 90000, 'exp': 4200},
    {'id': 'jaeger_bp_study', 'name': 'BP Study', 'item': '9x39mm BP gs', 'quantity': 120, 'currency': 88000, 'exp': 4100},
    {'id': 'jaeger_pab9_field', 'name': 'PAB-9 Field', 'item': '9x39mm PAB-9 gs', 'quantity': 150, 'currency': 76000, 'exp': 3600},
    {'id': 'jaeger_fmj_stock', 'name': 'FMJ Stockpile', 'item': '9x39mm FMJ', 'quantity': 150, 'currency': 62000, 'exp': 3000},
    {'id': 'jaeger_sp5_marksman', 'name': 'SP-5 Marksman', 'item': '9x39mm SP-5 gs', 'quantity': 150, 'currency': 70000, 'exp': 3200},
    {'id': 'jaeger_spp_contract', 'name': 'SPP Contract', 'item': '9x39mm SPP gs', 'quantity': 120, 'currency': 94000, 'exp': 4300},
    {'id': 'jaeger_flare_red', 'name': 'Red Signal', 'item': 'Red Flare', 'quantity': 4, 'currency': 60000, 'exp': 2600},
    {'id': 'jaeger_flare_yellow', 'name': 'Yellow Signal', 'item': 'Yellow Flare', 'quantity': 6, 'currency': 58000, 'exp': 2500},
    {'id': 'jaeger_flare_green', 'name': 'Green Signal', 'item': 'Green Flare', 'quantity': 8, 'currency': 52000, 'exp': 2400},
    {'id': 'jaeger_ps12a_trial', 'name': 'PS12A Trial', 'item': '12.7x55mm PS12A', 'quantity': 60, 'currency': 92000, 'exp': 4300},
    {'id': 'jaeger_ps12b_barrel', 'name': 'PS12B Barrel', 'item': '12.7x55mm PS12B', 'quantity': 80, 'currency': 110000, 'exp': 4800},
    {'id': 'jaeger_ps12_supply', 'name': 'PS12 Supply', 'item': '12.7x55mm PS12', 'quantity': 80, 'currency': 84000, 'exp': 3900},
    {'id': 'jaeger_marksmanship_drill', 'name': 'Marksmanship Drill', 'item': '5.56x45mm Mk318 Mod 0 (SOFT)', 'quantity': 120, 'currency': 76000, 'exp': 3300},
    {'id': 'jaeger_subsonic_case', 'name': 'Subsonic Case', 'item': '5.45x39mm US gs', 'quantity': 160, 'currency': 68000, 'exp': 3100},
    {'id': 'jaeger_penetrator_bundle', 'name': 'Penetrator Bundle', 'item': '5.45x39mm BS', 'quantity': 100, 'currency': 90000, 'exp': 4100},
    {'id': 'jaeger_warmageddon_cache', 'name': 'Warmageddon Cache', 'item': '5.56x45mm Warmageddon', 'quantity': 120, 'currency': 62000, 'exp': 2900},
    {'id': 'jaeger_hollowpoint_mix', 'name': 'Hollowpoint Mix', 'item': '5.56x45mm HP', 'quantity': 160, 'currency': 54000, 'exp': 2700},
    {'id': 'jaeger_fmj_train', 'name': 'FMJ Train', 'item': '5.56x45mm FMJ', 'quantity': 200, 'currency': 50000, 'exp': 2500},
    {'id': 'jaeger_tracer_signal', 'name': 'Tracer Signal', 'item': '5.56x45mm M856 (M856)', 'quantity': 160, 'currency': 62000, 'exp': 3000},
    {'id': 'jaeger_m995_support', 'name': 'M995 Support', 'item': '5.56x45mm M995 (M995)', 'quantity': 120, 'currency': 88000, 'exp': 3600}
]

JAEGER_TASKS = _build_tasks(
    'イェーガー',
    '{item}を{quantity}発集め、イェーガーの狩猟依頼に使ってください。',
    '森林スタッシュや狩猟小屋を調べてください。',
    'イェーガーとの信頼が深まります。',
    JAEGER_SPECS
)

MECHANIC_SPECS = [
    {'id': 'mechanic_ash12_magazines', 'name': 'Ash-12 Mag Case', 'item': 'Ash-12用 20連マガジン', 'quantity': 6, 'currency': 72000, 'exp': 3200},
    {'id': 'mechanic_val_mags', 'name': 'VAL Drum', 'item': 'AS VAL用 30連マガジン', 'quantity': 6, 'currency': 70000, 'exp': 3100},
    {'id': 'mechanic_val_compact', 'name': 'Compact VAL', 'item': 'AS VAL用15連マガジン', 'quantity': 8, 'currency': 56000, 'exp': 2600},
    {'id': 'mechanic_ash12_compact', 'name': 'Compact Ash-12', 'item': 'Ash-12用 10連マガジン', 'quantity': 8, 'currency': 60000, 'exp': 2800},
    {'id': 'mechanic_556_standard', 'name': '5.56 Standards', 'item': '5.56x45mm standard 30連マガジン', 'quantity': 8, 'currency': 52000, 'exp': 2500},
    {'id': 'mechanic_545_standard', 'name': '5.45 Standards', 'item': '5.45x39mm standard 30連マガジン', 'quantity': 8, 'currency': 48000, 'exp': 2300},
    {'id': 'mechanic_m4_service', 'name': 'M4 Service', 'item': 'M4A1', 'quantity': 1, 'currency': 90000, 'exp': 3600},
    {'id': 'mechanic_val_overhaul', 'name': 'VAL Overhaul', 'item': 'AS VAL', 'quantity': 1, 'currency': 110000, 'exp': 3800}
]

MECHANIC_TASKS = _build_tasks(
    'メカニック',
    '{item}を{quantity}個集めてメカニックの作業台に置いてください。',
    '工場ラインやボス護衛が所持しています。',
    'メカニックの改造依頼が増えます。',
    MECHANIC_SPECS
)

PEACEKEEPER_SPECS = [
    {'id': 'peacekeeper_field_rations', 'name': 'Field Rations', 'item': 'MRE', 'quantity': 8, 'currency': 52000, 'exp': 2600},
    {'id': 'peacekeeper_waterline', 'name': 'Waterline', 'item': 'Water', 'quantity': 10, 'currency': 46000, 'exp': 2300},
    {'id': 'peacekeeper_afak_drop', 'name': 'AFAK Drop', 'item': 'AFAK tactical individual first aid kit', 'quantity': 2, 'currency': 54000, 'exp': 2800},
    {'id': 'peacekeeper_ifak_drop', 'name': 'IFAK Drop', 'item': 'IFAK individual first aid kit', 'quantity': 2, 'currency': 52000, 'exp': 2700},
    {'id': 'peacekeeper_medical_docs', 'name': 'Medical Docs', 'item': 'Augmentin antibiotic pills', 'quantity': 2, 'currency': 42000, 'exp': 2400},
    {'id': 'peacekeeper_balm_supply', 'name': 'Balm Supply', 'item': 'Golden star balm', 'quantity': 2, 'currency': 36000, 'exp': 2200},
    {'id': 'peacekeeper_vaseline_supply', 'name': 'Vaseline Supply', 'item': 'Vaseline balm', 'quantity': 3, 'currency': 32000, 'exp': 2100},
    {'id': 'peacekeeper_ibuprofen_supply', 'name': 'Ibuprofen Supply', 'item': 'Ibuprofen painkillers', 'quantity': 4, 'currency': 42000, 'exp': 2400},
    {'id': 'peacekeeper_salewa_field', 'name': 'Salewa Field', 'item': 'Salewa first aid kit (Salewa)', 'quantity': 2, 'currency': 46000, 'exp': 2600},
    {'id': 'peacekeeper_flare_signal', 'name': 'Flare Signal', 'item': 'Yellow Flare', 'quantity': 4, 'currency': 36000, 'exp': 2000}
]

PEACEKEEPER_TASKS = _build_tasks(
    'ピースキーパー',
    '{item}を{quantity}個集めてピースキーパーの任務に提供してください。',
    '救援物資や医療エリアを探索しましょう。',
    '国連部隊からの信頼が上がります。',
    PEACEKEEPER_SPECS
)

TASK_DEFINITIONS = (
    THERAPIST_TASKS
    + PRAPOR_TASKS
    + SKIER_TASKS
    + RAGMAN_TASKS
    + JAEGER_TASKS
    + MECHANIC_TASKS
    + PEACEKEEPER_TASKS
)


def get_task_definition(task_id):
    for task in TASK_DEFINITIONS:
        if task['id'] == task_id:
            return task
    return None

