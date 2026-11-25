// Everything the player sees, drawn on one canvas: the kitchen, the order
// board, the chef and the food, the HUD, and the title, pause and game-over
// screens. All art is drawn with canvas paths — no image files, no network.
import { FIELD, FONT, GRILL, INGREDIENTS, PALETTE, RECIPES, STATIONS } from './config.js';
import { recipeById } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSE = 2;
export const SCREEN_OVER = 3;

function roundRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, value, x, y, size, color, weight, align) {
  ctx.fillStyle = color;
  ctx.font = `${weight ?? 700} ${size}px ${FONT}`;
  ctx.textAlign = align ?? 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

/** One ingredient's icon, drawn centred at (x, y) inside a `size` box. */
export function drawIngredient(ctx, id, x, y, size) {
  const half = size / 2;
  ctx.save();
  ctx.translate(x, y);
  if (id === 'bun') {
    ctx.fillStyle = INGREDIENTS.bun.color;
    roundRect(ctx, -half, -half * 0.1, size, half * 0.9, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -half * 0.05, half * 0.95, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff3d6';
    for (const [dx, dy] of [[-0.4, -0.55], [0, -0.75], [0.4, -0.55], [-0.2, -0.3], [0.25, -0.3]]) {
      ctx.beginPath();
      ctx.arc(dx * size, dy * size, size * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'patty_raw' || id === 'patty_cooked' || id === 'patty_burnt') {
    ctx.fillStyle = INGREDIENTS[id].color;
    roundRect(ctx, -half, -half * 0.55, size, half * 1.1, half * 0.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, -half * 0.8, -half * 0.4, size * 0.7, half * 0.35, 4);
    ctx.fill();
  } else if (id === 'tomato') {
    ctx.fillStyle = INGREDIENTS.tomato.color;
    ctx.beginPath();
    ctx.arc(0, 0, half * 0.95, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7dc383';
    ctx.beginPath();
    ctx.arc(0, -half * 0.7, half * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'tomato_chopped') {
    ctx.fillStyle = INGREDIENTS.tomato_chopped.color;
    for (const dx of [-0.42, 0.42]) {
      ctx.beginPath();
      ctx.arc(dx * size, 0, half * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd9d4';
    for (const dx of [-0.42, 0.42]) {
      ctx.beginPath();
      ctx.arc(dx * size, 0, half * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'lettuce') {
    ctx.fillStyle = INGREDIENTS.lettuce.color;
    for (const [dx, dy] of [[-0.35, 0.1], [0.35, 0.1], [0, -0.35]]) {
      ctx.beginPath();
      ctx.arc(dx * size, dy * size, half * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'lettuce_chopped') {
    ctx.fillStyle = INGREDIENTS.lettuce_chopped.color;
    for (const [dx, dy, angle] of [[-0.4, 0, 0.5], [0, -0.25, -0.4], [0.4, 0.15, 0.3], [0, 0.35, 0]]) {
      ctx.save();
      ctx.translate(dx * size, dy * size);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, half * 0.42, half * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (id === 'cheese') {
    ctx.fillStyle = INGREDIENTS.cheese.color;
    ctx.beginPath();
    ctx.moveTo(-half, half * 0.6);
    ctx.lineTo(half, half * 0.6);
    ctx.lineTo(half, -half * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INGREDIENTS.cheese.dark;
    for (const [dx, dy] of [[-0.3, 0.25], [0.25, 0.35], [0.45, 0.05]]) {
      ctx.beginPath();
      ctx.arc(dx * size, dy * size, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** A white plate with the dish's ingredients stacked on it. */
function drawPlate(ctx, x, y, items, scale) {
  const s = scale ?? 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#d8d2c4';
  ctx.beginPath();
  ctx.ellipse(0, 4, 52, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.plate;
  ctx.beginPath();
  ctx.ellipse(0, 0, 52, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9c2b2';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 40, 11, 0, 0, Math.PI * 2);
  ctx.stroke();
  const shown = items.slice(0, 4);
  shown.forEach((id, index) => {
    drawIngredient(ctx, id, -30 + index * 20, -8, 26);
  });
  ctx.restore();
}

function drawStation(ctx, station, world, isNearest) {
  const { x, y, w, h } = station;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  if (isNearest) {
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 4;
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 12);
    ctx.stroke();
  }
  if (station.kind === 'crate') {
    ctx.fillStyle = PALETTE.counterSide;
    roundRect(ctx, x, y + 8, w, h - 8, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.counterTop;
    roundRect(ctx, x, y, w, 18, 8);
    ctx.fill();
    ctx.fillStyle = '#f3e2c2';
    roundRect(ctx, x + 8, y + 22, w - 16, h - 30, 6);
    ctx.fill();
    drawIngredient(ctx, station.gives, cx, y + 44, 34);
    text(ctx, station.label, cx, y - 8, 13, PALETTE.text, 700);
  } else if (station.kind === 'board') {
    ctx.fillStyle = PALETTE.counterSide;
    roundRect(ctx, x, y + 8, w, h - 8, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.board;
    roundRect(ctx, x + 10, y + 6, w - 20, h - 22, 8);
    ctx.fill();
    const board = world.state.board;
    if (board.item !== null) {
      drawIngredient(ctx, board.item, cx, cy - 4, 40);
      if (board.chops < 3) {
        ctx.fillStyle = 'rgba(43,33,24,0.25)';
        roundRect(ctx, cx - 40, cy + 22, 80, 8, 4);
        ctx.fill();
        ctx.fillStyle = PALETTE.good;
        roundRect(ctx, cx - 40, cy + 22, 80 * (board.chops / 3), 8, 4);
        ctx.fill();
        text(ctx, `Chop ${board.chops}/3`, cx, cy + 40, 12, PALETTE.textLight, 700);
      } else {
        text(ctx, 'Ready!', cx, cy + 40, 12, PALETTE.good, 800);
      }
    } else {
      text(ctx, 'Chop here', cx, cy - 2, 14, PALETTE.muted, 700);
    }
    text(ctx, station.label, cx, y - 8, 13, PALETTE.text, 700);
  } else if (station.kind === 'grill') {
    ctx.fillStyle = PALETTE.counterSide;
    roundRect(ctx, x, y + 8, w, h - 8, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.grillHot;
    roundRect(ctx, x + 8, y + 6, w - 16, h - 24, 8);
    ctx.fill();
    ctx.strokeStyle = '#5a5a5a';
    ctx.lineWidth = 2;
    for (let index = 1; index < 6; index += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 8 + ((w - 16) / 6) * index, y + 10);
      ctx.lineTo(x + 8 + ((w - 16) / 6) * index, y + h - 18);
      ctx.stroke();
    }
    world.state.grill.forEach((slot, index) => {
      const sx = x + 44 + index * 80;
      if (slot.state === 'empty') return;
      const hot = slot.state === 'cooking' ? slot.t / 6 : 1;
      if (slot.state === 'cooking') {
        ctx.fillStyle = `rgba(232,89,12,${0.25 + 0.35 * hot})`;
        ctx.beginPath();
        ctx.arc(sx, cy - 6, 24, 0, Math.PI * 2);
        ctx.fill();
      }
      drawIngredient(ctx, slot.state === 'burnt' ? 'patty_burnt' : slot.state === 'cooked' ? 'patty_cooked' : 'patty_raw', sx, cy - 6, 40);
      if (slot.state === 'cooking') {
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(sx, cy - 6, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, slot.t / 6));
        ctx.stroke();
      } else if (slot.state === 'burnt') {
        text(ctx, 'BURNT!', sx, cy + 26, 12, '#ff8787', 800);
      } else {
        text(ctx, 'Ready!', sx, cy + 26, 12, PALETTE.good, 800);
      }
    });
    text(ctx, station.label, cx, y - 8, 13, PALETTE.text, 700);
  } else if (station.kind === 'serve') {
    ctx.fillStyle = '#7a4a26';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = '#fff8e1';
    roundRect(ctx, x + 8, y + 8, w - 16, h - 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(cx, y + 30, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a4a26';
    ctx.beginPath();
    ctx.arc(cx, y + 26, 4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'RING THE BELL — SERVE!', cx, y + 52, 13, '#7a4a26', 800);
    text(ctx, station.label, cx, y - 8, 13, PALETTE.text, 700);
  } else if (station.kind === 'plating') {
    ctx.fillStyle = PALETTE.steelDark;
    roundRect(ctx, x, y + 8, w, h - 8, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.steel;
    roundRect(ctx, x, y, w, 18, 8);
    ctx.fill();
    const plate = world.state.counterPlate;
    if (plate.items.length > 0) {
      drawPlate(ctx, cx, cy + 6, plate.items, 1.15);
      const recipe = world.state.orders.length > 0
        ? RECIPES.find((entry) => entry.needs.length >= plate.items.length && plate.items.every((id) => entry.needs.includes(id)))
        : null;
      text(ctx, recipe !== null && plate.items.length === recipe.needs.length ? 'Ready to serve!' : 'Mid-assembly…', cx, cy + 34, 12, recipe !== null && plate.items.length === recipe.needs.length ? PALETTE.good : PALETTE.textLight, 800);
    } else {
      text(ctx, 'Build the dish here', cx, cy, 14, PALETTE.textLight, 700);
    }
    text(ctx, station.label, cx, y - 8, 13, PALETTE.text, 700);
  } else if (station.kind === 'trash') {
    ctx.fillStyle = PALETTE.counterSide;
    roundRect(ctx, x, y + 8, w, h - 8, 8);
    ctx.fill();
    ctx.fillStyle = '#495057';
    roundRect(ctx, cx - 34, y + 10, 68, h - 28, 8);
    ctx.fill();
    ctx.fillStyle = '#868e96';
    roundRect(ctx, cx - 40, y + 4, 80, 12, 6);
    ctx.fill();
    text(ctx, 'BIN', cx, cy + 2, 16, '#dee2e6', 800);
    text(ctx, station.label, cx, y - 8, 13, PALETTE.text, 700);
  }
  ctx.restore();
}

function drawChef(ctx, world) {
  const player = world.state.player;
  const { x, y } = player;
  const bob = player.moving ? Math.sin(world.state.elapsed * 14) * 2 : 0;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 20, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs.
  ctx.fillStyle = PALETTE.chefPants;
  const step = player.moving ? Math.sin(world.state.elapsed * 14) * 5 : 0;
  roundRect(ctx, x - 12, y + 6 + step * 0.3, 9, 14, 4);
  ctx.fill();
  roundRect(ctx, x + 3, y + 6 - step * 0.3, 9, 14, 4);
  ctx.fill();
  // Body: blue shirt, white apron.
  ctx.fillStyle = PALETTE.chefShirt;
  roundRect(ctx, x - 17, y - 12 + bob, 34, 24, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x - 11, y - 6 + bob, 22, 18, 6);
  ctx.fill();
  // Arm toward the facing side.
  ctx.fillStyle = PALETTE.chefSkin;
  ctx.beginPath();
  ctx.arc(x + 19 * player.face, y - 2 + bob, 6, 0, Math.PI * 2);
  ctx.fill();
  // Head and toque.
  ctx.fillStyle = PALETTE.chefSkin;
  ctx.beginPath();
  ctx.arc(x, y - 24 + bob, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.chefHat;
  roundRect(ctx, x - 13, y - 44 + bob, 26, 12, 6);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 7, y - 44 + bob, 7, 0, Math.PI * 2);
  ctx.arc(x + 7, y - 44 + bob, 7, 0, Math.PI * 2);
  ctx.fill();
  // Eyes.
  ctx.fillStyle = '#212529';
  ctx.beginPath();
  ctx.arc(x - 5 + 2 * player.face, y - 25 + bob, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 5 + 2 * player.face, y - 25 + bob, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // What the chef carries, held high so it reads at a glance.
  const carrying = world.state.carrying;
  if (carrying !== null) {
    if (carrying.type === 'plate') {
      drawPlate(ctx, x, y - 52 + bob, carrying.items, 0.85);
    } else {
      ctx.fillStyle = 'rgba(255,248,225,0.95)';
      ctx.beginPath();
      ctx.arc(x, y - 56 + bob, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d9c48a';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawIngredient(ctx, carrying.id, x, y - 56 + bob, 24);
    }
  }
  ctx.restore();
}

function drawOrders(ctx, world) {
  const orders = world.state.orders;
  const ticketWidth = 400;
  const gap = 16;
  const totalWidth = orders.length * ticketWidth + (orders.length - 1) * gap;
  let x = (FIELD.width - totalWidth) / 2;
  const y = 66;
  ctx.save();
  text(ctx, 'ORDER BOARD', 16, 78, 15, PALETTE.text, 800, 'left');
  for (const order of orders) {
    const recipe = recipeById(order.recipeId);
    const fraction = Math.max(0, order.patience / order.maxPatience);
    ctx.fillStyle = PALETTE.ticket;
    roundRect(ctx, x, y, ticketWidth, 84, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ticketEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(ctx, `#${order.id}  ${recipe.name}`, x + 14, y + 18, 17, PALETTE.text, 800, 'left');
    text(ctx, `$${recipe.price}`, x + ticketWidth - 14, y + 18, 17, PALETTE.good, 800, 'right');
    recipe.needs.forEach((id, index) => {
      drawIngredient(ctx, id, x + 30 + index * 34, y + 48, 26);
    });
    const barX = x + 14;
    const barY = y + 68;
    const barW = ticketWidth - 28;
    ctx.fillStyle = 'rgba(43,33,24,0.2)';
    roundRect(ctx, barX, barY, barW, 8, 4);
    ctx.fill();
    ctx.fillStyle = fraction > 0.5 ? PALETTE.good : fraction > 0.25 ? '#fab005' : PALETTE.bad;
    roundRect(ctx, barX, barY, barW * fraction, 8, 4);
    ctx.fill();
    x += ticketWidth + gap;
  }
  if (orders.length === 0) {
    text(ctx, 'No orders yet — the lunch rush is coming…', FIELD.width / 2, y + 42, 16, PALETTE.muted, 600);
  }
  ctx.restore();
}

function drawHud(ctx, world) {
  const state = world.state;
  ctx.save();
  ctx.fillStyle = PALETTE.hud;
  ctx.fillRect(0, 0, FIELD.width, 58);
  // Coins.
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(36, 29, 14, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, '$', 36, 30, 16, '#7a4a26', 800);
  text(ctx, `${state.coins}`, 58, 30, 22, PALETTE.textLight, 800, 'left');
  text(ctx, `Served ${state.served}`, 150, 30, 15, '#ffd8a8', 700, 'left');
  // Shift timer, centre.
  const minutes = Math.floor(state.shiftLeft / 60);
  const seconds = Math.floor(state.shiftLeft % 60);
  const timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const barW = 300;
  const barX = FIELD.width / 2 - barW / 2;
  ctx.fillStyle = 'rgba(255,248,225,0.25)';
  roundRect(ctx, barX, 18, barW, 12, 6);
  ctx.fill();
  ctx.fillStyle = state.shiftLeft < 30 ? PALETTE.bad : PALETTE.gold;
  roundRect(ctx, barX, 18, barW * (state.shiftLeft / 150), 12, 6);
  ctx.fill();
  text(ctx, `SHIFT  ${timerText}`, FIELD.width / 2, 44, 15, PALETTE.textLight, 800);
  // Hearts.
  for (let index = 0; index < 3; index += 1) {
    const hx = FIELD.width - 150 + index * 34;
    ctx.fillStyle = index < state.hearts ? '#ff6b81' : 'rgba(255,248,225,0.25)';
    ctx.beginPath();
    ctx.arc(hx - 5, 24, 8, 0, Math.PI * 2);
    ctx.arc(hx + 5, 24, 8, 0, Math.PI * 2);
    ctx.moveTo(hx - 12, 26);
    ctx.lineTo(hx, 40);
    ctx.lineTo(hx + 12, 26);
    ctx.closePath();
    ctx.fill();
  }
  // Combo.
  if (state.combo >= 2) {
    ctx.fillStyle = PALETTE.warn;
    roundRect(ctx, FIELD.width - 260, 12, 92, 34, 17);
    ctx.fill();
    text(ctx, `COMBO x${state.combo}`, FIELD.width - 214, 30, 15, '#ffffff', 800);
  }
  ctx.restore();
}

function drawKitchen(ctx, world, nearest) {
  const state = world.state;
  // Wall and floor.
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 58, FIELD.width, 104);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(0, 156, FIELD.width, 6);
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
      ctx.fillRect(col * 80, 162 + row * 62, 80, 62);
    }
  }
  // Wall decor: a menu poster and a clock.
  ctx.fillStyle = '#fff8e1';
  roundRect(ctx, 1150, 70, 110, 80, 8);
  ctx.fill();
  text(ctx, "TODAY'S", 1205, 88, 11, PALETTE.muted, 800);
  text(ctx, 'MENU', 1205, 106, 16, PALETTE.text, 800);
  text(ctx, '4 dishes', 1205, 128, 11, PALETTE.muted, 700);
  for (const station of STATIONS) {
    drawStation(ctx, station, world, nearest !== null && nearest.id === station.id);
  }
  drawChef(ctx, world);
  // Particles.
  for (const particle of state.particles) {
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.t * 2);
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Floaters.
  for (const floater of state.floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, floater.t));
    text(ctx, floater.text, floater.x, floater.y, 24, floater.color, 800);
  }
  ctx.globalAlpha = 1;
  // "E" prompt over the nearest station.
  if (nearest !== null) {
    const cx = nearest.x + nearest.w / 2;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(cx, nearest.y - 16, 14, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'E', cx, nearest.y - 15, 15, '#2b2118', 800);
  }
  // Toasts.
  state.toasts.forEach((toastItem, index) => {
    const y = FIELD.height - 24 - index * 30;
    ctx.globalAlpha = Math.min(1, toastItem.t);
    const width = ctx.measureText(toastItem.text).width + 28;
    ctx.fillStyle = 'rgba(43,33,24,0.85)';
    roundRect(ctx, FIELD.width / 2 - width / 2, y - 15, width, 30, 15);
    ctx.fill();
    text(ctx, toastItem.text, FIELD.width / 2, y + 1, 15, toastItem.color === '#d6336c' ? '#ff8787' : '#fff8e1', 700);
  });
  ctx.globalAlpha = 1;
  // Controls hint.
  text(ctx, 'WASD / arrows — move    ·    E / Space — use station    ·    Click a station to walk there    ·    P — pause    ·    M — mute', FIELD.width / 2, FIELD.height - 8, 12, 'rgba(255,248,225,0.75)', 600);
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(43,33,24,0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function render(ctx, world, screen, nearest, best) {
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (screen === SCREEN_TITLE) {
    drawKitchen(ctx, world, null);
    drawOrders(ctx, world);
    drawHud(ctx, world);
    drawPanel(ctx, 340, 150, 600, 420);
    text(ctx, '🍳  SIZZLE & SERVE', 640, 200, 44, PALETTE.text, 800);
    text(ctx, 'A tiny kitchen, a lunch rush, four dishes.', 640, 240, 18, PALETTE.muted, 600);
    text(ctx, 'Grab ingredients from the crates.', 640, 292, 17, PALETTE.text, 700);
    text(ctx, 'Chop tomatoes & lettuce · Grill patties · Build the dish on the plate.', 640, 320, 17, PALETTE.text, 700);
    text(ctx, 'Serve the right dish before the ticket runs out!', 640, 348, 17, PALETTE.text, 700);
    text(ctx, 'MENU', 640, 392, 15, PALETTE.muted, 800);
    text(ctx, 'Classic Burger $12  ·  Cheese Burger $14  ·  Garden Salad $10  ·  Double Stack $18', 640, 416, 15, PALETTE.text, 700);
    text(ctx, 'WASD / arrows move  ·  E or Space uses a station  ·  Click a station to walk to it', 640, 452, 14, PALETTE.muted, 600);
    text(ctx, 'PRESS SPACE OR CLICK TO START', 640, 508, 19, PALETTE.warn, 800);
    if (best > 0) text(ctx, `Best shift: $${best}`, 640, 542, 16, PALETTE.good, 700);
    return;
  }
  if (screen === SCREEN_OVER) {
    drawKitchen(ctx, world, null);
    drawOrders(ctx, world);
    drawHud(ctx, world);
    drawPanel(ctx, 390, 160, 500, 400);
    text(ctx, 'SHIFT OVER!', 640, 206, 40, PALETTE.text, 800);
    text(ctx, world.state.overReason, 640, 244, 16, PALETTE.muted, 600);
    const rows = [
      ['Coins earned', `$${world.state.coins}`],
      ['Dishes served', `${world.state.served}`],
      ['Best combo', `x${world.state.bestCombo}`],
      ['Wrong dishes', `${world.state.mistakes}`],
      ['Hearts left', `${world.state.hearts} / 3`],
    ];
    rows.forEach(([label, value], index) => {
      const y = 292 + index * 34;
      text(ctx, label, 460, y, 17, PALETTE.text, 600, 'left');
      text(ctx, value, 820, y, 17, PALETTE.text, 800, 'right');
    });
    if (world.state.coins > best) text(ctx, 'NEW BEST SHIFT!', 640, 478, 18, PALETTE.good, 800);
    else if (best > 0) text(ctx, `Best shift: $${best}`, 640, 478, 16, PALETTE.muted, 700);
    text(ctx, 'PRESS R OR CLICK TO COOK AGAIN', 640, 522, 17, PALETTE.warn, 800);
    return;
  }
  drawKitchen(ctx, world, nearest);
  drawOrders(ctx, world);
  drawHud(ctx, world);
  if (screen === SCREEN_PAUSE) {
    drawPanel(ctx, 440, 260, 400, 160);
    text(ctx, 'PAUSED', 640, 310, 36, PALETTE.text, 800);
    text(ctx, 'Press P or click to keep cooking', 640, 356, 16, PALETTE.muted, 600);
    text(ctx, 'M — mute', 640, 386, 14, PALETTE.muted, 600);
  }
}
