// city.js: deterministic seeded city — blocks, roads, buildings, parks, beach, sea, landmarks,
// district lookup, collision and line-of-sight queries.
import { CFG, WORLD_W, WORLD_H, DISTRICTS, mulberry32, clamp } from './config.js';

export function blockOrigin(c, r) {
  return { x: CFG.ROAD + c * (CFG.BLOCK + CFG.ROAD), y: CFG.ROAD + r * (CFG.BLOCK + CFG.ROAD) };
}
export function roadCenterX(c) { return CFG.ROAD + c * (CFG.BLOCK + CFG.ROAD) - CFG.ROAD / 2; }
export function roadCenterY(r) { return CFG.ROAD + r * (CFG.BLOCK + CFG.ROAD) - CFG.ROAD / 2; }
export function onRoad(x, y) {
  const px = x % (CFG.BLOCK + CFG.ROAD), py = y % (CFG.BLOCK + CFG.ROAD);
  return px < CFG.ROAD || py < CFG.ROAD;
}
export function districtAt(x, y) {
  if (y > CFG.ROWS * CFG.BLOCK + (CFG.ROWS + 1) * CFG.ROAD) return DISTRICTS[5];
  const c = clamp(Math.floor((x - CFG.ROAD) / (CFG.BLOCK + CFG.ROAD)), 0, CFG.COLS - 1);
  const r = clamp(Math.floor((y - CFG.ROAD) / (CFG.BLOCK + CFG.ROAD)), 0, CFG.ROWS - 1);
  for (const d of DISTRICTS) if (c >= d.c0 && c <= d.c1 && r >= d.r0 && r <= d.r1) return d;
  return DISTRICTS[3];
}

const SHOP_DEFS = [
  { id: 'garage', name: 'VOLT GARAGE', kind: 'garage', c: 3, r: 3 },
  { id: 'diner', name: 'NEON DINER', kind: 'diner', c: 4, r: 1 },
  { id: 'gunshop', name: 'LUMEN ARMS', kind: 'gun', c: 5, r: 2 },
  { id: 'safehouse', name: 'SAFEHOUSE', kind: 'safe', c: 1, r: 4 },
  { id: 'bank', name: 'BAY BANK', kind: 'bank', c: 3, r: 2 },
  { id: 'ramen', name: 'RAMEN', kind: 'shop', c: 2, r: 1 },
  { id: 'karaoke', name: 'KARAOKE', kind: 'shop', c: 4, r: 3 },
  { id: 'arcade', name: 'ARCADE', kind: 'shop', c: 5, r: 4 },
  { id: 'docks', name: 'DOCKS', kind: 'docks', c: 6, r: 2 },
  { id: 'marina', name: 'MARINA', kind: 'marina', c: 6, r: 0 },
  { id: 'oldtown', name: 'OLD TOWN', kind: 'plaza', c: 0, r: 0 },
  { id: 'hospital', name: 'CLINIC', kind: 'clinic', c: 1, r: 2 },
];

export function buildCity(G) {
  const rnd = mulberry32(G.seed);
  const buildings = [], parks = [], palms = [], signs = [];
  const NEON_WORDS = ['NEON', 'LUMEN', 'BAY', '24H', 'TACOS', 'HOTEL', 'PIER', 'DISCO', 'RAMEN', 'BAR'];
  for (let r = 0; r < CFG.ROWS; r++) {
    for (let c = 0; c < CFG.COLS; c++) {
      const o = blockOrigin(c, r);
      const d = districtAt(o.x + 10, o.y + 10);
      const roll = rnd();
      if (roll < 0.16) {
        parks.push({ x: o.x, y: o.y, w: CFG.BLOCK, h: CFG.BLOCK, district: d.name });
        for (let i = 0; i < 5; i++) palms.push({ x: o.x + 20 + rnd() * (CFG.BLOCK - 40), y: o.y + 20 + rnd() * (CFG.BLOCK - 40) });
        continue;
      }
      const bw = 120 + rnd() * 70, bh = 110 + rnd() * 80;
      const bx = o.x + (CFG.BLOCK - bw) / 2 + (rnd() - 0.5) * 20;
      const by = o.y + (CFG.BLOCK - bh) / 2 + (rnd() - 0.5) * 20;
      const windows = [];
      for (let wy = by + 12; wy < by + bh - 10; wy += 18)
        for (let wx = bx + 10; wx < bx + bw - 10; wx += 16)
          windows.push({ x: wx, y: wy, lit: rnd() < 0.62 });
      buildings.push({ x: bx, y: by, w: bw, h: bh, district: d.name, windows,
        hue: 200 + Math.floor(rnd() * 120), neon: rnd() < 0.4 });
      if (rnd() < 0.55) signs.push({ x: bx + bw / 2, y: by - 8, text: NEON_WORDS[Math.floor(rnd() * NEON_WORDS.length)], color: ['#ff2e88', '#2ec8ff', '#ffd23e', '#7dff5e'][Math.floor(rnd() * 4)] });
      for (let i = 0; i < 2; i++) palms.push({ x: o.x + 8 + rnd() * (CFG.BLOCK - 16), y: o.y + 8 + rnd() * (CFG.BLOCK - 16) });
    }
  }
  // Beach palms along the shore.
  for (let i = 0; i < 14; i++) palms.push({ x: 40 + rnd() * (WORLD_W - 80), y: CFG.ROWS * CFG.BLOCK + (CFG.ROWS + 1) * CFG.ROAD + 30 + rnd() * 70 });
  const shops = SHOP_DEFS.map((s) => {
    const o = blockOrigin(s.c, s.r);
    return { ...s, x: o.x + CFG.BLOCK / 2, y: o.y + CFG.BLOCK / 2 };
  });
  // Keep shop tiles free of buildings: drop any building overlapping a shop point.
  const kept = buildings.filter((b) => !shops.some((s) => s.x > b.x - 20 && s.x < b.x + b.w + 20 && s.y > b.y - 20 && s.y < b.y + b.h + 20));
  G.city = { buildings: kept, parks, palms, signs, shops, seed: G.seed };
  return G.city;
}

export function shopById(G, id) { return G.city.shops.find((s) => s.id === id); }

export function pointBlocked(G, x, y, pad) {
  if (x < 8 || y < 8 || x > WORLD_W - 8 || y > WORLD_H - 8) return true;
  for (const b of G.city.buildings)
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  return false;
}
export function carBlocked(G, x, y) { return pointBlocked(G, x, y, 12); }

// Line of sight: true when no building sits between the two points.
export function losClear(G, x1, y1, x2, y2) {
  const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 18);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(G, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 0)) return false;
  }
  return true;
}
export function nearestRoadPoint(x, y) {
  const step = CFG.BLOCK + CFG.ROAD;
  const cx = clamp(Math.round((x - CFG.ROAD / 2) / step), 0, CFG.COLS);
  const cy = clamp(Math.round((y - CFG.ROAD / 2) / step), 0, CFG.ROWS);
  return { x: roadCenterX(cx), y: roadCenterY(cy) };
}
