// people.js: pedestrians (stroll, flee crime), foot officers, taxi fares.
import { CFG, WORLD_W, WORLD_H, clamp, dist, angDiff, lerp } from './config.js';
import { pointBlocked, onRoad, roadCenterX, roadCenterY } from './city.js';

const PED_COLORS = ['#ff9a3e', '#2ec8ff', '#7dff5e', '#ff2e88', '#e8e8f0', '#b07dff', '#ffd23e'];

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const x = 60 + Math.random() * (WORLD_W - 120);
    const y = 60 + Math.random() * (WORLD_H - CFG.BEACH - CFG.SEA - 120);
    if (dist(x, y, G.player.x, G.player.y) < 90) continue;
    G.peds.push({
      x, y, angle: Math.random() * Math.PI * 2, speed: 28 + Math.random() * 22,
      color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
      flee: 0, wait: Math.random() * 2, officer: false, taxi: Math.random() < 0.18, fare: null,
    });
  }
}
export function spawnOfficer(G) {
  const a = Math.random() * Math.PI * 2;
  G.peds.push({
    x: clamp(G.player.x + Math.cos(a) * 300, 30, WORLD_W - 30),
    y: clamp(G.player.y + Math.sin(a) * 300, 30, WORLD_H - 200),
    angle: 0, speed: 150, color: '#1a4dff', flee: 0, wait: 0, officer: true, taxi: false, fare: null,
  });
}

export function updatePeds(G, dt) {
  const p = G.player;
  const officers = G.peds.filter((x) => x.officer).length;
  if (G.wanted >= 2 && officers < G.wanted - 1) spawnOfficer(G);
  for (const ped of G.peds) {
    const d = dist(ped.x, ped.y, p.x, p.y);
    if (ped.officer) {
      // Foot officer chases and busts on contact.
      const want = Math.atan2(p.y - ped.y, p.x - ped.x);
      ped.angle += clamp(angDiff(ped.angle, want), -3 * dt, 3 * dt);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (d < 26 && p.onFoot) {
        G.bustT = (G.bustT || 0) + dt;
        if (G.bustT > 1.0) { G.over = 'busted'; G.bustT = 0; }
      }
      continue;
    }
    if (G.wanted >= 1 && d < 260) ped.flee = 1.2;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle += clamp(angDiff(ped.angle, away), -4 * dt, 4 * dt);
      ped.speed = 150;
    } else ped.speed = lerp(ped.speed, 30, dt);
    if (ped.wait > 0) { ped.wait -= dt; continue; }
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!pointBlocked(G, nx, ny, 6) && nx > 16 && nx < WORLD_W - 16 && ny > 16 && ny < WORLD_H - 16) {
      ped.x = nx; ped.y = ny;
    } else ped.angle += Math.PI / 2 + Math.random();
    if (Math.random() < dt * 0.25) { ped.angle += (Math.random() - 0.5) * 1.6; if (Math.random() < 0.3) ped.wait = 1 + Math.random() * 2; }
  }
  // Taxi: a waiting pedestrian with a fare flag near the player in a car.
  if (!G.taxi && p.car) {
    const cand = G.peds.find((x) => !x.officer && x.taxi && dist(x.x, x.y, p.x, p.y) < 60);
    if (cand) {
      const dest = { x: roadCenterX(Math.floor(Math.random() * 7)), y: roadCenterY(Math.floor(Math.random() * 6)) };
      G.taxi = { ped: cand, dest, fare: 60 + Math.floor(Math.random() * 90), t: 60 };
      cand.fare = G.taxi;
      G.msg = `TAXI FARE $${G.taxi.fare} — drive to the marker!`; G.msgT = 3;
    }
  }
  if (G.taxi) {
    G.taxi.t -= dt;
    const t = G.taxi;
    if (dist(p.x, p.y, t.dest.x, t.dest.y) < 55) {
      G.cash += t.fare; G.score += 40; G.stats.fares++;
      G.floats.push({ x: p.x, y: p.y - 24, text: `+$${t.fare} FARE`, color: '#7dff5e', t: 1.4 });
      G.peds = G.peds.filter((x) => x !== t.ped);
      G.taxi = null;
    } else if (G.taxi.t <= 0) { G.taxi.ped.fare = null; G.taxi = null; G.msg = 'Fare cancelled — too slow.'; G.msgT = 2; }
  }
}
