// --- Game State ---
let currentState = {
    score: 0,
    timer: 120, // 2 minutes
    timerInterval: null,
    currentLevelIdx: 0,
    currentClueIdx: 0,
    cluePoints: [10, 7, 5, 3],
    currentAnswer: "",
    isActive: false
};

// --- DOM Elements ---
const screens = {
    start: document.getElementById('start-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen')
};

const ui = {
    timer: document.getElementById('timer'),
    score: document.getElementById('score'),
    clueText: document.getElementById('clue-text'),
    clueLabel: document.querySelector('.clue-label'),
    clueCard: document.getElementById('clue-card'),
    potentialPoints: document.querySelector('#potential-points span'),
    inputContainer: document.getElementById('name-input-container'),
    hiddenInput: document.getElementById('hidden-input'), // Native Input
    finalScore: document.getElementById('final-score'),
    leaderboardList: document.getElementById('leaderboard-list'),
    finalMessage: document.getElementById('final-message'),
    highScoreForm: document.getElementById('high-score-form'),
    playerNameInput: document.getElementById('player-name-input')
};

const startBtn = document.getElementById('start-btn');
const nextClueBtn = document.getElementById('next-clue-btn');
const restartBtn = document.getElementById('restart-btn');
const saveScoreBtn = document.getElementById('save-score-btn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initFirebase();
    loadLeaderboard();

    startBtn.addEventListener('click', startGame);
    nextClueBtn.addEventListener('click', revealNextClue); // Default listener
    restartBtn.addEventListener('click', () => showScreen('start'));
    saveScoreBtn.addEventListener('click', submitHighScore);

    // Native Input Listeners
    ui.hiddenInput.addEventListener('input', handleNativeInput);
    // Focus Keep-alive
    document.addEventListener('click', (e) => {
        // Prevent stealing focus if clicking buttons
        if (currentState.isActive && e.target.tagName !== 'BUTTON') {
            ui.hiddenInput.focus();
        }
    });
});

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
    if (screenName === 'start') loadLeaderboard();
}

// --- Game Logic ---
function startGame() {
    currentState.score = 0;
    currentState.timer = 120;
    currentState.currentLevelIdx = 0;
    currentState.isActive = true;

    updateHUD();
    startTimer();
    shuffleArray(personalities);
    loadLevel();
    showScreen('game');

    // Focus input immediately
    setTimeout(() => ui.hiddenInput.focus(), 100);
}

function loadLevel() {
    if (currentState.currentLevelIdx >= personalities.length) {
        endGame(true);
        return;
    }

    const person = personalities[currentState.currentLevelIdx];
    currentState.currentAnswer = person.name;
    currentState.currentClueIdx = 0;

    // Clear Input
    ui.hiddenInput.value = "";

    renderSlots(person.name);
    updateClueUI();
    highlightActiveSlot(0); // Highlight first slot

    // Re-focus ensure
    setTimeout(() => ui.hiddenInput.focus(), 50);
}

function renderSlots(name) {
    ui.inputContainer.innerHTML = '';
    const cleanName = name.trim();
    const words = cleanName.split(/([ -])/); // Split by space or dash, keeping separators

    let globalCharIndex = 0; // To track mapping to linear input

    words.forEach(wordOrSep => {
        if (!wordOrSep) return;

        // Wrapper for "words" (not separators) to keep them together
        const isSeparator = wordOrSep === ' ' || wordOrSep === '-';

        if (isSeparator) {
            // Separator: Add directly or in a small wrapper?
            // Just add directly to flow, but usually space breaks line.
            // If we want "word wrap", we need the space to allow break.
            const slot = document.createElement('div');
            slot.className = 'letter-slot space';
            slot.innerHTML = wordOrSep === '-' ? '-' : '';
            ui.inputContainer.appendChild(slot);
            globalCharIndex++;
        } else {
            // Word: Wrap in a container that doesn't break internally
            const wordWrapper = document.createElement('div');
            wordWrapper.className = 'word-wrapper';

            for (let i = 0; i < wordOrSep.length; i++) {
                const char = wordOrSep[i];
                const slot = document.createElement('div');
                slot.className = 'letter-slot';
                slot.dataset.index = globalCharIndex++; // Correct index relative to full string
                wordWrapper.appendChild(slot);
            }
            ui.inputContainer.appendChild(wordWrapper);
        }
    });
}

function updateClueUI() {
    const person = personalities[currentState.currentLevelIdx];
    const clue = person.clues[currentState.currentClueIdx];
    const points = currentState.cluePoints[currentState.currentClueIdx];

    ui.clueLabel.textContent = `רמז ${currentState.currentClueIdx + 1}`;
    ui.clueText.textContent = clue;
    ui.potentialPoints.textContent = points;

    ui.clueCard.classList.remove('pulse-animation');
    void ui.clueCard.offsetWidth;
    ui.clueCard.classList.add('pulse-animation');

    // Button Logic
    // Remove previous listeners to avoid duplicates if we re-bind
    nextClueBtn.onclick = null;

    if (currentState.currentClueIdx >= 3) {
        // Last Clue -> Show Skip/Give Up
        nextClueBtn.style.display = 'inline-block';
        nextClueBtn.textContent = 'דלג';
        nextClueBtn.onclick = giveUpAndSkip;

    } else {
        // Normal Clue -> Next Clue
        nextClueBtn.style.display = 'inline-block';
        nextClueBtn.textContent = 'רמז הבא';
        nextClueBtn.onclick = revealNextClue;
    }
}

function revealNextClue() {
    if (currentState.currentClueIdx < 3) {
        currentState.currentClueIdx++;
        updateClueUI();
        ui.hiddenInput.focus(); // Ensure keyboard stays up
    }
}

function giveUpAndSkip() {
    // Show correct answer
    const slots = ui.inputContainer.querySelectorAll('.letter-slot:not(.space)');
    const correctString = currentState.currentAnswer.replace(/[ -]/g, '');

    // Fill visually
    slots.forEach((slot, i) => {
        if (correctString[i]) {
            slot.textContent = correctString[i];
            slot.classList.add('filled');
            slot.style.backgroundColor = '#ED8936'; // Orange for skipped
            slot.style.borderColor = '#DD6B20';
            slot.style.color = 'white';
        }
    });

    // Disable input
    currentState.isActive = false;
    ui.hiddenInput.blur();

    // Wait and move on
    setTimeout(() => {
        currentState.currentLevelIdx++;
        loadLevel();
        currentState.isActive = true; // Re-activate for next level
    }, 2000);
}

// --- Input Handling (Native) ---
function handleNativeInput(e) {
    if (!currentState.isActive) return;

    const rawInput = ui.hiddenInput.value;
    const targetLettersOnly = currentState.currentAnswer.replace(/[ -]/g, '');

    // Clean input to letters only for logic mapping
    // We assume user types letters. 
    // If they type spaces, we strip them to match our visual slots which skip spaces.
    let userLettersOnly = rawInput.replace(/[ -]/g, '');

    if (userLettersOnly.length > targetLettersOnly.length) {
        userLettersOnly = userLettersOnly.slice(0, targetLettersOnly.length);
    }

    // Update Visual Slots
    const slots = ui.inputContainer.querySelectorAll('.letter-slot:not(.space)');

    slots.forEach((slot, idx) => {
        if (idx < userLettersOnly.length) {
            slot.textContent = userLettersOnly[idx];
            slot.classList.add('filled');
        } else {
            slot.textContent = '';
            slot.classList.remove('filled');
        }
    });

    highlightActiveSlot(userLettersOnly.length);

    // Check Win
    if (userLettersOnly.length === targetLettersOnly.length) {
        checkAnswer(userLettersOnly, targetLettersOnly);
    }
}

function highlightActiveSlot(index) {
    // Remove previous highlights
    ui.inputContainer.querySelectorAll('.letter-slot').forEach(s => s.classList.remove('active-focus'));

    // Find the Nth non-space slot
    const slots = ui.inputContainer.querySelectorAll('.letter-slot:not(.space)');
    if (slots[index]) {
        slots[index].classList.add('active-focus');
    }
}

function checkAnswer(userString, correctString) {
    if (userString === correctString) {
        // Correct
        const pointsEarned = currentState.cluePoints[currentState.currentClueIdx];
        currentState.score += pointsEarned;
        updateHUD();

        // Visual Success
        ui.inputContainer.querySelectorAll('.letter-slot').forEach(s => {
            s.style.backgroundColor = '#48BB78';
            s.style.borderColor = '#2F855A';
            s.style.color = 'white';
            s.classList.remove('active-focus');
        });

        currentState.isActive = false; // freeze input
        ui.hiddenInput.blur();

        setTimeout(() => {
            currentState.currentLevelIdx++;
            loadLevel();
            currentState.isActive = true; // re-activate
        }, 1000);

    } else {
        // Only error if user filled everything and it's wrong?
        // Or live checking? The prompt said "Until he succeeds to write the name".
        // Usually we wait until full length to judge.
        // Let's just shake if full and wrong.
        ui.clueCard.classList.add('shake');
        setTimeout(() => ui.clueCard.classList.remove('shake'), 500);

        ui.inputContainer.querySelectorAll('.letter-slot').forEach(s => {
            if (!s.classList.contains('space')) {
                s.style.borderColor = '#e53e3e';
                setTimeout(() => s.style.borderColor = '', 500);
            }
        });
    }
}

function updateHUD() {
    ui.score.textContent = currentState.score;
}

function startTimer() {
    if (currentState.timerInterval) clearInterval(currentState.timerInterval);
    currentState.timerInterval = setInterval(() => {
        currentState.timer--;
        const m = Math.floor(currentState.timer / 60);
        const s = currentState.timer % 60;
        ui.timer.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        if (currentState.timer <= 0) endGame(false);
    }, 1000);
}

function endGame(completedAll) {
    clearInterval(currentState.timerInterval);
    currentState.isActive = false;
    ui.hiddenInput.blur(); // Close keyboard

    ui.finalScore.textContent = currentState.score;
    ui.finalMessage.textContent = completedAll ? "סיימת את כל הדמויות!" : "נגמר הזמן!";

    checkForHighScore(currentState.score);
    showScreen('gameOver');

    if (currentState.score > 0) {
        setTimeout(() => ui.playerNameInput.focus(), 500); // Auto focus for convenience
    }
}

// --- Utils ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Firebase ---
let db = null;
function initFirebase() {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
        } catch (e) { console.error(e); }
    }
}

function submitHighScore() {
    const name = ui.playerNameInput.value.trim();
    if (!name) return;
    if (db) {
        db.ref('leaderboard').push({
            name: name,
            score: currentState.score,
            date: new Date().toISOString()
        }).then(() => {
            alert("התוצאה נשמרה!");
            showScreen('start');
        });
    } else {
        alert("מצב הדגמה: נתונים לא נשמרו.");
        showScreen('start');
    }
}

function loadLeaderboard() {
    ui.leaderboardList.innerHTML = '<p class="loading-text">טוען...</p>';
    if (db) {
        db.ref('leaderboard').orderByChild('score').limitToLast(10).once('value')
            .then(snapshot => {
                const data = [];
                snapshot.forEach(c => data.push(c.val()));
                renderLeaderboard(data.reverse());
            });
    } else {
        renderLeaderboard([
            { name: "אלוף", score: 100 },
            { name: "דני", score: 85 }
        ]);
    }
}

function renderLeaderboard(data) {
    ui.leaderboardList.innerHTML = '';
    if (data.length === 0) {
        ui.leaderboardList.innerHTML = '<p>אין עדיין תוצאות</p>';
        return;
    }
    data.forEach((entry, idx) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `<span>#${idx + 1} ${entry.name}</span><span>${entry.score}</span>`;
        ui.leaderboardList.appendChild(item);
    });
}
function checkForHighScore(score) {
    if (score > 0) ui.highScoreForm.classList.remove('hidden');
    else ui.highScoreForm.classList.add('hidden');
}
