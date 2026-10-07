const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameArea = document.getElementById('game-area');
const gameCard = document.querySelector('.game-card');
const overlay = document.getElementById('game-overlay');
const overlayKicker = document.getElementById('overlay-kicker');
const overlayTitle = document.getElementById('overlay-title');
const overlayDescription = document.getElementById('overlay-description');
const startButton = document.getElementById('start-button');
const jumpButton = document.getElementById('jump-button');
const pauseButton = document.getElementById('pause-button');
const soundButton = document.getElementById('sound-button');
const fullscreenButton = document.getElementById('fullscreen-button');
const scoreDisplay = document.getElementById('score-display');
const bestDisplay = document.getElementById('best-display');

let width = 0;
let height = 0;
let groundY = 0;
let horseX = 0;
let horseScale = 1;
let status = 'ready';
let distance = 0;
let best = 0;
let speed = 325;
let scroll = 0;
let time = 0;
let spawnTimer = 1.4;
let dustTimer = 0;
let jumpHeight = 0;
let jumpVelocity = 0;
let lastFrame = 0;
let muted = false;
let audioContext;
let obstacles = [];
let particles = [];

try {
  best = Number(localStorage.getItem('canter-best')) || 0;
} catch (_) {
  best = 0;
}

function formatDistance(value) {
  return `${String(Math.floor(value)).padStart(4, '0')} <span>m</span>`;
}

bestDisplay.innerHTML = formatDistance(best);

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundY = height - Math.max(76, Math.min(102, height * .19));
  horseX = Math.max(87, Math.min(width * .23, 240));
  horseScale = Math.max(.72, Math.min(1, width / 700));
}

function setOverlay(kicker, title, description, button) {
  overlayKicker.textContent = kicker;
  overlayTitle.innerHTML = title;
  overlayDescription.textContent = description;
  startButton.innerHTML = `${button} <span aria-hidden="true">↗</span>`;
  overlay.classList.remove('is-hidden');
}

function startGame() {
  distance = 0;
  speed = 325;
  scroll = 0;
  spawnTimer = 1.4;
  dustTimer = 0;
  jumpHeight = 0;
  jumpVelocity = 0;
  obstacles = [];
  particles = [];
  scoreDisplay.innerHTML = formatDistance(0);
  status = 'running';
  overlay.classList.add('is-hidden');
  jumpButton.disabled = false;
  pauseButton.disabled = false;
  pauseButton.classList.remove('is-paused');
  pauseButton.setAttribute('aria-label', 'Pause game');
  pauseButton.title = 'Pause game';
  if (document.activeElement === startButton) startButton.blur();
}

function pauseGame() {
  if (status !== 'running') return;
  status = 'paused';
  jumpButton.disabled = true;
  pauseButton.classList.add('is-paused');
  pauseButton.setAttribute('aria-label', 'Resume game');
  pauseButton.title = 'Resume game';
  setOverlay('A MOMENT TO BREATHE', 'Taking a<br><em>breather?</em>', 'The trail will be right here when you are ready.', 'Keep riding');
}

function resumeGame() {
  if (status !== 'paused') return;
  status = 'running';
  jumpButton.disabled = false;
  pauseButton.classList.remove('is-paused');
  pauseButton.setAttribute('aria-label', 'Pause game');
  pauseButton.title = 'Pause game';
  overlay.classList.add('is-hidden');
  if (document.activeElement === startButton) startButton.blur();
}

function endGame() {
  status = 'over';
  jumpButton.disabled = true;
  pauseButton.disabled = true;
  playSound('hit');
  if (Math.floor(distance) > best) {
    best = Math.floor(distance);
    bestDisplay.innerHTML = formatDistance(best);
    try {
      localStorage.setItem('canter-best', String(best));
    } catch (_) {}
  }
  setOverlay('THE TRAIL CONTINUES', 'What a<br><em>ride.</em>', `You rode ${Math.floor(distance)} meters. Dust yourself off and give it another go.`, 'Ride again');
}

function jump() {
  if (status !== 'running' || jumpHeight > 0) return;
  jumpVelocity = 730;
  jumpHeight = .01;
  playSound('jump');
  for (let i = 0; i < 6; i++) addDust(horseX - 20 * horseScale, groundY + 1);
}

function action() {
  if (status === 'ready' || status === 'over') startGame();
  else if (status === 'paused') resumeGame();
  else jump();
}

function playSound(kind) {
  if (muted) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    audioContext ||= new Audio();
    if (audioContext.state === 'suspended') audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const duration = kind === 'hit' ? .24 : kind === 'score' ? .13 : .18;
    oscillator.type = kind === 'hit' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(kind === 'hit' ? 190 : kind === 'score' ? 650 : 360, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'hit' ? 65 : kind === 'score' ? 900 : 600, now + duration);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.09, now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (_) {}
}

function addDust(x, y) {
  particles.push({
    x: x + (Math.random() - .5) * 19,
    y,
    vx: -30 - Math.random() * 75,
    vy: -15 - Math.random() * 38,
    life: .35 + Math.random() * .25,
    maxLife: .6,
    radius: 2 + Math.random() * 3
  });
  if (particles.length > 50) particles.shift();
}

function update(dt) {
  if (status === 'ready') {
    time += dt;
    scroll += dt * 13;
    return;
  }
  if (status !== 'running') return;

  time += dt;
  speed = 325 + Math.min(distance * .22, 200);
  scroll += speed * dt;
  distance += speed * dt / 16;
  scoreDisplay.innerHTML = formatDistance(distance);

  if (jumpHeight > 0) {
    jumpHeight += jumpVelocity * dt;
    jumpVelocity -= 1750 * dt;
    if (jumpHeight <= 0) {
      jumpHeight = 0;
      jumpVelocity = 0;
      for (let i = 0; i < 8; i++) addDust(horseX, groundY);
    }
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const type = Math.random() < .55 ? 'fence' : 'hay';
    const scale = Math.max(.78, Math.min(1, width / 750));
    obstacles.push({ x: width + 48, type, width: (type === 'fence' ? 49 : 53) * scale, height: (type === 'fence' ? 66 : 49) * scale, passed: false });
    spawnTimer = 1.23 + Math.random() * .5 - Math.min(distance / 2200, .18);
  }

  for (const obstacle of obstacles) {
    obstacle.x -= speed * dt;
    if (!obstacle.passed && obstacle.x + obstacle.width < horseX - 32 * horseScale) {
      obstacle.passed = true;
      playSound('score');
    }
    const overlapping = obstacle.x < horseX + 40 * horseScale && obstacle.x + obstacle.width > horseX - 29 * horseScale;
    const tooLow = groundY - jumpHeight - 7 * horseScale > groundY - obstacle.height + 9;
    if (overlapping && tooLow) {
      endGame();
      break;
    }
  }
  obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > -30);

  dustTimer -= dt;
  if (jumpHeight === 0 && dustTimer <= 0 && status === 'running') {
    addDust(horseX - 27 * horseScale, groundY);
    dustTimer = .075;
  }
  for (const particle of particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 75 * dt;
    particle.life -= dt;
  }
  particles = particles.filter(particle => particle.life > 0);
}

function roundedRect(x, y, w, h, radius, fill, stroke) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function ellipse(x, y, rx, ry, fill, stroke, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function drawCloud(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff9e3a1';
  ctx.beginPath();
  ctx.ellipse(0, 7, 46, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(-15, 0, 24, 16, 0, 0, Math.PI * 2);
  ctx.ellipse(12, -7, 28, 20, 0, 0, Math.PI * 2);
  ctx.ellipse(35, 2, 20, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHill(color, baseline, amplitude, wavelength, offset) {
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width + 10; x += 10) {
    const y = baseline + Math.sin((x + offset) / wavelength) * amplitude + Math.sin((x + offset) / (wavelength * .47)) * amplitude * .22;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTree(x, y, size, shade) {
  ctx.fillStyle = '#726e50';
  ctx.fillRect(x - 2 * size, y - 6 * size, 4 * size, 26 * size);
  ellipse(x, y - 29 * size, 15 * size, 25 * size, shade);
  ellipse(x - 8 * size, y - 22 * size, 11 * size, 17 * size, shade);
  ellipse(x + 9 * size, y - 18 * size, 11 * size, 16 * size, shade);
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#aed6d5');
  sky.addColorStop(.65, '#d8e3cd');
  sky.addColorStop(1, '#f3e5b9');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  const sunX = width * .73;
  const sunY = height * .24;
  const glow = ctx.createRadialGradient(sunX, sunY, 13, sunX, sunY, 104);
  glow.addColorStop(0, '#fff4bdad');
  glow.addColorStop(1, '#fff4bd00');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 110, sunY - 110, 220, 220);
  ellipse(sunX, sunY, 39, 39, '#f8dc95');

  const cloudShift = scroll * .045;
  drawCloud(width * .15 - cloudShift % (width + 190), height * .2, .9);
  drawCloud(width * .67 - cloudShift * .65 % (width + 190), height * .12, .62);
  drawCloud(width + 75 - cloudShift % (width + 190), height * .29, .75);

  drawHill('#bdcfb8', groundY - 113, 30, 110, scroll * .025);
  drawHill('#9dbca6', groundY - 78, 28, 175, scroll * .06 + 120);
  drawHill('#79a08a', groundY - 48, 20, 118, scroll * .1 + 50);

  const treeOffset = (scroll * .16) % 220;
  for (let x = -220 - treeOffset; x < width + 260; x += 220) {
    drawTree(x + 82, groundY - 52, .75, '#608a72');
    drawTree(x + 176, groundY - 46, .46, '#709881');
  }

  drawHill('#658e72', groundY - 17, 13, 98, scroll * .16 + 37);
  ctx.fillStyle = '#759b74';
  ctx.fillRect(0, groundY - 13, width, 23);
  ctx.fillStyle = '#527e62';
  ctx.fillRect(0, groundY + 6, width, 6);
  ctx.fillStyle = '#ead9ac';
  ctx.fillRect(0, groundY + 12, width, height - groundY);
  ctx.fillStyle = '#e2ca98';
  ctx.fillRect(0, groundY + 21, width, 4);
  ctx.fillStyle = '#f1e2b9';
  ctx.fillRect(0, height - 26, width, 26);

  const postOffset = (scroll * .55) % 120;
  ctx.strokeStyle = '#5d795b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY - 22);
  ctx.lineTo(width, groundY - 22);
  ctx.stroke();
  for (let x = -120 - postOffset; x < width + 120; x += 120) {
    roundedRect(x, groundY - 31, 6, 35, 2, '#537858');
  }

  for (let i = 0; i < Math.ceil(width / 90) + 2; i++) {
    const x = i * 90 - scroll * .8 % 90;
    ellipse(x + 42, groundY + 49 + (i % 3) * 13, 8, 2, '#d6bb8e9c', null, -.12);
    ellipse(x + 8, height - 21 - (i % 2) * 11, 4, 2, '#d6bb8e9c');
  }
}

function drawFence(obstacle) {
  const { x, width: w, height: h } = obstacle;
  const y = groundY + 7;
  ellipse(x + w / 2, y + 3, w * .58, 5, '#9f925d58');
  roundedRect(x + 2, y - h, 9, h, 2, '#8c5a3b', '#684a36');
  roundedRect(x + w - 11, y - h, 9, h, 2, '#8c5a3b', '#684a36');
  roundedRect(x, y - h + 12, w, 10, 2, '#d59b60', '#8e613e');
  roundedRect(x, y - h + 34, w, 10, 2, '#d59b60', '#8e613e');
  ctx.fillStyle = '#f1c088';
  ctx.fillRect(x + 3, y - h + 14, w - 6, 2);
  ctx.fillRect(x + 3, y - h + 36, w - 6, 2);
  ellipse(x + 6, y - h + 17, 1.5, 1.5, '#77543c');
  ellipse(x + w - 6, y - h + 39, 1.5, 1.5, '#77543c');
}

function drawHay(obstacle) {
  const { x, width: w, height: h } = obstacle;
  const y = groundY + 5;
  ellipse(x + w / 2, y + 4, w * .58, 5, '#9f925d58');
  roundedRect(x, y - h * .62, w, h * .62, 7, '#c98847', '#946137');
  roundedRect(x + 7, y - h, w - 13, h * .46, 6, '#dfaa61', '#946137');
  ctx.strokeStyle = '#edbf79';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 8 + i * 14, y - h * .53);
    ctx.lineTo(x + 12 + i * 14, y - 5);
    ctx.stroke();
  }
  ctx.strokeStyle = '#9c6339';
  ctx.beginPath();
  ctx.moveTo(x + 17, y - h + 3);
  ctx.lineTo(x + 20, y - h * .56);
  ctx.moveTo(x + w - 19, y - h + 3);
  ctx.lineTo(x + w - 16, y - h * .56);
  ctx.stroke();
}

function drawLeg(hipX, phase, back) {
  const stride = status === 'running' && jumpHeight === 0 ? Math.sin(time * 17 + phase) : 0;
  const footX = hipX + stride * 20 + (jumpHeight > 0 ? (back ? -13 : 13) : 0);
  const footY = jumpHeight > 0 ? -21 : -5 - Math.max(0, stride) * 9;
  const kneeX = hipX + (footX - hipX) * .55 + (back ? -8 : 8);
  const kneeY = -35 + (jumpHeight > 0 ? 9 : Math.max(0, stride) * 5);
  ctx.strokeStyle = back ? '#885039' : '#a75637';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(hipX, -72);
  ctx.lineTo(kneeX, kneeY);
  ctx.lineTo(footX, footY);
  ctx.stroke();
  ctx.strokeStyle = '#503d32';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(footX - 4, footY + 1);
  ctx.lineTo(footX + 7, footY + 1);
  ctx.stroke();
}

function drawHorse() {
  const shadowWidth = Math.max(27, 59 - jumpHeight * .14) * horseScale;
  ellipse(horseX + 3, groundY + 10, shadowWidth, 7 * horseScale, '#5c584050');

  ctx.save();
  ctx.translate(horseX, groundY - jumpHeight);
  ctx.scale(horseScale, horseScale);
  if (status === 'ready') ctx.translate(0, Math.sin(time * 2) * 2);

  ctx.strokeStyle = '#654437';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-42, -94);
  ctx.bezierCurveTo(-66, -111, -64, -83, -82, -86);
  ctx.stroke();
  ctx.strokeStyle = '#493a31';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-78, -86);
  ctx.quadraticCurveTo(-86, -78, -79, -73);
  ctx.stroke();

  drawLeg(-32, 0, true);
  drawLeg(18, Math.PI, true);

  ctx.lineWidth = 2.5;
  ellipse(-1, -86, 49, 27, '#b96843', '#6b4736', -.06);
  ellipse(-13, -96, 29, 13, '#cf7b50');

  ctx.fillStyle = '#b96843';
  ctx.strokeStyle = '#6b4736';
  ctx.beginPath();
  ctx.moveTo(17, -97);
  ctx.quadraticCurveTo(26, -120, 36, -144);
  ctx.quadraticCurveTo(43, -151, 53, -143);
  ctx.lineTo(63, -120);
  ctx.quadraticCurveTo(47, -112, 41, -77);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#49392f';
  ctx.beginPath();
  ctx.moveTo(29, -113);
  ctx.quadraticCurveTo(18, -130, 35, -149);
  ctx.lineTo(45, -155);
  ctx.quadraticCurveTo(39, -140, 34, -125);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f0d1a0';
  ctx.beginPath();
  ctx.moveTo(-23, -108);
  ctx.quadraticCurveTo(-2, -115, 17, -106);
  ctx.lineTo(12, -95);
  ctx.quadraticCurveTo(-7, -100, -25, -96);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#76523b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(9, -99);
  ctx.lineTo(10, -68);
  ctx.stroke();

  drawLeg(-29, Math.PI, false);
  drawLeg(24, 0, false);

  ctx.fillStyle = '#a65c3f';
  ctx.strokeStyle = '#684638';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(42, -146);
  ctx.lineTo(41, -169);
  ctx.quadraticCurveTo(51, -165, 53, -148);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(56, -149);
  ctx.lineTo(61, -169);
  ctx.quadraticCurveTo(69, -162, 67, -145);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ellipse(57, -135, 23, 18, '#b96843', '#6b4736', .16);
  ellipse(75, -127, 15, 10, '#dfac83', '#76513d', -.1);
  ellipse(60, -140, 2.5, 2.8, '#292f2a');
  ellipse(82, -128, 1.7, 1.4, '#86543e');
  ctx.strokeStyle = '#5c3c32';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(79, -119);
  ctx.quadraticCurveTo(85, -116, 89, -121);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.globalAlpha = Math.min(1, particle.life / particle.maxLife * 1.6);
    ellipse(particle.x, particle.y, particle.radius, particle.radius * .7, '#f8ebce');
  }
  ctx.globalAlpha = 1;
}

function draw() {
  if (!width || !height) return;
  ctx.clearRect(0, 0, width, height);
  drawBackground();
  for (const obstacle of obstacles) {
    if (obstacle.type === 'fence') drawFence(obstacle);
    else drawHay(obstacle);
  }
  drawParticles();
  drawHorse();
}

function frame(timestamp) {
  const dt = Math.min((timestamp - (lastFrame || timestamp)) / 1000, .035);
  lastFrame = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

startButton.addEventListener('click', () => status === 'paused' ? resumeGame() : startGame());
jumpButton.addEventListener('click', jump);
pauseButton.addEventListener('click', () => {
  if (status === 'paused') resumeGame();
  else pauseGame();
  pauseButton.blur();
});
canvas.addEventListener('pointerdown', action);
soundButton.addEventListener('click', () => {
  muted = !muted;
  soundButton.classList.toggle('is-muted', muted);
  soundButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  soundButton.blur();
});
fullscreenButton.hidden = typeof gameCard.requestFullscreen !== 'function' || document.fullscreenEnabled === false;
fullscreenButton.addEventListener('click', async () => {
  fullscreenButton.blur();
  try {
    if (document.fullscreenElement === gameCard) await document.exitFullscreen();
    else await gameCard.requestFullscreen();
  } catch (_) {}
});
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement === gameCard;
  fullscreenButton.classList.toggle('is-fullscreen', fullscreen);
  fullscreenButton.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
  fullscreenButton.title = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
  requestAnimationFrame(resize);
});
window.addEventListener('keydown', event => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    if (event.code === 'Space' && event.target instanceof Element && event.target.closest('button, a')) return;
    event.preventDefault();
    if (!event.repeat) action();
  } else if (event.code === 'KeyP' || event.code === 'Escape') {
    if (event.code === 'Escape' && document.fullscreenElement === gameCard) return;
    if (status === 'running') pauseGame();
    else if (status === 'paused') resumeGame();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});
window.addEventListener('resize', resize);
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(gameArea);
resize();
requestAnimationFrame(frame);
