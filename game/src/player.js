// player.js: walk/run, steal/exit car, shooting (incl. drive-by), pickups, shop use.
import { CFG, WEAPONS, clamp, dist, angDiff } from './config.js';
import { pointBlocked, shopById } from './city.js';
import { damageCar, damageHeli, exitCar } from './vehicles.js';

export function trySteal(G) {
  const p = G.player;
  if (!p.onFoot) return false;
  let best = null, bd = 70;
  for (const car of G.cars) {
    if (car.police) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (!best) return false;
  best.parked = false; best.driver = 'player';
  p.car = best; p.onFoot = false; p.speed = 0;
  if (!best.stolenOnce) {
    best.stolenOnce = true;
    G.wanted = Math.min(CFG.WANTED_MAX, G.wanted + 1);
    G.stats.stolen++;
    G.msg = 'Car stolen! The PD is on you.'; G.msgT = 2;
  }
  return true;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  p.cool = Math.max(0, p.cool - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  if (p.onFoot) {
    const k = G.keys;
    let dx = (k['arrowright'] || k['d'] ? 1 : 0) - (k['arrowleft'] || k['a'] ? 1 : 0);
    let dy = (k['arrowdown'] || k['s'] ? 1 : 0) - (k['arrowup'] || k['w'] ? 1 : 0);
    const run = !!(k['shift']);
    const sp = (run ? CFG.RUN_SPEED : CFG.WALK_SPEED);
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const nx = p.x + (dx / len) * sp * dt, ny = p.y + (dy / len) * sp * dt;
      if (!pointBlocked(G, nx, p.y, 10)) p.x = nx;
      if (!pointBlocked(G, p.x, ny, 10)) p.y = ny;
      p.angle = Math.atan2(dy, dx);
    }
    p.speed = (dx || dy) ? sp : 0;
    // Aim at mouse (screen space handled by main via G.aimAngle).
    if (G.aimAngle !== undefined) p.angle = G.aimAngle;
  }
  // Shooting: mouse click, or drive-by while driving.
  const wantShoot = G.mouse.down || (G.mouse.clicked && !WEAPONS[p.weapon].auto);
  if (wantShoot && p.cool <= 0) shoot(G);
  G.mouse.clicked = false;
}

export function shoot(G) {
  const p = G.player, w = WEAPONS[p.weapon];
  if (p.ammo[p.weapon] <= 0) { G.msg = 'Out of ammo — buy more at LUMEN ARMS.'; G.msgT = 2; p.cool = 0.3; return; }
  if (p.ammo[p.weapon] !== Infinity) p.ammo[p.weapon]--;
  p.cool = w.rate;
  const pellets = w.pellets || 1;
  const base = p.onFoot ? p.angle : (p.car ? p.car.angle : p.angle);
  for (let i = 0; i < pellets; i++) {
    const a = base + (Math.random() - 0.5) * 2 * w.spread;
    G.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, angle: a, speed: 900, dmg: w.dmg, range: w.range, traveled: 0, fromPlayer: true });
  }
  G.audioShoot && G.audioShoot(w);
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.traveled += b.speed * dt;
    // Hit heli?
    if (G.heli && dist(b.x, b.y, G.heli.x, G.heli.y) < 34) {
      damageHeli(G, b.dmg); b.traveled = b.range; continue;
    }
    // Hit a police car?
    for (const cop of G.cops) {
      if (dist(b.x, b.y, cop.x, cop.y) < 26) {
        damageCar(G, cop, b.dmg);
        if (cop.hp <= 0) {
          G.cash += 100; G.score += 80; G.stats.kills++;
          G.floats.push({ x: cop.x, y: cop.y - 20, text: '+$100 COP DOWN', color: '#ffd23e', t: 1.3 });
          G.cops = G.cops.filter((c) => c !== cop);
          G.cars = G.cars.filter((c) => c !== cop);
        }
        b.traveled = b.range; break;
      }
    }
    if (b.traveled >= b.range) continue;
    // Hit a pedestrian (raises wanted)?
    for (const ped of G.peds) {
      if (!ped.officer && dist(b.x, b.y, ped.x, ped.y) < 14) {
        G.peds = G.peds.filter((x) => x !== ped);
        G.wanted = Math.min(CFG.WANTED_MAX, G.wanted + 1);
        G.floats.push({ x: ped.x, y: ped.y, text: 'WANTED +1', color: '#ff5e5e', t: 1.2 });
        b.traveled = b.range; break;
      }
    }
    if (pointBlocked(G, b.x, b.y, 0)) b.traveled = b.range;
  }
  G.bullets = G.bullets.filter((b) => b.traveled < b.range);
}

export function tryInteract(G) {
  const p = G.player;
  if (!p.onFoot) { exitCar(G); return 'exit'; }
  // Near a shop?
  for (const s of G.city.shops) {
    if (dist(p.x, p.y, s.x, s.y) < 90) {
      if (s.kind === 'garage') { G.garage = true; G.menu = 'garage'; return 'garage'; }
      if (s.kind === 'gun' || s.kind === 'diner' || s.kind === 'shop' || s.kind === 'clinic') { G.shop = s; G.menu = 'shop'; return 'shop'; }
      if (s.kind === 'safe') {
        G.hp = 100; saveGameRef(G);
        G.msg = 'Safehouse: healed + saved.'; G.msgT = 2.5;
        return 'safe';
      }
      return 'landmark';
    }
  }
  return trySteal(G) ? 'steal' : null;
}
function saveGameRef(G) { if (G.saveNow) G.saveNow(); }

export function usePickup(G, kind) {
  if (kind === 'health') G.hp = Math.min(100, G.hp + 40);
  if (kind === 'cash') { G.cash += 50; G.score += 20; }
  if (kind === 'nos') G.nos = Math.min(6, G.nos + 1);
  if (kind === 'ammo') { G.player.ammo.smg += 60; G.player.ammo.shotgun += 12; G.player.ammo.rifle += 15; }
}
