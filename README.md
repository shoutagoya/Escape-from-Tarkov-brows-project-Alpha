# EFT - Escape from Tarkov 3D Game

Flaskを使用した3Dゲーム（EFT風）

## セットアップ

1. 依存関係のインストール:
```bash
pip install -r requirements.txt
```

2. アプリケーションの起動:
```bash
python app.py
```

3. ブラウザで `http://localhost:5000` にアクセス

## 操作方法

- **WASD**: 移動
- **マウス**: 視点操作（画面をクリックしてポインターをロック）
- **Space**: ジャンプ

## 機能

- 3Dゲーム環境（Three.js使用）
- プレイヤー移動と視点操作
- 敵AI（プレイヤーを追いかける）
- 当たり判定システム
- UI要素（体力、武器、残弾数、マップ）

