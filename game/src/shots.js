// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world, steered by a small autopilot that works
// the kitchen the way a player does — fetch, chop, grill, plate, serve — so
// every frame is what a short game really looks like, and the same seed always
// gives the same frame.
import { FIELD, STEP } from './config.js';
import { matchingRecipe, recipeById } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_LIMIT_SECONDS = 90;
const END_LIMIT_SECONDS = 420;

function chopName(id) {
  return id === 'tomato' ? 'tomato_chopped' : 'lettuce_chopped';
}

function crateFor(id) {
  if (id === 'bun') return 'crate_bun';
  if (id === 'patty_raw') return 'crate_patty';
  if (id === 'tomato') return 'crate_tomato';
  if (id === 'lettuce') return 'crate_lettuce';
  if (id === 'cheese') return 'crate_cheese';
  return null;
}

/**
 * What the autopilot wants this step: a station to walk to and use, or a
 * point to wait at. Returns { stationId, wait } — stationId null means idle.
 */
function planGoal(world) {
  const state = world.state;
  const carrying = state.carrying;
  const plate = state.counterPlate;
  const orders = state.orders;

  // A finished plate in hand goes straight to the window when it matches a ticket.
  if (carrying !== null && carrying.type === 'plate') {
    if (carrying.items.length === 0) return { stationId: 'plating', wait: false };
    const recipe = matchingRecipe(carrying.items, orders);
    if (recipe !== null && carrying.items.length === recipe.needs.length) {
      return { stationId: 'serve', wait: false };
    }
    // A half-built plate that still fits a ticket goes back on the counter
    // to be finished; only a plate no ticket wants gets binned.
    if (recipe !== null || orders.length === 0) return { stationId: 'plating', wait: false };
    return { stationId: 'trash', wait: false };
  }

  // A plate on the counter that fits no open ticket gets emptied.
  if (carrying === null && plate.items.length > 0 && orders.length > 0 && matchingRecipe(plate.items, orders) === null) {
    return { stationId: 'plating', wait: false };
  }

  // An ingredient in hand goes where it is worked on next.
  if (carrying !== null && carrying.type === 'ingredient') {
    const id = carrying.id;
    if (id === 'patty_burnt') return { stationId: 'trash', wait: false };
    if (id === 'tomato' || id === 'lettuce') return { stationId: 'board', wait: false };
    if (id === 'patty_raw') return { stationId: 'grill', wait: false };
    return { stationId: 'plating', wait: false };
  }

  // Empty hands: finish what is already on the board or the grill first.
  const board = state.board;
  if (board.item !== null) return { stationId: 'board', wait: false };
  const cookedSlot = state.grill.find((slot) => slot.state === 'cooked');
  if (cookedSlot !== undefined) {
    const needsPatty = orders.some((order) => {
      const recipe = recipeById(order.recipeId);
      return recipe !== null && recipe.needs.includes('patty_cooked');
    });
    if (needsPatty) return { stationId: 'grill', wait: false };
  }
  const burntSlot = state.grill.find((slot) => slot.state === 'burnt');
  if (burntSlot !== undefined) return { stationId: 'grill', wait: false };
  const cookingSlot = state.grill.find((slot) => slot.state === 'cooking');
  if (cookingSlot !== undefined) return { stationId: 'grill', wait: true };

  // A complete plate on the counter gets picked up and served.
  if (plate.items.length > 0 && orders.length > 0) {
    const recipe = matchingRecipe(plate.items, orders);
    if (recipe !== null && plate.items.length === recipe.needs.length) {
      return { stationId: 'plating', wait: false };
    }
  }

  // Otherwise fetch the next missing ingredient of the first ticket.
  if (orders.length === 0) return { stationId: null, wait: true };
  const order = orders[0];
  const recipe = recipeById(order.recipeId);
  if (recipe === null) return { stationId: null, wait: true };

  // What is already on its way, counted as the finished ingredient it becomes.
  const inProgress = [...plate.items];
  if (board.item !== null) {
    inProgress.push(board.item === 'tomato' || board.item === 'lettuce' ? chopName(board.item) : board.item);
  }
  for (const slot of state.grill) {
    if (slot.state === 'cooking' || slot.state === 'cooked') inProgress.push('patty_cooked');
  }
  const remaining = [...recipe.needs];
  for (const id of inProgress) {
    const at = remaining.indexOf(id);
    if (at !== -1) remaining.splice(at, 1);
  }
  if (remaining.length === 0) return { stationId: null, wait: true };
  const next = remaining[0];
  if (next === 'patty_cooked') return { stationId: 'crate_patty', wait: false };
  if (next === 'tomato_chopped') return { stationId: 'crate_tomato', wait: false };
  if (next === 'lettuce_chopped') return { stationId: 'crate_lettuce', wait: false };
  return { stationId: crateFor(next), wait: false };
}

/** One autopilot step: steer toward the goal and use its station on arrival. */
function autopilotStep(world) {
  const state = world.state;
  const goal = planGoal(world);
  if (goal.stationId === null) {
    // Idle near the middle of the floor while waiting for the next ticket.
    const dx = FIELD.width / 2 - state.player.x;
    const dy = 450 - state.player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 12) return { move: null, interact: false };
    return { move: { x: dx / distance, y: dy / distance }, interact: false };
  }
  const station = world.stationById(goal.stationId);
  const targetX = station.x + station.w / 2;
  // Approach from the open floor: below a top-wall station, above a bottom one.
  const centreY = station.y + station.h / 2;
  const targetY = centreY < FIELD.height / 2 ? centreY + 62 : centreY - 62;
  const dx = targetX - state.player.x;
  const dy = targetY - state.player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > 14) {
    return { move: { x: dx / distance, y: dy / distance }, interact: false };
  }
  const nearest = world.nearestStation();
  if (goal.wait) return { move: null, interact: false };
  if (nearest !== null && nearest.id === goal.stationId) {
    return { move: null, interact: true };
  }
  return { move: null, interact: false };
}

function playForward(world, seconds, stopWhen) {
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    const action = autopilotStep(world);
    const events = world.step(STEP, action.move, action.interact, false);
    if (world.state.over) break;
    if (stopWhen !== undefined && stopWhen(world)) break;
    void events;
  }
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, null, false, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Stop on a rich frame: a dish mid-assembly on the plate, something
    // cooking or chopping, and at least two tickets on the board.
    playForward(world, PLAY_LIMIT_SECONDS, (staged) => {
      const state = staged.state;
      const busy = staged.state.grill.some((slot) => slot.state === 'cooking')
        || staged.state.board.item !== null;
      return state.counterPlate.items.length >= 2 && state.orders.length >= 2 && busy;
    });
    return { screen: SCREEN_PLAY, best: world.state.coins };
  }
  playForward(world, END_LIMIT_SECONDS);
  return { screen: SCREEN_OVER, best: world.state.coins };
}
