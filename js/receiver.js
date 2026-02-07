// Receiver Logic
try {
    const context = cast.framework.CastReceiverContext.getInstance();
    const NAMESPACE = 'urn:x-cast:com.score.board';

    const receiverState = {
        currentScreen: 'waiting-screen',
        game: null
    };

    // Define options and custom namespace
    const options = new cast.framework.CastReceiverOptions();
    options.disableIdleTimeout = true; // Disable timeout when media is not playing
    options.maxInactivity = 1800; // 30 mins (probably not needed)
    options.customNamespaces = Object.assign({});
    options.customNamespaces[NAMESPACE] = cast.framework.system.MessageType.JSON;

    // Register listener BEFORE start
    context.addCustomMessageListener(NAMESPACE, (event) => {
        handleMessage(event.data);
    });

    // Also log system events
    context.addEventListener(cast.framework.system.EventType.SENDER_CONNECTED, (event) => {
        // console.log('Sender Connected: ' + event.senderId);
    });

    context.addEventListener(cast.framework.system.EventType.SENDER_DISCONNECTED, (event) => {
        // console.log('Sender Disconnected');
    });

    // Initialize - triggers the receiver to be ready
    // Must pass options here for custom namespace to work
    context.start(options);

    function handleMessage(data) {

        // Parse if string
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error('JSON Parse error', e);
                return;
            }
        }

        // Data structure expected: { type: 'game-state', game: ... }
        if (data.type === 'game-state') {
            receiverState.game = data.game;

            // Message Handling: Pause State
            // Issue #1: If paused, show waiting screen (or could be specific paused screen)
            if (receiverState.game && receiverState.game.isPaused) {
                showScreen('waiting-screen'); // Or potentially a custom 'paused-screen'
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
            // Apply Settings (Rotation & Localization)
            if (data.settings) {
                if (data.settings.castRotation) {
                    receiverState.rotation = data.settings.castRotation;
                    updateScale();
                }
                if (data.settings.waitingText) {
                    const waitingEl = document.querySelector('.waiting-text');
                    if (waitingEl) waitingEl.textContent = data.settings.waitingText;
                }
            }

        } else if (data.type === 'ping') {
            // Keep alive or handshake - Reply with Pong
            if (event.senderId) {
                context.sendCustomMessage(NAMESPACE, event.senderId, { type: 'pong' });
            }
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
            // Swap dimensions for layout AND scaling
            targetW = DESIGN_HEIGHT;
            targetH = DESIGN_WIDTH;

            // Set explicit size on viewport to force re-flow
            viewport.style.width = targetW + 'px';
            viewport.style.height = targetH + 'px';
            viewport.classList.add('portrait-mode');
        } else {
            // Reset to defaults
            viewport.style.width = DESIGN_WIDTH + 'px';
            viewport.style.height = DESIGN_HEIGHT + 'px';
            viewport.classList.remove('portrait-mode');
        }

        let scaleX, scaleY;

        if (isRotated) {
            // scaleX is how much the "height" of the window can fit the "width" of the design
            scaleX = winH / targetW;

            // scaleY is how much the "width" of the window can fit the "height" of the design
            scaleY = winW / targetH;
        } else {
            scaleX = winW / targetW;
            scaleY = winH / targetH;
        }

        // Fit containment
        // Fit containment with 5% Safety Margin
        const scale = Math.min(scaleX, scaleY) * 0.95;

        // Apply transform
        // Note: When we set width/height to 1080/1920 (Portrait), we are creating a Tall box.
        // If we rotate it 90deg, it becomes Wide.
        // Wait, if content flows for 1080 width, and we verify rotation...
        // If TV is physical portrait, screen is 1080x1920?
        // If Chromecast is landscape (1920x1080), we see sideways.
        // We rotate 90. Box is now upright.
        // Content flows into box.

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

        // Add class for grid layout (4+ players)
        if (receiverState.game.players.length >= 4) {
            container.classList.add('grid-layout');
        } else {
            container.classList.remove('grid-layout');
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

        // Use non-breaking spaces for guaranteed visual separation
        let result = displayHistory.join('&nbsp;&nbsp;&nbsp;');
        if (scores.length > maxScores) {
            result = '...&nbsp;&nbsp;&nbsp;' + result;
        }
        return result;
    }

    function renderWinnerScreen() {
        if (!receiverState.game || !receiverState.game.winner) return;

        const winnerContainer = document.getElementById('winner-info');
        const othersContainer = document.getElementById('other-players-container');
        const winner = receiverState.game.winner;

        // Render main winner card
        winnerContainer.style.setProperty('--player-color', winner.color);
        const scoreDisplay = winner.hasWon ? 'WIN' : winner.score;

        // Match standard card layout for consistency, but bigger
        winnerContainer.innerHTML = `
            <div class="winner-player-name">${winner.name}</div>
            <div class="winner-player-score">${scoreDisplay}</div>
            <div class="winner-label">CHAMPION</div> 
        `;

        // Render non-winner player cards
        othersContainer.innerHTML = '';

        // Sort others by score (descending) to show ranking
        // Note: In 501, higher score is often worse if we are counting down? 
        // Wait, standard darts is countdown 501 -> 0. So LOWEST score is better.
        // Assuming Standard behavior: Sort Ascending for 501/301.
        // But let's check game mode. If `defaultMode` is 'down', lowest is best.
        // If 'up' (Cricket?), highest is best.
        // Receiver might not know logic easily. Let's assume standard sorting by "rank" if available, or just score.
        // For now, let's just show them.

        const otherPlayers = receiverState.game.players
            .filter(p => p.name !== winner.name)
            .sort((a, b) => {
                // User Logic:
                // - increasing score in upcounting mode (a - b)
                // - decreasing score in downcounting mode (b - a)

                if (receiverState.game.mode === 'up') {
                    return a.score - b.score;
                }
                // Default to 'down' logic
                return b.score - a.score;
            });

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
    console.error('CRITICAL JS ERROR: ' + err.message);
}
