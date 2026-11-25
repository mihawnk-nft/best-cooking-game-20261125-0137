// Sizzle & Serve — the main loop. Reads ?seed= and ?shot=start|play|end from
// the URL: with a shot, the scene is staged at once from the real rules and
// drawn immediately, so a screenshot always catches the finished frame.
import { BEST_KEY, FIELD, STATIONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CHOP, EVENT_EXPIRED, EVENT_MISTAKE, EVENT_OVER, EVENT_PICKUP, EVENT_PLACE, EVENT_SERVED } from './world.js';
import { ACTION_INTERACT, ACTION_PAUSE, ACTION_RESTART, ACTION_START, createInput } from './input.js';
import { createAudio } from './audio.js';
import { SCREEN_OVER, SCREEN_PAUSE, SCREEN_PLAY, SCREEN_TITLE, render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const shot = params.get('shot');
const random = createRandom(seed);
const world = createWorld(random);
const audio = createAudio();

let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  best = 0;
}
function saveBest() {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // Private mode or no storage: the score just does not persist.
  }
}

let screen = SCREEN_TITLE;
/** A clicked point the chef is walking to, in field coordinates, or null. */
let walkTarget = null;
/** The station to use once the chef arrives at a clicked station, or null. */
let walkStationId = null;

if (shot !== null) {
  const staged = stageShot(shot, world);
  screen = staged.screen;
  if (screen === SCREEN_OVER && world.state.coins > best) {
    best = world.state.coins;
  }
}

function announce(text) {
  statusLine.textContent = text;
}

function resize() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.width = Math.floor(FIELD.width * scale);
  canvas.height = Math.floor(FIELD.height * scale);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = `${canvas.height}px`;
}

function draw() {
  const scale = canvas.width / FIELD.width;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  render(ctx, world, screen, screen === SCREEN_PLAY ? world.nearestStation() : null, best);
}

function playEventSound(events) {
  if (events & EVENT_SERVED) audio.served();
  else if (events & EVENT_MISTAKE) audio.mistake();
  else if (events & EVENT_EXPIRED) audio.expired();
  else if (events & EVENT_CHOP) audio.chop();
  else if (events & EVENT_PLACE) audio.place();
  else if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_OVER) audio.over();
}

function startShift() {
  world.reset();
  screen = SCREEN_PLAY;
  walkTarget = null;
  walkStationId = null;
  audio.unlock();
  audio.click();
  announce('Shift started. Grab ingredients, cook the orders, serve before the tickets run out!');
}

function endShift() {
  if (world.state.coins > best) {
    best = world.state.coins;
    saveBest();
  }
  announce(`Shift over. You earned $${world.state.coins} and served ${world.state.served} dishes. Press R to cook again.`);
}

const input = createInput(canvas, (nx, ny) => {
  const fx = nx * FIELD.width;
  const fy = ny * FIELD.height;
  audio.unlock();
  if (screen === SCREEN_TITLE) {
    startShift();
    return;
  }
  if (screen === SCREEN_OVER) {
    startShift();
    return;
  }
  if (screen === SCREEN_PAUSE) {
    screen = SCREEN_PLAY;
    return;
  }
  // In play: a click on a station walks there and uses it; any other click
  // is a walk target.
  let clicked = null;
  let clickedDistance = Infinity;
  for (const station of STATIONS) {
    const cx = station.x + station.w / 2;
    const cy = station.y + station.h / 2;
    const dx = fx - cx;
    const dy = fy - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (fx >= station.x - 10 && fx <= station.x + station.w + 10 && fy >= station.y - 10 && fy <= station.y + station.h + 10 && distance < clickedDistance) {
      clicked = station;
      clickedDistance = distance;
    }
  }
  if (clicked !== null) {
    walkStationId = clicked.id;
    const centreY = clicked.y + clicked.h / 2;
    walkTarget = { x: clicked.x + clicked.w / 2, y: centreY < FIELD.height / 2 ? centreY + 62 : centreY - 62 };
  } else {
    walkStationId = null;
    walkTarget = { x: Math.min(FIELD.width - 30, Math.max(30, fx)), y: Math.min(FIELD.height - 30, Math.max(272, fy)) };
  }
});

let lastTime = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;

  const actions = input.takeActions();
  if (input.takeMute()) {
    const muted = audio.toggleMute();
    announce(muted ? 'Sound muted.' : 'Sound on.');
  }

  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_START) startShift();
    accumulator = 0;
  } else if (screen === SCREEN_OVER) {
    if (actions & (ACTION_RESTART | ACTION_START)) startShift();
    accumulator = 0;
  } else if (screen === SCREEN_PAUSE) {
    if (actions & ACTION_PAUSE) screen = SCREEN_PLAY;
    accumulator = 0;
  } else {
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSE;
      announce('Paused.');
    } else {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        let move = null;
        let doInteract = false;
        if (input.steering()) {
          move = input.move();
          walkTarget = null;
          walkStationId = null;
        } else if (walkTarget !== null) {
          const dx = walkTarget.x - world.state.player.x;
          const dy = walkTarget.y - world.state.player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 12) {
            walkTarget = null;
            if (walkStationId !== null) {
              const nearest = world.nearestStation();
              if (nearest !== null && nearest.id === walkStationId) doInteract = true;
              walkStationId = null;
            }
          } else {
            move = { x: dx / distance, y: dy / distance };
          }
        }
        if (actions & ACTION_INTERACT) {
          doInteract = true;
          actions &= ~ACTION_INTERACT;
        }
        const events = world.step(STEP, move, doInteract, false);
        playEventSound(events);
        if (events & EVENT_OVER) {
          screen = SCREEN_OVER;
          endShift();
          break;
        }
      }
    }
  }

  draw();
  window.requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  resize();
  draw();
});
resize();
draw();
announce(
  screen === SCREEN_TITLE
    ? 'Sizzle and Serve. A cooking game. Press Space or click to start your shift.'
    : screen === SCREEN_OVER
      ? `Shift over. You earned $${world.state.coins}.`
      : 'Cooking in progress.',
);
window.requestAnimationFrame(frame);
