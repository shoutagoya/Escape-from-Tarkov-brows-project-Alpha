// ログイン画面のJavaScript

// DOM要素の取得
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginFormElement = document.getElementById('loginFormElement');
const signupFormElement = document.getElementById('signupFormElement');
const tabButtons = document.querySelectorAll('.tab-button');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const signupSuccess = document.getElementById('signupSuccess');
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

// タブ切り替え
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        
        // タブボタンのアクティブ状態を更新
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // フォームパネルの表示を切り替え
        if (tab === 'login') {
            loginForm.classList.add('active');
            signupForm.classList.remove('active');
        } else {
            loginForm.classList.remove('active');
            signupForm.classList.add('active');
        }
        
        // エラーメッセージをクリア
        clearMessages();
    });
});

// メッセージをクリア
function clearMessages() {
    loginError.classList.remove('show');
    signupError.classList.remove('show');
    signupSuccess.classList.remove('show');
    loginError.textContent = '';
    signupError.textContent = '';
    signupSuccess.textContent = '';
}

// エラーメッセージを表示
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

// 成功メッセージを表示
function showSuccess(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

// ログインフォームの送信
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitButton = loginFormElement.querySelector('.submit-button');
    
    if (!username || !password) {
        showError(loginError, 'ユーザー名とパスワードを入力してください。');
        return;
    }
    
    // ローディング状態
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // ログイン成功
            showSuccess(loginError, data.message);
            setTimeout(() => {
                window.location.href = '/home';
            }, 500);
        } else {
            // ログイン失敗
            showError(loginError, data.message || 'ログインに失敗しました。');
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
        }
    } catch (error) {
        showError(loginError, 'ネットワークエラーが発生しました。');
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
    }
});

// サインアップフォームの送信
signupFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value;
    const submitButton = signupFormElement.querySelector('.submit-button');
    
    if (!username || !password) {
        showError(signupError, 'ユーザー名とパスワードを入力してください。');
        return;
    }
    
    if (username.length < 3) {
        showError(signupError, 'ユーザー名は3文字以上で入力してください。');
        return;
    }
    
    if (password.length < 6) {
        showError(signupError, 'パスワードは6文字以上で入力してください。');
        return;
    }
    
    // ローディング状態
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // サインアップ成功
            showSuccess(signupSuccess, data.message);
            setTimeout(() => {
                window.location.href = '/home';
            }, 1000);
        } else {
            // サインアップ失敗
            showError(signupError, data.message || 'アカウント作成に失敗しました。');
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
        }
    } catch (error) {
        showError(signupError, 'ネットワークエラーが発生しました。');
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
    }
});

// 戻るボタン
backButton.addEventListener('click', () => {
    window.location.href = '/';
});

// Enterキーでフォーム送信
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const activeForm = document.querySelector('.form-panel.active form');
        if (activeForm) {
            activeForm.dispatchEvent(new Event('submit'));
        }
    }
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

// ページ読み込み時に背景画像を読み込む
window.addEventListener('DOMContentLoaded', () => {
    loadBackgroundImage();
    addRippleToButtons();
});

