// Sizzle & Serve — tuning numbers, palette, recipes and the kitchen layout.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** One full shift of cooking, in seconds. */
export const SHIFT_SECONDS = 150;

export const PLAYER = {
  radius: 22,
  speed: 360,
  /** How close the chef must be to a station's centre to use it. */
  reach: 105,
};

export const HEARTS = 3;

/** Seconds a raw patty needs on the grill, and how long after that before it burns. */
export const GRILL = { cookSeconds: 6, burnSeconds: 8, slots: 2 };

/** Chops needed to turn a raw tomato or lettuce into a chopped one. */
export const CHOPS_NEEDED = 3;

/** Orders: how often a new ticket appears, and how long a ticket waits. */
export const ORDERS = {
  maxActive: 3,
  firstAtSeconds: 2,
  intervalStart: 15,
  intervalEnd: 9,
  patienceStart: 48,
  patienceEnd: 36,
};

/** Tip: up to half the dish price again, scaled by patience left when served. */
export const TIP_MAX_FRACTION = 0.5;
/** Combo: +10% per consecutive good serve, capped at double. */
export const COMBO_STEP = 0.1;
export const COMBO_MAX = 2.0;

export const INGREDIENTS = {
  bun: { name: 'Bun', color: '#e8a94e', dark: '#b97a26', price: 0 },
  patty_raw: { name: 'Raw Patty', color: '#c65d5d', dark: '#8f3a3a', price: 0 },
  patty_cooked: { name: 'Grilled Patty', color: '#7a4a26', dark: '#54301a', price: 0 },
  patty_burnt: { name: 'Burnt Patty', color: '#2b2b2b', dark: '#111111', price: 0 },
  tomato: { name: 'Tomato', color: '#e2483d', dark: '#a92c24', price: 0 },
  tomato_chopped: { name: 'Chopped Tomato', color: '#ef6a5e', dark: '#c04538', price: 0 },
  lettuce: { name: 'Lettuce', color: '#58b368', dark: '#2f7d3e', price: 0 },
  lettuce_chopped: { name: 'Chopped Lettuce', color: '#7ed491', dark: '#4a9a5c', price: 0 },
  cheese: { name: 'Cheese', color: '#f2c94c', dark: '#c79a1d', price: 0 },
};

/** The menu: four original recipes, each a multiset of ingredient ids. */
export const RECIPES = [
  {
    id: 'burger',
    name: 'Classic Burger',
    price: 12,
    needs: ['bun', 'patty_cooked', 'lettuce_chopped', 'tomato_chopped'],
  },
  {
    id: 'cheese',
    name: 'Cheese Burger',
    price: 14,
    needs: ['bun', 'patty_cooked', 'cheese', 'tomato_chopped'],
  },
  {
    id: 'salad',
    name: 'Garden Salad',
    price: 10,
    needs: ['lettuce_chopped', 'tomato_chopped', 'cheese'],
  },
  {
    id: 'double',
    name: 'Double Stack',
    price: 18,
    needs: ['bun', 'patty_cooked', 'patty_cooked', 'cheese'],
  },
];

/**
 * Where every station sits. Crates, board, grill and the serve window line the
 * top wall; the plating counter and the bin sit at the bottom. The middle of
 * the floor stays open so the chef can run a route between them.
 */
export const STATIONS = [
  { id: 'crate_bun', kind: 'crate', gives: 'bun', label: 'Buns', x: 40, y: 168, w: 104, h: 84 },
  { id: 'crate_patty', kind: 'crate', gives: 'patty_raw', label: 'Patties', x: 156, y: 168, w: 104, h: 84 },
  { id: 'crate_tomato', kind: 'crate', gives: 'tomato', label: 'Tomatoes', x: 272, y: 168, w: 104, h: 84 },
  { id: 'crate_lettuce', kind: 'crate', gives: 'lettuce', label: 'Lettuce', x: 388, y: 168, w: 104, h: 84 },
  { id: 'crate_cheese', kind: 'crate', gives: 'cheese', label: 'Cheese', x: 504, y: 168, w: 104, h: 84 },
  { id: 'board', kind: 'board', label: 'Chopping Board', x: 648, y: 168, w: 148, h: 84 },
  { id: 'grill', kind: 'grill', label: 'Grill', x: 828, y: 168, w: 168, h: 84 },
  { id: 'serve', kind: 'serve', label: 'Serve Window', x: 1028, y: 168, w: 212, h: 84 },
  { id: 'plating', kind: 'plating', label: 'Plating Counter', x: 40, y: 616, w: 280, h: 84 },
  { id: 'trash', kind: 'trash', label: 'Bin', x: 1028, y: 616, w: 212, h: 84 },
];

export const PALETTE = {
  wall: '#f3e2c2',
  wallDark: '#e3cda0',
  floorA: '#c98d5f',
  floorB: '#bd7f52',
  counterTop: '#8a5a33',
  counterSide: '#6e4525',
  steel: '#9aa5b1',
  steelDark: '#6e7883',
  board: '#e9d8a6',
  grillHot: '#3d3d3d',
  plate: '#f4f1ea',
  ticket: '#fff8e1',
  ticketEdge: '#d9c48a',
  hud: '#2b2118',
  hudPanel: '#fff3d6',
  text: '#2b2118',
  textLight: '#fff8e1',
  muted: '#8a7a63',
  good: '#2f9e44',
  warn: '#e8590c',
  bad: '#d6336c',
  gold: '#f2c94c',
  chefHat: '#f8f9fa',
  chefShirt: '#4dabf7',
  chefSkin: '#f2c29b',
  chefPants: '#343a40',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best shift score is kept between visits (this browser only). */
export const BEST_KEY = 'sizzle-and-serve.best';
