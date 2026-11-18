// vehicles.js: traffic AI, player driving, police AI, helicopter, roadblocks, spawning.
import { CFG, WORLD_W, WORLD_H, clamp, dist, angDiff, lerp, mulberry32 } from './config.js';
import { roadCenterX, roadCenterY, carBlocked, onRoad, nearestRoadPoint, losClear } from './city.js';

const CAR_COLORS = ['#ff2e88', '#2ec8ff', '#ffd23e', '#7dff5e', '#ff9a3e', '#e8e8f0', '#b07dff', '#ff5e5e'];
const CAR_MODELS = ['Sedan', 'Coupe', 'Hatch', 'Van', 'Taxi'];

export function makeCar(G, x, y, opts = {}) {
  const rnd = mulberry32((G.seed ^ Math.floor(x * 7 + y * 13)) >>> 0);
  return {
    x, y, angle: opts.angle ?? 0, speed: 0, color: opts.color ?? CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)],
    model: opts.model ?? CAR_MODELS[Math.floor(rnd() * CAR_MODELS.length)],
    hp: opts.hp ?? 100, maxHp: 100, police: !!opts.police, taxi: !!opts.taxi,
    parked: !!opts.parked, marked: !!opts.marked, target: null, wait: 0,
    wp: null, driver: opts.driver ?? null, smoke: 0,
  };
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const c = Math.floor(Math.random() * (CFG.COLS + 1));
    const r = Math.floor(Math.random() * (CFG.ROWS + 1));
    const horiz = Math.random() < 0.5;
    const car = makeCar(G, horiz ? 60 + Math.random() * (WORLD_W - 120) : roadCenterX(c),
      horiz ? roadCenterY(r) : 60 + Math.random() * (WORLD_H - CFG.BEACH - CFG.SEA - 120),
      { angle: horiz ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) });
    car.speed = 60 + Math.random() * 60;
    G.cars.push(car);
  }
}
export function spawnParked(G, n) {
  let placed = 0, guard = 0;
  while (placed < n && guard++ < 400) {
    const c = Math.floor(Math.random() * (CFG.COLS + 1));
    const r = Math.floor(Math.random() * (CFG.ROWS + 1));
    const x = roadCenterX(c) + (Math.random() < 0.5 ? -14 : 14);
    const y = roadCenterY(r) + (Math.random() < 0.5 ? -14 : 14);
    if (dist(x, y, G.player.x, G.player.y) < 120) continue;
    if (G.cars.some((o) => dist(o.x, o.y, x, y) < 60)) continue;
    G.cars.push(makeCar(G, x, y, { parked: true, angle: (Math.random() < 0.5 ? 0 : Math.PI / 2) }));
    placed++;
  }
}

function roadWaypoint(car) {
  // Pick the next grid intersection ahead-ish: drive along roads, turn at intersections.
  const step = CFG.BLOCK + CFG.ROAD;
  const gx = Math.round((car.x - CFG.ROAD / 2) / step);
  const gy = Math.round((car.y - CFG.ROAD / 2) / step);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
  const nx = clamp(gx + dx, 0, CFG.COLS), ny = clamp(gy + dy, 0, CFG.ROWS);
  return { x: roadCenterX(nx), y: roadCenterY(ny) };
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.police || car === G.player.car) continue;
    if (car.parked) continue;
    if (!car.wp || dist(car.x, car.y, car.wp.x, car.wp.y) < 24) car.wp = roadWaypoint(car);
    const want = Math.atan2(car.wp.y - car.y, car.wp.x - car.x);
    car.angle += clamp(angDiff(car.angle, want), -1.8 * dt, 1.8 * dt);
    // Slow for a car ahead.
    let ahead = false;
    for (const o of G.cars) {
      if (o === car) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 46) {
        const rel = Math.atan2(o.y - car.y, o.x - car.x);
        if (Math.abs(angDiff(car.angle, rel)) < 0.6) { ahead = true; break; }
      }
    }
    const target = ahead ? 0 : 95;
    car.speed = lerp(car.speed, target, dt * 1.5);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!carBlocked(G, nx, ny)) { car.x = nx; car.y = ny; }
    else car.wp = roadWaypoint(car);
    car.x = clamp(car.x, 20, WORLD_W - 20);
    car.y = clamp(car.y, 20, WORLD_H - CFG.BEACH - CFG.SEA - 20);
  }
}

export function updateDriving(G, dt) {
  const p = G.player, car = p.car;
  if (!car) return;
  const k = G.keys;
  const engineBoost = [0, 40, 90, 150][G.upgrades.engine];
  const max = CFG.CAR_MAX + engineBoost;
  let accel = 0;
  if (k['arrowup'] || k['w']) accel = CFG.CAR_ACCEL;
  if (k['arrowdown'] || k['s']) accel = -CFG.CAR_BRAKE * 0.7;
  let nos = false;
  if ((k['shift']) && G.nos > 0 && car.speed > 40) {
    nos = true;
    G.nos = Math.max(0, G.nos - dt * 0.6);
  }
  const top = nos ? CFG.CAR_MAX_NOS : max;
  car.speed = clamp(car.speed + accel * dt, -90, top);
  if (!accel) car.speed = lerp(car.speed, 0, dt * 0.8);
  const steer = (k['arrowleft'] || k['a'] ? -1 : 0) + (k['arrowright'] || k['d'] ? 1 : 0);
  if (Math.abs(car.speed) > 8) car.angle += steer * CFG.CAR_TURN * dt * Math.sign(car.speed) * (1 - Math.min(0.45, Math.abs(car.speed) / 900));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!carBlocked(G, nx, ny)) { car.x = nx; car.y = ny; }
  else { if (Math.abs(car.speed) > 120) { damageCar(G, car, 8); G.player.hurtT = 0.2; } car.speed *= 0.4; }
  car.x = clamp(car.x, 20, WORLD_W - 20);
  car.y = clamp(car.y, 20, WORLD_H - 20);
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  if (nos && Math.random() < 0.5) G.particles.push({ x: car.x - Math.cos(car.angle) * 22, y: car.y - Math.sin(car.angle) * 22, vx: -Math.cos(car.angle) * 60, vy: -Math.sin(car.angle) * 60, t: 0.35, color: '#2ec8ff', r: 4 });
  if (car.hp < 45) car.smoke = Math.min(1, car.smoke + dt);
  if (car.hp <= 0) { // car dies: player bails out on foot
    G.floats.push({ x: car.x, y: car.y - 20, text: 'CAR WRECKED!', color: '#ff5e5e', t: 1.4 });
    exitCar(G);
    G.cars = G.cars.filter((c) => c !== car);
  }
}
export function damageCar(G, car, dmg) {
  const armor = [0, 60, 140, 240][G.upgrades.armor];
  car.maxHp = 100 + armor;
  car.hp = Math.max(0, car.hp - dmg);
}

export function spawnPolice(G, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const x = clamp(G.player.x + Math.cos(a) * 420, 40, WORLD_W - 40);
    const y = clamp(G.player.y + Math.sin(a) * 420, 40, WORLD_H - CFG.BEACH - CFG.SEA - 40);
    const cop = makeCar(G, x, y, { police: true, color: '#1a1a2e', angle: 0 });
    cop.speed = 0;
    G.cops.push(cop);
    G.cars.push(cop);
  }
}
export function updatePolice(G, dt) {
  const p = G.player;
  const want = G.wanted >= 3 ? 4 : G.wanted >= 2 ? 3 : G.wanted >= 1 ? 2 : 0;
  while (G.cops.length < want) spawnPolice(G, 1);
  while (G.cops.length > want && G.cops.length > 0) {
    const far = G.cops.reduce((a, b) => dist(b.x, b.y, p.x, p.y) > dist(a.x, a.y, p.x, p.y) ? b : a);
    G.cops = G.cops.filter((c) => c !== far);
    G.cars = G.cars.filter((c) => c !== far);
  }
  for (const cop of G.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const seen = d < 720 && losClear(G, cop.x, cop.y, p.x, p.y);
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += clamp(angDiff(cop.angle, wantAngle), -2.4 * dt, 2.4 * dt);
    const target = d > 60 ? 200 + G.wanted * 22 : 0;
    cop.speed = lerp(cop.speed, target, dt * 1.2);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    if (!carBlocked(G, nx, ny)) { cop.x = nx; cop.y = ny; } else cop.speed *= 0.5;
    // Ram / bust
    if (d < 44) {
      if (p.car) { damageCar(G, p.car, 14 * dt); cop.speed *= 0.6; }
      else if (Math.abs(p.speed || 0) < 60 && G.wanted > 0) {
        G.bustT = (G.bustT || 0) + dt;
        if (G.bustT > 1.2) { G.over = 'busted'; G.bustT = 0; }
      }
    } else G.bustT = 0;
    if (seen) G.lastSeen = G.clock;
  }
  // Helicopter from 4 stars.
  if (G.wanted >= CFG.HELI_MIN_STAR && !G.heli) {
    G.heli = { x: p.x - 200, y: p.y - 260, hp: 100, angle: 0 };
    G.msg = 'POLICE HELICOPTER INBOUND — shoot it down for +$500!'; G.msgT = 3;
  }
  if (G.wanted < CFG.HELI_MIN_STAR) G.heli = null;
  if (G.heli) {
    const h = G.heli;
    const d = dist(h.x, h.y, p.x, p.y);
    const wantAngle = Math.atan2(p.y - h.y, p.x - h.x);
    h.angle += clamp(angDiff(h.angle, wantAngle), -1.5 * dt, 1.5 * dt);
    const sp = d > 170 ? 130 : 60;
    h.x += Math.cos(h.angle) * sp * dt; h.y += Math.sin(h.angle) * sp * dt;
    if (d < 720 && losClear(G, h.x, h.y, p.x, p.y)) G.lastSeen = G.clock;
  }
  // Roadblocks at 4-5 stars: two police cars + barrier ahead of the player.
  if (G.wanted >= 4 && G.roadblocks.length < 2) {
    const rp = nearestRoadPoint(p.x + Math.cos(p.angle) * 320, p.y + Math.sin(p.angle) * 320);
    if (dist(rp.x, rp.y, p.x, p.y) > 180) {
      const a = Math.atan2(p.y - rp.y, p.x - rp.x);
      G.roadblocks.push({ x: rp.x, y: rp.y, angle: a, t: 0 });
      const c1 = makeCar(G, rp.x - 30, rp.y, { police: true, color: '#1a1a2e' });
      const c2 = makeCar(G, rp.x + 30, rp.y, { police: true, color: '#1a1a2e' });
      G.cars.push(c1, c2);
      G.roadblocks[G.roadblocks.length - 1].cars = [c1, c2];
    }
  }
  if (G.wanted < 4) {
    for (const rb of G.roadblocks) for (const c of rb.cars || []) { G.cars = G.cars.filter((x) => x !== c); G.cops = G.cops.filter((x) => x !== c); }
    G.roadblocks = [];
  }
}
export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  p.car.parked = true; p.car.speed = 0;
  p.x = p.car.x + Math.cos(p.angle + Math.PI / 2) * 30;
  p.y = p.car.y + Math.sin(p.angle + Math.PI / 2) * 30;
  p.onFoot = true; p.car = null; p.speed = 0;
}
export function damageHeli(G, dmg) {
  if (!G.heli) return;
  G.heli.hp -= dmg;
  if (G.heli.hp <= 0) {
    G.cash += CFG.HELI_REWARD; G.score += 250; G.stats.kills++;
    G.floats.push({ x: G.heli.x, y: G.heli.y, text: '+$500 HELI DOWN!', color: '#ffd23e', t: 1.6 });
    G.particles.push({ x: G.heli.x, y: G.heli.y, vx: 0, vy: 0, t: 0.8, color: '#ff9a3e', r: 26 });
    G.heli = null; G.wanted = Math.max(3, G.wanted - 1);
  }
}
