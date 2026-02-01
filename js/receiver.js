// Receiver Logic
try {
    const debugOverlay = document.getElementById('debug-overlay');
    if (debugOverlay) debugOverlay.textContent += ' | js/receiver.js Loaded';

    const context = cast.framework.CastReceiverContext.getInstance();
    const NAMESPACE = 'urn:x-cast:com.score.board';

    const receiverState = {
        currentScreen: 'waiting-screen',
        game: null
    };

    // Define options and custom namespace
    const options = new cast.framework.CastReceiverOptions();
    options.customNamespaces = Object.assign({});
    options.customNamespaces[NAMESPACE] = cast.framework.system.MessageType.JSON;

    // Register listener BEFORE start
    context.addCustomMessageListener(NAMESPACE, (event) => {
        handleMessage(event.data);
    });

    // Also log system events
    context.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED, (event) => {
        if (debugOverlay) debugOverlay.textContent = 'Sender Connected: ' + event.senderId;
    });

    context.addEventListener(cast.framework.system.EventType.SENDER_DISCONNECTED, (event) => {
        if (debugOverlay) debugOverlay.textContent = 'Sender Disconnected';
    });

    // Initialize - triggers the receiver to be ready
    // Must pass options here for custom namespace to work
    context.start(options);
    if (debugOverlay) debugOverlay.textContent += ' | Context Started';


    // Debug
    const infoEl = document.getElementById('debug-info');
    if (infoEl) infoEl.textContent = 'Receiver Ready. Waiting for signals...';

    function handleMessage(data) {
        if (debugOverlay) debugOverlay.textContent = 'Msg received...';

        // Parse if string
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error('JSON Parse error', e);
                if (debugOverlay) debugOverlay.textContent = 'Error parsing message: ' + e.message;
                return;
            }
        }

        // Debug logging
        if (debugOverlay) {
            debugOverlay.textContent = 'Rx: ' + (data.type || 'unknown') + ' ' + new Date().toLocaleTimeString();
        }

        // Data structure expected: { type: 'game-state', game: ... }
        if (data.type === 'game-state') {
            receiverState.game = data.game;

            // Message Handling: Pause State
            // Issue #1: If paused, show waiting screen (or could be specific paused screen)
            if (receiverState.game && receiverState.game.isPaused) {
                showScreen('waiting-screen'); // Or potentially a custom 'paused-screen'
                if (debugOverlay) debugOverlay.textContent = 'Game Paused';
            }
            // Normal Game State
            else if (receiverState.game) {
                if (receiverState.game.winner) {
                    showWinnerScreen();
                } else {
                    showGameDisplay();
                }
            } else {
                // Null game means waiting
                showScreen('waiting-screen');
            }

            // Apply Settings (Rotation)
            // Issue #2: Rotation. Use data.settings if available
            if (data.settings && data.settings.castRotation) {
                receiverState.rotation = data.settings.castRotation;
                updateScale();
            }

        } else if (data.type === 'ping') {
            // Keep alive or handshake
        }
    }

    // Scaling & Rotation Logic (Issue #2 & #3)
    const DESIGN_WIDTH = 1920;
    const DESIGN_HEIGHT = 1080;

    function updateScale() {
        const viewport = document.getElementById('viewport');
        if (!viewport) return;

        // Apply rotation class first
        viewport.classList.remove('rotate-90', 'rotate-270'); // Clean up
        let isRotated = false;

        if (receiverState.rotation === 'portrait-cw') {
            viewport.classList.add('rotate-90');
            isRotated = true;
        } else if (receiverState.rotation === 'portrait-ccw') {
            viewport.classList.add('rotate-270');
            isRotated = true;
        }

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Determine target aspect ratio based on rotation
        // If rotated, the visual width of viewport takes up Height of screen, and visual height takes up Width.
        // Effectively, we are fitting a rectangle of (DW x DH) into (winW x winH).
        // If Rotated: We fit (DH x DW) into (winW x winH).

        let targetW = DESIGN_WIDTH;
        let targetH = DESIGN_HEIGHT;

        if (isRotated) {
            // Swap dimensions for ratio calculation
            targetW = DESIGN_HEIGHT;
            targetH = DESIGN_WIDTH;
        }

        const scaleX = winW / targetW;
        const scaleY = winH / targetH;

        // Fit containment
        const scale = Math.min(scaleX, scaleY); // * 0.95 for safety margin if needed

        viewport.style.transform = `translate(-50%, -50%) ${isRotated ? (receiverState.rotation === 'portrait-cw' ? 'rotate(90deg)' : 'rotate(-90deg)') : ''} scale(${scale})`;
    }

    window.addEventListener('resize', updateScale);
    // Initial call
    updateScale();


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

} catch (err) {
    const errOverlay = document.getElementById('debug-overlay');
    if (errOverlay) errOverlay.textContent = 'CRITICAL JS ERROR: ' + err.message;
}
