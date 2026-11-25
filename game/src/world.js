// The game's rules and state, with no drawing and no browser in it: the chef,
// the stations, the orders, chopping and grilling, plating and serving, the
// shift timer, hearts, coins and combo. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after
// createWorld returns, except the short-lived toasts and floaters.
import {
  CHOPS_NEEDED,
  FIELD,
  GRILL,
  HEARTS,
  INGREDIENTS,
  ORDERS,
  PLAYER,
  RECIPES,
  SHIFT_SECONDS,
  STATIONS,
  COMBO_MAX,
  COMBO_STEP,
  TIP_MAX_FRACTION,
} from './config.js';

export const EVENT_SERVED = 1;
export const EVENT_MISTAKE = 2;
export const EVENT_EXPIRED = 4;
export const EVENT_OVER = 8;
export const EVENT_CHOP = 16;
export const EVENT_PLACE = 32;
export const EVENT_PICKUP = 64;

function stationById(id) {
  for (const station of STATIONS) if (station.id === id) return station;
  return null;
}

function stationCentre(station) {
  return { x: station.x + station.w / 2, y: station.y + station.h / 2 };
}

/** True when two multisets hold the same ids the same number of times. */
export function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const id of a) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const id of b) {
    const left = counts.get(id) ?? 0;
    if (left === 0) return false;
    counts.set(id, left - 1);
  }
  return true;
}

/** The recipe a plate could still become, or null when it fits no open order. */
export function matchingRecipe(plateItems, orders) {
  for (const order of orders) {
    const recipe = RECIPES.find((entry) => entry.id === order.recipeId);
    if (!recipe) continue;
    const remaining = [...recipe.needs];
    let fits = true;
    for (const id of plateItems) {
      const at = remaining.indexOf(id);
      if (at === -1) {
        fits = false;
        break;
      }
      remaining.splice(at, 1);
    }
    if (fits) return recipe;
  }
  return null;
}

export function recipeById(id) {
  return RECIPES.find((entry) => entry.id === id) ?? null;
}

export function createWorld(random) {
  const state = {
    player: { x: FIELD.width / 2, y: 430, face: 1, moving: false },
    /** { type: 'ingredient', id } or { type: 'plate', items: [] } or null. */
    carrying: null,
    /** The plate resting on the plating counter: { items: [] } or null. */
    counterPlate: { items: [] },
    board: { item: null, chops: 0 },
    grill: [],
    orders: [],
    coins: 0,
    served: 0,
    mistakes: 0,
    combo: 0,
    bestCombo: 0,
    hearts: HEARTS,
    shiftLeft: SHIFT_SECONDS,
    elapsed: 0,
    spawnTimer: ORDERS.firstAtSeconds,
    nextOrderId: 1,
    over: false,
    overReason: '',
    toasts: [],
    floaters: [],
    particles: [],
  };
  for (let index = 0; index < GRILL.slots; index += 1) {
    state.grill.push({ state: 'empty', t: 0 });
  }

  function reset() {
    state.player.x = FIELD.width / 2;
    state.player.y = 430;
    state.player.face = 1;
    state.player.moving = false;
    state.carrying = null;
    state.counterPlate = { items: [] };
    state.board = { item: null, chops: 0 };
    for (const slot of state.grill) {
      slot.state = 'empty';
      slot.t = 0;
    }
    state.orders = [];
    state.coins = 0;
    state.served = 0;
    state.mistakes = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.hearts = HEARTS;
    state.shiftLeft = SHIFT_SECONDS;
    state.elapsed = 0;
    state.spawnTimer = ORDERS.firstAtSeconds;
    state.nextOrderId = 1;
    state.over = false;
    state.overReason = '';
    state.toasts = [];
    state.floaters = [];
    state.particles = [];
  }

  function toast(text, color) {
    state.toasts.push({ text, color: color ?? '#2b2118', t: 2.2 });
    if (state.toasts.length > 3) state.toasts.shift();
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color: color ?? '#2f9e44', t: 1.4 });
  }

  function burst(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const speed = 60 + random() * 140;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        t: 0.5 + random() * 0.4,
        color,
      });
    }
    if (state.particles.length > 120) state.particles.splice(0, state.particles.length - 120);
  }

  function spawnOrder() {
    if (state.orders.length >= ORDERS.maxActive) return;
    const recipe = RECIPES[Math.floor(random() * RECIPES.length)];
    const progress = Math.min(1, state.elapsed / SHIFT_SECONDS);
    const patience =
      ORDERS.patienceStart + (ORDERS.patienceEnd - ORDERS.patienceStart) * progress;
    state.orders.push({
      id: state.nextOrderId,
      recipeId: recipe.id,
      patience,
      maxPatience: patience,
    });
    state.nextOrderId += 1;
  }

  function orderInterval() {
    const progress = Math.min(1, state.elapsed / SHIFT_SECONDS);
    return ORDERS.intervalStart + (ORDERS.intervalEnd - ORDERS.intervalStart) * progress;
  }

  /** The station the chef stands close enough to use, or null. */
  function nearestStation() {
    const player = state.player;
    let best = null;
    let bestDistance = Infinity;
    for (const station of STATIONS) {
      const centre = stationCentre(station);
      const dx = centre.x - player.x;
      const dy = centre.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = station;
      }
    }
    return bestDistance <= PLAYER.reach + Math.max(best.w, best.h) / 2 ? best : null;
  }

  function chopName(id) {
    return id === 'tomato' ? 'tomato_chopped' : 'lettuce_chopped';
  }

  /**
   * Use the nearest station. Returns an event flag and, through the state,
   * toasts and floaters that tell the player what happened.
   */
  function interact() {
    const station = nearestStation();
    if (station === null) {
      toast('Walk up to a station first!');
      return 0;
    }
    const carrying = state.carrying;

    if (station.kind === 'crate') {
      if (carrying !== null) {
        toast('Hands full — serve or bin it first!');
        return 0;
      }
      state.carrying = { type: 'ingredient', id: station.gives };
      return EVENT_PICKUP;
    }

    if (station.kind === 'board') {
      const board = state.board;
      if (board.item === null) {
        if (carrying !== null && carrying.type === 'ingredient' && (carrying.id === 'tomato' || carrying.id === 'lettuce')) {
          board.item = carrying.id;
          board.chops = 0;
          state.carrying = null;
          return EVENT_PLACE;
        }
        toast('The board is for tomatoes and lettuce.');
        return 0;
      }
      if (carrying !== null) {
        toast('Hands full — chop with empty hands!');
        return 0;
      }
      if (board.item === 'tomato_chopped' || board.item === 'lettuce_chopped') {
        state.carrying = { type: 'ingredient', id: board.item };
        state.board = { item: null, chops: 0 };
        return EVENT_PICKUP;
      }
      board.chops += 1;
      const centre = stationCentre(station);
      burst(centre.x, centre.y - 6, '#7ed491', 8);
      if (board.chops >= CHOPS_NEEDED) {
        board.item = chopName(board.item);
        board.chops = CHOPS_NEEDED;
        toast(`${INGREDIENTS[board.item].name} ready!`);
      }
      return EVENT_CHOP;
    }

    if (station.kind === 'grill') {
      if (carrying !== null && carrying.type === 'ingredient' && carrying.id === 'patty_raw') {
        const slot = state.grill.find((entry) => entry.state === 'empty');
        if (slot === undefined) {
          toast('The grill is full!');
          return 0;
        }
        slot.state = 'cooking';
        slot.t = 0;
        state.carrying = null;
        return EVENT_PLACE;
      }
      if (carrying !== null) {
        toast('Only raw patties go on the grill.');
        return 0;
      }
      const slot = state.grill.find((entry) => entry.state === 'cooked' || entry.state === 'burnt');
      if (slot === undefined) {
        toast('Nothing ready on the grill yet.');
        return 0;
      }
      state.carrying = {
        type: 'ingredient',
        id: slot.state === 'cooked' ? 'patty_cooked' : 'patty_burnt',
      };
      slot.state = 'empty';
      slot.t = 0;
      return EVENT_PICKUP;
    }

    if (station.kind === 'plating') {
      const plate = state.counterPlate;
      if (carrying !== null && carrying.type === 'plate') {
        state.carrying = null;
        state.counterPlate = carrying;
        return EVENT_PLACE;
      }
      if (carrying !== null && carrying.type === 'ingredient') {
        if (carrying.id === 'patty_burnt') {
          toast('Burnt! Bin it, don\'t serve it.');
          return 0;
        }
        const trial = [...plate.items, carrying.id];
        if (matchingRecipe(trial, state.orders) === null && state.orders.length > 0) {
          toast('That doesn\'t fit any open order.');
          return 0;
        }
        plate.items.push(carrying.id);
        state.carrying = null;
        const centre = stationCentre(station);
        burst(centre.x, centre.y - 10, '#f2c94c', 6);
        return EVENT_PLACE;
      }
      if (carrying === null) {
        if (plate.items.length === 0) {
          toast('Add ingredients to the plate first.');
          return 0;
        }
        state.carrying = { type: 'plate', items: plate.items };
        state.counterPlate = { items: [] };
        return EVENT_PICKUP;
      }
      return 0;
    }

    if (station.kind === 'serve') {
      if (carrying === null || carrying.type !== 'plate') {
        toast('Bring a finished plate to serve!');
        return 0;
      }
      const orderIndex = state.orders.findIndex((order) => {
        const recipe = recipeById(order.recipeId);
        return recipe !== null && sameMultiset(carrying.items, recipe.needs);
      });
      if (orderIndex === -1) {
        state.mistakes += 1;
        state.combo = 0;
        toast('Wrong dish — check the ticket!', '#d6336c');
        return EVENT_MISTAKE;
      }
      const order = state.orders[orderIndex];
      const recipe = recipeById(order.recipeId);
      const patienceFraction = order.patience / order.maxPatience;
      const tip = Math.round(recipe.price * TIP_MAX_FRACTION * patienceFraction);
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const multiplier = Math.min(COMBO_MAX, 1 + COMBO_STEP * (state.combo - 1));
      const earned = Math.round((recipe.price + tip) * multiplier);
      state.coins += earned;
      state.served += 1;
      state.orders.splice(orderIndex, 1);
      state.carrying = null;
      state.counterPlate = { items: [] };
      const centre = stationCentre(station);
      floater(centre.x, centre.y - 30, `+$${earned}`, '#2f9e44');
      burst(centre.x, centre.y, '#f2c94c', 16);
      return EVENT_SERVED;
    }

    if (station.kind === 'trash') {
      if (carrying === null) {
        toast('Nothing to throw away.');
        return 0;
      }
      if (carrying.type === 'plate') {
        carrying.items = [];
        toast('Plate emptied.');
      } else {
        state.carrying = null;
        toast('Binned.');
      }
      return EVENT_PLACE;
    }
    return 0;
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1 (or null for no movement) and
   * `doInteract` presses E this step. With `harmless` set (the title screen's
   * backdrop) orders never expire and hearts never drop.
   */
  function step(dt, move, doInteract, harmless) {
    if (state.over) return 0;
    let events = 0;
    state.elapsed += dt;
    state.shiftLeft = Math.max(0, SHIFT_SECONDS - state.elapsed);

    const player = state.player;
    if (move !== null && (move.x !== 0 || move.y !== 0)) {
      const length = Math.sqrt(move.x * move.x + move.y * move.y);
      const nx = move.x / length;
      const ny = move.y / length;
      player.x = Math.min(FIELD.width - PLAYER.radius - 8, Math.max(PLAYER.radius + 8, player.x + nx * PLAYER.speed * dt));
      player.y = Math.min(FIELD.height - PLAYER.radius - 8, Math.max(268, player.y + ny * PLAYER.speed * dt));
      player.face = nx !== 0 ? Math.sign(nx) : player.face;
      player.moving = true;
    } else {
      player.moving = false;
    }

    if (doInteract) events |= interact();

    for (const slot of state.grill) {
      if (slot.state === 'cooking' || slot.state === 'cooked') {
        slot.t += dt;
        if (slot.t >= GRILL.cookSeconds + GRILL.burnSeconds) slot.state = 'burnt';
        else if (slot.t >= GRILL.cookSeconds) slot.state = 'cooked';
      }
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnOrder();
      state.spawnTimer += orderInterval();
    }

    for (let index = state.orders.length - 1; index >= 0; index -= 1) {
      const order = state.orders[index];
      order.patience -= dt;
      if (order.patience <= 0) {
        state.orders.splice(index, 1);
        if (!harmless) {
          state.hearts -= 1;
          state.combo = 0;
          events |= EVENT_EXPIRED;
          toast('An order walked out!', '#d6336c');
          if (state.hearts <= 0) {
            state.over = true;
            state.overReason = 'The lunch crowd gave up on you.';
            events |= EVENT_OVER;
          }
        }
      }
    }

    for (let index = state.toasts.length - 1; index >= 0; index -= 1) {
      state.toasts[index].t -= dt;
      if (state.toasts[index].t <= 0) state.toasts.splice(index, 1);
    }
    for (let index = state.floaters.length - 1; index >= 0; index -= 1) {
      const floaterItem = state.floaters[index];
      floaterItem.t -= dt;
      floaterItem.y -= 34 * dt;
      if (floaterItem.t <= 0) state.floaters.splice(index, 1);
    }
    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.t -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 260 * dt;
      if (particle.t <= 0) state.particles.splice(index, 1);
    }

    if (!state.over && state.shiftLeft <= 0) {
      state.over = true;
      state.overReason = 'Shift over — the kitchen closes!';
      events |= EVENT_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, step, interact, nearestStation, stationById, stationCentre };
}
