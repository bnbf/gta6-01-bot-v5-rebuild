// LUMEN BAY — Neon Heat. config.js: constants, districts, weapons, missions, upgrades, radio.
// Original game. Nothing from any commercial game. All names, city and story are invented here.
export const CFG = {
  BLOCK: 220, ROAD: 46, COLS: 7, ROWS: 6,
  BEACH: 150, SEA: 130,
  WALK_SPEED: 170, RUN_SPEED: 265,
  CAR_ACCEL: 260, CAR_MAX: 330, CAR_MAX_NOS: 470, CAR_TURN: 2.6, CAR_BRAKE: 420,
  WANTED_MAX: 5, UNSEEN_DECAY: 4, HELI_MIN_STAR: 4, HELI_REWARD: 500,
  START_CASH: 250, SAVE_KEY: 'lumenbay-save-v5r',
};
export const WORLD_W = CFG.COLS * CFG.BLOCK + (CFG.COLS + 1) * CFG.ROAD;
export const WORLD_H = CFG.ROWS * CFG.BLOCK + (CFG.ROWS + 1) * CFG.ROAD + CFG.BEACH + CFG.SEA;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const lerp = (a, b, t) => a + (b - a) * t;

export const DISTRICTS = [
  { name: 'Old Town',    c0: 0, c1: 1, r0: 0, r1: 1, ground: '#1c2438', accent: '#e8b64c', label: 'OLD TOWN' },
  { name: 'Neon Strip',  c0: 2, c1: 4, r0: 0, r1: 1, ground: '#241533', accent: '#ff2e88', label: 'NEON STRIP' },
  { name: 'Marina',      c0: 5, c1: 6, r0: 0, r1: 2, ground: '#10283a', accent: '#2ec8ff', label: 'MARINA' },
  { name: 'Downtown',    c0: 2, c1: 4, r0: 2, r1: 3, ground: '#1a1a2e', accent: '#ffd23e', label: 'DOWNTOWN' },
  { name: 'Industrial',  c0: 0, c1: 1, r0: 2, r1: 4, ground: '#1e2b1e', accent: '#7dff5e', label: 'INDUSTRIAL' },
  { name: 'Beachfront',  c0: 0, c1: 6, r0: 5, r1: 5, ground: '#33241a', accent: '#ff9a3e', label: 'BEACHFRONT' },
];

export const WEAPONS = {
  pistol:  { name: 'Pistol',  dmg: 25, rate: 0.28, spread: 0.05, range: 420, auto: false, price: 0,   ammoPrice: 0,  color: '#ffd23e' },
  smg:     { name: 'SMG',     dmg: 14, rate: 0.09, spread: 0.12, range: 380, auto: true,  price: 300, ammoPrice: 40, color: '#2ec8ff' },
  shotgun: { name: 'Shotgun', dmg: 16, rate: 0.75, spread: 0.30, range: 260, auto: false, price: 450, ammoPrice: 60, color: '#ff9a3e', pellets: 6 },
  rifle:   { name: 'Rifle',   dmg: 55, rate: 0.45, spread: 0.02, range: 640, auto: false, price: 800, ammoPrice: 90, color: '#ff2e88' },
};

export const UPGRADES = {
  armor:  { name: 'Armor',  prices: [200, 400, 700],  hp: [0, 60, 140, 240] },
  engine: { name: 'Engine', prices: [250, 500, 900],  boost: [0, 40, 90, 150] },
  nos:    { name: 'NOS',    prices: [150, 350, 600],   tanks: [2, 3, 4, 6] },
};
export const PAINTS = [
  { name: 'Neon Pink', color: '#ff2e88', price: 0 },
  { name: 'Volt Yellow', color: '#ffd23e', price: 80 },
  { name: 'Cyan Wave', color: '#2ec8ff', price: 80 },
  { name: 'Lime Rush', color: '#7dff5e', price: 120 },
  { name: 'Sunset Orange', color: '#ff9a3e', price: 120 },
  { name: 'Ghost White', color: '#e8e8f0', price: 150 },
];

export const STATIONS = [
  { name: 'NEON FM',      desc: 'synthwave',  bpm: 112, wave: 'sawtooth', root: 55,  minor: true },
  { name: 'SUNSET DRIVE', desc: 'chillwave',  bpm: 84,  wave: 'triangle', root: 65.4, minor: false },
  { name: 'BAY BASS',     desc: 'bass house', bpm: 124, wave: 'square',   root: 49,  minor: true },
  { name: 'PALM LO-FI',   desc: 'lo-fi',      bpm: 72,  wave: 'sine',     root: 58.3, minor: false },
];

export const RANKS = [
  [0, 'Street Punk'], [400, 'Wheelman'], [1200, 'Hustler'], [2600, 'Made Man'],
  [4800, 'Big Shot'], [8000, 'King of the Bay'],
];

// 12 story missions. type: goto | timed | visit | loseheat | bank | race | circuit | steal | escort
export const MISSIONS = [
  { name: 'First Wheels',   type: 'goto',     text: 'Steal a car, then deliver it to Volt Garage.', reward: 200, target: 'garage' },
  { name: 'Neon Courier',   type: 'timed',    text: 'Deliver the package to the Neon Diner. Fast!', reward: 250, target: 'diner', time: 75 },
  { name: 'Protection Money', type: 'visit',  text: 'Collect from 3 shops: Ramen, Karaoke, Arcade.', reward: 350, target: 'shops' },
  { name: 'Heat Wave',      type: 'loseheat', text: 'Lose a 3-star wanted level, then reach the Safehouse.', reward: 300, target: 'safehouse' },
  { name: 'The Big Score',  type: 'bank',     text: 'Rob the Bay Bank vault, then escape the heat.', reward: 650, target: 'bank' },
  { name: 'Midnight Race',  type: 'race',     text: 'Beat the street race: hit all 4 checkpoints.', reward: 400, target: 'race' },
  { name: 'King of the Bay', type: 'goto',    text: 'Meet Big Lou at the Marina to claim the crown.', reward: 500, target: 'marina' },
  { name: 'Bay Circuit',    type: 'circuit',  text: 'Win the Bay Circuit: 3 laps, 4 gates each.', reward: 550, target: 'race' },
  { name: 'Dockside Run',   type: 'timed',    text: 'Smuggle the crate from the Docks to Old Town.', reward: 450, target: 'oldtown', time: 90 },
  { name: 'Garage Job',     type: 'steal',    text: 'Steal the marked gold car and bring it to Volt Garage.', reward: 500, target: 'garage' },
  { name: 'Safe Witness',   type: 'escort',   text: 'Escort Vera Solano to the Safehouse. Keep her alive.', reward: 500, target: 'safehouse' },
  { name: "Kingpin's Fall", type: 'bank',     text: 'Final job: rob the Bay Bank at 5 stars and escape.', reward: 1200, target: 'bank' },
];

export function createState() {
  return {
    seed: 1337, time: 18.67, clock: 0, running: false, started: false, paused: false,
    over: null, // 'busted' | 'wasted'
    cash: CFG.START_CASH, hp: 100, wanted: 0, unseen: 0, score: 0,
    player: { x: 0, y: 0, angle: -Math.PI / 2, onFoot: true, car: null, weapon: 'pistol',
      ammo: { pistol: Infinity, smg: 120, shotgun: 24, rifle: 30 }, speed: 0, cool: 0, hurtT: 0 },
    cars: [], peds: [], cops: [], heli: null, roadblocks: [],
    bullets: [], pickups: [], floats: [], particles: [],
    missionIdx: 0, mission: null, visited: [], race: null, taxi: null, escort: null,
    radio: -1, shop: null, garage: false, menu: null,
    upgrades: { armor: 0, engine: 0, nos: 0, paint: 0 }, nos: 2,
    keys: {}, mouse: { x: 640, y: 360, down: false, clicked: false },
    msg: '', msgT: 0, city: null, stats: { stolen: 0, kills: 0, fares: 0, races: 0 },
    testMode: false, shotMode: null, errorLog: [],
  };
}
export function rankFor(score) {
  let r = RANKS[0][1];
  for (const [pts, name] of RANKS) if (score >= pts) r = name;
  return r;
}
