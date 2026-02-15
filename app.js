// Global variables
let socket = null;
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let currentRound = null;
let hasBet = false;
let hasCashedOut = false;
let gameState = 'waiting';
let multiplier = 1.00;

// API base URL
const API_BASE = window.location.origin;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Check for payment status in URL
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const amount = urlParams.get('amount');
    
    if (status === 'success') {
        showToast(`Deposit successful! ₦${amount} added to your wallet`, 'success');
        window.history.replaceState({}, document.title, '/');
    } else if (status === 'failed') {
        showToast('Deposit failed. Please try again.', 'error');
        window.history.replaceState({}, document.title, '/');
    }

    // Check if user is logged in
    if (token && user) {
        showGameScreen();
        connectSocket();
        loadUserData();
        loadBetHistory();
    } else {
        showAuthScreen();
    }
});

// Auth functions
function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelector('.tab-btn:first-child').classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelector('.tab-btn:last-child').classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            user = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            showToast('Registration successful!', 'success');
            showGameScreen();
            connectSocket();
            loadUserData();
        } else {
            showError(data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('Registration failed. Please try again.');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            token = data.token;
            user = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            showToast('Login successful!', 'success');
            showGameScreen();
            connectSocket();
            loadUserData();
        } else {
            showError(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed. Please try again.');
    }
}

function logout() {
    if (socket) {
        socket.disconnect();
    }
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    user = null;
    
    showAuthScreen();
    showToast('Logged out successfully', 'info');
}

// Screen management
function showAuthScreen() {
    document.getElementById('authScreen').classList.add('active');
    document.getElementById('gameScreen').classList.remove('active');
}

function showGameScreen() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('gameScreen').classList.add('active');
    
    if (user) {
        document.getElementById('username').textContent = user.username;
        updateBalance(user.wallet_balance);
    }
}

// Socket.io connection
function connectSocket() {
    socket = io(API_BASE, {
        auth: { token }
    });
    
    socket.on('connect', () => {
        console.log('Connected to game server');
    });
    
    socket.on('gameState', (data) => {
        gameState = data.state;
        currentRound = data.roundId;
        updateGameUI(data);
    });
    
    socket.on('countdown', (data) => {
        updateStatus(`Round starting in ${data.countdown}s...`);
    });
    
    socket.on('multiplier', (data) => {
        multiplier = data.multiplier;
        updateMultiplier(data.multiplier);
    });
    
    socket.on('betPlaced', (data) => {
        hasBet = true;
        updateBetStatus(`Bet placed: ₦${data.bet.amount}`, 'success');
        document.getElementById('placeBetBtn').disabled = true;
        loadUserData();
    });
    
    socket.on('cashedOut', (data) => {
        hasCashedOut = true;
        updateBetStatus(`Cashed out at ${data.multiplier}x! Won: ₦${data.winAmount.toFixed(2)}`, 'success');
        document.getElementById('cashOutBtn').disabled = true;
        updateBalance(data.balance);
        loadBetHistory();
    });
    
    socket.on('playerBet', (data) => {
        addLiveBet(`${data.username} bet ₦${data.amount}`);
    });
    
    socket.on('playerCashedOut', (data) => {
        addLiveBet(`${data.username} cashed out at ${data.multiplier}x - ₦${data.winAmount.toFixed(2)}`, 'success');
    });
    
    socket.on('error', (data) => {
        showToast(data.message, 'error');
        updateBetStatus(data.message, 'error');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from game server');
    });
}

// Game UI updates
function updateGameUI(data) {
    gameState = data.state;
    
    switch(data.state) {
        case 'waiting':
            updateStatus('Waiting for next round...');
            updateMultiplier(1.00);
            resetGameUI();
            break;
            
        case 'countdown':
            updateStatus('Place your bets!');
            document.getElementById('placeBetBtn').disabled = false;
            break;
            
        case 'running':
            updateStatus('Game in progress!');
            document.getElementById('placeBetBtn').disabled = true;
            
            if (hasBet && !hasCashedOut) {
                document.getElementById('cashOutBtn').disabled = false;
            }
            
            const display = document.getElementById('multiplierDisplay');
            display.classList.add('active');
            display.classList.remove('crashed');
            break;
            
        case 'crashed':
            updateStatus('CRASHED!');
            document.getElementById('crashMessage').textContent = `Crashed at ${data.crashPoint}x`;
            
            const crashDisplay = document.getElementById('multiplierDisplay');
            crashDisplay.classList.remove('active');
            crashDisplay.classList.add('crashed');
            
            addCrashHistory(data.crashPoint);
            
            setTimeout(() => {
                document.getElementById('crashMessage').textContent = '';
            }, 3000);
            
            if (hasBet && !hasCashedOut) {
                updateBetStatus('Bet lost!', 'error');
            }
            
            loadBetHistory();
            break;
    }
}

function resetGameUI() {
    hasBet = false;
    hasCashedOut = false;
    document.getElementById('placeBetBtn').disabled = false;
    document.getElementById('cashOutBtn').disabled = true;
    document.getElementById('betStatus').textContent = '';
    document.getElementById('betStatus').className = 'bet-status';
    
    const display = document.getElementById('multiplierDisplay');
    display.classList.remove('active', 'crashed');
}

function updateStatus(message) {
    document.getElementById('gameStatus').textContent = message;
}

function updateMultiplier(value) {
    document.getElementById('multiplierDisplay').textContent = value.toFixed(2) + 'x';
}

function updateBetStatus(message, type) {
    const status = document.getElementById('betStatus');
    status.textContent = message;
    status.className = `bet-status ${type}`;
}

function updateBalance(balance) {
    document.getElementById('balance').textContent = `₦${parseFloat(balance).toFixed(2)}`;
}

// Game actions
function setBetAmount(amount) {
    document.getElementById('betAmount').value = amount;
}

async function placeBet() {
    const amount = parseFloat(document.getElementById('betAmount').value);
    
    if (gameState !== 'countdown') {
        showToast('Can only place bets during countdown', 'error');
        return;
    }
    
    if (amount < 10 || amount > 10000) {
        showToast('Bet must be between ₦10 and ₦10,000', 'error');
        return;
    }
    
    if (hasBet) {
        showToast('You already have a bet in this round', 'error');
        return;
    }
    
    socket.emit('placeBet', { amount });
}

function cashOut() {
    if (gameState !== 'running') {
        showToast('Can only cash out during game', 'error');
        return;
    }
    
    if (!hasBet) {
        showToast('No active bet', 'error');
        return;
    }
    
    if (hasCashedOut) {
        showToast('Already cashed out', 'error');
        return;
    }
    
    socket.emit('cashOut');
}

// Live feed
function addLiveBet(message, type = 'bet') {
    const container = document.getElementById('liveBets');
    const item = document.createElement('div');
    item.className = 'live-bet-item';
    item.innerHTML = `
        <span>${message}</span>
        <span style="color: ${type === 'success' ? '#48bb78' : '#667eea'}">●</span>
    `;
    
    container.insertBefore(item, container.firstChild);
    
    // Keep only last 10 items
    while (container.children.length > 10) {
        container.removeChild(container.lastChild);
    }
}

// Crash history
function addCrashHistory(crashPoint) {
    const container = document.getElementById('recentCrashes');
    const badge = document.createElement('div');
    badge.className = `crash-badge ${getCrashClass(crashPoint)}`;
    badge.textContent = crashPoint.toFixed(2) + 'x';
    
    container.insertBefore(badge, container.firstChild);
    
    // Keep only last 15 crashes
    while (container.children.length > 15) {
        container.removeChild(container.lastChild);
    }
}

function getCrashClass(value) {
    if (value < 2) return 'low';
    if (value < 5) return 'medium';
    return 'high';
}

// User data
async function loadUserData() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            user = data;
            localStorage.setItem('user', JSON.stringify(user));
            updateBalance(data.wallet_balance);
        }
    } catch (error) {
        console.error('Load user data error:', error);
    }
}

// Bet history
async function loadBetHistory() {
    try {
        const response = await fetch(`${API_BASE}/api/game/history?limit=10`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayBetHistory(data.bets);
        }
    } catch (error) {
        console.error('Load bet history error:', error);
    }
}

function displayBetHistory(bets) {
    const container = document.getElementById('betHistory');
    
    if (bets.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #718096;">No bet history yet</p>';
        return;
    }
    
    container.innerHTML = bets.map(bet => `
        <div class="history-item ${bet.status}">
            <div>
                <strong>₦${bet.amount.toFixed(2)}</strong>
            </div>
            <div>
                Crash: ${bet.crashPoint ? bet.crashPoint.toFixed(2) + 'x' : '-'}
            </div>
            <div>
                ${bet.cashedOutAt ? 'Out: ' + bet.cashedOutAt.toFixed(2) + 'x' : '-'}
            </div>
            <div>
                <strong style="color: ${bet.profit >= 0 ? '#48bb78' : '#f56565'}">
                    ${bet.profit >= 0 ? '+' : ''}₦${bet.profit.toFixed(2)}
                </strong>
            </div>
            <div>
                <span class="badge">${bet.status}</span>
            </div>
        </div>
    `).join('');
}

// Deposit modal
function showDepositModal() {
    document.getElementById('depositModal').classList.add('active');
}

function closeDepositModal() {
    document.getElementById('depositModal').classList.remove('active');
}

function setDepositAmount(amount) {
    document.getElementById('depositAmount').value = amount;
}

async function handleDeposit(event) {
    event.preventDefault();
    
    const amount = parseFloat(document.getElementById('depositAmount').value);
    
    if (amount < 100) {
        showToast('Minimum deposit is ₦100', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/payment/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                amount,
                email: user.email
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeDepositModal();
            
            // Initialize Paystack payment
            const handler = PaystackPop.setup({
                key: 'pk_test_your_public_key_here', // This should come from server
                email: user.email,
                amount: amount * 100,
                ref: data.reference,
                onClose: function() {
                    showToast('Payment cancelled', 'info');
                },
                callback: function(response) {
                    showToast('Processing payment...', 'info');
                    // Payment will be verified via webhook and redirect
                    window.location.href = `${API_BASE}/api/payment/verify?reference=${response.reference}`;
                }
            });
            
            handler.openIframe();
        } else {
            showToast(data.error || 'Failed to initialize payment', 'error');
        }
    } catch (error) {
        console.error('Deposit error:', error);
        showToast('Failed to initialize payment', 'error');
    }
}

// Utility functions
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showError(message) {
    const errorDiv = document.getElementById('authError');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}
