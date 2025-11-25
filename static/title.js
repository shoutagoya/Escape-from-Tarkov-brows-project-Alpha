// タイトル画面のJavaScript

// DOM要素の取得
const startButton = document.getElementById('startButton');
const bgSettingsButton = document.getElementById('bgSettingsButton');
const bgModal = document.getElementById('bgModal');
const closeModal = document.querySelector('.close');
const bgImageInput = document.getElementById('bgImageInput');
const applyBgButton = document.getElementById('applyBgButton');
const resetBgButton = document.getElementById('resetBgButton');
const bgPreview = document.getElementById('bgPreview');
const backgroundLayer = document.getElementById('backgroundLayer');

// ローカルストレージから背景画像を読み込む
function loadBackgroundImage() {
    const savedBg = localStorage.getItem('titleBackgroundImage');
    if (savedBg) {
        setBackgroundImage(savedBg);
        bgImageInput.value = savedBg;
        updatePreview(savedBg);
    } else {
        // デフォルトの背景画像を設定
        const defaultBg = '/pic/background/title.png';
        setBackgroundImage(defaultBg);
    }
}

// 背景画像を設定
function setBackgroundImage(imageUrl) {
    if (imageUrl && imageUrl.trim() !== '') {
        backgroundLayer.style.backgroundImage = `url(${imageUrl})`;
        backgroundLayer.style.backgroundSize = 'cover';
        backgroundLayer.style.backgroundPosition = 'center';
        backgroundLayer.style.backgroundRepeat = 'no-repeat';
    } else {
        // デフォルト背景に戻す
        backgroundLayer.style.backgroundImage = '';
    }
}

// プレビューを更新
function updatePreview(imageUrl) {
    if (imageUrl && imageUrl.trim() !== '') {
        bgPreview.style.backgroundImage = `url(${imageUrl})`;
    } else {
        bgPreview.style.backgroundImage = '';
    }
}

// 画像URLの検証
function validateImageUrl(url) {
    if (!url || url.trim() === '') {
        return false;
    }
    
    // 基本的なURL形式チェック
    try {
        new URL(url);
        return true;
    } catch (e) {
        // 相対パスも許可
        return url.startsWith('/') || url.startsWith('./');
    }
}

// 画像が読み込めるかテスト
function testImageLoad(url, callback) {
    const img = new Image();
    img.onload = () => callback(true);
    img.onerror = () => callback(false);
    img.src = url;
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

// スタートボタンのクリックイベント
startButton.addEventListener('click', (e) => {
    // フェードアウトアニメーション
    const content = document.getElementById('content');
    content.style.animation = 'fadeOut 0.5s ease-out forwards';
    
    // ログイン画面に遷移
    setTimeout(() => {
        window.location.href = '/login';
    }, 500);
});

// フェードアウトアニメーションを追加
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(-20px);
        }
    }
`;
document.head.appendChild(style);

// 背景設定ボタンのクリックイベント
bgSettingsButton.addEventListener('click', () => {
    bgModal.style.display = 'block';
    // 現在の背景画像を入力欄に表示
    const currentBg = localStorage.getItem('titleBackgroundImage');
    if (currentBg) {
        bgImageInput.value = currentBg;
        updatePreview(currentBg);
    }
});

// モーダルを閉じる
closeModal.addEventListener('click', () => {
    bgModal.style.display = 'none';
});

// モーダル外をクリックで閉じる
window.addEventListener('click', (event) => {
    if (event.target === bgModal) {
        bgModal.style.display = 'none';
    }
});

// 適用ボタンのクリックイベント
applyBgButton.addEventListener('click', () => {
    const imageUrl = bgImageInput.value.trim();
    
    if (!imageUrl) {
        alert('画像URLを入力してください。');
        return;
    }
    
    if (!validateImageUrl(imageUrl)) {
        alert('有効な画像URLを入力してください。');
        return;
    }
    
    // 画像が読み込めるかテスト
    testImageLoad(imageUrl, (success) => {
        if (success) {
            setBackgroundImage(imageUrl);
            localStorage.setItem('titleBackgroundImage', imageUrl);
            updatePreview(imageUrl);
            alert('背景画像を適用しました。');
        } else {
            alert('画像を読み込めませんでした。URLを確認してください。');
        }
    });
});

// リセットボタンのクリックイベント
resetBgButton.addEventListener('click', () => {
    localStorage.removeItem('titleBackgroundImage');
    const defaultBg = '/pic/background/title.png';
    setBackgroundImage(defaultBg);
    bgImageInput.value = '';
    updatePreview('');
    alert('デフォルト背景に戻しました。');
});

// 入力欄の変更時にプレビューを更新
bgImageInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && validateImageUrl(url)) {
        updatePreview(url);
    } else {
        bgPreview.style.backgroundImage = '';
    }
});

// Enterキーで適用
bgImageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        applyBgButton.click();
    }
});

// ページ読み込み時に背景画像を読み込む
window.addEventListener('DOMContentLoaded', () => {
    loadBackgroundImage();
    addRippleToButtons();
    
    // パーティクルエフェクト（オプション）
    createParticleEffect();
});

// パーティクルエフェクト（装飾用）
function createParticleEffect() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const particleCount = 50;
    
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 1;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;
            this.opacity = Math.random() * 0.5 + 0.2;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
            if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        }
        
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });
        requestAnimationFrame(animate);
    }
    
    animate();
    
    // リサイズ対応
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

