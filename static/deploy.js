// 出撃画面のJavaScript

// DOM要素の取得
const pmcButton = document.getElementById('pmcButton');
const scavButton = document.getElementById('scavButton');
const backButton = document.getElementById('backButton');
const backgroundLayer = document.getElementById('backgroundLayer');

// 背景画像の読み込み
function loadBackgroundImage() {
    const savedBg = localStorage.getItem('titleBackgroundImage');
    if (savedBg) {
        backgroundLayer.style.backgroundImage = `url(${savedBg})`;
        backgroundLayer.style.backgroundSize = 'cover';
        backgroundLayer.style.backgroundPosition = 'center';
        backgroundLayer.style.backgroundRepeat = 'no-repeat';
    }
}

// PMCボタンのクリックイベント
pmcButton.addEventListener('click', async () => {
    try {
        // 装備アイテムを取得
        const response = await fetch('/api/character/equipped');
        const data = await response.json();
        
        if (data.success) {
            // 装備アイテムをセッションに保存してゲーム画面へ遷移
            const gameResponse = await fetch('/game/start/pmc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ equipped_items: data.items })
            });
            
            const gameData = await gameResponse.json();
            if (gameData.success) {
                window.location.href = '/game';
            } else {
                alert('ゲーム開始に失敗しました: ' + gameData.message);
            }
        } else {
            alert('装備アイテムの取得に失敗しました: ' + data.message);
        }
    } catch (error) {
        console.error('エラー:', error);
        alert('エラーが発生しました: ' + error.message);
    }
});

// SCAVボタンのクリックイベント
scavButton.addEventListener('click', async () => {
    try {
        // SCAVモードを開始
        const gameResponse = await fetch('/game/start/scav', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const gameData = await gameResponse.json();
        if (gameData.success) {
            window.location.href = '/game';
        } else {
            alert('SCAVモードの開始に失敗しました: ' + gameData.message);
        }
    } catch (error) {
        console.error('エラー:', error);
        alert('エラーが発生しました: ' + error.message);
    }
});

// 戻るボタンのクリックイベント
backButton.addEventListener('click', () => {
    window.location.href = '/home';
});

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
    loadBackgroundImage();
    addRippleToButtons();
});

