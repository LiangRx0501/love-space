const SEGMENT_COUNT = 12;
const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
const FULL_SPINS_MIN = 5;
const FULL_SPINS_MAX = 8;

const wheelEl = document.getElementById('wheel');
const wheelButton = document.getElementById('wheel-button');
const spinAction = document.getElementById('spin-action');
const spinStatus = document.getElementById('spin-status');

let isSpinning = false;
let currentRotation = 0;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setSpinningState(spinning) {
    isSpinning = spinning;
    wheelButton.disabled = spinning;
    spinAction.disabled = spinning;
    spinStatus.textContent = spinning ? '转盘旋转中...' : '等待下一次旋转';
}

function spinWheel() {
    if (isSpinning) return;

    const winningIndex = randomInt(0, SEGMENT_COUNT - 1);
    const fullSpins = randomInt(FULL_SPINS_MIN, FULL_SPINS_MAX);
    const targetNormalized = 360 - (winningIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2);
    const currentNormalized = ((currentRotation % 360) + 360) % 360;
    const delta = (targetNormalized - currentNormalized + 360) % 360;

    currentRotation += fullSpins * 360 + delta;

    setSpinningState(true);
    wheelEl.style.transform = `rotate(${currentRotation}deg)`;
}

wheelEl.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'transform') return;
    setSpinningState(false);
});

wheelButton.addEventListener('click', spinWheel);
spinAction.addEventListener('click', spinWheel);
