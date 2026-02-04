// --- Game State ---
let currentState = {
    score: 0,
    timer: 120, // 2 minutes in seconds
    timerInterval: null,
    currentLevelIdx: 0,
    currentClueIdx: 0,
    cluePoints: [10, 7, 5, 3], // Points for each clue stage
    currentAnswer: "", // The correct answer string
    userAnswer: [], // Array representing the slots
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
    keyboard: document.getElementById('keyboard'),
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
    renderKeyboard();
    loadLeaderboard(); // Load initially

    startBtn.addEventListener('click', startGame);
    nextClueBtn.addEventListener('click', revealNextClue);
    restartBtn.addEventListener('click', () => showScreen('start'));
    saveScoreBtn.addEventListener('click', submitHighScore);
});

// --- Navigation ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');

    if (screenName === 'start') {
        loadLeaderboard();
    }
}

// --- Game Logic ---
function startGame() {
    // Reset State
    currentState.score = 0;
    currentState.timer = 120;
    currentState.currentLevelIdx = 0;
    currentState.isActive = true;

    updateHUD();
    startTimer();

    // Shuffle Personalities (Optional: shuffle `personalities` array copy)
    // For now, linear order as requested if it was random we'd copy
    // Let's shuffle to make it interesting? User didn't specify random, but implied flow. 
    // "Initial 4 hints" -> let's keep order for test, or shuffle for replayability.
    // Let's Shuffle for better game feel.
    shuffleArray(personalities);

    loadLevel();
    showScreen('game');
}

function loadLevel() {
    if (currentState.currentLevelIdx >= personalities.length) {
        endGame(true); // All levels completed
        return;
    }

    const person = personalities[currentState.currentLevelIdx];
    currentState.currentAnswer = person.name;
    currentState.currentClueIdx = 0;
    currentState.userAnswer = []; // Reset user answer

    // Prepare slots
    renderSlots(person.name);

    // Show first clue
    updateClueUI();
}

function renderSlots(name) {
    ui.inputContainer.innerHTML = '';
    const cleanName = name.trim();

    currentState.userAnswer = new Array(cleanName.length).fill(null);

    for (let i = 0; i < cleanName.length; i++) {
        const char = cleanName[i];
        const slot = document.createElement('div');

        if (char === ' ' || char === '-') {
            slot.className = 'letter-slot space';
            slot.innerHTML = char === '-' ? '-' : '';
            currentState.userAnswer[i] = char; // Auto fill space/hyphen
        } else {
            slot.className = 'letter-slot';
            slot.dataset.index = i;
        }
        ui.inputContainer.appendChild(slot);
    }
}

function updateClueUI() {
    const person = personalities[currentState.currentLevelIdx];
    const clue = person.clues[currentState.currentClueIdx];
    const points = currentState.cluePoints[currentState.currentClueIdx];

    ui.clueLabel.textContent = `רמז ${currentState.currentClueIdx + 1}`;
    ui.clueText.textContent = clue;
    ui.potentialPoints.textContent = points;

    // Animation reset
    ui.clueCard.classList.remove('pulse-animation');
    void ui.clueCard.offsetWidth; // trigger reflow
    ui.clueCard.classList.add('pulse-animation');

    // Hide "Next Clue" button if it's the last clue
    if (currentState.currentClueIdx >= 3) {
        nextClueBtn.style.display = 'none';
    } else {
        nextClueBtn.style.display = 'inline-block';
        nextClueBtn.innerHTML = `רמז הבא (נותרו ${currentState.cluePoints[currentState.currentClueIdx + 1]} נקודות)`;
    }
}

function revealNextClue() {
    if (currentState.currentClueIdx < 3) {
        currentState.currentClueIdx++;
        updateClueUI();
    }
}

function handleInput(char) {
    if (!currentState.isActive) return;

    // Find first empty slot
    const targetIndex = currentState.userAnswer.findIndex(c => c === null);

    if (targetIndex !== -1) {
        currentState.userAnswer[targetIndex] = char;
        updateSlotsUI();

        // Check if full
        if (!currentState.userAnswer.includes(null)) {
            checkAnswer();
        }
    }
}

function handleBackspace() {
    if (!currentState.isActive) return;

    // Find last filled slot that isn't a space/hyphen (fixed char)
    // We iterate backwards
    for (let i = currentState.userAnswer.length - 1; i >= 0; i--) {
        const char = currentState.userAnswer[i];
        // Don't delete spaces or hyphens that are part of the original name structure
        const originalChar = currentState.currentAnswer[i];
        if (originalChar === ' ' || originalChar === '-') continue;

        if (char !== null) {
            currentState.userAnswer[i] = null;
            updateSlotsUI();
            return;
        }
    }
}

function updateSlotsUI() {
    const slots = ui.inputContainer.querySelectorAll('.letter-slot:not(.space)');
    let slotIdx = 0;

    for (let i = 0; i < currentState.userAnswer.length; i++) {
        const originalChar = currentState.currentAnswer[i];
        if (originalChar === ' ' || originalChar === '-') continue;

        const content = currentState.userAnswer[i];
        const slot = slots[slotIdx];

        if (content) {
            slot.textContent = content;
            slot.classList.add('filled');
        } else {
            slot.textContent = '';
            slot.classList.remove('filled');
        }
        slotIdx++;
    }
}

function checkAnswer() {
    const userString = currentState.userAnswer.join('');
    const correctString = currentState.currentAnswer;

    if (userString === correctString) {
        // Correct!
        const pointsEarned = currentState.cluePoints[currentState.currentClueIdx];
        currentState.score += pointsEarned;
        updateHUD();

        // Success feedback
        ui.inputContainer.querySelectorAll('.letter-slot').forEach(s => {
            s.style.backgroundColor = '#48BB78';
            s.style.borderColor = '#2F855A';
            s.style.color = 'white';
        });

        setTimeout(() => {
            currentState.currentLevelIdx++;
            loadLevel();
        }, 1000); // 1s delay to celebrate

    } else {
        // Wrong
        ui.clueCard.classList.add('shake');
        setTimeout(() => ui.clueCard.classList.remove('shake'), 500);

        // Simple visual feedback on slots
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

        const minutes = Math.floor(currentState.timer / 60);
        const seconds = currentState.timer % 60;
        ui.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        if (currentState.timer <= 0) {
            endGame(false);
        }
    }, 1000);
}

function endGame(completedAll) {
    clearInterval(currentState.timerInterval);
    currentState.isActive = false;

    ui.finalScore.textContent = currentState.score;
    ui.finalMessage.textContent = completedAll ? "סיימת את כל הדמויות!" : "נגמר הזמן!";

    checkForHighScore(currentState.score);
    showScreen('gameOver');
}

// --- Keyboard Logic ---
function renderKeyboard() {
    const rows = [
        ['ק', 'ר', 'א', 'ט', 'ו', 'ן', 'ם', 'פ'],
        ['ש', 'ד', 'ג', 'כ', 'ע', 'י', 'ח', 'ל', 'ך', 'ף'],
        ['ז', 'ס', 'ב', 'ה', 'נ', 'מ', 'צ', 'ת', 'ץ']
    ];

    ui.keyboard.innerHTML = '';

    rows.forEach(rowChars => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'keyboard-row';

        rowChars.forEach(char => {
            const key = document.createElement('div');
            key.className = 'key';
            key.textContent = char;
            key.addEventListener('click', () => handleInput(char));
            rowDiv.appendChild(key);
        });

        ui.keyboard.appendChild(rowDiv);
    });

    // Add Space and Backspace row
    const actionRow = document.createElement('div');
    actionRow.className = 'keyboard-row';

    // Backspace
    const backspace = document.createElement('div');
    backspace.className = 'key special-key';
    backspace.innerHTML = '⌫';
    backspace.addEventListener('click', handleBackspace);

    // Space
    const space = document.createElement('div');
    space.className = 'key special-key'; // Space is mostly auto-handled in game logic but kept for flex
    space.style.flex = 2; // Wider
    space.innerHTML = 'רווח';
    space.style.visibility = 'hidden'; // Hide space (auto-space in game logic) or show if needed? 
    // The requirement says "Number of letters boxes", usually spaces are pre-filled or clear separators.
    // In my logic `renderSlots`, spaces are pre-filled holes. So user doesn't type space.
    // I will keep it hidden to avoid confusion.

    // Another Backspace or filler? Let's just center the backspace nicely or add a "Clear"
    // Actually, let's put Backspace on the last row logically?
    // The current layout is 3 rows. Let's append Backspace to the last row.
    const lastRow = ui.keyboard.lastChild;
    lastRow.appendChild(backspace);

    // (Optional) Add a dedicated clear button? Nah, keep it simple.
}

// --- Utils ---
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Firebase / Leaderboard Stub ---
let db = null;

function initFirebase() {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            console.log("Firebase initialized");
        } catch (e) {
            console.error("Firebase init failed:", e);
        }
    } else {
        console.warn("Firebase not configured properly. Leaderboard will be local-mock only.");
    }
}

function submitHighScore() {
    const name = ui.playerNameInput.value.trim();
    if (!name) return;

    if (db) {
        const scoreData = {
            name: name,
            score: currentState.score,
            date: new Date().toISOString()
        };
        db.ref('leaderboard').push(scoreData)
            .then(() => {
                alert("התוצאה נשמרה!");
                showScreen('start');
            })
            .catch(e => alert("שגיאה בשמירה: " + e.message));
    } else {
        alert("מצב הדגמה: Firebase לא מחובר.");
        showScreen('start');
    }
}

function loadLeaderboard() {
    ui.leaderboardList.innerHTML = '<p class="loading-text">טוען...</p>';

    if (db) {
        db.ref('leaderboard').orderByChild('score').limitToLast(10).once('value')
            .then(snapshot => {
                const data = [];
                snapshot.forEach(child => data.push(child.val()));
                renderLeaderboard(data.reverse()); // Higher score first
            });
    } else {
        // Mock data
        const mockData = [
            { name: "אלוף", score: 100 },
            { name: "דני", score: 85 },
            { name: "יוסי", score: 60 }
        ];
        renderLeaderboard(mockData);
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
        item.innerHTML = `
            <span>#${idx + 1} ${entry.name}</span>
            <span>${entry.score}</span>
        `;
        ui.leaderboardList.appendChild(item);
    });
}

function checkForHighScore(score) {
    // In a real app we'd check against DB. 
    // Here we always show inputs for positive score.
    if (score > 0) {
        ui.highScoreForm.classList.remove('hidden');
    } else {
        ui.highScoreForm.classList.add('hidden');
    }
}
