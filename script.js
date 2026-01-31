/* ================= SCOREBOARD (Persistent) ================= */

// Load saved scores or fallback to 0
let playerWins = Number(localStorage.getItem("playerWins")) || 0;
let aiWins = Number(localStorage.getItem("aiWins")) || 0;
let draws = Number(localStorage.getItem("draws")) || 0;

/* ================= DOM ELEMENTS ================= */

const cells = document.querySelectorAll(".cell");
const statusText = document.getElementById("statusText");
const restartBtn = document.getElementById("restartBtn");
const muteBtn = document.getElementById("muteBtn");
const resetStatsBtn = document.getElementById("resetStats");
const difficultyContainer = document.getElementById("difficultyContainer");
const winLineEl = document.getElementById("winLine");
const board = document.querySelector(".board");

const playerScoreEl = document.getElementById("playerScore");
const aiScoreEl = document.getElementById("aiScore");
const drawScoreEl = document.getElementById("drawScore");

/* ================= GAME STATE ================= */

let currentPlayer = "X";
let gameActive = true;
let gameState = Array(9).fill("");

let gameMode = "pvp";
let difficulty = "easy";
let isMuted = false;

/* ================= AUDIO SETUP ================= */

// Audio files (relative paths for deployment)
const clickSound = new Audio("sounds/click.mp3");
const winSound   = new Audio("sounds/win.mp3");
const drawSound  = new Audio("sounds/draw.mp3");

// Browser audio lock flag
let audioUnlocked = false;

/* Unlock audio after first user interaction */
function unlockAudio() {
    if (audioUnlocked) return;

    clickSound.play().then(() => {
        clickSound.pause();
        clickSound.currentTime = 0;
        audioUnlocked = true;
        muteBtn.textContent = "🔊 Sound On";
    }).catch(() => {
        // Browser blocked autoplay — ignored safely
    });

    document.removeEventListener("click", unlockAudio);
}

// Listen for first click/tap
document.addEventListener("click", unlockAudio);

/* ================= WIN CONDITIONS ================= */

const winningCombinations = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
];

/* ================= INITIAL UI ================= */

updateScoreboard();
muteBtn.textContent = "🔊 Tap to Enable Sound";

/* ================= EVENT LISTENERS ================= */

// Cell clicks
cells.forEach(cell => cell.addEventListener("click", handleCellClick));

// Restart game
restartBtn.addEventListener("click", restartGame);

// Mode selection
document.querySelectorAll('input[name="mode"]').forEach(input => {
    input.addEventListener("change", e => {
        gameMode = e.target.value;
        difficultyContainer.style.display = gameMode === "ai" ? "flex" : "none";
        restartGame();
    });
});

// Difficulty selection
document.querySelectorAll('input[name="difficulty"]').forEach(input => {
    input.addEventListener("change", e => {
        difficulty = e.target.value;
        restartGame();
    });
});

// Mute / unmute
muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? "🔇 Sound Off" : "🔊 Sound On";
});

// Reset statistics
resetStatsBtn.addEventListener("click", () => {
    playerWins = aiWins = draws = 0;
    updateScoreboard();
});

/* ================= GAME LOGIC ================= */

// Handle cell click
function handleCellClick(e) {
    const cell = e.target;
    const index = Number(cell.dataset.index);

    if (!gameActive || gameState[index] !== "") return;
    if (gameMode === "ai" && currentPlayer === "O") return;

    makeMove(cell, index, currentPlayer);
    checkResult();

    if (!gameActive) return;

    if (gameMode === "ai" && currentPlayer === "X") {
        currentPlayer = "O";
        statusText.textContent = "Computer's Turn";
        setTimeout(computerMove, 500);
    } else {
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        statusText.textContent = `Player ${currentPlayer}'s Turn`;
    }
}

// Place X or O
function makeMove(cell, index, player) {
    gameState[index] = player;
    cell.textContent = player;
    cell.classList.add("mark");

    if (!isMuted && audioUnlocked) {
        clickSound.currentTime = 0;
        clickSound.play();
    }
}

// Check win or draw
function checkResult() {
    for (let combo of winningCombinations) {
        const [a,b,c] = combo;
        if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {

            gameActive = false;
            combo.forEach(i => cells[i].classList.add("win"));
            showWinLine(combo);

            if (gameMode === "ai" && gameState[a] === "O") {
                aiWins++;
                statusText.textContent = "Computer Wins!";
            } else {
                playerWins++;
                statusText.textContent = `Player ${gameState[a]} Wins!`;
            }

            updateScoreboard();

            if (!isMuted && audioUnlocked) winSound.play();
            confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });

            return;
        }
    }

    // Draw
    if (!gameState.includes("")) {
        draws++;
        updateScoreboard();
        statusText.textContent = "It's a Draw!";
        gameActive = false;

        if (!isMuted && audioUnlocked) drawSound.play();
    }
}

// Draw winning line
function showWinLine(combo) {
    const first = cells[combo[0]].getBoundingClientRect();
    const last = cells[combo[2]].getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();

    const x1 = first.left + first.width / 2 - boardRect.left;
    const y1 = first.top + first.height / 2 - boardRect.top;
    const x2 = last.left + last.width / 2 - boardRect.left;
    const y2 = last.top + last.height / 2 - boardRect.top;

    const length = Math.hypot(x2 - x1, y2 - y1);
    const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

    winLineEl.style.transform = `translate(${x1}px, ${y1}px) rotate(${angle}deg)`;
    setTimeout(() => winLineEl.style.width = `${length}px`, 50);
}

/* ================= AI LOGIC ================= */

function computerMove() {
    const move =
        difficulty === "easy" ? randomMove() :
        difficulty === "medium" ? (Math.random() < 0.5 ? randomMove() : bestMove()) :
        bestMove();

    makeMove(cells[move], move, "O");
    checkResult();

    if (gameActive) {
        currentPlayer = "X";
        statusText.textContent = "Player X's Turn";
    }
}

function bestMove() {
    let bestScore = -Infinity;
    let move;

    gameState.forEach((v, i) => {
        if (!v) {
            gameState[i] = "O";
            const score = minimax(gameState, false, 0);
            gameState[i] = "";
            if (score > bestScore) {
                bestScore = score;
                move = i;
            }
        }
    });
    return move;
}

function minimax(board, isMax, depth) {
    const winner = getWinner(board);
    if (winner !== null) {
        if (winner === "O") return 10 - depth;
        if (winner === "X") return depth - 10;
        return 0;
    }

    if (isMax) {
        let best = -Infinity;
        board.forEach((v,i) => {
            if (!v) {
                board[i] = "O";
                best = Math.max(best, minimax(board, false, depth + 1));
                board[i] = "";
            }
        });
        return best;
    } else {
        let best = Infinity;
        board.forEach((v,i) => {
            if (!v) {
                board[i] = "X";
                best = Math.min(best, minimax(board, true, depth + 1));
                board[i] = "";
            }
        });
        return best;
    }
}

// Easy mode move
function randomMove() {
    const empty = gameState
        .map((v,i) => v === "" ? i : null)
        .filter(v => v !== null);
    return empty[Math.floor(Math.random() * empty.length)];
}

// Winner check for minimax
function getWinner(board) {
    for (let [a,b,c] of winningCombinations) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return board.includes("") ? null : "draw";
}

// Restart game
function restartGame() {
    currentPlayer = "X";
    gameActive = true;
    gameState.fill("");
    statusText.textContent = "Player X's Turn";
    winLineEl.style.width = "0";

    cells.forEach(cell => {
        cell.textContent = "";
        cell.classList.remove("mark", "win");
    });
}

// Update scoreboard + save
function updateScoreboard() {
    playerScoreEl.textContent = playerWins;
    aiScoreEl.textContent = aiWins;
    drawScoreEl.textContent = draws;

    localStorage.setItem("playerWins", playerWins);
    localStorage.setItem("aiWins", aiWins);
    localStorage.setItem("draws", draws);
}
