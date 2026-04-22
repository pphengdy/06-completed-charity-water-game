// Jerry Can Runner - beginner-friendly DOM game starter
const game = document.getElementById('game');
const runner = document.getElementById('runner');
const scoreLabel = document.getElementById('score');
const heartsLabel = document.getElementById('hearts');
const startOverlay = document.getElementById('startOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreText = document.getElementById('finalScore');
const restartButton = document.getElementById('restartButton');
const jumpInfoMessage = document.getElementById('jumpInfoMessage');
const difficultyButtons = document.querySelectorAll('.difficulty-button');
const startPrompt = document.getElementById('startPrompt');

// Adjust game speed dynamically based on screen size
const isMobile = window.matchMedia('(max-width: 767px)').matches;

// Game state values
let isGameRunning = false;
let isGameOver = false;
let score = 0;
let lives = 3;

// Runner movement values
let runnerY = 0;
let runnerVelocityY = 0;
const gravity = -0.65;
const minJumpStrength = 10;
const maxJumpStrength = 16;
const minChargeMs = 40;
const maxChargeMs = 300;
const groundY = 92;

// A simple point counter for distance score (+1 point repeatedly while running)
let distanceCounter = 0;

// Spawn and speed values
let gameSpeed = 4.5;
let spawnTimer = 0;
let nextSpawnTime = randomInRange(80, 160);
let spawnMin = 80;
let spawnMax = 160;
let speedRamp = 0.03;
let speedCap = 10;

// Player picks one difficulty before each run
let selectedDifficulty = null;

const difficultySettings = {
  easy: {
    label: 'Easy',
    startSpeed: 4.2,
    mobileSpeed: 3.4,
    spawnMin: 95,
    spawnMax: 180,
    speedRamp: 0.02,
    speedCap: 8,
    message: 'Easy: Tap to jump and collect water!'
  },
  medium: {
    label: 'Medium',
    startSpeed: 4.8,
    mobileSpeed: 3.8,
    spawnMin: 80,
    spawnMax: 150,
    speedRamp: 0.03,
    speedCap: 9,
    message: 'Medium: Watch out for stacked bacterias!'
  },
  hard: {
    label: 'Hard',
    startSpeed: 5.4,
    mobileSpeed: 4.2,
    spawnMin: 68,
    spawnMax: 128,
    speedRamp: 0.04,
    speedCap: 10,
    message: 'Hard: Stay sharp and avoid bacterias!'
  }
};

// Keep all moving items (water + bacteria) in one array
const items = [];

// Press sensitivity state (hold longer = higher jump)
let isChargingJump = false;
let chargeStartTime = 0;
let activePointerId = null;

// Web Audio setup for simple beep-style sound effects
let audioContext = null;

function randomInRange(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setupAudio() {
	if (!audioContext) {
		audioContext = new window.AudioContext();
	}
}

function playTone(frequency, duration, type, volume) {
	if (!audioContext) {
		return;
	}

	const oscillator = audioContext.createOscillator();
	const gainNode = audioContext.createGain();

	oscillator.type = type;
	oscillator.frequency.value = frequency;

	gainNode.gain.value = volume;
	gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

	oscillator.connect(gainNode);
	gainNode.connect(audioContext.destination);

	oscillator.start();
	oscillator.stop(audioContext.currentTime + duration);
}

function playJumpSound() {
	playTone(420, 0.12, 'square', 0.08);
}

function playBacteriaSound() {
	playTone(160, 0.14, 'sawtooth', 0.08);
}

function playWaterDropSound() {
  playTone(600, 0.15, 'triangle', 0.1);
}

function playHeartSound() {
    playTone(440, 0.2, 'sine', 0.5);
}

function startGame() {
	if (isGameRunning) {
		return;
	}

  if (!selectedDifficulty) {
    startPrompt.textContent = 'Pick a difficulty first, then press SPACE or TAP to jump.';
    return;
  }

	setupAudio();
  const settings = difficultySettings[selectedDifficulty];

	isGameRunning = true;
	isGameOver = false;
	game.classList.add('running');
	startOverlay.classList.remove('show');
	gameOverOverlay.classList.remove('show');

  spawnMin = settings.spawnMin;
  spawnMax = settings.spawnMax;
  speedRamp = settings.speedRamp;
  speedCap = settings.speedCap;
  gameSpeed = isMobile ? settings.mobileSpeed : settings.startSpeed;
  nextSpawnTime = randomInRange(spawnMin, spawnMax);
}

function updateHud() {
	scoreLabel.textContent = `Score: ${score}`;

  if (lives > 0) {
	  heartsLabel.textContent = '❤️'.repeat(lives);
  } else {
    heartsLabel.textContent = '💀';
  }
}

function endGame() {
	isGameRunning = false;
	isGameOver = true;
	game.classList.remove('running');
	finalScoreText.textContent = `Final Score: ${score}`;
	gameOverOverlay.classList.add('show');
}

function resetGame() {
	// Remove all active items from previous run
	items.forEach((itemData) => itemData.element.remove());
	items.length = 0;

	// Reset game state values
	score = 0;
	lives = 3;
	runnerY = 0;
	runnerVelocityY = 0;
	gameSpeed = 4.5;
	spawnTimer = 0;
	nextSpawnTime = randomInRange(80, 160);
  spawnMin = 80;
  spawnMax = 160;
  speedRamp = 0.03;
  speedCap = 10;
	distanceCounter = 0;
	isChargingJump = false;
	activePointerId = null;
  selectedDifficulty = null;

	runner.style.bottom = `${groundY}px`;
	updateHud();
  updateGameBackground();
  difficultyButtons.forEach((button) => button.classList.remove('active'));
  startPrompt.textContent = 'Pick a difficulty, then press SPACE or TAP to jump.';

	// Show start screen again
	isGameRunning = false;
	isGameOver = false;
	gameOverOverlay.classList.remove('show');
	startOverlay.classList.add('show');
}

function beginJumpCharge() {
	// Start game on first interaction
	if (!isGameRunning && !isGameOver) {
		startGame();
	}

	if (!isGameRunning) {
		return;
	}

	// Only charge if runner is on the ground
	if (runnerY <= 0.5 && !isChargingJump) {
		isChargingJump = true;
		chargeStartTime = performance.now();
	}
}

function releaseJumpCharge() {
	if (!isChargingJump || !isGameRunning) {
		return;
	}

	const heldMs = performance.now() - chargeStartTime;
	const clampedMs = Math.min(Math.max(heldMs, minChargeMs), maxChargeMs);
	const ratio = (clampedMs - minChargeMs) / (maxChargeMs - minChargeMs);
	const jumpStrength = minJumpStrength + ratio * (maxJumpStrength - minJumpStrength);

	runnerVelocityY = jumpStrength;
	isChargingJump = false;

	// Player earns points when pressing to jump
	score += 1;
	updateHud();
	playJumpSound();
}

function onKeyDown(event) {
	if (event.code !== 'Space') {
		return;
	}

	event.preventDefault();

	// Ignore repeat keydown while holding the same key
	if (event.repeat) {
		return;
	}

	beginJumpCharge();
}

function onPointerDown(event) {
  if (event.target.closest('.difficulty-button')) {
    return;
  }

	event.preventDefault();
	activePointerId = event.pointerId;
	beginJumpCharge();
}

function onKeyUp(event) {
	if (event.code !== 'Space') {
		return;
	}

	event.preventDefault();
	releaseJumpCharge();
}

function onPointerUp(event) {
	if (activePointerId !== null && event.pointerId !== activePointerId) {
		return;
	}

	activePointerId = null;
	releaseJumpCharge();
}

function createSingleItem(type, emoji, bottom) {
    const item = document.createElement('div');
    item.classList.add('item', type);

    // Assign the appropriate emoji based on the item type
    item.textContent = emoji;

    item.style.bottom = `${bottom}px`;
    item.style.left = `${game.clientWidth + 20}px`;

    game.appendChild(item);

    items.push({
        element: item,
        type: type,
        x: game.clientWidth + 20,
        y: bottom,
        width: item.offsetWidth,
        height: item.offsetHeight
    });
}

function createItem() {
    // Determine the type of item to spawn based on selected difficulty
    const randomValue = Math.random();
    const mode = selectedDifficulty || 'easy';

    if (mode === 'hard') {
      if (lives < 3) {
        if (randomValue < 0.45) {
          createSingleItem('bacteria', '🦠', 92);
        } else if (randomValue < 0.67) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('bacteria', '🦠', 132);
        } else if (randomValue < 0.84) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('bacteria', '🦠', 282);
        } else if (randomValue < 0.97) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('water', '💧', randomInRange(132, 282));
        } else {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('heart', '❤️', 302);
        }
      } else {
        if (randomValue < 0.5) {
          createSingleItem('bacteria', '🦠', 92);
        } else if (randomValue < 0.72) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('bacteria', '🦠', 132);
        } else if (randomValue < 0.9) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('bacteria', '🦠', 282);
        } else {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('water', '💧', randomInRange(132, 282));
        }
      }
    } else if (mode === 'medium') {
      if (lives < 3) {
        if (randomValue < 0.68) {
          createSingleItem('bacteria', '🦠', 92);
        } else if (randomValue < 0.86) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('bacteria', '🦠', 132);
        } else if (randomValue < 0.96) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('water', '💧', randomInRange(132, 282));
        } else {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('heart', '❤️', 302);
        }
      } else {
        if (randomValue < 0.68) {
          createSingleItem('bacteria', '🦠', 92);
        } else if (randomValue < 0.88) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('bacteria', '🦠', 132);
        } else {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('water', '💧', randomInRange(132, 282));
        }
      }
    } else {
      if (lives < 3) {
        if (randomValue < 0.84) {
          createSingleItem('bacteria', '🦠', 92);
        } else if (randomValue < 0.94) {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('water', '💧', randomInRange(132, 282));
        } else {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('heart', '❤️', 302);
        }
      } else {
        if (randomValue < 0.88) {
          createSingleItem('bacteria', '🦠', 92);
        } else {
          createSingleItem('bacteria', '🦠', 92);
          createSingleItem('water', '💧', randomInRange(132, 282));
        }
      }
    }
}

function rectsOverlap(a, b) {
	return (
		a.left < b.right &&
		a.right > b.left &&
		a.top < b.bottom &&
		a.bottom > b.top
	);
}

function handleCollision(itemData, index) {
    if (itemData.type === 'bacteria') {
        lives -= 1;
        playBacteriaSound();
        game.classList.add('flash-hit');
        setTimeout(() => game.classList.remove('flash-hit'), 220);
    } else if (itemData.type === 'water') {
        score += randomInRange(200, 500); // Random points for collecting water
        playWaterDropSound();
        updateHud();
    } else if (itemData.type === 'heart' && lives < 3) {
        lives += 1;
        playHeartSound();
        updateHud();
    }

    // Remove item after collision
    itemData.element.remove();
    items.splice(index, 1);

    updateHud();

    if (lives <= 0) {
        endGame();
    }
}

function updateRunner() {
	// Simple jump physics
	runnerVelocityY += gravity;
	runnerY += runnerVelocityY;

	if (runnerY < 0) {
		runnerY = 0;
		runnerVelocityY = 0;
	}

	runner.style.bottom = `${groundY + runnerY}px`;
}

function updateItems() {
	const runnerRect = runner.getBoundingClientRect();

	for (let i = items.length - 1; i >= 0; i -= 1) {
		const itemData = items[i];
		itemData.x -= gameSpeed;
		itemData.element.style.left = `${itemData.x}px`;

		// Remove items that leave the screen
		if (itemData.x < -80) {
			itemData.element.remove();
			items.splice(i, 1);
			continue;
		}

		const itemRect = itemData.element.getBoundingClientRect();
		if (rectsOverlap(runnerRect, itemRect)) {
			handleCollision(itemData, i);
		}
	}
}

function updateSpawning() {
	spawnTimer += 1;

	if (spawnTimer >= nextSpawnTime) {
		createItem();
		spawnTimer = 0;
    nextSpawnTime = randomInRange(spawnMin, spawnMax);

    // Keep each difficulty feeling distinct, with a gentle speed ramp per mode
    gameSpeed = Math.min(gameSpeed + speedRamp, speedCap);
	}
}

function updateDistanceScore() {
	// Add +1 score repeatedly while the player survives
	distanceCounter += 1;
	if (distanceCounter >= 4) {
		score += 1;
		distanceCounter = 0;
		scoreLabel.textContent = `Score: ${score}`;
	}
}

function updateGameBackground() {
  const mode = selectedDifficulty;

  if (mode === 'hard') {
    game.classList.remove('day', 'evening');
    game.classList.add('night');
    jumpInfoMessage.textContent = difficultySettings.hard.message;
  } else if (mode === 'medium') {
    game.classList.remove('day', 'night');
    game.classList.add('evening');
    jumpInfoMessage.textContent = difficultySettings.medium.message;
  } else {
    game.classList.remove('evening', 'night');
    game.classList.add('day');
    jumpInfoMessage.textContent = difficultySettings.easy.message;
  }
}

function gameLoop() {
    if (isGameRunning) {
        updateRunner();
        updateItems();
        updateSpawning();
        updateDistanceScore();
        updateGameBackground(); // Keep background synced with selected difficulty
    }

    requestAnimationFrame(gameLoop);
}

// Input controls: spacebar + mouse/touch press
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);
game.addEventListener('pointerdown', onPointerDown);
document.addEventListener('pointerup', onPointerUp);
document.addEventListener('pointercancel', onPointerUp);

difficultyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedDifficulty = button.dataset.difficulty;
    difficultyButtons.forEach((otherButton) => {
      otherButton.classList.remove('active');
    });
    button.classList.add('active');

    const modeLabel = difficultySettings[selectedDifficulty].label;
    startPrompt.textContent = `Selected: ${modeLabel}. Press SPACE or TAP to jump.`;
    updateGameBackground();
  });
});

restartButton.addEventListener('click', () => {
	resetGame();
});

// Initial setup
resetGame();
requestAnimationFrame(gameLoop);