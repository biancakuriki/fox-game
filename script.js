const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('bestScore');
const gameOverElement = document.getElementById('gameOver');
const milestoneBannerElement = document.getElementById('milestoneBanner');

const GROUND_Y = 150;
const SCORE_RATE = 18;
const BEST_SCORE_KEY = 'kawaii-dino-best-score';

const dino = {
    x: 58,
    y: GROUND_Y,
    baseWidth: 40,
    baseHeight: 40,
    width: 40,
    height: 40,
    velocityY: 0,
    gravity: 0.68,
    jumpPower: -12.8,
    onGround: true,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    squash: 0,
    stretch: 0,
    bodyBob: 0
};

let obstacles = [];
let particles = [];
let score = 0;
let bestScore = loadBestScore();
let gameOver = false;
let gameSpeed = 5.4;
let animationFrame = 0;
let spawnQueue = [];
let nextSpawnTimer = 70;
let milestoneTimer = 0;
let lastMilestoneScore = 0;
let lastTime = 0;
let audioContext = null;

const cloudBands = [
    { x: 90, y: 36, scale: 0.9, speed: 0.18 },
    { x: 270, y: 26, scale: 0.7, speed: 0.12 },
    { x: 610, y: 42, scale: 1.05, speed: 0.2 }
];

const hills = [
    { x: 40, width: 180, height: 28, color: '#ffe7b9', speed: 0.3 },
    { x: 280, width: 230, height: 34, color: '#ffd8b5', speed: 0.24 },
    { x: 610, width: 200, height: 26, color: '#ffeec7', speed: 0.32 }
];

const decorations = [
    { x: 120, color: '#ffc4dd', size: 10, speed: 1 },
    { x: 240, color: '#ffe08a', size: 9, speed: 1 },
    { x: 390, color: '#ffbfd2', size: 11, speed: 1 },
    { x: 540, color: '#ffd89b', size: 8, speed: 1 },
    { x: 710, color: '#ffc4dd', size: 10, speed: 1 }
];

const cactusImage = new Image();
const birdImage = new Image();
const foxImage = new Image();
const foxRunImage1 = new Image();
const foxRunImage2 = new Image();

function loadImage(image, src) {
    return new Promise((resolve) => {
        image.onload = () => resolve();
        image.onerror = () => resolve();
        image.src = src;
    });
}

function loadObstacleImages() {
    return Promise.all([
        loadImage(cactusImage, 'assets/cactus.svg'),
        loadImage(birdImage, 'assets/bird.svg'),
        loadImage(foxImage, 'assets/fox.svg'),
        loadImage(foxRunImage1, 'assets/fox-run-1.svg'),
        loadImage(foxRunImage2, 'assets/fox-run-2.svg')
    ]);
}

function loadBestScore() {
    try {
        const storedScore = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) || '0', 10);
        return Number.isFinite(storedScore) ? storedScore : 0;
    } catch (error) {
        return 0;
    }
}

function saveBestScore() {
    try {
        localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    } catch (error) {
        // Ignore storage failures so gameplay still works in restricted browsers.
    }
}

function updateBestScoreDisplay() {
    bestScoreElement.textContent = `Best: ${bestScore}`;
}

function schedulePattern() {
    const densePatterns = [
        [
            { kind: 'cactus', delay: [60, 84] },
            { kind: 'cactus', delay: [76, 100] }
        ],
        [
            { kind: 'bird-low', delay: [78, 104] },
            { kind: 'cactus', delay: [82, 112] }
        ],
        [
            { kind: 'cactus', delay: [56, 76] },
            { kind: 'bird-mid', delay: [104, 132] }
        ],
        [
            { kind: 'cactus', delay: [62, 86] },
            { kind: 'cactus', delay: [82, 108] },
            { kind: 'bird-low', delay: [116, 144] }
        ],
        [
            { kind: 'bird-mid', delay: [86, 114] }
        ],
        [
            { kind: 'cactus', delay: [68, 92] }
        ]
    ];

    const saferPatterns = [
        [
            { kind: 'cactus', delay: [74, 104] }
        ],
        [
            { kind: 'bird-low', delay: [88, 122] }
        ],
        [
            { kind: 'cactus', delay: [70, 100] },
            { kind: 'cactus', delay: [90, 124] }
        ]
    ];

    const patternPool = score > 160 ? densePatterns : saferPatterns;
    const pattern = patternPool[Math.floor(Math.random() * patternPool.length)];
    spawnQueue = pattern.map((step) => ({
        kind: step.kind,
        delay: randomBetween(step.delay[0], step.delay[1])
    }));
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function createObstacle(kind) {
    const variants = {
        cactus: {
            width: 28,
            height: 40,
            y: 150,
            image: cactusImage,
            hitbox: { x: 5, y: 3, width: 18, height: 34 }
        },
        'bird-low': {
            width: 38,
            height: 26,
            y: 122,
            image: birdImage,
            hitbox: { x: 4, y: 5, width: 30, height: 16 }
        },
        'bird-mid': {
            width: 38,
            height: 26,
            y: 106,
            image: birdImage,
            hitbox: { x: 4, y: 5, width: 30, height: 16 }
        }
    };

    const config = variants[kind];
    obstacles.push({
        x: canvas.width + 8,
        y: config.y,
        width: config.width,
        height: config.height,
        kind,
        image: config.image,
        hitbox: config.hitbox,
        wingPhase: Math.random() * Math.PI * 2
    });
}

function trySpawnObstacle() {
    if (spawnQueue.length === 0) {
        schedulePattern();
    }

    if (nextSpawnTimer > 0 || spawnQueue.length === 0) {
        return;
    }

    const nextObstacle = spawnQueue.shift();
    const lastObstacle = obstacles[obstacles.length - 1];
    const minimumGap = Math.max(118, 154 - gameSpeed * 7);

    if (lastObstacle && canvas.width + 8 - lastObstacle.x < minimumGap) {
        nextSpawnTimer = 10;
        spawnQueue.unshift(nextObstacle);
        return;
    }

    createObstacle(nextObstacle.kind);
    nextSpawnTimer = nextObstacle.delay;
}

function update(deltaFrames) {
    if (gameOver) {
        draw();
        return;
    }

    animationFrame += deltaFrames;
    nextSpawnTimer = Math.max(0, nextSpawnTimer - deltaFrames);
    milestoneTimer = Math.max(0, milestoneTimer - deltaFrames);

    score += (deltaFrames / 60) * SCORE_RATE;
    const displayedScore = Math.floor(score);
    if (displayedScore > bestScore) {
        bestScore = displayedScore;
        saveBestScore();
    }
    updateBestScoreDisplay();
    scoreElement.textContent = `Score: ${displayedScore}`;
    updateMilestones(displayedScore);

    gameSpeed = 5.4 + Math.min(6.4, score / 135);

    updateScenery(deltaFrames);
    updateDino(deltaFrames);
    updateObstacles(deltaFrames);
    updateParticles(deltaFrames);
    trySpawnObstacle();

    draw();
}

function updateMilestones(displayedScore) {
    const milestone = Math.floor(displayedScore / 100) * 100;
    if (milestone >= 100 && milestone !== lastMilestoneScore) {
        lastMilestoneScore = milestone;
        milestoneTimer = 110;
        milestoneBannerElement.textContent = `${milestone}! So cute, so fast`;
        milestoneBannerElement.style.display = 'block';
        playChime(740, 0.06, 'triangle');
        setTimeout(() => playChime(920, 0.08, 'triangle'), 70);
    }

    if (milestoneTimer <= 0) {
        milestoneBannerElement.style.display = 'none';
    }
}

function updateScenery(deltaFrames) {
    for (const cloud of cloudBands) {
        cloud.x -= cloud.speed * deltaFrames;
        if (cloud.x < -80) {
            cloud.x = canvas.width + randomBetween(20, 120);
        }
    }

    for (const hill of hills) {
        hill.x -= hill.speed * deltaFrames;
        if (hill.x + hill.width < 0) {
            hill.x = canvas.width + randomBetween(40, 150);
        }
    }

    for (const decoration of decorations) {
        decoration.x -= decoration.speed * gameSpeed * 0.55 * deltaFrames;
        if (decoration.x < -20) {
            decoration.x = canvas.width + randomBetween(40, 180);
            decoration.size = randomBetween(8, 11);
            decoration.color = Math.random() < 0.5 ? '#ffc4dd' : '#ffe08a';
        }
    }
}

function updateDino(deltaFrames) {
    dino.jumpBufferTimer = Math.max(0, dino.jumpBufferTimer - deltaFrames);

    if (dino.onGround) {
        dino.coyoteTimer = 8;
    } else {
        dino.coyoteTimer = Math.max(0, dino.coyoteTimer - deltaFrames);
    }

    if (dino.jumpBufferTimer > 0 && (dino.onGround || dino.coyoteTimer > 0)) {
        performJump();
    }

    dino.velocityY += dino.gravity * deltaFrames;
    dino.y += dino.velocityY * deltaFrames;

    const wasOnGround = dino.onGround;
    if (dino.y >= GROUND_Y) {
        dino.y = GROUND_Y;
        dino.velocityY = 0;
        dino.onGround = true;
        if (!wasOnGround) {
            triggerLanding();
        }
    } else {
        dino.onGround = false;
    }

    const runningPulse = dino.onGround ? Math.sin(animationFrame * 0.22) : 0;
    dino.bodyBob = dino.onGround ? runningPulse * 1.4 : -1.2;
    dino.squash = moveTowards(dino.squash, dino.onGround ? 0 : -0.1, 0.11 * deltaFrames);
    dino.stretch = moveTowards(dino.stretch, dino.onGround ? 0 : 0.08, 0.12 * deltaFrames);

    dino.width = dino.baseWidth * (1 + dino.stretch + dino.squash);
    dino.height = dino.baseHeight * (1 - dino.squash * 0.8 + dino.stretch * 0.25);
}

function triggerLanding() {
    dino.squash = 0.16;
    dino.stretch = -0.04;
    addDustBurst(dino.x + 12, 187, '#f3d9a9');
    addDustBurst(dino.x + 28, 187, '#f7dfb8');
    playChime(180, 0.04, 'sine');
}

function performJump() {
    dino.velocityY = dino.jumpPower;
    dino.onGround = false;
    dino.coyoteTimer = 0;
    dino.jumpBufferTimer = 0;
    dino.squash = -0.08;
    dino.stretch = 0.18;
    addDustBurst(dino.x + 10, 187, '#f5ddae');
    addDustBurst(dino.x + 26, 187, '#f1d2a5');
    playChime(420, 0.08, 'square');
}

function updateObstacles(deltaFrames) {
    for (const obstacle of obstacles) {
        obstacle.x -= gameSpeed * deltaFrames;
        obstacle.wingPhase += 0.22 * deltaFrames;
    }

    obstacles = obstacles.filter((obstacle) => obstacle.x > -obstacle.width - 30);

    const dinoHitbox = getDinoHitbox();
    for (const obstacle of obstacles) {
        const obstacleHitbox = getObstacleHitbox(obstacle);
        if (rectanglesOverlap(dinoHitbox, obstacleHitbox)) {
            gameOver = true;
            gameOverElement.style.display = 'flex';
            playChime(130, 0.12, 'sawtooth');
            playChime(90, 0.18, 'triangle');
            break;
        }
    }
}

function updateParticles(deltaFrames) {
    particles = particles.filter((particle) => {
        particle.x += particle.vx * deltaFrames;
        particle.y += particle.vy * deltaFrames;
        particle.vy += 0.05 * deltaFrames;
        particle.life -= deltaFrames;
        particle.size *= 0.985;
        return particle.life > 0 && particle.size > 0.6;
    });

    if (dino.onGround && !gameOver && Math.floor(animationFrame) % 9 === 0) {
        particles.push({
            x: dino.x + randomBetween(7, 17),
            y: 188,
            vx: randomBetween(-0.55, -0.15),
            vy: randomBetween(-0.35, -0.15),
            size: randomBetween(2.2, 3.4),
            life: randomBetween(12, 18),
            color: '#f5dfb7'
        });
    }
}

function addDustBurst(x, y, color) {
    for (let i = 0; i < 6; i += 1) {
        particles.push({
            x,
            y,
            vx: randomBetween(-1.2, 0.5),
            vy: randomBetween(-1.2, -0.25),
            size: randomBetween(2.6, 4.8),
            life: randomBetween(10, 20),
            color
        });
    }
}

function getDinoHitbox() {
    return {
        x: dino.x + 7,
        y: dino.y + 6,
        width: dino.width - 14,
        height: dino.height - 10
    };
}

function getObstacleHitbox(obstacle) {
    return {
        x: obstacle.x + obstacle.hitbox.x,
        y: obstacle.y + obstacle.hitbox.y,
        width: obstacle.hitbox.width,
        height: obstacle.hitbox.height
    };
}

function rectanglesOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#fffafd');
    skyGradient.addColorStop(0.55, '#fff4fa');
    skyGradient.addColorStop(1, '#fff9ee');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawSunGlow();
    drawHills();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (const cloud of cloudBands) {
        drawCloud(cloud.x, cloud.y, cloud.scale);
    }

    const groundGradient = ctx.createLinearGradient(0, 180, 0, 200);
    groundGradient.addColorStop(0, '#f7deb0');
    groundGradient.addColorStop(1, '#e7ba73');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, 188, canvas.width, 12);

    ctx.fillStyle = '#fff0ca';
    for (let x = 0; x < canvas.width; x += 36) {
        ctx.fillRect(x, 185, 18, 3);
    }

    drawDecorations();
    drawParticles();
    drawFox();
    drawObstacles();
}

function drawSunGlow() {
    const glow = ctx.createRadialGradient(690, 24, 8, 690, 24, 70);
    glow.addColorStop(0, 'rgba(255, 245, 210, 0.9)');
    glow.addColorStop(1, 'rgba(255, 245, 210, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(690, 24, 70, 0, Math.PI * 2);
    ctx.fill();
}

function drawHills() {
    for (const hill of hills) {
        ctx.fillStyle = hill.color;
        ctx.beginPath();
        ctx.moveTo(hill.x, 188);
        ctx.quadraticCurveTo(hill.x + hill.width / 2, 188 - hill.height, hill.x + hill.width, 188);
        ctx.closePath();
        ctx.fill();
    }
}

function drawDecorations() {
    for (const decoration of decorations) {
        ctx.save();
        ctx.translate(decoration.x, 187);
        ctx.fillStyle = '#84c56c';
        ctx.fillRect(-0.8, -8, 1.6, 8);
        ctx.fillStyle = decoration.color;
        ctx.beginPath();
        ctx.arc(0, -10, decoration.size / 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-3.5, -8.5, decoration.size / 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3.5, -8.5, decoration.size / 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawParticles() {
    for (const particle of particles) {
        ctx.globalAlpha = Math.max(0, particle.life / 20);
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawCloud(x, y, scale) {
    ctx.beginPath();
    ctx.arc(x, y, 12 * scale, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + 14 * scale, y - 6 * scale, 14 * scale, Math.PI, 0);
    ctx.arc(x + 30 * scale, y, 12 * scale, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
}

function drawFox() {
    const foxSprite = getFoxSprite();
    const spriteX = dino.x - (dino.width - dino.baseWidth) / 2;
    const spriteY = dino.y - dino.bodyBob - (dino.height - dino.baseHeight);

    if (foxSprite && foxSprite.complete && foxSprite.naturalWidth) {
        ctx.drawImage(foxSprite, spriteX, spriteY, dino.width, dino.height);
        return;
    }

    ctx.fillStyle = '#ff975e';
    ctx.fillRect(spriteX, spriteY, dino.width, dino.height);
}

function drawObstacles() {
    obstacles.forEach((obstacle) => {
        const imageReady = obstacle.image && obstacle.image.complete && obstacle.image.naturalWidth;
        const wobble = obstacle.kind.startsWith('bird') ? Math.sin(obstacle.wingPhase) * 2 : 0;

        if (imageReady) {
            ctx.drawImage(
                obstacle.image,
                obstacle.x,
                obstacle.y + wobble,
                obstacle.width,
                obstacle.height
            );
        } else {
            ctx.fillStyle = obstacle.kind.startsWith('bird') ? '#77c6ff' : '#68bb63';
            ctx.fillRect(obstacle.x, obstacle.y + wobble, obstacle.width, obstacle.height);
        }
    });
}

function getFoxSprite() {
    if (!dino.onGround || gameOver) {
        return foxImage;
    }

    return Math.floor(animationFrame / 7) % 2 === 0 ? foxRunImage1 : foxRunImage2;
}

function moveTowards(current, target, amount) {
    if (current < target) {
        return Math.min(current + amount, target);
    }
    return Math.max(current - amount, target);
}

function requestJump() {
    if (gameOver) {
        restart();
        return;
    }

    dino.jumpBufferTimer = 8;
    unlockAudio();
}

function restart() {
    dino.y = GROUND_Y;
    dino.width = dino.baseWidth;
    dino.height = dino.baseHeight;
    dino.velocityY = 0;
    dino.onGround = true;
    dino.coyoteTimer = 0;
    dino.jumpBufferTimer = 0;
    dino.squash = 0;
    dino.stretch = 0;
    dino.bodyBob = 0;
    obstacles = [];
    particles = [];
    score = 0;
    gameOver = false;
    gameSpeed = 5.4;
    animationFrame = 0;
    spawnQueue = [];
    nextSpawnTimer = 70;
    milestoneTimer = 0;
    lastMilestoneScore = 0;
    milestoneBannerElement.style.display = 'none';
    gameOverElement.style.display = 'none';
    scoreElement.textContent = 'Score: 0';
}

function unlockAudio() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
        return;
    }

    if (!audioContext) {
        audioContext = new AudioCtor();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

function playChime(frequency, duration, type) {
    if (!audioContext) {
        return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.001;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;
    gainNode.gain.exponentialRampToValueAtTime(0.04, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.start(now);
    oscillator.stop(now + duration);
}

document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        requestJump();
    }
});

canvas.addEventListener('pointerdown', () => {
    requestJump();
});

function gameLoop(timestamp) {
    if (!lastTime) {
        lastTime = timestamp;
    }

    const deltaMs = Math.min(32, timestamp - lastTime);
    lastTime = timestamp;
    const deltaFrames = deltaMs / (1000 / 60);

    update(deltaFrames);
    requestAnimationFrame(gameLoop);
}

loadObstacleImages().then(() => {
    updateBestScoreDisplay();
    restart();
    requestAnimationFrame(gameLoop);
});
