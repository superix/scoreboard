// Receiver Logic
const context = cast.framework.CastReceiverContext.getInstance();
const NAMESPACE = 'urn:x-cast:com.score.board';

const receiverState = {
    currentScreen: 'waiting-screen',
    game: null
};

// Initialize
// context.addCustomMessageListener(NAMESPACE, function(customEvent) {
//     console.log('Received message:', customEvent);
//     // customEvent.data is the payload
//     handleMessage(customEvent.data);
// });

// We can also use logic to handle connect/disconnect
context.start();

// Need to listen to custom channel
const options = new cast.framework.CastReceiverOptions();
options.customNamespaces = Object.assign({});
options.customNamespaces[NAMESPACE] = cast.framework.system.MessageType.JSON;

context.addCustomMessageListener(NAMESPACE, (event) => {
    // console.log('Message arrived', event);
    handleMessage(event.data);
});

// Debug
document.getElementById('debug-info').textContent = 'Receiver Ready. Waiting for signals...';

function handleMessage(data) {
    // Data structure expected: { type: 'game-state', game: ... }
    if (data.type === 'game-state') {
        receiverState.game = data.game;
        if (receiverState.game.winner) {
            showWinnerScreen();
        } else {
            showGameDisplay();
        }
    } else if (data.type === 'ping') {
        // Keep alive or handshake
    }
}

// Screen Logic (Adapted from tablet.js)
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        receiverState.currentScreen = screenId;
    }
}

function showGameDisplay() {
    showScreen('game-display-screen');
    renderGameDisplay();
}

function showWinnerScreen() {
    showScreen('winner-screen');
    renderWinnerScreen();
}

function renderGameDisplay() {
    if (!receiverState.game) return;

    const container = document.getElementById('tablet-players-container');
    container.innerHTML = '';

    // Add class for 6 players layout to scale down fonts
    if (receiverState.game.players.length >= 5) {
        container.classList.add('six-players');
    } else {
        container.classList.remove('six-players');
    }

    receiverState.game.players.forEach((player, index) => {
        const card = document.createElement('div');
        card.className = 'tablet-player-card';

        if (index === receiverState.game.currentPlayerIndex) {
            card.classList.add('active');
        }

        card.style.setProperty('--player-color', player.color);

        // Format history
        const historyText = formatHistory(player.history);
        const scoreDisplay = player.hasWon ? 'WIN' : player.score;

        card.innerHTML = `
            <div class="tablet-player-name">${player.name}</div>
            <div class="tablet-player-score">${scoreDisplay}</div>
            <div class="tablet-player-history">${historyText}</div>
        `;

        container.appendChild(card);
    });
}

function formatHistory(history) {
    if (!history || history.length === 0) return '';
    // Extract just the added scores
    const scores = history.map(h => typeof h === 'object' ? h.added : h);
    // Show last 6 scores
    const maxScores = 6;
    const displayHistory = scores.slice(-maxScores);
    return displayHistory.join(' ');
}

function renderWinnerScreen() {
    if (!receiverState.game || !receiverState.game.winner) return;

    const winnerContainer = document.getElementById('winner-info');
    const othersContainer = document.getElementById('other-players-container');
    const winner = receiverState.game.winner;

    // Render main winner card
    winnerContainer.style.setProperty('--player-color', winner.color);
    const scoreDisplay = winner.hasWon ? 'WIN' : winner.score;
    winnerContainer.innerHTML = `
        <div class="winner-player-name">${winner.name}</div>
        <div class="winner-player-score">${scoreDisplay}</div>
    `;

    // Render non-winner player cards
    othersContainer.innerHTML = '';
    const otherPlayers = receiverState.game.players.filter(p => p.name !== winner.name); // Simple name check or id if available

    otherPlayers.forEach(player => {
        const card = document.createElement('div');
        card.className = 'other-player-card';
        card.style.setProperty('--player-color', player.color);

        const playerScoreDisplay = player.hasWon ? 'WIN' : player.score;

        card.innerHTML = `
            <div class="other-player-name">${player.name}</div>
            <div class="other-player-score">${playerScoreDisplay}</div>
        `;

        othersContainer.appendChild(card);
    });
}
