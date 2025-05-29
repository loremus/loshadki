const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const LEVEL_IMAGE_SRC = 'levels/map-002.png';
const PARTICIPANT_COUNT = 5;
const RADIUS = 15;
const GOAL_RADIUS = 5;

const PARTICIPANT_COLORS = ['red', 'blue', 'green', 'orange', 'purple'];

const PARTICIPANT_SPRITES_SRC = [
  'sprites/verkhvo.png',
  'sprites/arseno.png',
  'sprites/nosko.png',
  'sprites/gvaramo.png',
  'sprites/ostano.png',
];

/*const PRIZE_SPRITE_SRC = 'sprites/goal.gif';*/

const goalGif = document.getElementById('goalGif');

function updateGoalGifPosition() {
  goalGif.style.left = goal.x + 'px';
  goalGif.style.top = goal.y + 'px';
  goalGif.style.width = goal.radius * 5 + 'px';
  goalGif.style.height = goal.radius * 5 + 'px';
  goalGif.style.display = 'block';
}
const levelImage = new Image();
levelImage.src = LEVEL_IMAGE_SRC;

const participantSprites = [];
//let prizeSprite = new Image();

const participants = [];
let goal = null;
let winner = null;
let levelData = null;

let countdown = 5;  // seconds before race starts
let countdownInterval = null;

let imagesLoaded = 0;
const totalImagesToLoad = 1 + PARTICIPANT_COUNT; // level + participant sprites


// === Utility ===
function isWalkable(x, y) {
  if (!levelData) return true;
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return false;

  const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const [r, g, b] = [
    levelData[i],
    levelData[i + 1],
    levelData[i + 2]
  ];
  return r > 200 && g > 200 && b > 200; // white-ish
}

function isPositionSafe(x, y, vx, vy, radius = RADIUS) {
  // Check if circle at (x,y) is fully inside walkable area
  if (
    !isWalkable(x, y) ||
    !isWalkable(x + radius, y) ||
    !isWalkable(x - radius, y) ||
    !isWalkable(x, y + radius) ||
    !isWalkable(x, y - radius)
  ) {
    return false;
  }

  // Check if the next step with velocity will hit the wall
  const nextX = x + vx;
  const nextY = y + vy;

  if (
    !isWalkable(nextX + radius, y) ||
    !isWalkable(nextX - radius, y) ||
    !isWalkable(x, nextY + radius) ||
    !isWalkable(x, nextY - radius)
  ) {
    return false;
  }

  return true;
}

function getSafePlayablePositionInArea(xStart, yStart, width, height, vx, vy) {
  let attempts = 10000;
  while (attempts-- > 0) {
    const x = Math.floor(xStart + Math.random() * width);
    const y = Math.floor(yStart + Math.random() * height);

    if (isPositionSafe(x, y, vx, vy)) {
      return { x, y };
    }
  }
  // fallback
  return { x: xStart + width / 2, y: yStart + height / 2 };
}

// Find a playable position near the bottom-right corner within a margin box
function getPlayablePositionNearBottomRight(margin = 100) {
  let attempts = 10000;
  while (attempts-- > 0) {
    const x = canvas.width - 1 - Math.floor(Math.random() * margin);
    const y = canvas.height - 1 - Math.floor(Math.random() * margin);

    if (
      isWalkable(x, y) &&
      isWalkable(x + RADIUS, y) &&
      isWalkable(x - RADIUS, y) &&
      isWalkable(x, y + RADIUS) &&
      isWalkable(x, y - RADIUS)
    ) {
      return { x, y };
    }
  }
  // fallback if no found
  return { x: canvas.width - margin, y: canvas.height - margin };
}

function drawParticipant(p) {
  const size = RADIUS * 2;
  ctx.drawImage(
    p.sprite,
    p.x - RADIUS,
    p.y - RADIUS,
    size,
    size
  );
}

/*function drawPrize() {
  const size = RADIUS_GOAL * 2;
  ctx.drawImage(
    prizeSprite,
    goal.x - RADIUS,
    goal.y - RADIUS,
    size,
    size
  );
}*/

function drawCircle(x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.closePath();
}

const spawnAreaX = 60;
const spawnAreaY = 60;
const spawnAreaWidth = 200;
const spawnAreaHeight = 100;

function drawSpawnArea() {
  ctx.save();
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]); // dashed line
  ctx.strokeRect(spawnAreaX, spawnAreaY, spawnAreaWidth, spawnAreaHeight);
  ctx.restore();
}

// === Game Logic ===
function createParticipants() {
  for (let i = 0; i < PARTICIPANT_COUNT; i++) {

    // Pick random angle and derive velocity vector
    const angle = Math.random() * 2 * Math.PI;
    const speed = 1.1;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const pos = getSafePlayablePositionInArea(spawnAreaX, spawnAreaY, spawnAreaWidth, spawnAreaHeight, vx, vy);

    const name = PARTICIPANT_SPRITES_SRC[i].split('/').pop().split('.')[0].toUpperCase();

    participants.push({
      x: pos.x,
      y: pos.y,
      vx,
      vy,
	  baseSpeed: speed,   // <-- add this
      color: PARTICIPANT_COLORS[i],
	  sprite: participantSprites[i],
      alive: true,
	  name: name   // <-- add this property!
    });
  }

	const goalPos = getPlayablePositionNearBottomRight();
	goal = { 
	  x: goalPos.x,
	  y: goalPos.y,
	  radius: GOAL_RADIUS,
	  color: 'gold' // you can keep this if you want
	  // no sprite property needed here
	};
}

function updateParticipant(p) {
  let nextX = p.x + p.vx;
  let nextY = p.y + p.vy;

  let collidedX = false;
  let collidedY = false;

  const angleVariation = (Math.random() - 0.5) * (Math.PI / 18); // ±10°

  // Check future positions with radius buffer
  if (
    !isWalkable(nextX + RADIUS, p.y) ||
    !isWalkable(nextX - RADIUS, p.y)
  ) {
    // Reflect horizontally, then add variation
    p.vx = -p.vx;
    // Rotate velocity vector by a small random angle
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    let angle = Math.atan2(p.vy, p.vx);
    angle += angleVariation;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    collidedX = true;
  }

  if (
    !isWalkable(p.x, nextY + RADIUS) ||
    !isWalkable(p.x, nextY - RADIUS)
  ) {
    // Reflect vertically, then add variation
    p.vy = -p.vy;
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    let angle = Math.atan2(p.vy, p.vx);
    angle += angleVariation;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    collidedY = true;
  }

  // Smooth speed return
  const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
  const speedDiff = p.baseSpeed - currentSpeed;

  // Adjust speed by a fraction to smooth (e.g. 5% per frame)
  const adjustment = speedDiff * 0.05;

  const angle = Math.atan2(p.vy, p.vx);
  const newSpeed = currentSpeed + adjustment;

  p.vx = Math.cos(angle) * newSpeed;
  p.vy = Math.sin(angle) * newSpeed;

  // Move only if not colliding in that direction
  if (!collidedX) p.x += p.vx;
  if (!collidedY) p.y += p.vy;
}

function checkGoalCollision(p) {
  const dx = p.x - goal.x;
  const dy = p.y - goal.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < (RADIUS + goal.radius)) {
    p.alive = false;
    winner = p;
    return true;
  }
  return false;
}

function gameLoop() {
  let winner = null;
  for (let i = 0; i < participants.length; i++) {
	  const p = participants[i];
	  if (!p.alive) continue;

	  updateParticipant(p);

	  // Check goal collision
	  if (checkGoalCollision(p)) {
		winner = p;
		p.alive = false;
	  }
	}

	// Handle participant-participant collisions
	for (let i = 0; i < participants.length; i++) {
	  for (let j = i + 1; j < participants.length; j++) {
		const a = participants[i];
		const b = participants[j];

		if (!a.alive || !b.alive) continue;

		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < RADIUS * 2) {
		  // Normalize
		  const nx = dx / dist;
		  const ny = dy / dist;

		  // Relative velocity
		  const dvx = b.vx - a.vx;
		  const dvy = b.vy - a.vy;

		  // Velocity along normal
		  const relVel = dvx * nx + dvy * ny;

		  if (relVel < 0) {
			// Reflect velocities
			const impulse = relVel;

			a.vx += impulse * nx;
			a.vy += impulse * ny;

			b.vx -= impulse * nx;
			b.vy -= impulse * ny;
		  }

		  // Push them apart to prevent sticking
		  const overlap = RADIUS * 2 - dist;
		  const correction = overlap / 2;

		  a.x -= nx * correction;
		  a.y -= ny * correction;

		  b.x += nx * correction;
		  b.y += ny * correction;
		}
	  }
	}

  draw();

  if (!winner) {
    requestAnimationFrame(gameLoop);
  } else {
    console.log('Winner:', winner.color);
    draw(); // Final frame
    ctx.fillStyle = 'black';
    ctx.font = '24px sans-serif';
    ctx.fillText(`Winner: ${winner.color}`, 20, 30);
  }
}

const gradient = ctx.createLinearGradient(canvas.width / 2 - 100, 0, canvas.width / 2 + 100, 0);
	gradient.addColorStop(0.0, 'red');
	gradient.addColorStop(0.2, 'orange');
	gradient.addColorStop(0.4, 'yellow');
	gradient.addColorStop(0.6, 'green');
	gradient.addColorStop(0.8, 'blue');
	gradient.addColorStop(1.0, 'violet');

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(levelImage, 0, 0, canvas.width, canvas.height);

  drawSpawnArea();

  participants.forEach(p => {
    if (p.alive) drawParticipant(p);
  });

  if (goal) {
    updateGoalGifPosition();

    // DEBUG: Draw logical goal position and radius
    ctx.beginPath();
    ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw goal center for clarity
    ctx.fillStyle = 'red';
    ctx.fillRect(goal.x - 2, goal.y - 2, 4, 4);
  }
  
  if (winner) {
	  ctx.fillStyle = gradient;
	  ctx.font = 'bold 40px sans-serif';
	  ctx.textAlign = 'center';
	  ctx.fillText(`${winner.name} WINS!`, canvas.width / 2, canvas.height / 2);
	}
}

function drawCountdown() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(levelImage, 0, 0, canvas.width, canvas.height);

  // Draw the "Place your bets" message
	ctx.fillStyle = '#d2b48c'; // cream beige
	ctx.font = 'bold 36px sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText('PLACE YOUR BETS!', canvas.width / 2, 100);

	ctx.fillStyle = gradient;
	ctx.font = 'bold 28px sans-serif';
	ctx.fillText(`Starting in ${countdown}...`, canvas.width / 2, 150);

  // Draw participant list with numbers and names
  ctx.font = '24px monospace';
  ctx.textAlign = 'left';

  participants.forEach((p, i) => {
    const text = `${i + 1}. ${p.name}`;
    ctx.fillStyle = p.color;
    ctx.fillText(text, 50, 200 + i * 30);
  });
}

function startCountdown() {
  drawCountdown();
  countdownInterval = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      gameLoop();
    } else {
      drawCountdown();
    }
  }, 1000);
}

function tryStartGame() {
  if (imagesLoaded === totalImagesToLoad) {
    startGame();
  }
}

function startGame() {
  const levelCanvas = document.createElement('canvas');
  levelCanvas.width = canvas.width;
  levelCanvas.height = canvas.height;
  const levelCtx = levelCanvas.getContext('2d');
  levelCtx.drawImage(levelImage, 0, 0, canvas.width, canvas.height);
  levelData = levelCtx.getImageData(0, 0, canvas.width, canvas.height).data;

  createParticipants();

  startCountdown();
}

// === Image loading ===
levelImage.onload = () => {
  imagesLoaded++;
  tryStartGame();
};

for (let i = 0; i < PARTICIPANT_SPRITES_SRC.length; i++) {
  participantSprites[i] = new Image();
  participantSprites[i].src = PARTICIPANT_SPRITES_SRC[i];
  participantSprites[i].onload = () => {
    imagesLoaded++;
    tryStartGame();
  };
}